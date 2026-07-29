import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { acquireThreadLock, getThreadLockOwner, ThreadLockError, tryAcquireThreadLock } from './thread-lock.js';

describe('thread locks', () => {
  let appDataDir: string;

  beforeEach(() => {
    appDataDir = mkdtempSync(join(tmpdir(), 'mastracode-thread-lock-'));
    vi.stubEnv('MASTRA_APP_DATA_DIR', appDataDir);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(appDataDir, { recursive: true, force: true });
  });

  function writeOwner(threadId: string, pid: number): string {
    const locksDir = join(appDataDir, 'locks');
    mkdirSync(locksDir, { recursive: true });
    const lockPath = join(locksDir, `${threadId}.lock`);
    writeFileSync(lockPath, String(pid));
    return lockPath;
  }

  it('reports contention without replacing a live process lock', () => {
    const lockPath = writeOwner('thread-live', process.ppid);

    expect(tryAcquireThreadLock('thread-live')).toBe(false);
    expect(() => acquireThreadLock('thread-live')).toThrow(ThreadLockError);
    expect(getThreadLockOwner('thread-live')).toBe(process.ppid);
    expect(readFileSync(lockPath, 'utf-8')).toBe(String(process.ppid));
  });

  it('does not delete stale locks while checking their owner', () => {
    const stalePid = 2_147_483_647;
    const lockPath = writeOwner('thread-stale-query', stalePid);

    expect(getThreadLockOwner('thread-stale-query')).toBeNull();
    expect(readFileSync(lockPath, 'utf-8')).toBe(String(stalePid));
  });

  it('reclaims a lock owned by a dead process', () => {
    const lockPath = writeOwner('thread-stale', 2_147_483_647);

    expect(tryAcquireThreadLock('thread-stale')).toBe(true);
    expect(readFileSync(lockPath, 'utf-8')).toBe(String(process.pid));
  });
});
