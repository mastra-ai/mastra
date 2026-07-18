import { describe, expect, it, vi } from 'vitest';

import { ScoresOracle } from '.';

function createScoresOracle(): ScoresOracle {
  return new ScoresOracle({ poolManager: {} as any });
}

/**
 * Fake column-existence store backing a minimal OracleDB stand-in. Tracks which
 * columns "exist" on the scores table and lets executeDdl calls mutate that
 * state the same way real ADD/DROP/RENAME DDL would, so tests can simulate a
 * migration crashing partway through and resuming on a later call.
 *
 * `failOnce` matches the SQL statement that should fail exactly once - DDL via
 * `executeDdl` or the UPDATE copy via `none` (mirroring Oracle
 * rejecting/erroring on that one statement before the process crashed); every
 * later call - including a retry of the same statement - succeeds, since a
 * real second attempt would run against a database not stuck in that fault.
 */
function createFakeScoresDb(initialExists: Record<string, boolean>, failOnce?: (sql: string) => boolean) {
  const exists: Record<string, boolean> = { ...initialExists };
  const executeDdlCalls: string[] = [];
  const noneCalls: string[] = [];
  let failurePending = !!failOnce;

  const oneOrNone = vi.fn(async (_sql: string, binds?: Record<string, unknown>) => {
    const columnName = binds?.columnName as string | undefined;
    if (!columnName) return null;
    return exists[columnName] ? { exists: 1 } : null;
  });

  const executeDdl = vi.fn(async (sql: string) => {
    executeDdlCalls.push(sql);
    if (failurePending && failOnce?.(sql)) {
      failurePending = false;
      throw new Error(`simulated DDL failure: ${sql}`);
    }

    const addMatch = sql.match(/ADD \((\w+) CLOB\)/);
    if (addMatch?.[1]) exists[addMatch[1]] = true;

    const dropMatch = sql.match(/DROP COLUMN (\w+)/);
    if (dropMatch?.[1]) exists[dropMatch[1]] = false;

    const renameMatch = sql.match(/RENAME COLUMN (\w+) TO (\w+)/);
    if (renameMatch?.[1] && renameMatch[2]) {
      exists[renameMatch[1]] = false;
      exists[renameMatch[2]] = true;
    }
  });

  const none = vi.fn(async (sql: string) => {
    noneCalls.push(sql);
    if (failurePending && failOnce?.(sql)) {
      failurePending = false;
      throw new Error(`simulated DML failure: ${sql}`);
    }
  });

  return { db: { oneOrNone, executeDdl, none }, executeDdlCalls, noneCalls, exists };
}

