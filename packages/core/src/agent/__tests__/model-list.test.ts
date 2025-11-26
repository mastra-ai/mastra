import { openai } from '@ai-sdk/openai-v5';
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { simulateReadableStream, MockLanguageModelV1 } from '@internal/ai-sdk-v4';
import { convertArrayToReadableStream, MockLanguageModelV2 } from 'ai-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { Agent } from '../agent';

function modelListTests(version: 'v1' | 'v2') {
  describe(
    'model list',
    {
      skip: version === 'v1',
    },
    () => {
      it('should take and return model list', async () => {
        const agent = new Agent({
          id: 'test-agent',
          name: 'test',
          instructions: 'test agent instructions',
          model: [
            {
              model: openai('gpt-4o'),
            },
            {
              model: openai('gpt-4o-mini'),
            },
            {
              model: openai('gpt-4.1'),
            },
          ],
        });

        const modelList = await agent.getModelList();
        if (!modelList) {
          expect.fail('Model list should exist');
        }
        expect(modelList.length).toBe(3);
        const model0 = modelList[0]?.model as LanguageModelV2;
        expect(model0.modelId).toBe('gpt-4o');
        const model1 = modelList[1]?.model as LanguageModelV2;
        expect(model1.modelId).toBe('gpt-4o-mini');
        const model2 = modelList[2]?.model as LanguageModelV2;
        expect(model2.modelId).toBe('gpt-4.1');
      });

      it('should reorder model list', async () => {
        const agent = new Agent({
          id: 'test-agent',
          name: 'Test Agent',
          instructions: 'test agent instructions',
          model: [
            {
              model: openai('gpt-4o'),
            },
            {
              model: openai('gpt-4o-mini'),
            },
            {
              model: openai('gpt-4.1'),
            },
          ],
        });

        const modelList = await agent.getModelList();

        const modelIds = modelList?.map(m => m.id) || [];
        const reversedModelIds = [...modelIds].reverse();

        agent.reorderModels(reversedModelIds);

        const reorderedModelList = await agent.getModelList();

        if (!reorderedModelList) {
          expect.fail('Reordered model list should exist');
        }

        expect(reorderedModelList.length).toBe(3);
        expect(reorderedModelList[0]?.id).toBe(reversedModelIds[0]);
        expect(reorderedModelList[1]?.id).toBe(reversedModelIds[1]);

        const model0 = reorderedModelList[0]?.model as LanguageModelV2;
        expect(model0.modelId).toBe('gpt-4.1');
        const model1 = reorderedModelList[1]?.model as LanguageModelV2;
        expect(model1.modelId).toBe('gpt-4o-mini');
      });

      it(`should update model list`, async () => {
        const agent = new Agent({
          id: 'test-agent',
          name: 'Test Agent',
          instructions: 'test agent instructions',
          model: [
            {
              model: openai('gpt-4o'),
            },
            {
              model: openai('gpt-4o-mini'),
            },
            {
              model: openai('gpt-4.1'),
            },
          ],
        });

        const modelList = await agent.getModelList();
        if (!modelList) {
          expect.fail('Model list should exist');
        }
        const model1Id = modelList[1]?.id || '';

        agent.updateModelInModelList({
          id: model1Id,
          model: openai('gpt-4'),
          maxRetries: 5,
        });
        const updatedModelList = await agent.getModelList();

        if (!updatedModelList) {
          expect.fail('Updated model list should exist');
        }
        expect(updatedModelList.length).toBe(3);
        const updatedModel1 = updatedModelList[1]?.model as LanguageModelV2;
        expect(updatedModel1.modelId).toBe('gpt-4');
        expect(updatedModelList[1]?.maxRetries).toBe(5);
        const updatedModel2 = updatedModelList[2]?.model as LanguageModelV2;
        expect(updatedModel2.modelId).toBe('gpt-4.1');
      });

      it('should use model list', async () => {
        let usedModelName = '';

        // Create two different models
        let premiumModel: MockLanguageModelV2;
        let standardModel: MockLanguageModelV2;

        premiumModel = new MockLanguageModelV2({
          doGenerate: async () => {
            usedModelName = 'premium';
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
              text: `Premium Title`,
              content: [
                {
                  type: 'text',
                  text: `Premium Title`,
                },
              ],
              warnings: [],
            };
          },
          doStream: async () => {
            usedModelName = 'premium';
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
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Hello' },
                { type: 'text-delta', id: '1', delta: ', ' },
                { type: 'text-delta', id: '1', delta: 'Premium Title' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
                },
              ]),
            };
          },
        });

        standardModel = new MockLanguageModelV2({
          doGenerate: async () => {
            usedModelName = 'standard';
            throw new Error('Simulated generate error');
          },
          doStream: async () => {
            usedModelName = 'standard';
            const stream = new ReadableStream({
              pull() {
                throw new Error('Simulated stream error');
              },
            });
            return { stream, rawCall: { rawPrompt: null, rawSettings: {} } };
          },
        });

        const agent = new Agent({
          id: 'update-model-agent',
          name: 'Update Model Agent',
          instructions: 'test agent',
          model: [
            {
              model: standardModel,
            },
            {
              model: premiumModel,
            },
          ],
        });

        const streamResult = await agent.stream('Test message');

        const fullText = await streamResult.text;
        expect(fullText).toBe('Hello, Premium Title');

        expect(usedModelName).toBe('premium');
      });

      it('should use maxRetries in model list', async () => {
        let usedModelName = '';

        // Create two different models
        let premiumModel: MockLanguageModelV2;
        let standardModel: MockLanguageModelV2;

        const streamErrorFn = vi.fn(() => {
          throw new Error('Simulated stream error');
        });

        premiumModel = new MockLanguageModelV2({
          doGenerate: async () => {
            usedModelName = 'premium';
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
              text: `Premium Title`,
              content: [
                {
                  type: 'text',
                  text: `Premium Title`,
                },
              ],
              warnings: [],
            };
          },
          doStream: async () => {
            usedModelName = 'premium';
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
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Hello' },
                { type: 'text-delta', id: '1', delta: ', ' },
                { type: 'text-delta', id: '1', delta: 'Premium Title' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
                },
              ]),
            };
          },
        });

        standardModel = new MockLanguageModelV2({
          doGenerate: async () => {
            usedModelName = 'standard';
            throw new Error('Simulated generate error');
          },
          doStream: async () => {
            usedModelName = 'standard';
            const stream = new ReadableStream({
              pull() {
                streamErrorFn();
              },
            });
            return { stream, rawCall: { rawPrompt: null, rawSettings: {} } };
          },
        });

        const agent = new Agent({
          id: 'update-model-agent',
          name: 'Update Model Agent',
          instructions: 'test agent',
          model: [
            {
              model: standardModel,
              maxRetries: 3,
            },
            {
              model: premiumModel,
            },
          ],
        });

        const streamResult = await agent.stream('Test message');

        const fullText = await streamResult.text;
        expect(fullText).toBe('Hello, Premium Title');
        expect(streamErrorFn).toHaveBeenCalledTimes(4);
        expect(usedModelName).toBe('premium');
      });

      it('should default to agent maxRetries when not provided in model list', async () => {
        let usedModelName = '';

        // Create two different models
        let premiumModel: MockLanguageModelV2;
        let standardModel: MockLanguageModelV2;
        let standardModel2: MockLanguageModelV2;

        const streamErrorFn = vi.fn(() => {
          throw new Error('Simulated stream error');
        });
        const streamErrorFn2 = vi.fn(() => {
          throw new Error('Simulated stream error');
        });

        premiumModel = new MockLanguageModelV2({
          doGenerate: async () => {
            usedModelName = 'premium';
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
              text: `Premium Title`,
              content: [
                {
                  type: 'text',
                  text: `Premium Title`,
                },
              ],
              warnings: [],
            };
          },
          doStream: async () => {
            usedModelName = 'premium';
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
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Hello' },
                { type: 'text-delta', id: '1', delta: ', ' },
                { type: 'text-delta', id: '1', delta: 'Premium Title' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
                },
              ]),
            };
          },
        });

        standardModel = new MockLanguageModelV2({
          doGenerate: async () => {
            usedModelName = 'standard';
            throw new Error('Simulated generate error');
          },
          doStream: async () => {
            usedModelName = 'standard';
            const stream = new ReadableStream({
              pull() {
                streamErrorFn();
              },
            });
            return { stream, rawCall: { rawPrompt: null, rawSettings: {} } };
          },
        });

        standardModel2 = new MockLanguageModelV2({
          doGenerate: async () => {
            usedModelName = 'standard2';
            throw new Error('Simulated generate error');
          },
          doStream: async () => {
            usedModelName = 'standard';
            const stream = new ReadableStream({
              pull() {
                streamErrorFn2();
              },
            });
            return { stream, rawCall: { rawPrompt: null, rawSettings: {} } };
          },
        });

        const agent = new Agent({
          id: 'update-model-agent',
          name: 'Update Model Agent',
          instructions: 'test agent',
          model: [
            {
              model: standardModel,
              maxRetries: 3,
            },
            {
              model: standardModel2,
            },
            {
              model: premiumModel,
            },
          ],
          maxRetries: 2,
        });

        const streamResult = await agent.stream('Test message');

        const fullText = await streamResult.text;
        expect(fullText).toBe('Hello, Premium Title');
        expect(streamErrorFn).toHaveBeenCalledTimes(4);
        expect(streamErrorFn2).toHaveBeenCalledTimes(3);
        expect(usedModelName).toBe('premium');
      });

      it('should skip models with enabled:false in model list', async () => {
        let usedModelName = '';

        // Create two different models
        let premiumModel: MockLanguageModelV2;
        let standardModel: MockLanguageModelV2;
        let standardModel2: MockLanguageModelV2;

        const streamErrorFn = vi.fn(() => {
          throw new Error('Simulated stream error');
        });
        const streamErrorFn2 = vi.fn(() => {
          throw new Error('Simulated stream error');
        });

        premiumModel = new MockLanguageModelV2({
          doGenerate: async () => {
            usedModelName = 'premium';
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
              text: `Premium Title`,
              content: [
                {
                  type: 'text',
                  text: `Premium Title`,
                },
              ],
              warnings: [],
            };
          },
          doStream: async () => {
            usedModelName = 'premium';
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
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Hello' },
                { type: 'text-delta', id: '1', delta: ', ' },
                { type: 'text-delta', id: '1', delta: 'Premium Title' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
                },
              ]),
            };
          },
        });

        standardModel = new MockLanguageModelV2({
          doGenerate: async () => {
            usedModelName = 'standard';
            throw new Error('Simulated generate error');
          },
          doStream: async () => {
            usedModelName = 'standard';
            const stream = new ReadableStream({
              pull() {
                streamErrorFn();
              },
            });
            return { stream, rawCall: { rawPrompt: null, rawSettings: {} } };
          },
        });

        standardModel2 = new MockLanguageModelV2({
          doGenerate: async () => {
            usedModelName = 'standard2';
            throw new Error('Simulated generate error');
          },
          doStream: async () => {
            usedModelName = 'standard';
            const stream = new ReadableStream({
              pull() {
                streamErrorFn2();
              },
            });
            return { stream, rawCall: { rawPrompt: null, rawSettings: {} } };
          },
        });

        const agent = new Agent({
          id: 'update-model-agent',
          name: 'Test Model List Agent',
          instructions: 'test agent',
          model: [
            {
              model: standardModel,
              maxRetries: 3,
            },
            {
              model: standardModel2,
              enabled: false,
            },
            {
              model: premiumModel,
            },
          ],
          maxRetries: 2,
        });

        const streamResult = await agent.stream('Test message');

        const fullText = await streamResult.text;
        expect(fullText).toBe('Hello, Premium Title');
        expect(streamErrorFn).toHaveBeenCalledTimes(4);
        expect(streamErrorFn2).toHaveBeenCalledTimes(0);
        expect(usedModelName).toBe('premium');
      });

      it('should skip rest of the models in the list after getting a successful stream', async () => {
        let usedModelName = '';

        // Create two different models
        let premiumModel: MockLanguageModelV2;
        let premiumModel2: MockLanguageModelV2;
        let standardModel: MockLanguageModelV2;

        const streamErrorFn = vi.fn(() => {
          throw new Error('Simulated stream error');
        });

        const premiumModel2Fn = vi.fn(() => {
          console.log('premium model 2 called');
        });

        premiumModel = new MockLanguageModelV2({
          doGenerate: async () => {
            usedModelName = 'premium';
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
              text: `Hello, Premium Title`,
              content: [
                {
                  type: 'text',
                  text: `Hello, Premium Title`,
                },
              ],
              warnings: [],
            };
          },
          doStream: async () => {
            usedModelName = 'premium';
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
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Hello' },
                { type: 'text-delta', id: '1', delta: ', ' },
                { type: 'text-delta', id: '1', delta: 'Premium Title' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
                },
              ]),
            };
          },
        });

        premiumModel2 = new MockLanguageModelV2({
          doGenerate: async () => {
            usedModelName = 'premium';
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
              text: `Second Premium Title`,
              content: [
                {
                  type: 'text',
                  text: `Second Premium Title`,
                },
              ],
              warnings: [],
            };
          },
          doStream: async () => {
            usedModelName = 'premium2';
            premiumModel2Fn();
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
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Hello' },
                { type: 'text-delta', id: '1', delta: ', Second' },
                { type: 'text-delta', id: '1', delta: 'Premium Title' },
                { type: 'text-end', id: '1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
                },
              ]),
            };
          },
        });

        standardModel = new MockLanguageModelV2({
          doGenerate: async () => {
            usedModelName = 'standard';
            throw new Error('Simulated generate error');
          },
          doStream: async () => {
            usedModelName = 'standard';
            const stream = new ReadableStream({
              pull() {
                streamErrorFn();
              },
            });
            return { stream, rawCall: { rawPrompt: null, rawSettings: {} } };
          },
        });

        const agent = new Agent({
          id: 'test-model-list-agent',
          name: 'Update Model Agent',
          instructions: 'test agent',
          model: [
            {
              model: standardModel,
              maxRetries: 3,
            },
            {
              model: premiumModel,
            },
            {
              model: premiumModel2,
            },
          ],
          maxRetries: 2,
        });

        const streamResult = await agent.stream('Test message');

        const fullText = await streamResult.text;
        expect(fullText).toBe('Hello, Premium Title');
        expect(streamErrorFn).toHaveBeenCalledTimes(4);
        expect(premiumModel2Fn).toHaveBeenCalledTimes(0);
        expect(usedModelName).toBe('premium');
      });

      it('should throw an error if a v1 model is provided in an array of models', async () => {
        const v1Model = new MockLanguageModelV1({
          doStream: async () => ({
            stream: simulateReadableStream({
              initialDelayInMs: 0,
              chunkDelayInMs: 1,
              chunks: [
                { type: 'text-delta', textDelta: 'Hello! ' },
                { type: 'text-delta', textDelta: 'I am ' },
                { type: 'text-delta', textDelta: 'a helpful assistant.' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { promptTokens: 10, completionTokens: 20 },
                },
              ],
            }),
            rawCall: { rawPrompt: [], rawSettings: {} },
          }),
        });
        const v2Model = new MockLanguageModelV2({
          doGenerate: async () => {
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'stop',
              usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
              text: `Hello, Premium Title`,
              content: [
                {
                  type: 'text',
                  text: `Hello, Premium Title`,
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
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                },
                { type: 'text-start', id: '1' },
                { type: 'text-delta', id: '1', delta: 'Hello' },
                { type: 'text-delta', id: '1', delta: ', ' },
                { type: 'text-delta', id: '1', delta: 'Premium Title' },
                { type: 'text-end', id: '1' },
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
          id: 'test-model-list-agent',
          name: 'Update Model Agent',
          instructions: 'test agent',
          model: [{ model: v2Model }, { model: v1Model }],
        });

        try {
          await agent.getLLM();
          expect.fail('Expected getLLM() to throw an error');
        } catch (err) {
          expect(err.message).toContain('Only v2 models are allowed when an array of models is provided');
        }

        try {
          await agent.generate('Hello');
          expect.fail('Expected getLLM() to throw an error');
        } catch (err) {
          expect(err.message).toContain('Only v2 models are allowed when an array of models is provided');
        }

        try {
          await agent.stream('Hello');
          expect.fail('Expected getLLM() to throw an error');
        } catch (err) {
          expect(err.message).toContain('Only v2 models are allowed when an array of models is provided');
        }

        try {
          await agent.generate('Hello');
          expect.fail('Expected getLLM() to throw an error');
        } catch (err) {
          expect(err.message).toContain('Only v2 models are allowed when an array of models is provided');
        }

        try {
          await agent.stream('Hello');
          expect.fail('Expected getLLM() to throw an error');
        } catch (err) {
          expect(err.message).toContain('Only v2 models are allowed when an array of models is provided');
        }
      });
    },
  );
}

