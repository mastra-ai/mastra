import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
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
//
// `tlogConflict` answers a package's next N PUTs with the 409 npm's provenance
// signing gets from the sigstore transparency log. With `uploadedDespiteConflict`
// the version still lands, but GETs only see it `lagMs` later, like npm's CDN.
async function startRegistry(
  t,
  {
    published = [],
    failPut = {},
    hangPut = {},
    dependencies = {},
    tlogConflict = {},
    uploadedDespiteConflict = false,
    lagMs = 0,
  } = {},
) {
  const versions = new Set(published);
  const visibleAt = new Map();
  const conflicts = new Map(Object.entries(tlogConflict));
  const failures = new Map(Object.entries(failPut));
  const hangs = new Map(Object.entries(hangPut));
  const state = { puts: [], inFlight: 0, maxInFlight: 0, publishedBeforeDependency: [], versions, failures };
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      const name = decodeURIComponent(req.url.slice(1));
      if (req.method === 'GET') {
        const [, scope, rest] = req.url.match(/^\/(@[^%]+)%2f(.+)$/) ?? [];
        const id = scope ? `${scope}/${decodeURIComponent(rest).replace('/', '@')}` : '';
        const visible = versions.has(id) && Date.now() >= (visibleAt.get(id) ?? 0);
        res.writeHead(visible ? 200 : 404, { 'content-type': 'application/json' });
        res.end('{}');
        return;
      }
      const packument = JSON.parse(body);
      const version = Object.keys(packument.versions)[0];
      state.puts.push({ name, version, distTags: packument['dist-tags'] });
      if (hangs.get(name)) {
        // Never answer, like an upload that stalls.
        hangs.set(name, hangs.get(name) - 1);
        return;
      }
      for (const dep of dependencies[name] ?? []) {
        if (![...versions].some(id => id.startsWith(`${dep}@`)))
          state.publishedBeforeDependency.push(`${name} before ${dep}`);
      }
      if (versions.has(`${name}@${version}`)) {
        res.writeHead(403, { 'content-type': 'application/json' });
        res.end('{"error":"You cannot publish over the previously published versions"}');
        return;
      }
      if (conflicts.get(name)) {
        conflicts.set(name, conflicts.get(name) - 1);
        if (uploadedDespiteConflict) {
          versions.add(`${name}@${version}`);
          visibleAt.set(`${name}@${version}`, Date.now() + lagMs);
        }
        res.writeHead(409, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({
            error:
              '[TLOG_CREATE_ENTRY_ERROR] error creating tlog entry - (409) an equivalent entry already exists in the transparency log',
          }),
        );
        return;
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
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  return { url: `http://127.0.0.1:${server.address().port}`, state };
}

function makeWorkspace(t, registryUrl, packages) {
  const cwd = mkdtempSync(path.join(tmpdir(), 'publish-packages-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ name: 'fixture', private: true }));
  // The script does its own retries; pnpm's built-in backoff would make the
  // failure tests take minutes.
  writeFileSync(path.join(cwd, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\nfetchRetries: 0\n');
  writeFileSync(path.join(cwd, '.npmrc'), `${registryUrl.replace(/^http:/, '')}/:_authToken=test-token\n`);
  for (const pkg of packages) {
    const dir = path.join(cwd, 'packages', pkg.name.replaceAll('/', '-'));
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ version: '1.0.0', ...pkg }));
  }
  // A release publishes from an installed workspace; pnpm 11 can't resolve
  // `workspace:` versions without it. Only workspace links, so no network.
  execFileSync('pnpm', ['install', '--offline', '--ignore-scripts'], { cwd, stdio: 'pipe' });
  return cwd;
}

function run(cwd, registry, extraArgs = [], extraEnv = {}) {
  const env = { ...process.env, PUBLISH_RETRY_DELAY_MS: '10', ...extraEnv };
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
  assert.match(first.output, /Not published because a dependency failed: @fx\/server@1\.0\.0 \(needs @fx\/memory\)/);
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

test('a publish that hangs is killed and retried instead of stalling the release', { timeout: 30_000 }, async t => {
  const registry = await startRegistry(t, { hangPut: { '@fx/voice': 1 }, dependencies: releaseDependencies });
  const cwd = makeWorkspace(t, registry.url, releasePackages);

  const { status, output } = await run(cwd, registry.url, [], { PUBLISH_TIMEOUT_MS: '3000' });

  assert.equal(status, 0, output);
  assert.match(output, /Timed out after 3s; killed/);
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

test('a transparency-log 409 for a version that did reach npm counts as published once npm shows it', async t => {
  const registry = await startRegistry(t, {
    tlogConflict: { '@fx/voice': 1 },
    uploadedDespiteConflict: true,
    lagMs: 3000,
    dependencies: releaseDependencies,
  });
  const cwd = makeWorkspace(t, registry.url, releasePackages);

  const { status, output } = await run(cwd, registry.url, [], { PUBLISH_REGISTRY_LAG_MS: '6000' });

  assert.equal(status, 0, output);
  assert.match(output, /Published @fx\/voice@1\.0\.0 .*reported a failure but is on the registry/);
  assert.equal(registry.state.puts.filter(put => put.name === '@fx/voice').length, 1);
});

test('a transparency-log 409 for a version npm does not have is retried with a longer backoff', async t => {
  const registry = await startRegistry(t, { tlogConflict: { '@fx/voice': 4 }, dependencies: releaseDependencies });
  const cwd = makeWorkspace(t, registry.url, releasePackages);

  const { status, output } = await run(cwd, registry.url, [], { PUBLISH_REGISTRY_LAG_MS: '0' });

  assert.equal(status, 0, output);
  assert.equal(registry.state.puts.filter(put => put.name === '@fx/voice').length, 5);
  assert.ok(registry.state.versions.has('@fx/voice@1.0.0'));
  // RETRY_DELAY_MS is 10 here: an ordinary failure waits 10, 20; a signing failure 20, 40, 80, 160.
  assert.match(output, /Retrying @fx\/voice@1\.0\.0 \(attempt 1 of 6 failed, provenance signing; next in 0\.02s\)/);
  assert.match(output, /attempt 4 of 6 failed, provenance signing; next in 0\.16s/);
});

test('ordinary failures after a signing failure keep the signing backoff and attempt budget', async t => {
  const registry = await startRegistry(t, {
    tlogConflict: { '@fx/voice': 1 },
    failPut: { '@fx/voice': 4 },
    dependencies: releaseDependencies,
  });
  const cwd = makeWorkspace(t, registry.url, releasePackages);

  const { status, output } = await run(cwd, registry.url, [], { PUBLISH_REGISTRY_LAG_MS: '0' });

  assert.equal(status, 0, output);
  assert.equal(registry.state.puts.filter(put => put.name === '@fx/voice').length, 6);
  assert.match(output, /attempt 3 of 6 failed; next in 0\.08s/);
  assert.match(output, /attempt 5 of 6 failed; next in 0\.2s/);
  assert.doesNotMatch(output, /NaN/);
});

test('a package that fails does not stop packages that do not depend on it', async t => {
  // core ← memory ← server, and core ← tools ← cli: cli is a level after memory but doesn't need it.
  const packages = [
    { name: '@fx/core' },
    { name: '@fx/memory', dependencies: { '@fx/core': 'workspace:*' } },
    { name: '@fx/server', peerDependencies: { '@fx/memory': 'workspace:*' } },
    { name: '@fx/tools', dependencies: { '@fx/core': 'workspace:*' } },
    { name: '@fx/cli', dependencies: { '@fx/tools': 'workspace:*' } },
  ];
  const registry = await startRegistry(t, {
    failPut: { '@fx/memory': Infinity },
    dependencies: { ...releaseDependencies, '@fx/tools': ['@fx/core'], '@fx/cli': ['@fx/tools'] },
  });
  const cwd = makeWorkspace(t, registry.url, packages);

  const { status, output } = await run(cwd, registry.url);

  assert.equal(status, 1, output);
  assert.deepEqual([...registry.state.versions].sort(), ['@fx/cli@1.0.0', '@fx/core@1.0.0', '@fx/tools@1.0.0']);
  assert.deepEqual(registry.state.publishedBeforeDependency, []);
  assert.match(output, /Failed: @fx\/memory@1\.0\.0/);
  assert.match(output, /Not published because a dependency failed: @fx\/server@1\.0\.0 \(needs @fx\/memory\)/);
  assert.match(output, /Published 3 of 5 package\(s\)/);
});

test('a filtered release publishes only the selected packages and the packages they depend on', async t => {
  const { url, state } = await startRegistry(t, { dependencies: releaseDependencies });
  const cwd = makeWorkspace(t, url, releasePackages);

  const { status, output } = await run(cwd, url, ['--tag', 'snapshot-ui', '--pnpm-filter-prod', '@fx/memory...']);

  assert.equal(status, 0, output);
  assert.deepEqual(state.puts.map(put => put.name).sort(), ['@fx/core', '@fx/memory']);
  assert.deepEqual(state.publishedBeforeDependency, []);
  assert.ok(state.puts.every(put => put.distTags['snapshot-ui'] === '1.0.0'));
});

test('a dry run packs every new version and uploads nothing', async t => {
  const { url, state } = await startRegistry(t, { published: ['@fx/stable@1.0.0'] });
  const cwd = makeWorkspace(t, url, releasePackages);

  const { status, output } = await run(cwd, url, ['--dry-run']);

  assert.equal(status, 0, output);
  assert.deepEqual(state.puts, []);
  for (const name of ['@fx/core', '@fx/memory', '@fx/server', '@fx/voice']) {
    assert.match(output, new RegExp(`${name}@1\\.0\\.0`));
  }
  assert.doesNotMatch(output, /@fx\/stable@1\.0\.0/);
});
