import type * as Mysql2Promise from 'mysql2/promise';
import { createPool } from 'mysql2/promise';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

import { MySQLStore } from './index';

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
  const actual = await vi.importActual<typeof Mysql2Promise>('mysql2/promise');
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

describe('MySQLStore configuration', () => {
  beforeEach(() => {
    poolInstances.length = 0;
    const maybeMock = createPool as unknown as { mockClear?: () => void };
    maybeMock.mockClear?.();
  });

  it('initializes a pool from a connection string', async () => {
    const store = new MySQLStore({
      connectionString: 'mysql://user:pass@localhost:3306/mastra?queueLimit=2',
      database: 'mastra',
      max: 5,
    });

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

    expect(createPool).toHaveBeenLastCalledWith(expect.not.objectContaining({ ssl: expect.anything() }));

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

describe('MySQLStore unsupported dataset item controls', () => {
  beforeEach(() => {
    poolInstances.length = 0;
    const maybeMock = createPool as unknown as { mockClear?: () => void };
    maybeMock.mockClear?.();
  });

  const newStore = () => new MySQLStore({ host: 'localhost', user: 'user', password: 'pw', database: 'db' });

  it('rejects _doAddItem carrying tool mocks before touching the DB', async () => {
    const store = newStore();
    const datasets = (await store.getStore('datasets')) as any;
    const { pool } = poolInstances[poolInstances.length - 1];

    await expect(
      datasets._doAddItem({
        datasetId: 'd1',
        input: { q: 'hi' },
        toolMocks: [{ toolName: 'getWeather', args: { city: 'Seattle' }, output: { temp: 52 } }],
      }),
    ).rejects.toThrow(/Tool mocks are not supported on the MySQL storage adapter/);

    // Guard runs before any connection is acquired.
    expect(pool.getConnection).not.toHaveBeenCalled();

    await store.close();
  });

  it('rejects _doUpdateItem and _doBatchInsertItems carrying tool mocks', async () => {
    const store = newStore();
    const datasets = (await store.getStore('datasets')) as any;

    await expect(
      datasets._doUpdateItem({
        id: 'i1',
        datasetId: 'd1',
        toolMocks: [{ toolName: 't', args: { a: 1 }, output: 'x' }],
      }),
    ).rejects.toThrow(/Tool mocks are not supported on the MySQL storage adapter/);

    await expect(
      datasets._doBatchInsertItems({
        datasetId: 'd1',
        items: [{ input: 'ok' }, { input: 'bad', toolMocks: [{ toolName: 't', args: {}, output: 1 }] }],
      }),
    ).rejects.toThrow(/Tool mocks are not supported on the MySQL storage adapter/);

    await store.close();
  });

  it('rejects _doAddItem carrying a timeout before touching the DB', async () => {
    const store = newStore();
    const datasets = (await store.getStore('datasets')) as any;
    const { pool } = poolInstances[poolInstances.length - 1];

    await expect(datasets._doAddItem({ datasetId: 'd1', input: { q: 'hi' }, timeout: 1_000 })).rejects.toMatchObject({
      id: 'MYSQL_DATASET_ITEM_TIMEOUT_UNSUPPORTED',
    });
    expect(pool.getConnection).not.toHaveBeenCalled();

    await store.close();
  });

  it('rejects _doUpdateItem and _doBatchInsertItems carrying timeouts before touching the DB', async () => {
    const store = newStore();
    const datasets = (await store.getStore('datasets')) as any;
    const { pool } = poolInstances[poolInstances.length - 1];

    await expect(datasets._doUpdateItem({ id: 'i1', datasetId: 'd1', timeout: 2_000 })).rejects.toMatchObject({
      id: 'MYSQL_DATASET_ITEM_TIMEOUT_UNSUPPORTED',
    });
    await expect(
      datasets._doBatchInsertItems({
        datasetId: 'd1',
        items: [{ input: 'ok' }, { input: 'bad', timeout: 3_000 }],
      }),
    ).rejects.toMatchObject({ id: 'MYSQL_DATASET_ITEM_TIMEOUT_UNSUPPORTED' });
    expect(pool.execute).not.toHaveBeenCalled();
    expect(pool.getConnection).not.toHaveBeenCalled();

    await store.close();
  });

  it('rejects addExperimentResult carrying a tool mock report', async () => {
    const store = newStore();
    const experiments = (await store.getStore('experiments')) as any;

    await expect(
      experiments.addExperimentResult({
        experimentId: 'e1',
        itemId: 'i1',
        toolMockReport: { served: [], unconsumed: [], liveCalls: [] },
      }),
    ).rejects.toThrow(/Tool mock reports are not supported on the MySQL storage adapter/);

    await store.close();
  });

  it('does not reject items without unsupported controls at the guard', async () => {
    const store = newStore();
    const datasets = (await store.getStore('datasets')) as any;

    // Without toolMocks or timeout, the call proceeds to stubbed DB access.
    let guardError: unknown;
    try {
      await datasets._doAddItem({ datasetId: 'd1', input: { q: 'hi' } });
    } catch (err) {
      guardError = err;
    }
    expect(String(guardError ?? '')).not.toMatch(
      /Tool mocks are not supported|Dataset item timeouts are not supported/,
    );

    await store.close();
  });
});
