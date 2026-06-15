import { APICallError } from '@internal/ai-sdk-v5';
import { describe, expect, it } from 'vitest';

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
});
