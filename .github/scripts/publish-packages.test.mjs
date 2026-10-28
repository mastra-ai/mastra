import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./publish-packages.mjs', import.meta.url));

// A small npm registry over real HTTP. `pnpm publish` PUTs `/<name>` with the
// packument; the script GETs `/<name>/<version>` to see what's already there.
// PUT responses are delayed so concurrent publishes overlap, and every PUT is
// checked against the dependencies that had finished publishing when it arrived.
async function startRegistry(t, { published = [], failPut = {}, dependencies = {} } = {}) {
  const versions = new Set(published);
  const failures = new Map(Object.entries(failPut));
  const state = { puts: [], inFlight: 0, maxInFlight: 0, publishedBeforeDependency: [], versions, failures };
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      const name = decodeURIComponent(req.url.slice(1));
      if (req.method === 'GET') {
        const [, scope, rest] = req.url.match(/^\/(@[^%]+)%2f(.+)$/) ?? [];
        const id = scope ? `${scope}/${decodeURIComponent(rest).replace('/', '@')}` : '';
        res.writeHead(versions.has(id) ? 200 : 404, { 'content-type': 'application/json' });
        res.end('{}');
        return;
      }
      const packument = JSON.parse(body);
      const version = Object.keys(packument.versions)[0];
      state.puts.push({ name, version, distTags: packument['dist-tags'] });
      for (const dep of dependencies[name] ?? []) {
        if (![...versions].some(id => id.startsWith(`${dep}@`)))
          state.publishedBeforeDependency.push(`${name} before ${dep}`);
      }
      state.inFlight++;
      state.maxInFlight = Math.max(state.maxInFlight, state.inFlight);
      setTimeout(() => {
        state.inFlight--;
        const remaining = failures.get(name);
        if (remaining) {
          if (remaining !== Infinity) failures.set(name, remaining - 1);
          res.writeHead(503, { 'content-type': 'application/json' });
          res.end('{"error":"service unavailable"}');
          return;
        }
        versions.add(`${name}@${version}`);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end('{}');
      }, 200);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  return { url: `http://127.0.0.1:${server.address().port}`, state };
}

function makeWorkspace(t, registryUrl, packages) {
  const cwd = mkdtempSync(path.join(tmpdir(), 'publish-packages-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ name: 'fixture', private: true }));
  writeFileSync(path.join(cwd, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n');
  writeFileSync(path.join(cwd, '.npmrc'), `${registryUrl.replace(/^http:/, '')}/:_authToken=test-token\n`);
  for (const pkg of packages) {
    const dir = path.join(cwd, 'packages', pkg.name.replaceAll('/', '-'));
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ version: '1.0.0', ...pkg }));
  }
  return cwd;
}

function run(cwd, registry, extraArgs = []) {
  const env = { ...process.env, PUBLISH_RETRY_DELAY_MS: '10' };
  delete env.NPM_CONFIG_PROVENANCE;
  delete env.NPM_CONFIG_USERCONFIG;
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, '--registry', registry, ...extraArgs], { cwd, env });
    let output = '';
    child.stdout.setEncoding('utf8').on('data', chunk => (output += chunk));
    child.stderr.setEncoding('utf8').on('data', chunk => (output += chunk));
    child.on('error', reject);
    child.on('close', status => resolve({ status, output }));
  });
}

// core ← memory (dependency) ← server (peer dependency); voice depends on nothing.
const releasePackages = [
  { name: '@fx/core' },
  { name: '@fx/memory', dependencies: { '@fx/core': 'workspace:*' } },
  { name: '@fx/server', peerDependencies: { '@fx/memory': 'workspace:*' } },
  { name: '@fx/voice' },
  { name: '@fx/internal', private: true },
  { name: '@fx/stable' },
];
const releaseDependencies = { '@fx/memory': ['@fx/core'], '@fx/server': ['@fx/memory'] };

test('a release publishes every new version in parallel, never before the packages it depends on', async t => {
  const registry = await startRegistry(t, { published: ['@fx/stable@1.0.0'], dependencies: releaseDependencies });
  const cwd = makeWorkspace(t, registry.url, releasePackages);

  const { status, output } = await run(cwd, registry.url, ['--tag', 'alpha', '--concurrency', '4']);

  assert.equal(status, 0, output);
  assert.deepEqual(registry.state.puts.map(put => put.name).sort(), [
    '@fx/core',
    '@fx/memory',
    '@fx/server',
    '@fx/voice',
  ]);
  assert.deepEqual(registry.state.publishedBeforeDependency, []);
  assert.ok(
    registry.state.maxInFlight >= 2,
    `expected overlapping publishes, max in flight was ${registry.state.maxInFlight}`,
  );
  for (const put of registry.state.puts) assert.deepEqual(put.distTags, { alpha: '1.0.0' });
});

test('a release that fails partway can be re-run and publishes only what is left', async t => {
  const registry = await startRegistry(t, { failPut: { '@fx/memory': Infinity }, dependencies: releaseDependencies });
  const cwd = makeWorkspace(t, registry.url, releasePackages);

  const first = await run(cwd, registry.url);

  assert.equal(first.status, 1, first.output);
  assert.match(first.output, /Failed to publish @fx\/memory@1\.0\.0 after 3 attempts/);
  assert.match(first.output, /Not published because they come after a failed package: @fx\/server/);
  assert.deepEqual([...registry.state.versions].sort(), ['@fx/core@1.0.0', '@fx/stable@1.0.0', '@fx/voice@1.0.0']);

  // npm recovers.
  registry.state.failures.clear();
  registry.state.puts.length = 0;
  const second = await run(cwd, registry.url);

  assert.equal(second.status, 0, second.output);
  assert.deepEqual(
    registry.state.puts.map(put => put.name),
    ['@fx/memory', '@fx/server'],
  );
  assert.deepEqual(registry.state.publishedBeforeDependency, []);
});

test('a temporary npm error during a publish is retried instead of failing the release', async t => {
  const registry = await startRegistry(t, { failPut: { '@fx/voice': 1 }, dependencies: releaseDependencies });
  const cwd = makeWorkspace(t, registry.url, releasePackages);

  const { status, output } = await run(cwd, registry.url);

  assert.equal(status, 0, output);
  assert.equal(registry.state.puts.filter(put => put.name === '@fx/voice').length, 2);
  assert.ok(registry.state.versions.has('@fx/voice@1.0.0'));
});

test('a re-run after everything is published does nothing', async t => {
  const published = ['@fx/core', '@fx/memory', '@fx/server', '@fx/voice', '@fx/stable'].map(name => `${name}@1.0.0`);
  const registry = await startRegistry(t, { published });
  const cwd = makeWorkspace(t, registry.url, releasePackages);

  const { status, output } = await run(cwd, registry.url);

  assert.equal(status, 0, output);
  assert.equal(registry.state.puts.length, 0);
  assert.match(output, /nothing to publish/);
});
