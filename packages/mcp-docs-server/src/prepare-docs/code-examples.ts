import fs from 'node:fs/promises';
import path from 'node:path';
import { fromPackageRoot, fromRepoRoot, log } from '../utils.js';

const EXAMPLES_SOURCE = fromRepoRoot('examples');
const OUTPUT_DIR = fromPackageRoot('.docs/organized/code-examples');

/**
 * Scans example directories and creates flattened code example files
 */
export async function prepareCodeExamples() {
  // Clean up existing output directory
  try {
    await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
  } catch {
    // Ignore errors if directory doesn't exist
  }

  // Ensure output directory exists
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  // Get all example directories
  const examples = await fs.readdir(EXAMPLES_SOURCE, { withFileTypes: true });
  const exampleDirs = examples.filter(entry => entry.isDirectory());

  for (const dir of exampleDirs) {
    const examplePath = path.join(EXAMPLES_SOURCE, dir.name);
    const outputFile = path.join(OUTPUT_DIR, `${dir.name}.md`);

    // Collect all relevant files
    const files: { path: string; content: string }[] = [];

    // First add package.json if it exists
    try {
      const packageJson = await fs.readFile(path.join(examplePath, 'package.json'), 'utf-8');
      files.push({
        path: 'package.json',
        content: packageJson,
      });
    } catch {
      // Skip if no package.json
    }

    // Then scan for TypeScript files in src
    try {
      const srcPath = path.join(examplePath, 'src');
      await scanDirectory(srcPath, srcPath, files);
    } catch {
      // Skip if no src directory
    }

    // If we found any files, generate markdown and check line count
    if (files.length > 0) {
      const output = files
        .map(file => `### ${file.path}\n\`\`\`${getFileType(file.path)}\n${file.content}\n\`\`\`\n`)
        .join('\n');

      const totalLines = output.split('\n').length;

      // Skip if total lines would exceed 500
      if (totalLines > 500) {
        log(`Skipping ${dir.name}: ${totalLines} lines exceeds limit of 500`);
        continue;
      }

      await fs.writeFile(outputFile, output, 'utf-8');
      log(`Generated ${dir.name}.md with ${totalLines} lines`);
    }
  }
}

/**
 * Recursively scan a directory for TypeScript files
 */
async function scanDirectory(basePath: string, currentPath: string, files: { path: string; content: string }[]) {
  const entries = await fs.readdir(currentPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(currentPath, entry.name);
    const relativePath = path.relative(basePath, fullPath);

    if (entry.isDirectory()) {
      await scanDirectory(basePath, fullPath, files);
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      const content = await fs.readFile(fullPath, 'utf-8');
      files.push({
        path: relativePath,
        content,
      });
    }
  }
}

/**
 * Get the appropriate code fence language based on file extension
 */
function getFileType(filePath: string): string {
  if (filePath === 'package.json') return 'json';
  if (filePath.endsWith('.ts')) return 'typescript';
  return '';
}
