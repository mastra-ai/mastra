import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Workspace markers that indicate the root of a project
 */
const WORKSPACE_MARKERS = [
  'package.json',
  'tsconfig.json',
  'pyproject.toml',
  'go.mod',
  '.git',
  'Cargo.toml',
  'composer.json',
];

/**
 * Find the workspace root by walking up from the file path
 * looking for common workspace markers.
 *
 * For monorepos, this prioritizes the closest package/project root
 * (e.g., packages/core) over the monorepo root.
 */
export function findWorkspaceRoot(filePath: string): string {
  let currentDir = path.dirname(path.resolve(filePath));
  const root = path.parse(currentDir).root;

  // First, find the closest tsconfig.json or package.json
  // This handles monorepos where the actual project is in a subdirectory
  let closestProjectRoot: string | null = null;
  let searchDir = currentDir;

  while (searchDir !== root) {
    const hasTsConfig = fs.existsSync(path.join(searchDir, 'tsconfig.json'));
    const hasPackageJson = fs.existsSync(path.join(searchDir, 'package.json'));

    if (hasTsConfig || hasPackageJson) {
      closestProjectRoot = searchDir;
      break;
    }

    const parentDir = path.dirname(searchDir);
    if (parentDir === searchDir) {
      break;
    }
    searchDir = parentDir;
  }

  // If we found a project root, return it
  if (closestProjectRoot) {
    return closestProjectRoot;
  }

  // Otherwise, fall back to looking for any workspace marker
  currentDir = path.dirname(path.resolve(filePath));
  while (currentDir !== root) {
    for (const marker of WORKSPACE_MARKERS) {
      const markerPath = path.join(currentDir, marker);
      if (fs.existsSync(markerPath)) {
        return currentDir;
      }
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }

  // Fallback to the directory containing the file
  return path.dirname(path.resolve(filePath));
}
