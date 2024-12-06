import fs from 'fs';
import path from 'path';

/**
 * Finds and returns the first available directory from an array of paths
 * @param paths - Array of directory paths to check
 * @returns The first valid directory path or null if none found
 */
export function findFirstDirectory(paths: string[]): string | null {
  for (const pathToCheck of paths) {
    try {
      const normalizedPath = path.normalize(pathToCheck);

      if (fs.existsSync(normalizedPath)) {
        const stats = fs.statSync(normalizedPath);

        if (stats.isDirectory()) {
          return normalizedPath;
        }
      }
    } catch {
      continue;
    }
  }

  return null;
}