modelListTests('v1');
modelListTests('v2');

describe('model fallback - mid-stream errors', () => {
  it('should fallback to next model when first model returns a mid-stream error (like quota exceeded)', async () => {
    /**
     * This test simulates the scenario from GitHub issue #9306:
     * When a model hits a quota error mid-stream (after the connection is established),
     * the fallback to the next model should still trigger.
     *
     * The error comes as a stream chunk (type: 'error') after some data has been streamed,
     * which simulates what happens when a provider like Anthropic returns an insufficient_quota
     * error mid-stream.
     */
    let usedModelName = '';

    // Model that returns an error chunk mid-stream (simulating quota exceeded)
    const quotaExceededModel = new MockLanguageModelV2({
      doGenerate: async () => {
        throw new Error('Quota exceeded');
      },
      doStream: async () => {
        // Create a custom ReadableStream that emits chunks including an error
        const stream = new ReadableStream({
          async start(controller) {
            // First, emit some normal chunks (simulating connection established)
            controller.enqueue({
              type: 'stream-start',
              warnings: [],
            });
            controller.enqueue({
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'quota-exceeded-model',
              timestamp: new Date(0),
            });
            // Then emit an error chunk (simulating quota exceeded mid-stream)
            controller.enqueue({
              type: 'error',
              error: {
                type: 'insufficient_quota',
                code: 'insufficient_quota',
                message: 'You exceeded your current quota, please check your plan and billing details.',
              },
            });
            controller.close();
          },
        });

        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream,
        };
      },
    });

    // Fallback model that works correctly
    const fallbackModel = new MockLanguageModelV2({
      doGenerate: async () => {
        usedModelName = 'fallback';
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
          text: `Fallback response`,
          content: [{ type: 'text', text: `Fallback response` }],
          warnings: [],
        };
      },
      doStream: async () => {
        usedModelName = 'fallback';
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            {
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'fallback-model',
              timestamp: new Date(0),
            },
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: 'Fallback response' },
            { type: 'text-end', id: '1' },
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
      id: 'test-mid-stream-fallback',
      name: 'Test Mid-Stream Fallback',
      instructions: 'test agent',
      model: [
        {
          model: quotaExceededModel,
          maxRetries: 0, // No retries, should immediately fallback
        },
        {
          model: fallbackModel,
        },
      ],
    });

    const streamResult = await agent.stream('Test message');
    const fullText = await streamResult.text;

    // This assertion currently fails because the fallback doesn't trigger
    // when the error comes as a stream chunk
    expect(usedModelName).toBe('fallback');
    expect(fullText).toBe('Fallback response');
  });

  it('should fallback when model returns rate limit error mid-stream after partial content', async () => {
    /**
     * Similar to quota errors, rate limit errors that come mid-stream
     * should also trigger the fallback mechanism. This test verifies that
     * even after partial content is streamed, an error triggers fallback.
     */
    let usedModelName = '';

    const rateLimitedModel = new MockLanguageModelV2({
      doGenerate: async () => {
        throw new Error('Rate limited');
      },
      doStream: async () => {
        // Create a custom ReadableStream that emits partial content then an error
        const stream = new ReadableStream({
          async start(controller) {
            controller.enqueue({
              type: 'stream-start',
              warnings: [],
            });
            controller.enqueue({
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'rate-limited-model',
              timestamp: new Date(0),
            });
            // Emit some partial content first
            controller.enqueue({ type: 'text-start', id: '1' });
            controller.enqueue({ type: 'text-delta', id: '1', delta: 'Partial...' });
            // Then emit an error chunk
            controller.enqueue({
              type: 'error',
              error: new Error('Rate limit exceeded. Please retry after 60 seconds.'),
            });
            controller.close();
          },
        });

        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream,
        };
      },
    });

    const fallbackModel = new MockLanguageModelV2({
      doGenerate: async () => {
        usedModelName = 'fallback';
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
          text: `Complete fallback response`,
          content: [{ type: 'text', text: `Complete fallback response` }],
          warnings: [],
        };
      },
      doStream: async () => {
        usedModelName = 'fallback';
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            {
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'fallback-model',
              timestamp: new Date(0),
            },
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: 'Complete fallback response' },
            { type: 'text-end', id: '1' },
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
      id: 'test-rate-limit-fallback',
      name: 'Test Rate Limit Fallback',
      instructions: 'test agent',
      model: [
        {
          model: rateLimitedModel,
          maxRetries: 0,
        },
        {
          model: fallbackModel,
        },
      ],
    });

    const streamResult = await agent.stream('Test message');
    const fullText = await streamResult.text;

    expect(usedModelName).toBe('fallback');
    // Note: Partial content from the first model is preserved before the fallback kicks in
    // This is expected behavior - the fallback happens after the error, not discarding prior content
    expect(fullText).toContain('Complete fallback response');
    expect(fullText).toContain('Partial...');
  });

  it('should fallback to next model when first model returns a mid-stream error during generate()', async () => {
    /**
     * This test verifies that the fallback mechanism also works with the generate() method,
     * not just stream(). When a quota error occurs mid-stream, the fallback should trigger.
     */
    let usedModelName = '';

    // Model that returns an error chunk mid-stream (simulating quota exceeded)
    const quotaExceededModel = new MockLanguageModelV2({
      doGenerate: async () => {
        // Simulate quota error during generate
        throw {
          type: 'insufficient_quota',
          code: 'insufficient_quota',
          message: 'You exceeded your current quota, please check your plan and billing details.',
        };
      },
      doStream: async () => {
        // Create a custom ReadableStream that emits chunks including an error
        const stream = new ReadableStream({
          async start(controller) {
            controller.enqueue({
              type: 'stream-start',
              warnings: [],
            });
            controller.enqueue({
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'quota-exceeded-model',
              timestamp: new Date(0),
            });
            // Then emit an error chunk (simulating quota exceeded mid-stream)
            controller.enqueue({
              type: 'error',
              error: {
                type: 'insufficient_quota',
                code: 'insufficient_quota',
                message: 'You exceeded your current quota, please check your plan and billing details.',
              },
            });
            controller.close();
          },
        });

        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream,
        };
      },
    });

    // Fallback model that works correctly
    const fallbackModel = new MockLanguageModelV2({
      doGenerate: async () => {
        usedModelName = 'fallback';
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
          text: `Fallback generate response`,
          content: [{ type: 'text', text: `Fallback generate response` }],
          warnings: [],
        };
      },
      doStream: async () => {
        usedModelName = 'fallback';
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            {
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'fallback-model',
              timestamp: new Date(0),
            },
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: 'Fallback generate response' },
            { type: 'text-end', id: '1' },
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
      id: 'test-generate-mid-stream-fallback',
      name: 'Test Generate Mid-Stream Fallback',
      instructions: 'test agent',
      model: [
        {
          model: quotaExceededModel,
          maxRetries: 0, // No retries, should immediately fallback
        },
        {
          model: fallbackModel,
        },
      ],
    });

    const result = await agent.generate('Test message');

    expect(usedModelName).toBe('fallback');
    expect(result.text).toBe('Fallback generate response');
  });
});
