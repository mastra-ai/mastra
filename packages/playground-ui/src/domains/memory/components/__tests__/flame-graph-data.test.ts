import { describe, expect, it } from 'vitest';

import type { ExtractedOmMarker } from '../../lib/extract-markers';
import type { TDomain } from '../../lib/timeline';
import type { MemoryMessage, OMHistoryRecord } from '../../types';
import {
  getObservationTimestamp,
  toActiveObservationData,
  toBufferedObservationData,
  toCombinedRowData,
  toContextData,
  toEventData,
  toMessageData,
} from '../flame-graph-data';

// A ten-minute window, so a timestamp's `t` reads straight off the clock:
// 10:00 → 0, 10:05 → 0.5, 10:10 → 1.
const domain: TDomain = {
  tMin: new Date('2026-06-01T10:00:00.000Z').getTime(),
  tMax: new Date('2026-06-01T10:10:00.000Z').getTime(),
};

function makeRecord(overrides: Partial<OMHistoryRecord> & Pick<OMHistoryRecord, 'id'>): OMHistoryRecord {
  return {
    scope: 'thread',
    resourceId: 'resource-1',
    threadId: 'thread-1',
    activeObservations: '',
    originType: 'observation',
    generationCount: 1,
    totalTokensObserved: 0,
    observationTokenCount: 0,
    pendingMessageTokens: 0,
    isObserving: false,
    isReflecting: false,
    config: { messageTokens: 2000, observationTokens: 1000 },
    createdAt: '2026-06-01T10:00:00.000Z',
    updatedAt: '2026-06-01T10:00:00.000Z',
    ...overrides,
  };
}

function makeMarker(overrides: Partial<ExtractedOmMarker> & Pick<ExtractedOmMarker, 'type' | 'timestamp'>) {
  return overrides as ExtractedOmMarker;
}

describe('getObservationTimestamp', () => {
  it('prefers the moment the record was last observed', () => {
    const record = makeRecord({
      id: 'om-1',
      lastObservedAt: '2026-06-01T10:05:00.000Z',
      updatedAt: '2026-06-01T10:09:00.000Z',
    });

    expect(getObservationTimestamp(record)).toBe('2026-06-01T10:05:00.000Z');
  });

  it('falls back to the update time for a record never observed', () => {
    const record = makeRecord({ id: 'om-1', updatedAt: '2026-06-01T10:09:00.000Z' });

    expect(getObservationTimestamp(record)).toBe('2026-06-01T10:09:00.000Z');
  });

  it('normalizes a Date to an ISO string', () => {
    const record = makeRecord({ id: 'om-1', lastObservedAt: new Date('2026-06-01T10:05:00.000Z') as never });

    expect(getObservationTimestamp(record)).toBe('2026-06-01T10:05:00.000Z');
  });
});

describe('toContextData', () => {
  it('places each record on the timeline by its observation time', () => {
    const data = toContextData(
      [makeRecord({ id: 'om-1', lastObservedAt: '2026-06-01T10:05:00.000Z', pendingMessageTokens: 540 })],
      [],
      domain,
    );

    expect(data).toEqual([{ t: 0.5, pendingMessageTokens: 540 }]);
  });

  it('merges records and stream markers into one series, ordered in time', () => {
    const data = toContextData(
      [makeRecord({ id: 'om-1', lastObservedAt: '2026-06-01T10:05:00.000Z', pendingMessageTokens: 540 })],
      [makeMarker({ type: 'status', timestamp: '2026-06-01T10:02:00.000Z', pendingTokens: 120 })],
      domain,
    );

    // The marker is earlier than the record and must come first.
    expect(data.map(point => point.t)).toEqual([0.2, 0.5]);
    expect(data.map(point => point.pendingMessageTokens)).toEqual([120, 540]);
  });

  it('drops a marker that carries no pending count', () => {
    const data = toContextData([], [makeMarker({ type: 'status', timestamp: '2026-06-01T10:02:00.000Z' })], domain);

    expect(data).toEqual([]);
  });

  it('keeps a marker reporting zero pending tokens', () => {
    const data = toContextData(
      [],
      [makeMarker({ type: 'status', timestamp: '2026-06-01T10:02:00.000Z', pendingTokens: 0 })],
      domain,
    );

    // Zero is a real reading — the buffer was just drained.
    expect(data).toEqual([{ t: 0.2, pendingMessageTokens: 0 }]);
  });

  it('takes markers of every type, not only status ones', () => {
    const data = toContextData(
      [],
      [makeMarker({ type: 'activation', timestamp: '2026-06-01T10:02:00.000Z', pendingTokens: 120 })],
      domain,
    );

    expect(data).toEqual([{ t: 0.2, pendingMessageTokens: 120 }]);
  });
});

