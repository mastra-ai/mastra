import type { MastraDBMessage, MastraMessageContentV2 } from '@mastra/core/agent';
import type { ObservationalMemoryRecord } from '@mastra/core/storage';
import { describe, it, expect } from 'vitest';

import {
  findLastCompletedObservationBoundary,
  hasInProgressObservation,
  sealMessagesForBuffering,
  getUnobservedParts,
  hasUnobservedParts,
  createUnobservedMessage,
  getUnobservedMessages,
  getBufferedChunks,
} from '../message-parts';

// =============================================================================
// Test Helpers
// =============================================================================

function createMsg(
  parts: MastraMessageContentV2['parts'],
  opts?: { id?: string; role?: 'user' | 'assistant'; createdAt?: Date },
): MastraDBMessage {
  return {
    id: opts?.id ?? 'msg-1',
    threadId: 'thread-1',
    role: opts?.role ?? 'user',
    type: 'text',
    content: { format: 2, parts },
    createdAt: opts?.createdAt ?? new Date('2026-01-01'),
  } as MastraDBMessage;
}

function textPart(text: string) {
  return { type: 'text' as const, text };
}

function markerPart(type: string) {
  return { type };
}

// =============================================================================
// findLastCompletedObservationBoundary
// =============================================================================

describe('findLastCompletedObservationBoundary', () => {
  it('returns -1 for message with no parts', () => {
    const msg = createMsg([]);
    expect(findLastCompletedObservationBoundary(msg)).toBe(-1);
  });

  it('returns -1 for message with only text parts', () => {
    const msg = createMsg([textPart('hello'), textPart('world')]);
    expect(findLastCompletedObservationBoundary(msg)).toBe(-1);
  });

  it('returns -1 for message with only start marker', () => {
    const msg = createMsg([textPart('hello'), markerPart('data-om-observation-start')]);
    expect(findLastCompletedObservationBoundary(msg)).toBe(-1);
  });

  it('returns index of end marker', () => {
    const msg = createMsg([
      textPart('hello'),
      markerPart('data-om-observation-start'),
      markerPart('data-om-observation-end'),
    ]);
    expect(findLastCompletedObservationBoundary(msg)).toBe(2);
  });

  it('returns last end marker index when multiple exist', () => {
    const msg = createMsg([
      markerPart('data-om-observation-start'),
      markerPart('data-om-observation-end'),
      textPart('new content'),
      markerPart('data-om-observation-start'),
      markerPart('data-om-observation-end'),
    ]);
    expect(findLastCompletedObservationBoundary(msg)).toBe(4);
  });

  it('handles null/undefined content', () => {
    const msg = { id: 'x', content: null } as unknown as MastraDBMessage;
    expect(findLastCompletedObservationBoundary(msg)).toBe(-1);
  });
});

// =============================================================================
// hasInProgressObservation
// =============================================================================

describe('hasInProgressObservation', () => {
  it('returns false for message with no parts', () => {
    expect(hasInProgressObservation(createMsg([]))).toBe(false);
  });

  it('returns false when no markers exist', () => {
    expect(hasInProgressObservation(createMsg([textPart('hello')]))).toBe(false);
  });

  it('returns true when start marker has no matching end', () => {
    const msg = createMsg([textPart('hello'), markerPart('data-om-observation-start')]);
    expect(hasInProgressObservation(msg)).toBe(true);
  });

  it('returns false when start + end both present', () => {
    const msg = createMsg([
      textPart('hello'),
      markerPart('data-om-observation-start'),
      markerPart('data-om-observation-end'),
    ]);
    expect(hasInProgressObservation(msg)).toBe(false);
  });

  it('returns false when start + failed both present', () => {
    const msg = createMsg([
      textPart('hello'),
      markerPart('data-om-observation-start'),
      markerPart('data-om-observation-failed'),
    ]);
    expect(hasInProgressObservation(msg)).toBe(false);
  });

  it('returns true when second observation is in progress', () => {
    const msg = createMsg([
      markerPart('data-om-observation-start'),
      markerPart('data-om-observation-end'),
      textPart('new content'),
      markerPart('data-om-observation-start'),
    ]);
    expect(hasInProgressObservation(msg)).toBe(true);
  });
});

// =============================================================================
// sealMessagesForBuffering
// =============================================================================

