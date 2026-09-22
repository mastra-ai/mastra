import type { ClickHouseClient } from '@clickhouse/client';
import {
  TABLE_MESSAGES,
  TABLE_SCHEMAS,
  TABLE_SPANS,
  TABLE_WORKFLOW_SNAPSHOT,
  TABLE_WORKFLOW_SNAPSHOT_HANDOFF,
} from '@mastra/core/storage';
import type { StorageColumn, TABLE_NAMES } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import { ClickhouseDB } from './index';

function createDb() {
  const client = {
    query: vi.fn(async () => undefined),
    command: vi.fn(async () => undefined),
  };

  return {
    client,
    db: new ClickhouseDB({ client: client as unknown as ClickHouseClient, ttl: {} }),
  };
}

describe('ClickhouseDB createTable', () => {
  it('quotes generated default key columns', async () => {
    const { client, db } = createDb();

    await db.createTable({
      tableName: TABLE_MESSAGES,
      schema: {
        id: { type: 'text' },
        createdAt: { type: 'timestamp' },
      },
    });

    const query = client.command.mock.calls[0]?.[0]?.query;
    expect(query).toContain('PRIMARY KEY ("createdAt", "id")');
    expect(query).toContain('ORDER BY ("createdAt", "id")');
  });

  it('quotes harness fallback key columns', async () => {
    const { client, db } = createDb();
    const schema: Record<string, StorageColumn> = {
      id: { type: 'text' },
      created_at: { type: 'bigint' },
    };

    await db.createTable({
      tableName: 'mastra_harness_future_table' as TABLE_NAMES,
      schema,
    });

    const query = client.command.mock.calls[0]?.[0]?.query;
    expect(query).toContain('PRIMARY KEY ("created_at")');
    expect(query).toContain('ORDER BY ("created_at")');
  });

  it('escapes generated key column identifiers using ClickHouse quoted identifier rules', async () => {
    const { client, db } = createDb();

    await db.createTable({
      tableName: 'mastra_harness_future_table' as TABLE_NAMES,
      schema: {
        'quote"key': { type: 'text', primaryKey: true },
      },
    });

    const query = client.command.mock.calls[0]?.[0]?.query;
    expect(query).toContain('PRIMARY KEY ("quote\\"key")');
    expect(query).toContain('ORDER BY ("quote\\"key")');
  });

  it('escapes backslashes in generated key column identifiers', async () => {
    const { client, db } = createDb();

    await db.createTable({
      tableName: 'mastra_harness_future_table' as TABLE_NAMES,
      schema: {
        'back\\slash': { type: 'text', primaryKey: true },
      },
    });

    const query = client.command.mock.calls[0]?.[0]?.query;
    expect(query).toContain('PRIMARY KEY ("back\\\\slash")');
    expect(query).toContain('ORDER BY ("back\\\\slash")');
  });

  it('quotes workflow snapshot key columns', async () => {
    const { client, db } = createDb();

    await db.createTable({
      tableName: TABLE_WORKFLOW_SNAPSHOT,
      schema: {
        createdAt: { type: 'timestamp' },
        run_id: { type: 'text' },
        workflow_name: { type: 'text' },
      },
    });

    const query = client.command.mock.calls[0]?.[0]?.query;
    expect(query).toContain('PRIMARY KEY ("createdAt", "run_id", "workflow_name")');
    expect(query).toContain('ORDER BY ("createdAt", "run_id", "workflow_name")');
  });

  it('quotes spans key columns', async () => {
    const { client, db } = createDb();

    await db.createTable({
      tableName: TABLE_SPANS,
      schema: {
        traceId: { type: 'text' },
        spanId: { type: 'text' },
        createdAt: { type: 'timestamp' },
        updatedAt: { type: 'timestamp', nullable: true },
      },
    });

    const query = client.command.mock.calls[0]?.[0]?.query;
    expect(query).toContain('PRIMARY KEY ("traceId", "spanId")');
    expect(query).toContain('ORDER BY ("traceId", "spanId")');
  });

  it('creates the handoff table with a supported ReplacingMergeTree version and identity key', async () => {
    const { client, db } = createDb();

    await db.createTable({
      tableName: TABLE_WORKFLOW_SNAPSHOT_HANDOFF,
      schema: TABLE_SCHEMAS[TABLE_WORKFLOW_SNAPSHOT_HANDOFF],
    });

    const query = client.command.mock.calls[0]?.[0]?.query;
    // ReplacingMergeTree version columns must be UInt*/Date/DateTime — the
    // shared bigint mapping would emit Int64, which ClickHouse rejects.
    expect(query).toContain('ENGINE = ReplacingMergeTree(updated_at)');
    expect(query).toContain('"updated_at" UInt64');
    expect(query).toContain('PRIMARY KEY ("workflow_name", "run_id")');
    expect(query).toContain('ORDER BY ("workflow_name", "run_id")');
  });
});

