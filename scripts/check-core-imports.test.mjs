import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./check-core-imports.ts', import.meta.url));
const repoRoot = path.dirname(path.dirname(script));
const localCoreVersion = JSON.parse(readFileSync(path.join(repoRoot, 'packages/core/package.json'), 'utf8')).version;

function tempDir(t, prefix) {
  const dir = mkdtempSync(path.join(tmpdir(), prefix));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

// Packs a fake @mastra/core whose root entry declares `exportsNames`.
function packCore(t, version, exportsNames) {
  const dir = tempDir(t, 'core-import-core-');
  mkdirSync(path.join(dir, 'package', 'dist'), { recursive: true });
  writeFileSync(
    path.join(dir, 'package', 'package.json'),
    JSON.stringify({ name: '@mastra/core', version, exports: { '.': { types: './dist/index.d.ts' } } }),
  );
  writeFileSync(
    path.join(dir, 'package', 'dist', 'index.d.ts'),
    exportsNames.map(name => `export declare const ${name}: number;`).join('\n') + '\n',
  );
  const tarball = path.join(dir, 'core.tgz');
  const tar = spawnSync('tar', ['-czf', tarball, '-C', dir, 'package']);
  assert.equal(tar.status, 0, String(tar.stderr));
  return readFileSync(tarball);
}

// Mock npm registry serving the given @mastra/core versions; records which tarballs were downloaded.
async function startRegistry(t, versions) {
  const tarballs = new Map(Object.entries(versions).map(([version, names]) => [version, packCore(t, version, names)]));
  const downloads = [];
  const server = createServer((req, res) => {
    const base = `http://127.0.0.1:${server.address().port}`;
    if (req.url === '/@mastra%2fcore' || req.url === '/@mastra%2Fcore') {
      const packument = {
        name: '@mastra/core',
        'dist-tags': { latest: [...tarballs.keys()].at(-1) },
        versions: Object.fromEntries(
          [...tarballs].map(([version, data]) => [
            version,
            {
              name: '@mastra/core',
              version,
              dist: {
                tarball: `${base}/core/-/core-${version}.tgz`,
                integrity: `sha512-${createHash('sha512').update(data).digest('base64')}`,
                shasum: createHash('sha1').update(data).digest('hex'),
              },
            },
          ]),
        ),
      };
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(packument));
      return;
    }
    const version = req.url.match(/^\/core\/-\/core-(.+)\.tgz$/)?.[1];
    if (version && tarballs.has(version)) {
      downloads.push(version);
      res.writeHead(200, { 'content-type': 'application/octet-stream' });
      res.end(tarballs.get(version));
      return;
    }
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end('{"error":"not found"}');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return { url: `http://127.0.0.1:${server.address().port}/`, downloads };
}

// A consumer package whose src/ value-imports `imports` from @mastra/core.
function makeConsumer(t, name, coreRange, imports) {
  const root = tempDir(t, 'core-import-consumer-');
  mkdirSync(path.join(root, 'src'));
  writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({ name, peerDependencies: { '@mastra/core': coreRange } }),
  );
  writeFileSync(
    path.join(root, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: { strict: true, module: 'ESNext', target: 'ES2022', skipLibCheck: true, noEmit: true },
    }),
  );
  writeFileSync(
    path.join(root, 'src', 'index.ts'),
    `import { ${imports.join(', ')} } from '@mastra/core';\nexport const used = [${imports.join(', ')}];\n`,
  );
  return root;
}

function run(t, registryUrl, packageRoots) {
  const cache = tempDir(t, 'core-import-npm-cache-');
  const npmrc = path.join(cache, '.npmrc');
  writeFileSync(npmrc, '');
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^npm_config_/i.test(key)));
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', script, ...packageRoots], {
      cwd: repoRoot,
      env: {
        ...env,
        npm_config_registry: registryUrl,
        npm_config_cache: cache,
        npm_config_userconfig: npmrc,
        npm_config_prefer_online: 'true',
        npm_config_audit: 'false',
        npm_config_fund: 'false',
        npm_config_update_notifier: 'false',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => (stdout += chunk));
    child.stderr.on('data', chunk => (stderr += chunk));
    child.on('error', reject);
    child.on('close', status => resolve({ status, stdout, stderr, output: stdout + stderr }));
  });
}

