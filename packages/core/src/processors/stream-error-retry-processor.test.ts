import { APICallError } from '@internal/ai-sdk-v5';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MessageList } from '../agent/message-list';
import { isRetryableOpenAIResponsesStreamError, StreamErrorRetryProcessor } from './stream-error-retry-processor';
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

  describe('delayMs', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('waits the configured delay before signaling retry', async () => {
      vi.useFakeTimers();
      const processor = new StreamErrorRetryProcessor({
        delayMs: 1000,
        matchers: [() => true],
      });
      const error = new Error('retryable');

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
        matchers: [() => true],
      });
      const error = new Error('retryable');

      await expect(processor.processAPIError(makeArgs({ error }))).resolves.toEqual({ retry: true });
    });

    it('supports a delay function evaluated with error args', async () => {
      const delayFn = vi.fn(() => 5);
      const processor = new StreamErrorRetryProcessor({
        delayMs: delayFn,
        matchers: [() => true],
      });
      const error = new Error('retryable');
      const args = makeArgs({ error });

      await expect(processor.processAPIError(args)).resolves.toEqual({ retry: true });
      expect(delayFn).toHaveBeenCalledWith(args);
    });

    it('skips the wait when the abort signal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort();
      const processor = new StreamErrorRetryProcessor({
        delayMs: 60_000,
        matchers: [() => true],
      });
      const error = new Error('retryable');

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

    it('removes the abort listener after timeout resolves', async () => {
      vi.useFakeTimers();
      const controller = new AbortController();
      const addSpy = vi.spyOn(controller.signal, 'addEventListener');
      const removeSpy = vi.spyOn(controller.signal, 'removeEventListener');
      const processor = new StreamErrorRetryProcessor({
        delayMs: 1000,
        matchers: [() => true],
      });

      const promise = processor.processAPIError(makeArgs({ error: new Error('x'), abortSignal: controller.signal }));
      await vi.advanceTimersByTimeAsync(1000);
      await expect(promise).resolves.toEqual({ retry: true });
      expect(addSpy).toHaveBeenCalledWith('abort', expect.any(Function), { once: true });
      expect(removeSpy).toHaveBeenCalledWith('abort', expect.any(Function));
    });

    it('removes the abort listener when abort fires during delay', async () => {
      vi.useFakeTimers();
      const controller = new AbortController();
      const removeSpy = vi.spyOn(controller.signal, 'removeEventListener');
      const processor = new StreamErrorRetryProcessor({
        delayMs: 60_000,
        matchers: [() => true],
      });

      const promise = processor.processAPIError(makeArgs({ error: new Error('x'), abortSignal: controller.signal }));
      await vi.advanceTimersByTimeAsync(500);
      controller.abort();
      await expect(promise).resolves.toEqual({ retry: true });
      expect(removeSpy).toHaveBeenCalledWith('abort', expect.any(Function));
    });

    it('does not accumulate listeners across retries on a long-lived signal', async () => {
      vi.useFakeTimers();
      const controller = new AbortController();
      const addSpy = vi.spyOn(controller.signal, 'addEventListener');
      const removeSpy = vi.spyOn(controller.signal, 'removeEventListener');
      const processor = new StreamErrorRetryProcessor({
        delayMs: 1000,
        maxRetries: 3,
        matchers: [() => true],
      });

      // First retry
      let promise = processor.processAPIError(makeArgs({ error: new Error('x'), abortSignal: controller.signal }));
      await vi.advanceTimersByTimeAsync(1000);
      await expect(promise).resolves.toEqual({ retry: true });
      expect(addSpy).toHaveBeenCalledTimes(1);
      expect(removeSpy).toHaveBeenCalledTimes(1);

      // Second retry — listener count should not grow
      promise = processor.processAPIError(
        makeArgs({ error: new Error('x'), abortSignal: controller.signal, retryCount: 1 }),
      );
      await vi.advanceTimersByTimeAsync(1000);
      await expect(promise).resolves.toEqual({ retry: true });
      expect(addSpy).toHaveBeenCalledTimes(2);
      expect(removeSpy).toHaveBeenCalledTimes(2);
    });
  });
});
