import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import type { Agent } from './agent';
import { tryGenerateWithJsonFallback, isSupportedLanguageModel, resolveThreadIdFromArgs } from './utils';

function makeAgent(generate: ReturnType<typeof vi.fn>): Agent {
  return { generate } as unknown as Agent;
}

const baseOptions = {
  structuredOutput: { schema: z.object({ decision: z.string() }) },
} as any;

describe('agent/utils', () => {
  describe('tryGenerateWithJsonFallback', () => {
    it('returns the first result without retrying when it has a valid object', async () => {
      const generate = vi.fn().mockResolvedValue({ object: { decision: 'done' } });
      const result = await tryGenerateWithJsonFallback(makeAgent(generate), 'prompt', baseOptions);

      expect(result).toEqual({ object: { decision: 'done' } });
      expect(generate).toHaveBeenCalledTimes(1);
      expect(generate.mock.calls[0][1].structuredOutput.jsonPromptInjection).toBeUndefined();
    });

    it('retries with jsonPromptInjection when the first generate throws', async () => {
      const generate = vi
        .fn()
        .mockRejectedValueOnce(new Error('model exploded'))
        .mockResolvedValueOnce({ object: { decision: 'continue' } });

      const result = await tryGenerateWithJsonFallback(makeAgent(generate), 'prompt', baseOptions);

      expect(result).toEqual({ object: { decision: 'continue' } });
      expect(generate).toHaveBeenCalledTimes(2);
      expect(generate.mock.calls[1][1].structuredOutput.jsonPromptInjection).toBe(true);
    });

    it('retries with jsonPromptInjection when the first generate resolves with no object', async () => {
      const generate = vi
        .fn()
        .mockResolvedValueOnce({ object: undefined })
        .mockResolvedValueOnce({ object: { decision: 'done' } });

      const result = await tryGenerateWithJsonFallback(makeAgent(generate), 'prompt', baseOptions);

      expect(result).toEqual({ object: { decision: 'done' } });
      expect(generate).toHaveBeenCalledTimes(2);
      expect(generate.mock.calls[1][1].structuredOutput.jsonPromptInjection).toBe(true);
    });

    it('throws when structuredOutput.schema is missing', async () => {
      const generate = vi.fn();
      await expect(
        tryGenerateWithJsonFallback(makeAgent(generate), 'prompt', { structuredOutput: {} } as any),
      ).rejects.toThrow(/structuredOutput is required/);
      expect(generate).not.toHaveBeenCalled();
    });
  });

  describe('isSupportedLanguageModel', () => {
    it('should return true for supported specifications', () => {
      expect(isSupportedLanguageModel({ specificationVersion: 'v2' } as any)).toBe(true);
      expect(isSupportedLanguageModel({ specificationVersion: 'v3' } as any)).toBe(true);
      expect(isSupportedLanguageModel({ specificationVersion: 'v4' } as any)).toBe(true);
    });

    it('should return false for unsupported specifications', () => {
      expect(isSupportedLanguageModel({ specificationVersion: 'v1' } as any)).toBe(false);
      expect(isSupportedLanguageModel({ specificationVersion: 'v5' } as any)).toBe(false);
      expect(isSupportedLanguageModel({} as any)).toBe(false);
    });
  });

  describe('resolveThreadIdFromArgs', () => {
    it('should resolve thread ID from memory string', () => {
      const result = resolveThreadIdFromArgs({ memory: { thread: 'thread-1' } });
      expect(result).toEqual({ id: 'thread-1' });
    });

    it('should resolve thread ID from memory object', () => {
      const result = resolveThreadIdFromArgs({ memory: { thread: { id: 'thread-2' } } });
      expect(result).toEqual({ id: 'thread-2' });
    });

    it('should resolve thread ID from threadId argument', () => {
      const result = resolveThreadIdFromArgs({ threadId: 'thread-3' });
      expect(result).toEqual({ id: 'thread-3' });
    });

    it('should prioritize memory over threadId', () => {
      const result = resolveThreadIdFromArgs({
        memory: { thread: 'thread-1' },
        threadId: 'thread-3',
      });
      expect(result).toEqual({ id: 'thread-1' });
    });

    it('should use overrideId if provided', () => {
      const result = resolveThreadIdFromArgs({
        memory: { thread: 'thread-1' },
        overrideId: 'override-1',
      });
      expect(result).toEqual({ id: 'override-1' });
    });

    it('should return undefined if no ID can be resolved', () => {
      const result = resolveThreadIdFromArgs({});
      expect(result).toBeUndefined();
    });
  });
});
