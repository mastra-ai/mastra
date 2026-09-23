import { createClient } from '@libsql/client';
import { OLD_SPAN_SCHEMA, TABLE_SCHEMAS, TABLE_SPANS } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';
import { LibSQLDB } from './index';

const ROOTS_INDEX = 'mastra_ai_spans_roots_started_at_idx';
const TRACE_INDEX = 'mastra_ai_spans_trace_started_at_idx';

describe('LibSQLDB spans read indexes', () => {
  it('creates the trace read indexes when the unique index is absent', async () => {
    const calls: string[] = [];
    const mockClient = {
      execute: vi.fn(async (statement: string | { sql: string }) => {
        const sql = typeof statement === 'string' ? statement : statement.sql;
        calls.push(sql);
        if (/PRAGMA\s+table_info/i.test(sql)) {
          return { rows: Object.keys(OLD_SPAN_SCHEMA).map(name => ({ name })), rowsAffected: 0 };
        }
        if (/sqlite_master/i.test(sql)) {
          return { rows: [], rowsAffected: 0 };
        }
        if (/duplicate_count/i.test(sql)) {
          return { rows: [{ duplicate_count: 0 }], rowsAffected: 0 };
        }
        return { rows: [], rowsAffected: 0 };
      }),
    };

    const db = new LibSQLDB({ client: mockClient as any });
    await db.createTable({ tableName: TABLE_SPANS, schema: TABLE_SCHEMAS[TABLE_SPANS] });

    expect(calls.some(sql => sql.includes(`CREATE INDEX IF NOT EXISTS "${ROOTS_INDEX}"`))).toBe(true);
    expect(calls.some(sql => sql.includes(`CREATE INDEX IF NOT EXISTS "${TRACE_INDEX}"`))).toBe(true);
  });

  it('creates the trace read indexes even when the unique index already exists', async () => {
    const calls: string[] = [];
    const mockClient = {
      execute: vi.fn(async (statement: string | { sql: string }) => {
        const sql = typeof statement === 'string' ? statement : statement.sql;
        calls.push(sql);
        if (/PRAGMA\s+table_info/i.test(sql)) {
          return { rows: Object.keys(TABLE_SCHEMAS[TABLE_SPANS]).map(name => ({ name })), rowsAffected: 0 };
        }
        // Unique index already present -> dedup/unique-index guard is skipped.
        if (/sqlite_master/i.test(sql)) {
          return { rows: [{ 1: 1 }], rowsAffected: 0 };
        }
        return { rows: [], rowsAffected: 0 };
      }),
    };

    const db = new LibSQLDB({ client: mockClient as any });
    await db.createTable({ tableName: TABLE_SPANS, schema: TABLE_SCHEMAS[TABLE_SPANS] });

    expect(calls.some(sql => sql.includes(`CREATE INDEX IF NOT EXISTS "${ROOTS_INDEX}"`))).toBe(true);
    expect(calls.some(sql => sql.includes(`CREATE INDEX IF NOT EXISTS "${TRACE_INDEX}"`))).toBe(true);
  });

  it('produces query plans without full scans or temporary sorts for trace reads', async () => {
    const client = createClient({ url: ':memory:' });
    const db = new LibSQLDB({ client });
    await db.createTable({ tableName: TABLE_SPANS, schema: TABLE_SCHEMAS[TABLE_SPANS] });

    const listPlan = await client.execute(
      `EXPLAIN QUERY PLAN SELECT * FROM ${TABLE_SPANS} WHERE parentSpanId IS NULL ORDER BY startedAt DESC LIMIT 20`,
    );
    const detailPlan = await client.execute(
      `EXPLAIN QUERY PLAN SELECT * FROM ${TABLE_SPANS} WHERE traceId = 'trace-1' ORDER BY startedAt ASC`,
    );

    const listLines = listPlan.rows.map(r => String(r.detail));
    const detailLines = detailPlan.rows.map(r => String(r.detail));

    expect(listLines.some(l => l.includes('USE TEMP B-TREE'))).toBe(false);
    expect(listLines.some(l => l.includes(ROOTS_INDEX))).toBe(true);

    expect(detailLines.some(l => l.includes('USE TEMP B-TREE'))).toBe(false);
    expect(detailLines.some(l => l.includes(TRACE_INDEX))).toBe(true);

    client.close();
  });
});
