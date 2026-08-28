import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  acquireThreadLock,
  getThreadLockOwner,
  releaseThreadLock,
  ThreadLockError,
  tryAcquireThreadLock,
} from './thread-lock.js';

// No real process can ever have this PID.
const DEAD_PID = 2_147_483_647;

// One-shot seams for driving interleavings inside a single acquire() call.
// `beforeExclusiveCreate` fires immediately before an exclusive ('wx') create;
// the superseded-scan seams arm hooks around the *second* directory listing,
// where acquire() scans for live owners below the generation it just claimed
// (the first listing picks the generation).
const interleave = vi.hoisted(() => ({
  beforeExclusiveCreate: undefined as (() => void) | undefined,
  beforeSupersededScan: undefined as (() => void) | undefined,
  afterSupersededScan: undefined as (() => void) | undefined,
  armedReaddirCount: 0,
}));

function fireOnce(key: 'beforeExclusiveCreate' | 'beforeSupersededScan' | 'afterSupersededScan'): void {
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
      if (args[1] === 'wx') fireOnce('beforeExclusiveCreate');
      return actual.openSync(...args);
    },
    readdirSync: ((...args: unknown[]) => {
      if (interleave.beforeSupersededScan || interleave.afterSupersededScan) {
        interleave.armedReaddirCount++;
        if (interleave.armedReaddirCount === 2) {
          fireOnce('beforeSupersededScan');
          const result = (actual.readdirSync as (...args: unknown[]) => string[])(...args);
          fireOnce('afterSupersededScan');
          return result;
        }
      }
      return (actual.readdirSync as (...args: unknown[]) => string[])(...args);
    }) as typeof actual.readdirSync,
  };
});

