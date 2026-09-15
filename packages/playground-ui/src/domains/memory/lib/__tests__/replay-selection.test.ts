import { describe, expect, it } from 'vitest';

import type { OMHistoryRecord } from '../../types';
import { findRecordIdAtOrBefore, getObservationTimestamp, tToTimestampMs } from '../replay-selection';

function record(id: string, lastObservedAt: string, updatedAt: string = lastObservedAt): OMHistoryRecord {
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
    updatedAt,
  } as OMHistoryRecord;
}

const records = [
  record('a', '2026-06-01T10:00:00.000Z'),
  record('c', '2026-06-01T10:20:00.000Z'),
  record('b', '2026-06-01T10:10:00.000Z'),
];

describe('getObservationTimestamp', () => {
  it('passes a string timestamp through verbatim rather than re-serializing it', () => {
    // The raw API string is the timeline key elsewhere, so it must not be
    // normalized (e.g. `...:00Z` must not become `...:00.000Z`).
    expect(getObservationTimestamp(record('a', '2026-06-01T10:00:00Z'))).toBe('2026-06-01T10:00:00Z');
  });

  it('serializes a Date timestamp to an ISO string', () => {
    const withDate = {
      ...record('a', '2026-06-01T10:00:00.000Z'),
      lastObservedAt: new Date('2026-06-01T09:30:00.000Z'),
    } as unknown as OMHistoryRecord;

    expect(getObservationTimestamp(withDate)).toBe('2026-06-01T09:30:00.000Z');
  });

  it('prefers lastObservedAt over updatedAt when both are present', () => {
    expect(getObservationTimestamp(record('a', '2026-06-01T10:00:00.000Z', '2026-06-01T11:00:00.000Z'))).toBe(
      '2026-06-01T10:00:00.000Z',
    );
  });

  it('falls back to updatedAt when lastObservedAt is missing', () => {
    const withoutObservation = {
      ...record('a', '2026-06-01T10:00:00.000Z', '2026-06-01T11:00:00.000Z'),
      lastObservedAt: null,
    } as unknown as OMHistoryRecord;

    expect(getObservationTimestamp(withoutObservation)).toBe('2026-06-01T11:00:00.000Z');
  });
});

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

  it('sorts ascending before matching, so descending input still yields the latest match', () => {
    const descending = [
      record('c', '2026-06-01T10:20:00.000Z'),
      record('b', '2026-06-01T10:10:00.000Z'),
      record('a', '2026-06-01T10:00:00.000Z'),
    ];
    const cursor = new Date('2026-06-01T10:15:00.000Z').getTime();

    expect(findRecordIdAtOrBefore(descending, cursor)).toBe('b');
  });

  it('returns the last record when the cursor is after all records', () => {
    const cursor = new Date('2026-06-01T11:00:00.000Z').getTime();
    expect(findRecordIdAtOrBefore(records, cursor)).toBe('c');
  });

  it('returns null when cursor is null', () => {
    expect(findRecordIdAtOrBefore(records, null)).toBeNull();
  });

  it('returns null for a null cursor even when a record sits on the epoch', () => {
    // A null cursor must short-circuit; it must never be coerced to 0 and match
    // the epoch record.
    const withEpochRecord = [record('epoch', '1970-01-01T00:00:00.000Z'), ...records];

    expect(findRecordIdAtOrBefore(withEpochRecord, null)).toBeNull();
  });

  it('uses lastObservedAt rather than updatedAt to place a record on the timeline', () => {
    const shifted = [record('a', '2026-06-01T10:00:00.000Z', '2026-06-01T23:00:00.000Z')];
    const cursor = new Date('2026-06-01T10:30:00.000Z').getTime();

    expect(findRecordIdAtOrBefore(shifted, cursor)).toBe('a');
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
