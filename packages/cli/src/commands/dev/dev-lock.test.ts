import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readLiveDevLock } from './dev-lock';

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

    const { readFile } = await import('node:fs/promises');
    await expect(readFile(lockPath, 'utf-8')).resolves.toContain('999999');
  });
});
