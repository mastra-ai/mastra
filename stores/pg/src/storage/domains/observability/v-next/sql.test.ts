import { describe, expect, it, vi } from 'vitest';
import type { DbClient } from '../../../client';
import { buildInsert, insertRows } from './sql';

const LONE_SURROGATE = /\\ud[89ab][0-9a-f]{2}/i;

function jsonbValue(record: Record<string, unknown>): string | null {
  const insert = buildInsert('public', 'mastra_span_events', [record]);
  const index = Object.keys(record).indexOf('input');
  return insert!.values[index] as string | null;
}

describe('buildInsert jsonb encoding', () => {
  it('returns null for empty input', () => {
    expect(buildInsert('public', 'mastra_span_events', [])).toBeNull();
  });

  it('casts jsonb and text[] columns explicitly', () => {
    const insert = buildInsert('public', 'mastra_span_events', [{ traceId: 't1', input: { a: 1 }, tags: ['x'] }])!;

    expect(insert.text).toContain('$2::jsonb');
    expect(insert.text).toContain('$3::text[]');
    expect(insert.text).toContain('ON CONFLICT DO NOTHING');
    expect(insert.values[0]).toBe('t1');
    expect(insert.values[2]).toEqual(['x']);
  });

  it('encodes null and undefined jsonb values as SQL null', () => {
    expect(jsonbValue({ traceId: 't1', input: null })).toBeNull();
    expect(jsonbValue({ traceId: 't1', input: undefined })).toBeNull();
  });

  it('strips NUL characters that PostgreSQL rejects with 22P05', () => {
    const encoded = jsonbValue({ traceId: 't1', input: { text: 'before\u0000after' } })!;

    expect(encoded).not.toContain('\\u0000');
    expect(JSON.parse(encoded)).toEqual({ text: 'beforeafter' });
  });

  it('repairs unpaired surrogates that PostgreSQL rejects with 22P02', () => {
    const encoded = jsonbValue({ traceId: 't1', input: { text: 'a\ud83db' } })!;

    expect(LONE_SURROGATE.test(encoded)).toBe(false);
    expect(JSON.parse(encoded)).toEqual({ text: 'a�b' });
  });

  it('preserves valid Unicode and escapes', () => {
    const value = { text: 'emoji 😀 done\nline\ttab back\\slash "quoted"' };
    const encoded = jsonbValue({ traceId: 't1', input: value })!;

    expect(JSON.parse(encoded)).toEqual(value);
  });

  it('preserves a real backslash before an invalid character and literal Unicode escape text', () => {
    const input = { path: 'C:\\path\\\uD800-end', literal: String.raw`literal\uD800` };
    expect(JSON.parse(jsonbValue({ traceId: 't1', input })!)).toEqual({
      path: 'C:\\path\\�-end',
      literal: input.literal,
    });
  });

  it('preserves a plain string as a valid JSON scalar', () => {
    expect(jsonbValue({ traceId: 't1', input: 'hello' })).toBe('"hello"');
  });
});

describe('insertRows partition recovery', () => {
  const missingPartition = Object.assign(new Error('no partition of relation "mastra_span_events" found for row'), {
    code: '23514',
    routine: 'ExecFindPartition',
  });
  const row = { traceId: 't1', spanId: 's1', endedAt: new Date() };

  function clientThatLacksTodaysPartition(installedExtensions: string[] = []) {
    const query = vi.fn().mockRejectedValueOnce(missingPartition).mockResolvedValue({ rows: [] });
    const none = vi.fn(async () => {});
    const tx = vi.fn(async (fn: (t: { none: typeof none }) => Promise<void>) => fn({ none }));
    const manyOrNone = vi.fn(async (): Promise<{ relname: string }[]> => []);
    const oneOrNone = vi.fn(async (sql: string) => ({
      exists: installedExtensions.some(extension => sql.includes(`'${extension}'`)),
    }));
    return {
      client: { query, tx, manyOrNone, oneOrNone } as unknown as DbClient,
      query,
      tx,
      none,
      manyOrNone,
      oneOrNone,
    };
  }

  it('creates the day and retries once in native mode', async () => {
    const { client, query, tx } = clientThatLacksTodaysPartition();
    await expect(insertRows(client, 'obs', 'mastra_span_events', [row], { mode: 'native' })).resolves.toBeUndefined();
    expect(tx).toHaveBeenCalledOnce();
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('leaves pg_partman-managed tables alone and rethrows the original error', async () => {
    const { client, query, tx } = clientThatLacksTodaysPartition();
    await expect(insertRows(client, 'obs', 'mastra_span_events', [row], { mode: 'partman' })).rejects.toBe(
      missingPartition,
    );
    expect(tx).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledOnce();
  });

  it('detects the mode itself for a store that never ran init() and creates the day on plain Postgres', async () => {
    const { client, tx, oneOrNone } = clientThatLacksTodaysPartition();
    await expect(insertRows(client, 'obs', 'mastra_span_events', [row], {})).resolves.toBeUndefined();
    expect(oneOrNone).toHaveBeenCalled();
    expect(tx).toHaveBeenCalledOnce();
  });

  it('detects pg_partman for a store that never ran init() and leaves the table alone', async () => {
    const { client, tx } = clientThatLacksTodaysPartition(['pg_partman']);
    await expect(insertRows(client, 'obs', 'mastra_span_events', [row], {})).rejects.toBe(missingPartition);
    expect(tx).not.toHaveBeenCalled();
  });

  it('names the table, the day it could not create, and the fix, and keeps the database error as the cause', async () => {
    const { client, none, manyOrNone } = clientThatLacksTodaysPartition();
    const yesterday = new Date(row.endedAt.getTime() - 86_400_000);
    const day = (d: Date) => d.toISOString().slice(0, 10);
    manyOrNone.mockResolvedValue([{ relname: `mastra_span_events_p${day(yesterday).replace(/-/g, '')}` }]);
    const notOwner = Object.assign(new Error('must be owner of table mastra_span_events'), { code: '42501' });
    none.mockRejectedValue(notOwner);

    const write = insertRows(client, 'obs', 'mastra_span_events', [{ ...row, spanId: 's0', endedAt: yesterday }, row], {
      mode: 'native',
    });

    await expect(write).rejects.toThrow(
      `mastra_span_events partition for ${day(row.endedAt)} (UTC): must be owner of table mastra_span_events`,
    );
    await expect(write).rejects.toThrow('ensurePartitions()');
    await expect(write).rejects.toMatchObject({
      message: expect.not.stringContaining(day(yesterday)),
      cause: notOwner,
    });
  });

  it('passes a DDL failure that is not a privilege error through unchanged', async () => {
    const { client, none } = clientThatLacksTodaysPartition();
    const lockTimeout = Object.assign(new Error('canceling statement due to lock timeout'), { code: '55P03' });
    none.mockRejectedValue(lockTimeout);

    await expect(insertRows(client, 'obs', 'mastra_span_events', [row], { mode: 'native' })).rejects.toBe(lockTimeout);
  });

  it('does not detect again when the store already resolved its mode', async () => {
    const { client, oneOrNone } = clientThatLacksTodaysPartition();
    await insertRows(client, 'obs', 'mastra_span_events', [row], { mode: 'native' });
    expect(oneOrNone).not.toHaveBeenCalled();
  });
});
