import fs from 'node:fs/promises';
import path from 'node:path';
import { fromPackageRoot, fromRepoRoot, log } from '../utils';

// Define all source directories to scan
const SOURCE_DIRS = ['packages', 'speech', 'stores', 'voice', 'integrations', 'deployers', 'client-sdks'].map(
  fromRepoRoot,
);
const CHANGELOGS_DEST = fromPackageRoot('.docs/organized/changelogs');
const MAX_LINES = 300;

/**
 * Truncates content to a maximum number of lines and adds a message about hidden lines
 */
function truncateContent(content: string, maxLines: number): string {
  const lines = content.split('\n');
  if (lines.length <= maxLines) return content;

  const visibleLines = lines.slice(0, maxLines);
  const hiddenCount = lines.length - maxLines;
  return visibleLines.join('\n') + `\n\n... ${hiddenCount} more lines hidden. See full changelog in package directory.`;
}

/**
 * Process a single package directory
 */
async function processPackageDir(packagePath: string, outputDir: string): Promise<void> {
  // Try to read package.json first
  let packageName: string;
  try {
    const packageJsonPath = path.join(packagePath, 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
    packageName = packageJson.name;
    if (!packageName) {
      log(`Skipping ${path.basename(packagePath)}: No package name found in package.json`);
      return;
    }
  } catch {
    console.error(`Skipping ${path.basename(packagePath)}: No valid package.json found`);
    return;
  }

  // Try to read CHANGELOG.md
  try {
    const changelogPath = path.join(packagePath, 'CHANGELOG.md');
    let changelog: string;
    try {
      changelog = await fs.readFile(changelogPath, 'utf-8');
      changelog = truncateContent(changelog, MAX_LINES);
    } catch {
      changelog = 'No changelog available.';
    }

    // Write to output file using URL-encoded package name
    const outputFile = path.join(outputDir, `${encodeURIComponent(packageName)}.md`);
    await fs.writeFile(outputFile, changelog, 'utf-8');
    log(`Generated changelog for ${packageName}`);
  } catch (error) {
    console.error(`Error processing changelog for ${packageName}:`, error);
  }
}

/**
 * Scans package directories and creates organized changelog files
 */
export async function preparePackageChanges() {
  const outputDir = path.resolve(process.cwd(), CHANGELOGS_DEST);

  // Clean up existing output directory
  try {
    await fs.rm(outputDir, { recursive: true, force: true });
  } catch {
    // Ignore errors if directory doesn't exist
  }

  // Ensure output directory exists
  await fs.mkdir(outputDir, { recursive: true });

  // Process each source directory
  for (const sourceDir of SOURCE_DIRS) {
    const fullSourceDir = path.resolve(process.cwd(), sourceDir);

    try {
      // Check if directory exists before trying to read it
      await fs.access(fullSourceDir);

      const entries = await fs.readdir(fullSourceDir, { withFileTypes: true });
      const packageDirs = entries
        .filter(entry => entry.isDirectory())
        .filter(entry => entry.name !== 'docs-mcp' && entry.name !== '_config');

      // Process each package directory
      for (const dir of packageDirs) {
        const packagePath = path.join(fullSourceDir, dir.name);
        await processPackageDir(packagePath, outputDir);
      }
    } catch {
      console.error(`Skipping ${sourceDir}: Directory not found or not accessible`);
    }
  }
}

