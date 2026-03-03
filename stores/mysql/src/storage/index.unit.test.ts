import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

const poolInstances: Array<{
  connection: {
    release: Mock;
    query: Mock;
    execute: Mock;
  };
  pool: {
    getConnection: Mock;
    execute: Mock;
    query: Mock;
    end: Mock;
  };
  release: Mock;
}> = [];

vi.mock('mysql2/promise', async () => {
  const actual = await vi.importActual<typeof import('mysql2/promise')>('mysql2/promise');
  return {
    ...actual,
    createPool: vi.fn(() => {
      const release = vi.fn();
      const connection = {
        release,
        query: vi.fn().mockResolvedValue([[{ count: 0 }]]),
        execute: vi.fn().mockResolvedValue([[]]),
      };
      const pool = {
        getConnection: vi.fn().mockResolvedValue(connection),
        execute: vi.fn().mockResolvedValue([[]]),
        query: vi.fn().mockResolvedValue([[]]),
        end: vi.fn().mockResolvedValue(undefined),
      };
      poolInstances.push({ pool, connection, release });
      return pool as unknown as typeof actual.createPool extends (...args: any) => infer R ? R : never;
    }),
  };
});

import { createPool } from 'mysql2/promise';
import { MySQLStore } from './index';

describe('MySQLStore configuration', () => {
  beforeEach(() => {
    poolInstances.length = 0;
    const maybeMock = createPool as unknown as { mockClear?: () => void };
    maybeMock.mockClear?.();
  });

  it('initializes a pool from a connection string', async () => {
    const store = new MySQLStore({ connectionString: 'mysql://user:pass@localhost:3306/mastra?queueLimit=2', database: 'mastra', max: 5 });

    expect(createPool).toHaveBeenCalledWith({
      host: 'localhost',
      port: 3306,
      user: 'user',
      password: 'pass',
      database: 'mastra',
      connectionLimit: 5,
      waitForConnections: true,
      queueLimit: 2,
      dateStrings: true,
    });

    expect(poolInstances).toHaveLength(1);
    expect(poolInstances[0].pool.execute).not.toHaveBeenCalled();

    // Avoid unhandled promise rejections in later tests
    await store.close();
  });

  it('passes host-based options to mysql2', async () => {
    const store = new MySQLStore({
      host: '127.0.0.1',
      port: 4406,
      user: 'user',
      password: 'pw',
      database: 'db',
      max: 7,
      waitForConnections: false,
      queueLimit: 3,
    });

    expect(createPool).toHaveBeenCalledWith(
      expect.objectContaining({
        host: '127.0.0.1',
        port: 4406,
        user: 'user',
        password: 'pw',
        database: 'db',
        connectionLimit: 7,
        waitForConnections: false,
        queueLimit: 3,
        dateStrings: true,
      }),
    );

    await store.close();
  });

  it('allows host-based configuration without password', async () => {
    const store = new MySQLStore({
      host: 'localhost',
      user: 'root',
      database: 'db',
    });

    expect(createPool).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'localhost',
        user: 'root',
        database: 'db',
      }),
    );

    const { pool } = poolInstances[poolInstances.length - 1];
    expect(pool.execute).not.toHaveBeenCalled();

    await store.close();
  });

  it('acquires and releases a connection during init', async () => {
    const store = new MySQLStore({ host: 'localhost', user: 'user', password: 'pw', database: 'db' });
    await store.init();

    expect(poolInstances).toHaveLength(1);
    const { pool, release } = poolInstances[0];
    expect(pool.getConnection).toHaveBeenCalled();
    expect(release).toHaveBeenCalled();

    await store.close();
  });

  it('closes the underlying pool', async () => {
    const store = new MySQLStore({ host: 'localhost', user: 'user', password: 'pw', database: 'db' });
    await store.close();

    const { pool } = poolInstances[0];
    expect(pool.end).toHaveBeenCalled();
  });

  it('only forwards ssl when truthy', async () => {
    const store = new MySQLStore({
      host: 'localhost',
      user: 'user',
      password: 'pw',
      database: 'db',
      ssl: false,
    });

    expect(createPool).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ ssl: expect.anything() }),
    );

    await store.close();
  });

  it('releases connection when table already exists', async () => {
    // Create store first so that poolInstances gets populated
    const store = new MySQLStore({ host: 'localhost', user: 'user', password: 'pw', database: 'db' });

    // Mock that the table already exists
    const { pool, connection, release } = poolInstances[poolInstances.length - 1];
    connection.query = vi.fn().mockResolvedValue([[{ count: 1 }]]); // table exists

    await store.init();

    expect(pool.getConnection).toHaveBeenCalled();
    expect(release).toHaveBeenCalled(); // Connection should be released even when table exists

    await store.close();
  });

  it('uses a non-undefined database bind when connection string omits database', async () => {
    const store = new MySQLStore({ connectionString: 'mysql://user:pass@localhost:3306' });
    const { connection } = poolInstances[poolInstances.length - 1];

    connection.query = vi.fn().mockImplementation(async (_sql: string, args: unknown[] = []) => {
      if (args.some(value => value === undefined)) {
        throw new TypeError('Bind parameters must not contain undefined');
      }
      return [[{ count: 1 }]];
    });

    await expect(store.init()).resolves.toBeUndefined();
    for (const [, args] of connection.query.mock.calls) {
      if (Array.isArray(args)) {
        expect(args).not.toContain(undefined);
      }
    }

    await store.close();
  });
});
