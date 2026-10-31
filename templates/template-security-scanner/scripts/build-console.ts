import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'esbuild';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'web', 'dist');
const result = await build({
  entryPoints: [resolve(root, 'web', 'main.tsx')],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  jsx: 'automatic',
  minify: true,
  legalComments: 'none',
  logLevel: 'warning',
});
const script = result.outputFiles[0]?.contents;
if (!script) throw new Error('Console bundle was empty.');
const style = await readFile(resolve(root, 'web', 'style.css'));
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const manifest = { script: `console-${hash(script)}.js`, style: `style-${hash(style)}.css` };
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await Promise.all([
  writeFile(resolve(output, manifest.script), script),
  writeFile(resolve(output, manifest.style), style),
]);
await writeFile(resolve(output, 'manifest.json'), JSON.stringify(manifest));
