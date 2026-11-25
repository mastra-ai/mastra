import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { pathToFileURL } from 'node:url';

import { main, mirror, syncRepo, validateManifest } from './sync-docs.mjs';

const GIT_ENV = {
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 'test@example.com',
};
Object.assign(process.env, GIT_ENV);

let tmp;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-docs-test-'));
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function writeFiles(dir, files) {
  for (const [file, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), content);
  }
}

function readTree(dir) {
  const out = {};
  const walk = current => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else out[path.relative(dir, full)] = fs.readFileSync(full, 'utf8');
    }
  };
  walk(dir);
  return out;
}

const SOURCE_FILES = {
  'index.mdx': '# Home\n',
  'guide.mdx': '# Guide\n',
  'nested/deep.mdx': '# Deep\n',
  'sidebars.js': 'export default {};\n',
};

/** A fake monorepo root (a git repo with one commit) containing docs/src/site. */
function makeRoot(files = SOURCE_FILES) {
  const root = path.join(tmp, 'root');
  writeFiles(path.join(root, 'docs/src/site'), files);
  git(tmp, 'init', '--quiet', root);
  git(root, 'add', '--all');
  git(root, 'commit', '--quiet', '-m', 'root');
  return root;
}

/** A bare remote whose main branch has a README and a stale dest dir. */
function makeRemote(name = 'remote') {
  const bare = path.join(tmp, `${name}.git`);
  const work = path.join(tmp, `${name}-seed`);
  git(tmp, 'init', '--quiet', '--bare', '--initial-branch=main', bare);
  git(tmp, 'init', '--quiet', '--initial-branch=main', work);
  writeFiles(work, { 'README.md': 'site\n', 'src/docs/index.mdx': '# Old home\n', 'src/docs/removed.mdx': 'gone\n' });
  git(work, 'add', '--all');
  git(work, 'commit', '--quiet', '-m', 'seed');
  git(work, 'push', '--quiet', bare, 'main');
  return { bare, url: pathToFileURL(bare).href };
}

function remoteDest(bare, dest = 'src/docs') {
  const files = git(bare, 'ls-tree', '-r', '--name-only', 'main', '--', dest).split('\n').filter(Boolean);
  return Object.fromEntries(
    files.map(file => [path.posix.relative(dest, file), git(bare, 'show', `main:${file}`) + '\n']),
  );
}

function remoteLog(bare) {
  return git(bare, 'log', '--format=%s%n%b%n--', 'main');
}

const target = (overrides = {}) => ({
  name: 'site',
  source: 'docs/src/site',
  repo: 'mastra-ai/site',
  branch: 'main',
  dest: 'src/docs',
  ...overrides,
});

const SHA = 'a'.repeat(40);
const quiet = () => {};

