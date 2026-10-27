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
// `requestTimes`, if given, collects the arrival time of every request.
async function startRegistry(t, routes, requestTimes = []) {
  const remaining = new Map(
    Object.entries(routes).map(([key, value]) => [key, Array.isArray(value) ? [...value] : [value]]),
  );
  const server = createServer((req, res) => {
    requestTimes.push(Date.now());
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
function run(t, cwd, registry, extraArgs = [], env = {}) {
  const childEnv = { ...process.env, ...env };
  // Never let a real GitHub Actions OIDC environment leak into the tests.
  if (!('ACTIONS_ID_TOKEN_REQUEST_URL' in env)) {
    delete childEnv.ACTIONS_ID_TOKEN_REQUEST_URL;
    delete childEnv.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  }
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, '--registry', registry, ...extraArgs], { cwd, env: childEnv });
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
  assert.match(result.stderr, /node scripts\/npm-placeholder-publish\.mjs @mastra\/sprites/);
  assert.match(result.stderr, /1 package\(s\) have never been published/);
  assert.doesNotMatch(result.stderr, /@mastra\/core .*never been published/);
});

test('a flag with no value is a usage error, not a crash', async t => {
  const cwd = makeWorkspace(t, pkgs);
  const registry = await startRegistry(t, {});
  const result = await run(t, cwd, registry, ['--since']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Missing value for --since/);
  assert.doesNotMatch(result.stderr, /TypeError/);
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

// Mock of both sides of the publish-time OIDC exchange: GitHub's id-token
// endpoint and npm's packument + token-exchange endpoints. `exchange` maps a
// package path (`@scope%2fname`) to a status or a list of statuses (last one
// sticks); 200 answers with a fake npm token that must never be printed.
const ID_TOKEN = 'header.github-id-token-must-not-leak.sig';
const NPM_TOKEN = 'npm_exchanged-token-must-not-leak';
const REQUEST_TOKEN = 'actions-request-token-must-not-leak';

async function startOidc(t, { exchange = {}, idTokenStatus = 200 } = {}) {
  const requests = [];
  const remaining = new Map(Object.entries(exchange).map(([key, value]) => [key, [value].flat()]));
  const server = createServer((req, res) => {
    requests.push({ method: req.method, url: req.url, authorization: req.headers.authorization, at: Date.now() });
    const reply = (status, body) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/_apis/idtoken') {
      const ok = req.headers.authorization === `Bearer ${REQUEST_TOKEN}` && idTokenStatus === 200;
      return ok ? reply(200, { value: ID_TOKEN }) : reply(idTokenStatus === 200 ? 401 : idTokenStatus, {});
    }
    const exchangeMatch = url.pathname.match(/^\/-\/npm\/v1\/oidc\/token\/exchange\/package\/(.+)$/);
    if (exchangeMatch && req.method === 'POST') {
      const statuses = remaining.get(exchangeMatch[1]);
      const status = statuses ? (statuses.length > 1 ? statuses.shift() : statuses[0]) : 404;
      if (req.headers.authorization !== `Bearer ${ID_TOKEN}`) return reply(401, { message: 'bad id token' });
      if (status === 200) return reply(200, { token: NPM_TOKEN });
      return reply(status, { message: 'OIDC token exchange error - package not found' });
    }
    // Packuments: every package exists, published by trusted publishing.
    return reply(200, { versions: { '1.0.0': { _npmUser: { trustedPublisher: { id: 'github' } } } } });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const url = `http://127.0.0.1:${server.address().port}`;
  return {
    url,
    requests,
    env: {
      ACTIONS_ID_TOKEN_REQUEST_URL: `${url}/_apis/idtoken?api-version=2.0`,
      ACTIONS_ID_TOKEN_REQUEST_TOKEN: REQUEST_TOKEN,
    },
  };
}

const assertNoTokens = result => {
  for (const token of [ID_TOKEN, NPM_TOKEN, REQUEST_TOKEN]) {
    assert.ok(!result.stdout.includes(token) && !result.stderr.includes(token), `${token} was printed`);
  }
};

test('--oidc passes when npm grants the token exchange for every package (trust present)', async t => {
  const cwd = makeWorkspace(t, pkgs);
  const oidc = await startOidc(t, { exchange: { '@mastra%2fcore': 200, '@mastra%2fsprites': 200 } });
  const result = await run(t, cwd, oidc.url, ['--oidc'], oidc.env);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /npm granted this job a trusted-publishing token for all 2 package\(s\)/);
  assertNoTokens(result);

  // Same request pnpm makes at publish time: GitHub token for the registry
  // audience, then a POST with it as bearer to the exchange endpoint.
  const idTokenRequests = oidc.requests.filter(request => request.url.startsWith('/_apis/idtoken'));
  assert.equal(idTokenRequests.length, 2);
  assert.equal(new URL(idTokenRequests[0].url, oidc.url).searchParams.get('audience'), 'npm:127.0.0.1');
  const exchanges = oidc.requests.filter(request => request.url.startsWith('/-/npm/v1/oidc/token/exchange/'));
  assert.deepEqual(exchanges.map(request => `${request.method} ${request.url}`).sort(), [
    'POST /-/npm/v1/oidc/token/exchange/package/@mastra%2fcore',
    'POST /-/npm/v1/oidc/token/exchange/package/@mastra%2fsprites',
  ]);
  assert.ok(exchanges.every(request => request.authorization === `Bearer ${ID_TOKEN}`));
  // Nothing is published with the exchanged token.
  assert.ok(oidc.requests.every(request => request.method !== 'PUT'));
});

test('--oidc fails, naming the package, when npm refuses the exchange (no trusted publisher)', async t => {
  const cwd = makeWorkspace(t, pkgs);
  const oidc = await startOidc(t, { exchange: { '@mastra%2fcore': 200, '@mastra%2fsprites': 404 } });
  const result = await run(t, cwd, oidc.url, ['--oidc'], oidc.env);
  assert.equal(result.status, 1, result.stderr);
  assert.match(
    result.stderr,
    /npm refused trusted publishing for @mastra\/sprites \(HTTP 404: OIDC token exchange error/,
  );
  assert.match(result.stderr, /node scripts\/npm-placeholder-publish\.mjs @mastra\/sprites/);
  assert.match(result.stderr, /trust github @mastra\/sprites --file npm-publish\.yml --repo mastra-ai\/mastra/);
  assert.match(result.stderr, /1 package\(s\) cannot publish through npm trusted publishing: @mastra\/sprites$/m);
  assert.doesNotMatch(result.stderr, /refused trusted publishing for @mastra\/core/);
  assert.doesNotMatch(result.stderr, /Every package was refused/);
  assertNoTokens(result);
});

test('--oidc flags the job, not just the packages, when every exchange is refused', async t => {
  const cwd = makeWorkspace(t, pkgs);
  const oidc = await startOidc(t, { exchange: { '@mastra%2fcore': 401, '@mastra%2fsprites': 401 } });
  const result = await run(t, cwd, oidc.url, ['--oidc'], oidc.env);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Every package was refused/);
});

test('--oidc exits 2, not "no trust", when the exchange endpoint is unreachable', async t => {
  const cwd = makeWorkspace(t, [{ name: '@mastra/core' }]);
  const oidc = await startOidc(t, { exchange: { '@mastra%2fcore': 503 } });
  const result = await run(t, cwd, oidc.url, ['--oidc'], oidc.env);
  assert.equal(result.status, 2, result.stderr);
  assert.match(
    result.stderr,
    /Could not verify 1 package\(s\) for trusted publishing: @mastra\/core \(npm token exchange endpoint errors\)/,
  );
  assert.doesNotMatch(result.stderr, /refused/);
});

test('--oidc recovers when the exchange endpoint errors transiently', async t => {
  const cwd = makeWorkspace(t, [{ name: '@mastra/core' }]);
  const oidc = await startOidc(t, { exchange: { '@mastra%2fcore': [503, 429, 200] } });
  const result = await run(t, cwd, oidc.url, ['--oidc'], oidc.env);
  assert.equal(result.status, 0, result.stderr);
});

test('--oidc exits 2 when GitHub will not issue an OIDC token', async t => {
  const cwd = makeWorkspace(t, [{ name: '@mastra/core' }]);
  const oidc = await startOidc(t, { exchange: { '@mastra%2fcore': 200 }, idTokenStatus: 500 });
  const result = await run(t, cwd, oidc.url, ['--oidc'], oidc.env);
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, /@mastra\/core \(GitHub OIDC token endpoint errors\)/);
  assert.ok(!oidc.requests.some(request => request.url.startsWith('/-/npm/v1/oidc/')));
});

test('--oidc exits 2 without id-token: write', async t => {
  const cwd = makeWorkspace(t, [{ name: '@mastra/core' }]);
  const oidc = await startOidc(t);
  const result = await run(t, cwd, oidc.url, ['--oidc']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /id-token: write/);
  assert.deepEqual(oidc.requests, []);
});

test('--oidc --retry-404 waits out a trusted publisher configured minutes ago', async t => {
  const cwd = makeWorkspace(t, [{ name: '@mastra/sprites' }]);
  const oidc = await startOidc(t, { exchange: { '@mastra%2fsprites': [404, 404, 200] } });
  const result = await run(t, cwd, oidc.url, ['--oidc', '--retry-404', '10000'], oidc.env);
  assert.equal(result.status, 0, result.stderr);
});

test('without --oidc, a package with no trusted-publishing history only warns', async t => {
  const cwd = makeWorkspace(t, pkgs);
  // The default mock packument is `{}`: no version came from trusted publishing.
  const registry = await startRegistry(t, { '/@mastra%2fcore': 200, '/@mastra%2fsprites': 200 });
  const result = await run(t, cwd, registry);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^::warning title=No trusted-publishing history::@mastra\/sprites exists on npm/m);
  assert.match(result.stdout, /^::warning title=No trusted-publishing history::@mastra\/core exists on npm/m);
});

