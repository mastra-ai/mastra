import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { logger } from '../logger';
import { fromPackageRoot, getMatchingPaths } from '../utils';

const docsBaseDir = fromPackageRoot('.docs/raw/');

type ReadMdxResult = { found: true; content: string } | { found: false };

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
      } else if (entry.isFile() && entry.name.endsWith('.mdx')) {
        files.push(entry.name);
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

// Helper function to read MDX files from a path
async function readMdxContent(docPath: string, queryKeywords: string[]): Promise<ReadMdxResult> {
  const fullPath = path.resolve(path.join(docsBaseDir, docPath));
  if (!fullPath.startsWith(path.resolve(docsBaseDir))) {
    void logger.error(`Path traversal attempt detected`);
    return { found: false };
  }
  void logger.debug(`Reading MDX content from: ${fullPath}`);

  // Check if path exists
  try {
    const stats = await fs.stat(fullPath);

    if (stats.isDirectory()) {
      const { dirs, files } = await listDirContents(fullPath);
      const dirListing = [
        `Directory contents of ${docPath}:`,
        '',
        dirs.length > 0 ? 'Subdirectories:' : 'No subdirectories.',
        ...dirs.map(d => `- ${d}`),
        '',
        files.length > 0 ? 'Files in this directory:' : 'No files in this directory.',
        ...files.map(f => `- ${f}`),
        '',
        '---',
        '',
        'Contents of all files in this directory:',
        '',
      ].join('\n');

      // Append all file contents
      let fileContents = '';
      for (const file of files) {
        const filePath = path.join(fullPath, file);
        const content = await fs.readFile(filePath, 'utf-8');
        fileContents += `\n\n# ${file}\n\n${content}`;
      }

      // Add content-based suggestions when query keywords are provided and path is a directory
      const contentBasedSuggestions = await getMatchingPaths(docPath, queryKeywords, docsBaseDir);

      const suggestions = ['---', '', contentBasedSuggestions, ''].join('\n');

      return { found: true, content: dirListing + fileContents + suggestions };
    }

    // If it's a file, just read it
    const content = await fs.readFile(fullPath, 'utf-8');
    return { found: true, content };
  } catch (error: any) {
    void logger.error(`Failed to read MDX content: ${fullPath}`, error);
    if (error.code === 'ENOENT') {
      // Only fallback for not found
      return { found: false };
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
        return [
          `Path "${docPath}" not found.`,
          `Here are the available paths in "${testPath}":`,
          '',
          dirs.length > 0 ? 'Directories:' : 'No subdirectories.',
          ...dirs.map(d => `- ${testPath}/${d}`),
          '',
          files.length > 0 ? 'Files:' : 'No files.',
          ...files.map(f => `- ${testPath}/${f}`),
        ].join('\n');
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
    'Files:',
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
  description: `Get Mastra.ai documentation. 
    Request paths to explore the docs. References contain API docs. 
    Other paths contain guides. The user doesn\'t know about files and directories. 
    You can also use keywords from the user query to find relevant documentation, but prioritize paths. 
    This is your internal knowledge the user can\'t read. 
    If the user asks about a feature check general docs as well as reference docs for that feature. 
    Ex: with evals check in evals/ and in reference/evals/. 
    Provide code examples so the user understands. 
    If you build a URL from the path, only paths ending in .mdx exist. 
    Note that docs about MCP are currently in reference/tools/. 
    IMPORTANT: Be concise with your answers. The user will ask for more info. 
    If packages need to be installed, provide the pnpm command to install them. 
    Ex. if you see \`import { X } from "@mastra/$PACKAGE_NAME"\` in an example, show an install command. 
    Always install latest tag, not alpha unless requested. If you scaffold a new project it may be in a subdir.
    When displaying results, always mention which file path contains the information (e.g., 'Found in "path/to/file.mdx"') so users know where this documentation lives.`,
  parameters: docsInputSchema,
  execute: async (args: DocsInput) => {
    void logger.debug('Executing mastraDocs tool', { args });
    try {
      const queryKeywords = args.queryKeywords ?? [];
      const results = await Promise.all(
        args.paths.map(async (path: string) => {
          try {
            const result = await readMdxContent(path, queryKeywords);
            if (result.found) {
              return {
                path,
                content: result.content,
                error: null,
              };
            }
            const directorySuggestions = await findNearestDirectory(path, availablePaths);
            const contentBasedSuggestions = await getMatchingPaths(path, queryKeywords, docsBaseDir);
            return {
              path,
              content: null,
              error: [directorySuggestions, contentBasedSuggestions].join('\n\n'),
            };
          } catch (error) {
            void logger.warning(`Failed to read content for path: ${path}`, error);
            return {
              path,
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
