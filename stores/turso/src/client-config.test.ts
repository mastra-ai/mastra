import { beforeEach, describe, expect, it, vi } from 'vitest';

const { connect } = vi.hoisted(() => ({ connect: vi.fn() }));

vi.mock('@tursodatabase/database', () => ({ connect }));

import { TursoSqliteClient } from './client';

function fakeDatabase() {
  return {
    batch: vi.fn(async () => [{ columns: [], columnTypes: [], rows: [], rowsAffected: 0 }]),
    close: vi.fn(async () => undefined),
    defaultSafeIntegers: vi.fn(),
  };
}

beforeEach(() => {
  connect.mockReset();
  connect.mockResolvedValue(fakeDatabase());
});

describe('TursoSqliteClient configuration', () => {
  it('keeps experimental multiprocess WAL disabled by default', async () => {
    const client = new TursoSqliteClient({ path: '/tmp/default.db' });
    await client.execute('SELECT 1');

    expect(connect).toHaveBeenCalledWith(
      '/tmp/default.db',
      expect.not.objectContaining({ experimental: expect.anything() }),
    );
    await client.close();
  });

  it('forwards an explicit experimental feature list', async () => {
    const client = new TursoSqliteClient({ path: '/tmp/explicit.db', experimental: ['multiprocess_wal'] });
    await client.execute('SELECT 1');

    expect(connect).toHaveBeenCalledWith(
      '/tmp/explicit.db',
      expect.objectContaining({ experimental: ['multiprocess_wal'] }),
    );
    await client.close();
  });
});
