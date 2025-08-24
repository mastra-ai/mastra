import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { getPackageInfo } from 'local-pkg';

export function upsertMastraDir({ dir = process.cwd() }: { dir?: string }) {
  const dirPath = join(dir, '.mastra');

  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
    execSync(`echo ".mastra" >> .gitignore`);
  }
}

/**
 * Get the package name from a module ID
 */
export function getPackageName(id: string) {
  const parts = id.split('/');

  if (id.startsWith('@')) {
    return parts.slice(0, 2).join('/');
  }

  return parts[0];
}

/**
 * Get package root path
 */
export async function getPackageRootPath(packageName: string): Promise<string | null> {
  let rootPath: string | null;

  try {
    const pkg = await getPackageInfo(packageName);
    rootPath = pkg?.rootPath ?? null;
  } catch (e) {
    rootPath = null;
  }

  return rootPath;
}
