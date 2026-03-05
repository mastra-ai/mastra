import type { MastraDBMessage } from '@mastra/core/agent';
import type { ObservationalMemoryRecord } from '@mastra/core/storage';
import { describe, it, expect } from 'vitest';

import {
  getBufferedChunks,
  findLastCompletedObservationBoundary,
  hasInProgressObservation,
  applySealToMessages,
  getUnobservedParts,
  hasUnobservedParts,
  createUnobservedMessage,
  getUnobservedMessages,
  withAbortCheck,
} from '../message-parts';

// =============================================================================
// Test Helpers
// =============================================================================

function makeMessage(
  parts: any[],
  opts?: { id?: string; role?: 'user' | 'assistant'; createdAt?: Date },
): MastraDBMessage {
  return {
    id: opts?.id ?? `msg-${Math.random().toString(36).slice(2, 8)}`,
    role: opts?.role ?? 'user',
    type: 'text',
    threadId: 'thread-1',
    createdAt: opts?.createdAt ?? new Date(),
    content: { format: 'v2', parts } as any,
  } as MastraDBMessage;
}

function textPart(text: string) {
  return { type: 'text', text };
}

function startMarker() {
  return { type: 'data-om-observation-start' };
}

function endMarker() {
  return { type: 'data-om-observation-end' };
}

function failedMarker() {
  return { type: 'data-om-observation-failed' };
}

function makeRecord(overrides?: Partial<ObservationalMemoryRecord>): ObservationalMemoryRecord {
  return {
    id: 'rec-1',
    threadId: 'thread-1',
    resourceId: 'resource-1',
    scope: 'thread',
    activeObservations: null,
    observationTokenCount: 0,
    lastObservedAt: null,
    observedMessageIds: [],
    pendingMessageTokens: 0,
    reflectionGeneration: 0,
    isReflecting: false,
    isObserving: false,
    isBufferingObservation: false,
    isBufferingReflection: false,
    bufferedObservationChunks: null,
    bufferedReflection: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    config: {},
    ...overrides,
  } as ObservationalMemoryRecord;
}

// =============================================================================
// getBufferedChunks
// =============================================================================

describe('getBufferedChunks', () => {
  it('returns empty array for null/undefined record', () => {
    expect(getBufferedChunks(null)).toEqual([]);
    expect(getBufferedChunks(undefined)).toEqual([]);
  });

  it('returns empty array when bufferedObservationChunks is absent', () => {
    expect(getBufferedChunks({} as any)).toEqual([]);
    expect(getBufferedChunks({ bufferedObservationChunks: undefined } as any)).toEqual([]);
    expect(getBufferedChunks({ bufferedObservationChunks: null } as any)).toEqual([]);
  });

  it('returns array chunks directly', () => {
    const chunks = [{ observations: '- test', tokenCount: 10, messageIds: ['m1'], cycleId: 'c1' }];
    expect(getBufferedChunks({ bufferedObservationChunks: chunks } as any)).toBe(chunks);
  });

  it('parses JSON string chunks', () => {
    const chunks = [{ observations: '- obs1', tokenCount: 5, messageIds: ['m1'], cycleId: 'c1' }];
    const result = getBufferedChunks({ bufferedObservationChunks: JSON.stringify(chunks) } as any);
    expect(result).toHaveLength(1);
    expect(result[0].observations).toBe('- obs1');
  });

  it('returns empty array for invalid JSON string', () => {
    expect(getBufferedChunks({ bufferedObservationChunks: 'not-json' } as any)).toEqual([]);
  });

  it('returns empty array for JSON that parses to non-array', () => {
    expect(getBufferedChunks({ bufferedObservationChunks: '42' } as any)).toEqual([]);
    expect(getBufferedChunks({ bufferedObservationChunks: '"string"' } as any)).toEqual([]);
    expect(getBufferedChunks({ bufferedObservationChunks: '{}' } as any)).toEqual([]);
  });
});