describe('toActiveObservationData', () => {
  it('never lets the running total go down', () => {
    const data = toActiveObservationData(
      [
        makeRecord({ id: 'om-1', lastObservedAt: '2026-06-01T10:02:00.000Z', observationTokenCount: 320 }),
        // A later record reports fewer tokens (a reflection compacted them);
        // the charted high-water mark must hold.
        makeRecord({ id: 'om-2', lastObservedAt: '2026-06-01T10:05:00.000Z', observationTokenCount: 100 }),
        makeRecord({ id: 'om-3', lastObservedAt: '2026-06-01T10:08:00.000Z', observationTokenCount: 640 }),
      ],
      [],
      domain,
    );

    expect(data).toEqual([
      { t: 0.2, observationTokenCount: 320 },
      { t: 0.5, observationTokenCount: 320 },
      { t: 0.8, observationTokenCount: 640 },
    ]);
  });

  it('applies the high-water mark in time order, not input order', () => {
    const data = toActiveObservationData(
      [
        makeRecord({ id: 'om-2', lastObservedAt: '2026-06-01T10:08:00.000Z', observationTokenCount: 640 }),
        makeRecord({ id: 'om-1', lastObservedAt: '2026-06-01T10:02:00.000Z', observationTokenCount: 320 }),
      ],
      [],
      domain,
    );

    expect(data.map(point => point.observationTokenCount)).toEqual([320, 640]);
  });

  it('takes observation counts from status markers too', () => {
    const data = toActiveObservationData(
      [],
      [makeMarker({ type: 'status', timestamp: '2026-06-01T10:05:00.000Z', observationTokens: 400 })],
      domain,
    );

    expect(data).toEqual([{ t: 0.5, observationTokenCount: 400 }]);
  });

  it('ignores a marker that is not a status one', () => {
    const data = toActiveObservationData(
      [],
      [makeMarker({ type: 'buffering-end', timestamp: '2026-06-01T10:05:00.000Z', observationTokens: 400 })],
      domain,
    );

    expect(data).toEqual([]);
  });

  it('ignores a status marker with no observation count', () => {
    const data = toActiveObservationData(
      [],
      [makeMarker({ type: 'status', timestamp: '2026-06-01T10:05:00.000Z' })],
      domain,
    );

    expect(data).toEqual([]);
  });
});

describe('toBufferedObservationData', () => {
  it('adds what buffering produced and subtracts what activation consumed', () => {
    const data = toBufferedObservationData(
      [
        makeMarker({ type: 'buffering-end', timestamp: '2026-06-01T10:02:00.000Z', observationTokens: 300 }),
        makeMarker({ type: 'buffering-end', timestamp: '2026-06-01T10:05:00.000Z', observationTokens: 200 }),
        makeMarker({ type: 'activation', timestamp: '2026-06-01T10:08:00.000Z', observationTokens: 300 }),
      ],
      domain,
    );

    expect(data).toEqual([
      { t: 0.2, bufferedObservationTokenCount: 300 },
      { t: 0.5, bufferedObservationTokenCount: 500 },
      { t: 0.8, bufferedObservationTokenCount: 200 },
    ]);
  });

  it('never lets the buffer go negative', () => {
    const data = toBufferedObservationData(
      [
        makeMarker({ type: 'buffering-end', timestamp: '2026-06-01T10:02:00.000Z', observationTokens: 100 }),
        // Activation drains more than was ever buffered — the floor is empty, not owed.
        makeMarker({ type: 'activation', timestamp: '2026-06-01T10:05:00.000Z', observationTokens: 400 }),
      ],
      domain,
    );

    expect(data.map(point => point.bufferedObservationTokenCount)).toEqual([100, 0]);
  });

  it('runs the buffer in time order, not input order', () => {
    const data = toBufferedObservationData(
      [
        makeMarker({ type: 'activation', timestamp: '2026-06-01T10:08:00.000Z', observationTokens: 100 }),
        makeMarker({ type: 'buffering-end', timestamp: '2026-06-01T10:02:00.000Z', observationTokens: 300 }),
      ],
      domain,
    );

    expect(data.map(point => point.bufferedObservationTokenCount)).toEqual([300, 200]);
  });

  it.each(['status', 'observation-start', 'observation-end', 'buffering-start'] as const)(
    'ignores a %s marker, which says nothing about the buffer',
    type => {
      const data = toBufferedObservationData(
        [makeMarker({ type, timestamp: '2026-06-01T10:02:00.000Z', observationTokens: 300 })],
        domain,
      );

      expect(data).toEqual([]);
    },
  );

  it('ignores a buffering marker with no token count', () => {
    const data = toBufferedObservationData(
      [makeMarker({ type: 'buffering-end', timestamp: '2026-06-01T10:02:00.000Z' })],
      domain,
    );

    expect(data).toEqual([]);
  });
});