describe('ClickhouseDB load', () => {
  it('quotes condition key identifiers and uses stable query parameter names', async () => {
    const { client, db } = createDb();

    await db.load({
      tableName: 'mastra_harness_future_table' as TABLE_NAMES,
      keys: {
        'quote"key': 'value',
      },
    });

    const query = client.query.mock.calls[0]?.[0]?.query;
    expect(query).toContain('WHERE "quote\\"key" = {var_0:String}');
    expect(client.query.mock.calls[0]?.[0]?.query_params).toEqual({ var_0: 'value' });
  });
});

describe('ClickhouseDB DDL execution', () => {
  it('uses command for CREATE while keeping replication lookup on query', async () => {
    const query = vi.fn(async () => ({ json: async () => [] }));
    const command = vi.fn();
    const db = new ClickhouseDB({
      client: { query, command } as unknown as ClickHouseClient,
      ttl: undefined,
      replication: { cluster: 'cluster-a' },
    });

    await db.createTable({ tableName: TABLE_SPANS, schema: TABLE_SCHEMAS[TABLE_SPANS] });

    expect(query).toHaveBeenCalledOnce();
    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({ query: expect.stringContaining('FROM system.tables') }),
    );
    expect(command).toHaveBeenCalledOnce();
    expect(command).toHaveBeenCalledWith(
      expect.objectContaining({ query: expect.stringContaining('CREATE TABLE IF NOT EXISTS') }),
    );
  });

  it('uses query for DESCRIBE and command for ALTER', async () => {
    const query = vi.fn(async () => ({ json: async () => ({ data: [] }) }));
    const command = vi.fn();
    const db = new ClickhouseDB({
      client: { query, command } as unknown as ClickHouseClient,
      ttl: undefined,
    });

    await db.alterTable({
      tableName: TABLE_SPANS,
      schema: TABLE_SCHEMAS[TABLE_SPANS],
      ifNotExists: ['spanId'],
    });

    expect(query).toHaveBeenCalledOnce();
    expect(query).toHaveBeenCalledWith({ query: `DESCRIBE TABLE ${TABLE_SPANS}` });
    expect(command).toHaveBeenCalledOnce();
    expect(command).toHaveBeenCalledWith(expect.objectContaining({ query: expect.stringContaining('ALTER TABLE') }));
  });

  it('uses command for DROP', async () => {
    const query = vi.fn();
    const command = vi.fn();
    const db = new ClickhouseDB({
      client: { query, command } as unknown as ClickHouseClient,
      ttl: undefined,
    });

    await db.dropTable({ tableName: TABLE_SPANS });

    expect(query).not.toHaveBeenCalled();
    expect(command).toHaveBeenCalledOnce();
    expect(command).toHaveBeenCalledWith({ query: `DROP TABLE IF EXISTS ${TABLE_SPANS}` });
  });
});
