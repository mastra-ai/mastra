import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
// DANE_APP_ID stands in for the Dane app's real id, which the admin fills in.
const DANE_APP_ID = 424242;
function statusRule(checks = [{ context: 'Release freeze', integration_id: DANE_APP_ID }], strict = false) {
  return {
    type: 'required_status_checks',
    parameters: {
      strict_required_status_checks_policy: strict,
      do_not_enforce_on_create: false,
      required_status_checks: checks,
    },
  };
}
const VERSIONING_HEAD = 'a'.repeat(40);
function freezeDetail(enforcement = 'disabled', overrides = {}) {
  return {
    ...freezeSummary,
    enforcement,
    conditions: { ref_name: { include: ['~DEFAULT_BRANCH'], exclude: [] } },
    rules: [statusRule()],
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
        // The API reports maintain as write and triage as read in `permission`.
        permission: { maintain: 'write', triage: 'read' }[role] ?? role,
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
      'GET /apps/dane-ai-mastra': () => ({ id: DANE_APP_ID, slug: 'dane-ai-mastra' }),
      'GET /repos/mastra-ai/mastra/branches/changeset-release%2Fmain': () => ({
        name: 'changeset-release/main',
        commit: { sha: VERSIONING_HEAD },
      }),
      [`POST /repos/mastra-ai/mastra/statuses/${VERSIONING_HEAD}`]: ({ body }) => ({ status: 201, body }),
    },
  };
}

function run(t, api, args, env = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'release-freeze-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const summary = path.join(dir, 'summary.md');
  const output = path.join(dir, 'output.txt');
  writeFileSync(summary, '');
  writeFileSync(output, '');
  const childEnv = {
    ...process.env,
    GITHUB_API_URL: api.url,
    GITHUB_REPOSITORY: 'mastra-ai/mastra',
    GITHUB_TOKEN: 'test-token',
    GITHUB_STEP_SUMMARY: summary,
    GITHUB_OUTPUT: output,
    APP_SLUG: 'dane-ai-mastra',
    ...env,
  };
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], { env: childEnv });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', chunk => (stdout += chunk));
    child.stderr.setEncoding('utf8').on('data', chunk => (stderr += chunk));
    child.on('error', reject);
    child.on('close', status =>
      resolve({
        status,
        stdout,
        stderr,
        summary: readFileSync(summary, 'utf8'),
        output: readFileSync(output, 'utf8'),
      }),
    );
  });
}

const puts = api => api.requests.filter(r => r.key.startsWith('PUT '));
const statusPosts = api => api.requests.filter(r => r.key.startsWith('POST ') && r.key.includes('/statuses/'));

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

for (const role of ['maintain', 'write', 'release-manager']) {
  test(`a non-admin with role "${role}" may run it`, async t => {
    const { routes } = standardRoutes({ role });
    // A custom role reports its base permission.
    if (role === 'release-manager') {
      routes['GET /repos/mastra-ai/mastra/collaborators/tyler/permission'] = () => ({
        permission: 'write',
        role_name: 'release-manager',
      });
    }
    const api = await startApi(t, routes);
    const result = await run(t, api, ['--action', 'freeze', '--actor', 'tyler']);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(puts(api).length, 1);
  });
}

