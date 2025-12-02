import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { logger } from '../logger';
import { fromPackageRoot, getMatchingPaths } from '../utils';

const migrationsBaseDir = fromPackageRoot('.docs/raw/guides/migrations');

interface ParsedSection {
  title: string;
  level: number;
  content: string;
  startLine: number;
  endLine: number;
}

// Helper function to parse MDX into sections
function parseMdxSections(content: string): ParsedSection[] {
  const lines = content.split('\n');
  const sections: ParsedSection[] = [];
  let currentSection: ParsedSection | null = null;
  let inFrontmatter = false;
  let frontmatterEnded = false;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];

    // Handle frontmatter
    if (index === 0 && line === '---') {
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter && line === '---') {
      inFrontmatter = false;
      frontmatterEnded = true;
      continue;
    }
    if (inFrontmatter) continue;

    // Match headings (## or ###)
    const headingMatch = line.match(/^(#{2,3})\s+(.+)$/);
    if (headingMatch && frontmatterEnded) {
      // Save previous section
      if (currentSection) {
        currentSection.endLine = index - 1;
        sections.push(currentSection);
      }

      // Start new section
      const level = headingMatch[1].length;
      currentSection = {
        title: headingMatch[2],
        level,
        content: line + '\n',
        startLine: index,
        endLine: index,
      };
    } else if (currentSection) {
      currentSection.content += line + '\n';
    }
  }

  // Save last section
  if (currentSection) {
    currentSection.endLine = lines.length - 1;
    sections.push(currentSection);
  }

  return sections;
}

// Helper function to recursively discover all migration paths
async function discoverMigrations(
  baseDir: string,
  relativePath = '',
): Promise<Array<{ path: string; type: 'file' | 'directory' }>> {
  const migrations: Array<{ path: string; type: 'file' | 'directory' }> = [];
  const fullPath = path.join(baseDir, relativePath);

  try {
    const entries = await fs.readdir(fullPath, { withFileTypes: true });

    for (const entry of entries) {
      const entryRelativePath = path.join(relativePath, entry.name);

      if (entry.isDirectory()) {
        // Add directory
        migrations.push({
          path: entryRelativePath,
          type: 'directory',
        });
        // Recursively explore subdirectories
        const subMigrations = await discoverMigrations(baseDir, entryRelativePath);
        migrations.push(...subMigrations);
      } else if (entry.isFile() && entry.name.endsWith('.mdx') && entry.name !== '_template.mdx') {
        // Add file (without .mdx extension for cleaner display)
        migrations.push({
          path: path.join(relativePath, entry.name.replace('.mdx', '')),
          type: 'file',
        });
      }
    }
  } catch (error) {
    void logger.error(`Failed to discover migrations in ${fullPath}`, error);
  }

  return migrations;
}

// Helper function to list directory contents at a specific path
async function listDirectoryContents(dirPath: string = ''): Promise<string> {
  try {
    const fullPath = path.join(migrationsBaseDir, dirPath);

    // Security check
    const resolvedPath = path.resolve(fullPath);
    const resolvedBaseDir = path.resolve(migrationsBaseDir);
    if (!resolvedPath.startsWith(resolvedBaseDir)) {
      return 'Invalid path';
    }

    const entries = await fs.readdir(fullPath, { withFileTypes: true });
    const directories: string[] = [];
    const files: string[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        directories.push(entry.name);
      } else if (entry.isFile() && entry.name.endsWith('.mdx') && entry.name !== '_template.mdx') {
        files.push(entry.name.replace('.mdx', ''));
      }
    }

    const output: string[] = [];
    const currentPath = dirPath || 'migrations';
    output.push(`# ${currentPath}`);
    output.push('');

    if (directories.length > 0) {
      output.push('**Directories:**');
      directories.sort().forEach(dir => {
        const nextPath = dirPath ? `${dirPath}/${dir}` : dir;
        output.push(`- **${dir}/** - Explore with \`{ path: "${nextPath}/" }\``);
      });
      output.push('');
    }

    if (files.length > 0) {
      output.push('**Migration Guides:**');
      files.sort().forEach(file => {
        const filePath = dirPath ? `${dirPath}/${file}` : file;
        output.push(`- **${file}** - Get with \`{ path: "${filePath}" }\``);
      });
      output.push('');
    }

    if (directories.length === 0 && files.length === 0) {
      output.push('No migrations found in this directory.');
    }

    output.push('---');
    output.push('');
    output.push('**Actions:**');
    output.push('- Navigate to a directory by setting \`path\` to directory name with trailing `/`');
    output.push('- View a migration guide by setting \`path\` to the guide name');
    output.push('- List sections in a guide with \`listSections: true\`');
    output.push('- Search all guides with \`queryKeywords\`');

    return output.join('\n');
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return `Directory "${dirPath}" not found. Use \`{}\` to see top-level migrations.`;
    }
    throw error;
  }
}

