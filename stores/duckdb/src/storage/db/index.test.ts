import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DuckDBConnection } from './index';

describe('DuckDBConnection', () => {
  describe('idle close', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('releases the instance after the idle timeout', async () => {
      const db = new DuckDBConnection({ path: ':memory:', idleTimeoutMs: 100 });
      const releaseSpy = vi.spyOn(db as unknown as { releaseInstance(): void }, 'releaseInstance');

      await db.execute('SELECT 1');

      expect(releaseSpy).not.toHaveBeenCalled();
      vi.advanceTimersByTime(100);
      expect(releaseSpy).toHaveBeenCalledTimes(1);

      await db.close();
    });

    it('cancels the idle timer when a new operation starts', async () => {
      const db = new DuckDBConnection({ path: ':memory:', idleTimeoutMs: 200 });
      const releaseSpy = vi.spyOn(db as unknown as { releaseInstance(): void }, 'releaseInstance');

      await db.execute('SELECT 1');
      vi.advanceTimersByTime(150);
      expect(releaseSpy).not.toHaveBeenCalled();

      // Start another op before the timer fires — should reset.
      await db.execute('SELECT 2');
      vi.advanceTimersByTime(150);
      expect(releaseSpy).not.toHaveBeenCalled();

      vi.advanceTimersByTime(50);
      expect(releaseSpy).toHaveBeenCalledTimes(1);

      await db.close();
    });

    it('does not idle-close when idleTimeoutMs is 0', async () => {
      const db = new DuckDBConnection({ path: ':memory:', idleTimeoutMs: 0 });
      const releaseSpy = vi.spyOn(db as unknown as { releaseInstance(): void }, 'releaseInstance');

      await db.execute('SELECT 1');
      vi.advanceTimersByTime(10_000);
      expect(releaseSpy).not.toHaveBeenCalled();

      await db.close();
    });

    it('defaults to idleTimeoutMs 0 for :memory: databases', () => {
      const memDb = new DuckDBConnection({ path: ':memory:' });
      expect((memDb as unknown as { idleTimeoutMs: number }).idleTimeoutMs).toBe(0);
    });

    it('defaults to non-zero idleTimeoutMs for file databases', () => {
      const fileDb = new DuckDBConnection({ path: 'test.duckdb' });
      expect((fileDb as unknown as { idleTimeoutMs: number }).idleTimeoutMs).toBeGreaterThan(0);
    });

    it('re-opens the instance after idle close', async () => {
      const db = new DuckDBConnection({ path: ':memory:', idleTimeoutMs: 50 });

      await db.execute('SELECT 1');
      vi.advanceTimersByTime(50);

      // Instance was released — the next operation should still work.
      const rows = await db.query<{ v: number }>('SELECT 42 AS v');
      expect(rows).toEqual([{ v: 42 }]);

      await db.close();
    });
  });

  describe('lock error handling', () => {
    it('wraps DuckDB lock errors with a helpful message', async () => {
      const db = new DuckDBConnection({ path: '/tmp/test-lock.duckdb' });

      // Mock DuckDBInstance.create to throw a lock error
      const { DuckDBInstance } = await import('@duckdb/node-api');
      const origCreate = DuckDBInstance.create;
      DuckDBInstance.create = vi
        .fn()
        .mockRejectedValue(
          new Error(
            'IO Error: Could not set lock on file "/tmp/test-lock.duckdb": Conflicting lock is held in /usr/bin/node (PID 12345) by user dev.',
          ),
        );

      try {
        await expect(db.query('SELECT 1')).rejects.toThrow(/DuckDB lock conflict/);
        await expect(db.query('SELECT 1')).rejects.toThrow(/Stop any other `mastra dev` processes/);
      } finally {
        DuckDBInstance.create = origCreate;
        await db.close();
      }
    });

    it('does not alter non-lock errors', async () => {
      const db = new DuckDBConnection({ path: '/tmp/test-other.duckdb' });

      const { DuckDBInstance } = await import('@duckdb/node-api');
      const origCreate = DuckDBInstance.create;
      DuckDBInstance.create = vi.fn().mockRejectedValue(new Error('Some other DuckDB error'));

      try {
        await expect(db.query('SELECT 1')).rejects.toThrow('Some other DuckDB error');
        await expect(db.query('SELECT 1')).rejects.not.toThrow(/DuckDB lock conflict/);
      } finally {
        DuckDBInstance.create = origCreate;
        await db.close();
      }
    });
  });

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
