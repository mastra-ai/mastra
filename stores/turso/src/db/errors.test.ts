import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { connect } from '@tursodatabase/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { classifyTursoMessage, isRetryableTursoError, isUniqueViolation, normalizeTursoError, TursoError } from './errors';

/**
 * These tests drive the real Turso engine rather than fixture strings: the
 * classifier exists only to compensate for the engine collapsing every failure
 * into `GenericFailure`, so a hardcoded message would test nothing. If a Turso
 * upgrade changes the wording, these fail and the mapping gets updated.
 */
describe('Turso error classification (against the real engine)', () => {
  let dir: string;
  let db: Awaited<ReturnType<typeof connect>>;

  const captureError = async (fn: () => Promise<unknown>): Promise<unknown> => {
    try {
      await fn();
    } catch (error) {
      return error;
    }
    throw new Error('expected the statement to throw, but it succeeded');
  };

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'mastra-turso-errors-'));
    db = await connect(join(dir, 'test.db'));
    await db.exec(`CREATE TABLE p (id TEXT PRIMARY KEY, v TEXT NOT NULL, n INTEGER CHECK (n > 0))`);
    await db.exec(`CREATE TABLE u (id TEXT, email TEXT UNIQUE)`);
    await db.exec(`CREATE TABLE fk (id TEXT PRIMARY KEY, pid TEXT REFERENCES p(id))`);
    await db.exec(`INSERT INTO p VALUES ('a', 'v', 1)`);
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('reconstructs SQLITE_CONSTRAINT_UNIQUE from a primary key conflict', async () => {
    const raw = await captureError(() => db.prepare(`INSERT INTO p VALUES ('a', 'v', 1)`).run());

    // Guards the premise: if this ever stops being opaque, the classifier can go.
    expect((raw as { code?: string }).code).toBe('GenericFailure');

    const error = normalizeTursoError(raw);
    expect(error).toBeInstanceOf(TursoError);
    expect(error.code).toBe('SQLITE_CONSTRAINT');
    expect(error.extendedCode).toBe('SQLITE_CONSTRAINT_UNIQUE');
    expect(isUniqueViolation(error)).toBe(true);
    expect(error.cause).toBe(raw);
  });

  it('reconstructs SQLITE_CONSTRAINT_UNIQUE from a unique index conflict', async () => {
    await db.prepare(`INSERT INTO u VALUES ('1', 'dup@example.com')`).run();
    const raw = await captureError(() => db.prepare(`INSERT INTO u VALUES ('2', 'dup@example.com')`).run());

    const error = normalizeTursoError(raw);
    expect(error.extendedCode).toBe('SQLITE_CONSTRAINT_UNIQUE');
    expect(isUniqueViolation(error)).toBe(true);
  });

  it.each([
    ['NOT NULL', `INSERT INTO p (id) VALUES ('b')`, 'SQLITE_CONSTRAINT_NOTNULL'],
    ['CHECK', `INSERT INTO p VALUES ('c', 'v', -5)`, 'SQLITE_CONSTRAINT_CHECK'],
  ])('does not misclassify a %s violation as a unique conflict', async (_label, sql, expected) => {
    const raw = await captureError(() => db.prepare(sql).run());
    const error = normalizeTursoError(raw);

    expect(error.code).toBe('SQLITE_CONSTRAINT');
    expect(error.extendedCode).toBe(expected);
    // The load-bearing assertion: these are real defects, not insert races, and
    // must never be swallowed by upsert-recovery paths.
    expect(isUniqueViolation(error)).toBe(false);
    expect(isRetryableTursoError(error)).toBe(false);
  });

  it('reconstructs SQLITE_CONSTRAINT_FOREIGNKEY', async () => {
    await db.exec('PRAGMA foreign_keys=ON');
    const raw = await captureError(() => db.prepare(`INSERT INTO fk VALUES ('f', 'missing')`).run());
    const error = normalizeTursoError(raw);

    expect(error.extendedCode).toBe('SQLITE_CONSTRAINT_FOREIGNKEY');
    expect(isUniqueViolation(error)).toBe(false);
  });

  it('reconstructs SQLITE_BUSY from lock contention and marks it retryable', async () => {
    const busyDir = join(dir, 'busy.db');
    const writerA = await connect(busyDir);
    const writerB = await connect(busyDir);
    await writerA.exec('CREATE TABLE t (id INTEGER)');
    await writerA.exec('BEGIN IMMEDIATE');
    await writerA.exec('INSERT INTO t VALUES (1)');

    const raw = await captureError(async () => {
      await writerB.exec('BEGIN IMMEDIATE');
      await writerB.exec('INSERT INTO t VALUES (2)');
    });
    await writerA.exec('ROLLBACK');

    const error = normalizeTursoError(raw);
    expect(error.code).toBe('SQLITE_BUSY');
    expect(isRetryableTursoError(error)).toBe(true);
    expect(isUniqueViolation(error)).toBe(false);
  });

  it('classifies nested transactions as misuse rather than retryable contention', async () => {
    // "cannot start a transaction within a transaction" is a caller bug. Were it
    // classified as busy, a retry loop would spin on it until it exhausted.
    const [code] = classifyTursoMessage(
      'step failed: Transaction error: cannot start a transaction within a transaction',
    );
    expect(code).toBe('SQLITE_MISUSE');
    expect(isRetryableTursoError(new TursoError('x', code))).toBe(false);
  });

  it.each([
    ['missing table', `SELECT * FROM nope`],
    ['missing column', `SELECT zzz FROM p`],
    ['syntax error', `SELEKT 1`],
  ])('reconstructs SQLITE_ERROR for %s', async (_label, sql) => {
    const raw = await captureError(async () => db.prepare(sql).all());
    expect(normalizeTursoError(raw).code).toBe('SQLITE_ERROR');
  });

  it('prefixes context and preserves the original error as cause', async () => {
    const raw = await captureError(() => db.prepare(`INSERT INTO p VALUES ('a', 'v', 1)`).run());
    const error = normalizeTursoError(raw, 'saveThread');

    expect(error.message).toMatch(/^saveThread: /);
    expect(error.cause).toBe(raw);
  });

  it('passes an already-normalized error through unchanged', () => {
    const original = new TursoError('boom', 'SQLITE_BUSY');
    expect(normalizeTursoError(original, 'ignored')).toBe(original);
  });

  it('falls back to SQLITE_UNKNOWN instead of guessing', () => {
    const error = normalizeTursoError(new Error('something entirely new'));
    expect(error.code).toBe('SQLITE_UNKNOWN');
    expect(isRetryableTursoError(error)).toBe(false);
    expect(isUniqueViolation(error)).toBe(false);
  });
});
