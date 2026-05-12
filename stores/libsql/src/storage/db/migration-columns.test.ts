import { OLD_SPAN_SCHEMA, TABLE_SCHEMAS, TABLE_SPANS } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';
import { LibSQLDB } from './index';

describe('LibSQLDB span column migration', () => {
  it('inspects spans columns once while migrating missing columns', async () => {
    const calls: string[] = [];
    const mockClient = {
      execute: vi.fn(async (statement: string | { sql: string }) => {
        const sql = typeof statement === 'string' ? statement : statement.sql;
        calls.push(sql);
        if (/PRAGMA\s+table_info/i.test(sql)) {
          return {
            rows: Object.keys(OLD_SPAN_SCHEMA).map(name => ({ name })),
            rowsAffected: 0,
          };
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

    const mockDbOps = new LibSQLDB({ client: mockClient as any });
    await mockDbOps.createTable({ tableName: TABLE_SPANS, schema: TABLE_SCHEMAS[TABLE_SPANS] });

    const tableInfoCalls = calls.filter(sql => /PRAGMA\s+table_info\("mastra_ai_spans"\)/i.test(sql));
    expect(tableInfoCalls).toHaveLength(1);
    expect(calls.some(sql => /ALTER TABLE "mastra_ai_spans" ADD COLUMN "entityType"/i.test(sql))).toBe(true);
  });
});
