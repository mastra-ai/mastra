import { describe, expect, it } from 'vitest';
import {
  buildCreateTable,
  buildDelete,
  buildInsert,
  buildSelect,
  buildUpdate,
  buildWhere,
  quoteIdentifier,
  sqlTypeFor,
} from './sql';

describe('quoteIdentifier', () => {
  it('quotes an identifier', () => {
    expect(quoteIdentifier('threads')).toBe('"threads"');
  });

  it('escapes embedded double quotes so an identifier cannot break out', () => {
    expect(quoteIdentifier('a"b')).toBe('"a""b"');
  });
});

describe('sqlTypeFor', () => {
  it.each([
    ['text', 'TEXT'],
    ['uuid', 'TEXT'],
    ['timestamp', 'TEXT'],
    ['jsonb', 'TEXT'],
    ['integer', 'INTEGER'],
    ['bigint', 'BIGINT'],
    ['float', 'REAL'],
    ['boolean', 'INTEGER'],
  ] as const)('maps %s to %s', (type, expected) => {
    expect(sqlTypeFor(type)).toBe(expected);
  });
});

describe('buildCreateTable', () => {
  it('declares a single-column primary key inline', () => {
    const sql = buildCreateTable('t', {
      id: { type: 'text', primaryKey: true },
      name: { type: 'text' },
    });

    expect(sql).toBe('CREATE TABLE IF NOT EXISTS "t" ("id" TEXT PRIMARY KEY, "name" TEXT)');
  });

  it('declares a composite primary key as a table constraint', () => {
    const sql = buildCreateTable('t', {
      a: { type: 'text', primaryKey: true },
      b: { type: 'text', primaryKey: true },
    });

    // Inline PRIMARY KEY on each column would create two separate keys.
    expect(sql).toContain('PRIMARY KEY ("a", "b")');
    expect(sql).not.toContain('"a" TEXT PRIMARY KEY');
  });

  it('emits NOT NULL only when nullable is explicitly false', () => {
    const sql = buildCreateTable('t', {
      required: { type: 'text', nullable: false },
      optional: { type: 'text', nullable: true },
      unspecified: { type: 'text' },
    });

    expect(sql).toContain('"required" TEXT NOT NULL');
    expect(sql).toContain('"optional" TEXT,');
    expect(sql).not.toContain('"unspecified" TEXT NOT NULL');
  });
});

describe('buildInsert', () => {
  it('binds values as parameters rather than inlining them', () => {
    const statement = buildInsert('t', { id: 'a', n: 1 });

    expect(statement.sql).toBe('INSERT INTO "t" ("id", "n") VALUES (?, ?)');
    expect(statement.params).toEqual(['a', 1]);
  });

  it('supports INSERT OR IGNORE', () => {
    expect(buildInsert('t', { id: 'a' }, { onConflict: 'ignore' }).sql).toMatch(/^INSERT OR IGNORE INTO "t"/);
  });

  it('builds an upsert that refreshes non-key columns', () => {
    const statement = buildInsert('t', { id: 'a', n: 1, m: 2 }, { upsertOn: ['id'] });

    expect(statement.sql).toContain('ON CONFLICT ("id") DO UPDATE SET');
    expect(statement.sql).toContain('"n" = excluded."n"');
    expect(statement.sql).toContain('"m" = excluded."m"');
    // The conflict target identifies the row and must not be reassigned.
    expect(statement.sql).not.toContain('"id" = excluded."id"');
  });

  it('degrades to DO NOTHING when every column is part of the key', () => {
    const statement = buildInsert('t', { id: 'a' }, { upsertOn: ['id'] });
    expect(statement.sql).toContain('DO NOTHING');
  });

  it('rejects an empty record', () => {
    expect(() => buildInsert('t', {})).toThrow(/empty record/);
  });
});

describe('buildWhere', () => {
  it('returns an empty clause when there are no filters', () => {
    expect(buildWhere({})).toEqual({ sql: '', params: [] });
  });

  it('uses IS NULL for null, since = NULL never matches', () => {
    const where = buildWhere({ a: null });

    expect(where.sql).toBe(' WHERE "a" IS NULL');
    expect(where.params).toEqual([]);
  });

  it('skips undefined filters', () => {
    const where = buildWhere({ a: 1, b: undefined });

    expect(where.sql).toBe(' WHERE "a" = ?');
    expect(where.params).toEqual([1]);
  });

  it('joins multiple conditions with AND', () => {
    const where = buildWhere({ a: 1, b: 'x' });

    expect(where.sql).toBe(' WHERE "a" = ? AND "b" = ?');
    expect(where.params).toEqual([1, 'x']);
  });
});

describe('buildSelect', () => {
  it('selects every column by default', () => {
    expect(buildSelect('t').sql).toBe('SELECT * FROM "t"');
  });

  it('applies projection, filters, ordering and limit', () => {
    const statement = buildSelect('t', { a: 1 }, { columns: ['id'], orderBy: '"id" DESC', limit: 10 });

    expect(statement.sql).toBe('SELECT "id" FROM "t" WHERE "a" = ? ORDER BY "id" DESC LIMIT 10');
    expect(statement.params).toEqual([1]);
  });

  it('emits a sentinel LIMIT when offset is used alone, which SQLite requires', () => {
    expect(buildSelect('t', {}, { offset: 5 }).sql).toBe('SELECT * FROM "t" LIMIT -1 OFFSET 5');
  });

  it('coerces pagination values to numbers', () => {
    const statement = buildSelect('t', {}, { limit: '5; DROP TABLE t' as unknown as number });
    expect(statement.sql).toContain('LIMIT NaN');
    expect(statement.sql).not.toContain('DROP TABLE');
  });
});

describe('buildUpdate', () => {
  it('orders set params before where params', () => {
    const statement = buildUpdate('t', { n: 2 }, { id: 'a' });

    expect(statement.sql).toBe('UPDATE "t" SET "n" = ? WHERE "id" = ?');
    expect(statement.params).toEqual([2, 'a']);
  });

  it('rejects an update with no values', () => {
    expect(() => buildUpdate('t', {}, { id: 'a' })).toThrow(/no values/);
  });
});

describe('buildDelete', () => {
  it('builds a filtered delete', () => {
    const statement = buildDelete('t', { id: 'a' });

    expect(statement.sql).toBe('DELETE FROM "t" WHERE "id" = ?');
    expect(statement.params).toEqual(['a']);
  });

  it('builds an unfiltered delete', () => {
    expect(buildDelete('t').sql).toBe('DELETE FROM "t"');
  });
});