test('without --oidc, a package published by trusted publishing does not warn', async t => {
  const cwd = makeWorkspace(t, [{ name: '@mastra/core' }]);
  const oidc = await startOidc(t);
  const result = await run(t, cwd, oidc.url);
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /::warning/);
  assert.ok(!oidc.requests.some(request => request.url.includes('oidc') || request.url.includes('idtoken')));
});

// Timing: the --retry-404 window is shared, so a failing run takes about one
// window however many packages fail. Before, each package polled for the full
// window, CONCURRENCY at a time (163 packages: ~105 minutes on a 5-minute window).
// Measured from the first to the last registry request, which is what the
// deadline governs: process start-up and `pnpm m ls` discovery can take 10s+ on
// a loaded machine and are not under test here.
const registryActivity = times => Math.max(...times) - Math.min(...times);
const manyPackages = count => Array.from({ length: count }, (_, i) => ({ name: `@mastra/pkg-${i}` }));

test('--oidc fails at once when every package is refused, without waiting out --retry-404', async t => {
  const packages = manyPackages(24);
  const cwd = makeWorkspace(t, packages);
  const exchange = Object.fromEntries(packages.map(({ name }) => [name.replace('/', '%2f'), 401]));
  const oidc = await startOidc(t, { exchange });
  const result = await run(t, cwd, oidc.url, ['--oidc', '--retry-404', '60000'], oidc.env);
  const elapsed = registryActivity(oidc.requests.map(request => request.at));
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /24 package\(s\) cannot publish through npm trusted publishing/);
  assert.match(result.stderr, /Every package was refused/);
  assert.ok(elapsed < 10_000, `took ${elapsed}ms with a 60s retry window`);
  // One exchange per package: no polling.
  assert.equal(oidc.requests.filter(request => request.method === 'POST').length, 24);
});

