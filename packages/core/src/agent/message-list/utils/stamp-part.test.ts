/**
 * Tests for packages/core/src/agent/message-list/utils/stamp-part.ts
 *
 * `stampPart` and `stampMessageParts` are small pure(-ish) helpers that
 * assign a `createdAt` timestamp to message parts. The only non-determinism
 * is `Date.now()`, which is mocked to keep assertions exact.
 */
import { describe, expect, it, vi, afterEach } from 'vitest';

import type { MastraDBMessage, MastraMessagePart } from '../state/types';
import { stampMessageParts, stampPart } from './stamp-part';

afterEach(() => {
  vi.useRealTimers();
});

describe('stampPart', () => {
  it('assigns the current time when createdAt is undefined', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_700_000_000_000);

    const part = { type: 'text', text: 'hello' } as unknown as MastraMessagePart;
    const result = stampPart(part);

    expect(result.createdAt).toBe(1_700_000_000_000);
  });

  it('assigns the current time when createdAt is null', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_700_000_000_000);

    const part = { type: 'text', text: 'hello', createdAt: null } as unknown as MastraMessagePart;
    const result = stampPart(part);

    expect(result.createdAt).toBe(1_700_000_000_000);
  });

  it('does not overwrite an existing createdAt value', () => {
    const part = { type: 'text', text: 'hello', createdAt: 123 } as unknown as MastraMessagePart;
    const result = stampPart(part);

    expect(result.createdAt).toBe(123);
  });

  it('preserves createdAt of 0 (falsy but not nullish)', () => {
    const part = { type: 'text', text: 'hello', createdAt: 0 } as unknown as MastraMessagePart;
    const result = stampPart(part);

    expect(result.createdAt).toBe(0);
  });

  it('mutates and returns the same object reference', () => {
    const part = { type: 'text', text: 'hello' } as unknown as MastraMessagePart;
    const result = stampPart(part);

    expect(result).toBe(part);
  });

  it('leaves other fields on the part untouched', () => {
    const part = { type: 'text', text: 'hello', foo: 'bar' } as unknown as MastraMessagePart;
    const result = stampPart(part);

    expect(result.text).toBe('hello');
    expect((result as any).foo).toBe('bar');
  });
});

describe('stampMessageParts', () => {
  function buildMessage(parts: unknown[]): MastraDBMessage {
    return {
      content: { parts },
    } as unknown as MastraDBMessage;
  }

  it('returns the message unchanged when source is "memory"', () => {
    const message = buildMessage([{ type: 'text', text: 'hi' }]);
    const result = stampMessageParts(message, 'memory');

    expect(result).toBe(message);
    expect((result.content.parts[0] as any).createdAt).toBeUndefined();
  });

  it('stamps all parts without an existing createdAt when source is not "memory"', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_700_000_000_000);

    const message = buildMessage([
      { type: 'text', text: 'a' },
      { type: 'text', text: 'b' },
    ]);
    const result = stampMessageParts(message, 'response');

    expect((result.content.parts[0] as any).createdAt).toBe(1_700_000_000_000);
    expect((result.content.parts[1] as any).createdAt).toBe(1_700_000_000_000);
  });

  it('does not overwrite parts that already have createdAt', () => {
    const message = buildMessage([{ type: 'text', text: 'a', createdAt: 42 }]);
    const result = stampMessageParts(message, 'input');

    expect((result.content.parts[0] as any).createdAt).toBe(42);
  });

  it('returns the message unchanged when parts is not an array', () => {
    const message = { content: { parts: undefined } } as unknown as MastraDBMessage;
    const result = stampMessageParts(message, 'input');

    expect(result).toBe(message);
  });

  it('handles an empty parts array without throwing', () => {
    const message = buildMessage([]);
    const result = stampMessageParts(message, 'system');

    expect(result.content.parts).toEqual([]);
  });

  it('stamps parts for every non-memory source value', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_700_000_000_000);

    const sources: Array<'response' | 'input' | 'system' | 'context'> = ['response', 'input', 'system', 'context'];

    for (const source of sources) {
      const message = buildMessage([{ type: 'text', text: 'x' }]);
      const result = stampMessageParts(message, source);
      expect((result.content.parts[0] as any).createdAt).toBe(1_700_000_000_000);
    }
  });
});