describe('thread locks', () => {
  let appDataDir: string;

  beforeEach(() => {
    appDataDir = mkdtempSync(join(tmpdir(), 'mastracode-thread-lock-'));
    vi.stubEnv('MASTRA_APP_DATA_DIR', appDataDir);
  });

  afterEach(() => {
    interleave.beforeExclusiveCreate = undefined;
    interleave.beforeSupersededScan = undefined;
    interleave.afterSupersededScan = undefined;
    interleave.armedReaddirCount = 0;
    vi.unstubAllEnvs();
    rmSync(appDataDir, { recursive: true, force: true });
  });

  function locksDir(): string {
    const dir = join(appDataDir, 'locks');
    mkdirSync(dir, { recursive: true });
    return dir;
  }

  function lockPathFor(threadId: string, generation?: number): string {
    const suffix = generation === undefined ? '' : `.${generation}`;
    return join(locksDir(), `${threadId}${suffix}.lock`);
  }

  function writeOwner(threadId: string, pid: number, generation?: number): string {
    const filePath = lockPathFor(threadId, generation);
    writeFileSync(filePath, String(pid));
    return filePath;
  }

  function lockFilesFor(threadId: string): string[] {
    return readdirSync(locksDir())
      .filter(file => file.startsWith(`${threadId}.`) && file.endsWith('.lock'))
      .sort();
  }

  function currentOwnerPid(threadId: string): number | undefined {
    const files = lockFilesFor(threadId);
    const newest = files
      .map(file => ({ file, generation: Number(file.slice(threadId.length + 1, -'.lock'.length) || 0) }))
      .sort((a, b) => b.generation - a.generation)[0];
    return newest ? Number(readFileSync(join(locksDir(), newest.file), 'utf-8')) : undefined;
  }

  /** Runs fn as if this process had `pid`, so two claimants can be driven in-process. */
  function asPid<T>(pid: number, fn: () => T): T {
    const descriptor = Object.getOwnPropertyDescriptor(process, 'pid')!;
    Object.defineProperty(process, 'pid', { ...descriptor, value: pid });
    try {
      return fn();
    } finally {
      Object.defineProperty(process, 'pid', descriptor);
    }
  }

  it('reports contention without touching a live process lock', () => {
    const livePath = writeOwner('thread-live', process.ppid);

    expect(tryAcquireThreadLock('thread-live')).toBe(false);
    expect(() => acquireThreadLock('thread-live')).toThrow(ThreadLockError);
    expect(getThreadLockOwner('thread-live')).toBe(process.ppid);
    expect(readFileSync(livePath, 'utf-8')).toBe(String(process.ppid));
  });

  it('supersedes a stale lock and leaves the superseded file in place', () => {
    writeOwner('thread-stale', DEAD_PID, 3);

    expect(tryAcquireThreadLock('thread-stale')).toBe(true);
    expect(currentOwnerPid('thread-stale')).toBe(process.pid);
    // Superseded files are inert garbage: readers only consider the highest
    // generation, so they are left for the owner's own release to clean up.
    expect(lockFilesFor('thread-stale')).toEqual(['thread-stale.3.lock', 'thread-stale.4.lock']);
  });

  it('honours pre-generation lock files and supersedes them when stale', () => {
    const legacyPath = writeOwner('thread-legacy', process.ppid);

    expect(tryAcquireThreadLock('thread-legacy')).toBe(false);
    expect(readFileSync(legacyPath, 'utf-8')).toBe(String(process.ppid));

    writeFileSync(legacyPath, String(DEAD_PID));
    expect(tryAcquireThreadLock('thread-legacy')).toBe(true);
    expect(lockFilesFor('thread-legacy')).toEqual(['thread-legacy.1.lock', 'thread-legacy.lock']);
  });

  it('treats a lock already held by this process as acquired', () => {
    writeOwner('thread-own', process.pid);

    expect(tryAcquireThreadLock('thread-own')).toBe(true);
    expect(currentOwnerPid('thread-own')).toBe(process.pid);
  });

  it('reports a stale lock as unlocked without deleting it', () => {
    const stalePath = writeOwner('thread-stale-query', DEAD_PID);

    expect(getThreadLockOwner('thread-stale-query')).toBeNull();
    expect(readFileSync(stalePath, 'utf-8')).toBe(String(DEAD_PID));
  });

  it('releases only its own lock files', () => {
    writeOwner('thread-release', process.pid);
    const foreignPath = writeOwner('thread-release', process.ppid, 0);

    releaseThreadLock('thread-release');

    expect(lockFilesFor('thread-release')).toEqual([basename(foreignPath)]);
    expect(getThreadLockOwner('thread-release')).toBe(process.ppid);
  });

  it('grants a stale lock to a single claimant when a competitor wins the exclusive create first', () => {
    const otherPid = process.ppid;
    writeOwner('thread-race-create', DEAD_PID);

    let competitorAcquired = false;
    interleave.beforeExclusiveCreate = () => {
      competitorAcquired = asPid(otherPid, () => tryAcquireThreadLock('thread-race-create'));
    };

    const selfAcquired = tryAcquireThreadLock('thread-race-create');

    expect([selfAcquired, competitorAcquired].filter(Boolean)).toHaveLength(1);
    expect(currentOwnerPid('thread-race-create')).toBe(selfAcquired ? process.pid : otherPid);
  });

  it('backs off when a live owner appears below the generation it just claimed', () => {
    writeOwner('thread-race-reset', DEAD_PID);

    // Between our exclusive create and the superseded scan, a legacy lock file
    // owned by a live process shows up below our generation — the lock
    // directory changed behind our snapshot and the live owner keeps the thread.
    interleave.beforeSupersededScan = () => {
      writeOwner('thread-race-reset', process.ppid, 0);
    };

    expect(() => acquireThreadLock('thread-race-reset')).toThrow(ThreadLockError);
    expect(currentOwnerPid('thread-race-reset')).toBe(process.ppid);
    // The live legacy owner keeps the thread; the inert stale file it displaced
    // stays behind for the next claimant to supersede.
    expect(lockFilesFor('thread-race-reset')).toEqual(['thread-race-reset.0.lock', 'thread-race-reset.lock']);
    expect(tryAcquireThreadLock('thread-race-reset')).toBe(false);
  });

  it('yields to, and never deletes, a lower-generation lock that turns live after the scan', () => {
    const stalePath = writeOwner('thread-late-live', DEAD_PID);

    // A legacy writer reclaims the same path with a live PID right after the
    // superseded scan listed it. The re-read inside the scan detects the new
    // owner: the claim backs off, and the now-live file is never unlinked.
    interleave.afterSupersededScan = () => {
      writeFileSync(stalePath, String(process.ppid));
    };

    expect(tryAcquireThreadLock('thread-late-live')).toBe(false);
    expect(readFileSync(stalePath, 'utf-8')).toBe(String(process.ppid));
    expect(lockFilesFor('thread-late-live')).toEqual(['thread-late-live.lock']);
    // The displaced live lock keeps working as a lock.
    expect(getThreadLockOwner('thread-late-live')).toBe(process.ppid);
  });
});
