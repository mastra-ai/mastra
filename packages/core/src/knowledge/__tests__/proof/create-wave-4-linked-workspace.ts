import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../../../../');
const index = process.argv.indexOf('--out');
if (index < 0 || !process.argv[index + 1]) throw new Error('--out <new directory> is required');
const output = resolve(process.argv[index + 1]!);
await mkdir(dirname(output), { recursive: true });
await mkdir(output).catch((error: NodeJS.ErrnoException) => {
  if (error.code === 'EEXIST') throw new Error('Output already exists; choose a fresh proof workspace');
  throw error;
});
await cp(join(here, '../../imports/__tests__/proof/linked-workspace/src'), join(output, 'src'), { recursive: true });
for (const file of ['shipyard.ts', 'shipyard-importer.ts', 'shipyard-github-source.ts', 'shipyard-maintenance.ts']) {
  await cp(join(root, 'mastracode/factory/src/knowledge', file), join(output, 'src', file));
}
await cp(join(here, 'linked-workspace'), output, { recursive: true });
const packagePath = join(output, 'package.json');
let manifest = await readFile(packagePath, 'utf8');
for (const [token, path] of Object.entries({
  CORE: 'packages/core',
  LIBSQL: 'stores/libsql',
  MEMORY: 'packages/memory',
  PG: 'stores/pg',
  TSX: 'node_modules/tsx',
  TYPESCRIPT: 'node_modules/typescript',
  NODE_TYPES: 'node_modules/@types/node',
  ZOD: 'node_modules/zod',
}))
  manifest = manifest.replace(`__${token}_PATH__`, join(root, path));
await writeFile(packagePath, manifest);
console.log(`Materialized final Knowledge linked-consumer proof at ${output}`);