describe('toEventData', () => {
  it('marks one event per record, in time order', () => {
    const data = toEventData(
      [
        makeRecord({ id: 'om-2', lastObservedAt: '2026-06-01T10:08:00.000Z' }),
        makeRecord({ id: 'om-1', lastObservedAt: '2026-06-01T10:02:00.000Z' }),
      ],
      domain,
    );

    expect(data).toEqual([
      { t: 0.2, event: 1 },
      { t: 0.8, event: 1 },
    ]);
  });

  it('leaves the records it was handed in their original order', () => {
    const records = [
      makeRecord({ id: 'om-2', lastObservedAt: '2026-06-01T10:08:00.000Z' }),
      makeRecord({ id: 'om-1', lastObservedAt: '2026-06-01T10:02:00.000Z' }),
    ];

    toEventData(records, domain);

    expect(records.map(record => record.id)).toEqual(['om-2', 'om-1']);
  });
});

describe('toMessageData', () => {
  const makeMessage = (id: string, createdAt: string, role: MemoryMessage['role']): MemoryMessage => ({
    id,
    role,
    createdAt: new Date(createdAt),
    threadId: 'thread-1',
    resourceId: 'resource-1',
    content: { format: 2, parts: [] },
  });

  it('marks one event per message, in time order, keeping who sent it', () => {
    const data = toMessageData(
      [
        makeMessage('msg-2', '2026-06-01T10:08:00.000Z', 'assistant'),
        makeMessage('msg-1', '2026-06-01T10:02:00.000Z', 'user'),
      ],
      domain,
    );

    expect(data).toEqual([
      { t: 0.2, event: 1, role: 'user' },
      { t: 0.8, event: 1, role: 'assistant' },
    ]);
  });

  it('leaves the messages it was handed in their original order', () => {
    const messages = [
      makeMessage('msg-2', '2026-06-01T10:08:00.000Z', 'assistant'),
      makeMessage('msg-1', '2026-06-01T10:02:00.000Z', 'user'),
    ];

    toMessageData(messages, domain);

    expect(messages.map(message => message.id)).toEqual(['msg-2', 'msg-1']);
  });
});

describe('toCombinedRowData', () => {
  it('keeps an event on the curve at the value in force at its moment', () => {
    const combined = toCombinedRowData(
      [
        { t: 0, tokens: 100 },
        { t: 0.5, tokens: 400 },
      ],
      'tokens',
      [{ t: 0.25, event: 1 }],
    );

    // The event at 0.25 rides the last reading (100), not a drop to zero.
    expect(combined).toEqual([
      { t: 0, tokens: 100 },
      { t: 0.25, event: 1, tokens: 100 },
      { t: 0.5, tokens: 400 },
    ]);
  });

  it('starts an event before the first reading at zero', () => {
    const combined = toCombinedRowData([{ t: 0.5, tokens: 400 }], 'tokens', [{ t: 0.1, event: 1 }]);

    expect(combined).toEqual([
      { t: 0.1, event: 1, tokens: 0 },
      { t: 0.5, tokens: 400 },
    ]);
  });

  it('orders the merged timeline no matter how the inputs came in', () => {
    const combined = toCombinedRowData(
      [
        { t: 0.9, tokens: 900 },
        { t: 0.1, tokens: 100 },
      ],
      'tokens',
      [{ t: 0.5, event: 1 }],
    );

    expect(combined.map(point => point.t)).toEqual([0.1, 0.5, 0.9]);
  });

  it('keeps every event that lands on the same moment', () => {
    const combined = toCombinedRowData([{ t: 0.5, tokens: 400 }], 'tokens', [
      { t: 0.5, event: 1, role: 'user' },
      { t: 0.5, event: 1, role: 'assistant' },
    ]);

    expect(combined).toEqual([
      { t: 0.5, event: 1, role: 'user', tokens: 400 },
      { t: 0.5, event: 1, role: 'assistant', tokens: 400 },
    ]);
  });

  it('carries each event its own fields through the merge', () => {
    const combined = toCombinedRowData([], 'tokens', [{ t: 0.5, event: 1, role: 'user' }]);

    expect(combined[0]).toMatchObject({ role: 'user', event: 1 });
  });

  it('skips an area point that is not on the timeline at all', () => {
    const combined = toCombinedRowData(
      [{ tokens: 999 } as Record<string, number>, { t: 0.5, tokens: 400 }],
      'tokens',
      [],
    );

    expect(combined).toEqual([{ t: 0.5, tokens: 400 }]);
  });

  it('reads a missing value on an area point as zero', () => {
    const combined = toCombinedRowData([{ t: 0.5 } as Record<string, number>], 'tokens', []);

    expect(combined).toEqual([{ t: 0.5, tokens: 0 }]);
  });

  it('charts an area series on its own', () => {
    const combined = toCombinedRowData([{ t: 0.5, tokens: 400 }], 'tokens', []);

    expect(combined).toEqual([{ t: 0.5, tokens: 400 }]);
  });

  it('returns nothing for two empty series', () => {
    expect(toCombinedRowData([], 'tokens', [])).toEqual([]);
  });

  it('lets an event and a reading at the same moment become one point', () => {
    const combined = toCombinedRowData([{ t: 0.5, tokens: 400 }], 'tokens', [{ t: 0.5, event: 1 }]);

    expect(combined).toEqual([{ t: 0.5, event: 1, tokens: 400 }]);
  });
});
