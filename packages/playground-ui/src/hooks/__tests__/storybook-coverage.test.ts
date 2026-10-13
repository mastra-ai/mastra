import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.name === '__tests__') return [];
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

function exportedHookNames(path: string) {
  return [...readFileSync(path, 'utf8').matchAll(/^export (?:function|const) (use[A-Z]\w*)/gm)].map(match => match[1]);
}

it('gives every reusable utility and keyboard hook a named Storybook entry', () => {
  const files = [...sourceFiles(join(sourceRoot, 'hooks')), ...sourceFiles(join(sourceRoot, 'lib/keyboard'))];
  const stories = files.filter(path => path.endsWith('.stories.tsx'));
  const titles = new Set(
    stories.flatMap(path =>
      [...readFileSync(path, 'utf8').matchAll(/title:\s*['"]Hooks\/(use\w+)['"]/g)].map(match => match[1]),
    ),
  );
  const hooks = new Set(files.filter(path => !path.endsWith('.stories.tsx')).flatMap(exportedHookNames));

  expect(hooks.size).toBeGreaterThan(0);
  expect(
    [...hooks].filter(name => !titles.has(name)),
    'Hooks missing from the Storybook sidebar',
  ).toEqual([]);
});
