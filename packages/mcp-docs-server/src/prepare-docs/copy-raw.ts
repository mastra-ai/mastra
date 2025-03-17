import fs from 'node:fs/promises';
import path from 'node:path';
import { fromPackageRoot, fromRepoRoot, log } from '../utils';

const DOCS_SOURCE = fromRepoRoot('docs/src/pages/docs');
const DOCS_DEST = fromPackageRoot('.docs/raw');

async function copyDir(src: string, dest: string) {
  // Create destination directory
  await fs.mkdir(dest, { recursive: true });

  // Read source directory
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      // Recursively copy directories
      await copyDir(srcPath, destPath);
    } else if (entry.isFile() && entry.name.endsWith('.mdx')) {
      // Copy only MDX files
      await fs.copyFile(srcPath, destPath);
    }
  }
}

export async function copyRaw() {
  try {
    // Clean up existing docs directory if it exists
    try {
      await fs.rm(DOCS_DEST, { recursive: true });
    } catch {
      // Ignore if directory doesn't exist
    }

    // Copy docs
    await copyDir(DOCS_SOURCE, DOCS_DEST);
    log('✅ Documentation files copied successfully');
  } catch (error) {
    console.error('❌ Failed to copy documentation files:', error);
    process.exit(1);
  }
}
