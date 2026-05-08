import { existsSync, readdirSync } from 'node:fs';
import type { Dirent } from 'node:fs';
import { dirname, isAbsolute, join, sep } from 'node:path';

const IGNORED_DIRECTORIES = new Set([
  'node_modules',
  '.git',
  '.mastra',
  '.turbo',
  '.next',
  'dist',
  'build',
  'coverage',
]);

export interface MigratePathResolution {
  rootDir: string;
  mastraDir: string;
}

export interface MigrateEntryResolution {
  checkedPaths: string[];
  entryFile?: string;
}

export function resolveMigratePaths(args: { cwd: string; root?: string; dir?: string }): MigratePathResolution {
  const rootDir = args.root ? (isAbsolute(args.root) ? args.root : join(args.cwd, args.root)) : args.cwd;
  const mastraDir = args.dir
    ? isAbsolute(args.dir)
      ? args.dir
      : join(rootDir, args.dir)
    : join(rootDir, 'src', 'mastra');

  return { rootDir, mastraDir };
}

export function resolveMigrateEntryFile(mastraDir: string): MigrateEntryResolution {
  const checkedPaths = [join(mastraDir, 'index.ts'), join(mastraDir, 'index.js')];
  const entryFile = checkedPaths.find(path => existsSync(path));
  return { checkedPaths, entryFile };
}

function isMastraSourceDirectory(path: string): boolean {
  const parts = path.split(sep);
  return parts.length >= 2 && parts[parts.length - 1] === 'mastra' && parts[parts.length - 2] === 'src';
}

export function findMastraEntryCandidates(rootDir: string, maxCandidates = 5): string[] {
  const candidates: string[] = [];
  const queue: string[] = [rootDir];

  while (queue.length > 0 && candidates.length < maxCandidates) {
    const currentDir = queue.pop()!;

    let entries: Dirent[];
    try {
      entries = readdirSync(currentDir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const entryName = entry.name;
      const fullPath = join(currentDir, entryName);

      if (entry.isDirectory()) {
        if (IGNORED_DIRECTORIES.has(entryName)) {
          continue;
        }
        queue.push(fullPath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      if ((entryName === 'index.ts' || entryName === 'index.js') && isMastraSourceDirectory(currentDir)) {
        candidates.push(fullPath);
        if (candidates.length >= maxCandidates) {
          break;
        }
      }
    }
  }

  return candidates.sort();
}

export function toDetectedProjectRoot(entryFile: string): string {
  return dirname(dirname(dirname(entryFile)));
}
