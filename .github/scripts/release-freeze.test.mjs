import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./release-freeze.mjs', import.meta.url));

// Shaped like GET /repos/mastra-ai/mastra/rulesets and the ruleset detail on
// 2026-11-17: "Merge protection" is the real ruleset on main; "Release merge
// freeze" is the one an admin creates from the JSON in the PR description.
const mergeProtection = {
  id: 2328146,
  name: 'Merge protection',
  target: 'branch',
  source_type: 'Repository',
  source: 'mastra-ai/mastra',
  enforcement: 'active',
};
const freezeSummary = {
  id: 9100001,
  name: 'Release merge freeze',
  target: 'branch',
  source_type: 'Repository',
  source: 'mastra-ai/mastra',
  enforcement: 'disabled',
};
function freezeDetail(enforcement = 'disabled', overrides = {}) {
  return {
    ...freezeSummary,
    enforcement,
    conditions: { ref_name: { include: ['~DEFAULT_BRANCH'], exclude: [] } },
    rules: [{ type: 'update', parameters: { update_allows_fetch_and_merge: false } }],
    ...overrides,
  };
}

// Mock GitHub API. `routes` maps "METHOD /path" to a handler returning
// { status, body, headers } or a plain body (status 200). Every request is
// recorded with its parsed JSON body.
async function startApi(t, routes) {
  const requests = [];
  const server = createServer((req, res) => {
    let raw = '';
    req.on('data', chunk => (raw += chunk));
    req.on('end', () => {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const key = `${req.method} ${url.pathname}`;
      const body = raw ? JSON.parse(raw) : undefined;
      requests.push({ key, search: url.search, body, auth: req.headers.authorization });
      const handler = routes[key];
      let reply = handler ? handler({ url, body }) : { status: 404, body: { message: 'Not Found' } };
      if (!reply || typeof reply.status !== 'number') reply = { status: 200, body: reply };
      res.writeHead(reply.status, { 'content-type': 'application/json', ...(reply.headers ?? {}) });
      res.end(JSON.stringify(reply.body ?? {}));
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  return { url: `http://127.0.0.1:${server.address().port}`, requests };
}

// The usual happy-path API: the actor is an admin, the freeze ruleset exists,
// and PUT stores the enforcement it was sent.
function standardRoutes({ role = 'admin', enforcement = 'disabled' } = {}) {
  const state = { enforcement };
  return {
    state,
    routes: {
      'GET /repos/mastra-ai/mastra/collaborators/tyler/permission': () => ({
        permission: role === 'maintain' ? 'write' : role,
        role_name: role,
        user: { login: 'tyler' },
      }),
      'GET /repos/mastra-ai/mastra/rulesets': () => [
        mergeProtection,
        { ...freezeSummary, enforcement: state.enforcement },
      ],
      'GET /repos/mastra-ai/mastra/rulesets/9100001': () => freezeDetail(state.enforcement),
      'PUT /repos/mastra-ai/mastra/rulesets/9100001': ({ body }) => {
        state.enforcement = body.enforcement;
        return freezeDetail(state.enforcement);
      },
    },
  };
}

function run(t, api, args, env = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'release-freeze-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const summary = path.join(dir, 'summary.md');
  writeFileSync(summary, '');
  const childEnv = {
    ...process.env,
    GITHUB_API_URL: api.url,
    GITHUB_REPOSITORY: 'mastra-ai/mastra',
    GITHUB_TOKEN: 'test-token',
    GITHUB_STEP_SUMMARY: summary,
    ...env,
  };
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], { env: childEnv });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', chunk => (stdout += chunk));
    child.stderr.setEncoding('utf8').on('data', chunk => (stderr += chunk));
    child.on('error', reject);
    child.on('close', status => resolve({ status, stdout, stderr, summary: readFileSync(summary, 'utf8') }));
  });
}

const puts = api => api.requests.filter(r => r.key.startsWith('PUT '));

