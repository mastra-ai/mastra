import { APICallError } from '@internal/ai-sdk-v5';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MessageList } from '../agent/message-list';
import {
  isECONNRESETError,
  isRetryableOpenAIResponsesStreamError,
  StreamErrorRetryProcessor,
} from './stream-error-retry-processor';
import type { ProcessAPIErrorArgs } from './index';

function makeArgs(overrides: Partial<ProcessAPIErrorArgs> = {}): ProcessAPIErrorArgs {
  const messageList = new MessageList({ threadId: 'test-thread' });
  messageList.add({ role: 'user', content: 'hello' }, 'input');

  return {
    error: new Error('test error'),
    messages: messageList.get.all.db(),
    messageList,
    stepNumber: 0,
    steps: [],
    state: {},
    retryCount: 0,
    abort: (() => {
      throw new Error('abort');
    }) as ProcessAPIErrorArgs['abort'],
    ...overrides,
  };
}

describe('StreamErrorRetryProcessor', () => {
  it('has correct id and name', () => {
    const processor = new StreamErrorRetryProcessor();

    expect(processor.id).toBe('stream-error-retry-processor');
    expect(processor.name).toBe('Stream Error Retry Processor');
  });

  it('retries provider errors with retryable metadata', async () => {
    const processor = new StreamErrorRetryProcessor();
    const error = new APICallError({
      message: 'server failed',
      url: 'https://api.openai.com/v1/responses',
      requestBodyValues: {},
      statusCode: 500,
      isRetryable: true,
    });

    await expect(processor.processAPIError(makeArgs({ error }))).resolves.toEqual({ retry: true });
  });

  it('does not retry provider errors with non-retryable metadata', async () => {
    const processor = new StreamErrorRetryProcessor();
    const error = new APICallError({
      message: 'bad request',
      url: 'https://api.openai.com/v1/responses',
      requestBodyValues: {},
      statusCode: 400,
      isRetryable: false,
    });

    await expect(processor.processAPIError(makeArgs({ error }))).resolves.toBeUndefined();
  });

  it('retries provider errors with retryable metadata in cause chain', async () => {
    const processor = new StreamErrorRetryProcessor();
    const error = new Error('wrapped', {
      cause: new APICallError({
        message: 'server failed',
        url: 'https://api.openai.com/v1/responses',
        requestBodyValues: {},
        statusCode: 500,
        isRetryable: true,
      }),
    });

    await expect(processor.processAPIError(makeArgs({ error }))).resolves.toEqual({ retry: true });
  });

  it('does not retry status codes without provider metadata or a matcher', async () => {
    const processor = new StreamErrorRetryProcessor();
    const error = new Error('wrapped', {
      cause: {
        status: 503,
      },
    });

    await expect(processor.processAPIError(makeArgs({ error }))).resolves.toBeUndefined();
  });

  it('detects OpenAI Responses stream error chunks with retryable codes', () => {
    const error = {
      type: 'error',
      sequence_number: 1,
      error: {
        type: 'server_error',
        code: 'internal_error',
        message: 'An internal error occurred.',
      },
    };

    expect(isRetryableOpenAIResponsesStreamError(error)).toBe(true);
  });

  it('retries OpenAI Responses stream error chunks by default', async () => {
    const processor = new StreamErrorRetryProcessor();
    const error = {
      type: 'error',
      sequence_number: 1,
      error: {
        type: 'server_error',
        code: 'internal_error',
        message: 'An internal error occurred.',
      },
    };

    await expect(processor.processAPIError(makeArgs({ error }))).resolves.toEqual({ retry: true });
  });

  it('retries stream errors through additional matchers', async () => {
    const processor = new StreamErrorRetryProcessor({
      matchers: [error => error instanceof Error && error.message === 'custom retryable stream error'],
    });

    await expect(
      processor.processAPIError(makeArgs({ error: new Error('custom retryable stream error') })),
    ).resolves.toEqual({ retry: true });
  });

  it('detects OpenAI Responses failed chunks with explicit retry guidance', () => {
    const error = {
      type: 'response.failed',
      response: {
        error: {
          code: 'unknown_error',
          message:
            'An error occurred while processing your request. You can retry your request, or contact us through our help center if the error persists.',
        },
      },
    };

    expect(isRetryableOpenAIResponsesStreamError(error)).toBe(true);
  });

  it('does not retry non-transient OpenAI Responses stream error chunks', async () => {
    const processor = new StreamErrorRetryProcessor();
    const error = {
      type: 'error',
      sequence_number: 1,
      error: {
        type: 'invalid_request_error',
        code: 'invalid_prompt',
        message: 'Invalid prompt.',
      },
    };

    await expect(processor.processAPIError(makeArgs({ error }))).resolves.toBeUndefined();
  });

  it('respects maxRetries', async () => {
    const processor = new StreamErrorRetryProcessor({
      maxRetries: 1,
    });
    const error = {
      type: 'error',
      error: {
        type: 'server_error',
        code: 'internal_error',
        message: 'An internal error occurred.',
      },
    };

    await expect(processor.processAPIError(makeArgs({ error, retryCount: 1 }))).resolves.toBeUndefined();
  });

  describe('isECONNRESETError', () => {
    it('matches a direct ECONNRESET error code', () => {
      const error = new Error('read ECONNRESET');
      (error as Error & { code: string }).code = 'ECONNRESET';

      expect(isECONNRESETError(error)).toBe(true);
    });

    it('matches a lowercase econnreset code', () => {
      const error = { code: 'econnreset', message: 'socket closed' };

      expect(isECONNRESETError(error)).toBe(true);
    });

    it('matches a socket hang up message', () => {
      expect(isECONNRESETError(new Error('socket hang up'))).toBe(true);
    });

    it('matches an ECONNRESET message even without a code', () => {
      expect(isECONNRESETError(new Error('read ECONNRESET'))).toBe(true);
    });

    it('returns false for unrelated errors', () => {
      expect(isECONNRESETError(new Error('timeout'))).toBe(false);
      expect(isECONNRESETError({ code: 'ETIMEDOUT' })).toBe(false);
    });

    it('returns false for null/undefined', () => {
      expect(isECONNRESETError(null)).toBe(false);
      expect(isECONNRESETError(undefined)).toBe(false);
    });
  });

  describe('ECONNRESET retry via matchers', () => {
    it('retries a direct ECONNRESET when matcher is supplied', async () => {
      const processor = new StreamErrorRetryProcessor({ matchers: [isECONNRESETError] });
      const error = new Error('read ECONNRESET');
      (error as Error & { code: string }).code = 'ECONNRESET';

      await expect(processor.processAPIError(makeArgs({ error }))).resolves.toEqual({ retry: true });
    });

    it('retries a nested cause.code ECONNRESET when matcher is supplied', async () => {
      const processor = new StreamErrorRetryProcessor({ matchers: [isECONNRESETError] });
      const root = new Error('fetch failed', {
        cause: Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' }),
      });

      await expect(processor.processAPIError(makeArgs({ error: root }))).resolves.toEqual({ retry: true });
    });

    it('does not retry ECONNRESET by default (matcher not supplied)', async () => {
      const processor = new StreamErrorRetryProcessor();
      const error = new Error('read ECONNRESET');
      (error as Error & { code: string }).code = 'ECONNRESET';

      await expect(processor.processAPIError(makeArgs({ error }))).resolves.toBeUndefined();
    });

    it('does not retry past maxRetries for ECONNRESET', async () => {
      const processor = new StreamErrorRetryProcessor({ maxRetries: 2, matchers: [isECONNRESETError] });
      const error = new Error('read ECONNRESET');
      (error as Error & { code: string }).code = 'ECONNRESET';

      await expect(processor.processAPIError(makeArgs({ error, retryCount: 2 }))).resolves.toBeUndefined();
    });
  });

  describe('delayMs', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('waits the configured delay before signaling retry', async () => {
      vi.useFakeTimers();
      const processor = new StreamErrorRetryProcessor({
        delayMs: 1000,
        matchers: [isECONNRESETError],
      });
      const error = new Error('read ECONNRESET');
      (error as Error & { code: string }).code = 'ECONNRESET';

      let resolved = false;
      const promise = processor.processAPIError(makeArgs({ error })).then(result => {
        resolved = true;
        return result;
      });

      // Advance time but stay under the delay — still pending.
      await vi.advanceTimersByTimeAsync(999);
      expect(resolved).toBe(false);

      // Advance past the delay — resolves now.
      await vi.advanceTimersByTimeAsync(1);
      await expect(promise).resolves.toEqual({ retry: true });
      expect(resolved).toBe(true);
    });

    it('clamps negative/non-finite delays to 0 (retries immediately)', async () => {
      const processor = new StreamErrorRetryProcessor({
        delayMs: -50,
        matchers: [isECONNRESETError],
      });
      const error = new Error('read ECONNRESET');
      (error as Error & { code: string }).code = 'ECONNRESET';

      await expect(processor.processAPIError(makeArgs({ error }))).resolves.toEqual({ retry: true });
    });

    it('supports a delay function evaluated with error args', async () => {
      const delayFn = vi.fn(() => 5);
      const processor = new StreamErrorRetryProcessor({
        delayMs: delayFn,
        matchers: [isECONNRESETError],
      });
      const error = new Error('read ECONNRESET');
      (error as Error & { code: string }).code = 'ECONNRESET';
      const args = makeArgs({ error });

      await expect(processor.processAPIError(args)).resolves.toEqual({ retry: true });
      expect(delayFn).toHaveBeenCalledWith(args);
    });

    it('skips the wait when the abort signal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort();
      const processor = new StreamErrorRetryProcessor({
        delayMs: 60_000,
        matchers: [isECONNRESETError],
      });
      const error = new Error('read ECONNRESET');
      (error as Error & { code: string }).code = 'ECONNRESET';

      const start = Date.now();
      await expect(processor.processAPIError(makeArgs({ error, abortSignal: controller.signal }))).resolves.toEqual({
        retry: true,
      });
      expect(Date.now() - start).toBeLessThan(1000);
    });

    it('default behavior is unchanged when delayMs is not supplied', async () => {
      const processor = new StreamErrorRetryProcessor();
      const error = {
        type: 'error',
        error: { type: 'server_error', code: 'internal_error', message: 'boom' },
      };

      await expect(processor.processAPIError(makeArgs({ error }))).resolves.toEqual({ retry: true });
    });
  });
});
