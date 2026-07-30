import { APICallError, JSONParseError, NoObjectGeneratedError, TypeValidationError } from '@internal/ai-sdk-v5';
import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import type { Agent } from './agent';
import {
  tryGenerateWithJsonFallback,
  tryStreamWithJsonFallback,
  isSupportedLanguageModel,
  resolveThreadIdFromArgs,
} from './utils';

function makeAgent(generate: ReturnType<typeof vi.fn>): Agent {
  return { generate } as unknown as Agent;
}

function makeStreamAgent(stream: ReturnType<typeof vi.fn>): Agent {
  return { stream } as unknown as Agent;
}

function makeAPICallError(isRetryable: boolean): APICallError {
  return new APICallError({
    message: 'provider failed',
    url: 'https://api.example.com/v1/responses',
    requestBodyValues: {},
    statusCode: isRetryable ? 429 : 400,
    isRetryable,
  });
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

    it('retries with jsonPromptInjection for a structured-output parse error', async () => {
      const generate = vi
        .fn()
        .mockRejectedValueOnce(new JSONParseError({ text: 'not json', cause: new SyntaxError('Unexpected token') }))
        .mockResolvedValueOnce({ object: { decision: 'continue' } });

      const result = await tryGenerateWithJsonFallback(makeAgent(generate), 'prompt', baseOptions);

      expect(result).toEqual({ object: { decision: 'continue' } });
      expect(generate).toHaveBeenCalledTimes(2);
      expect(generate.mock.calls[1][1].structuredOutput.jsonPromptInjection).toBe(true);
    });

    it('retries with jsonPromptInjection when no object is generated', async () => {
      const generate = vi
        .fn()
        .mockRejectedValueOnce(
          new NoObjectGeneratedError({
            response: { id: 'response-1', timestamp: new Date(), modelId: 'test-model' },
            usage: { inputTokens: 1, outputTokens: 0, totalTokens: 1 },
            finishReason: 'other',
          }),
        )
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

    it('retries with jsonPromptInjection for a structured-output validation error', async () => {
      const generate = vi
        .fn()
        .mockRejectedValueOnce(new TypeValidationError({ value: { decision: 1 }, cause: new Error('Expected string') }))
        .mockResolvedValueOnce({ object: { decision: 'continue' } });

      await expect(tryGenerateWithJsonFallback(makeAgent(generate), 'prompt', baseOptions)).resolves.toEqual({
        object: { decision: 'continue' },
      });
      expect(generate).toHaveBeenCalledTimes(2);
      expect(generate.mock.calls[1][1].structuredOutput.jsonPromptInjection).toBe(true);
    });

    it.each([
      ['retryable provider error', makeAPICallError(true)],
      ['non-retryable provider error', makeAPICallError(false)],
      ['network error', new Error('ECONNRESET')],
    ])('rethrows a %s without a JSON fallback', async (_description, error) => {
      const generate = vi.fn().mockRejectedValueOnce(error);

      await expect(tryGenerateWithJsonFallback(makeAgent(generate), 'prompt', baseOptions)).rejects.toBe(error);
      expect(generate).toHaveBeenCalledTimes(1);
    });

    it.each(['inline', 'system'] as const)('preserves the %s injection mode for format fallback', async mode => {
      const generate = vi
        .fn()
        .mockRejectedValueOnce(new JSONParseError({ text: 'not json', cause: new SyntaxError('Unexpected token') }))
        .mockResolvedValueOnce({ object: { decision: 'continue' } });
      const options = {
        structuredOutput: { ...baseOptions.structuredOutput, jsonPromptInjection: mode },
      } as any;

      await tryGenerateWithJsonFallback(makeAgent(generate), 'prompt', options);

      expect(generate).toHaveBeenCalledTimes(2);
      expect(generate.mock.calls[1][1].structuredOutput.jsonPromptInjection).toBe(mode);
    });

    it('throws when structuredOutput.schema is missing', async () => {
      const generate = vi.fn();
      await expect(
        tryGenerateWithJsonFallback(makeAgent(generate), 'prompt', { structuredOutput: {} } as any),
      ).rejects.toThrow(/structuredOutput is required/);
      expect(generate).not.toHaveBeenCalled();
    });
  });

  describe('tryStreamWithJsonFallback', () => {
    it('retries with jsonPromptInjection for a structured-output parse error', async () => {
      const fallbackResult = { object: Promise.resolve({ decision: 'continue' }) };
      const stream = vi
        .fn()
        .mockRejectedValueOnce(new JSONParseError({ text: 'not json', cause: new SyntaxError('Unexpected token') }))
        .mockResolvedValueOnce(fallbackResult);

      await expect(tryStreamWithJsonFallback(makeStreamAgent(stream), 'prompt', baseOptions as any)).resolves.toBe(
        fallbackResult,
      );
      expect(stream).toHaveBeenCalledTimes(2);
      expect(stream.mock.calls[1][1].structuredOutput.jsonPromptInjection).toBe(true);
    });

    it('retries with jsonPromptInjection when the stream has no object', async () => {
      const fallbackResult = { object: Promise.resolve({ decision: 'continue' }) };
      const stream = vi
        .fn()
        .mockResolvedValueOnce({ object: Promise.resolve(undefined) })
        .mockResolvedValueOnce(fallbackResult);

      await expect(tryStreamWithJsonFallback(makeStreamAgent(stream), 'prompt', baseOptions as any)).resolves.toBe(
        fallbackResult,
      );
      expect(stream).toHaveBeenCalledTimes(2);
      expect(stream.mock.calls[1][1].structuredOutput.jsonPromptInjection).toBe(true);
    });

    it.each([
      ['retryable provider error', makeAPICallError(true)],
      ['non-retryable provider error', makeAPICallError(false)],
      ['network error', new Error('ETIMEDOUT')],
    ])('rethrows a %s without a JSON fallback', async (_description, error) => {
      const stream = vi.fn().mockRejectedValueOnce(error);

      await expect(tryStreamWithJsonFallback(makeStreamAgent(stream), 'prompt', baseOptions as any)).rejects.toBe(
        error,
      );
      expect(stream).toHaveBeenCalledTimes(1);
    });

    it.each(['inline', 'system'] as const)('preserves the %s injection mode for format fallback', async mode => {
      const fallbackResult = { object: Promise.resolve({ decision: 'continue' }) };
      const stream = vi
        .fn()
        .mockRejectedValueOnce(new TypeValidationError({ value: { decision: 1 }, cause: new Error('Expected string') }))
        .mockResolvedValueOnce(fallbackResult);
      const options = {
        structuredOutput: { ...baseOptions.structuredOutput, jsonPromptInjection: mode },
      } as any;

      await tryStreamWithJsonFallback(makeStreamAgent(stream), 'prompt', options);

      expect(stream).toHaveBeenCalledTimes(2);
      expect(stream.mock.calls[1][1].structuredOutput.jsonPromptInjection).toBe(mode);
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
