import { describe, expect, it, vi, beforeEach } from 'vitest';

import { DEFAULT_CONNECTION_TIMEOUT_MS } from './db';
import { LibSQLStore } from './index';

const createClientMock = vi.hoisted(() =>
  vi.fn(() => ({
    execute: vi.fn().mockResolvedValue({ rows: [] }),
    closed: true,
  })),
);

vi.mock('@libsql/client', () => ({
  createClient: createClientMock,
}));

describe('LibSQLStore embedded-replica sync config', () => {
  beforeEach(() => {
    createClientMock.mockClear();
  });

  it('passes syncUrl and syncInterval to createClient and skips the local timeout', () => {
    new LibSQLStore({
      id: 'replica-store',
      url: 'file:./replica.db',
      authToken: 'test-token',
      syncUrl: 'libsql://my-db.turso.io',
      syncInterval: 60,
    });

    expect(createClientMock).toHaveBeenCalledTimes(1);
    expect(createClientMock).toHaveBeenCalledWith({
      url: 'file:./replica.db',
      authToken: 'test-token',
      syncUrl: 'libsql://my-db.turso.io',
      syncInterval: 60,
    });
  });

  it('passes syncUrl without syncInterval when only syncUrl is set', () => {
    new LibSQLStore({
      id: 'replica-store',
      url: 'file:./replica.db',
      syncUrl: 'libsql://my-db.turso.io',
    });

    expect(createClientMock).toHaveBeenCalledWith({
      url: 'file:./replica.db',
      syncUrl: 'libsql://my-db.turso.io',
    });
  });

  it('keeps local behavior unchanged when syncUrl is not set', () => {
    new LibSQLStore({
      id: 'local-store',
      url: 'file:./local.db',
    });

    expect(createClientMock).toHaveBeenCalledWith({
      url: 'file:./local.db',
      timeout: DEFAULT_CONNECTION_TIMEOUT_MS,
    });
  });

  it('keeps remote behavior unchanged (no timeout, no sync fields)', () => {
    new LibSQLStore({
      id: 'remote-store',
      url: 'libsql://my-db.turso.io',
      authToken: 'test-token',
    });

    expect(createClientMock).toHaveBeenCalledWith({
      url: 'libsql://my-db.turso.io',
      authToken: 'test-token',
    });
  });
});
