import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Tool, Context } from 'tylerbarnes-fastmcp-fix';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function to encode package names for file paths
function encodePackageName(name: string): string {
  return encodeURIComponent(name);
}

// Helper function to decode package names from file paths
function decodePackageName(name: string): string {
  return decodeURIComponent(name);
}

// Helper function to list package changelogs
async function listPackageChangelogs(): Promise<Array<{ name: string; path: string }>> {
  const changelogsDir = path.resolve(__dirname, '../../.docs/organized/changelogs');
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
  const changelogsDir = path.resolve(__dirname, '../../.docs/organized/changelogs');
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

const changesSchema = z.object({
  package: z
    .string()
    .optional()
    .describe('Name of the specific package to fetch changelog for. If not provided, lists all available packages.'),
});

type ChangesParams = z.infer<typeof changesSchema>;

export const changesTool: Tool<any, typeof changesSchema> = {
  name: 'mastraChanges',
  description: 'Get changelog information for Mastra.ai packages. ' + packagesListing,
  parameters: changesSchema,
  execute: async (args: ChangesParams, _context: Context<any>) => {
    if (!args.package) {
      const packages = await listPackageChangelogs();
      return ['Available package changelogs:', '', ...packages.map(pkg => `- ${pkg.name}`)].join('\n');
    }

    const content = await readPackageChangelog(args.package);
    return content;
  },
};
