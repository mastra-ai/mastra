import { APICallError } from '@internal/ai-sdk-v5';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { RequestContext } from '../../request-context';
import { Agent } from '../agent';

function createRecordingStreamModel(modelId: string, responseText: string) {
  return new MockLanguageModelV2({
    modelId,
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId, timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: responseText },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 } },
      ]),
    }),
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
      text: responseText,
      content: [{ type: 'text', text: responseText }],
      warnings: [],
    }),
  });
}

function createThrowingStreamModel(modelId: string, statusCode: number) {
  return new MockLanguageModelV2({
    modelId,
    doStream: async () => {
      throw new APICallError({
        message: `Status ${statusCode}`,
        url: 'https://api.example.com',
        requestBodyValues: {},
        statusCode,
        isRetryable: false,
      });
    },
    doGenerate: async () => {
      throw new APICallError({
        message: `Status ${statusCode}`,
        url: 'https://api.example.com',
        requestBodyValues: {},
        statusCode,
        isRetryable: false,
      });
    },
  });
}

describe('Per-fallback-entry settings', () => {
  describe('modelSettings', () => {
    it('should pass each fallback entry its own temperature to doStream', async () => {
      const primary = createRecordingStreamModel('primary-temp', 'primary response');
      const secondary = createRecordingStreamModel('secondary-temp', 'secondary response');

      const agent = new Agent({
        id: 'per-model-temperature',
        name: 'Per-Model Temperature Test',
        instructions: 'You are a test agent',
        model: [
          { model: primary, maxRetries: 0, modelSettings: { temperature: 0.3 } },
          { model: secondary, maxRetries: 0, modelSettings: { temperature: 0.7 } },
        ],
      });

      await (
        await agent.stream('Hello')
      ).text;

      expect(primary.doStreamCalls[0]?.temperature).toBe(0.3);
    });

    it('should apply the fallback entry temperature after the primary errors', async () => {
      const primary = createThrowingStreamModel('primary-fail', 429);
      const secondary = createRecordingStreamModel('secondary-temp', 'secondary response');

      const agent = new Agent({
        id: 'fallback-after-error-temperature',
        name: 'Fallback After Error Temperature Test',
        instructions: 'You are a test agent',
        model: [
          { model: primary, maxRetries: 0, modelSettings: { temperature: 0.1 } },
          { model: secondary, maxRetries: 0, modelSettings: { temperature: 0.9 } },
        ],
      });

      const text = await (await agent.stream('Hello')).text;

      expect(text).toBe('secondary response');
      expect(secondary.doStreamCalls[0]?.temperature).toBe(0.9);
    });

    it('should shallow-merge per-entry modelSettings on top of call-time modelSettings', async () => {
      const primary = createRecordingStreamModel('shallow-merge', 'ok');

      const agent = new Agent({
        id: 'shallow-merge-modelSettings',
        name: 'Shallow Merge Test',
        instructions: 'You are a test agent',
        model: [{ model: primary, maxRetries: 0, modelSettings: { temperature: 0.25 } }],
      });

      await (
        await agent.stream('Hello', { modelSettings: { temperature: 1, topP: 0.5 } as any })
      ).text;

      expect(primary.doStreamCalls[0]?.temperature).toBe(0.25);
      expect(primary.doStreamCalls[0]?.topP).toBe(0.5);
    });

    it('should resolve a function-form modelSettings using requestContext', async () => {
      const primary = createRecordingStreamModel('dynamic-settings', 'ok');
      const requestContext = new RequestContext();
      requestContext.set('tier', 'premium');

      const agent = new Agent({
        id: 'dynamic-modelSettings',
        name: 'Dynamic ModelSettings Test',
        instructions: 'You are a test agent',
        model: [
          {
            model: primary,
            maxRetries: 0,
            modelSettings: ({ requestContext }) =>
              requestContext.get('tier') === 'premium' ? { temperature: 0.1 } : { temperature: 0.9 },
          },
        ],
      });

      await (
        await agent.stream('Hello', { requestContext })
      ).text;
      expect(primary.doStreamCalls[0]?.temperature).toBe(0.1);
    });
  });

  describe('providerOptions', () => {
    it('should deep-merge per-entry providerOptions on top of call-time providerOptions', async () => {
      const primary = createRecordingStreamModel('provider-merge', 'ok');

      const agent = new Agent({
        id: 'provider-options-merge',
        name: 'ProviderOptions Merge Test',
        instructions: 'You are a test agent',
        model: [
          {
            model: primary,
            maxRetries: 0,
            providerOptions: { openai: { reasoningEffort: 'high' } } as any,
          },
        ],
      });

      await (
        await agent.stream('Hello', {
          providerOptions: { openai: { user: 'abc' }, google: { thinkingConfig: { thinkingBudget: 0 } } } as any,
        })
      ).text;

      const po = primary.doStreamCalls[0]?.providerOptions as Record<string, Record<string, unknown>>;
      expect(po?.openai).toEqual({ user: 'abc', reasoningEffort: 'high' });
      expect(po?.google).toEqual({ thinkingConfig: { thinkingBudget: 0 } });
    });

    it('should not leak primary providerOptions into the fallback after failover', async () => {
      const primary = createThrowingStreamModel('primary-fail', 429);
      const secondary = createRecordingStreamModel('secondary-provider', 'secondary response');

      const agent = new Agent({
        id: 'provider-options-after-failover',
        name: 'ProviderOptions After Failover Test',
        instructions: 'You are a test agent',
        model: [
          {
            model: primary,
            maxRetries: 0,
            providerOptions: { openai: { reasoningEffort: 'low' } } as any,
          },
          {
            model: secondary,
            maxRetries: 0,
            providerOptions: { google: { thinkingConfig: { thinkingBudget: 8000 } } } as any,
          },
        ],
      });

      await (
        await agent.stream('Hello')
      ).text;

      const po = secondary.doStreamCalls[0]?.providerOptions as Record<string, Record<string, unknown>>;
      expect(po?.google).toEqual({ thinkingConfig: { thinkingBudget: 8000 } });
      expect(po?.openai).toBeUndefined();
    });
  });

  describe('headers', () => {
    it('should pass per-entry headers to doStream', async () => {
      const primary = createRecordingStreamModel('per-entry-headers', 'ok');

      const agent = new Agent({
        id: 'per-entry-headers',
        name: 'Per-Entry Headers Test',
        instructions: 'You are a test agent',
        model: [{ model: primary, maxRetries: 0, headers: { 'x-region': 'eu', 'x-tenant': 'acme' } }],
      });

      await (
        await agent.stream('Hello')
      ).text;

      const sent = (primary.doStreamCalls[0]?.headers ?? {}) as Record<string, string>;
      expect(sent['x-region']).toBe('eu');
      expect(sent['x-tenant']).toBe('acme');
    });

    it('should let call-time modelSettings.headers override per-entry headers for the same key', async () => {
      const primary = createRecordingStreamModel('header-precedence', 'ok');

      const agent = new Agent({
        id: 'header-precedence',
        name: 'Header Precedence Test',
        instructions: 'You are a test agent',
        model: [{ model: primary, maxRetries: 0, headers: { 'x-region': 'eu' } }],
      });

      await (
        await agent.stream('Hello', { modelSettings: { headers: { 'x-region': 'us' } } as any })
      ).text;

      const sent = (primary.doStreamCalls[0]?.headers ?? {}) as Record<string, string>;
      expect(sent['x-region']).toBe('us');
    });
  });
});