describe('sealMessagesForBuffering', () => {
  it('sets sealed metadata on messages', () => {
    const messages = [createMsg([textPart('hello')]), createMsg([textPart('world')], { id: 'msg-2' })];

    sealMessagesForBuffering(messages);

    for (const msg of messages) {
      const meta = msg.content.metadata as { mastra?: { sealed?: boolean } };
      expect(meta?.mastra?.sealed).toBe(true);

      const lastPart = msg.content.parts[msg.content.parts.length - 1] as {
        metadata?: { mastra?: { sealedAt?: number } };
      };
      expect(lastPart.metadata?.mastra?.sealedAt).toBeTypeOf('number');
    }
  });

  it('skips messages with empty parts', () => {
    const msg = createMsg([]);
    sealMessagesForBuffering([msg]);
    expect(msg.content.metadata).toBeUndefined();
  });

  it('uses consistent timestamp across all messages', () => {
    const messages = [createMsg([textPart('a')]), createMsg([textPart('b')], { id: 'msg-2' })];

    sealMessagesForBuffering(messages);

    const ts1 = (messages[0].content.parts[0] as any).metadata?.mastra?.sealedAt;
    const ts2 = (messages[1].content.parts[0] as any).metadata?.mastra?.sealedAt;
    expect(ts1).toBe(ts2);
  });
});

// =============================================================================
// getUnobservedParts
// =============================================================================

describe('getUnobservedParts', () => {
  it('returns all parts when no markers exist', () => {
    const msg = createMsg([textPart('hello'), textPart('world')]);
    expect(getUnobservedParts(msg)).toHaveLength(2);
  });

  it('excludes start markers when observation is in progress', () => {
    const msg = createMsg([textPart('hello'), markerPart('data-om-observation-start')]);
    const parts = getUnobservedParts(msg);
    expect(parts).toHaveLength(1);
    expect((parts[0] as any).text).toBe('hello');
  });

  it('returns parts after end marker', () => {
    const msg = createMsg([
      textPart('observed'),
      markerPart('data-om-observation-start'),
      markerPart('data-om-observation-end'),
      textPart('unobserved'),
    ]);
    const parts = getUnobservedParts(msg);
    expect(parts).toHaveLength(1);
    expect((parts[0] as any).text).toBe('unobserved');
  });

  it('returns empty for fully observed message', () => {
    const msg = createMsg([
      textPart('observed'),
      markerPart('data-om-observation-start'),
      markerPart('data-om-observation-end'),
    ]);
    expect(getUnobservedParts(msg)).toHaveLength(0);
  });

  it('returns empty array for null content', () => {
    const msg = { id: 'x', content: null } as unknown as MastraDBMessage;
    expect(getUnobservedParts(msg)).toEqual([]);
  });
});

// =============================================================================
// hasUnobservedParts
// =============================================================================

describe('hasUnobservedParts', () => {
  it('returns true when unobserved parts exist', () => {
    expect(hasUnobservedParts(createMsg([textPart('hello')]))).toBe(true);
  });

  it('returns false when all parts are observed', () => {
    const msg = createMsg([
      textPart('observed'),
      markerPart('data-om-observation-start'),
      markerPart('data-om-observation-end'),
    ]);
    expect(hasUnobservedParts(msg)).toBe(false);
  });
});

// =============================================================================
// createUnobservedMessage
// =============================================================================

describe('createUnobservedMessage', () => {
  it('returns null when no unobserved parts', () => {
    const msg = createMsg([
      textPart('observed'),
      markerPart('data-om-observation-start'),
      markerPart('data-om-observation-end'),
    ]);
    expect(createUnobservedMessage(msg)).toBeNull();
  });

  it('returns virtual message with only unobserved parts', () => {
    const msg = createMsg([
      textPart('observed'),
      markerPart('data-om-observation-start'),
      markerPart('data-om-observation-end'),
      textPart('new stuff'),
    ]);
    const virtual = createUnobservedMessage(msg);
    expect(virtual).not.toBeNull();
    expect(virtual!.id).toBe(msg.id);
    expect(virtual!.content.parts).toHaveLength(1);
    expect((virtual!.content.parts[0] as any).text).toBe('new stuff');
  });

  it('preserves message metadata', () => {
    const msg = createMsg([textPart('hello')], { id: 'custom-id', role: 'assistant' });
    const virtual = createUnobservedMessage(msg);
    expect(virtual!.id).toBe('custom-id');
    expect(virtual!.role).toBe('assistant');
  });
});

// =============================================================================
// getUnobservedMessages
// =============================================================================

