import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./release-guards.mjs', import.meta.url));
const REPO = 'mastra-ai/mastra';

// One HTTP server standing in for both the GitHub REST API (under /repos/) and
// the npm registry: version GETs, dist-tag reads, and the dist-tag PUT that
// `npm dist-tag add` sends.
async function startServer(
  t,
  { published = [], latest = {}, statuses = [], checkRuns = [], checkRunsBySha = {}, publishRuns = {} } = {},
) {
  const versions = new Set(published);
  const state = { distTagPuts: [], latest: { ...latest } };
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      const url = new URL(req.url, 'http://x');
      const json = (status, value) => {
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(value));
      };
      const page = Number(url.searchParams.get('page') ?? 1);
      const paged = items => (page === 1 ? items : []);
      let match;
      if ((match = url.pathname.match(`^/repos/${REPO}/commits/([0-9a-f]+)/status$`))) {
        return json(200, { statuses });
      }
      if ((match = url.pathname.match(`^/repos/${REPO}/commits/([0-9a-f]+)/check-runs$`))) {
        return json(200, { check_runs: paged(checkRunsBySha[match[1]] ?? checkRuns) });
      }
      if (url.pathname === `/repos/${REPO}/actions/workflows/npm-publish.yml/runs`) {
        return json(200, { workflow_runs: paged(publishRuns[url.searchParams.get('head_sha')] ?? []) });
      }
      if ((match = url.pathname.match(/^\/-\/package\/(.+)\/dist-tags(?:\/(.+))?$/))) {
        const name = decodeURIComponent(match[1]);
        if (req.method === 'PUT') {
          const version = JSON.parse(body);
          state.distTagPuts.push(`${name}@${version}`);
          state.latest[name] = version;
          return json(200, { ok: true });
        }
        return state.latest[name] ? json(200, { latest: state.latest[name] }) : json(404, {});
      }
      const id = decodeURIComponent(url.pathname.slice(1)).replace(/\/([^/]+)$/, '@$1');
      return versions.has(id) ? json(200, {}) : json(404, { error: 'Not found' });
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  return { url: `http://127.0.0.1:${server.address().port}`, state, versions };
}

const gitIn =
  cwd =>
  (...args) =>
    execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'test',
        GIT_AUTHOR_EMAIL: 'test@example.com',
        GIT_COMMITTER_NAME: 'test',
        GIT_COMMITTER_EMAIL: 'test@example.com',
        GIT_CONFIG_NOSYSTEM: '1',
      },
    }).trim();

const pkg = (name, version, extra = {}) => JSON.stringify({ name, version, ...extra }, null, 2) + '\n';

// A release branch at its alpha commit: pnpm workspace with two public
// packages and a private one, in prerelease mode, pushed to a bare origin.
function makeRepo(t, registryUrl) {
  const root = mkdtempSync(path.join(tmpdir(), 'release-guards-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const origin = path.join(root, 'origin.git');
  const cwd = path.join(root, 'work');
  execFileSync('git', ['init', '--bare', '-b', 'main', origin]);
  mkdirSync(cwd);
  const git = gitIn(cwd);
  git('init', '-b', 'main');
  git('remote', 'add', 'origin', origin);
  const write = (file, content) => {
    mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true });
    writeFileSync(path.join(cwd, file), content);
  };
  write('package.json', pkg('fixture', '0.0.0', { private: true }));
  write('pnpm-workspace.yaml', 'packages:\n  - packages/*\n');
  write('.npmrc', `${registryUrl.replace(/^http:/, '')}/:_authToken=test-token\n`);
  write('packages/a/package.json', pkg('@fx/a', '1.0.0'));
  write('packages/a/index.js', 'export const a = 1;\n');
  write('packages/b/package.json', pkg('@fx/b', '2.0.0'));
  write('packages/internal/package.json', pkg('@fx/internal', '0.0.1', { private: true }));
  git('add', '-A');
  git('commit', '-m', 'feat: a');
  // The alpha commit: versions, changelogs and changesets only, on top of the code.
  write('packages/a/package.json', pkg('@fx/a', '1.1.0-alpha.0'));
  write('packages/b/package.json', pkg('@fx/b', '2.0.1-alpha.0'));
  write(
    '.changeset/pre.json',
    JSON.stringify({ mode: 'pre', tag: 'alpha', initialVersions: {}, changesets: ['feat-a'] }),
  );
  git('add', '-A');
  git('commit', '-m', 'chore: version packages (alpha)');
  git('push', '-q', 'origin', 'HEAD:main', 'HEAD:refs/heads/release/2026-11-24');
  git('checkout', '-q', '-b', 'release/2026-11-24');
  return { cwd, git, write, head: () => git('rev-parse', 'HEAD') };
}

