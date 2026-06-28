import { APICallError } from '@internal/ai-sdk-v5';
import { describe, expect, it } from 'vitest';
import { MessageList } from '../agent/message-list';
import { TemperatureDeprecatedHandler } from './temperature-deprecated-handler';
import type { ProcessAPIErrorArgs, ProcessInputStepArgs } from './index';

function createTemperatureDeprecatedError() {
  return new APICallError({
    message: '`temperature` is deprecated for this model.',
    url: 'https://api.anthropic.com/v1/messages',
    requestBodyValues: {},
    statusCode: 400,
    responseBody: JSON.stringify({
      type: 'error',
      error: {
        type: 'invalid_request_error',
        message: '`temperature` is deprecated for this model.',
      },
    }),
    isRetryable: false,
  });
}

function createTopPUnsupportedError() {
  return new APICallError({
    message: 'top_p is not supported for this model.',
    url: 'https://api.anthropic.com/v1/messages',
    requestBodyValues: {},
    statusCode: 400,
    responseBody: JSON.stringify({ error: { message: 'top_p is not supported for this model.' } }),
    isRetryable: false,
  });
}

function createDeprecatedInBodyOnlyError() {
  return new APICallError({
    message: 'Bad request',
    url: 'https://api.anthropic.com/v1/messages',
    requestBodyValues: {},
    statusCode: 400,
    responseBody: JSON.stringify({
      error: {
        type: 'invalid_request_error',
        message: 'The temperature parameter is no longer supported.',
      },
    }),
    isRetryable: false,
  });
}

function createOtherError() {
  return new APICallError({
    message: 'Rate limit exceeded',
    url: 'https://api.anthropic.com/v1/messages',
    requestBodyValues: {},
    statusCode: 429,
    responseBody: JSON.stringify({ error: { message: 'Rate limit exceeded' } }),
    isRetryable: true,
  });
}

function makeErrorArgs(overrides: Partial<ProcessAPIErrorArgs> = {}): ProcessAPIErrorArgs {
  const messageList = new MessageList({ threadId: 'test-thread' });

  return {
    error: createTemperatureDeprecatedError(),
    messages: messageList.get.all.db(),
    messageList,
    stepNumber: 0,
    steps: [],
    state: {},
    retryCount: 0,
    abort: (() => {
      throw new Error('abort');
    }) as any,
    ...overrides,
  } as unknown as ProcessAPIErrorArgs;
}

function makeInputStepArgs(overrides: Partial<ProcessInputStepArgs> = {}): ProcessInputStepArgs {
  const messageList = new MessageList({ threadId: 'test-thread' });

  return {
    messageList,
    messages: messageList.get.all.db(),
    systemMessages: [],
    stepNumber: 0,
    steps: [],
    state: {},
    retryCount: 0,
    model: {} as any,
    modelSettings: { temperature: 0.7, topP: 0.9, maxOutputTokens: 100 },
    abort: (() => {
      throw new Error('abort');
    }) as any,
    ...overrides,
  } as unknown as ProcessInputStepArgs;
}

describe('TemperatureDeprecatedHandler', () => {
  describe('processAPIError', () => {
    it('returns { retry: true } and flags state for a temperature-deprecated 400', async () => {
      const handler = new TemperatureDeprecatedHandler();
      const state: Record<string, unknown> = {};

      const result = await handler.processAPIError(makeErrorArgs({ state }));

      expect(result).toEqual({ retry: true });
      // State is flagged so the next processInputStep strips the sampling params.
      expect(Object.values(state).some(Boolean)).toBe(true);
    });

    it('returns { retry: true } for a top_p unsupported 400', async () => {
      const handler = new TemperatureDeprecatedHandler();

      const result = await handler.processAPIError(makeErrorArgs({ error: createTopPUnsupportedError() }));

      expect(result).toEqual({ retry: true });
    });

    it('matches the deprecation message when it is only in the response body', async () => {
      const handler = new TemperatureDeprecatedHandler();

      const result = await handler.processAPIError(makeErrorArgs({ error: createDeprecatedInBodyOnlyError() }));

      expect(result).toEqual({ retry: true });
    });

    it('returns { retry: true } for plain Error objects containing a deprecation message', async () => {
      const handler = new TemperatureDeprecatedHandler();

      const result = await handler.processAPIError(
        makeErrorArgs({ error: new Error('temperature is deprecated for this model') }),
      );

      expect(result).toEqual({ retry: true });
    });

    it('returns undefined for unrelated errors', async () => {
      const handler = new TemperatureDeprecatedHandler();

      const result = await handler.processAPIError(makeErrorArgs({ error: createOtherError() }));

      expect(result).toBeUndefined();
    });

    it('returns undefined for plain Error objects without a deprecation message', async () => {
      const handler = new TemperatureDeprecatedHandler();

      const result = await handler.processAPIError(makeErrorArgs({ error: new Error('Something else went wrong') }));

      expect(result).toBeUndefined();
    });

    it('does not flag state for unrelated errors', async () => {
      const handler = new TemperatureDeprecatedHandler();
      const state: Record<string, unknown> = {};

      await handler.processAPIError(makeErrorArgs({ error: createOtherError(), state }));

      expect(Object.keys(state)).toHaveLength(0);
    });

    it('returns undefined when retryCount > 0 (only retries once)', async () => {
      const handler = new TemperatureDeprecatedHandler();

      const result = await handler.processAPIError(makeErrorArgs({ retryCount: 1 }));

      expect(result).toBeUndefined();
    });
  });

  describe('processInputStep', () => {
    it('does nothing before a deprecation error has been seen', () => {
      const handler = new TemperatureDeprecatedHandler();

      const result = handler.processInputStep(makeInputStepArgs({ state: {} }));

      expect(result).toBeUndefined();
    });

    it('strips temperature, topP, and topK once the state flag is set', async () => {
      const handler = new TemperatureDeprecatedHandler();
      const state: Record<string, unknown> = {};

      // The error handler flags the shared state first.
      await handler.processAPIError(makeErrorArgs({ state }));

      const result = handler.processInputStep(
        makeInputStepArgs({ state, modelSettings: { temperature: 0.7, topP: 0.9, topK: 40, maxOutputTokens: 100 } }),
      );

      expect(result).toBeDefined();
      const modelSettings = (result as { modelSettings: Record<string, unknown> }).modelSettings;
      expect(modelSettings).not.toHaveProperty('temperature');
      expect(modelSettings).not.toHaveProperty('topP');
      expect(modelSettings).not.toHaveProperty('topK');
      // Unrelated settings are preserved.
      expect(modelSettings.maxOutputTokens).toBe(100);
    });

    it('returns undefined when the flag is set but no sampling params are present', async () => {
      const handler = new TemperatureDeprecatedHandler();
      const state: Record<string, unknown> = {};

      await handler.processAPIError(makeErrorArgs({ state }));

      const result = handler.processInputStep(makeInputStepArgs({ state, modelSettings: { maxOutputTokens: 100 } }));

      expect(result).toBeUndefined();
    });

    it('returns undefined when the flag is set but modelSettings is undefined', async () => {
      const handler = new TemperatureDeprecatedHandler();
      const state: Record<string, unknown> = {};

      await handler.processAPIError(makeErrorArgs({ state }));

      const result = handler.processInputStep(makeInputStepArgs({ state, modelSettings: undefined }));

      expect(result).toBeUndefined();
    });
  });

  it('has correct id and name', () => {
    const handler = new TemperatureDeprecatedHandler();
    expect(handler.id).toBe('temperature-deprecated-handler');
    expect(handler.name).toBe('Temperature Deprecated Handler');
  });
});
