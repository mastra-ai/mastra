import { existsSync } from 'node:fs';
import * as path from 'node:path';

export interface ProjectRootOptions {
  /** Explicit root path - skip detection */
  root?: string;
  /** Starting directory to search from (default: process.cwd()) */
  cwd?: string;
}

/**
 * Find the project root by searching upward for package.json.
 *
 * Resolution order:
 * 1. Explicit `root` option
 * 2. Search upward from `cwd` for package.json
 * 3. Fallback to process.cwd()
 *
 * @example
 * ```typescript
 * // Find project root from current directory
 * const root = getProjectRoot();
 *
 * // Find project root from specific directory
 * const root = getProjectRoot({ cwd: '/some/nested/dir' });
 *
 * // Use explicit root (skip detection)
 * const root = getProjectRoot({ root: '/my/project' });
 * ```
 */
export function getProjectRoot(options: ProjectRootOptions = {}): string {
  if (options.root) {
    return path.resolve(options.root);
  }

  const startDir = options.cwd ?? process.cwd();
  return findUpPackageJson(startDir) ?? startDir;
}

// Directories to skip when searching for project root
// These are build outputs that may contain their own package.json
const SKIP_DIRECTORIES = new Set(['.mastra']);

/**
 * Check if a path is inside a skipped directory (e.g., inside .mastra/).
 * This handles cases like .mastra/output which has its own package.json.
 */
function isInsideSkippedDirectory(dir: string): boolean {
  const parts = dir.split(path.sep);
  return parts.some(part => SKIP_DIRECTORIES.has(part));
}

function findUpPackageJson(startDir: string): string | null {
  let dir = path.resolve(startDir);
  const root = path.parse(dir).root;

  // If starting inside a skipped directory (e.g., .mastra/output),
  // skip up past the skipped directory first
  while (dir !== root && isInsideSkippedDirectory(dir)) {
    dir = path.dirname(dir);
  }

  while (dir !== root) {
    const dirName = path.basename(dir);

    // Skip build output directories
    if (SKIP_DIRECTORIES.has(dirName)) {
      dir = path.dirname(dir);
      continue;
    }

    if (existsSync(path.join(dir, 'package.json'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }

  // Check root directory as well
  if (existsSync(path.join(root, 'package.json'))) {
    return root;
  }

  return null;
}

/**
 * Resolve a path relative to project root.
 *
 * Path handling:
 * - Absolute paths → returned as-is
 * - Relative paths → resolved from project root
 *
 * @example
 * ```typescript
 * // Relative paths resolved from project root
 * resolveFromProjectRoot('./data/db.sqlite');  // → /Users/me/project/data/db.sqlite
 * resolveFromProjectRoot('data/db.sqlite');    // → /Users/me/project/data/db.sqlite
 *
 * // Absolute paths returned as-is (useful for env vars)
 * resolveFromProjectRoot('/var/data/db.sqlite');  // → /var/data/db.sqlite
 * resolveFromProjectRoot(process.env.DB_PATH!);   // → whatever the env var is
 * ```
 */
export function resolveFromProjectRoot(inputPath: string, options?: ProjectRootOptions): string {
  if (path.isAbsolute(inputPath)) {
    return inputPath;
  }
  return path.resolve(getProjectRoot(options), inputPath);
}