// =============================================================================
// findLastCompletedObservationBoundary
// =============================================================================

describe('findLastCompletedObservationBoundary', () => {
  it('returns -1 for message with no parts', () => {
    const msg = makeMessage([]);
    expect(findLastCompletedObservationBoundary(msg)).toBe(-1);
  });

  it('returns -1 for message with only text parts', () => {
    const msg = makeMessage([textPart('hello'), textPart('world')]);
    expect(findLastCompletedObservationBoundary(msg)).toBe(-1);
  });

  it('returns -1 for message with only a start marker', () => {
    const msg = makeMessage([textPart('hello'), startMarker()]);
    expect(findLastCompletedObservationBoundary(msg)).toBe(-1);
  });

  it('returns index of end marker', () => {
    const msg = makeMessage([textPart('hello'), startMarker(), endMarker()]);
    expect(findLastCompletedObservationBoundary(msg)).toBe(2);
  });

  it('returns index of the last end marker when multiple exist', () => {
    const msg = makeMessage([startMarker(), endMarker(), textPart('new'), startMarker(), endMarker()]);
    expect(findLastCompletedObservationBoundary(msg)).toBe(4);
  });

  it('ignores failed markers', () => {
    const msg = makeMessage([textPart('hello'), startMarker(), failedMarker()]);
    expect(findLastCompletedObservationBoundary(msg)).toBe(-1);
  });

  it('returns -1 for undefined parts', () => {
    const msg = { id: 'x', content: {} } as any;
    expect(findLastCompletedObservationBoundary(msg)).toBe(-1);
  });
});

// =============================================================================
// hasInProgressObservation
// =============================================================================

describe('hasInProgressObservation', () => {
  it('returns false for message with no parts', () => {
    expect(hasInProgressObservation(makeMessage([]))).toBe(false);
  });

  it('returns false for text-only message', () => {
    expect(hasInProgressObservation(makeMessage([textPart('hello')]))).toBe(false);
  });

  it('returns true when start marker has no end', () => {
    expect(hasInProgressObservation(makeMessage([textPart('hello'), startMarker()]))).toBe(true);
  });

  it('returns false when start is followed by end', () => {
    expect(hasInProgressObservation(makeMessage([startMarker(), endMarker()]))).toBe(false);
  });

  it('returns false when start is followed by failed', () => {
    expect(hasInProgressObservation(makeMessage([startMarker(), failedMarker()]))).toBe(false);
  });

  it('returns true when a new start follows a completed observation', () => {
    // completed obs, then new start without end
    const msg = makeMessage([startMarker(), endMarker(), textPart('new stuff'), startMarker()]);
    expect(hasInProgressObservation(msg)).toBe(true);
  });

  it('returns false for undefined parts', () => {
    expect(hasInProgressObservation({ id: 'x', content: {} } as any)).toBe(false);
  });
});

// =============================================================================
// applySealToMessages
// =============================================================================

describe('applySealToMessages', () => {
  it('sets sealed metadata on messages', () => {
    const msgs = [makeMessage([textPart('hello')]), makeMessage([textPart('world')])];
    applySealToMessages(msgs);

    for (const msg of msgs) {
      const meta = msg.content.metadata as { mastra?: { sealed?: boolean } };
      expect(meta.mastra?.sealed).toBe(true);

      const lastPart = msg.content.parts[msg.content.parts.length - 1] as {
        metadata?: { mastra?: { sealedAt?: number } };
      };
      expect(lastPart.metadata?.mastra?.sealedAt).toBeTypeOf('number');
    }
  });

  it('uses consistent sealedAt timestamp across all messages', () => {
    const msgs = [makeMessage([textPart('a')]), makeMessage([textPart('b')]), makeMessage([textPart('c')])];
    applySealToMessages(msgs);

    const timestamps = msgs.map(m => {
      const lastPart = m.content.parts[m.content.parts.length - 1] as {
        metadata?: { mastra?: { sealedAt?: number } };
      };
      return lastPart.metadata?.mastra?.sealedAt;
    });

    expect(timestamps[0]).toBe(timestamps[1]);
    expect(timestamps[1]).toBe(timestamps[2]);
  });

  it('skips messages without parts', () => {
    const msg = makeMessage([]);
    applySealToMessages([msg]);
    expect(msg.content.metadata).toBeUndefined();
  });

  it('preserves existing metadata', () => {
    const msg = makeMessage([textPart('hi')]);
    (msg.content as any).metadata = { custom: 'value' };
    applySealToMessages([msg]);

    const meta = msg.content.metadata as any;
    expect(meta.custom).toBe('value');
    expect(meta.mastra.sealed).toBe(true);
  });

  it('handles empty array input', () => {
    expect(() => applySealToMessages([])).not.toThrow();
  });
});