describe('ScoresOracle CLOB migration recovery', () => {
  it('runs the full ADD/UPDATE/DROP/RENAME sequence on a fresh legacy column', async () => {
    const scores = createScoresOracle();
    const { db, executeDdlCalls, noneCalls } = createFakeScoresDb({ reason: true });
    (scores as any).db = db;

    await (scores as any).migrateScoreTextColumnToClob('reason');

    expect(executeDdlCalls).toEqual([
      expect.stringContaining('ADD (ORACLE_TMP_REASON_CLOB CLOB)'),
      expect.stringContaining('DROP COLUMN reason'),
      expect.stringContaining('RENAME COLUMN ORACLE_TMP_REASON_CLOB TO reason'),
    ]);
    expect(noneCalls).toEqual([expect.stringContaining('UPDATE')]);
  });

  it('re-runs the copy before dropping when both columns exist (temp existence is not proof the copy ran)', async () => {
    // Simulates a previous attempt that stopped somewhere after ADD - maybe
    // after the copy (DROP failed), maybe before it (UPDATE failed). The two
    // states are indistinguishable from column metadata, so the original
    // column is treated as the source of truth and the idempotent copy runs
    // again before the destructive DROP.
    const scores = createScoresOracle();
    const { db, executeDdlCalls, noneCalls } = createFakeScoresDb({ reason: true, ORACLE_TMP_REASON_CLOB: true });
    (scores as any).db = db;

    await (scores as any).migrateScoreTextColumnToClob('reason');

    expect(executeDdlCalls).toEqual([
      expect.stringContaining('DROP COLUMN reason'),
      expect.stringContaining('RENAME COLUMN ORACLE_TMP_REASON_CLOB TO reason'),
    ]);
    expect(noneCalls).toEqual([expect.stringContaining('UPDATE')]);
  });

  it('only renames when the narrow column was already dropped on a previous attempt', async () => {
    // Simulates a previous attempt where ADD + UPDATE + DROP succeeded but RENAME failed.
    const scores = createScoresOracle();
    const { db, executeDdlCalls, noneCalls } = createFakeScoresDb({ ORACLE_TMP_REASON_CLOB: true });
    (scores as any).db = db;

    await (scores as any).migrateScoreTextColumnToClob('reason');

    expect(executeDdlCalls).toEqual([expect.stringContaining('RENAME COLUMN ORACLE_TMP_REASON_CLOB TO reason')]);
    expect(noneCalls).toEqual([]);
  });

  it('resumes and completes the migration on a second call when the DROP step failed', async () => {
    const scores = createScoresOracle();
    const { db, executeDdlCalls, exists } = createFakeScoresDb({ reason: true }, sql => sql.includes('DROP COLUMN'));
    (scores as any).db = db;

    await expect((scores as any).migrateScoreTextColumnToClob('reason')).rejects.toThrow(/simulated DDL failure/);

    // First attempt: ADD + UPDATE ran (and are reflected in fake state), DROP was
    // attempted and failed, so both columns still exist afterwards.
    expect(exists.reason).toBe(true);
    expect(exists.ORACLE_TMP_REASON_CLOB).toBe(true);
    expect(executeDdlCalls.filter(sql => sql.includes('ADD ('))).toHaveLength(1);
    expect(executeDdlCalls.filter(sql => sql.includes('DROP COLUMN'))).toHaveLength(1);

    // Second call (no longer failing) resumes without repeating ADD, but does
    // re-run the idempotent copy: the original column still exists, and there
    // is no way to tell a DROP-failed attempt from an UPDATE-failed one, so
    // re-copying before DROP is the safe default.
    const noneCallCountBeforeRetry = (db.none as any).mock.calls.length;
    await (scores as any).migrateScoreTextColumnToClob('reason');

    expect(executeDdlCalls.filter(sql => sql.includes('ADD ('))).toHaveLength(1);
    expect(executeDdlCalls.filter(sql => sql.includes('DROP COLUMN'))).toHaveLength(2);
    expect(executeDdlCalls.filter(sql => sql.includes('RENAME COLUMN'))).toHaveLength(1);
    expect((db.none as any).mock.calls.length).toBe(noneCallCountBeforeRetry + 1);
    // Migration completed: the CLOB copy now lives under the original column
    // name and the temporary column is gone.
    expect(exists.reason).toBe(true);
    expect(exists.ORACLE_TMP_REASON_CLOB).toBe(false);
  });

  it('re-runs the copy on retry when the first attempt failed during the UPDATE copy', async () => {
    const scores = createScoresOracle();
    const { db, executeDdlCalls, noneCalls, exists } = createFakeScoresDb({ reason: true }, sql => sql.includes('UPDATE'));
    (scores as any).db = db;

    await expect((scores as any).migrateScoreTextColumnToClob('reason')).rejects.toThrow(/simulated DML failure/);

    // First attempt: ADD succeeded but the copy failed, so the temp CLOB
    // exists yet holds no data. Nothing destructive may have run: the
    // original column - the only one with the data - must survive.
    expect(exists.reason).toBe(true);
    expect(exists.ORACLE_TMP_REASON_CLOB).toBe(true);
    expect(executeDdlCalls).toEqual([expect.stringContaining('ADD (ORACLE_TMP_REASON_CLOB CLOB)')]);

    // Retry: the temp column existing must NOT skip the copy. The UPDATE runs
    // again (successfully this time) before DROP/RENAME complete the swap.
    await (scores as any).migrateScoreTextColumnToClob('reason');

    expect(noneCalls.filter(sql => sql.includes('UPDATE'))).toHaveLength(2);
    expect(executeDdlCalls.filter(sql => sql.includes('ADD ('))).toHaveLength(1);
    expect(executeDdlCalls.filter(sql => sql.includes('DROP COLUMN'))).toHaveLength(1);
    expect(executeDdlCalls.filter(sql => sql.includes('RENAME COLUMN'))).toHaveLength(1);
    expect(exists.reason).toBe(true);
    expect(exists.ORACLE_TMP_REASON_CLOB).toBe(false);
  });

  it('resumes and completes the migration on a second call when the RENAME step failed', async () => {
    const scores = createScoresOracle();
    const { db, executeDdlCalls, exists } = createFakeScoresDb({ reason: true }, sql => sql.includes('RENAME COLUMN'));
    (scores as any).db = db;

    await expect((scores as any).migrateScoreTextColumnToClob('reason')).rejects.toThrow(/simulated DDL failure/);

    // First attempt: ADD + UPDATE + DROP all completed, RENAME was attempted and failed,
    // so the narrow column is gone and only the temp CLOB column remains.
    expect(exists.reason).toBe(false);
    expect(exists.ORACLE_TMP_REASON_CLOB).toBe(true);
    expect(executeDdlCalls.filter(sql => sql.includes('ADD ('))).toHaveLength(1);
    expect(executeDdlCalls.filter(sql => sql.includes('DROP COLUMN'))).toHaveLength(1);
    expect(executeDdlCalls.filter(sql => sql.includes('RENAME COLUMN'))).toHaveLength(1);

    // Second call must resume with RENAME only, without repeating ADD/UPDATE/DROP.
    await (scores as any).migrateScoreTextColumnToClob('reason');

    expect(executeDdlCalls.filter(sql => sql.includes('ADD ('))).toHaveLength(1);
    expect(executeDdlCalls.filter(sql => sql.includes('DROP COLUMN'))).toHaveLength(1);
    expect(executeDdlCalls.filter(sql => sql.includes('RENAME COLUMN'))).toHaveLength(2);
    expect(exists.reason).toBe(true);
    expect(exists.ORACLE_TMP_REASON_CLOB).toBe(false);
  });
});

