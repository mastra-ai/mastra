import { describe, expect, it, vi } from 'vitest';

import { DuckDBConnection } from './index';

describe('DuckDBConnection', () => {
  describe('executeBatch', () => {
    it('executes multiple statements with one DuckDB connection', async () => {
      const db = new DuckDBConnection({ path: ':memory:' });
      const getConnectionSpy = vi.spyOn(db, 'getConnection');

      try {
        await db.executeBatch([
          'CREATE TABLE batch_a (id INTEGER)',
          'CREATE TABLE batch_b (id INTEGER)',
          'INSERT INTO batch_a VALUES (1)',
          'INSERT INTO batch_b VALUES (2)',
        ]);

        expect(getConnectionSpy).toHaveBeenCalledTimes(1);

        const rows = await db.query<{ total: number }>(`
          SELECT
            (SELECT COUNT(*) FROM batch_a) + (SELECT COUNT(*) FROM batch_b) AS total
        `);

        expect(rows).toEqual([{ total: 2 }]);
      } finally {
        await db.close();
      }
    });

    it('handles statements ending in line comments', async () => {
      const db = new DuckDBConnection({ path: ':memory:' });

      try {
        await db.executeBatch([
          `
            CREATE TABLE batch_comment_a (
              id INTEGER
            )
            -- no trailing semicolon
          `,
          'CREATE TABLE batch_comment_b (id INTEGER)',
        ]);

        const rows = await db.query<{ table_name: string }>(`
          SELECT table_name
          FROM information_schema.tables
          WHERE table_name IN ('batch_comment_a', 'batch_comment_b')
          ORDER BY table_name
        `);

        expect(rows).toEqual([{ table_name: 'batch_comment_a' }, { table_name: 'batch_comment_b' }]);
      } finally {
        await db.close();
      }
    });

    it('handles statements with trailing semicolons and string literal semicolons', async () => {
      const db = new DuckDBConnection({ path: ':memory:' });

      try {
        await db.executeBatch([
          'CREATE TABLE batch_semicolon_text (value TEXT);',
          "INSERT INTO batch_semicolon_text VALUES ('a;b;c');",
        ]);

        const rows = await db.query<{ value: string }>('SELECT value FROM batch_semicolon_text');

        expect(rows).toEqual([{ value: 'a;b;c' }]);
      } finally {
        await db.close();
      }
    });

    it('closes the DuckDB connection when a batch statement fails', async () => {
      const db = new DuckDBConnection({ path: ':memory:' });
      const closeConnectionSpy = vi.spyOn(
        db as unknown as { closeConnection(connection: unknown): void },
        'closeConnection',
      );

      try {
        await expect(
          db.executeBatch([
            'CREATE TABLE batch_failure_a (id INTEGER)',
            'SELECT * FROM missing_batch_table',
            'CREATE TABLE batch_failure_b (id INTEGER)',
          ]),
        ).rejects.toThrow(/missing_batch_table/);

        expect(closeConnectionSpy).toHaveBeenCalledTimes(1);
      } finally {
        await db.close();
      }
    });

    it('skips empty batches without opening a DuckDB connection', async () => {
      const db = new DuckDBConnection({ path: ':memory:' });
      const getConnectionSpy = vi.spyOn(db, 'getConnection');

      try {
        await db.executeBatch(['', '   ']);

        expect(getConnectionSpy).not.toHaveBeenCalled();
      } finally {
        await db.close();
      }
    });
  });
});
