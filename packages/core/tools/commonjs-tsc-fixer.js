import { readFile, writeFile, rm, mkdir } from 'fs/promises';
import { dirname, join, relative } from 'path';
import { globby } from 'globby';

async function cleanupDtsFiles() {
  const rootPath = new URL('../', import.meta.url).pathname;
  const files = await globby('./*.d.ts', { cwd: rootPath });

  for (const file of files) {
    await rm(join(rootPath, file), { force: true });
  }
}

async function writeDtsFiles() {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url)));

  const exports = packageJson.exports;

  const rootPath = new URL('../', import.meta.url).pathname;

  // Handle specific path exports
  for (const [key, value] of Object.entries(exports)) {
    if (key !== '.' && value.require?.types) {
      const pattern = value.require.types;
      const matches = await globby(pattern, {
        cwd: rootPath,
        absolute: true,
      });

      for (const file of matches) {
        if (key.endsWith('*')) {
          // For wildcard patterns, add the directory
          const dir = dirname(file);
          const filename = key.replace('*', dir.replace(join(rootPath, 'dist/'), ''));

          const targetPath = join(rootPath, filename) + '.d.ts';
          await mkdir(dirname(targetPath), { recursive: true });

          await writeFile(
            targetPath,
            `export * from './${relative(dirname(targetPath), file).replace('/index.d.ts', '').replaceAll('\\', '/')}';`,
          );
        } else {
          const targetPath = join(rootPath, key) + '.d.ts';
          await mkdir(dirname(targetPath), { recursive: true });

          await writeFile(
            targetPath,
            `export * from './${relative(dirname(targetPath), file).replace('/index.d.ts', '').replaceAll('\\', '/')}';`,
          );
        }
      }
    }
  }
}

await cleanupDtsFiles();
await writeDtsFiles();