test('--oidc re-checks only refused packages, against one shared deadline', async t => {
  const packages = manyPackages(32);
  const cwd = makeWorkspace(t, packages);
  // 8 trusted, 24 refused for good: three batches of 8 under per-package windows.
  const exchange = Object.fromEntries(packages.map(({ name }, i) => [name.replace('/', '%2f'), i < 8 ? 200 : 404]));
  const oidc = await startOidc(t, { exchange });
  const result = await run(t, cwd, oidc.url, ['--oidc', '--retry-404', '3000'], oidc.env);
  const elapsed = registryActivity(oidc.requests.map(request => request.at));
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /24 package\(s\) cannot publish through npm trusted publishing/);
  assert.doesNotMatch(result.stderr, /Every package was refused/);
  // Per-package windows took one window per batch of 8 refused packages (~9s); shared, about one.
  assert.ok(elapsed < 6000, `took ${elapsed}ms with a 3s retry window`);
  const posts = oidc.requests.filter(request => request.method === 'POST').map(request => request.url);
  for (let i = 0; i < 8; i++) {
    assert.equal(posts.filter(url => url.endsWith(`/@mastra%2fpkg-${i}`)).length, 1, `trusted pkg-${i} re-checked`);
  }
  assert.ok(posts.filter(url => url.endsWith('/@mastra%2fpkg-23')).length > 1, 'refused package was not re-checked');
});

test('--retry-404 shares one deadline across missing packages too', async t => {
  const packages = manyPackages(24);
  const cwd = makeWorkspace(t, packages);
  const requestTimes = [];
  const registry = await startRegistry(t, {}, requestTimes);
  const result = await run(t, cwd, registry, ['--retry-404', '3000']);
  const elapsed = registryActivity(requestTimes);
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /24 package\(s\) have never been published/);
  // Per-package windows: three batches of 8 (~9s); shared: about one window.
  assert.ok(elapsed < 6000, `took ${elapsed}ms with a 3s retry window`);
});