// Helper function to read migration content
async function readMigrationContent(migrationPath: string): Promise<string | null> {
  try {
    // Handle both with and without .mdx extension
    let filename = migrationPath.endsWith('.mdx') ? migrationPath : `${migrationPath}.mdx`;
    let filePath = path.join(migrationsBaseDir, filename);

    // Security check: ensure path doesn't escape base directory
    const resolvedPath = path.resolve(filePath);
    const resolvedBaseDir = path.resolve(migrationsBaseDir);
    if (!resolvedPath.startsWith(resolvedBaseDir)) {
      void logger.error('Path traversal attempt detected');
      return null;
    }

    const content = await fs.readFile(filePath, 'utf-8');
    return content;
  } catch (error) {
    void logger.error(`Failed to read migration: ${migrationPath}`, error);
    return null;
  }
}

// Helper function to get section headers from a migration
async function getSectionHeaders(migrationPath: string): Promise<Array<{ title: string; level: number }>> {
  const content = await readMigrationContent(migrationPath);
  if (!content) return [];

  const sections = parseMdxSections(content);
  return sections.map(s => ({ title: s.title, level: s.level }));
}

// Helper function to get specific sections by title
async function getSections(migrationPath: string, sectionTitles?: string[]): Promise<string> {
  const content = await readMigrationContent(migrationPath);
  if (!content) {
    const availableMigrations = await discoverMigrations(migrationsBaseDir);
    const paths = availableMigrations.filter(m => m.type === 'file').map(m => `- ${m.path}`);
    return `Migration "${migrationPath}" not found.\n\nAvailable migrations:\n${paths.join('\n')}`;
  }

  // If no specific sections requested, return full content
  if (!sectionTitles || sectionTitles.length === 0) {
    return content;
  }

  // Parse sections and filter by requested titles
  const sections = parseMdxSections(content);
  const requestedSections = sections.filter(s =>
    sectionTitles.some(title => s.title.toLowerCase().includes(title.toLowerCase())),
  );

  if (requestedSections.length === 0) {
    const availableHeaders = sections.map(s => `${'#'.repeat(s.level)} ${s.title}`).join('\n');
    return `Requested sections not found in "${migrationPath}".\n\nAvailable sections:\n${availableHeaders}`;
  }

  return requestedSections.map(s => s.content).join('\n---\n\n');
}

// Get initial migrations for the description
const initialMigrations = await discoverMigrations(migrationsBaseDir);
const migrationFiles = initialMigrations.filter(m => m.type === 'file');
const migrationsListing =
  migrationFiles.length > 0
    ? '\n\nExample migration paths:\n' +
      migrationFiles
        .slice(0, 5)
        .map(m => `- ${m.path}`)
        .join('\n') +
      '\n...'
    : '\n\nNo migrations available. Run the documentation preparation script first.';

