import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { pathToFileURL } from 'node:url';

import { main, mirror, syncTarget, validateManifest } from './sync-docs.mjs';

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
  };
  for (const [label, bad] of Object.entries(invalid)) {
    test(`rejects ${label}`, () => {
      const root = makeRoot();
      assert.throws(() => validateManifest({ targets: [bad] }, { rootDir: root }), /Invalid docs sync manifest/);
    });
  }

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
});

describe('syncTarget', () => {
  test('pushes exactly one commit with the fixed message, then is a no-op', async () => {
    const root = makeRoot();
    const remote = makeRemote();

    const first = await syncTarget({ target: target(), remoteUrl: remote.url, sha: SHA, rootDir: root, log: quiet });
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

    const second = await syncTarget({ target: target(), remoteUrl: remote.url, sha: SHA, rootDir: root, log: quiet });
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

    const result = await syncTarget({
      target: target(),
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

  test('rejects an invalid sha', async () => {
    await assert.rejects(
      syncTarget({ target: target(), remoteUrl: 'unused', sha: 'HEAD', log: quiet }),
      /Invalid source commit sha/,
    );
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

  test('--target all reports a failing target, still syncs the others, and uses the monorepo sha', async () => {
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
      env: {},
      log: quiet,
      logError: line => errors.push(line),
    });

    assert.equal(code, 1);
    assert.match(errors.join('\n'), /broken: sync failed/);
    assert.match(errors.join('\n'), /Failed targets: broken$/);
    assert.deepEqual(remoteDest(good.bare), SOURCE_FILES);

    const rootSha = git(root, 'rev-parse', 'HEAD');
    const clonedParent = git(good.bare, 'rev-parse', 'main~1');
    assert.notEqual(rootSha, clonedParent);
    assert.equal(
      git(good.bare, 'log', '-1', '--format=%b', 'main'),
      `Source: https://github.com/mastra-ai/mastra/commit/${rootSha}`,
    );
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
