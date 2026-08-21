import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { connect } from '@tursodatabase/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TursoError } from './errors';
import { fromColumnValue, fromRow, toBindParams, toBindValue } from './values';

describe('bind value normalization', () => {
  it.each([
    ['undefined', undefined, null],
    ['null', null, null],
    ['true', true, 1],
    ['false', false, 0],
    ['string', 'x', 'x'],
    ['number', 1.5, 1.5],
    ['bigint', 9007199254740993n, 9007199254740993n],
  ])('normalizes %s', (_label, input, expected) => {
    expect(toBindValue(input as never, 'p')).toBe(expected);
  });

  it('converts Date to epoch milliseconds so it stays sortable', () => {
    expect(toBindValue(new Date('2020-01-02T03:04:05.678Z'), 'p')).toBe(1577934245678);
  });

  it('passes Uint8Array through as a blob', () => {
    const bytes = new Uint8Array([1, 2, 3]);
    expect(toBindValue(bytes, 'p')).toBe(bytes);
  });

  it.each([
    ['NaN', NaN],
    ['Infinity', Infinity],
    ['-Infinity', -Infinity],
  ])('rejects %s rather than silently storing NULL', (_label, input) => {
    expect(() => toBindValue(input, 'p')).toThrow(TursoError);
    expect(() => toBindValue(input, 'p')).toThrow(/non-finite/);
  });

  it('rejects an invalid Date', () => {
    expect(() => toBindValue(new Date('nope'), 'p')).toThrow(/invalid Date/);
  });

  it.each([
    ['plain object', {}],
    ['array', [1]],
    ['function', () => {}],
  ])('rejects an unsupported %s instead of stringifying it', (_label, input) => {
    expect(() => toBindValue(input as never, 'p')).toThrow(/Cannot bind value of type/);
  });

  it('names the offending parameter', () => {
    expect(() => toBindParams([1, NaN])).toThrow(/parameter 2/);
    expect(() => toBindParams({ a: 1, b: NaN })).toThrow(/parameter 'b'/);
  });

  it('preserves positional vs named form', () => {
    expect(toBindParams([true, undefined])).toEqual([1, null]);
    expect(toBindParams({ a: true, b: undefined })).toEqual({ a: 1, b: null });
    expect(toBindParams(undefined)).toBeUndefined();
  });
});

describe('column value normalization', () => {
  it('narrows safe-range bigints to number', () => {
    expect(fromColumnValue(42n)).toBe(42);
    expect(typeof fromColumnValue(42n)).toBe('number');
  });

  it('keeps bigints beyond the safe range as bigint', () => {
    expect(fromColumnValue(9007199254740993n)).toBe(9007199254740993n);
  });

  it('maps null and undefined to null', () => {
    expect(fromColumnValue(null)).toBeNull();
    expect(fromColumnValue(undefined)).toBeNull();
  });

  it('normalizes a full row', () => {
    expect(fromRow({ a: 1n, b: 'x', c: null })).toEqual({ a: 1, b: 'x', c: null });
  });
});

/**
 * The unit tests above encode intent; these prove the intent survives contact
 * with the engine, which is where the silent coercions actually happen.
 */
describe('round trip through the real Turso engine', () => {
  let dir: string;
  let db: Awaited<ReturnType<typeof connect>>;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'mastra-turso-values-'));
    db = await connect(join(dir, 'test.db'));
    db.defaultSafeIntegers(true);
    await db.exec(`CREATE TABLE v (k TEXT PRIMARY KEY, val)`);
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const store = async (key: string, value: unknown) => {
    await db.prepare(`INSERT INTO v VALUES (?, ?)`).run([key, toBindValue(value as never, 'p')]);
    const row = (await db.prepare(`SELECT val, typeof(val) AS ty FROM v WHERE k = ?`).all([key]))[0] as {
      val: unknown;
      ty: string;
    };
    return { value: fromColumnValue(row.val), sqliteType: row.ty };
  };

  it('stores undefined as SQL NULL, not the text "undefined"', async () => {
    // Unnormalized, the driver writes the string "undefined" as TEXT.
    expect(await store('undef', undefined)).toEqual({ value: null, sqliteType: 'null' });
  });

  it('stores Date as an integer that round-trips exactly', async () => {
    const date = new Date('2020-01-02T03:04:05.678Z');
    const result = await store('date', date);

    expect(result.sqliteType).toBe('integer');
    expect(result.value).toBe(date.getTime());
    expect(new Date(result.value as number).toISOString()).toBe(date.toISOString());
  });

  it('preserves an integer beyond 2^53 exactly', async () => {
    const big = 9007199254740993n;
    const result = await store('big', big);

    expect(result.sqliteType).toBe('integer');
    expect(result.value).toBe(big);

    // Confirm against the engine itself, not just the JS read path.
    const [exact] = (await db.prepare(`SELECT val = 9007199254740993 AS ok FROM v WHERE k = 'big'`).all()) as {
      ok: number | bigint;
    }[];
    expect(Number(exact.ok)).toBe(1);
  });

  it('stores booleans as integers and reads them back', async () => {
    expect(await store('t', true)).toEqual({ value: 1, sqliteType: 'integer' });
    expect(await store('f', false)).toEqual({ value: 0, sqliteType: 'integer' });
  });

  it('round-trips a blob', async () => {
    const result = await store('blob', new Uint8Array([1, 2, 3]));
    expect(result.sqliteType).toBe('blob');
    expect(Array.from(result.value as Uint8Array)).toEqual([1, 2, 3]);
  });
});