describe('validateManifest', () => {
  test('accepts a valid manifest', () => {
    const root = makeRoot();
    assert.deepEqual(validateManifest({ targets: [target()] }, { rootDir: root }), [target()]);
  });

  const invalid = {
    'name with uppercase and spaces': target({ name: 'Bad Name' }),
    'repo outside mastra-ai': target({ repo: 'other/site' }),
    'repo of ..': target({ repo: 'mastra-ai/..' }),
    'branch starting with -': target({ branch: '--upload-pack=x' }),
    'dest with ..': target({ dest: '../escape' }),
    'dest of .': target({ dest: '.' }),
    'empty dest': target({ dest: '' }),
    'absolute dest': target({ dest: '/etc' }),
    'dest inside .git': target({ dest: '.git/hooks' }),
    'source outside docs/': target({ source: 'packages/core' }),
    'source escaping docs/ with ..': target({ source: 'docs/../packages' }),
    'missing source dir': target({ source: 'docs/src/missing' }),
    'routeBasePath without leading slash': target({ routeBasePath: 'reference' }),
    'routeBasePath with trailing slash': target({ routeBasePath: '/reference/' }),
    'routeBasePath with ..': target({ routeBasePath: '/../x' }),
    'non-string routeBasePath': target({ routeBasePath: 1 }),
  };
  for (const [label, bad] of Object.entries(invalid)) {
    test(`rejects ${label}`, () => {
      const root = makeRoot();
      assert.throws(() => validateManifest({ targets: [bad] }, { rootDir: root }), /Invalid docs sync manifest/);
    });
  }

  test('rejects an existing mdx source in docs/ but outside docs/src/', () => {
    const root = makeRoot();
    writeFiles(path.join(root, 'docs/external'), { 'index.mdx': '# External' });
    assert.throws(
      () => validateManifest({ targets: [target({ source: 'docs/external' })] }, { rootDir: root }),
      /"source" must be a relative path under docs\/src\//,
    );
  });

  test('rejects a source without .mdx files', () => {
    const root = makeRoot();
    writeFiles(path.join(root, 'docs/src/empty'), { 'notes.txt': 'x' });
    assert.throws(
      () => validateManifest({ targets: [target({ source: 'docs/src/empty' })] }, { rootDir: root }),
      /contains no \.mdx files/,
    );
  });

  test('rejects duplicate names and overlapping dests in one repo', () => {
    const root = makeRoot();
    assert.throws(
      () => validateManifest({ targets: [target(), target({ dest: 'other' })] }, { rootDir: root }),
      /duplicate name/,
    );
    assert.throws(
      () => validateManifest({ targets: [target(), target({ name: 'two', dest: 'src/docs/sub' })] }, { rootDir: root }),
      /overlapping "dest"/,
    );
  });

  test('accepts two sections of one site with distinct dests and routeBasePaths', () => {
    const root = makeRoot();
    writeFiles(path.join(root, 'docs/src/site-ref'), { 'api.mdx': '# API\n' });
    const sections = [
      target(),
      target({ name: 'ref', source: 'docs/src/site-ref', dest: 'src/reference', routeBasePath: '/reference' }),
    ];
    assert.deepEqual(validateManifest({ targets: sections }, { rootDir: root }), sections);
  });

  test('rejects sections of one site that clash or diverge', () => {
    const root = makeRoot();
    writeFiles(path.join(root, 'docs/src/site-ref'), { 'api.mdx': '# API\n' });
    const ref = (overrides = {}) =>
      target({
        name: 'ref',
        source: 'docs/src/site-ref',
        dest: 'src/reference',
        routeBasePath: '/reference',
        ...overrides,
      });
    const cases = [
      [ref({ routeBasePath: undefined }), /same "routeBasePath"/],
      [ref({ routeBasePath: '/' }), /same "routeBasePath"/],
      [ref({ branch: 'other' }), /needs the same "branch"/],
      [ref({ source: 'docs/src/site/nested' }), /overlapping "source"/],
    ];
    for (const [second, error] of cases) {
      assert.throws(() => validateManifest({ targets: [target(), second] }, { rootDir: root }), error);
    }
    writeFiles(path.join(root, 'docs/src/site-api'), { 'client.mdx': '# Client\n' });
    const api = ref({ name: 'api', source: 'docs/src/site-api', dest: 'src/api', routeBasePath: '/reference/api' });
    assert.throws(
      () => validateManifest({ targets: [target(), ref(), api] }, { rootDir: root }),
      /targets\[1\] and targets\[2\]: nested "routeBasePath"/,
    );
    assert.doesNotThrow(() =>
      validateManifest({ targets: [target(), ref(), { ...api, routeBasePath: '/referenced' }] }, { rootDir: root }),
    );
    // Different repos may reuse a routeBasePath, a branch, and even the same source.
    assert.doesNotThrow(() =>
      validateManifest(
        {
          targets: [
            target(),
            ref({ repo: 'mastra-ai/other', routeBasePath: undefined }),
            target({ name: 'copy', repo: 'mastra-ai/copy' }),
          ],
        },
        { rootDir: root },
      ),
    );
  });

  test('rejects a missing or empty targets list', () => {
    assert.throws(() => validateManifest({}), /non-empty array/);
    assert.throws(() => validateManifest({ targets: [] }), /non-empty array/);
  });
});

