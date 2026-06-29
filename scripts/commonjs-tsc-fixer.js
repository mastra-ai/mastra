import { readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { glob as globby } from 'tinyglobby';

/** Convert Windows backslashes to posix forward slashes */
function slash(p) {
  return p.replaceAll('\\', '/');
}

async function cleanupDtsFiles() {
  const rootPath = process.cwd();
  const files = await globby('./*.d.ts', { cwd: rootPath });

  for (const file of files) {
    await rm(join(rootPath, file), { force: true });
  }
}

async function writeDtsFiles() {
  const rootPath = process.cwd();
  const packageJson = JSON.parse(await readFile(join(rootPath, 'package.json')));

  const exports = packageJson.exports;

  // Handle specific path exports
  for (const [key, value] of Object.entries(exports)) {
    if (key !== '.' && value?.require?.types) {
      const pattern = value.require.types;
      const matches = await globby(pattern, {
        cwd: rootPath,
        absolute: true,
      });

      for (const file of matches) {
        if (key.endsWith('*')) {
          // For wildcard patterns, derive the subpath relative to dist/
          const dir = dirname(file);
          const distRoot = join(rootPath, 'dist');
          const subPath = slash(relative(distRoot, dir));
          const filename = key.replace('*', subPath);

          const targetPath = join(rootPath, filename) + '.d.ts';
          await mkdir(dirname(targetPath), { recursive: true });

          const relPath = slash(relative(dirname(targetPath), file)).replace('/index.d.ts', '');
          await writeFile(targetPath, `export * from './${relPath}';`);
        } else {
          const targetPath = join(rootPath, key) + '.d.ts';
          await mkdir(dirname(targetPath), { recursive: true });

          const relPath = slash(relative(dirname(targetPath), file)).replace('/index.d.ts', '');
          await writeFile(targetPath, `export * from './${relPath}';`);
        }
      }
    }
  }
}

await cleanupDtsFiles();
await writeDtsFiles();