describe('getUnobservedMessages', () => {
  const baseRecord: ObservationalMemoryRecord = {
    id: 'rec-1',
    threadId: 'thread-1',
    resourceId: 'resource-1',
    scope: 'thread',
    observations: '',
    observationTokens: 0,
    lastObservedAt: null,
    observedMessageIds: [],
    config: {},
    isObserving: false,
    isReflecting: false,
    isBufferingObservation: false,
    isBufferingReflection: false,
    pendingMessageTokens: 0,
    reflectionGeneration: 0,
    bufferedObservationChunks: [],
    bufferedReflection: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as ObservationalMemoryRecord;

  it('returns all messages when no observations exist', () => {
    const messages = [createMsg([textPart('a')], { id: 'a' }), createMsg([textPart('b')], { id: 'b' })];
    const result = getUnobservedMessages(messages, baseRecord);
    expect(result).toHaveLength(2);
  });

  it('filters by lastObservedAt timestamp', () => {
    const record = {
      ...baseRecord,
      lastObservedAt: new Date('2026-01-15'),
    };
    const messages = [
      createMsg([textPart('old')], { id: 'old', createdAt: new Date('2026-01-10') }),
      createMsg([textPart('new')], { id: 'new', createdAt: new Date('2026-01-20') }),
    ];
    const result = getUnobservedMessages(messages, record);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('new');
  });

  it('filters by observedMessageIds', () => {
    const record = {
      ...baseRecord,
      lastObservedAt: new Date('2026-01-01'),
      observedMessageIds: ['msg-a'],
    };
    const messages = [
      createMsg([textPart('a')], { id: 'msg-a', createdAt: new Date('2026-01-20') }),
      createMsg([textPart('b')], { id: 'msg-b', createdAt: new Date('2026-01-20') }),
    ];
    const result = getUnobservedMessages(messages, record);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('msg-b');
  });

  it('excludes buffered chunk messages when excludeBuffered is true', () => {
    const record = {
      ...baseRecord,
      bufferedObservationChunks: [
        {
          id: 'chunk-1',
          cycleId: 'cycle-1',
          observations: 'test',
          tokenCount: 10,
          messageIds: ['msg-a'],
          messageTokens: 100,
          lastObservedAt: new Date(),
          createdAt: new Date(),
        },
      ],
    };
    const messages = [createMsg([textPart('a')], { id: 'msg-a' }), createMsg([textPart('b')], { id: 'msg-b' })];

    // Without excludeBuffered — all visible
    const all = getUnobservedMessages(messages, record);
    expect(all).toHaveLength(2);

    // With excludeBuffered — buffered msg excluded
    const filtered = getUnobservedMessages(messages, record, { excludeBuffered: true });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('msg-b');
  });

  it('uses part-level filtering for messages with completed observation', () => {
    const record = {
      ...baseRecord,
      lastObservedAt: new Date('2026-01-01'),
    };
    const msg = createMsg(
      [
        textPart('observed'),
        markerPart('data-om-observation-start'),
        markerPart('data-om-observation-end'),
        textPart('new content'),
      ],
      { id: 'msg-1', createdAt: new Date('2026-01-20') },
    );
    const result = getUnobservedMessages([msg], record);
    expect(result).toHaveLength(1);
    expect(result[0].content.parts).toHaveLength(1);
    expect((result[0].content.parts[0] as any).text).toBe('new content');
  });

  it('includes full message for in-progress observation', () => {
    const record = {
      ...baseRecord,
      lastObservedAt: new Date('2026-01-01'),
    };
    const msg = createMsg([textPart('hello'), markerPart('data-om-observation-start')], {
      id: 'msg-1',
      createdAt: new Date('2026-01-20'),
    });
    const result = getUnobservedMessages([msg], record);
    expect(result).toHaveLength(1);
    expect(result[0].content.parts).toHaveLength(2);
  });
});

// =============================================================================
// getBufferedChunks
// =============================================================================

describe('getBufferedChunks', () => {
  it('returns empty array for null/undefined record', () => {
    expect(getBufferedChunks(null)).toEqual([]);
    expect(getBufferedChunks(undefined)).toEqual([]);
  });

  it('returns empty array for missing field', () => {
    expect(getBufferedChunks({} as any)).toEqual([]);
    expect(getBufferedChunks({ bufferedObservationChunks: undefined } as any)).toEqual([]);
  });

  it('returns array directly when already an array', () => {
    const chunks = [{ id: 'c1' }];
    expect(getBufferedChunks({ bufferedObservationChunks: chunks } as any)).toBe(chunks);
  });

  it('parses JSON string into array', () => {
    const chunks = [{ id: 'c1', observations: 'test' }];
    const result = getBufferedChunks({ bufferedObservationChunks: JSON.stringify(chunks) } as any);
    expect(result).toEqual(chunks);
  });

  it('returns empty for invalid JSON', () => {
    expect(getBufferedChunks({ bufferedObservationChunks: 'not-json' } as any)).toEqual([]);
  });

  it('returns empty for non-array JSON', () => {
    expect(getBufferedChunks({ bufferedObservationChunks: '42' } as any)).toEqual([]);
  });
});
