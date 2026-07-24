import type { ObservationalMemoryRecord } from '@mastra/core/storage';
import type { Connection } from 'oracledb';
import { describe, expect, it, vi } from 'vitest';

import { swapBufferedReflectionToActive } from './observational-buffering';
import type { MemoryContext } from './utils';

// CR-11: swapBufferedReflectionToActive already locks the observational memory
// row with `SELECT ... FOR UPDATE` before deriving the next generation, but the
// new record used to copy generationCount/totalTokensObserved/config/metadata/
// observedTimezone/lastObservedAt/scope/threadId/resourceId from the CALLER'S
// (possibly stale) `input.currentRecord` instead of the row it just locked.
// These tests pin the fix: those fields must come from the locked row.

const LOCKED_ROW = {
  id: 'om-1',
  lookupKey: 'thread:thread-fresh',
  scope: 'thread',
  resourceId: 'resource-fresh',
  threadId: 'thread-fresh',
  activeObservations: 'line1\nline2\nline3',
  activeObservationsPendingUpdate: null,
  originType: 'initial',
  config: JSON.stringify({ fresh: true }),
  generationCount: 5,
  lastObservedAt: new Date('2026-01-05T00:00:00.000Z'),
  lastReflectionAt: null,
  pendingMessageTokens: 0,
  totalTokensObserved: 999,
  observationTokenCount: 50,
  isObserving: 0,
  isReflecting: 0,
  observedMessageIds: null,
  observedTimezone: 'America/New_York',
  bufferedObservations: null,
  bufferedObservationTokens: null,
  bufferedMessageIds: null,
  bufferedReflection: 'the buffered reflection text',
  bufferedReflectionTokens: 42,
  bufferedReflectionInputTokens: 84,
  reflectedObservationLineCount: 2,
  bufferedObservationChunks: null,
  isBufferingObservation: 0,
  isBufferingReflection: 1,
  lastBufferedAtTokens: 0,
  lastBufferedAtTime: null,
  metadata: JSON.stringify({ fresh: true }),
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

// Deliberately different from LOCKED_ROW on every field the fix should stop
// reading, simulating a writer that changed the row between when the caller
// read `currentRecord` and when this swap acquired its lock.
const STALE_CURRENT_RECORD: ObservationalMemoryRecord = {
  id: 'om-1',
  scope: 'resource',
  threadId: 'thread-stale',
  resourceId: 'resource-stale',
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
  updatedAt: new Date('2025-06-01T00:00:00.000Z'),
  lastObservedAt: new Date('2025-06-01T00:00:00.000Z'),
  originType: 'initial',
  generationCount: 0,
  activeObservations: 'stale observations',
  totalTokensObserved: 100,
  observationTokenCount: 10,
  pendingMessageTokens: 0,
  isReflecting: true,
  isObserving: false,
  isBufferingObservation: false,
  isBufferingReflection: true,
  lastBufferedAtTokens: 0,
  lastBufferedAtTime: null,
  config: { stale: true },
  metadata: { stale: true },
  observedTimezone: 'UTC',
};

function createFakeCtx(): MemoryContext {
  const execute = vi.fn(async (sql: string) => {
    if (sql.includes('FOR UPDATE')) {
      return { rows: [LOCKED_ROW] };
    }
    // insertOMRecord's INSERT and the trailing UPDATE clearing buffered
    // reflection columns don't need row data back.
    return { rowsAffected: 1 };
  });
  const connection = { execute } as unknown as Connection;
  const db = {
    tx: vi.fn(async (callback: (client: unknown, connection: Connection) => Promise<unknown>) => callback({}, connection)),
  };
  return { db, schemaName: undefined } as unknown as MemoryContext;
}

describe('swapBufferedReflectionToActive (CR-11)', () => {
  it('derives the new generation from the locked row, not the caller-supplied currentRecord', async () => {
    const ctx = createFakeCtx();

    const result = await swapBufferedReflectionToActive(ctx, {
      currentRecord: STALE_CURRENT_RECORD,
      tokenCount: 12.7,
    });

    expect(result.scope).toBe(LOCKED_ROW.scope);
    expect(result.threadId).toBe(LOCKED_ROW.threadId);
    expect(result.resourceId).toBe(LOCKED_ROW.resourceId);
    expect(result.generationCount).toBe(LOCKED_ROW.generationCount + 1);
    expect(result.totalTokensObserved).toBe(LOCKED_ROW.totalTokensObserved);
    expect(result.config).toEqual({ fresh: true });
    expect(result.metadata).toEqual({ fresh: true });
    expect(result.observedTimezone).toBe(LOCKED_ROW.observedTimezone);
    expect(result.lastObservedAt).toEqual(LOCKED_ROW.lastObservedAt);

    // None of the stale values from input.currentRecord should leak through.
    expect(result.scope).not.toBe(STALE_CURRENT_RECORD.scope);
    expect(result.threadId).not.toBe(STALE_CURRENT_RECORD.threadId);
    expect(result.resourceId).not.toBe(STALE_CURRENT_RECORD.resourceId);
    expect(result.generationCount).not.toBe(STALE_CURRENT_RECORD.generationCount + 1);
    expect(result.totalTokensObserved).not.toBe(STALE_CURRENT_RECORD.totalTokensObserved);
    expect(result.observedTimezone).not.toBe(STALE_CURRENT_RECORD.observedTimezone);
  });

  it('still derives a fresh id and marks the new generation as originType reflection', async () => {
    const ctx = createFakeCtx();

    const result = await swapBufferedReflectionToActive(ctx, {
      currentRecord: STALE_CURRENT_RECORD,
      tokenCount: 5,
    });

    expect(result.id).not.toBe(STALE_CURRENT_RECORD.id);
    expect(result.originType).toBe('reflection');
    expect(result.isReflecting).toBe(false);
    expect(result.isBufferingReflection).toBe(false);
  });
});
