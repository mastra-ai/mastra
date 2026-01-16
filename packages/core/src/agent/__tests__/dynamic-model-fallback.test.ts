import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { RequestContext } from '../../request-context';
import { Agent } from '../agent';

describe('Dynamic Model Selection with Fallback', () => {
  it('should support all models being dynamic in fallback array', async () => {
    const model1 = new MockLanguageModelV2({
      doGenerate: async () => {
        throw new Error('Model 1 failed');
      },
      doStream: async () => {
        const stream = new ReadableStream({
          pull() {
            throw new Error('Model 1 failed');
          },
        });
        return { stream, rawCall: { rawPrompt: null, rawSettings: {} } };
      },
    });

    const model2 = new MockLanguageModelV2({
      doGenerate: async () => {
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
          text: 'Model 2 success',
          content: [
            {
              type: 'text',
              text: 'Model 2 success',
            },
          ],
          warnings: [],
        };
      },
      doStream: async () => {
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            {
              type: 'stream-start',
              warnings: [],
            },
            {
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'model-2',
              timestamp: new Date(0),
            },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Model 2 success' },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
            },
          ]),
        };
      },
    });

    // Create agent where all models in fallback array are dynamic
    const agent = new Agent({
      id: 'all-dynamic-fallback',
      name: 'All Dynamic Fallback Test',
      instructions: 'You are a test agent',
      model: [
        {
          model: ({ requestContext }) => {
            requestContext.get('tier');
            return model1;
          },
        },
        {
          model: ({ requestContext }) => {
            requestContext.get('tier');
            return model2;
          },
        },
      ],
    });

    const requestContext = new RequestContext();
    const streamResult = await agent.stream('Test message', { requestContext });
    const fullText = await streamResult.text;

    expect(fullText).toBe('Model 2 success');
  });

  it('should support dynamic model selection using magic strings in fallback', async () => {
    // This test uses model router magic strings in a dynamic function
    const agent = new Agent({
      id: 'dynamic-string-fallback',
      name: 'Dynamic String Fallback Test',
      instructions: 'You are a test agent',
      model: [
        {
          model: ({ requestContext }) => {
            const tier = requestContext.get('tier');
            if (tier === 'premium') {
              return 'openai/gpt-4';
            }
            return 'openai/gpt-3.5-turbo';
          },
        },
        {
          model: 'anthropic/claude-3-5-sonnet-20241022',
        },
      ],
    });

    // Just verify the agent is created successfully
    // We can't actually call the model without API keys, but we can verify the config
    const modelList = await agent.getModelList();
    expect(modelList).not.toBeNull();
    expect(modelList?.length).toBe(2);
  });

  it('should support config object with dynamic model selection', async () => {
    const workingModel = new MockLanguageModelV2({
      doGenerate: async () => {
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
          text: 'Success with config',
          content: [
            {
              type: 'text',
              text: 'Success with config',
            },
          ],
          warnings: [],
        };
      },
      doStream: async () => {
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            {
              type: 'stream-start',
              warnings: [],
            },
            {
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'config-model',
              timestamp: new Date(0),
            },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Success with config' },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
            },
          ]),
        };
      },
    });

    // Test with model config object that includes options
    const agent = new Agent({
      id: 'dynamic-config-fallback',
      name: 'Dynamic Config Fallback Test',
      instructions: 'You are a test agent',
      model: [
        {
          model: ({ requestContext }) => {
            const useCustomModel = requestContext.get('useCustomModel');
            if (useCustomModel) {
              // Return a config object
              return {
                id: 'openai/gpt-4',
                apiKey: 'test-key',
              };
            }
            return workingModel;
          },
        },
      ],
    });

    const requestContext = new RequestContext();
    requestContext.set('useCustomModel', false);

    const streamResult = await agent.stream('Test message', { requestContext });
    const fullText = await streamResult.text;

    expect(fullText).toBe('Success with config');
  });

  it('should support dynamic function returning fallback array', async () => {
    // This is the key feature - a function that returns an entire fallback array
    const failingModel = new MockLanguageModelV2({
      doGenerate: async () => {
        throw new Error('Primary model failed');
      },
      doStream: async () => {
        const stream = new ReadableStream({
          pull() {
            throw new Error('Primary model failed');
          },
        });
        return { stream, rawCall: { rawPrompt: null, rawSettings: {} } };
      },
    });

    const backupModel = new MockLanguageModelV2({
      doGenerate: async () => {
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
          text: 'Backup succeeded',
          content: [
            {
              type: 'text',
              text: 'Backup succeeded',
            },
          ],
          warnings: [],
        };
      },
      doStream: async () => {
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            {
              type: 'stream-start',
              warnings: [],
            },
            {
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'backup-model',
              timestamp: new Date(0),
            },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Backup succeeded' },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
            },
          ]),
        };
      },
    });

    // Create agent where the model is a function that returns a fallback array
    const agent = new Agent({
      id: 'dynamic-array-return',
      name: 'Dynamic Array Return Test',
      instructions: 'You are a test agent',
      model: ({ requestContext }) => {
        const tier = requestContext.get('tier');

        // Return different fallback configurations based on context
        if (tier === 'premium') {
          return [
            { model: failingModel, maxRetries: 2 },
            { model: backupModel, maxRetries: 0 },
          ];
        }

        // Free tier gets simpler fallback
        return [{ model: backupModel, maxRetries: 1 }];
      },
    });

    const requestContext = new RequestContext();
    requestContext.set('tier', 'premium');

    const streamResult = await agent.stream('Test message', { requestContext });
    const fullText = await streamResult.text;

    // Should fallback to backup model after primary fails
    expect(fullText).toBe('Backup succeeded');
  });

  it('should inherit agent-level maxRetries when not specified in dynamic fallback array', async () => {
    // This test verifies the bug fix: dynamic arrays should inherit this.maxRetries
    const workingModel = new MockLanguageModelV2({
      doGenerate: async () => {
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
          text: 'Test response',
          content: [
            {
              type: 'text',
              text: 'Test response',
            },
          ],
          warnings: [],
        };
      },
      doStream: async () => {
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            {
              type: 'stream-start',
              warnings: [],
            },
            {
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'test-model',
              timestamp: new Date(0),
            },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Test response' },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
            },
          ]),
        };
      },
    });

    const agent = new Agent({
      id: 'maxretries-inheritance-test',
      name: 'MaxRetries Inheritance Test',
      instructions: 'You are a test agent',
      model: ({ requestContext }) => {
        return [
          { model: workingModel }, // No maxRetries specified - should inherit agent-level
          { model: workingModel, maxRetries: 1 }, // Explicit maxRetries should be preserved
        ];
      },
      maxRetries: 3, // Agent-level default
    });

    const requestContext = new RequestContext();
    const modelList = await agent.getModelList(requestContext);

    expect(modelList).not.toBeNull();
    expect(modelList?.length).toBe(2);
    // First model should inherit agent-level maxRetries (3)
    expect(modelList?.[0]?.maxRetries).toBe(3);
    // Second model should keep its explicit maxRetries (1)
    expect(modelList?.[1]?.maxRetries).toBe(1);
  });

  it('should inherit agent-level maxRetries for static arrays passed to resolveModelFallbacks', async () => {
    // This test verifies that static arrays also inherit maxRetries correctly
    const workingModel = new MockLanguageModelV2({
      doGenerate: async () => {
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
          text: 'Test response',
          content: [
            {
              type: 'text',
              text: 'Test response',
            },
          ],
          warnings: [],
        };
      },
      doStream: async () => {
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            {
              type: 'stream-start',
              warnings: [],
            },
            {
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'test-model',
              timestamp: new Date(0),
            },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Test response' },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
            },
          ]),
        };
      },
    });

    const agent = new Agent({
      id: 'static-maxretries-inheritance-test',
      name: 'Static MaxRetries Inheritance Test',
      instructions: 'You are a test agent',
      model: [
        { model: workingModel }, // No maxRetries specified
      ],
      maxRetries: 5, // Agent-level default
    });

    const requestContext = new RequestContext();
    const modelList = await agent.getModelList(requestContext);

    expect(modelList).not.toBeNull();
    expect(modelList?.length).toBe(1);
    // Should inherit agent-level maxRetries (5)
    expect(modelList?.[0]?.maxRetries).toBe(5);
  });
});
