import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { logger } from '../logger';
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
  void logger.debug('Listing package changelogs');
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
  void logger.debug(`Reading changelog: ${filename}`);

  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    const packages = await listPackageChangelogs();
    const availablePackages = packages.map(pkg => `- ${pkg.name}`).join('\n');
    return `Changelog for "${filename.replace('.md', '')}" not found.\n\nAvailable packages:\n${availablePackages}`;
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
  parameters: changesInputSchema,
  execute: async (args: ChangesInput) => {
    void logger.debug('Executing mastraChanges tool', { package: args.package });
    try {
      if (!args.package) {
        const packages = await listPackageChangelogs();
        const content = ['Available package changelogs:', '', ...packages.map(pkg => `- ${pkg.name}`)].join('\n');
        return content;
      }

      const content = await readPackageChangelog(args.package);
      return content;
    } catch (error) {
      void logger.error('Failed to execute mastraChanges tool', error);
      throw error;
    }
  },
};
