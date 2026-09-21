import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { ErrorCategory, ErrorDomain, MastraError } from '../../error';
import type { Agent } from '../agent';
import { resolveThreadIdFromArgs, tryGenerateWithJsonFallback } from '../utils';

describe('tryGenerateWithJsonFallback', () => {
  it('retries structured output truncated by the provider', async () => {
    const generate = vi
      .fn()
      .mockRejectedValueOnce(
        new MastraError({
          id: 'STRUCTURED_OUTPUT_TRUNCATED',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.SYSTEM,
          text: 'Structured output was truncated.',
        }),
      )
      .mockResolvedValueOnce({ object: { name: 'Ana' } });
    const agent = { generate } as unknown as Agent;

    await expect(
      tryGenerateWithJsonFallback(agent, 'prompt', {
        structuredOutput: { schema: z.object({ name: z.string() }) },
      }),
    ).resolves.toMatchObject({ object: { name: 'Ana' } });

    expect(generate).toHaveBeenCalledTimes(2);
    expect(generate.mock.calls[1]?.[1]).toMatchObject({
      structuredOutput: { jsonPromptInjection: true },
    });
  });
});

describe('resolveThreadIdFromArgs', () => {
  describe('basic behavior', () => {
    it('returns undefined when no arguments provided', () => {
      expect(resolveThreadIdFromArgs({})).toBeUndefined();
    });

    it('returns { id } when memory.thread is a string', () => {
      expect(resolveThreadIdFromArgs({ memory: { thread: 'thread-123' } })).toEqual({ id: 'thread-123' });
    });

    it('returns the full object when memory.thread is an object', () => {
      const thread = { id: 'thread-123', title: 'My Thread', metadata: { key: 'value' } };
      expect(resolveThreadIdFromArgs({ memory: { thread } })).toEqual(thread);
    });

    it('returns { id } when only threadId is provided', () => {
      expect(resolveThreadIdFromArgs({ threadId: 'thread-456' })).toEqual({ id: 'thread-456' });
    });

    it('prioritizes memory.thread over threadId', () => {
      expect(
        resolveThreadIdFromArgs({
          memory: { thread: 'from-memory' },
          threadId: 'from-threadId',
        }),
      ).toEqual({ id: 'from-memory' });
    });
  });

  describe('overrideId behavior', () => {
    it('returns { id: overrideId } when only overrideId is provided', () => {
      expect(resolveThreadIdFromArgs({ overrideId: 'override-123' })).toEqual({ id: 'override-123' });
    });

    it('overrides id when memory.thread is a string', () => {
      expect(
        resolveThreadIdFromArgs({
          memory: { thread: 'original-id' },
          overrideId: 'override-id',
        }),
      ).toEqual({ id: 'override-id' });
    });

    it('preserves metadata when overriding id from thread object', () => {
      const thread = { id: 'original-id', title: 'My Thread', metadata: { key: 'value' } };
      expect(
        resolveThreadIdFromArgs({
          memory: { thread },
          overrideId: 'override-id',
        }),
      ).toEqual({ id: 'override-id', title: 'My Thread', metadata: { key: 'value' } });
    });

    it('overrides id when threadId is provided', () => {
      expect(
        resolveThreadIdFromArgs({
          threadId: 'original-id',
          overrideId: 'override-id',
        }),
      ).toEqual({ id: 'override-id' });
    });
  });
});
