import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TursoConnection } from './connection';
import { TursoError } from './errors';

describe('TursoConnection', () => {
  let dir: string;
  let conn: TursoConnection;

  const ids = async () => {
    const result = await conn.execute('SELECT id FROM t ORDER BY id');
    return result.rows.map(row => row.id);
  };

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'mastra-turso-conn-'));
    conn = new TursoConnection({ path: join(dir, 'test.db') });
    await conn.execute('CREATE TABLE t (id TEXT PRIMARY KEY, n INTEGER)');
  });

  afterEach(async () => {
    await conn.close();
    rmSync(dir, { recursive: true, force: true });
  });

  describe('execute', () => {
    it('executes a write exactly once', async () => {
      // Both `all()` and `run()` execute the statement, so a probe-then-fallback
      // implementation inserts twice. This is the regression guard for that.
      await conn.execute({ sql: 'INSERT INTO t VALUES (?, ?)', params: ['a', 1] });

      const result = await conn.execute('SELECT COUNT(*) AS c FROM t');
      expect(result.rows[0]!.c).toBe(1);
    });

    it('reports rows changed by an UPDATE', async () => {
      await conn.execute(`INSERT INTO t VALUES ('a', 1)`);
      await conn.execute(`INSERT INTO t VALUES ('b', 1)`);

      const result = await conn.execute(`UPDATE t SET n = 9`);
      expect(result.rowsAffected).toBe(2);
      expect(await ids()).toEqual(['a', 'b']);
    });

    it('returns rows for a SELECT', async () => {
      await conn.execute({ sql: 'INSERT INTO t VALUES (?, ?)', params: ['a', 7] });

      const result = await conn.execute('SELECT id, n FROM t');
      expect(result.rows).toEqual([{ id: 'a', n: 7 }]);
    });

    it('returns rows for INSERT ... RETURNING without double-inserting', async () => {
      const result = await conn.execute(`INSERT INTO t VALUES ('r', 1) RETURNING id`);

      expect(result.rows).toEqual([{ id: 'r' }]);
      expect(await ids()).toEqual(['r']);
    });

    it('returns rows for a WITH query', async () => {
      await conn.execute(`INSERT INTO t VALUES ('a', 1)`);
      const result = await conn.execute(`WITH c AS (SELECT id FROM t) SELECT id FROM c`);
      expect(result.rows).toEqual([{ id: 'a' }]);
    });

    it('normalizes bind values', async () => {
      await conn.execute({ sql: 'INSERT INTO t VALUES (?, ?)', params: ['d', new Date(1577934245678)] });

      const result = await conn.execute('SELECT n FROM t');
      expect(result.rows[0]!.n).toBe(1577934245678);
    });

    it('throws a classified error with the SQL as context', async () => {
      await conn.execute(`INSERT INTO t VALUES ('a', 1)`);

      await expect(conn.execute(`INSERT INTO t VALUES ('a', 1)`)).rejects.toMatchObject({
        code: 'SQLITE_CONSTRAINT',
        extendedCode: 'SQLITE_CONSTRAINT_UNIQUE',
      });
    });
  });

  describe('batch', () => {
    it('applies all statements when they succeed', async () => {
      await conn.batch([
        { sql: 'INSERT INTO t VALUES (?, ?)', params: ['a', 1] },
        { sql: 'INSERT INTO t VALUES (?, ?)', params: ['b', 2] },
      ]);

      expect(await ids()).toEqual(['a', 'b']);
    });

    it('rolls back earlier statements when a later one fails', async () => {
      // Raw `db.batch()` leaves 'first' committed here. Atomicity is the whole
      // reason callers batch, so this is the core guarantee of the wrapper.
      await conn.execute(`INSERT INTO t VALUES ('existing', 0)`);

      await expect(
        conn.batch([
          `INSERT INTO t VALUES ('first', 1)`,
          `INSERT INTO t VALUES ('existing', 2)`,
          `INSERT INTO t VALUES ('third', 3)`,
        ]),
      ).rejects.toMatchObject({ extendedCode: 'SQLITE_CONSTRAINT_UNIQUE' });

      expect(await ids()).toEqual(['existing']);
    });

    it('returns a result per statement', async () => {
      const results = await conn.batch([`INSERT INTO t VALUES ('a', 1)`, `INSERT INTO t VALUES ('b', 2)`]);

      expect(results).toHaveLength(2);
      expect(results.every(result => result.rowsAffected === 1)).toBe(true);
    });

    it('is a no-op for an empty batch', async () => {
      await expect(conn.batch([])).resolves.toEqual([]);
    });

    it('leaves the connection usable after a failed batch', async () => {
      // A leaked open transaction would make every later write fail.
      await expect(conn.batch([`INSERT INTO t VALUES ('a', 1)`, `INSERT INTO bad VALUES (1)`])).rejects.toThrow();

      await conn.execute(`INSERT INTO t VALUES ('after', 1)`);
      expect(await ids()).toEqual(['after']);
    });
  });

  describe('transaction', () => {
    it('commits on success and returns the callback value', async () => {
      const returned = await conn.transaction(async tx => {
        await tx.execute(`INSERT INTO t VALUES ('a', 1)`);
        await tx.execute(`INSERT INTO t VALUES ('b', 2)`);
        return 'done';
      });

      expect(returned).toBe('done');
      expect(await ids()).toEqual(['a', 'b']);
    });

    it('rolls back when the callback throws, and propagates the error', async () => {
      await expect(
        conn.transaction(async tx => {
          await tx.execute(`INSERT INTO t VALUES ('a', 1)`);
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');

      expect(await ids()).toEqual([]);
    });

    it('rolls back when a statement inside fails', async () => {
      await conn.execute(`INSERT INTO t VALUES ('a', 1)`);

      await expect(
        conn.transaction(async tx => {
          await tx.execute(`INSERT INTO t VALUES ('b', 2)`);
          await tx.execute(`INSERT INTO t VALUES ('a', 3)`);
        }),
      ).rejects.toMatchObject({ extendedCode: 'SQLITE_CONSTRAINT_UNIQUE' });

      expect(await ids()).toEqual(['a']);
    });

    it('reads its own uncommitted writes', async () => {
      await conn.transaction(async tx => {
        await tx.execute(`INSERT INTO t VALUES ('a', 1)`);
        const result = await tx.execute('SELECT id FROM t');
        expect(result.rows).toEqual([{ id: 'a' }]);
      });
    });

    it('leaves the connection usable after a rollback', async () => {
      await expect(
        conn.transaction(async tx => {
          await tx.execute(`INSERT INTO t VALUES ('a', 1)`);
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');

      await conn.execute(`INSERT INTO t VALUES ('after', 1)`);
      expect(await ids()).toEqual(['after']);
    });
  });

  describe('serialization', () => {
    it('keeps concurrent autocommit writes out of an open transaction', async () => {
      // BEGIN binds to the connection, so an ungated write issued while a
      // transaction is open would be captured by it and lost on rollback.
      const transaction = conn.transaction(async tx => {
        await tx.execute(`INSERT INTO t VALUES ('tx', 1)`);
        // Yield so the queued write below would run here if it were not gated.
        await new Promise(resolve => setTimeout(resolve, 20));
        throw new Error('rollback');
      });
      const independent = conn.execute(`INSERT INTO t VALUES ('independent', 2)`);

      await expect(transaction).rejects.toThrow('rollback');
      await independent;

      // The transaction rolled back; the independent write must have survived.
      expect(await ids()).toEqual(['independent']);
    });

    it('runs concurrent writes without losing any', async () => {
      await Promise.all(
        Array.from({ length: 25 }, (_, i) =>
          conn.execute({ sql: 'INSERT INTO t VALUES (?, ?)', params: [`k${i}`, i] }),
        ),
      );

      const result = await conn.execute('SELECT COUNT(*) AS c FROM t');
      expect(result.rows[0]!.c).toBe(25);
    });

    it('does not wedge the queue after a failure', async () => {
      await expect(conn.execute('SELECT * FROM missing')).rejects.toThrow();
      await expect(conn.execute('SELECT 1 AS ok')).resolves.toMatchObject({ rows: [{ ok: 1 }] });
    });
  });

  describe('transactionWithRetry', () => {
    // Separate connections are the point: the queue serializes work within one
    // connection, so cross-connection writers are the only way to make the
    // engine's real contention behaviour observable.
    const openConnections = (count: number) =>
      Array.from({ length: count }, () => new TursoConnection({ path: join(dir, 'test.db') }));

    it('converges concurrent read-modify-writes without losing an update', async () => {
      await conn.execute(`INSERT INTO t VALUES ('counter', 0)`);

      const writers = openConnections(8);
      try {
        await Promise.all(
          writers.map(writer =>
            writer.transactionWithRetry(async tx => {
              const current = await tx.execute(`SELECT n FROM t WHERE id = 'counter'`);
              const n = Number(current.rows[0]!.n);
              // Widen the window between read and write so the increments
              // genuinely overlap rather than happening to serialize.
              await new Promise(resolve => setTimeout(resolve, 5));
              await tx.execute({ sql: `UPDATE t SET n = ? WHERE id = 'counter'`, params: [n + 1] });
            }),
          ),
        );

        // Every increment must be visible: a lost update would land under 8.
        const result = await conn.execute(`SELECT n FROM t WHERE id = 'counter'`);
        expect(Number(result.rows[0]!.n)).toBe(8);
      } finally {
        await Promise.all(writers.map(writer => writer.close()));
      }
    });

    it('proves the retry is load-bearing, not incidental serialization', async () => {
      // Guards the test above: if plain transactions also converged, that test
      // would pass with the retry deleted and prove nothing.
      await conn.execute(`INSERT INTO t VALUES ('counter', 0)`);

      const writers = openConnections(8);
      try {
        const results = await Promise.allSettled(
          writers.map(writer =>
            writer.transaction(async tx => {
              const current = await tx.execute(`SELECT n FROM t WHERE id = 'counter'`);
              await new Promise(resolve => setTimeout(resolve, 5));
              await tx.execute({
                sql: `UPDATE t SET n = ? WHERE id = 'counter'`,
                params: [Number(current.rows[0]!.n) + 1],
              });
            }),
          ),
        );

        expect(results.some(result => result.status === 'rejected')).toBe(true);
      } finally {
        await Promise.all(writers.map(writer => writer.close()));
      }
    });

    it('does not retry a deterministic failure', async () => {
      let attempts = 0;

      await expect(
        conn.transactionWithRetry(async tx => {
          attempts++;
          await tx.execute(`INSERT INTO t VALUES ('dup', 1)`);
          await tx.execute(`INSERT INTO t VALUES ('dup', 2)`);
        }),
      ).rejects.toMatchObject({ code: 'SQLITE_CONSTRAINT_PRIMARYKEY' });

      expect(attempts).toBe(1);
    });

    it('surfaces the engine error once the retry budget is spent', async () => {
      const blocker = new TursoConnection({ path: join(dir, 'test.db') });
      try {
        // Hold a write lock open for longer than the retry budget can outlast.
        let release!: () => void;
        const held = new Promise<void>(resolve => (release = resolve));
        const blocking = blocker.transaction(async tx => {
          await tx.execute(`INSERT INTO t VALUES ('held', 1)`);
          await held;
        });
        await new Promise(resolve => setTimeout(resolve, 20));

        await expect(
          conn.transactionWithRetry(async tx => tx.execute(`INSERT INTO t VALUES ('blocked', 1)`), {
            maxRetries: 2,
            initialBackoffMs: 1,
          }),
        ).rejects.toBeInstanceOf(TursoError);

        release();
        await blocking;
      } finally {
        await blocker.close();
      }
    });
  });

  describe('close', () => {
    it('is idempotent', async () => {
      await conn.close();
      await expect(conn.close()).resolves.toBeUndefined();
      expect(conn.closed).toBe(true);
    });

    it('rejects use after close', async () => {
      await conn.close();
      await expect(conn.execute('SELECT 1')).rejects.toBeInstanceOf(TursoError);
    });

    it('waits for in-flight work before closing', async () => {
      const pending = conn.execute(`INSERT INTO t VALUES ('a', 1)`);
      await conn.close();
      await expect(pending).resolves.toBeDefined();
    });
  });

  describe('large integers', () => {
    it('round-trips an integer beyond 2^53', async () => {
      // Without safeIntegers the engine returns …992 for this value.
      const big = 9007199254740993n;
      await conn.execute({ sql: 'INSERT INTO t VALUES (?, ?)', params: ['big', big] });

      const result = await conn.execute(`SELECT n FROM t WHERE id = 'big'`);
      expect(result.rows[0]!.n).toBe(big);
    });

    it('returns ordinary numbers for safe-range integers', async () => {
      await conn.execute({ sql: 'INSERT INTO t VALUES (?, ?)', params: ['small', 42] });

      const result = await conn.execute(`SELECT n FROM t WHERE id = 'small'`);
      expect(result.rows[0]!.n).toBe(42);
      expect(typeof result.rows[0]!.n).toBe('number');
    });
  });
});
