import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { acquireThreadLock, getThreadLockOwner, ThreadLockError, tryAcquireThreadLock } from './thread-lock.js';

const DEAD_PID = 2_147_483_647;

const interleave = vi.hoisted(() => ({
  onExclusiveCreate: undefined as (() => void) | undefined,
  onUnlink: undefined as (() => void) | undefined,
}));

function fireOnce(key: 'onExclusiveCreate' | 'onUnlink'): void {
  const hook = interleave[key];
  if (!hook) return;
  interleave[key] = undefined;
  hook();
}

vi.mock('node:fs', async importOriginal => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    openSync: (...args: Parameters<typeof actual.openSync>) => {
      if (args[1] === 'wx') fireOnce('onExclusiveCreate');
      return actual.openSync(...args);
    },
    unlinkSync: (...args: Parameters<typeof actual.unlinkSync>) => {
      fireOnce('onUnlink');
      return actual.unlinkSync(...args);
    },
  };
});

describe('thread locks', () => {
  let appDataDir: string;

  beforeEach(() => {
    appDataDir = mkdtempSync(join(tmpdir(), 'mastracode-thread-lock-'));
    vi.stubEnv('MASTRA_APP_DATA_DIR', appDataDir);
  });

  afterEach(() => {
    interleave.onExclusiveCreate = undefined;
    interleave.onUnlink = undefined;
    vi.unstubAllEnvs();
    rmSync(appDataDir, { recursive: true, force: true });
  });

  function locksDir(): string {
    const dir = join(appDataDir, 'locks');
    mkdirSync(dir, { recursive: true });
    return dir;
  }

  function writeOwner(threadId: string, pid: number, generation = 1): string {
    const lockPath = join(locksDir(), `${threadId}.${generation}.lock`);
    writeFileSync(lockPath, String(pid));
    return lockPath;
  }

  function writeLegacyOwner(threadId: string, pid: number): string {
    const lockPath = join(locksDir(), `${threadId}.lock`);
    writeFileSync(lockPath, String(pid));
    return lockPath;
  }

  function lockFiles(threadId: string): string[] {
    return readdirSync(locksDir())
      .filter(file => file.startsWith(`${threadId}.`) && file.endsWith('.lock'))
      .sort();
  }

  function currentOwner(threadId: string): string | undefined {
    const files = lockFiles(threadId);
    const newest = files
      .map(file => ({ file, generation: Number(file.slice(threadId.length + 1, -'.lock'.length) || 0) }))
      .sort((a, b) => b.generation - a.generation)[0];
    return newest ? readFileSync(join(locksDir(), newest.file), 'utf-8') : undefined;
  }

  /** Runs `fn` as if this process had another PID, so races can be driven in-process. */
  function asPid<T>(pid: number, fn: () => T): T {
    const descriptor = Object.getOwnPropertyDescriptor(process, 'pid')!;
    Object.defineProperty(process, 'pid', { ...descriptor, value: pid });
    try {
      return fn();
    } finally {
      Object.defineProperty(process, 'pid', descriptor);
    }
  }

  function tryAcquire(threadId: string, pid?: number): boolean {
    const attempt = () => tryAcquireThreadLock(threadId);
    return pid === undefined ? attempt() : asPid(pid, attempt);
  }

  it('reports contention without replacing a live process lock', () => {
    const lockPath = writeOwner('thread-live', process.ppid);

    expect(tryAcquireThreadLock('thread-live')).toBe(false);
    expect(() => acquireThreadLock('thread-live')).toThrow(ThreadLockError);
    expect(getThreadLockOwner('thread-live')).toBe(process.ppid);
    expect(readFileSync(lockPath, 'utf-8')).toBe(String(process.ppid));
  });

  it('does not delete stale locks while checking their owner', () => {
    const lockPath = writeOwner('thread-stale-query', DEAD_PID);

    expect(getThreadLockOwner('thread-stale-query')).toBeNull();
    expect(readFileSync(lockPath, 'utf-8')).toBe(String(DEAD_PID));
  });

  it('supersedes a lock owned by a dead process', () => {
    writeOwner('thread-stale', DEAD_PID);

    expect(tryAcquireThreadLock('thread-stale')).toBe(true);
    expect(currentOwner('thread-stale')).toBe(String(process.pid));
    expect(lockFiles('thread-stale')).toEqual(['thread-stale.2.lock']);
  });

  it('honours a lock file written before generations existed', () => {
    const lockPath = writeLegacyOwner('thread-legacy', process.ppid);

    expect(tryAcquireThreadLock('thread-legacy')).toBe(false);
    expect(readFileSync(lockPath, 'utf-8')).toBe(String(process.ppid));

    writeFileSync(lockPath, String(DEAD_PID));
    expect(tryAcquireThreadLock('thread-legacy')).toBe(true);
    expect(lockFiles('thread-legacy')).toEqual(['thread-legacy.1.lock']);
  });

  // Two processes reclaiming the same stale lock must not both end up owning it.
  const raceCases = [
    { seed: 'generation', hook: 'onExclusiveCreate' },
    { seed: 'generation', hook: 'onUnlink' },
    { seed: 'legacy', hook: 'onExclusiveCreate' },
    { seed: 'legacy', hook: 'onUnlink' },
  ] as const;

  it.each(raceCases)(
    'grants a $seed stale lock to a single process when a competitor interleaves at $hook',
    ({ seed, hook }) => {
      const otherPid = process.ppid;
      if (seed === 'legacy') writeLegacyOwner('thread-race', DEAD_PID);
      else writeOwner('thread-race', DEAD_PID);

      let otherAcquired = false;
      interleave[hook] = () => {
        otherAcquired = tryAcquire('thread-race', otherPid);
      };

      const selfAcquired = tryAcquire('thread-race');

      expect([selfAcquired, otherAcquired].filter(Boolean)).toHaveLength(1);
      expect(currentOwner('thread-race')).toBe(String(selfAcquired ? process.pid : otherPid));
    },
  );
});