for (const role of ['triage', 'read', 'none']) {
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
  ['has no required-check rule', { rules: [{ type: 'update' }] }],
  ['has another rule besides the required check', { rules: [statusRule(), { type: 'update' }] }],
  ['requires a different check', { rules: [statusRule([{ context: 'Lint', integration_id: DANE_APP_ID }])] }],
  ['lets any app post the check', { rules: [statusRule([{ context: 'Release freeze' }])] }],
  [
    'pins the check to a different app',
    { rules: [statusRule([{ context: 'Release freeze', integration_id: 424243 }])] },
  ],
  ['pins the check to app id 0', { rules: [statusRule([{ context: 'Release freeze', integration_id: 0 }])] }],
  ['pins the check to app id -1', { rules: [statusRule([{ context: 'Release freeze', integration_id: -1 }])] }],
  [
    'requires a second check',
    {
      rules: [
        statusRule([
          { context: 'Release freeze', integration_id: DANE_APP_ID },
          { context: 'Lint', integration_id: DANE_APP_ID },
        ]),
      ],
    },
  ],
  ['makes PRs be up to date', { rules: [statusRule(undefined, true)] }],
  ['does not target the default branch', { conditions: { ref_name: { include: ['refs/heads/0.x'], exclude: [] } } }],
  ['targets tags', { target: 'tag' }],
  ['excludes main', { conditions: { ref_name: { include: ['~DEFAULT_BRANCH'], exclude: ['refs/heads/main'] } } }],
  ['excludes every branch', { conditions: { ref_name: { include: ['~DEFAULT_BRANCH'], exclude: ['~ALL'] } } }],
]) {
  test(`refuses a ruleset that ${label}`, async t => {
    const { routes } = standardRoutes();
    routes['GET /repos/mastra-ai/mastra/rulesets/9100001'] = () => freezeDetail('disabled', overrides);
    const api = await startApi(t, routes);
    const result = await run(t, api, ['--action', 'freeze', '--actor', 'tyler']);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /is not a main-only "Release freeze" required-check ruleset/);
    assert.equal(puts(api).length, 0);
    assert.equal(statusPosts(api).length, 0);
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

for (const action of ['freeze', 'unfreeze']) {
  test(`${action}: a PUT that succeeds but can't be read back says it wrote, not that it changed`, async t => {
    const { routes } = standardRoutes({ enforcement: action === 'freeze' ? 'disabled' : 'active' });
    const detail = routes['GET /repos/mastra-ai/mastra/rulesets/9100001'];
    let reads = 0;
    routes['GET /repos/mastra-ai/mastra/rulesets/9100001'] = arg =>
      ++reads === 1 ? detail(arg) : { status: 502, body: {} };
    const api = await startApi(t, routes);
    const result = await run(t, api, ['--action', action, '--actor', 'tyler']);
    assert.equal(result.status, 1);
    assert.equal(puts(api).length, 1);
    assert.match(result.output, /^written=true$/m);
    assert.doesNotMatch(result.output, /^changed=/m);
    assert.doesNotMatch(result.output, /^frozen=/m);
  });
}

test('freeze: a PUT refused after the versioning status was posted leaves only that status', async t => {
  const { routes } = standardRoutes();
  routes['PUT /repos/mastra-ai/mastra/rulesets/9100001'] = () => ({ status: 403, body: { message: 'nope' } });
  const api = await startApi(t, routes);
  const result = await run(t, api, ['--action', 'freeze', '--actor', 'tyler']);
  assert.equal(result.status, 1);
  assert.equal(statusPosts(api).length, 1);
  assert.doesNotMatch(result.output, /^written=/m);
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

test('freeze passes the versioning PR head before it turns the ruleset on, and says it changed', async t => {
  const { routes } = standardRoutes();
  const api = await startApi(t, routes);
  const result = await run(t, api, ['--action', 'freeze', '--actor', 'tyler']);
  assert.equal(result.status, 0, result.stderr);
  const keys = api.requests.map(r => r.key);
  const post = keys.indexOf(`POST /repos/mastra-ai/mastra/statuses/${VERSIONING_HEAD}`);
  assert.ok(post !== -1, keys.join('\n'));
  assert.ok(post < keys.indexOf('PUT /repos/mastra-ai/mastra/rulesets/9100001'), keys.join('\n'));
  assert.equal(statusPosts(api)[0].body.state, 'success');
  assert.equal(statusPosts(api)[0].body.context, 'Release freeze');
  assert.match(result.output, /^changed=true$/m);
  assert.match(result.output, /^frozen=true$/m);
});

test('freeze still freezes when there is no versioning PR branch', async t => {
  const { routes } = standardRoutes();
  routes['GET /repos/mastra-ai/mastra/branches/changeset-release%2Fmain'] = () => ({
    status: 404,
    body: { message: 'Branch not found' },
  });
  const api = await startApi(t, routes);
  const result = await run(t, api, ['--action', 'freeze', '--actor', 'tyler']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(statusPosts(api).length, 0);
  assert.deepEqual(
    puts(api).map(r => r.body),
    [{ enforcement: 'active' }],
  );
  assert.match(result.stdout, /No changeset-release\/main branch/);
});

test('freeze stops before the PUT when the versioning PR status cannot be posted', async t => {
  const { routes } = standardRoutes();
  routes[`POST /repos/mastra-ai/mastra/statuses/${VERSIONING_HEAD}`] = () => ({ status: 403, body: {} });
  const api = await startApi(t, routes);
  const result = await run(t, api, ['--action', 'freeze', '--actor', 'tyler']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /403/);
  assert.equal(puts(api).length, 0);
});

test('freeze when already frozen reposts the status and reports no change', async t => {
  const { routes } = standardRoutes({ enforcement: 'active' });
  const api = await startApi(t, routes);
  const result = await run(t, api, ['--action', 'freeze', '--actor', 'tyler']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(statusPosts(api).length, 1);
  assert.match(result.output, /^changed=false$/m);
});

test('a dry-run freeze posts no status', async t => {
  const { routes } = standardRoutes();
  const api = await startApi(t, routes);
  const result = await run(t, api, ['--action', 'freeze', '--actor', 'tyler', '--dry-run']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(statusPosts(api).length, 0);
  assert.match(result.output, /^changed=false$/m);
});

test('unfreeze reports it changed and posts no status', async t => {
  const { routes } = standardRoutes({ enforcement: 'active' });
  const api = await startApi(t, routes);
  const result = await run(t, api, ['--action', 'unfreeze', '--actor', 'tyler']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(statusPosts(api).length, 0);
  assert.match(result.output, /^changed=true$/m);
  assert.match(result.output, /^frozen=false$/m);
});

test('mark passes the current changeset-release/main head without needing an actor', async t => {
  const { routes } = standardRoutes();
  const api = await startApi(t, routes);
  const result = await run(t, api, ['--action', 'mark']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(statusPosts(api).length, 1);
  assert.deepEqual(
    { state: statusPosts(api)[0].body.state, context: statusPosts(api)[0].body.context },
    { state: 'success', context: 'Release freeze' },
  );
  assert.equal(puts(api).length, 0);
  assert.ok(!api.requests.some(r => r.key.includes('/rulesets') || r.key.includes('/collaborators')));
});

test('mark with no versioning branch does nothing and succeeds', async t => {
  const { routes } = standardRoutes();
  routes['GET /repos/mastra-ai/mastra/branches/changeset-release%2Fmain'] = () => ({ status: 404, body: {} });
  const api = await startApi(t, routes);
  const result = await run(t, api, ['--action', 'mark']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(statusPosts(api).length, 0);
});

test('mark fails when the status post fails', async t => {
  const { routes } = standardRoutes();
  routes[`POST /repos/mastra-ai/mastra/statuses/${VERSIONING_HEAD}`] = () => ({ status: 500, body: {} });
  const api = await startApi(t, routes);
  const result = await run(t, api, ['--action', 'mark']);
  assert.equal(result.status, 1);
});

for (const [enforcement, frozen] of [
  ['active', 'true'],
  ['disabled', 'false'],
  ['evaluate', 'false'],
]) {
  test(`check reports frozen=${frozen} for a ${enforcement} ruleset, read-only and without an actor`, async t => {
    const { routes } = standardRoutes({ enforcement });
    const api = await startApi(t, routes);
    const result = await run(t, api, ['--action', 'check']);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.output, new RegExp(`^frozen=${frozen}$`, 'm'));
    assert.ok(api.requests.every(r => r.key.startsWith('GET ')));
    assert.ok(!api.requests.some(r => r.key.includes('/collaborators')));
  });
}

test('check reports not frozen when no freeze ruleset exists', async t => {
  const { routes } = standardRoutes();
  routes['GET /repos/mastra-ai/mastra/rulesets'] = () => [mergeProtection];
  const api = await startApi(t, routes);
  const result = await run(t, api, ['--action', 'check']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.output, /^frozen=false$/m);
});

test('check fails, rather than guessing, when the ruleset list errors', async t => {
  const { routes } = standardRoutes();
  routes['GET /repos/mastra-ai/mastra/rulesets'] = () => ({ status: 502, body: {} });
  const api = await startApi(t, routes);
  const result = await run(t, api, ['--action', 'check']);
  assert.equal(result.status, 1);
  assert.doesNotMatch(result.output, /frozen=/);
});

for (const action of ['freeze', 'unfreeze']) {
  test(`${action} refuses without APP_SLUG, before any write`, async t => {
    const { routes } = standardRoutes({ enforcement: action === 'freeze' ? 'disabled' : 'active' });
    const api = await startApi(t, routes);
    const result = await run(t, api, ['--action', action, '--actor', 'tyler'], { APP_SLUG: '' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /APP_SLUG/);
    assert.equal(puts(api).length, 0);
    assert.equal(statusPosts(api).length, 0);
  });

  test(`${action} refuses when the token's app can't be looked up`, async t => {
    const { routes } = standardRoutes({ enforcement: action === 'freeze' ? 'disabled' : 'active' });
    routes['GET /apps/dane-ai-mastra'] = () => ({ status: 404, body: {} });
    const api = await startApi(t, routes);
    const result = await run(t, api, ['--action', action, '--actor', 'tyler']);
    assert.equal(result.status, 1);
    assert.equal(puts(api).length, 0);
    assert.equal(statusPosts(api).length, 0);
  });
}

test('the check pin is compared with the app that runs the freeze, not a fixed id', async t => {
  const { routes } = standardRoutes();
  routes['GET /apps/dane-ai-mastra'] = () => ({ id: 424243, slug: 'dane-ai-mastra' });
  const api = await startApi(t, routes);
  const result = await run(t, api, ['--action', 'freeze', '--actor', 'tyler']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /424242/);
  assert.match(result.stderr, /424243/);
  assert.equal(puts(api).length, 0);
  assert.equal(statusPosts(api).length, 0);
});

// Jobs of a workflow file, by id, as their raw text (top-level `jobs:` keys are
// indented two spaces). The lint job runs these tests without installing a YAML parser.
function workflowJobs(file) {
  const text = readFileSync(new URL(`../workflows/${file}`, import.meta.url), 'utf8');
  const body = text.slice(text.indexOf('\njobs:\n'));
  const jobs = {};
  for (const block of body.split(/\n(?=  [A-Za-z0-9_-]+:\n)/).slice(1)) {
    jobs[block.match(/^ {2}([A-Za-z0-9_-]+):/)[1]] = block;
  }
  return jobs;
}

// queue: max keeps every waiting writer: with the default queue a newly queued
// job replaces the pending one, e.g. a manual freeze would drop a waiting unfreeze.
const freezeLock =
  /\n {4}concurrency:\n {6}group: release-merge-freeze\n {6}cancel-in-progress: false\n {6}queue: max\n/;

// Every job that changes the freeze ruleset, plus the scheduled alpha push whose
// late freeze check is only sound while it holds the same lock.
const freezeWriters = [
  ['release-freeze.yml', 'freeze'],
  ['npm-publish.yml', 'after_stable'],
  ['cron-alpha-publish.yml', 'alpha-version'],
];

for (const [file, job] of freezeWriters) {
  test(`${file} ${job} holds the release-merge-freeze lock without cancelling`, () => {
    const block = workflowJobs(file)[job];
    assert.ok(block, `${job} not found in ${file}`);
    assert.match(block, freezeLock);
  });
}

test('no job in any workflow outside the locked writers can freeze or unfreeze main', () => {
  const files = readdirSync(new URL('../workflows/', import.meta.url)).filter(f => /\.ya?ml$/.test(f));
  assert.ok(files.includes('npm-publish.yml'));
  for (const file of files) {
    for (const [job, block] of Object.entries(workflowJobs(file))) {
      const calls = block.match(/release-freeze\.mjs[^\n]*/g) ?? [];
      const mutates = calls.some(call => !/--action (check|mark)\b/.test(call));
      if (mutates) {
        assert.ok(
          freezeWriters.some(([f, j]) => f === file && j === job),
          `${file} ${job} changes the freeze ruleset but is not a locked writer`,
        );
      }
    }
  }
});

test('the stable publish unfreezes only once main is confirmed back in alpha mode', () => {
  const jobs = workflowJobs('npm-publish.yml');
  // enter_prerelease works on main itself, not whatever branch the dispatch picked,
  // so an old pre.json on that branch can't make it skip restoring alpha mode on main.
  assert.match(jobs.enter_prerelease, /- name: Re-checkout with app token\n(?: {8}.*\n)*? {10}ref: main\n/);
  const unfreeze = jobs.after_stable.match(/- name: Unfreeze main\n(?: {8}.*\n)+/)[0];
  assert.match(unfreeze, /steps\.alpha\.outcome == 'success'/);
  const alpha = jobs.after_stable.match(/- name: Is main back in alpha mode\?\n(?: {8}.*\n)+/)?.[0];
  assert.ok(alpha, 'after_stable has no alpha-mode check');
  assert.match(alpha, /contents\/\.changeset\/pre\.json\?ref=main/);
});

test('stable and enter-prerelease dispatches share one release group whatever ref they run on', () => {
  const text = readFileSync(new URL('../workflows/npm-publish.yml', import.meta.url), 'utf8');
  const group = text.match(/^concurrency:\n {2}group: (.+)\n/m)?.[1];
  assert.ok(group, 'npm-publish.yml has no workflow-level concurrency group');
  // Two overlapping stable runs could reopen main while the other has left alpha mode.
  for (const type of ['stable', 'enter-prerelease']) assert.match(group, new RegExp(`'${type}'`));
  assert.match(group, /github\.ref/, 'other publish types keep their per-ref group');
  // With the default queue a newly queued run cancels the pending one, so a later
  // dispatch (or a main push) could drop a waiting stable release.
  assert.match(text, /^concurrency:\n {2}group: .+\n {2}queue: max\n/m);
});