// =============================================================================
// getUnobservedParts
// =============================================================================

describe('getUnobservedParts', () => {
  it('returns all parts for message with no markers', () => {
    const msg = makeMessage([textPart('a'), textPart('b')]);
    expect(getUnobservedParts(msg)).toEqual([textPart('a'), textPart('b')]);
  });

  it('returns empty array for message with no parts', () => {
    expect(getUnobservedParts(makeMessage([]))).toEqual([]);
  });

  it('returns parts after end marker for completed observation', () => {
    const msg = makeMessage([textPart('old'), startMarker(), endMarker(), textPart('new1'), textPart('new2')]);
    const result = getUnobservedParts(msg);
    expect(result).toEqual([textPart('new1'), textPart('new2')]);
  });

  it('returns empty when all parts are before the end marker', () => {
    const msg = makeMessage([textPart('old'), startMarker(), endMarker()]);
    expect(getUnobservedParts(msg)).toEqual([]);
  });

  it('returns only parts before start marker for in-progress observations', () => {
    const msg = makeMessage([textPart('content'), startMarker()]);
    const result = getUnobservedParts(msg);
    expect(result).toEqual([textPart('content')]);
  });

  it('excludes parts after start marker during in-progress observation', () => {
    const msg = makeMessage([textPart('before'), startMarker(), textPart('during-obs')]);
    const result = getUnobservedParts(msg);
    expect(result).toEqual([textPart('before')]);
  });

  it('treats failed marker as closing an in-progress observation', () => {
    // start + failed = not in-progress (failed terminates the observation)
    // but findLastCompletedObservationBoundary only looks for 'end', not 'failed'
    // so this falls to the fallback branch → returns all non-observation parts
    const msg = makeMessage([textPart('old'), startMarker(), failedMarker(), textPart('new')]);
    const result = getUnobservedParts(msg);
    expect(result).toEqual([textPart('old'), textPart('new')]);
  });

  it('filters failed markers from messages with no start or end', () => {
    const msg = makeMessage([textPart('a'), failedMarker(), textPart('b')]);
    const result = getUnobservedParts(msg);
    // No start/end markers → fallback branch filters stale observation markers
    expect(result).toEqual([textPart('a'), textPart('b')]);
  });

  it('filters out observation markers from parts after end marker', () => {
    const msg = makeMessage([
      startMarker(),
      endMarker(),
      textPart('new'),
      startMarker(),
      textPart('during-obs'),
      endMarker(),
    ]);
    // Should get parts after the LAST end marker, filtering observation markers
    const result = getUnobservedParts(msg);
    expect(result).toEqual([]);
  });

  it('returns empty array for undefined parts', () => {
    expect(getUnobservedParts({ id: 'x', content: {} } as any)).toEqual([]);
  });
});

// =============================================================================
// hasUnobservedParts
// =============================================================================