test('freeze sets only enforcement=active on the ruleset found by name', async t => {
  const { routes } = standardRoutes();
  const api = await startApi(t, routes);
  const result = await run(t, api, ['--action', 'freeze', '--actor', 'tyler']);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(
    puts(api).map(r => [r.key, r.body]),
    [['PUT /repos/mastra-ai/mastra/rulesets/9100001', { enforcement: 'active' }]],
  );
  assert.equal(puts(api)[0].auth, 'Bearer test-token');
  assert.match(result.stdout, /Release merge freeze \(ruleset 9100001\) enforcement: active/);
  assert.match(result.stdout, /main frozen by @tyler/);
  assert.match(result.summary, /main is frozen/i);
  assert.match(result.summary, /@tyler/);
});

test('unfreeze sets enforcement=disabled', async t => {
  const { routes } = standardRoutes({ enforcement: 'active' });
  const api = await startApi(t, routes);
  const result = await run(t, api, ['--action', 'unfreeze', '--actor', 'tyler']);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(
    puts(api).map(r => r.body),
    [{ enforcement: 'disabled' }],
  );
  assert.match(result.stdout, /enforcement: disabled/);
  assert.match(result.stdout, /main unfrozen by @tyler/);
  assert.match(result.summary, /main is open/i);
});

test('a maintainer may run it', async t => {
  const { routes } = standardRoutes({ role: 'maintain' });
  const api = await startApi(t, routes);
  const result = await run(t, api, ['--action', 'freeze', '--actor', 'tyler']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(puts(api).length, 1);
});

for (const role of ['write', 'triage', 'read', 'none']) {
  test(`an actor with role "${role}" is refused before any ruleset is read`, async t => {
    const { routes } = standardRoutes({ role });
    const api = await startApi(t, routes);
    const result = await run(t, api, ['--action', 'freeze', '--actor', 'tyler']);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /@tyler .*not allowed/);
    assert.equal(puts(api).length, 0);
    assert.ok(!api.requests.some(r => r.key.includes('/rulesets')));
  });
}

test('a failed permission lookup fails closed', async t => {
  const { routes } = standardRoutes();
  routes['GET /repos/mastra-ai/mastra/collaborators/tyler/permission'] = () => ({
    status: 502,
    body: { message: 'Server Error' },
  });
  const api = await startApi(t, routes);
  const result = await run(t, api, ['--action', 'freeze', '--actor', 'tyler']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /502/);
  assert.equal(puts(api).length, 0);
});

test('fails when no ruleset has the freeze name', async t => {
  const { routes } = standardRoutes();
  routes['GET /repos/mastra-ai/mastra/rulesets'] = () => [mergeProtection];
  const api = await startApi(t, routes);
  const result = await run(t, api, ['--action', 'freeze', '--actor', 'tyler']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /No ruleset named "Release merge freeze"/);
  assert.equal(puts(api).length, 0);
});

test('fails when two rulesets share the freeze name', async t => {
  const { routes } = standardRoutes();
  routes['GET /repos/mastra-ai/mastra/rulesets'] = () => [freezeSummary, { ...freezeSummary, id: 9100002 }];
  const api = await startApi(t, routes);
  const result = await run(t, api, ['--action', 'freeze', '--actor', 'tyler']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /2 rulesets named "Release merge freeze"/);
  assert.equal(puts(api).length, 0);
});

