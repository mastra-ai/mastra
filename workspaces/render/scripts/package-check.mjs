import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const metadata = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const destination = join(root, 'validation', 'package-artifacts', randomUUID());
await mkdir(destination, { recursive: true });
function run(command, args, cwd = root) {
  return execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 180000,
  });
}
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const packResult = JSON.parse(run('pnpm', ['pack', '--json', '--pack-destination', destination]));
const packed = Array.isArray(packResult) ? packResult[0] : packResult;
assert.equal(packed.name, metadata.name);
assert.equal(packed.version, metadata.version);
const archive = resolve(destination, packed.filename);
const paths = packed.files.map(file => file.path);
for (const required of ['dist/index.js', 'dist/index.cjs', 'dist/index.d.ts', 'README.md', 'LICENSE', 'package.json'])
  assert(paths.includes(required), required);
for (const path of paths) {
  assert(
    /^(dist\/[\w.-]+\.(?:js|cjs|d\.ts|js\.map|cjs\.map|d\.ts\.map)|README\.md|LICENSE|CHANGELOG\.md|package\.json)$/.test(
      path,
    ),
    `Unexpected packed file: ${path}`,
  );
  assert(!path.includes('.test.'), `Tests must not be published: ${path}`);
}
const results = [];
const versions = (process.env.PACKAGE_TEST_CORES ?? '1.67.0,1.75.0').split(',');
for (const core of versions) {
  assert(/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(core), 'Invalid consumer core version');
  const cwd = join(destination, core);
  await mkdir(cwd);
  await writeFile(
    join(cwd, 'package.json'),
    JSON.stringify(
      {
        private: true,
        type: 'module',
        dependencies: {
          [metadata.name]: `file:${archive}`,
          '@mastra/core': core,
          typescript: '5.9.3',
          '@types/node': metadata.devDependencies['@types/node'],
        },
      },
      null,
      2,
    ),
  );
  await copyFile(join(root, 'scripts/consumer-smoke.mjs'), join(cwd, 'smoke.mjs'));
  await writeFile(
    join(cwd, 'consumer.ts'),
    `import { Workspace } from '@mastra/core/workspace';
import { RenderSandbox, renderSandboxProvider, type RenderNetworkPolicy } from '@mastra/render';
const networkPolicy: RenderNetworkPolicy = { type: 'allow-list', rules: [{ domain: 'example.com', protocol: 'https' }] };
const sandbox = new RenderSandbox({ create: { networkPolicy } });
void new Workspace({ sandbox }); void renderSandboxProvider;
// @ts-expect-error A restore uses either an ID or a name, not both.
new RenderSandbox({ create: { snapshotId: 'snp-one', snapshotName: 'one' } });
// @ts-expect-error Current allow-list rules support HTTPS only.
new RenderSandbox({ create: { networkPolicy: { type: 'allow-list', rules: [{ domain: 'example.com', protocol: 'http' }] } } });
`,
  );
  run(npm, ['install', '--workspaces=false', '--ignore-scripts', '--no-audit', '--no-fund'], cwd);
  run(process.execPath, ['smoke.mjs'], cwd);
  run(
    process.execPath,
    [
      '--input-type=commonjs',
      '-e',
      "const assert = require('node:assert/strict'); const { RenderSandbox } = require('@mastra/render'); assert.equal(typeof RenderSandbox, 'function');",
    ],
    cwd,
  );
  run(
    process.execPath,
    [
      'node_modules/typescript/bin/tsc',
      '--noEmit',
      '--strict',
      '--skipLibCheck',
      '--module',
      'NodeNext',
      '--target',
      'ES2022',
      'consumer.ts',
    ],
    cwd,
  );
  results.push({ core, esmImportAndLifecycle: 'PASS', commonjsImport: 'PASS', exportedTypes: 'PASS' });
  console.log(`Packed consumer ${core}: PASS`);
}
const receipt = {
  checkedAt: new Date().toISOString(),
  node: process.version,
  package: metadata.name,
  version: metadata.version,
  archive,
  sha256: createHash('sha256')
    .update(await readFile(archive))
    .digest('hex'),
  files: paths,
  consumers: results,
  result: 'PASS',
};
await writeFile(join(root, 'validation', 'package-check.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(`Package verified: ${packed.filename} (${paths.length} files)`);