describe('hasUnobservedParts', () => {
  it('returns true when message has unobserved text parts', () => {
    expect(hasUnobservedParts(makeMessage([textPart('hello')]))).toBe(true);
  });

  it('returns false for empty message', () => {
    expect(hasUnobservedParts(makeMessage([]))).toBe(false);
  });

  it('returns false when all parts are before end marker', () => {
    expect(hasUnobservedParts(makeMessage([textPart('old'), startMarker(), endMarker()]))).toBe(false);
  });

  it('returns true when parts exist after end marker', () => {
    expect(hasUnobservedParts(makeMessage([startMarker(), endMarker(), textPart('new')]))).toBe(true);
  });
});

// =============================================================================
// createUnobservedMessage
// =============================================================================

describe('createUnobservedMessage', () => {
  it('returns null when no unobserved parts exist', () => {
    const msg = makeMessage([startMarker(), endMarker()]);
    expect(createUnobservedMessage(msg)).toBeNull();
  });

  it('returns a virtual message with only unobserved parts', () => {
    const msg = makeMessage([textPart('old'), startMarker(), endMarker(), textPart('new')], {
      id: 'msg-1',
      role: 'assistant',
    });
    const result = createUnobservedMessage(msg);

    expect(result).not.toBeNull();
    expect(result!.id).toBe('msg-1');
    expect(result!.role).toBe('assistant');
    expect(result!.content.parts).toEqual([textPart('new')]);
  });

  it('does not mutate the original message', () => {
    const originalParts = [textPart('old'), startMarker(), endMarker(), textPart('new')];
    const msg = makeMessage([...originalParts]);
    createUnobservedMessage(msg);
    expect(msg.content.parts).toHaveLength(4);
  });

  it('returns full message when no markers exist', () => {
    const msg = makeMessage([textPart('a'), textPart('b')]);
    const result = createUnobservedMessage(msg);
    expect(result).not.toBeNull();
    expect(result!.content.parts).toEqual([textPart('a'), textPart('b')]);
  });
});

// =============================================================================
// getUnobservedMessages
// =============================================================================