export const migrationInputSchema = z.object({
  path: z
    .string()
    .optional()
    .describe(
      'Path to the migration guide (e.g., "upgrade-to-v1/agent", "agentnetwork"). If not provided, lists all available migrations.' +
        migrationsListing,
    ),
  sections: z
    .array(z.string())
    .optional()
    .describe(
      'Specific section titles to fetch from the migration guide. If not provided, returns the entire guide. Use this after exploring section headers.',
    ),
  listSections: z
    .boolean()
    .optional()
    .describe('Set to true to list all section headers in a migration guide without fetching full content.'),
  queryKeywords: z
    .array(z.string())
    .optional()
    .describe('Keywords to search across all migration guides. Use this to find guides related to specific topics.'),
});

export type MigrationInput = z.infer<typeof migrationInputSchema>;

export const migrationTool = {
  name: 'mastraMigration',
  description: `Get migration guidance for Mastra version upgrades and breaking changes.

This tool works like a file browser - navigate through directories to find migration guides:

**Step 1: List top-level migrations**
- Call with no parameters: \`{}\`
- Shows all top-level migration guides and directories

**Step 2: Navigate into a directory**
- Add trailing slash to explore: \`{ path: "upgrade-to-v1/" }\`
- Lists all migration guides in that directory

**Step 3: View a migration guide**
- Without trailing slash: \`{ path: "upgrade-to-v1/agent" }\`
- Returns the full migration guide content

**Step 4: Explore guide sections (optional)**
- List sections: \`{ path: "upgrade-to-v1/agent", listSections: true }\`
- Get specific sections: \`{ path: "upgrade-to-v1/agent", sections: ["Voice methods"] }\`

**Alternative: Search by keywords**
- \`{ queryKeywords: ["RuntimeContext", "pagination"] }\`

**Examples:**
1. List top-level: \`{}\`
2. Navigate to upgrade-to-v1: \`{ path: "upgrade-to-v1/" }\`
3. Get agent guide: \`{ path: "upgrade-to-v1/agent" }\`
4. List guide sections: \`{ path: "upgrade-to-v1/agent", listSections: true }\`
5. Search: \`{ queryKeywords: ["RuntimeContext"] }\`

**Tip:** Paths ending with \`/\` list directory contents. Paths without \`/\` fetch the migration guide.`,
  parameters: migrationInputSchema,
  execute: async (args: MigrationInput) => {
    void logger.debug('Executing mastraMigration tool', { args });
    try {
      // Priority 1: Keyword search
      if (args.queryKeywords && args.queryKeywords.length > 0) {
        const suggestions = await getMatchingPaths('', args.queryKeywords, migrationsBaseDir);
        return [
          '# Migration Guide Search Results',
          '',
          suggestions || 'No migration guides found matching your keywords.',
          '',
          '---',
          '',
          'To see all available migrations, call with no parameters.',
        ].join('\n');
      }

      // Priority 2: Handle path parameter
      if (args.path) {
        // Check if path ends with / (directory navigation)
        if (args.path.endsWith('/')) {
          const dirPath = args.path.slice(0, -1); // Remove trailing slash
          return await listDirectoryContents(dirPath);
        }

        // Priority 3: List section headers for a file
        if (args.listSections) {
          const headers = await getSectionHeaders(args.path);
          if (headers.length === 0) {
            return await listDirectoryContents();
          }

          return [
            `# ${args.path} - Section Headers`,
            '',
            'Available sections in this migration guide:',
            '',
            ...headers.map(h => `${'#'.repeat(h.level)} ${h.title}`),
            '',
            '---',
            '',
            'To get specific sections, provide their titles in the "sections" parameter.',
          ].join('\n');
        }

        // Priority 4: Get specific sections or full migration file
        const content = await getSections(args.path, args.sections);
        return `# ${args.path}\n\n${content}`;
      }

      // Priority 5: List top-level directory (default)
      return await listDirectoryContents();
    } catch (error) {
      void logger.error('Failed to execute mastraMigration tool', error);
      throw error;
    }
  },
};