// What the stable job does to the alpha commit: pre exit + version.
function versionStable({ cwd, write }) {
  unlinkSync(path.join(cwd, '.changeset/pre.json'));
  write('packages/a/package.json', pkg('@fx/a', '1.1.0'));
  write('packages/a/CHANGELOG.md', '# @fx/a\n\n## 1.1.0\n');
  write('packages/b/package.json', pkg('@fx/b', '2.0.1'));
}

function run(cwd, server, args) {
  const outputFile = path.join(cwd, '..', 'github-output');
  writeFileSync(outputFile, '');
  const env = {
    ...process.env,
    GITHUB_API_URL: server.url,
    GITHUB_REPOSITORY: REPO,
    GITHUB_TOKEN: 'ghs_test',
    GITHUB_OUTPUT: outputFile,
  };
  delete env.NPM_CONFIG_USERCONFIG;
  delete env.npm_config_registry;
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], { cwd, env });
    let output = '';
    child.stdout.setEncoding('utf8').on('data', chunk => (output += chunk));
    child.stderr.setEncoding('utf8').on('data', chunk => (output += chunk));
    child.on('error', reject);
    child.on('close', status => resolve({ status, output, outputs: readFileSync(outputFile, 'utf8') }));
  });
}

const alphaRun = (sha, overrides = {}) => ({
  id: 1,
  check_suite_id: 900,
  event: 'workflow_dispatch',
  status: 'completed',
  conclusion: 'success',
  head_sha: sha,
  display_title: 'npm publish prerelease on release/2026-11-24',
  ...overrides,
});
const ALPHA_VERSIONS = ['@fx/a@1.1.0-alpha.0', '@fx/b@2.0.1-alpha.0'];

test('branch: refuses a ref that is not release/*', async t => {
  const server = await startServer(t);
  const repo = makeRepo(t, server.url);
  const result = await run(repo.cwd, server, ['branch', '--ref', 'main']);
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /main is not a release branch/);
});

test('branch: refuses when a second release branch is open', async t => {
  const server = await startServer(t);
  const repo = makeRepo(t, server.url);
  repo.git('push', '-q', 'origin', 'HEAD:refs/heads/release/2026-11-25');
  const result = await run(repo.cwd, server, ['branch', '--ref', 'release/2026-11-24']);
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /More than one release branch is open \(release\/2026-11-24, release\/2026-11-25\)/);
});

test('branch: refuses a release ref that is not on the remote', async t => {
  const server = await startServer(t);
  const repo = makeRepo(t, server.url);
  const result = await run(repo.cwd, server, ['branch', '--ref', 'release/2026-01-01']);
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /does not exist on origin/);
});

test('branch: allows the only open release branch', async t => {
  const server = await startServer(t);
  const repo = makeRepo(t, server.url);
  const result = await run(repo.cwd, server, ['branch', '--ref', 'release/2026-11-24']);
  assert.equal(result.status, 0, result.output);
});

