import { TABLE_MESSAGES, TABLE_SCHEMAS, TABLE_THREADS } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import { OracleDB } from '.';

function createDb(connectionOverrides: Record<string, unknown> = {}) {
  const connection = {
    execute: vi.fn(async () => ({ rows: [] })),
    executeMany: vi.fn(async () => ({ rowsAffected: 1 })),
    commit: vi.fn(async () => undefined),
    rollback: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
    ...connectionOverrides,
  };
  const poolManager = {
    withConnection: vi.fn(async callback => callback(connection)),
  };

  return { db: new OracleDB({ poolManager: poolManager as any }), connection };
}

describe('OracleDB facade', () => {
  it('executes query, write, row cardinality, and transaction helpers', async () => {
    const { db, connection } = createDb();
    connection.execute
      .mockResolvedValueOnce({ rows: [{ id: 'row-1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'only-row' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'many-1' }, { id: 'many-2' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'tx-row' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'too-many-1' }, { id: 'too-many-2' }] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(db.execute('SELECT * FROM test')).resolves.toEqual([{ id: 'row-1' }]);
    await expect(db.one('SELECT one FROM test')).resolves.toEqual({ id: 'only-row' });
    await expect(db.oneOrNone('SELECT none FROM test')).resolves.toBeNull();
    await expect(db.manyOrNone('SELECT many FROM test')).resolves.toHaveLength(2);
    await expect(db.none('UPDATE test SET id = :id', { id: 'row-1' })).resolves.toBeUndefined();

    await expect(
      db.tx(async client => {
        await client.none('UPDATE test SET id = :id', { id: 'tx-row' });
        return client.one('SELECT tx FROM test');
      }),
    ).resolves.toEqual({ id: 'tx-row' });

    await expect(db.oneOrNone('SELECT duplicate FROM test')).rejects.toThrow(/zero or one row/);
    await expect(db.one('SELECT missing FROM test')).rejects.toThrow(/exactly one row/);
    await expect(
      db.tx(async () => {
        throw new Error('rollback me');
      }),
    ).rejects.toThrow(/rollback me/);

    expect(connection.commit).toHaveBeenCalledTimes(2);
    expect(connection.rollback).toHaveBeenCalledOnce();
  });

  it('rolls back failed bulk writes and creates custom indexes through the facade', async () => {
    const bulkError = new Error('bulk write failed');
    const { db, connection } = createDb({
      executeMany: vi.fn(async () => {
        throw bulkError;
      }),
    });

    await expect(db.executeMany('INSERT INTO test VALUES (:id)', [{ id: 'row-1' }], {})).rejects.toThrow(
      /bulk write failed/i,
    );
    expect(connection.rollback).toHaveBeenCalledOnce();

    connection.executeMany = vi.fn(async () => ({ rowsAffected: 1 }));
    await expect(
      db.createIndex({
        name: 'THREAD_RESOURCE_CREATED_IDX',
        table: TABLE_THREADS,
        columns: ['resourceId ASC', 'createdAt DESC'],
        online: true,
        invisible: true,
        noLogging: true,
        parallel: true,
        compress: true,
      }),
    ).resolves.toBeUndefined();

    const ddl = String(connection.execute.mock.calls.at(-1)?.[0]);
    expect(ddl).toContain('CREATE INDEX "THREAD_RESOURCE_CREATED_IDX"');
    expect(ddl).toContain('"resourceId" ASC');
    expect(ddl).toContain('"createdAt" DESC');
    expect(ddl).toContain('COMPRESS');
    expect(ddl).toContain('NOLOGGING PARALLEL ONLINE INVISIBLE');
  });

  it('propagates ORA-01408 instead of silently skipping a custom index request', async () => {
    const ora01408 = Object.assign(new Error('ORA-01408: such column list already indexed'), { errorNum: 1408 });
    const { db } = createDb({
      execute: vi.fn(async () => {
        throw ora01408;
      }),
    });

    // A custom index requesting different visibility/compression than an existing
    // index on the same columns must abort init, not be swallowed like ORA-00955.
    await expect(
      db.createIndex({
        name: 'idx_custom_visibility',
        table: TABLE_THREADS,
        columns: ['resourceId'],
        invisible: true,
      }),
    ).rejects.toThrow(/ORA-01408/);
  });

  it('executes bulk, DDL, schema, and generic table operations', async () => {
    const thread = {
      id: 'thread-1',
      resourceId: 'resource-1',
      title: 'Thread',
      metadata: { topic: 'coverage' },
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    const { db, connection } = createDb({
      execute: vi.fn(async (sql: string) => {
        if (sql.includes('all_tab_columns')) return { rows: [{ exists: 1 }] };
        if (sql.startsWith('SELECT *')) return { rows: [thread] };
        return { rows: [] };
      }),
    });

    await expect(db.executeMany('INSERT INTO test VALUES (:id)', [], {})).resolves.toBeUndefined();
    await expect(db.executeMany('INSERT INTO test VALUES (:id)', [{ id: 'row-1' }], {})).resolves.toEqual({
      rowsAffected: 1,
    });
    await expect(db.executeDdl('CREATE TABLE local_test (id VARCHAR2(32))')).resolves.toBeUndefined();
    await expect(db.hasColumn(TABLE_THREADS, 'resourceId')).resolves.toBe(true);
    await expect(
      db.createTable({ tableName: TABLE_THREADS, schema: TABLE_SCHEMAS[TABLE_THREADS] }),
    ).resolves.toBeUndefined();
    await expect(
      db.alterTable({
        tableName: TABLE_THREADS,
        schema: TABLE_SCHEMAS[TABLE_THREADS],
        ifNotExists: ['title', 'missingColumn'],
      }),
    ).resolves.toBeUndefined();
    await expect(
      db.insert({ tableName: TABLE_THREADS, schema: TABLE_SCHEMAS[TABLE_THREADS], record: thread }),
    ).resolves.toBeUndefined();
    await expect(
      db.batchInsert({ tableName: TABLE_THREADS, schema: TABLE_SCHEMAS[TABLE_THREADS], records: [thread] }),
    ).resolves.toBeUndefined();
    await expect(
      db.update({
        tableName: TABLE_THREADS,
        schema: TABLE_SCHEMAS[TABLE_THREADS],
        keys: { id: 'thread-1' },
        data: { title: 'Updated', metadata: { topic: 'updated' } },
      }),
    ).resolves.toBeUndefined();
    await expect(
      db.batchUpdate({
        tableName: TABLE_THREADS,
        schema: TABLE_SCHEMAS[TABLE_THREADS],
        updates: [{ keys: { id: 'thread-1' }, data: { title: 'Batch updated' } }],
      }),
    ).resolves.toBeUndefined();
    await expect(db.batchDelete({ tableName: TABLE_THREADS, keys: [] })).resolves.toBeUndefined();
    await expect(
      db.batchDelete({ tableName: TABLE_THREADS, keys: [{ id: 'thread-1', title: null }] }),
    ).resolves.toBeUndefined();
    await expect(
      db.merge({
        tableName: TABLE_THREADS,
        schema: TABLE_SCHEMAS[TABLE_THREADS],
        keys: ['id'],
        record: thread,
      }),
    ).resolves.toBeUndefined();
    await expect(
      db.load({ tableName: TABLE_THREADS, schema: TABLE_SCHEMAS[TABLE_THREADS], keys: { id: 'thread-1' } }),
    ).resolves.toEqual(thread);
    await expect(db.clearTable(TABLE_THREADS)).resolves.toBeUndefined();
    await expect(db.dropTable(TABLE_THREADS)).resolves.toBeUndefined();

    await expect(
      db.merge({ tableName: TABLE_THREADS, schema: TABLE_SCHEMAS[TABLE_THREADS], keys: [], record: thread }),
    ).rejects.toThrow(/at least one key/);
    await expect(
      db.load({ tableName: TABLE_THREADS, schema: TABLE_SCHEMAS[TABLE_THREADS], keys: {} }),
    ).rejects.toThrow(/At least one key/);
    await expect(
      db.load({
        tableName: TABLE_THREADS,
        schema: TABLE_SCHEMAS[TABLE_THREADS],
        keys: { id: 'thread-1' },
        orderBy: ' ORDER BY title ASC',
      }),
    ).resolves.toEqual(thread);

    expect(connection.executeMany).toHaveBeenCalledOnce();
    expect(connection.commit).toHaveBeenCalled();
  });

  it('handles schema-qualified column checks, no-op writes, and merge edge cases', async () => {
    const connection = {
      execute: vi.fn(async (sql: string) => {
        if (sql.includes('all_tab_columns')) return { rows: [] };
        return { rows: [] };
      }),
      executeMany: vi.fn(async () => ({ rowsAffected: 1 })),
      commit: vi.fn(async () => undefined),
      rollback: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined),
    };
    const poolManager = {
      withConnection: vi.fn(async callback => callback(connection)),
    };
    const db = new OracleDB({ poolManager: poolManager as any, schemaName: 'APP_SCHEMA' });

    await expect(db.hasColumn(TABLE_THREADS, 'resourceId')).resolves.toBe(false);
    expect(connection.execute.mock.calls[0]?.[1]).toMatchObject({
      ownerName: 'APP_SCHEMA',
      tableName: 'MASTRA_THREADS',
    });

    await expect(
      db.alterTable({
        tableName: TABLE_THREADS,
        schema: TABLE_SCHEMAS[TABLE_THREADS],
        ifNotExists: ['title'],
      }),
    ).resolves.toBeUndefined();
    expect(connection.execute.mock.calls.some(call => String(call[0]).includes('ALTER TABLE'))).toBe(true);

    await expect(
      db.insert({ tableName: TABLE_THREADS, schema: TABLE_SCHEMAS[TABLE_THREADS], record: {} }),
    ).resolves.toBeUndefined();
    await expect(
      db.update({
        tableName: TABLE_THREADS,
        schema: TABLE_SCHEMAS[TABLE_THREADS],
        keys: { id: 'thread-1' },
        data: {},
      }),
    ).resolves.toBeUndefined();
    await expect(
      db.merge({
        tableName: TABLE_THREADS,
        schema: TABLE_SCHEMAS[TABLE_THREADS],
        keys: ['id'],
        record: { title: 'missing id' },
      }),
    ).rejects.toThrow(/missing key column id/i);

    await expect(
      db.merge({
        tableName: TABLE_THREADS,
        schema: TABLE_SCHEMAS[TABLE_THREADS],
        keys: ['id'],
        record: { id: 'thread-1' },
      }),
    ).resolves.toBeUndefined();
    const mergeSql = String(connection.execute.mock.calls.at(-1)?.[0]);
    expect(mergeSql).toContain('WHEN NOT MATCHED');
    expect(mergeSql).not.toContain('WHEN MATCHED THEN UPDATE');
  });

  it('prepares schema-default values and rejects unsafe column identifiers', async () => {
    const { db, connection } = createDb();
    const now = new Date('2026-01-01T00:00:00.000Z');

    await expect(
      db.insert({
        tableName: TABLE_THREADS,
        record: {
          id: 'thread-2',
          resourceId: 'resource-2',
          title: 'Thread 2',
          metadata: null,
          createdAt: now,
        },
      }),
    ).resolves.toBeUndefined();
    await expect(
      db.insert({
        tableName: TABLE_MESSAGES,
        record: {
          id: 'message-1',
          thread_id: 'thread-2',
          content: 'A long message',
          role: 'user',
          type: 'text',
          createdAt: now,
        },
      }),
    ).resolves.toBeUndefined();
    await expect(
      db.insert({
        tableName: TABLE_THREADS,
        schema: {
          id: { type: 'text', primaryKey: true },
          activeObservations: { type: 'text' },
          config: { type: 'jsonb' },
          isObserving: { type: 'boolean' },
          isReflecting: { type: 'boolean' },
        } as any,
        record: {
          id: 'observation-1',
          activeObservations: 'observed',
          config: { mode: 'unit' },
          isObserving: true,
          isReflecting: false,
        },
      }),
    ).resolves.toBeUndefined();
    await expect(
      db.update({
        tableName: TABLE_THREADS,
        keys: { id: 'thread-2', updatedAt: now },
        data: { title: 'Updated 2' },
      }),
    ).resolves.toBeUndefined();

    const binds = connection.execute.mock.calls.map(call => call[1] as Record<string, unknown>);
    const bindValues = binds.flatMap(bind => Object.values(bind));
    expect(bindValues).toContain(null);
    expect(bindValues.filter(value => value && typeof value === 'object' && 'type' in value)).toHaveLength(3);
    expect(binds.some(bind => Object.values(bind).includes(1) && Object.values(bind).includes(0))).toBe(true);
    expect(bindValues).toContain(now);

    await expect(db.hasColumn(TABLE_THREADS, 'bad-column')).rejects.toThrow(/column name/i);
    await expect(db.insert({ tableName: TABLE_THREADS, record: { 'bad-column': 'bad' } })).rejects.toThrow(
      /column name/i,
    );
  });
});