describe('mirror', () => {
  test('adds, updates and deletes files, and removes emptied dirs', () => {
    const source = path.join(tmp, 'source');
    const dest = path.join(tmp, 'dest');
    writeFiles(source, { 'a.mdx': 'new a', 'b.mdx': 'same b', 'sub/c.mdx': 'c' });
    writeFiles(dest, { 'a.mdx': 'old a', 'b.mdx': 'same b', 'stale.mdx': 'x', 'gone/d.mdx': 'd' });

    assert.deepEqual(mirror(source, dest), { added: 1, updated: 1, deleted: 2 });
    assert.deepEqual(readTree(dest), readTree(source));
    assert.equal(fs.existsSync(path.join(dest, 'gone')), false);
    assert.deepEqual(mirror(source, dest), { added: 0, updated: 0, deleted: 0 });
  });

  test('creates a missing dest dir', () => {
    const source = path.join(tmp, 'source');
    writeFiles(source, { 'a.mdx': 'a' });
    assert.deepEqual(mirror(source, path.join(tmp, 'new/dest')), { added: 1, updated: 0, deleted: 0 });
  });

  test('replaces symlinks in dest instead of writing through them', () => {
    const source = path.join(tmp, 'source');
    const dest = path.join(tmp, 'dest');
    const outside = path.join(tmp, 'outside');
    writeFiles(source, { 'a.mdx': 'a', 'sub/c.mdx': 'c' });
    writeFiles(outside, { 'secret.txt': 'secret', 'dir/keep.txt': 'keep' });
    fs.mkdirSync(dest);
    fs.symlinkSync(path.join(outside, 'secret.txt'), path.join(dest, 'a.mdx'));
    fs.symlinkSync(path.join(outside, 'dir'), path.join(dest, 'sub'));
    fs.symlinkSync(path.join(outside, 'secret.txt'), path.join(dest, 'stray.mdx'));

    mirror(source, dest);

    assert.deepEqual(readTree(dest), readTree(source));
    for (const entry of ['a.mdx', 'sub']) assert.equal(fs.lstatSync(path.join(dest, entry)).isSymbolicLink(), false);
    assert.equal(fs.existsSync(path.join(dest, 'stray.mdx')), false);
    assert.deepEqual(readTree(outside), { 'secret.txt': 'secret', 'dir/keep.txt': 'keep' });
  });

  test('refuses a dest reached through a symlink inside withinDir', () => {
    const source = path.join(tmp, 'source');
    const repo = path.join(tmp, 'repo');
    const outside = path.join(tmp, 'outside');
    writeFiles(source, { 'a.mdx': 'a' });
    fs.mkdirSync(repo);
    fs.mkdirSync(outside);
    fs.symlinkSync(outside, path.join(repo, 'src'));

    assert.throws(() => mirror(source, path.join(repo, 'src/docs'), { withinDir: repo }), /symlink/);
    assert.deepEqual(fs.readdirSync(outside), []);
  });
});