describe('ScoresOracle pagination tie-breaker', () => {
  it('adds an id ASC tie-breaker to the score listing ORDER BY', async () => {
    const scores = createScoresOracle();
    let capturedSql = '';
    const oneOrNone = vi.fn(async () => ({ count: 1 }));
    const execute = vi.fn(async (sql: string) => {
      capturedSql = sql;
      return [];
    });
    (scores as any).db = { oneOrNone, execute };

    await scores.listScoresByRunId({ runId: 'run-1', pagination: { page: 0, perPage: 10 } });

    expect(capturedSql).toMatch(/ORDER BY .*, id ASC OFFSET/);
  });
});

describe('ScoresOracle CLOB migration recovery (orphan repair)', () => {
  it('ensureLongTextColumns repairs an orphaned migration instead of silently skipping it', async () => {
    // Regression test for the exact bug CR-01 describes: if the original
    // column was already dropped (data type lookup returns undefined) the old
    // code treated that the same as "already migrated" and skipped repair,
    // leaving the table permanently missing the column.
    const scores = createScoresOracle();
    const executeDdlCalls: string[] = [];

    const oneOrNone = vi.fn(async (sql: string, binds?: Record<string, unknown>) => {
      const columnName = binds?.columnName as string | undefined;
      if (sql.includes('data_type AS')) {
        // Only 'reason' is mid-migration; every other long-text column is
        // already a CLOB and needs no work.
        return columnName === 'reason' ? null : { dataType: 'CLOB' };
      }
      if (sql.includes('"exists"')) {
        return columnName === 'ORACLE_TMP_REASON_CLOB' ? { exists: 1 } : null;
      }
      return null;
    });
    const executeDdl = vi.fn(async (sql: string) => {
      executeDdlCalls.push(sql);
    });
    const none = vi.fn(async () => {});
    (scores as any).db = { oneOrNone, executeDdl, none };

    await (scores as any).ensureLongTextColumns();

    expect(executeDdlCalls).toEqual([expect.stringContaining('RENAME COLUMN ORACLE_TMP_REASON_CLOB TO reason')]);
  });
});
