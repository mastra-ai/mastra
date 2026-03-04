import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { logger } from '../logger';
import { fromPackageRoot, getMatchingPaths } from '../utils';

const docsBaseDir = fromPackageRoot('.docs/');

type ReadDocsResult =
  | { found: true; content: string; isSecurityViolation: boolean }
  | { found: false; isSecurityViolation: boolean };

// Helper function to list contents of a directory
async function listDirContents(dirPath: string): Promise<{ dirs: string[]; files: string[] }> {
  try {
    void logger.debug(`Listing directory contents: ${dirPath}`);
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const dirs: string[] = [];
    const files: string[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        dirs.push(entry.name + '/');
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        // List all .md files (remove .md extension for cleaner display)
        files.push(entry.name.replace(/\.md$/, ''));
      }
    }

    return {
      dirs: dirs.sort(),
      files: files.sort(),
    };
  } catch (error) {
    void logger.error(`Failed to list directory contents: ${dirPath}`, error);
    throw error;
  }
}

// Helper function to read documentation content from a path
async function readDocsContent(docPath: string, queryKeywords: string[]): Promise<ReadDocsResult> {
  const fullPath = path.resolve(path.join(docsBaseDir, docPath));
  if (!fullPath.startsWith(path.resolve(docsBaseDir))) {
    void logger.error(`Path traversal attempt detected`);
    return { found: false, isSecurityViolation: true };
  }
  void logger.debug(`Reading docs content from: ${fullPath}`);

  // Try multiple approaches to find the content:
  // 1. Try as a direct file path (with .md extension)
  // 2. Try as a directory with index.md
  // 3. Try as a file path by appending .md

  try {
    const stats = await fs.stat(fullPath);

    if (stats.isDirectory()) {
      // It's a directory - check for index.md (for category roots)
      const indexMdPath = path.join(fullPath, 'index.md');
      try {
        const content = await fs.readFile(indexMdPath, 'utf-8');
        return { found: true, content, isSecurityViolation: false };
      } catch {
        // No index.md, show directory listing
      }

      // List directory contents (subdirs and .md files)
      const { dirs, files } = await listDirContents(fullPath);
      const listing: string[] = [`Directory contents of ${docPath || '/'}:`, ''];

      if (dirs.length > 0) {
        listing.push('Subdirectories:');
        listing.push(...dirs.map(d => `- ${docPath ? `${docPath}/${d}` : d}`));
        listing.push('');
      }

      if (files.length > 0) {
        listing.push('Available documentation paths:');
        listing.push(...files.map(f => `- ${docPath ? `${docPath}/${f}` : f}`));
        listing.push('');
      }

      if (dirs.length === 0 && files.length === 0) {
        listing.push('No documentation available in this directory.');
      }

      // Add content-based suggestions when query keywords are provided
      const contentBasedSuggestions = await getMatchingPaths(docPath, queryKeywords, docsBaseDir);
      const suggestions = contentBasedSuggestions ? ['---', '', contentBasedSuggestions, ''].join('\n') : '';

      return { found: true, content: listing.join('\n') + suggestions, isSecurityViolation: false };
    }

    // It's a file - read it directly
    const content = await fs.readFile(fullPath, 'utf-8');
    return { found: true, content, isSecurityViolation: false };
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      // Path doesn't exist as-is, try adding .md extension
      try {
        const mdPath = fullPath + '.md';
        const content = await fs.readFile(mdPath, 'utf-8');
        return { found: true, content, isSecurityViolation: false };
      } catch {
        // Still not found
        return { found: false, isSecurityViolation: false };
      }
    }
    // Unexpected error: rethrow
    throw error;
  }
}

// Helper function to find nearest existing directory and its contents
async function findNearestDirectory(docPath: string, availablePaths: string): Promise<string> {
  void logger.debug(`Finding nearest directory for: ${docPath}`);
  // Split path into parts and try each parent directory
  const parts = docPath.split('/');

  while (parts.length > 0) {
    const testPath = parts.join('/');
    try {
      const fullPath = path.join(docsBaseDir, testPath);
      const stats = await fs.stat(fullPath);

      if (stats.isDirectory()) {
        const { dirs, files } = await listDirContents(fullPath);
        const listing: string[] = [
          `Path "${docPath}" not found.`,
          `Here are the available paths in "${testPath}":`,
          '',
        ];

        if (dirs.length > 0) {
          listing.push('Directories:');
          listing.push(...dirs.map(d => `- ${testPath}/${d}`));
          listing.push('');
        }

        if (files.length > 0) {
          listing.push('Files:');
          listing.push(...files.map(f => `- ${testPath}/${f}`));
        }

        return listing.join('\n');
      }
    } catch {
      // Directory doesn't exist, try parent
      void logger.debug(`Directory not found, trying parent: ${parts.slice(0, -1).join('/')}`);
    }
    parts.pop();
  }

  // If no parent directories found, return root listing
  return [`Path "${docPath}" not found.`, 'Here are all available paths:', '', availablePaths].join('\n');
}

