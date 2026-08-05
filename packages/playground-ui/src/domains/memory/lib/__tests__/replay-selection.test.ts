import { describe, expect, it } from 'vitest';

import type { OMHistoryRecord } from '../../types';
import { findRecordIdAtOrBefore, tToTimestampMs } from '../replay-selection';

function record(id: string, lastObservedAt: string): OMHistoryRecord {
  return {
    id,
    scope: 'thread',
    resourceId: 'agent-1',
    threadId: 'thread-1',
    activeObservations: '',
    originType: 'observation',
    generationCount: 1,
    lastObservedAt,
    totalTokensObserved: 0,
    observationTokenCount: 0,
    pendingMessageTokens: 0,
    isObserving: false,
    isReflecting: false,
    config: { messageTokens: 0, observationTokens: 0 },
    createdAt: lastObservedAt,
    updatedAt: lastObservedAt,
  } as OMHistoryRecord;
}

const records = [
  record('a', '2026-06-01T10:00:00.000Z'),
  record('c', '2026-06-01T10:20:00.000Z'),
  record('b', '2026-06-01T10:10:00.000Z'),
];

describe('findRecordIdAtOrBefore', () => {
  it('returns null for empty records', () => {
    expect(findRecordIdAtOrBefore([], Date.now())).toBeNull();
  });

  it('returns null when the cursor is before the first record', () => {
    const cursor = new Date('2026-06-01T09:00:00.000Z').getTime();
    expect(findRecordIdAtOrBefore(records, cursor)).toBeNull();
  });

  it('returns the record exactly at the cursor', () => {
    const cursor = new Date('2026-06-01T10:10:00.000Z').getTime();
    expect(findRecordIdAtOrBefore(records, cursor)).toBe('b');
  });

  it('returns the latest record at or before the cursor (unsorted input)', () => {
    const cursor = new Date('2026-06-01T10:15:00.000Z').getTime();
    expect(findRecordIdAtOrBefore(records, cursor)).toBe('b');
  });

  it('returns the last record when the cursor is after all records', () => {
    const cursor = new Date('2026-06-01T11:00:00.000Z').getTime();
    expect(findRecordIdAtOrBefore(records, cursor)).toBe('c');
  });

  it('returns null when cursor is null', () => {
    expect(findRecordIdAtOrBefore(records, null)).toBeNull();
  });
});

describe('tToTimestampMs', () => {
  const domain = {
    tMin: new Date('2026-06-01T10:00:00.000Z').getTime(),
    tMax: new Date('2026-06-01T11:00:00.000Z').getTime(),
  };

  it('maps 0 to the domain start', () => {
    expect(tToTimestampMs(0, domain)).toBe(domain.tMin);
  });

  it('maps 1 to the domain end', () => {
    expect(tToTimestampMs(1, domain)).toBe(domain.tMax);
  });

  it('maps 0.5 to the domain midpoint', () => {
    expect(tToTimestampMs(0.5, domain)).toBe(new Date('2026-06-01T10:30:00.000Z').getTime());
  });
});
