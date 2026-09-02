import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
if (outIndex < 0 || !args[outIndex + 1]) throw new Error('Usage: create-linked-workspace.ts --out <directory>');

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../../../../../');
const template = join(here, 'linked-workspace');
const output = resolve(args[outIndex + 1]!);
await rm(output, { recursive: true, force: true });
await mkdir(dirname(output), { recursive: true });
await cp(template, output, { recursive: true });

const packagePath = join(output, 'package.json');
const packageJson = (await readFile(packagePath, 'utf8'))
  .replace('__CORE_PATH__', join(root, 'packages/core'))
  .replace('__LIBSQL_PATH__', join(root, 'stores/libsql'))
  .replace('__MEMORY_PATH__', join(root, 'packages/memory'))
  .replace('__PG_PATH__', join(root, 'stores/pg'))
  .replace('__TSX_PATH__', join(root, 'node_modules/tsx'));
await writeFile(packagePath, packageJson, 'utf8');
console.log(`Materialized Knowledge import proof workspace at ${output}`);
