import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

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
