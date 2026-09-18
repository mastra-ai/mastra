import { APICallError } from '@internal/ai-sdk-v5';
import { describe, expect, it } from 'vitest';

import { MessageList } from '../agent/message-list';
import type { ProcessAPIErrorArgs } from './index';
import { ProviderHistoryCompat } from './provider-history-compat';
import { PrefillErrorHandler } from './prefill-error-handler';
import { StreamErrorRetryProcessor } from './stream-error-retry-processor';
import {
  ECONNRESET_MAX_RETRIES,
  ECONNRESET_RETRY_INITIAL_DELAY_MS,
  ECONNRESET_RETRY_MAX_DELAY_MS,
  defaultStabilityErrorProcessors,
  isECONNRESETError,
  STABILITY_ERROR_PROCESSOR_IDS,
} from './stability-defaults';

/**
 * Minimal args for driving `processAPIError` directly. `abortSignal` is always
 * pre-aborted so `waitDelay` resolves immediately instead of sleeping the
 * configured backoff — the retry decision (`{ retry: true }`) is unaffected.
 */
function makeArgs(overrides: Partial<ProcessAPIErrorArgs> = {}): ProcessAPIErrorArgs {
  const messageList = new MessageList({ threadId: 'stability-defaults-test' });
  messageList.add({ role: 'user', content: 'hello' }, 'input');

  return {
    error: new Error('test error'),
    messages: messageList.get.all.db(),
    messageList,
    stepNumber: 0,
    steps: [],
    state: {},
    retryCount: 0,
    abortSignal: AbortSignal.abort(),
    abort: (() => {
      throw new Error('abort');
    }) as ProcessAPIErrorArgs['abort'],
    ...overrides,
  };
}

function makeApiError(statusCode: number, isRetryable = false): APICallError {
  return new APICallError({
    message: `API error ${statusCode}`,
    url: 'https://example.com',
    requestBodyValues: {},
    statusCode,
    isRetryable,
  });
}

describe('STABILITY_ERROR_PROCESSOR_IDS', () => {
  it('matches the ids declared by the three default processor classes, in order', () => {
    expect([...STABILITY_ERROR_PROCESSOR_IDS]).toEqual([
      new ProviderHistoryCompat().id,
      new StreamErrorRetryProcessor().id,
      new PrefillErrorHandler().id,
    ]);
  });
});

describe('defaultStabilityErrorProcessors', () => {
  it('returns the three stability processors in order', () => {
    const processors = defaultStabilityErrorProcessors();

    expect(processors).toHaveLength(3);
    expect(processors.map(p => p.id)).toEqual([...STABILITY_ERROR_PROCESSOR_IDS]);
    expect(processors[0]).toBeInstanceOf(ProviderHistoryCompat);
    expect(processors[2]).toBeInstanceOf(PrefillErrorHandler);
  });

  it('returns distinct arrays and distinct instances on each call', () => {
    const first = defaultStabilityErrorProcessors();
    const second = defaultStabilityErrorProcessors();

    expect(first).not.toBe(second);
    expect(first[0]).not.toBe(second[0]);
    expect(first[1]).not.toBe(second[1]);
    expect(first[2]).not.toBe(second[2]);
  });

  it('returns processors with `processAPIError`, as the error lane requires', () => {
    const processors = defaultStabilityErrorProcessors();

    for (const processor of processors) {
      expect(typeof processor.processAPIError).toBe('function');
    }
  });
});

describe('default stability StreamErrorRetryProcessor policy', () => {
  function retryProcessor() {
    // The defaults order is [provider-history-compat, stream-error-retry-processor, prefill-error-handler].
    return defaultStabilityErrorProcessors()[1];
  }

  it('retries a bad-request (400) error exactly once, then stops', async () => {
    const processor = retryProcessor();
    const error = makeApiError(400);

    await expect(processor.processAPIError(makeArgs({ error, retryCount: 0 }))).resolves.toEqual({ retry: true });
    await expect(processor.processAPIError(makeArgs({ error, retryCount: 1 }))).resolves.toBeUndefined();
  });

  it('retries an ECONNRESET error twice with exponential backoff, then stops', async () => {
    const processor = retryProcessor();
    const error = Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' });

    await expect(processor.processAPIError(makeArgs({ error, retryCount: 0 }))).resolves.toEqual({ retry: true });
    await expect(processor.processAPIError(makeArgs({ error, retryCount: 1 }))).resolves.toEqual({ retry: true });
    await expect(processor.processAPIError(makeArgs({ error, retryCount: 2 }))).resolves.toBeUndefined();
  });

  it('never retries a known terminal authorization error (401)', async () => {
    const processor = retryProcessor();
    const error = makeApiError(401);

    await expect(processor.processAPIError(makeArgs({ error, retryCount: 0 }))).resolves.toBeUndefined();
  });

  it('retries an unknown 500 error twice via `retryUnknownErrors`', async () => {
    const processor = retryProcessor();
    const error = makeApiError(500, true);

    await expect(processor.processAPIError(makeArgs({ error, retryCount: 0 }))).resolves.toEqual({ retry: true });
    await expect(processor.processAPIError(makeArgs({ error, retryCount: 1 }))).resolves.toEqual({ retry: true });
    await expect(processor.processAPIError(makeArgs({ error, retryCount: 2 }))).resolves.toBeUndefined();
  });

  it('retries a generic unknown error twice via `retryUnknownErrors`', async () => {
    const processor = retryProcessor();
    const error = new Error('completely unknown failure');

    await expect(processor.processAPIError(makeArgs({ error, retryCount: 0 }))).resolves.toEqual({ retry: true });
    await expect(processor.processAPIError(makeArgs({ error, retryCount: 1 }))).resolves.toEqual({ retry: true });
    await expect(processor.processAPIError(makeArgs({ error, retryCount: 2 }))).resolves.toBeUndefined();
  });
});

describe('ECONNRESET policy constants and matcher', () => {
  it('uses the documented retry budget and backoff bounds', () => {
    expect(ECONNRESET_MAX_RETRIES).toBe(2);
    expect(ECONNRESET_RETRY_INITIAL_DELAY_MS).toBe(1000);
    expect(ECONNRESET_RETRY_MAX_DELAY_MS).toBe(30000);
  });

  it('matches an ECONNRESET error code', () => {
    expect(isECONNRESETError(Object.assign(new Error('boom'), { code: 'ECONNRESET' }))).toBe(true);
    expect(isECONNRESETError(Object.assign(new Error('boom'), { code: 'econnreset' }))).toBe(true);
  });

  it('matches a socket hang up message', () => {
    expect(isECONNRESETError(new Error('socket hang up'))).toBe(true);
    expect(isECONNRESETError(new Error('Socket Hang Up'))).toBe(true);
  });

  it('does not match unrelated errors', () => {
    expect(isECONNRESETError(undefined)).toBe(false);
    expect(isECONNRESETError(null)).toBe(false);
    expect(isECONNRESETError(new Error('rate limited'))).toBe(false);
    expect(isECONNRESETError(Object.assign(new Error('boom'), { code: 'ETIMEDOUT' }))).toBe(false);
  });
});