test('checks: refuses a failed, pending or missing check, and a failed commit status', async t => {
  const cases = [
    [
      { checkRuns: [{ name: 'test (core)', status: 'completed', conclusion: 'failure', check_suite: { id: 1 } }] },
      /check test \(core\): failure/,
    ],
    [
      { checkRuns: [{ name: 'lint', status: 'in_progress', conclusion: null, check_suite: { id: 1 } }] },
      /check lint: in_progress/,
    ],
    [
      {
        checkRuns: [{ name: 'lint', status: 'completed', conclusion: 'success', check_suite: { id: 1 } }],
        statuses: [{ context: 'vercel', state: 'failure' }],
      },
      /status vercel: failure/,
    ],
    [{}, /no checks have run on this commit/],
  ];
  for (const [world, message] of cases) {
    const server = await startServer(t, world);
    const repo = makeRepo(t, server.url);
    const result = await run(repo.cwd, server, ['checks', '--sha', repo.head()]);
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, message);
  }
});

test('checks: allows green checks and ignores npm-publish runs on the same commit', async t => {
  const server = await startServer(t);
  const repo = makeRepo(t, server.url);
  const sha = repo.head();
  const green = await startServer(t, {
    statuses: [{ context: 'vercel', state: 'success' }],
    checkRuns: [
      { name: 'test (core)', status: 'completed', conclusion: 'success', check_suite: { id: 1 } },
      { name: 'docs', status: 'completed', conclusion: 'skipped', check_suite: { id: 2 } },
      // This prerelease job, and an earlier failed publish attempt.
      { name: 'prerelease', status: 'in_progress', conclusion: null, check_suite: { id: 900 } },
      { name: 'prerelease', status: 'completed', conclusion: 'failure', check_suite: { id: 901 } },
    ],
    publishRuns: {
      [sha]: [
        alphaRun(sha, { status: 'in_progress', conclusion: null }),
        alphaRun(sha, { id: 2, check_suite_id: 901, conclusion: 'failure' }),
      ],
    },
  });
  const result = await run(repo.cwd, green, ['checks', '--sha', sha]);
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /All 2 check run\(s\) and 1 status\(es\)/);
});

test('checks: a version-only head is judged by the checks on the code commit below it', async t => {
  const server = await startServer(t);
  const repo = makeRepo(t, server.url);
  const versionSha = repo.head();
  const codeSha = repo.git('rev-parse', 'HEAD^');
  const green = { name: 'test (core)', status: 'completed', conclusion: 'success', check_suite: { id: 1 } };
  const red = { ...green, conclusion: 'failure' };

  // The version commit skipped CI; only the code commit has checks.
  const passing = await startServer(t, { checkRunsBySha: { [codeSha]: [green] } });
  let result = await run(repo.cwd, passing, ['checks', '--sha', versionSha]);
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, new RegExp(`checking the code commit ${codeSha}`));

  const failing = await startServer(t, { checkRunsBySha: { [codeSha]: [red], [versionSha]: [green] } });
  result = await run(repo.cwd, failing, ['checks', '--sha', versionSha]);
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /check test \(core\): failure/);

  // A commit that changes code is judged by its own checks.
  repo.write('packages/a/index.js', 'export const a = 3;\n');
  repo.git('commit', '-qam', 'fix: a');
  const fixSha = repo.head();
  const own = await startServer(t, { checkRunsBySha: { [fixSha]: [red], [versionSha]: [green] } });
  result = await run(repo.cwd, own, ['checks', '--sha', fixSha]);
  assert.equal(result.status, 1, result.output);
  assert.doesNotMatch(result.output, /checking the code commit/);
});

test('alpha: refuses stable when a version at HEAD is not on npm', async t => {
  const server = await startServer(t, { published: ['@fx/a@1.1.0-alpha.0'] });
  const repo = makeRepo(t, server.url);
  server.versions.add('@fx/internal@0.0.1');
  const result = await run(repo.cwd, server, ['alpha', '--sha', repo.head(), '--registry', server.url]);
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /not on npm:\n {2}@fx\/b@2\.0\.1-alpha\.0/);
});

test('alpha: refuses stable after a cherry-pick without a changeset (versions published, code not)', async t => {
  const server = await startServer(t, { published: ALPHA_VERSIONS });
  const repo = makeRepo(t, server.url);
  const alpha = repo.head();
  repo.write('packages/a/index.js', 'export const a = 2;\n');
  repo.git('commit', '-qam', 'fix: a without a changeset');
  const world = await startServer(t, { published: ALPHA_VERSIONS, publishRuns: { [alpha]: [alphaRun(alpha)] } });
  const result = await run(repo.cwd, world, ['alpha', '--sha', repo.head(), '--registry', world.url]);
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /is not a version commit \(it changes packages\/a\/index\.js\)/);
});

