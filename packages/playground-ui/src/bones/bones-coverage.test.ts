import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// A bone name without a committed `<name>.bones.json` renders no skeleton at all, so every name used
// in playground-ui or Studio must have been captured by `pnpm bones:capture`.
const repoPackages = resolve(__dirname, '../../..');
const sourceRoots = ['playground-ui/src', 'playground/src'].map(dir => join(repoPackages, dir));
const BONE_USAGE = /<Bone(?:Skeleton|Suspense)\b[^>]*?\bname=["']([^"']+)["']/gs;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (entry.name === 'node_modules' || entry.name === '__tests__') return [];
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx$/.test(entry.name) && !/\.(test|spec)\.tsx$/.test(entry.name) ? [path] : [];
  });
}

describe('committed bones', () => {
  const committed = new Set(
    readdirSync(__dirname)
      .filter(file => file.endsWith('.bones.json'))
      .map(file => file.slice(0, -'.bones.json'.length)),
  );

  const usages = sourceRoots.flatMap(root =>
    sourceFiles(root).flatMap(file =>
      [...readFileSync(file, 'utf8').matchAll(BONE_USAGE)].map(([, name = '']) => ({
        name,
        file: relative(repoPackages, file),
      })),
    ),
  );

  it('finds the bone usages it guards', () => {
    expect(usages.length).toBeGreaterThan(0);
  });

  it('has a captured bones file for every bone name in use', () => {
    const missing = usages.filter(usage => !committed.has(usage.name)).map(usage => `${usage.name} (${usage.file})`);
    expect(missing).toEqual([]);
  });
});
