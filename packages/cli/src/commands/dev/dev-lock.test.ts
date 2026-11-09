import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { acquireDevLock, getProcessStartTime, readLiveDevLock, updateDevLock } from './dev-lock';

const isLinux = process.platform === 'linux';

/** Spawns an unrelated long-lived process to stand in for a reused PID. */
function spawnUnrelatedProcess(): ChildProcess & { pid: number } {
  const child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 30_000)'], { stdio: 'ignore' });
  return child as ChildProcess & { pid: number };
}

describe('readLiveDevLock', () => {
  const tmpDir = '.test-tmp-read-live-dev-lock';
  const lockPath = join(tmpDir, 'dev.lock');

  beforeEach(async () => {
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns null when no lockfile exists', async () => {
    await expect(readLiveDevLock(tmpDir)).resolves.toBeNull();
  });

  it('returns the lock data when the recorded pid is still alive', async () => {
    await writeFile(lockPath, JSON.stringify({ pid: process.pid, host: 'localhost', port: 4111 }), 'utf-8');

    await expect(readLiveDevLock(tmpDir)).resolves.toEqual({ pid: process.pid, host: 'localhost', port: 4111 });
  });

  it('returns null when the recorded pid is no longer running (stale lock)', async () => {
    // A pid essentially guaranteed not to be alive.
    await writeFile(lockPath, JSON.stringify({ pid: 999999 }), 'utf-8');

    await expect(readLiveDevLock(tmpDir)).resolves.toBeNull();
  });

  it('returns null and never throws on unparseable lock contents', async () => {
    await writeFile(lockPath, 'not json', 'utf-8');

    await expect(readLiveDevLock(tmpDir)).resolves.toBeNull();
  });

  it('does not remove a stale lockfile (read-only, unlike acquireDevLock)', async () => {
    await writeFile(lockPath, JSON.stringify({ pid: 999999 }), 'utf-8');

    await readLiveDevLock(tmpDir);

    await expect(readFile(lockPath, 'utf-8')).resolves.toContain('999999');
  });

  describe('when the recorded pid has been reused by an unrelated process', () => {
    let child: ChildProcess & { pid: number };

    beforeEach(() => {
      child = spawnUnrelatedProcess();
    });

    afterEach(() => {
      child.kill();
    });

    it.runIf(isLinux)('returns null when the live process has a different start time (stale lock)', async () => {
      await writeFile(lockPath, JSON.stringify({ pid: child.pid, startTime: '1' }), 'utf-8');

      await expect(readLiveDevLock(tmpDir)).resolves.toBeNull();
    });

    it('treats a legacy lock without a start time as live (pid-only check)', async () => {
      await writeFile(lockPath, JSON.stringify({ pid: child.pid }), 'utf-8');

      await expect(readLiveDevLock(tmpDir)).resolves.toEqual({ pid: child.pid });
    });
  });

  it.runIf(isLinux)('returns the lock data when the recorded pid and start time match the live owner', async () => {
    const startTime = getProcessStartTime(process.pid);
    expect(startTime).toMatch(/^\d+$/);
    await writeFile(lockPath, JSON.stringify({ pid: process.pid, startTime }), 'utf-8');

    await expect(readLiveDevLock(tmpDir)).resolves.toEqual({ pid: process.pid, startTime });
  });
});

describe('acquireDevLock', () => {
  const tmpDir = '.test-tmp-acquire-dev-lock';
  const lockPath = join(tmpDir, 'dev.lock');
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    await mkdir(tmpDir, { recursive: true });
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(tmpDir, { recursive: true, force: true });
  });

  const readLock = async () => JSON.parse(await readFile(lockPath, 'utf-8'));

  it('writes its own pid (and start time on Linux) when no lock exists', async () => {
    await acquireDevLock(tmpDir);

    const lock = await readLock();
    expect(lock.pid).toBe(process.pid);
    expect(lock.startTime).toBe(getProcessStartTime(process.pid));
  });

  it('replaces a stale lock whose pid is no longer running', async () => {
    await writeFile(lockPath, JSON.stringify({ pid: 999999 }), 'utf-8');

    await acquireDevLock(tmpDir);

    expect(exitSpy).not.toHaveBeenCalled();
    expect((await readLock()).pid).toBe(process.pid);
  });

  it.runIf(isLinux)('replaces a stale lock whose pid was reused by an unrelated live process', async () => {
    const child = spawnUnrelatedProcess();
    try {
      await writeFile(
        lockPath,
        JSON.stringify({ pid: child.pid, startTime: '1', host: 'localhost', port: 4111 }),
        'utf-8',
      );

      await acquireDevLock(tmpDir);

      expect(exitSpy).not.toHaveBeenCalled();
      expect(await readLock()).toEqual({ pid: process.pid, startTime: getProcessStartTime(process.pid) });
    } finally {
      child.kill();
    }
  });

  it('refuses to start when the lock owner is still running', async () => {
    const startTime = getProcessStartTime(process.pid);
    const existing = { pid: process.pid, ...(startTime ? { startTime } : {}), host: 'localhost', port: 4111 };
    await writeFile(lockPath, JSON.stringify(existing), 'utf-8');

    await expect(acquireDevLock(tmpDir)).rejects.toThrow('process.exit');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(await readLock()).toEqual(existing);
  });
});

describe('updateDevLock', () => {
  const tmpDir = '.test-tmp-update-dev-lock';

  beforeEach(async () => {
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('records host and port while keeping the owner identity', async () => {
    await updateDevLock(tmpDir, 'localhost', 4111);

    const startTime = getProcessStartTime(process.pid);
    expect(JSON.parse(await readFile(join(tmpDir, 'dev.lock'), 'utf-8'))).toEqual({
      pid: process.pid,
      ...(startTime ? { startTime } : {}),
      host: 'localhost',
      port: 4111,
    });
  });
});