// Get initial directory listing for the description
async function getAvailablePaths(): Promise<string> {
  const { dirs, files } = await listDirContents(docsBaseDir);

  // Get reference directory contents if it exists
  let referenceDirs: string[] = [];
  if (dirs.includes('reference/')) {
    const { dirs: refDirs } = await listDirContents(path.join(docsBaseDir, 'reference'));
    referenceDirs = refDirs.map(d => `reference/${d}`);
  }

  return [
    'Available top-level paths:',
    '',
    'Directories:',
    ...dirs.map(d => `- ${d}`),
    '',
    referenceDirs.length > 0 ? 'Reference subdirectories:' : '',
    ...referenceDirs.map(d => `- ${d}`),
    '',
    files.length > 0 ? 'Files:' : '',
    ...files.map(f => `- ${f}`),
  ]
    .filter(Boolean)
    .join('\n');
}

// Initialize available paths
const availablePaths = await getAvailablePaths();

export const docsInputSchema = z.object({
  paths: z
    .array(z.string())
    .min(1)
    .describe(`One or more documentation paths to fetch\nAvailable paths:\n${availablePaths}`),
  queryKeywords: z
    .array(z.string())
    .optional()
    .describe(
      'Keywords from user query to use for matching documentation. Each keyword should be a single word or short phrase; any whitespace-separated keywords will be split automatically.',
    ),
});

export type DocsInput = z.infer<typeof docsInputSchema>;

export const docsTool = {
  name: 'mastraDocs',
  description: `[🌐 REMOTE] Get Mastra documentation.
    Request paths to explore the docs. References contain API docs.
    Other paths contain guides. The user doesn\'t know about files and directories.
    You can also use keywords from the user query to find relevant documentation, but prioritize paths.
    This is your internal knowledge the user can\'t read.
    If the user asks about a feature check general docs as well as reference docs for that feature.
    Ex: with workflows check in docs/workflows and in reference/workflows.
    Provide code examples so the user understands.
    IMPORTANT: Be concise with your answers. The user will ask for more info.
    If packages need to be installed, provide the pnpm command to install them.
    Ex. if you see \`import { X } from "@mastra/$PACKAGE_NAME"\` in an example, show an install command.
    Always install latest tag, not alpha unless requested. If you scaffold a new project it may be in a subdir.
    When displaying results, always mention which file path contains the information so users know where this documentation lives.`,
  parameters: docsInputSchema,
  execute: async (args: DocsInput) => {
    void logger.debug('Executing mastraDocs tool', { args });
    try {
      const queryKeywords = args.queryKeywords ?? [];
      const results = await Promise.all(
        args.paths.map(async (docPath: string) => {
          try {
            const result = await readDocsContent(docPath, queryKeywords);
            if (result.found) {
              return {
                path: docPath,
                content: result.content,
                error: null,
              };
            }
            if (result.isSecurityViolation) {
              return {
                path: docPath,
                content: null,
                error: 'Invalid path',
              };
            }
            const directorySuggestions = await findNearestDirectory(docPath, availablePaths);
            const contentBasedSuggestions = await getMatchingPaths(docPath, queryKeywords, docsBaseDir);
            return {
              path: docPath,
              content: null,
              error: [directorySuggestions, contentBasedSuggestions].join('\n\n'),
            };
          } catch (error) {
            void logger.warning(`Failed to read content for path: ${docPath}`, error);
            return {
              path: docPath,
              content: null,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        }),
      );

      // Format the results
      const output = results
        .map(result => {
          if (result.error) {
            return `## ${result.path}\n\n${result.error}\n\n---\n`;
          }
          return `## ${result.path}\n\n${result.content}\n\n---\n`;
        })
        .join('\n');

      return output;
    } catch (error) {
      void logger.error('Failed to execute mastraDocs tool', error);
      throw error;
    }
  },
};
