import { readdir, mkdir, copyFile, readlink, symlink } from 'node:fs/promises';
import { join } from 'node:path';

export interface CopyOptions {
  exclude?: string[];
}

/**
 * Recursively copy a directory, excluding specified patterns.
 * Critical for build isolation.
 */
export async function copyDirectory(source: string, destination: string, options: CopyOptions = {}): Promise<void> {
  const exclude = new Set(options.exclude ?? []);

  await mkdir(destination, { recursive: true });

  const entries = await readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    if (exclude.has(entry.name)) {
      continue;
    }

    const srcPath = join(source, entry.name);
    const destPath = join(destination, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath, options);
    } else if (entry.isSymbolicLink()) {
      const linkTarget = await readlink(srcPath);
      await symlink(linkTarget, destPath);
    } else {
      await copyFile(srcPath, destPath);
    }
  }
}
