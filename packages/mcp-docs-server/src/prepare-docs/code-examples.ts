import fs from 'node:fs/promises';
import path from 'node:path';
import { fromPackageRoot, fromRepoRoot, log } from '../utils.js';

const EXAMPLES_SOURCE = fromRepoRoot('examples');
const OUTPUT_DIR = fromPackageRoot('.docs/organized/code-examples');

interface ExampleConfig {
  ignore?: string[];
  include?: string[];
  maxLines?: number;
}

/**
 * Load example-specific configuration
 */
async function loadExampleConfig(examplePath: string): Promise<ExampleConfig> {
  try {
    const configPath = path.join(examplePath, '.mcp-docs.json');
    const configContent = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(configContent);
  } catch {
    return {};
  }
}

/**
 * Check if a file path matches any ignore patterns
 */
function shouldIgnoreFile(filePath: string, ignorePatterns: string[] = []): boolean {
  return ignorePatterns.some(pattern => {
    // Support simple glob patterns
    const regex = pattern.replace(/\*/g, '.*').replace(/\?/g, '.').replace(/\//g, '\\/');
    return new RegExp(regex).test(filePath);
  });
}

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

    // Load example-specific configuration
    const config = await loadExampleConfig(examplePath);

    // Collect all relevant files
    const files: { path: string; content: string }[] = [];

    // First add package.json if it exists and not ignored
    if (!shouldIgnoreFile('package.json', config.ignore)) {
      try {
        const packageJsonContent = await fs.readFile(path.join(examplePath, 'package.json'), 'utf-8');
        const packageJson = JSON.parse(packageJsonContent);

        for (const key of [
          'scripts',
          'private',
          'type',
          'description',
          'version',
          'main',
          'pnpm',
          'packageManager',
          'keywords',
          'author',
          'license',
        ]) {
          if (key in packageJson) delete packageJson[key];
        }

        files.push({
          path: 'package.json',
          content: JSON.stringify(packageJson, null, 2),
        });
      } catch {
        // Skip if no package.json
      }
    }

    // Then scan for TypeScript files in src
    try {
      const srcPath = path.join(examplePath, 'src');
      await scanDirectory(srcPath, srcPath, files, config.ignore);
    } catch {
      // Skip if no src directory
    }

    // If we found any files, generate markdown and check line count
    if (files.length > 0) {
      const output = files
        .map(file => `### ${file.path}\n\`\`\`${getFileType(file.path)}\n${file.content}\n\`\`\`\n`)
        .join('\n');

      const totalLines = output.split('\n').length;

      // Skip if total lines would exceed limit
      const limit = config.maxLines || 1000;
      if (totalLines > limit) {
        log(`Skipping ${dir.name}: ${totalLines} lines exceeds limit of ${limit}`);
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
async function scanDirectory(
  basePath: string,
  currentPath: string,
  files: { path: string; content: string }[],
  ignorePatterns?: string[],
) {
  const entries = await fs.readdir(currentPath, { withFileTypes: true });
  const depth = path.relative(basePath, currentPath).split(path.sep).filter(Boolean).length;

  // Prioritize important files
  const importantFiles = ['index.ts', 'mastra.ts', 'agent.ts', 'workflow.ts', 'tool.ts'];
  const isImportantFile = (name: string) => importantFiles.some(f => name.endsWith(f));

  // First pass: collect important files
  for (const entry of entries) {
    const fullPath = path.join(currentPath, entry.name);
    const relativePath = path.relative(basePath, fullPath);

    // Skip if file matches ignore patterns
    if (shouldIgnoreFile(relativePath, ignorePatterns)) {
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.ts') && isImportantFile(entry.name)) {
      const content = await fs.readFile(fullPath, 'utf-8');
      files.push({
        path: relativePath,
        content,
      });
    }
  }

  // Second pass: handle directories (limit depth to 2)
  if (depth < 2) {
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      const relativePath = path.relative(basePath, fullPath);

      // Skip if directory matches ignore patterns
      if (entry.isDirectory() && !shouldIgnoreFile(relativePath, ignorePatterns)) {
        await scanDirectory(basePath, fullPath, files, ignorePatterns);
      }
    }
  }

  // Third pass: add remaining .ts files if we still have room
  for (const entry of entries) {
    const fullPath = path.join(currentPath, entry.name);
    const relativePath = path.relative(basePath, fullPath);

    // Skip if file matches ignore patterns
    if (shouldIgnoreFile(relativePath, ignorePatterns)) {
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.ts') && !isImportantFile(entry.name)) {
      // Check if we already added this file
      if (!files.some(f => f.path === relativePath)) {
        const content = await fs.readFile(fullPath, 'utf-8');
        files.push({
          path: relativePath,
          content,
        });
      }
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
