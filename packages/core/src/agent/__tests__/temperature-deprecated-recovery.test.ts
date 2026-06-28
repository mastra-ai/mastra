import { randomUUID } from 'node:crypto';
import { APICallError } from '@internal/ai-sdk-v5';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { MockMemory } from '../../memory/mock';
import { TemperatureDeprecatedHandler } from '../../processors/temperature-deprecated-handler';
import { Agent } from '../agent';

/**
 * Integration test for TemperatureDeprecatedHandler recovery.
 *
 * Simulates a model (e.g. Anthropic's `claude-opus-4-7`) that dropped support
 * for `temperature`:
 * - The mock model rejects the first call with a 400 whenever `temperature` is
 *   present in the call settings.
 * - TemperatureDeprecatedHandler catches it, strips `temperature` from
 *   modelSettings, and signals retry.
 * - On retry the same model receives no `temperature` and succeeds.
 *
 * Related: https://github.com/mastra-ai/mastra/issues/16247
 */
function createTemperatureDeprecatedModel(responseText: string) {
  const errorMessage = '`temperature` is deprecated for this model.';

  const reject = () => {
    throw new APICallError({
      message: errorMessage,
      url: 'https://api.anthropic.com/v1/messages',
      requestBodyValues: {},
      statusCode: 400,
      responseBody: JSON.stringify({
        type: 'error',
        error: { type: 'invalid_request_error', message: errorMessage },
      }),
      isRetryable: false,
    });
  };

  const model = new MockLanguageModelV2({
    modelId: 'mock-temperature-deprecated',
    doGenerate: async ({ temperature }) => {
      if (temperature !== undefined) reject();
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        content: [{ type: 'text' as const, text: responseText }],
        warnings: [],
      };
    },
    doStream: async ({ temperature }) => {
      if (temperature !== undefined) reject();
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-0', modelId: 'mock-temperature-deprecated', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: responseText },
          { type: 'text-end', id: 'text-1' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
        ]),
      };
    },
  });

  return model;
}

describe('TemperatureDeprecatedHandler Recovery', () => {
  describe('generate()', () => {
    it('strips temperature and retries when the model rejects it', async () => {
      const model = createTemperatureDeprecatedModel('Recovery successful!');
      const handler = new TemperatureDeprecatedHandler();

      const agent = new Agent({
        id: 'temperature-deprecated-generate',
        name: 'Temperature Deprecated Test Agent',
        instructions: 'You are a test agent',
        model: [{ model, maxRetries: 0 }],
        inputProcessors: [handler],
        errorProcessors: [handler],
      });

      const result = await agent.generate('Hello', { modelSettings: { temperature: 0.7 } });

      expect(result.text).toBe('Recovery successful!');
      // First call carried temperature and failed; retry dropped it and succeeded.
      expect(model.doGenerateCalls).toHaveLength(2);
      expect(model.doGenerateCalls[0]?.temperature).toBe(0.7);
      expect(model.doGenerateCalls[1]?.temperature).toBeUndefined();
    });

    it('does not retry when no error processor is registered', async () => {
      const model = createTemperatureDeprecatedModel('unused');

      const agent = new Agent({
        id: 'temperature-deprecated-no-handler',
        name: 'Temperature Deprecated No Handler',
        instructions: 'You are a test agent',
        model: [{ model, maxRetries: 0 }],
      });

      await expect(agent.generate('Hello', { modelSettings: { temperature: 0.7 } })).rejects.toThrow(
        /temperature.*deprecated/i,
      );
    });
  });

  describe('stream()', () => {
    it('strips temperature and retries when the model rejects it', async () => {
      const mockMemory = new MockMemory();
      const threadId = randomUUID();
      const resourceId = randomUUID();
      await mockMemory.createThread({ threadId, resourceId });

      const model = createTemperatureDeprecatedModel('Stream recovery!');
      const handler = new TemperatureDeprecatedHandler();

      const agent = new Agent({
        id: 'temperature-deprecated-stream',
        name: 'Temperature Deprecated Stream Agent',
        instructions: 'You are a test agent',
        model: [{ model, maxRetries: 0 }],
        memory: mockMemory,
        inputProcessors: [handler],
        errorProcessors: [handler],
      });

      const result = await agent.stream('Hello', {
        modelSettings: { temperature: 0.7 },
        memory: { thread: threadId, resource: resourceId },
      });

      const fullText = await result.text;

      expect(fullText).toBe('Stream recovery!');
      expect(model.doStreamCalls).toHaveLength(2);
      expect(model.doStreamCalls[0]?.temperature).toBe(0.7);
      expect(model.doStreamCalls[1]?.temperature).toBeUndefined();
    });

    it('also strips top_p and top_k alongside temperature', async () => {
      const model = createTemperatureDeprecatedModel('Recovery successful!');
      const handler = new TemperatureDeprecatedHandler();

      const agent = new Agent({
        id: 'temperature-deprecated-topp-topk',
        name: 'Temperature Deprecated TopP TopK Agent',
        instructions: 'You are a test agent',
        model: [{ model, maxRetries: 0 }],
        inputProcessors: [handler],
        errorProcessors: [handler],
      });

      const result = await agent.generate('Hello', {
        modelSettings: { temperature: 0.7, topP: 0.9, topK: 40 },
      });

      expect(result.text).toBe('Recovery successful!');
      expect(model.doGenerateCalls).toHaveLength(2);
      expect(model.doGenerateCalls[1]?.temperature).toBeUndefined();
      expect(model.doGenerateCalls[1]?.topP).toBeUndefined();
      expect(model.doGenerateCalls[1]?.topK).toBeUndefined();
    });
  });
});