test('finds the ruleset on a later page of the list', async t => {
  const { routes } = standardRoutes();
  routes['GET /repos/mastra-ai/mastra/rulesets'] = ({ url }) => {
    if (url.searchParams.get('page') === '2') return [freezeSummary];
    return {
      status: 200,
      body: [mergeProtection],
      headers: { link: `<${url.origin}/repos/mastra-ai/mastra/rulesets?per_page=100&page=2>; rel="next"` },
    };
  };
  const api = await startApi(t, routes);
  const result = await run(t, api, ['--action', 'freeze', '--actor', 'tyler']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(puts(api)[0].key, 'PUT /repos/mastra-ai/mastra/rulesets/9100001');
});

test('ignores an organization ruleset with the same name', async t => {
  const { routes } = standardRoutes();
  routes['GET /repos/mastra-ai/mastra/rulesets'] = () => [
    { ...freezeSummary, id: 777, source_type: 'Organization', source: 'mastra-ai' },
    freezeSummary,
  ];
  const api = await startApi(t, routes);
  const result = await run(t, api, ['--action', 'freeze', '--actor', 'tyler']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(puts(api)[0].key, 'PUT /repos/mastra-ai/mastra/rulesets/9100001');
});

for (const [label, overrides] of [
  ['has no "update" rule', { rules: [{ type: 'deletion' }] }],
  ['has another rule besides "update"', { rules: [{ type: 'update' }, { type: 'required_signatures' }] }],
  ['does not target the default branch', { conditions: { ref_name: { include: ['refs/heads/0.x'], exclude: [] } } }],
  ['targets tags', { target: 'tag' }],
]) {
  test(`refuses a ruleset that ${label}`, async t => {
    const { routes } = standardRoutes();
    routes['GET /repos/mastra-ai/mastra/rulesets/9100001'] = () => freezeDetail('disabled', overrides);
    const api = await startApi(t, routes);
    const result = await run(t, api, ['--action', 'freeze', '--actor', 'tyler']);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /is not a main-only "Restrict updates" ruleset/);
    assert.equal(puts(api).length, 0);
  });
}

test('already in the requested state: no PUT, still succeeds and reports', async t => {
  const { routes } = standardRoutes({ enforcement: 'active' });
  const api = await startApi(t, routes);
  const result = await run(t, api, ['--action', 'freeze', '--actor', 'tyler']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(puts(api).length, 0);
  assert.match(result.stdout, /already active/);
  assert.match(result.stdout, /enforcement: active/);
});

test('dry run reads everything, prints the payload, never PUTs', async t => {
  const { routes } = standardRoutes();
  const api = await startApi(t, routes);
  const result = await run(t, api, ['--action', 'freeze', '--actor', 'tyler', '--dry-run']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(puts(api).length, 0);
  assert.match(
    result.stdout,
    /DRY RUN: would PUT \/repos\/mastra-ai\/mastra\/rulesets\/9100001 \{"enforcement":"active"\}/,
  );
  assert.match(result.stdout, /enforcement: disabled/);
});

test('fails when the ruleset does not read back as requested after the PUT', async t => {
  const { routes } = standardRoutes();
  routes['PUT /repos/mastra-ai/mastra/rulesets/9100001'] = () => freezeDetail('disabled');
  const api = await startApi(t, routes);
  const result = await run(t, api, ['--action', 'freeze', '--actor', 'tyler']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /expected enforcement active, read back disabled/);
});

test('a failed PUT fails the run', async t => {
  const { routes } = standardRoutes();
  routes['PUT /repos/mastra-ai/mastra/rulesets/9100001'] = () => ({
    status: 403,
    body: { message: 'Resource not accessible by integration' },
  });
  const api = await startApi(t, routes);
  const result = await run(t, api, ['--action', 'freeze', '--actor', 'tyler']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /403/);
  assert.match(result.stderr, /administration: write/);
});

for (const args of [
  ['--actor', 'tyler'],
  ['--action', 'thaw', '--actor', 'tyler'],
  ['--action', 'freeze'],
  ['--action'],
]) {
  test(`usage error for ${JSON.stringify(args)}`, async t => {
    const { routes } = standardRoutes();
    const api = await startApi(t, routes);
    const result = await run(t, api, args);
    assert.equal(result.status, 2);
    assert.equal(api.requests.length, 0);
  });
}

test('refuses to run without a token', async t => {
  const { routes } = standardRoutes();
  const api = await startApi(t, routes);
  const result = await run(t, api, ['--action', 'freeze', '--actor', 'tyler'], { GITHUB_TOKEN: '' });
  assert.equal(result.status, 2);
  assert.equal(api.requests.length, 0);
});
