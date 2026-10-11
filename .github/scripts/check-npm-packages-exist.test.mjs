import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./check-npm-packages-exist.mjs', import.meta.url));

// Mock npm registry: routes map URL path (`/@scope%2fname`) to a status code,
// or to an array of statuses consumed one request at a time (last one sticks).
async function startRegistry(t, routes) {
  const remaining = new Map(
    Object.entries(routes).map(([key, value]) => [key, Array.isArray(value) ? [...value] : [value]]),
  );
  const server = createServer((req, res) => {
    const statuses = remaining.get(req.url);
    const status = statuses ? (statuses.length > 1 ? statuses.shift() : statuses[0]) : 404;
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end('{}');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  return `http://127.0.0.1:${server.address().port}`;
}

function makeWorkspace(t, packages) {
  const cwd = mkdtempSync(path.join(tmpdir(), 'check-npm-packages-exist-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ name: 'fixture', private: true }));
  writeFileSync(path.join(cwd, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n');
  for (const { name, private: isPrivate } of packages) {
    const dir = path.join(cwd, 'packages', name.replaceAll('/', '-'));
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({ name, version: '1.0.0', ...(isPrivate ? { private: true } : {}) }),
    );
  }
  return cwd;
}

// Async spawn: the mock registry lives in this process, so a synchronous
// spawn would block the event loop and deadlock every registry request.
function run(t, cwd, registry, extraArgs = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, '--registry', registry, ...extraArgs], { cwd });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', chunk => (stdout += chunk));
    child.stderr.setEncoding('utf8').on('data', chunk => (stderr += chunk));
    child.on('error', reject);
    child.on('close', status => resolve({ status, stdout, stderr }));
  });
}

const pkgs = [{ name: '@mastra/core' }, { name: '@mastra/sprites' }, { name: '@internal/playground', private: true }];

test('passes when every non-private package exists on npm', async t => {
  const cwd = makeWorkspace(t, pkgs);
  const registry = await startRegistry(t, {
    '/@mastra%2fcore': 200,
    '/@mastra%2fsprites': 200,
    // @internal/playground is private: the registry is never consulted for it.
  });
  const result = await run(t, cwd, registry);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /All 2 publishable package\(s\) exist on npm/);
});

test('fails with recovery instructions when a non-private package is missing', async t => {
  const cwd = makeWorkspace(t, pkgs);
  const registry = await startRegistry(t, { '/@mastra%2fcore': 200, '/@mastra%2fsprites': 404 });
  const result = await run(t, cwd, registry);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /@mastra\/sprites .* has never been published to npm/);
  assert.match(
    result.stderr,
    /npm trust github @mastra\/sprites --file npm-publish\.yml --repo mastra-ai\/mastra --allow-publish/,
  );
  assert.match(result.stderr, /1 package\(s\) have never been published/);
  assert.doesNotMatch(result.stderr, /@mastra\/core .*never been published/);
});

test('private packages are not checked', async t => {
  const cwd = makeWorkspace(t, [{ name: '@internal/playground', private: true }]);
  const registry = await startRegistry(t, {});
  const result = await run(t, cwd, registry);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /No publishable packages to check/);
});

test('--since only checks packages whose package.json changed vs the ref', async t => {
  const cwd = makeWorkspace(t, pkgs);
  const git = args => spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(git(['init', '-b', 'main']).status, 0);
  assert.equal(git(['add', '-A']).status, 0);
  assert.equal(git(['-c', 'user.email=test@example.com', '-c', 'user.name=test', 'commit', '-m', 'base']).status, 0);

  // New package added after the base commit: the only one that should be checked.
  const dir = path.join(cwd, 'packages', 'mastra-newpkg');
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: '@mastra/newpkg', version: '1.0.0' }));
  // A private→public promotion is a manifest edit, not a new path.
  writeFileSync(
    path.join(cwd, 'packages', '@internal-playground', 'package.json'),
    JSON.stringify({ name: '@internal/playground', version: '1.0.0' }),
  );
  assert.equal(git(['add', '-A']).status, 0);
  assert.equal(
    git(['-c', 'user.email=test@example.com', '-c', 'user.name=test', 'commit', '-m', 'add packages']).status,
    0,
  );

  // @mastra/sprites 404s but its package.json did not change: not checked.
  const registry = await startRegistry(t, {
    '/@mastra%2fnewpkg': 200,
    '/@internal%2fplayground': 404,
    '/@mastra%2fsprites': 404,
  });
  const result = await run(t, cwd, registry, ['--since', 'HEAD~1']);
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /@internal\/playground .* has never been published to npm/);
  assert.doesNotMatch(result.stderr, /@mastra\/sprites .*never been published/);
  assert.doesNotMatch(result.stderr, /@mastra\/newpkg .*never been published/);
});

test('recovers when the registry errors transiently', async t => {
  const cwd = makeWorkspace(t, [{ name: '@mastra/core' }]);
  const registry = await startRegistry(t, { '/@mastra%2fcore': [500, 500, 200] });
  const result = await run(t, cwd, registry);
  assert.equal(result.status, 0, result.stderr);
});

test('exits 2 when the registry cannot be verified', async t => {
  const cwd = makeWorkspace(t, [{ name: '@mastra/core' }]);
  const registry = await startRegistry(t, { '/@mastra%2fcore': 500 });
  const result = await run(t, cwd, registry);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Could not verify 1 package\(s\)/);
});

test('--retry-404 waits out registry propagation for a just-published package', async t => {
  const cwd = makeWorkspace(t, [{ name: '@mastra/sprites' }]);
  const registry = await startRegistry(t, { '/@mastra%2fsprites': [404, 404, 200] });
  const result = await run(t, cwd, registry, ['--retry-404', '10000']);
  assert.equal(result.status, 0, result.stderr);
});

test('--retry-404 still fails a package that never appears', async t => {
  const cwd = makeWorkspace(t, [{ name: '@mastra/sprites' }]);
  const registry = await startRegistry(t, { '/@mastra%2fsprites': 404 });
  const result = await run(t, cwd, registry, ['--retry-404', '1000']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /@mastra\/sprites .* has never been published to npm/);
});