describe('getUnobservedMessages', () => {
  it('returns all messages when record has no lastObservedAt and no observedMessageIds', () => {
    const msgs = [makeMessage([textPart('a')], { id: 'msg-1' }), makeMessage([textPart('b')], { id: 'msg-2' })];
    const record = makeRecord();
    expect(getUnobservedMessages(msgs, record)).toHaveLength(2);
  });

  it('excludes messages in observedMessageIds', () => {
    const msgs = [makeMessage([textPart('a')], { id: 'msg-1' }), makeMessage([textPart('b')], { id: 'msg-2' })];
    const record = makeRecord({ observedMessageIds: ['msg-1'] });
    const result = getUnobservedMessages(msgs, record);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('msg-2');
  });

  it('uses timestamp-based filtering when lastObservedAt is set', () => {
    const old = new Date('2025-01-01T00:00:00Z');
    const recent = new Date('2025-06-01T00:00:00Z');
    const msgs = [
      makeMessage([textPart('old')], { id: 'msg-1', createdAt: old }),
      makeMessage([textPart('new')], { id: 'msg-2', createdAt: recent }),
    ];
    const record = makeRecord({ lastObservedAt: new Date('2025-03-01T00:00:00Z') });
    const result = getUnobservedMessages(msgs, record);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('msg-2');
  });

  it('includes messages without timestamps', () => {
    const msg = makeMessage([textPart('no date')], { id: 'msg-1' });
    (msg as any).createdAt = undefined;
    const record = makeRecord({ lastObservedAt: new Date('2025-03-01T00:00:00Z') });
    const result = getUnobservedMessages([msg], record);
    expect(result).toHaveLength(1);
  });

  it('uses part-level filtering for messages with end markers', () => {
    const msg = makeMessage([textPart('old'), startMarker(), endMarker(), textPart('new')], { id: 'msg-1' });
    const record = makeRecord({ lastObservedAt: new Date('2025-03-01T00:00:00Z') });
    const result = getUnobservedMessages([msg], record);
    expect(result).toHaveLength(1);
    // Virtual message should only have the new part
    expect(result[0].content.parts).toEqual([textPart('new')]);
  });

  it('excludes messages fully observed (end marker with no new parts)', () => {
    const msg = makeMessage([textPart('old'), startMarker(), endMarker()], { id: 'msg-1' });
    const record = makeRecord({ lastObservedAt: new Date('2025-03-01T00:00:00Z') });
    const result = getUnobservedMessages([msg], record);
    expect(result).toHaveLength(0);
  });

  it('includes in-progress observation messages', () => {
    const msg = makeMessage([textPart('content'), startMarker()], { id: 'msg-1' });
    const record = makeRecord({ lastObservedAt: new Date('2025-03-01T00:00:00Z') });
    const result = getUnobservedMessages([msg], record);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('msg-1');
  });

  it('includes messages with failed markers via timestamp filtering', () => {
    // start + failed = not in-progress, endMarkerIndex = -1 → falls to timestamp filtering
    const recent = new Date('2025-06-01T00:00:00Z');
    const msg = makeMessage([textPart('old'), startMarker(), failedMarker(), textPart('new')], {
      id: 'msg-1',
      createdAt: recent,
    });
    const record = makeRecord({ lastObservedAt: new Date('2025-03-01T00:00:00Z') });
    const result = getUnobservedMessages([msg], record);
    expect(result).toHaveLength(1);
    // Full message is included (timestamp-based), not a virtual message
    expect(result[0].id).toBe('msg-1');
  });

  it('excludes old messages with failed markers via timestamp filtering', () => {
    const old = new Date('2025-01-01T00:00:00Z');
    const msg = makeMessage([textPart('old'), startMarker(), failedMarker()], {
      id: 'msg-1',
      createdAt: old,
    });
    const record = makeRecord({ lastObservedAt: new Date('2025-03-01T00:00:00Z') });
    const result = getUnobservedMessages([msg], record);
    expect(result).toHaveLength(0);
  });

  describe('excludeBuffered option', () => {
    it('excludes buffered chunk message IDs when excludeBuffered is true', () => {
      const msgs = [
        makeMessage([textPart('buffered')], { id: 'msg-1' }),
        makeMessage([textPart('new')], { id: 'msg-2' }),
      ];
      const record = makeRecord({
        bufferedObservationChunks: [
          { observations: '- obs', tokenCount: 10, messageIds: ['msg-1'], cycleId: 'c1' },
        ] as any,
      });
      const result = getUnobservedMessages(msgs, record, { excludeBuffered: true });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('msg-2');
    });

    it('does not exclude buffered messages by default', () => {
      const msgs = [
        makeMessage([textPart('buffered')], { id: 'msg-1' }),
        makeMessage([textPart('new')], { id: 'msg-2' }),
      ];
      const record = makeRecord({
        bufferedObservationChunks: [
          { observations: '- obs', tokenCount: 10, messageIds: ['msg-1'], cycleId: 'c1' },
        ] as any,
      });
      const result = getUnobservedMessages(msgs, record);
      expect(result).toHaveLength(2);
    });
  });
});

// =============================================================================
// withAbortCheck
// =============================================================================

describe('withAbortCheck', () => {
  it('returns the result when not aborted', async () => {
    const result = await withAbortCheck(() => Promise.resolve(42));
    expect(result).toBe(42);
  });

  it('throws when signal is already aborted before call', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(withAbortCheck(() => Promise.resolve(42), controller.signal)).rejects.toThrow(
      'The operation was aborted.',
    );
  });

  it('throws when signal is aborted during the async operation', async () => {
    const controller = new AbortController();
    const fn = async () => {
      controller.abort();
      return 42;
    };
    await expect(withAbortCheck(fn, controller.signal)).rejects.toThrow('The operation was aborted.');
  });

  it('works without an abort signal', async () => {
    const result = await withAbortCheck(() => Promise.resolve('ok'));
    expect(result).toBe('ok');
  });

  it('works with undefined abort signal', async () => {
    const result = await withAbortCheck(() => Promise.resolve('ok'), undefined);
    expect(result).toBe('ok');
  });
});
