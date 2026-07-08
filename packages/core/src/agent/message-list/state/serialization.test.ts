/**
 * Tests for packages/core/src/agent/message-list/state/serialization.ts
 *
 * These are pure functions with no I/O beyond `Date`/ISO-string conversion.
 * Coverage focuses on round-trip correctness and that non-`createdAt`
 * fields pass through both directions unchanged.
 */
import { describe, expect, it } from 'vitest';

import { deserializeMessage, deserializeMessages, serializeMessage, serializeMessages } from './serialization';
import type { MastraDBMessage } from './types';

function buildMessage(overrides: Partial<MastraDBMessage> = {}): MastraDBMessage {
  return {
    id: 'msg-1',
    threadId: 'thread-1',
    resourceId: 'resource-1',
    role: 'user',
    content: { format: 2, parts: [{ type: 'text', text: 'hello' }] },
    createdAt: new Date('2026-01-15T10:30:00.000Z'),
    ...overrides,
  } as unknown as MastraDBMessage;
}

describe('serializeMessage', () => {
  it('converts createdAt from a Date to an ISO string', () => {
    const message = buildMessage({ createdAt: new Date('2026-01-15T10:30:00.000Z') });

    expect(serializeMessage(message).createdAt).toBe('2026-01-15T10:30:00.000Z');
  });

  it('passes through every other field unchanged', () => {
    const message = buildMessage();
    const result = serializeMessage(message);

    expect(result.id).toBe(message.id);
    expect(result.threadId).toBe(message.threadId);
    expect(result.resourceId).toBe(message.resourceId);
    expect(result.role).toBe(message.role);
    expect(result.content).toEqual(message.content);
  });

  it('does not mutate the original message object', () => {
    const message = buildMessage({ createdAt: new Date('2026-01-15T10:30:00.000Z') });
    serializeMessage(message);

    expect(message.createdAt).toBeInstanceOf(Date);
    expect(message.createdAt.toISOString()).toBe('2026-01-15T10:30:00.000Z');
  });
});

describe('deserializeMessage', () => {
  it('converts createdAt from an ISO string back to a Date', () => {
    const serialized = { ...buildMessage(), createdAt: '2026-01-15T10:30:00.000Z' };
    const result = deserializeMessage(serialized);

    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.createdAt.toISOString()).toBe('2026-01-15T10:30:00.000Z');
  });

  it('passes through every other field unchanged', () => {
    const serialized = { ...buildMessage(), createdAt: '2026-01-15T10:30:00.000Z' };
    const result = deserializeMessage(serialized);

    expect(result.id).toBe(serialized.id);
    expect(result.threadId).toBe(serialized.threadId);
    expect(result.resourceId).toBe(serialized.resourceId);
    expect(result.role).toBe(serialized.role);
    expect(result.content).toEqual(serialized.content);
  });
});

describe('serializeMessage / deserializeMessage round-trip', () => {
  it('preserves the exact instant through a full serialize -> deserialize cycle', () => {
    const original = buildMessage({ createdAt: new Date('2026-01-15T10:30:00.123Z') });
    const roundTripped = deserializeMessage(serializeMessage(original));

    expect(roundTripped.createdAt.getTime()).toBe(original.createdAt.getTime());
  });

  it('preserves millisecond precision', () => {
    const original = buildMessage({ createdAt: new Date(1_768_472_345_678) });
    const roundTripped = deserializeMessage(serializeMessage(original));

    expect(roundTripped.createdAt.getTime()).toBe(1_768_472_345_678);
  });
});

describe('serializeMessages', () => {
  it('maps serializeMessage over every element', () => {
    const messages = [
      buildMessage({ id: 'a', createdAt: new Date('2026-01-01T00:00:00.000Z') }),
      buildMessage({ id: 'b', createdAt: new Date('2026-01-02T00:00:00.000Z') }),
    ];
    const result = serializeMessages(messages);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ ...messages[0], createdAt: '2026-01-01T00:00:00.000Z' });
    expect(result[1]).toEqual({ ...messages[1], createdAt: '2026-01-02T00:00:00.000Z' });
  });

  it('returns an empty array for an empty input array', () => {
    expect(serializeMessages([])).toEqual([]);
  });
});

describe('deserializeMessages', () => {
  it('maps deserializeMessage over every element', () => {
    const serialized = [
      { ...buildMessage({ id: 'a' }), createdAt: '2026-01-01T00:00:00.000Z' },
      { ...buildMessage({ id: 'b' }), createdAt: '2026-01-02T00:00:00.000Z' },
    ];
    const result = deserializeMessages(serialized);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('a');
    expect(result[0].createdAt.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(result[1].id).toBe('b');
    expect(result[1].createdAt.toISOString()).toBe('2026-01-02T00:00:00.000Z');
  });

  it('returns an empty array for an empty input array', () => {
    expect(deserializeMessages([])).toEqual([]);
  });
});