describe('syncRepo', () => {
  test('pushes exactly one commit with the fixed message, then is a no-op', async () => {
    const root = makeRoot();
    const remote = makeRemote();

    const first = await syncRepo({ targets: [target()], remoteUrl: remote.url, sha: SHA, rootDir: root, log: quiet });
    assert.deepEqual(first, { status: 'pushed', attempts: 1 });
    assert.equal(git(remote.bare, 'rev-list', '--count', 'main'), '2');
    assert.equal(
      git(remote.bare, 'log', '-1', '--format=%s', 'main'),
      `docs: sync from mastra-ai/mastra@${SHA.slice(0, 7)}`,
    );
    assert.equal(
      git(remote.bare, 'log', '-1', '--format=%b', 'main'),
      `Source: https://github.com/mastra-ai/mastra/commit/${SHA}`,
    );
    assert.deepEqual(remoteDest(remote.bare), SOURCE_FILES);
    assert.equal(git(remote.bare, 'show', 'main:README.md'), 'site', 'files outside dest are untouched');

    const second = await syncRepo({ targets: [target()], remoteUrl: remote.url, sha: SHA, rootDir: root, log: quiet });
    assert.deepEqual(second, { status: 'unchanged' });
    assert.equal(git(remote.bare, 'rev-list', '--count', 'main'), '2');
  });

  test('recovers from a rejected push by resetting and mirroring again', async () => {
    const root = makeRoot();
    const remote = makeRemote();

    const beforePush = () => {
      const competing = path.join(tmp, 'competing');
      git(tmp, 'clone', '--quiet', remote.url, competing);
      writeFiles(competing, { 'src/docs/guide.mdx': 'edited on the target\n', 'src/docs/stray.mdx': 'stray\n' });
      git(competing, 'add', '--all');
      git(competing, 'commit', '--quiet', '-m', 'competing commit');
      git(competing, 'push', '--quiet', 'origin', 'main');
    };

    const result = await syncRepo({
      targets: [target()],
      remoteUrl: remote.url,
      sha: SHA,
      rootDir: root,
      beforePush,
      log: quiet,
    });
    assert.deepEqual(result, { status: 'pushed', attempts: 2 });
    assert.deepEqual(remoteDest(remote.bare), SOURCE_FILES, 'remote dest exactly equals source; stray file removed');
    assert.match(remoteLog(remote.bare), /competing commit/);
    assert.equal(
      git(remote.bare, 'log', '-1', '--format=%s', 'main'),
      `docs: sync from mastra-ai/mastra@${SHA.slice(0, 7)}`,
    );
  });

  test('syncs every section of one site in a single commit, and retries all of them', async () => {
    const root = makeRoot();
    const REF_FILES = { 'api.mdx': '# API\n', 'sidebars.js': 'export default {};\n' };
    writeFiles(path.join(root, 'docs/src/site-ref'), REF_FILES);
    const remote = makeRemote();
    const sections = [
      target(),
      target({ name: 'ref', source: 'docs/src/site-ref', dest: 'src/reference', routeBasePath: '/reference' }),
    ];
    const beforePush = () => {
      const competing = path.join(tmp, 'competing');
      git(tmp, 'clone', '--quiet', remote.url, competing);
      writeFiles(competing, { 'src/reference/stray.mdx': 'stray\n', 'src/docs/guide.mdx': 'edited\n' });
      git(competing, 'add', '--all');
      git(competing, 'commit', '--quiet', '-m', 'competing commit');
      git(competing, 'push', '--quiet', 'origin', 'main');
    };

    const lines = [];
    const result = await syncRepo({
      targets: sections,
      remoteUrl: remote.url,
      sha: SHA,
      rootDir: root,
      beforePush,
      log: line => lines.push(line),
    });
    assert.deepEqual(result, { status: 'pushed', attempts: 2 });
    assert.equal(git(remote.bare, 'rev-list', '--count', 'main'), '3', 'seed + competing + one sync commit');
    assert.deepEqual(
      git(remote.bare, 'show', '--name-only', '--format=', 'main').split('\n').sort(),
      [
        'src/docs/guide.mdx',
        'src/docs/index.mdx',
        'src/docs/nested/deep.mdx',
        'src/docs/removed.mdx',
        'src/docs/sidebars.js',
        'src/reference/api.mdx',
        'src/reference/sidebars.js',
        'src/reference/stray.mdx',
      ],
      'the sync commit touches both dests',
    );
    assert.deepEqual(remoteDest(remote.bare), SOURCE_FILES);
    assert.deepEqual(remoteDest(remote.bare, 'src/reference'), REF_FILES);
    assert.ok(lines.includes('ref: added 2, updated 0, deleted 0'));

    const again = await syncRepo({ targets: sections, remoteUrl: remote.url, sha: SHA, rootDir: root, log: quiet });
    assert.deepEqual(again, { status: 'unchanged' });
  });

  test('refuses targets from different repos or branches', async () => {
    await assert.rejects(
      syncRepo({
        targets: [target(), target({ name: 'b', repo: 'mastra-ai/b' })],
        remoteUrl: 'unused',
        sha: SHA,
        log: quiet,
      }),
      /share one repo and branch/,
    );
    await assert.rejects(
      syncRepo({
        targets: [target(), target({ name: 'b', dest: 'src/b', branch: 'dev' })],
        remoteUrl: 'unused',
        sha: SHA,
        log: quiet,
      }),
      /share one repo and branch/,
    );
  });

  test('rejects an invalid sha', async () => {
    await assert.rejects(
      syncRepo({ targets: [target()], remoteUrl: 'unused', sha: 'HEAD', log: quiet }),
      /Invalid source commit sha/,
    );
  });

  test('refuses a clone whose dest is reached through a committed symlink', async () => {
    const root = makeRoot();
    const outside = path.join(tmp, 'outside');
    fs.mkdirSync(outside);
    const bare = path.join(tmp, 'linked.git');
    const work = path.join(tmp, 'linked-seed');
    git(tmp, 'init', '--quiet', '--bare', '--initial-branch=main', bare);
    git(tmp, 'init', '--quiet', '--initial-branch=main', work);
    fs.symlinkSync(outside, path.join(work, 'src'));
    git(work, 'add', '--all');
    git(work, 'commit', '--quiet', '-m', 'seed');
    git(work, 'push', '--quiet', bare, 'main');
    const before = git(bare, 'rev-parse', 'main');

    await assert.rejects(
      syncRepo({ targets: [target()], remoteUrl: pathToFileURL(bare).href, sha: SHA, rootDir: root, log: quiet }),
      /Refusing to sync through symlink/,
    );
    assert.deepEqual(fs.readdirSync(outside), []);
    assert.equal(git(bare, 'rev-parse', 'main'), before);
  });
});

