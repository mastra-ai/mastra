import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DuckDBConnection } from '../../db/index';
import { migrateSignalTables } from './migration';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function hasPrimaryKey(db: DuckDBConnection, table: string): Promise<boolean> {
  const rows = await db.query<{ constraint_type: string }>(
    `SELECT constraint_type FROM information_schema.table_constraints
     WHERE table_name = ? AND constraint_type = 'PRIMARY KEY'`,
    [table],
  );
  return rows.length > 0;
}

async function tableExists(db: DuckDBConnection, table: string): Promise<boolean> {
  const rows = await db.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables WHERE table_name = ?`,
    [table],
  );
  return rows.length > 0;
}

describe('migrateSignalTables (DuckDB)', () => {
  let db: DuckDBConnection;

  beforeEach(() => {
    db = new DuckDBConnection({ path: ':memory:' });
  });

  afterEach(async () => {
    await db.close();
  });

  it('is a no-op when signal tables do not exist', async () => {
    await expect(migrateSignalTables(db)).resolves.not.toThrow();
    expect(await tableExists(db, 'log_events')).toBe(false);
  });

  it('migrates a legacy log_events table without logId, preserving rows and generating IDs', async () => {
    await db.execute(`
      CREATE TABLE log_events (
        timestamp TIMESTAMP NOT NULL,
        traceId VARCHAR,
        spanId VARCHAR,
        level VARCHAR NOT NULL,
        message VARCHAR NOT NULL,
        data JSON,
        metadata JSON
      )
    `);

    await db.execute(
      `INSERT INTO log_events (timestamp, traceId, spanId, level, message)
       VALUES (TIMESTAMP '2026-01-01 00:00:00', 'trace-a', 'span-a', 'info', 'hello'),
              (TIMESTAMP '2026-01-01 00:00:01', 'trace-a', 'span-b', 'error', 'world')`,
    );

    await migrateSignalTables(db);

    expect(await hasPrimaryKey(db, 'log_events')).toBe(true);

    const rows = await db.query<{ logId: string; message: string }>(
      `SELECT logId, message FROM log_events ORDER BY timestamp`,
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]!.message).toBe('hello');
    expect(rows[1]!.message).toBe('world');
    expect(rows[0]!.logId).toMatch(UUID_RE);
    expect(rows[1]!.logId).toMatch(UUID_RE);
    expect(rows[0]!.logId).not.toBe(rows[1]!.logId);

    // Backup should be cleaned up on success.
    const backups = await db.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'log_events_backup_%'`,
    );
    expect(backups).toHaveLength(0);
  });

  it('preserves existing non-empty IDs and backfills empty ones', async () => {
    await db.execute(`
      CREATE TABLE log_events (
        timestamp TIMESTAMP NOT NULL,
        logId VARCHAR,
        traceId VARCHAR,
        level VARCHAR NOT NULL,
        message VARCHAR NOT NULL
      )
    `);

    await db.execute(
      `INSERT INTO log_events (timestamp, logId, traceId, level, message)
       VALUES (TIMESTAMP '2026-01-01 00:00:00', 'existing-id', 't1', 'info', 'keep'),
              (TIMESTAMP '2026-01-01 00:00:01', '',            't1', 'info', 'backfill')`,
    );

    await migrateSignalTables(db);

    const rows = await db.query<{ logId: string; message: string }>(
      `SELECT logId, message FROM log_events ORDER BY timestamp`,
    );
    expect(rows[0]!.logId).toBe('existing-id');
    expect(rows[1]!.logId).toMatch(UUID_RE);
  });

  it('is idempotent: second run leaves rows and schema untouched', async () => {
    await db.execute(`
      CREATE TABLE metric_events (
        timestamp TIMESTAMP NOT NULL,
        traceId VARCHAR,
        name VARCHAR NOT NULL,
        value DOUBLE NOT NULL
      )
    `);
    await db.execute(
      `INSERT INTO metric_events (timestamp, traceId, name, value)
       VALUES (TIMESTAMP '2026-01-01 00:00:00', 't1', 'latency', 42)`,
    );

    await migrateSignalTables(db);
    const first = await db.query<{ metricId: string }>(`SELECT metricId FROM metric_events`);
    expect(first).toHaveLength(1);
    expect(first[0]!.metricId).toMatch(UUID_RE);

    await migrateSignalTables(db);
    const second = await db.query<{ metricId: string }>(`SELECT metricId FROM metric_events`);
    expect(second).toHaveLength(1);
    expect(second[0]!.metricId).toBe(first[0]!.metricId);
  });

  it('migrates all four signal tables in one call', async () => {
    await db.execute(
      `CREATE TABLE metric_events (timestamp TIMESTAMP NOT NULL, name VARCHAR NOT NULL, value DOUBLE NOT NULL)`,
    );
    await db.execute(
      `CREATE TABLE log_events (timestamp TIMESTAMP NOT NULL, level VARCHAR NOT NULL, message VARCHAR NOT NULL)`,
    );
    await db.execute(
      `CREATE TABLE score_events (timestamp TIMESTAMP NOT NULL, traceId VARCHAR, scorerId VARCHAR NOT NULL, score DOUBLE NOT NULL)`,
    );
    await db.execute(
      `CREATE TABLE feedback_events (timestamp TIMESTAMP NOT NULL, traceId VARCHAR, feedbackSource VARCHAR NOT NULL, feedbackType VARCHAR NOT NULL, value VARCHAR NOT NULL)`,
    );

    await db.execute(
      `INSERT INTO metric_events (timestamp, name, value) VALUES (TIMESTAMP '2026-01-01 00:00:00', 'latency', 1)`,
    );
    await db.execute(
      `INSERT INTO log_events (timestamp, level, message) VALUES (TIMESTAMP '2026-01-01 00:00:00', 'info', 'l')`,
    );
    await db.execute(
      `INSERT INTO score_events (timestamp, traceId, scorerId, score) VALUES (TIMESTAMP '2026-01-01 00:00:00', 't1', 'q', 0.5)`,
    );
    await db.execute(
      `INSERT INTO feedback_events (timestamp, traceId, feedbackSource, feedbackType, value) VALUES (TIMESTAMP '2026-01-01 00:00:00', 't1', 'user', 'thumbs', '1')`,
    );

    await migrateSignalTables(db);

    for (const table of ['metric_events', 'log_events', 'score_events', 'feedback_events']) {
      expect(await hasPrimaryKey(db, table)).toBe(true);
    }
  });
});