test('alpha: refuses a code commit even after a prerelease run on it succeeded (it published nothing new)', async t => {
  const server = await startServer(t, { published: ALPHA_VERSIONS });
  const repo = makeRepo(t, server.url);
  repo.write('packages/a/index.js', 'export const a = 2;\n');
  repo.git('commit', '-qam', 'fix: a without a changeset');
  const sha = repo.head();
  const world = await startServer(t, { published: ALPHA_VERSIONS, publishRuns: { [sha]: [alphaRun(sha)] } });
  const result = await run(repo.cwd, world, ['alpha', '--sha', sha, '--registry', world.url]);
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /is not a version commit/);
});

test('alpha: refuses when only a stable, an enter-prerelease or a failed publish ran on the commit', async t => {
  const server = await startServer(t);
  const repo = makeRepo(t, server.url);
  const sha = repo.head();
  const world = await startServer(t, {
    published: ALPHA_VERSIONS,
    publishRuns: {
      [sha]: [
        alphaRun(sha, { conclusion: 'failure' }),
        alphaRun(sha, { id: 3, display_title: 'npm publish stable on release/2026-11-24' }),
        alphaRun(sha, { id: 4, display_title: 'npm publish enter-prerelease on release/2026-11-24' }),
      ],
    },
  });
  const result = await run(repo.cwd, world, ['alpha', '--sha', sha, '--registry', world.url]);
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /No successful prerelease publish ran/);
});

test('alpha: allows the published alpha commit', async t => {
  const server = await startServer(t);
  const repo = makeRepo(t, server.url);
  const sha = repo.head();
  const world = await startServer(t, { published: ALPHA_VERSIONS, publishRuns: { [sha]: [alphaRun(sha)] } });
  const result = await run(repo.cwd, world, ['alpha', '--sha', sha, '--registry', world.url]);
  assert.equal(result.status, 0, result.output);
  assert.equal(result.outputs, `alpha_sha=${sha}\nversioned=false\n`);
});

test('alpha: a rerun on the pushed stable version commit promotes its parent', async t => {
  const server = await startServer(t);
  const repo = makeRepo(t, server.url);
  const alpha = repo.head();
  versionStable(repo);
  repo.git('add', '-A');
  repo.git('commit', '-qm', 'chore: version - exit prerelease mode');
  const world = await startServer(t, { published: ALPHA_VERSIONS, publishRuns: { [alpha]: [alphaRun(alpha)] } });
  const result = await run(repo.cwd, world, ['alpha', '--sha', repo.head(), '--registry', world.url]);
  assert.equal(result.status, 0, result.output);
  assert.equal(result.outputs, `alpha_sha=${alpha}\nversioned=true\n`);
});

test('alpha: refuses a pushed stable commit that also changes a source file', async t => {
  const server = await startServer(t);
  const repo = makeRepo(t, server.url);
  const alpha = repo.head();
  versionStable(repo);
  repo.write('packages/a/index.js', 'export const a = 3;\n');
  repo.git('add', '-A');
  repo.git('commit', '-qm', 'chore: version - exit prerelease mode');
  const world = await startServer(t, { published: ALPHA_VERSIONS, publishRuns: { [alpha]: [alphaRun(alpha)] } });
  const result = await run(repo.cwd, world, ['alpha', '--sha', repo.head(), '--registry', world.url]);
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /also changes:\n {2}packages\/a\/index\.js/);
});

