import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rolldown } from 'rolldown';
import type { OutputAsset } from 'rolldown';
import { afterEach, describe, expect, it } from 'vitest';
import { nodeGypDetector } from './node-gyp-detector';

const tempDirs: string[] = [];
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const tempRoot = join(packageRoot, '.tmp');

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })));
});

async function writeFiles(root: string, files: Record<string, string>) {
  for (const [file, content] of Object.entries(files)) {
    const path = join(root, file);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content);
  }
}

function pkgJson(name: string) {
  return JSON.stringify({ name, version: '1.0.0', main: 'index.js' });
}

describe('nodeGypDetector', () => {
  it('maps chunks to the packages that load native addons through node-gyp-build', async () => {
    await mkdir(tempRoot, { recursive: true });
    const root = await mkdtemp(join(tempRoot, 'node-gyp-detector-'));
    tempDirs.push(root);

    await writeFiles(root, {
      'package.json': JSON.stringify({ name: 'app', version: '1.0.0', type: 'module' }),
      'index.js': `import native from 'native-pkg';\nimport plain from 'plain-pkg';\nexport default [native, plain];\n`,
      'node_modules/native-pkg/package.json': pkgJson('native-pkg'),
      'node_modules/native-pkg/index.js': `module.exports = require('node-gyp-build')(__dirname);\n`,
      'node_modules/plain-pkg/package.json': pkgJson('plain-pkg'),
      'node_modules/plain-pkg/index.js': `module.exports = 'plain';\n`,
      'node_modules/node-gyp-build/package.json': pkgJson('node-gyp-build'),
      'node_modules/node-gyp-build/index.js': `module.exports = function load(dir) { return { dir }; };\n`,
    });

    const bundle = await rolldown({
      input: join(root, 'index.js'),
      cwd: root,
      platform: 'node',
      plugins: [nodeGypDetector()],
    });
    const { output } = await bundle.generate({ format: 'esm', assetFileNames: '[name][extname]' });
    await bundle.close();

    const entry = output.find(file => file.type === 'chunk' && file.isEntry)!;
    const binaryMap = output.find(
      (file): file is OutputAsset => file.type === 'asset' && file.fileName === 'binary-map.json',
    );
    expect(binaryMap).toBeDefined();
    expect(JSON.parse(String(binaryMap!.source))).toEqual({ [entry.fileName]: ['native-pkg'] });
  });
});
