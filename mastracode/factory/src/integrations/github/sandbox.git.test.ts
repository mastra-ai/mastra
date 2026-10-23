import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { ExecutableSandbox } from '../../sandbox/materialization.js';
import { syncEnvironmentRepository } from './sandbox.js';

describe('environment branch selection with real Git', () => {
  let root: string;
  let origin: string;
  let seed: string;
  let checkout: string;
  let initial: string;
  let latest: string;
  let sandbox: ExecutableSandbox;

  function git(dir: string, ...args: string[]) {
    const result = spawnSync('git', ['-C', dir, ...args], {
      encoding: 'utf8',
      env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' },
    });
    if (result.status !== 0) throw new Error(result.stderr);
    return result.stdout.trim();
  }

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'factory-branch-review-'));
    origin = path.join(root, 'origin.git');
    seed = path.join(root, 'seed');
    checkout = path.join(root, 'checkout');
    git(root, 'init', '--bare', '--initial-branch=main', origin);
    git(root, 'clone', origin, seed);
    git(seed, 'config', 'user.email', 'test@example.com');
    git(seed, 'config', 'user.name', 'Test');
    await writeFile(path.join(seed, 'tracked.txt'), 'A\n');
    git(seed, 'add', '.');
    git(seed, 'commit', '-m', 'A');
    git(seed, 'push', 'origin', 'main');
    initial = git(seed, 'rev-parse', 'HEAD');
    git(root, 'clone', '--no-local', '--depth=1', origin, checkout);
    git(checkout, 'config', 'user.email', 'test@example.com');
    git(checkout, 'config', 'user.name', 'Test');
    await writeFile(path.join(seed, 'tracked.txt'), 'B\n');
    git(seed, 'commit', '-am', 'B');
    git(seed, 'push', 'origin', 'main');
    latest = git(seed, 'rev-parse', 'HEAD');
    sandbox = {
      id: 'real-git',
      async executeCommand(command, args = [], options) {
        const result = spawnSync(command, args, {
          encoding: 'utf8',
          cwd: root,
          env: { ...process.env, ...options?.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' },
          timeout: 10_000,
        });
        if (result.error) throw result.error;
        return { exitCode: result.status ?? 1, stdout: result.stdout, stderr: result.stderr };
      },
    };
  });

  afterEach(async () => {
    if (root) await rm(root, { recursive: true, force: true });
  });

  const sync = () =>
    syncEnvironmentRepository(sandbox, checkout, {
      branch: 'session/task',
      defaultBranch: 'main',
      token: 'test-token',
      repoFullName: 'test/repo',
    });

  it.each(['main', 'detached'])('creates from the remote tip when starting on %s', async start => {
    if (start === 'detached') git(checkout, 'checkout', '--detach');
    expect(git(checkout, 'rev-parse', 'HEAD')).toBe(initial);
    expect(await sync()).toEqual({ outcome: 'created', branch: 'session/task' });
    expect(git(checkout, 'rev-parse', 'HEAD')).toBe(latest);
    expect(await readFile(path.join(checkout, 'tracked.txt'), 'utf8')).toBe('B\n');
  });

  it.each(['unstaged', 'staged', 'untracked', 'committed'])('preserves %s local work on main', async kind => {
    const file = kind === 'untracked' ? 'local.txt' : 'tracked.txt';
    await writeFile(path.join(checkout, file), 'local work\n');
    if (kind === 'staged' || kind === 'committed') git(checkout, 'add', file);
    if (kind === 'committed') git(checkout, 'commit', '-m', 'Local work');
    const head = git(checkout, 'rev-parse', 'HEAD');
    const status = git(checkout, 'status', '--porcelain');
    expect(await sync()).toEqual({ outcome: 'kept', branch: 'main' });
    expect(git(checkout, 'rev-parse', 'HEAD')).toBe(head);
    expect(git(checkout, 'status', '--porcelain')).toBe(status);
    expect(await readFile(path.join(checkout, file), 'utf8')).toBe('local work\n');
  });

  it('resumes an existing local session branch without updating its base', async () => {
    git(checkout, 'branch', 'session/task');
    expect(await sync()).toEqual({ outcome: 'resumed', branch: 'session/task' });
    expect(git(checkout, 'rev-parse', 'HEAD')).toBe(initial);
  });

  it('keeps an unrelated branch unchanged', async () => {
    git(checkout, 'checkout', '-b', 'other-work');
    expect(await sync()).toEqual({ outcome: 'kept', branch: 'other-work' });
    expect(git(checkout, 'rev-parse', 'HEAD')).toBe(initial);
  });
});