test('stable-head: a re-run builds on the version commit an earlier attempt pushed, nothing else', async t => {
  const server = await startServer(t);
  const repo = makeRepo(t, server.url);
  const alpha = repo.head();
  let result = await run(repo.cwd, server, ['stable-head', '--sha', alpha, '--ref', 'release/2026-11-24']);
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, new RegExp(`sha=${alpha}`));

  versionStable(repo);
  repo.git('commit', '-qam', 'chore: version - exit prerelease mode');
  repo.git('push', '-q', 'origin', 'HEAD:refs/heads/release/2026-11-24');
  const version = repo.head();
  result = await run(repo.cwd, server, ['stable-head', '--sha', alpha, '--ref', 'release/2026-11-24']);
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, new RegExp(`sha=${version}`));

  repo.write('packages/a/index.js', 'export const a = 3;\n');
  repo.git('commit', '-qam', 'fix: after the approval');
  repo.git('push', '-q', 'origin', 'HEAD:refs/heads/release/2026-11-24');
  result = await run(repo.cwd, server, ['stable-head', '--sha', alpha, '--ref', 'release/2026-11-24']);
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /moved since [0-9a-f]{40} was dispatched/);
});

test('diff: allows the stable version changes and refuses a source file', async t => {
  const server = await startServer(t);
  const repo = makeRepo(t, server.url);
  const alpha = repo.head();
  versionStable(repo);
  repo.write('.changeset/new-untracked.md', 'x');
  assert.equal((await run(repo.cwd, server, ['diff', '--base', alpha])).status, 0);

  repo.write('packages/b/src/new.js', 'export {};\n');
  const result = await run(repo.cwd, server, ['diff', '--base', alpha]);
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /also changes:\n {2}packages\/b\/src\/new\.js/);
});

test('published: refuses until every stable version is on npm', async t => {
  const server = await startServer(t, { published: ['@fx/a@1.1.0'] });
  const repo = makeRepo(t, server.url);
  versionStable(repo);
  const refused = await run(repo.cwd, server, ['published', '--registry', server.url]);
  assert.equal(refused.status, 1, refused.output);
  assert.match(refused.output, /Not on npm yet:\n {2}@fx\/b@2\.0\.1/);
  server.versions.add('@fx/b@2.0.1');
  assert.equal((await run(repo.cwd, server, ['published', '--registry', server.url])).status, 0);
});

test('move-latest: moves latest with npm dist-tag add, skipping packages already there', async t => {
  const server = await startServer(t, {
    published: ['@fx/a@1.1.0', '@fx/b@2.0.1'],
    latest: { '@fx/a': '1.1.0', '@fx/b': '2.0.0' },
  });
  const repo = makeRepo(t, server.url);
  versionStable(repo);
  const result = await run(repo.cwd, server, ['move-latest', '--registry', server.url]);
  assert.equal(result.status, 0, result.output);
  assert.deepEqual(server.state.distTagPuts, ['@fx/b@2.0.1']);
  assert.match(result.output, /latest: @fx\/b 2\.0\.0 -> 2\.0\.1/);
  assert.match(result.output, /Moved latest for 1 package\(s\); 1 were already there/);

  const rerun = await run(repo.cwd, server, ['move-latest', '--registry', server.url]);
  assert.equal(rerun.status, 0, rerun.output);
  assert.deepEqual(server.state.distTagPuts, ['@fx/b@2.0.1']);
  assert.match(rerun.output, /Moved latest for 0 package\(s\); 2 were already there/);
});

test('move-latest --versions: rolls latest back and refuses versions npm does not have', async t => {
  const server = await startServer(t, {
    published: ['@fx/a@1.0.0', '@fx/a@1.1.0'],
    latest: { '@fx/a': '1.1.0' },
  });
  const repo = makeRepo(t, server.url);
  const refused = await run(repo.cwd, server, [
    'move-latest',
    '--versions',
    '@fx/a@1.0.0,@fx/b@9.9.9',
    '--registry',
    server.url,
  ]);
  assert.equal(refused.status, 1, refused.output);
  assert.match(refused.output, /npm does not have:\n {2}@fx\/b@9\.9\.9/);
  assert.deepEqual(server.state.distTagPuts, []);

  const result = await run(repo.cwd, server, ['move-latest', '--versions', '@fx/a@1.0.0', '--registry', server.url]);
  assert.equal(result.status, 0, result.output);
  assert.deepEqual(server.state.distTagPuts, ['@fx/a@1.0.0']);
});
