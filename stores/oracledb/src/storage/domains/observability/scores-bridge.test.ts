import type { BatchCreateScoresArgs, ScoreRecord } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import { OracleDB } from '../../db';
import { batchCreateScores } from './scores-bridge';

function createOracleDb(connectionOverrides: Record<string, unknown> = {}) {
  const connection = {
    execute: vi.fn(async () => ({ rows: [] })),
    executeMany: vi.fn(async () => ({ rowsAffected: 1 })),
    commit: vi.fn(async () => undefined),
    rollback: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
    ...connectionOverrides,
  };
  const poolManager = {
    withConnection: vi.fn(async (callback: (connection: typeof connection) => Promise<unknown>) => callback(connection)),
  };

  return { db: new OracleDB({ poolManager: poolManager as any }), connection };
}

function createScoreRecord(overrides: Partial<ScoreRecord> = {}): ScoreRecord {
  return {
    timestamp: new Date('2026-01-01T00:00:00.000Z'),
    scorerId: 'scorer-1',
    score: 1,
    ...overrides,
  } as ScoreRecord;
}

describe('batchCreateScores transaction (CR-08)', () => {
  it('persists every score in the batch inside a single transaction', async () => {
    const { db, connection } = createOracleDb();
    const args: BatchCreateScoresArgs = {
      scores: [createScoreRecord({ scoreId: 'score-1' }), createScoreRecord({ scoreId: 'score-2' })],
    };

    await expect(batchCreateScores(db, undefined, args)).resolves.toBeUndefined();

    // One INSERT per score, committed once as a single transaction.
    expect(connection.execute).toHaveBeenCalledTimes(2);
    expect(connection.commit).toHaveBeenCalledOnce();
    expect(connection.rollback).not.toHaveBeenCalled();
  });

  it('leaves zero rows persisted when one score in the batch fails to insert', async () => {
    const { db, connection } = createOracleDb();
    connection.execute
      .mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce(new Error('insert failed'));

    const args: BatchCreateScoresArgs = {
      scores: [createScoreRecord({ scoreId: 'score-1' }), createScoreRecord({ scoreId: 'score-2' })],
    };

    await expect(batchCreateScores(db, undefined, args)).rejects.toThrow();

    // Both inserts were attempted on the same connection before the batch
    // failed, but the transaction must roll back instead of partially
    // committing -- zero rows persisted, not one.
    expect(connection.execute).toHaveBeenCalledTimes(2);
    expect(connection.commit).not.toHaveBeenCalled();
    expect(connection.rollback).toHaveBeenCalledOnce();
  });
});

describe('scoreRecordToTableRecord metadata folding (CR-13)', () => {
  it('keeps metadata keys that are only present on the original score.metadata', async () => {
    const batchInsert = vi.fn(async () => undefined);
    const db = { batchInsert } as unknown as OracleDB;

    const score = createScoreRecord({
      scoreId: 'score-1',
      // entityName is absent at the top level, but was already recorded in metadata.
      entityName: undefined,
      metadata: { entityName: 'original-entity-name', customField: 'kept' },
    });

    await batchCreateScores(db, undefined, { scores: [score] });

    expect(batchInsert).toHaveBeenCalledOnce();
    const records = batchInsert.mock.calls[0]?.[0]?.records as Array<Record<string, unknown>>;
    expect(records[0]?.metadata).toMatchObject({
      entityName: 'original-entity-name',
      customField: 'kept',
    });
  });

  it('lets a defined top-level contextual field override the same metadata key', async () => {
    const batchInsert = vi.fn(async () => undefined);
    const db = { batchInsert } as unknown as OracleDB;

    const score = createScoreRecord({
      scoreId: 'score-1',
      entityName: 'new-entity-name',
      metadata: { entityName: 'stale-entity-name' },
    });

    await batchCreateScores(db, undefined, { scores: [score] });

    const records = batchInsert.mock.calls[0]?.[0]?.records as Array<Record<string, unknown>>;
    expect(records[0]?.metadata).toMatchObject({ entityName: 'new-entity-name' });
  });
});
