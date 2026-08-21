import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TABLE_NAMES } from '@mastra/core/storage';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TursoConnection } from '../db/connection';
import { TursoOperations } from './operations';

const TABLE = 'mastra_threads' as TABLE_NAMES;

describe('TursoOperations', () => {
  let dir: string;
  let connection: TursoConnection;
  let ops: TursoOperations;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'mastra-turso-ops-'));
    connection = new TursoConnection({ path: join(dir, 'test.db') });
    ops = new TursoOperations({ connection });

    await ops.createTable({
      tableName: TABLE,
      schema: {
        id: { type: 'text', primaryKey: true },
        title: { type: 'text', nullable: true },
        count: { type: 'integer', nullable: true },
      },
    });
  });

  afterEach(async () => {
    await connection.close();
    rmSync(dir, { recursive: true, force: true });
  });

  describe('createTable', () => {
    it('is idempotent', async () => {
      await expect(
        ops.createTable({ tableName: TABLE, schema: { id: { type: 'text', primaryKey: true } } }),
      ).resolves.toBeUndefined();
    });
  });

  describe('insert and load', () => {
    it('round-trips a record', async () => {
      await ops.insert({ tableName: TABLE, record: { id: 'a', title: 'hello', count: 3 } });

      await expect(ops.load({ tableName: TABLE, keys: { id: 'a' } })).resolves.toEqual({
        id: 'a',
        title: 'hello',
        count: 3,
      });
    });

    it('returns null when no row matches', async () => {
      await expect(ops.load({ tableName: TABLE, keys: { id: 'missing' } })).resolves.toBeNull();
    });

    it('drops fields the table does not have', async () => {
      // Records may carry fields from a schema newer than the migrated table.
      await ops.insert({ tableName: TABLE, record: { id: 'a', title: 't', notAColumn: 'x' } });

      await expect(ops.load({ tableName: TABLE, keys: { id: 'a' } })).resolves.toMatchObject({ id: 'a', title: 't' });
    });

    it('normalizes values on the way in', async () => {
      await ops.insert({ tableName: TABLE, record: { id: 'a', title: undefined, count: 1 } });

      // `undefined` must become NULL rather than the string "undefined".
      await expect(ops.load({ tableName: TABLE, keys: { id: 'a' } })).resolves.toMatchObject({ title: null });
    });
  });

  describe('batchInsert', () => {
    it('inserts every record', async () => {
      await ops.batchInsert({
        tableName: TABLE,
        records: [
          { id: 'a', count: 1 },
          { id: 'b', count: 2 },
        ],
      });

      const result = await connection.execute(`SELECT COUNT(*) AS c FROM ${TABLE}`);
      expect(result.rows[0]!.c).toBe(2);
    });

    it('is atomic — a failure leaves no partial rows', async () => {
      await ops.insert({ tableName: TABLE, record: { id: 'existing' } });

      await expect(
        ops.batchInsert({
          tableName: TABLE,
          records: [{ id: 'new' }, { id: 'existing' }],
        }),
      ).rejects.toThrow();

      await expect(ops.load({ tableName: TABLE, keys: { id: 'new' } })).resolves.toBeNull();
    });

    it('is a no-op for an empty list', async () => {
      await expect(ops.batchInsert({ tableName: TABLE, records: [] })).resolves.toBeUndefined();
    });
  });

  describe('hasColumn', () => {
    it('reports existing and missing columns', async () => {
      await expect(ops.hasColumn(TABLE, 'title')).resolves.toBe(true);
      await expect(ops.hasColumn(TABLE, 'nope')).resolves.toBe(false);
    });

    it('sees a column added outside the cache', async () => {
      await ops.hasColumn(TABLE, 'title');
      await connection.execute(`ALTER TABLE ${TABLE} ADD COLUMN added TEXT`);

      // A negative answer must re-read before it is trusted.
      await expect(ops.hasColumn(TABLE, 'added')).resolves.toBe(true);
    });
  });

  describe('alterTable', () => {
    it('adds a missing column', async () => {
      await ops.alterTable({
        tableName: TABLE,
        schema: { id: { type: 'text', primaryKey: true }, extra: { type: 'text', nullable: true } },
        ifNotExists: ['extra'],
      });

      await expect(ops.hasColumn(TABLE, 'extra')).resolves.toBe(true);
    });

    it('skips columns that already exist', async () => {
      await expect(
        ops.alterTable({ tableName: TABLE, schema: { title: { type: 'text' } }, ifNotExists: ['title'] }),
      ).resolves.toBeUndefined();
    });

    it('backfills a NOT NULL column with a default', async () => {
      await ops.insert({ tableName: TABLE, record: { id: 'a' } });

      await ops.alterTable({
        tableName: TABLE,
        schema: { required: { type: 'integer', nullable: false } },
        ifNotExists: ['required'],
      });

      // Existing rows have no value, so the column needs a default to be added.
      await expect(ops.load({ tableName: TABLE, keys: { id: 'a' } })).resolves.toMatchObject({ required: 0 });
    });

    it('is a no-op for an empty column list', async () => {
      await expect(ops.alterTable({ tableName: TABLE, schema: {}, ifNotExists: [] })).resolves.toBeUndefined();
    });
  });

  describe('clearTable and dropTable', () => {
    it('clears rows but keeps the table', async () => {
      await ops.insert({ tableName: TABLE, record: { id: 'a' } });
      await ops.clearTable({ tableName: TABLE });

      await expect(ops.load({ tableName: TABLE, keys: { id: 'a' } })).resolves.toBeNull();
      await expect(ops.hasColumn(TABLE, 'id')).resolves.toBe(true);
    });

    it('drops the table', async () => {
      await ops.dropTable({ tableName: TABLE });
      await expect(ops.hasColumn(TABLE, 'id')).resolves.toBe(false);
    });

    it('tolerates dropping a table that is not there', async () => {
      await ops.dropTable({ tableName: TABLE });
      await expect(ops.dropTable({ tableName: TABLE })).resolves.toBeUndefined();
    });
  });
});
