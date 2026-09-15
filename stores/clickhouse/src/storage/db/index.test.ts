import type { ClickHouseClient } from '@clickhouse/client';
import { TABLE_SCHEMAS, TABLE_SPANS } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';
import { ClickhouseDB } from './index';

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
