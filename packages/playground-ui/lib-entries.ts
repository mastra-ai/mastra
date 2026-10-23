import { existsSync, readdirSync } from 'node:fs';
import { relative, resolve } from 'node:path';

// Shared by vite.config.ts (JS) and tsdown.config.ts (type declarations) so both build the same entries.
const packageDir = import.meta.dirname;
export const srcDir = resolve(packageDir, 'src');

const isEntrySource = (fileName: string) => /\.(ts|tsx)$/.test(fileName) && !/\.(test|stories)\.tsx?$/.test(fileName);

const forEachSourceFile = (directory: string, visit: (file: string) => void) => {
  readdirSync(directory, { withFileTypes: true }).forEach(dirent => {
    if (dirent.name === '__tests__') return;

    const path = resolve(directory, dirent.name);
    if (dirent.isDirectory()) forEachSourceFile(path, visit);
    else if (dirent.isFile() && isEntrySource(dirent.name)) visit(path);
  });
};

const fileEntries = (directory: string, prefix: string) => {
  const sourceDir = resolve(packageDir, directory);
  const entries: Array<[string, string]> = [];

  forEachSourceFile(sourceDir, file => {
    const entryName = relative(sourceDir, file)
      .replace(/\\/g, '/')
      .replace(/\.(ts|tsx)$/, '')
      .replace(/(?:^|\/)index$/, '');

    if (entryName) entries.push([`${prefix}/${entryName}`, file]);
  });

  return Object.fromEntries(entries);
};

const componentEntries = (directory: string, prefix: string) => {
  const sourceDir = resolve(packageDir, directory);
  const entries: Array<[string, string]> = [];

  const walk = (currentDir: string) => {
    readdirSync(currentDir, { withFileTypes: true }).forEach(dirent => {
      if (!dirent.isDirectory() || dirent.name === '__tests__') return;

      const folder = resolve(currentDir, dirent.name);
      const indexFile = resolve(folder, 'index.ts');

      if (!existsSync(indexFile)) {
        walk(folder);
        return;
      }

      entries.push([`${prefix}/${relative(sourceDir, folder).replace(/\\/g, '/')}`, indexFile]);
    });
  };

  walk(sourceDir);

  return Object.fromEntries(entries);
};

export const libEntries = (): Record<string, string> => ({
  style: resolve(srcDir, 'style.ts'),
  tokens: resolve(srcDir, 'ds/tokens/index.ts'),
  'lib/framework': resolve(srcDir, 'lib/framework.tsx'),
  ...fileEntries('src/utils', 'utils'),
  ...fileEntries('src/domains', 'domains'),
  ...fileEntries('src/ee', 'ee'),
  ...fileEntries('src/ds/primitives', 'primitives'),
  ...fileEntries('src/lib/resize', 'resize'),
  ...fileEntries('src/lib/keyboard', 'keyboard'),
  ...fileEntries('src/lib/sort', 'sort'),
  ...fileEntries('src/components', 'components'),
  ...fileEntries('src/ds/icons', 'icons'),
  ...fileEntries('src/hooks', 'hooks'),
  ...fileEntries('src/lib/form', 'lib/form'),
  ...componentEntries('src/ds/components', 'components'),
  ...componentEntries('src/ds/layout', 'layout'),
  ...componentEntries('src/ds/new', 'new'),
});