// Floors in the 0.x line never match the local packages/core version, so the checker can't pack the workspace core.
assert.ok(!localCoreVersion.startsWith('0.'), `tests assume packages/core is not 0.x (found ${localCoreVersion})`);

const prereleaseFloor = '>=0.9.1-0 <1.0.0-0';
const stableFloor = '^0.9.1';

test('checks imports against the published floor version', async t => {
  const registry = await startRegistry(t, { '0.9.0': ['old'], '0.9.1': ['old', 'added'] });
  const consumer = makeConsumer(t, '@fixture/consumer', stableFloor, ['old', 'added']);
  const result = await run(t, registry.url, [consumer]);
  assert.equal(result.status, 0, result.output);
  assert.match(result.stdout, /✓ @fixture\/consumer @mastra\/core value imports are compatible/);
  assert.deepEqual(registry.downloads, ['0.9.1']);
});

test('falls back to the published prerelease when a -0 floor has no stable release yet', async t => {
  const registry = await startRegistry(t, { '0.9.0': ['old'], '0.9.1-alpha.0': ['old', 'added'] });
  const consumer = makeConsumer(t, '@fixture/consumer', prereleaseFloor, ['old', 'added']);
  const result = await run(t, registry.url, [consumer]);
  assert.equal(result.status, 0, result.output);
  assert.match(result.stdout, /using the lowest published version in range, 0\.9\.1-alpha\.0/);
  assert.deepEqual(registry.downloads, ['0.9.1-alpha.0']);
});

test('rejects an import the selected fallback artifact does not export', async t => {
  const registry = await startRegistry(t, { '0.9.0': ['old'], '0.9.1-alpha.0': ['old'] });
  const consumer = makeConsumer(t, '@fixture/consumer', prereleaseFloor, ['old', 'added']);
  const result = await run(t, registry.url, [consumer]);
  assert.equal(result.status, 1, result.output);
  assert.match(result.stderr, /has no exported member named 'added'|'"@mastra\/core"' has no exported member 'added'/);
  assert.match(result.stderr, /✗ @fixture\/consumer @mastra\/core value imports are not compatible/);
});

test('does not fall back to a newer version than the floor', async t => {
  const registry = await startRegistry(t, { '0.9.0': ['old'], '0.9.2': ['old', 'added'] });
  const consumer = makeConsumer(t, '@fixture/consumer', stableFloor, ['old', 'added']);
  const result = await run(t, registry.url, [consumer]);
  assert.equal(result.status, 1, result.output);
  assert.match(result.stderr, /Failed to download @mastra\/core@0\.9\.1/);
  assert.deepEqual(registry.downloads, []);
});

// Both consumers share the 0.9.1 pack version but only the -0 range admits the prerelease artifact,
// so one consumer's fallback must not be reused for the other, whichever is checked first.
for (const order of [
  ['prerelease', 'stable'],
  ['stable', 'prerelease'],
]) {
  test(`checks each range on its own artifact when consumers share a floor (${order.join(' first, then ')})`, async t => {
    const registry = await startRegistry(t, { '0.9.0': ['old'], '0.9.1-alpha.0': ['old', 'added'] });
    const consumers = {
      prerelease: makeConsumer(t, '@fixture/prerelease-floor', prereleaseFloor, ['old', 'added']),
      stable: makeConsumer(t, '@fixture/stable-floor', stableFloor, ['old', 'added']),
    };
    const result = await run(
      t,
      registry.url,
      order.map(kind => consumers[kind]),
    );
    assert.equal(result.status, 1, result.output);
    assert.match(result.stdout, /✓ @fixture\/prerelease-floor @mastra\/core value imports are compatible/);
    assert.match(result.stderr, /✗ Failed to check @fixture\/stable-floor\n.*Failed to download @mastra\/core@0\.9\.1/);
    assert.doesNotMatch(result.stdout, /✓ @fixture\/stable-floor/);
  });
}
