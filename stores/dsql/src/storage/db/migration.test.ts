import { describe, expect, it, vi } from 'vitest';
import { DsqlDB } from '.';

describe('DsqlDB span migrations', () => {
  it('backfills startedAtZ from startedAt in bounded batches', async () => {
    const client = {
      none: vi.fn().mockResolvedValue(undefined),
      oneOrNone: vi.fn().mockResolvedValue({ exists: 1 }),
      query: vi.fn().mockResolvedValueOnce({ rowCount: 1000 }).mockResolvedValueOnce({ rowCount: 4 }),
    };
    const db = new DsqlDB({ client: client as any, schemaName: 'retention_test' });

    await (db as any).migrateSpansTable();

    expect(client.query).toHaveBeenCalledTimes(2);
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE "retention_test"."mastra_ai_spans"'));
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('LIMIT 1000'));
  });
});
