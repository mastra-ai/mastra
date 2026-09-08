import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { getLocalFileDatabaseKey, withLocalFileDatabaseWriteLock } from './write-lock';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(resolvePromise => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('withLocalFileDatabaseWriteLock', () => {
  it('serializes calls with the same database key in FIFO order', async () => {
    const firstCanFinish = deferred();
    const order: string[] = [];
    let active = 0;
    let maxActive = 0;

    const task = (label: string, wait?: Promise<void>) =>
      withLocalFileDatabaseWriteLock('/tmp/shared.db', async () => {
        active++;
        maxActive = Math.max(maxActive, active);
        order.push(`${label}:start`);
        await wait;
        order.push(`${label}:end`);
        active--;
        return label;
      });

    const first = task('first', firstCanFinish.promise);
    const second = task('second');
    const third = task('third');

    await Promise.resolve();
    expect(order).toEqual(['first:start']);
    firstCanFinish.resolve();

    await expect(Promise.all([first, second, third])).resolves.toEqual(['first', 'second', 'third']);
    expect(maxActive).toBe(1);
    expect(order).toEqual(['first:start', 'first:end', 'second:start', 'second:end', 'third:start', 'third:end']);
  });

  it('allows calls for different database keys to run concurrently', async () => {
    const bothStarted = deferred();
    const canFinish = deferred();
    let active = 0;
    let maxActive = 0;

    const task = (key: string) =>
      withLocalFileDatabaseWriteLock(key, async () => {
        active++;
        maxActive = Math.max(maxActive, active);
        if (active === 2) bothStarted.resolve();
        await canFinish.promise;
        active--;
      });

    const tasks = Promise.all([task('/tmp/first.db'), task('/tmp/second.db')]);
    await bothStarted.promise;
    canFinish.resolve();
    await tasks;

    expect(maxActive).toBe(2);
  });

  it('continues the queue after a callback rejects', async () => {
    const order: string[] = [];

    const failed = withLocalFileDatabaseWriteLock('/tmp/recovery.db', async () => {
      order.push('failed');
      throw new Error('boom');
    });
    const following = withLocalFileDatabaseWriteLock('/tmp/recovery.db', async () => {
      order.push('following');
      return 'ok';
    });

    await expect(failed).rejects.toThrow('boom');
    await expect(following).resolves.toBe('ok');
    expect(order).toEqual(['failed', 'following']);
  });

  it('does not let stale cleanup remove a newer queue tail', async () => {
    const firstCanFinish = deferred();
    const secondCanFinish = deferred();
    const order: string[] = [];
    let active = 0;
    let maxActive = 0;

    const task = (label: string, wait: Promise<void>) =>
      withLocalFileDatabaseWriteLock('/tmp/cleanup.db', async () => {
        active++;
        maxActive = Math.max(maxActive, active);
        order.push(`${label}:start`);
        await wait;
        order.push(`${label}:end`);
        active--;
      });

    const first = task('first', firstCanFinish.promise);
    const second = task('second', secondCanFinish.promise);
    firstCanFinish.resolve();
    await first;
    await Promise.resolve();

    const third = task('third', Promise.resolve());
    await Promise.resolve();
    expect(order).toEqual(['first:start', 'first:end', 'second:start']);

    secondCanFinish.resolve();
    await Promise.all([second, third]);

    expect(maxActive).toBe(1);
    expect(order).toEqual(['first:start', 'first:end', 'second:start', 'second:end', 'third:start', 'third:end']);
  });
});

describe('getLocalFileDatabaseKey', () => {
  it('returns one canonical key for equivalent local file spellings', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'libsql-vector-key-'));
    try {
      const realParent = path.join(tmpDir, 'real parent');
      const linkedParent = path.join(tmpDir, 'linked-parent');
      fs.mkdirSync(realParent);
      fs.symlinkSync(realParent, linkedParent, 'dir');
      const databasePath = path.join(realParent, 'vectors.db');
      fs.writeFileSync(databasePath, '');

      const keys = await Promise.all([
        getLocalFileDatabaseKey({
          url: `file:${path.relative(process.cwd(), databasePath)}`,
          cwd: process.cwd(),
        }),
        getLocalFileDatabaseKey({ url: `file:${databasePath}`, cwd: process.cwd() }),
        getLocalFileDatabaseKey({
          url: `file:${databasePath.replaceAll(' ', '%20')}?mode=rwc#ignored`,
          cwd: process.cwd(),
        }),
        getLocalFileDatabaseKey({
          url: `file:${path.join(linkedParent, 'vectors.db')}`,
          cwd: process.cwd(),
        }),
      ]);

      expect(new Set(keys)).toEqual(new Set([fs.realpathSync(databasePath)]));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('uses the canonical parent when the database file does not exist yet', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'libsql-vector-key-parent-'));
    try {
      const realParent = path.join(tmpDir, 'real');
      const linkedParent = path.join(tmpDir, 'linked');
      fs.mkdirSync(realParent);
      fs.symlinkSync(realParent, linkedParent, 'dir');

      await expect(
        getLocalFileDatabaseKey({ url: `file:${path.join(linkedParent, 'future.db')}`, cwd: process.cwd() }),
      ).resolves.toBe(path.join(fs.realpathSync(realParent), 'future.db'));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it.each([
    { url: 'libsql://example.turso.io' },
    { url: 'file::memory:' },
    { url: 'file:embedded.db', syncUrl: 'libsql://example.turso.io' },
  ])('does not key remote, in-memory, or embedded-replica configuration: $url', async config => {
    await expect(getLocalFileDatabaseKey({ ...config, cwd: process.cwd() })).resolves.toBeUndefined();
  });

  it('propagates malformed percent encoding instead of falling back to the raw URL', async () => {
    await expect(getLocalFileDatabaseKey({ url: 'file:invalid%ZZ.db', cwd: process.cwd() })).rejects.toThrow(URIError);
  });
});
