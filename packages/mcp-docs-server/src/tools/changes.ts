import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { fromPackageRoot } from '../utils';

// Helper function to encode package names for file paths
function encodePackageName(name: string): string {
  return encodeURIComponent(name);
}

// Helper function to decode package names from file paths
function decodePackageName(name: string): string {
  return decodeURIComponent(name);
}

const changelogsDir = fromPackageRoot('.docs/organized/changelogs');

// Helper function to list package changelogs
async function listPackageChangelogs(): Promise<Array<{ name: string; path: string }>> {
  try {
    const files = await fs.readdir(changelogsDir);
    return files
      .filter(f => f.endsWith('.md'))
      .map(f => ({
        name: decodePackageName(f.replace('.md', '')),
        path: f,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

// Helper function to read a package changelog
async function readPackageChangelog(filename: string): Promise<string> {
  const encodedName = encodePackageName(filename.replace('.md', '')); // Remove .md if present
  const filePath = path.join(changelogsDir, `${encodedName}.md`);

  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    const packages = await listPackageChangelogs();
    const availablePackages = packages.map(pkg => `- ${pkg.name}`).join('\n');
    throw new Error(
      `Changelog for "${filename.replace('.md', '')}" not found.\n\nAvailable packages:\n${availablePackages}`,
    );
  }
}

// Get initial packages for the description
const initialPackages = await listPackageChangelogs();
const packagesListing =
  initialPackages.length > 0
    ? '\n\nAvailable packages: ' + initialPackages.map(pkg => pkg.name).join(', ')
    : '\n\nNo package changelogs available yet. Run the documentation preparation script first.';

export const changesInputSchema = z.object({
  package: z
    .string()
    .optional()
    .describe('Name of the specific package to fetch changelog for. If not provided, lists all available packages.'),
});

export type ChangesInput = z.infer<typeof changesInputSchema>;

export const changesTool = {
  name: 'mastraChanges',
  description: `Get changelog information for Mastra.ai packages. ${packagesListing}`,
  execute: async (args: ChangesInput) => {
    try {
      if (!args.package) {
        const packages = await listPackageChangelogs();
        return {
          content: [
            {
              type: 'text',
              text: ['Available package changelogs:', '', ...packages.map(pkg => `- ${pkg.name}`)].join('\n'),
            },
          ],
          isError: false,
        };
      }

      const content = await readPackageChangelog(args.package);
      return {
        content: [
          {
            type: 'text',
            text: content,
          },
        ],
        isError: false,
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  },
};
