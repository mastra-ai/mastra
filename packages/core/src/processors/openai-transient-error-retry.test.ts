import { APICallError } from '@internal/ai-sdk-v5';
import { describe, expect, it } from 'vitest';

import { MessageList } from '../agent/message-list';
import { isOpenAITransientError, OpenAITransientErrorRetry } from './openai-transient-error-retry';
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

describe('OpenAITransientErrorRetry', () => {
  it('has correct id and name', () => {
    const processor = new OpenAITransientErrorRetry();

    expect(processor.id).toBe('openai-transient-error-retry');
    expect(processor.name).toBe('OpenAI Transient Error Retry');
  });

  it('retries provider errors with retryable metadata', async () => {
    const processor = new OpenAITransientErrorRetry();
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
    const processor = new OpenAITransientErrorRetry();
    const error = new APICallError({
      message: 'bad request',
      url: 'https://api.openai.com/v1/responses',
      requestBodyValues: {},
      statusCode: 400,
      isRetryable: false,
    });

    await expect(processor.processAPIError(makeArgs({ error }))).resolves.toBeUndefined();
  });

  it('retries retryable status codes in cause chain', () => {
    const error = new Error('wrapped', {
      cause: {
        status: 503,
      },
    });

    expect(isOpenAITransientError(error)).toBe(true);
  });

  it('retries OpenAI Responses stream error chunks with retryable codes', async () => {
    const processor = new OpenAITransientErrorRetry();
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

  it('retries OpenAI Responses failed chunks with explicit retry guidance', async () => {
    const processor = new OpenAITransientErrorRetry();
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

    await expect(processor.processAPIError(makeArgs({ error }))).resolves.toEqual({ retry: true });
  });

  it('does not retry non-transient OpenAI Responses stream error chunks', async () => {
    const processor = new OpenAITransientErrorRetry();
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
    const processor = new OpenAITransientErrorRetry({ maxRetries: 1 });
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
