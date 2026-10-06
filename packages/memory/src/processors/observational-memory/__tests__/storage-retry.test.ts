import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { isStorageLockError, STORAGE_RETRY_CONFIG, withStorageLockRetry } from '../storage-retry';

const busy = () => Object.assign(new Error('SQLITE_BUSY: database is locked'), { code: 'SQLITE_BUSY' });

describe('isStorageLockError', () => {
  it.each([
    ['SQLite busy code', Object.assign(new Error('x'), { code: 'SQLITE_BUSY' })],
    ['SQLite extended busy code', Object.assign(new Error('x'), { code: 'SQLITE_BUSY_SNAPSHOT' })],
    ['SQLite locked code', Object.assign(new Error('x'), { code: 'SQLITE_LOCKED' })],
    ['libsql message only', new Error('SQLITE_BUSY: database is locked')],
    ['wrapped in cause', new Error('failed to update observations', { cause: busy() })],
    ['Postgres serialization failure', Object.assign(new Error('x'), { code: '40001' })],
    ['Postgres deadlock', Object.assign(new Error('x'), { code: '40P01' })],
    ['Postgres lock not available', Object.assign(new Error('x'), { code: '55P03' })],
  ])('detects %s', (_label, error) => {
    expect(isStorageLockError(error)).toBe(true);
  });

  it.each([
    ['constraint violation', Object.assign(new Error('UNIQUE constraint failed'), { code: 'SQLITE_CONSTRAINT' })],
    ['generic error', new Error('Model unavailable')],
    ['non-error value', 'database'],
  ])('ignores %s', (_label, error) => {
    expect(isStorageLockError(error)).toBe(false);
  });
});

describe('withStorageLockRetry', () => {
  const original = { ...STORAGE_RETRY_CONFIG };

  beforeEach(() => {
    STORAGE_RETRY_CONFIG.initialDelayMs = 1;
  });

  afterEach(() => {
    Object.assign(STORAGE_RETRY_CONFIG, original);
  });

  class FakeStore {
    #calls = 0;
    readonly flag = true;
    constructor(private readonly failures: Error[]) {}
    async write(value: string) {
      this.#calls++;
      const failure = this.failures.shift();
      if (failure) throw failure;
      return `${value}:${this.#calls}`;
    }
    sync() {
      return 'sync';
    }
  }

  it('retries lock errors and keeps private-field access working', async () => {
    const store = withStorageLockRetry(new FakeStore([busy(), busy()]));
    await expect(store.write('ok')).resolves.toBe('ok:3');
    expect(store.flag).toBe(true);
    expect(store.sync()).toBe('sync');
    expect(store).toBeInstanceOf(FakeStore);
  });

  it('does not retry other errors', async () => {
    const constraint = new Error('UNIQUE constraint failed');
    const store = withStorageLockRetry(new FakeStore([constraint, constraint]));
    await expect(store.write('ok')).rejects.toBe(constraint);
  });

  it('gives up after the bounded number of retries', async () => {
    const failures = Array.from({ length: STORAGE_RETRY_CONFIG.maxRetries + 1 }, busy);
    const last = failures.at(-1);
    const store = withStorageLockRetry(new FakeStore(failures));
    await expect(store.write('ok')).rejects.toBe(last);
  });
});
