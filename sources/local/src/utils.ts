import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

/**
 * Default directories to exclude when copying projects.
 */
export const DEFAULT_COPY_EXCLUDES = [
  'node_modules',
  '.git',
  'dist',
  '.next',
  '.turbo',
  '.mastra',
];

/**
 * Generate a stable project ID from a path.
 * Uses a hash of the normalized absolute path.
 *
 * @param projectPath - Absolute path to the project
 * @returns Stable project ID
 */
export function generateProjectId(projectPath: string): string {
  const normalized = path.normalize(projectPath);
  const hash = crypto.createHash('sha256').update(normalized).digest('hex');
  // Use first 12 characters for a shorter ID
  return `local_${hash.substring(0, 12)}`;
}

/**
 * Check if a path is accessible (readable).
 *
 * @param targetPath - Path to check
 * @returns True if accessible
 */
export async function isPathAccessible(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a path exists and is a directory.
 *
 * @param targetPath - Path to check
 * @returns True if exists and is a directory
 */
export async function isDirectory(targetPath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(targetPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Resolve and normalize a path.
 * Handles relative paths by making them absolute.
 *
 * @param inputPath - Path to resolve
 * @returns Resolved absolute path
 */
export function resolvePath(inputPath: string): string {
  return path.resolve(path.normalize(inputPath));
}

/**
 * Get the project name from a path.
 * Uses the directory name as a fallback.
 *
 * @param projectPath - Path to the project
 * @returns Project name
 */
export function getProjectNameFromPath(projectPath: string): string {
  return path.basename(projectPath);
}

/**
 * Options for copyDirectory.
 */
export interface CopyDirectoryOptions {
  /**
   * Directories and files to exclude from copy.
   * @default DEFAULT_COPY_EXCLUDES
   */
  exclude?: string[];
}

/**
 * Recursively copy a directory to a target location.
 *
 * @param source - Source directory path
 * @param target - Target directory path
 * @param options - Copy options
 */
export async function copyDirectory(
  source: string,
  target: string,
  options: CopyDirectoryOptions = {},
): Promise<void> {
  const excludes = new Set(options.exclude ?? DEFAULT_COPY_EXCLUDES);

  // Create target directory
  await fs.mkdir(target, { recursive: true });

  // Read source directory
  const entries = await fs.readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    // Skip excluded entries
    if (excludes.has(entry.name)) {
      continue;
    }

    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);

    if (entry.isDirectory()) {
      // Recursively copy directory
      await copyDirectory(sourcePath, targetPath, options);
    } else if (entry.isFile()) {
      // Copy file
      await fs.copyFile(sourcePath, targetPath);
    } else if (entry.isSymbolicLink()) {
      // Copy symbolic link
      const linkTarget = await fs.readlink(sourcePath);
      await fs.symlink(linkTarget, targetPath);
    }
    // Skip other types (sockets, devices, etc.)
  }
}
