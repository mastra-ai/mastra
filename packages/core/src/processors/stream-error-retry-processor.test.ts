import { APICallError } from '@internal/ai-sdk-v5';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MessageList } from '../agent/message-list';
import {
  isBadRequestError,
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

function makeRetryableError(responseHeaders?: Record<string, string>): APICallError {
  return new APICallError({
    message: 'server failed',
    url: 'https://api.openai.com/v1/responses',
    requestBodyValues: {},
    statusCode: 429,
    responseHeaders,
    isRetryable: true,
  });
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

  it('detects Bad Request (400) errors via isBadRequestError', () => {
    const error = new APICallError({
      message: 'Invalid request: Bad Request',
      url: 'https://api.openai.com/v1/responses',
      requestBodyValues: {},
      statusCode: 400,
      isRetryable: false,
    });

    expect(isBadRequestError(error)).toBe(true);
  });

  it('isBadRequestError returns false for non-400 errors', () => {
    const error = new APICallError({
      message: 'server failed',
      url: 'https://api.openai.com/v1/responses',
      requestBodyValues: {},
      statusCode: 500,
      isRetryable: true,
    });

    expect(isBadRequestError(error)).toBe(false);
  });

  it('retries Bad Request errors when configured with isBadRequestError matcher', async () => {
    const processor = new StreamErrorRetryProcessor({
      maxRetries: 1,
      matchers: [isBadRequestError],
    });
    const error = new APICallError({
      message: 'Invalid request: Bad Request',
      url: 'https://api.openai.com/v1/responses',
      requestBodyValues: {},
      statusCode: 400,
      isRetryable: false,
    });

    await expect(processor.processAPIError(makeArgs({ error }))).resolves.toEqual({ retry: true });
  });

  it('does not retry Bad Request more than maxRetries allows', async () => {
    const processor = new StreamErrorRetryProcessor({
      maxRetries: 1,
      matchers: [isBadRequestError],
    });
    const error = new APICallError({
      message: 'Invalid request: Bad Request',
      url: 'https://api.openai.com/v1/responses',
      requestBodyValues: {},
      statusCode: 400,
      isRetryable: false,
    });

    await expect(processor.processAPIError(makeArgs({ error, retryCount: 1 }))).resolves.toBeUndefined();
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

  describe('retryUnknownErrors', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('does not retry unmatched errors when omitted or false', async () => {
      const error = new Error('unmatched stream error');

      await expect(new StreamErrorRetryProcessor().processAPIError(makeArgs({ error }))).resolves.toBeUndefined();
      await expect(
        new StreamErrorRetryProcessor({ retryUnknownErrors: false }).processAPIError(makeArgs({ error })),
      ).resolves.toBeUndefined();
    });

    it('retries unmatched errors up to the processor maxRetries', async () => {
      const processor = new StreamErrorRetryProcessor({ retryUnknownErrors: true, maxRetries: 2 });
      const error = new Error('unmatched stream error');

      await expect(processor.processAPIError(makeArgs({ error, retryCount: 0 }))).resolves.toEqual({ retry: true });
      await expect(processor.processAPIError(makeArgs({ error, retryCount: 1 }))).resolves.toEqual({ retry: true });
      await expect(processor.processAPIError(makeArgs({ error, retryCount: 2 }))).resolves.toBeUndefined();
    });

    it.each([401, 403])('does not retry terminal HTTP %s authorization errors', async statusCode => {
      const processor = new StreamErrorRetryProcessor({ retryUnknownErrors: true });

      await expect(processor.processAPIError(makeArgs({ error: { statusCode } }))).resolves.toBeUndefined();
      await expect(
        processor.processAPIError(makeArgs({ error: new Error('wrapped', { cause: { status: statusCode } }) })),
      ).resolves.toBeUndefined();
    });

    it.each(['access_denied', 'authentication_error', 'forbidden', 'invalid_api_key', 'permission_denied'])(
      'does not retry terminal authorization code %s',
      async code => {
        const processor = new StreamErrorRetryProcessor({ retryUnknownErrors: true });

        await expect(processor.processAPIError(makeArgs({ error: { error: { code } } }))).resolves.toBeUndefined();
      },
    );

    it('detects terminal authorization codes in API call response bodies', async () => {
      const processor = new StreamErrorRetryProcessor({ retryUnknownErrors: true });
      const error = new APICallError({
        message: 'invalid credentials',
        url: 'https://api.example.com/v1/messages',
        requestBodyValues: {},
        statusCode: 400,
        responseBody: JSON.stringify({ error: { type: 'authentication_error' } }),
        isRetryable: false,
      });

      await expect(processor.processAPIError(makeArgs({ error }))).resolves.toBeUndefined();
    });

    it('does not treat isRetryable false alone as a terminal error', async () => {
      const processor = new StreamErrorRetryProcessor({ retryUnknownErrors: true });
      const error = new APICallError({
        message: 'unknown provider failure',
        url: 'https://api.example.com/v1/messages',
        requestBodyValues: {},
        statusCode: 422,
        responseBody: JSON.stringify({ error: { type: 'unknown_stream_failure' } }),
        isRetryable: false,
      });

      await expect(processor.processAPIError(makeArgs({ error }))).resolves.toEqual({ retry: true });
    });

    it('uses the processor delayMs for unmatched errors', async () => {
      vi.useFakeTimers();
      const processor = new StreamErrorRetryProcessor({ retryUnknownErrors: true, delayMs: 1000 });
      const promise = processor.processAPIError(makeArgs({ error: new Error('unmatched stream error') }));

      let resolved = false;
      void promise.then(() => {
        resolved = true;
      });
      await vi.advanceTimersByTimeAsync(999);
      expect(resolved).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await expect(promise).resolves.toEqual({ retry: true });
    });

    it('preserves specific matcher policies before the catch-all fallback', async () => {
      const processor = new StreamErrorRetryProcessor({
        retryUnknownErrors: true,
        maxRetries: 3,
        matchers: [{ match: isBadRequestError, maxRetries: 1 }],
      });

      await expect(
        processor.processAPIError(makeArgs({ error: { statusCode: 400 }, retryCount: 1 })),
      ).resolves.toBeUndefined();
      await expect(
        processor.processAPIError(makeArgs({ error: new Error('unmatched stream error'), retryCount: 1 })),
      ).resolves.toEqual({ retry: true });
    });

    it('resolves a specific policy in the cause chain before falling back', async () => {
      const processor = new StreamErrorRetryProcessor({
        retryUnknownErrors: true,
        maxRetries: 3,
        matchers: [{ match: isBadRequestError, maxRetries: 1 }],
      });
      const error = new Error('wrapped', { cause: { statusCode: 400 } });

      await expect(processor.processAPIError(makeArgs({ error, retryCount: 1 }))).resolves.toBeUndefined();
    });

    it('uses the abort-aware delay path and removes its listener for catch-all retries', async () => {
      vi.useFakeTimers();
      const controller = new AbortController();
      const removeSpy = vi.spyOn(controller.signal, 'removeEventListener');
      const processor = new StreamErrorRetryProcessor({ retryUnknownErrors: true, delayMs: 60_000 });
      const promise = processor.processAPIError(
        makeArgs({ error: new Error('unmatched stream error'), abortSignal: controller.signal }),
      );

      controller.abort();
      await expect(promise).resolves.toEqual({ retry: true });
      expect(removeSpy).toHaveBeenCalledWith('abort', expect.any(Function));
    });
  });

  describe('per-matcher policy', () => {
    it('uses per-matcher maxRetries instead of processor-level default', async () => {
      const processor = new StreamErrorRetryProcessor({
        maxRetries: 3,
        matchers: [{ match: isBadRequestError, maxRetries: 1 }],
      });
      const error = { statusCode: 400, message: 'Bad Request' };

      // First retry allowed (retryCount 0 < maxRetries 1).
      await expect(processor.processAPIError(makeArgs({ error }))).resolves.toEqual({ retry: true });
      // Second retry blocked by per-matcher maxRetries: 1.
      await expect(processor.processAPIError(makeArgs({ error, retryCount: 1 }))).resolves.toBeUndefined();
    });

    it('uses per-matcher delayMs instead of processor-level default', async () => {
      vi.useFakeTimers();
      const processor = new StreamErrorRetryProcessor({
        delayMs: 5000,
        matchers: [{ match: isBadRequestError, maxRetries: 1, delayMs: 100 }],
      });
      const error = { statusCode: 400, message: 'Bad Request' };

      let resolved = false;
      const promise = processor.processAPIError(makeArgs({ error })).then(result => {
        resolved = true;
        return result;
      });

      // Per-matcher delay is 100ms, not the processor-level 5000ms.
      await vi.advanceTimersByTimeAsync(99);
      expect(resolved).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await expect(promise).resolves.toEqual({ retry: true });
      vi.useRealTimers();
    });

    it('falls back to processor-level defaults when per-matcher policy omits fields', async () => {
      const processor = new StreamErrorRetryProcessor({
        maxRetries: 2,
        matchers: [{ match: isBadRequestError }],
      });
      const error = { statusCode: 400, message: 'Bad Request' };

      // Inherits processor-level maxRetries: 2.
      await expect(processor.processAPIError(makeArgs({ error, retryCount: 1 }))).resolves.toEqual({ retry: true });
      await expect(processor.processAPIError(makeArgs({ error, retryCount: 2 }))).resolves.toBeUndefined();
    });

    it('first-match-wins: earlier matcher policy takes precedence', async () => {
      const processor = new StreamErrorRetryProcessor({
        matchers: [
          { match: isBadRequestError, maxRetries: 1 },
          { match: () => true, maxRetries: 5 },
        ],
      });
      const error = { statusCode: 400, message: 'Bad Request' };

      // isBadRequestError matches first, so maxRetries: 1 applies.
      await expect(processor.processAPIError(makeArgs({ error, retryCount: 1 }))).resolves.toBeUndefined();
    });

    it('mixes plain function matchers and config objects', async () => {
      const customMatcher = (e: unknown) => e instanceof Error && e.message === 'custom';
      const processor = new StreamErrorRetryProcessor({
        matchers: [{ match: isBadRequestError, maxRetries: 1, delayMs: 2000 }, customMatcher],
        maxRetries: 3,
      });

      // Config object matcher uses its own maxRetries.
      const badReq = { statusCode: 400, message: 'Bad Request' };
      await expect(processor.processAPIError(makeArgs({ error: badReq, retryCount: 1 }))).resolves.toBeUndefined();

      // Plain function matcher uses processor-level maxRetries: 3.
      const custom = new Error('custom');
      await expect(processor.processAPIError(makeArgs({ error: custom, retryCount: 2 }))).resolves.toEqual({
        retry: true,
      });
    });
  });

  describe('Retry-After', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('waits a numeric Retry-After delay before retrying', async () => {
      vi.useFakeTimers();
      const processor = new StreamErrorRetryProcessor();
      const promise = processor.processAPIError(makeArgs({ error: makeRetryableError({ 'retry-after': '2' }) }));
      let resolved = false;
      void promise.then(() => {
        resolved = true;
      });

      await vi.advanceTimersByTimeAsync(1_999);
      expect(resolved).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await expect(promise).resolves.toEqual({ retry: true });
    });

    it('reads a case-insensitive HTTP-date Retry-After value in a cause chain', async () => {
      vi.useFakeTimers();
      const now = Date.UTC(2026, 6, 13, 12, 0, 0);
      vi.setSystemTime(now);
      const processor = new StreamErrorRetryProcessor();
      const error = new Error('wrapped', {
        cause: makeRetryableError({ 'ReTrY-AfTeR': new Date(now + 3_000).toUTCString() }),
      });
      const promise = processor.processAPIError(makeArgs({ error }));
      let resolved = false;
      void promise.then(() => {
        resolved = true;
      });

      await vi.advanceTimersByTimeAsync(2_999);
      expect(resolved).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await expect(promise).resolves.toEqual({ retry: true });
    });

    it('uses configured exponential backoff when it is longer than Retry-After', async () => {
      vi.useFakeTimers();
      const processor = new StreamErrorRetryProcessor({
        maxRetries: 5,
        delayMs: ({ retryCount }) => 1_000 * 2 ** retryCount,
      });
      const promise = processor.processAPIError(
        makeArgs({ error: makeRetryableError({ 'retry-after': '1' }), retryCount: 2 }),
      );
      let resolved = false;
      void promise.then(() => {
        resolved = true;
      });

      await vi.advanceTimersByTimeAsync(3_999);
      expect(resolved).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await expect(promise).resolves.toEqual({ retry: true });
    });

    it('uses Retry-After when it is longer than configured exponential backoff', async () => {
      vi.useFakeTimers();
      const processor = new StreamErrorRetryProcessor({
        maxRetries: 5,
        delayMs: ({ retryCount }) => 1_000 * 2 ** retryCount,
      });
      const promise = processor.processAPIError(
        makeArgs({ error: makeRetryableError({ 'retry-after': '5' }), retryCount: 1 }),
      );
      let resolved = false;
      void promise.then(() => {
        resolved = true;
      });

      await vi.advanceTimersByTimeAsync(4_999);
      expect(resolved).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await expect(promise).resolves.toEqual({ retry: true });
    });

    it.each([
      ['huge delta-seconds', '999999999'],
      ['far-future HTTP date', new Date(Date.UTC(2030, 0, 1)).toUTCString()],
    ])('caps the default Retry-After delay for %s', async (_description, retryAfter) => {
      vi.useFakeTimers();
      vi.setSystemTime(Date.UTC(2026, 6, 13, 12, 0, 0));
      const processor = new StreamErrorRetryProcessor();
      const promise = processor.processAPIError(makeArgs({ error: makeRetryableError({ 'retry-after': retryAfter }) }));
      let resolved = false;
      void promise.then(() => {
        resolved = true;
      });

      await vi.advanceTimersByTimeAsync(29_999);
      expect(resolved).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await expect(promise).resolves.toEqual({ retry: true });
    });

    it('respects a custom Retry-After cap', async () => {
      vi.useFakeTimers();
      const processor = new StreamErrorRetryProcessor({ maxRetryAfterMs: 1_234 });
      const promise = processor.processAPIError(makeArgs({ error: makeRetryableError({ 'retry-after': '60' }) }));
      let resolved = false;
      void promise.then(() => {
        resolved = true;
      });

      await vi.advanceTimersByTimeAsync(1_233);
      expect(resolved).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await expect(promise).resolves.toEqual({ retry: true });
    });

    it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
      'normalizes an invalid Retry-After cap of %s to no provider delay',
      async maxRetryAfterMs => {
        const processor = new StreamErrorRetryProcessor({ maxRetryAfterMs });

        await expect(
          processor.processAPIError(makeArgs({ error: makeRetryableError({ 'retry-after': '60' }) })),
        ).resolves.toEqual({ retry: true });
      },
    );

    it('retains an explicit delay that exceeds the Retry-After cap', async () => {
      vi.useFakeTimers();
      const processor = new StreamErrorRetryProcessor({ delayMs: 1_000, maxRetryAfterMs: 100 });
      const promise = processor.processAPIError(makeArgs({ error: makeRetryableError({ 'retry-after': '60' }) }));
      let resolved = false;
      void promise.then(() => {
        resolved = true;
      });

      await vi.advanceTimersByTimeAsync(999);
      expect(resolved).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await expect(promise).resolves.toEqual({ retry: true });
    });

    it.each(['invalid', '-1', ''])('ignores malformed or expired Retry-After value %j', async retryAfter => {
      vi.useFakeTimers();
      vi.setSystemTime(Date.UTC(2026, 6, 13, 12, 0, 0));
      const processor = new StreamErrorRetryProcessor();
      const error = makeRetryableError({
        'retry-after': retryAfter || new Date(Date.UTC(2026, 6, 13, 11, 59, 59)).toUTCString(),
      });

      await expect(processor.processAPIError(makeArgs({ error }))).resolves.toEqual({ retry: true });
    });

    it('does not wait for Retry-After after the retry budget is exhausted', async () => {
      vi.useFakeTimers();
      const processor = new StreamErrorRetryProcessor({ maxRetries: 1 });

      await expect(
        processor.processAPIError(makeArgs({ error: makeRetryableError({ 'retry-after': '60' }), retryCount: 1 })),
      ).resolves.toBeUndefined();
      expect(vi.getTimerCount()).toBe(0);
    });

    it('stops waiting for Retry-After when aborted', async () => {
      vi.useFakeTimers();
      const controller = new AbortController();
      const removeSpy = vi.spyOn(controller.signal, 'removeEventListener');
      const processor = new StreamErrorRetryProcessor();
      const promise = processor.processAPIError(
        makeArgs({ error: makeRetryableError({ 'retry-after': '60' }), abortSignal: controller.signal }),
      );

      await vi.advanceTimersByTimeAsync(1_000);
      controller.abort();
      await expect(promise).resolves.toEqual({ retry: true });
      expect(removeSpy).toHaveBeenCalledWith('abort', expect.any(Function));
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