describe('main', () => {
  function writeManifest(root, targets) {
    const manifestPath = path.join(root, 'docs-sync.json');
    fs.writeFileSync(manifestPath, JSON.stringify({ targets }));
    return manifestPath;
  }

  test('--into mirrors locally and prints a summary', async () => {
    const root = makeRoot();
    const into = path.join(tmp, 'checkout');
    const lines = [];
    const code = await main({
      argv: ['--target', 'site', '--into', into],
      rootDir: root,
      manifestPath: writeManifest(root, [target()]),
      log: line => lines.push(line),
    });
    assert.equal(code, 0);
    assert.deepEqual(lines, ['site: added 4, updated 0, deleted 0']);
    assert.deepEqual(readTree(path.join(into, 'src/docs')), SOURCE_FILES);
  });

  test('--into refuses a selection that spans more than one site', async () => {
    const root = makeRoot();
    const into = path.join(tmp, 'checkout');
    const errors = [];
    const code = await main({
      argv: ['--target', 'all', '--into', into],
      rootDir: root,
      manifestPath: writeManifest(root, [target(), target({ name: 'other', repo: 'mastra-ai/other' })]),
      log: () => {},
      logError: line => errors.push(line),
    });
    assert.equal(code, 2);
    assert.match(errors.join('\n'), /--into takes one site/);
    assert.equal(fs.existsSync(into), false);
  });

  test('--into refuses a dest reached through a symlink in the checkout', async () => {
    const root = makeRoot();
    const into = path.join(tmp, 'checkout');
    const outside = path.join(tmp, 'outside');
    fs.mkdirSync(into);
    fs.mkdirSync(outside);
    fs.symlinkSync(outside, path.join(into, 'src'));
    await assert.rejects(
      main({
        argv: ['--target', 'site', '--into', into],
        rootDir: root,
        manifestPath: writeManifest(root, [target()]),
        log: () => {},
      }),
      /Refusing to sync through symlink/,
    );
    assert.deepEqual(fs.readdirSync(outside), []);
  });

  test('--target all reports a failing target, still syncs the others, and uses the monorepo checkout sha', async t => {
    // A re-run keeps its original GITHUB_SHA; the trailer must still name the checked-out commit.
    const previous = process.env.GITHUB_SHA;
    process.env.GITHUB_SHA = 'b'.repeat(40);
    t.after(() => {
      if (previous === undefined) delete process.env.GITHUB_SHA;
      else process.env.GITHUB_SHA = previous;
    });
    const root = makeRoot();
    const good = makeRemote('good');
    const errors = [];
    const manifestPath = writeManifest(root, [
      target({ name: 'broken', repo: 'mastra-ai/broken' }),
      target({ name: 'good', repo: 'mastra-ai/good' }),
    ]);

    const code = await main({
      argv: ['--target', 'all', '--push'],
      rootDir: root,
      manifestPath,
      remoteUrl: repo => (repo === 'mastra-ai/good' ? good.url : pathToFileURL(path.join(tmp, 'missing.git')).href),
      log: quiet,
      logError: line => errors.push(line),
    });

    assert.equal(code, 1);
    assert.match(errors.join('\n'), /mastra-ai\/broken: sync failed/);
    assert.match(errors.join('\n'), /Failed repos: mastra-ai\/broken$/);
    assert.deepEqual(remoteDest(good.bare), SOURCE_FILES);

    const rootSha = git(root, 'rev-parse', 'HEAD');
    const clonedParent = git(good.bare, 'rev-parse', 'main~1');
    assert.notEqual(rootSha, clonedParent);
    assert.equal(
      git(good.bare, 'log', '-1', '--format=%b', 'main'),
      `Source: https://github.com/mastra-ai/mastra/commit/${rootSha}`,
    );
  });

  test('--push --target all syncs the sections of one site as one commit', async () => {
    const root = makeRoot();
    writeFiles(path.join(root, 'docs/src/site-ref'), { 'api.mdx': '# API\n' });
    git(root, 'add', '--all');
    git(root, 'commit', '--quiet', '-m', 'ref');
    const remote = makeRemote();
    const code = await main({
      argv: ['--target', 'all', '--push'],
      rootDir: root,
      manifestPath: writeManifest(root, [
        target(),
        target({ name: 'ref', source: 'docs/src/site-ref', dest: 'src/reference', routeBasePath: '/reference' }),
      ]),
      remoteUrl: () => remote.url,
      log: quiet,
      logError: quiet,
    });
    assert.equal(code, 0);
    assert.equal(git(remote.bare, 'rev-list', '--count', 'main'), '2', 'seed + one sync commit');
    assert.deepEqual(remoteDest(remote.bare, 'src/reference'), { 'api.mdx': '# API\n' });
  });

  test('rejects an unknown target and conflicting modes', async () => {
    const root = makeRoot();
    const manifestPath = writeManifest(root, [target()]);
    const opts = { rootDir: root, manifestPath, log: quiet, logError: quiet };
    assert.equal(await main({ ...opts, argv: ['--target', 'nope', '--into', tmp] }), 2);
    assert.equal(await main({ ...opts, argv: ['--target', 'site', '--into', tmp, '--push'] }), 2);
    assert.equal(await main({ ...opts, argv: ['--target', 'site'] }), 2);
  });
});
