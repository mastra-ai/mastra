import { openai } from '@ai-sdk/openai-v5';
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { simulateReadableStream } from '@internal/ai-sdk-v4';
import { MockLanguageModelV1 } from '@internal/ai-sdk-v4/test';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
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

      it('should keep unlisted models at the end when reordering with a partial list', async () => {
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

        // Reorder with only 2 of 3 models — gpt-4.1 first, then gpt-4o
        // gpt-4o-mini is NOT in the list and should stay at the end
        agent.reorderModels([modelList[2]!.id, modelList[0]!.id]);

        const reorderedModelList = await agent.getModelList();
        if (!reorderedModelList) {
          expect.fail('Reordered model list should exist');
        }

        expect(reorderedModelList.length).toBe(3);
        const model0 = reorderedModelList[0]?.model as LanguageModelV2;
        const model1 = reorderedModelList[1]?.model as LanguageModelV2;
        const model2 = reorderedModelList[2]?.model as LanguageModelV2;
        expect(model0.modelId).toBe('gpt-4.1');
        expect(model1.modelId).toBe('gpt-4o');
        expect(model2.modelId).toBe('gpt-4o-mini');
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
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: 'Hello' },
                { type: 'text-delta', id: 'text-1', delta: ', ' },
                { type: 'text-delta', id: 'text-1', delta: 'Premium Title' },
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
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: 'Hello' },
                { type: 'text-delta', id: 'text-1', delta: ', ' },
                { type: 'text-delta', id: 'text-1', delta: 'Premium Title' },
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
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: 'Hello' },
                { type: 'text-delta', id: 'text-1', delta: ', ' },
                { type: 'text-delta', id: 'text-1', delta: 'Premium Title' },
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
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: 'Hello' },
                { type: 'text-delta', id: 'text-1', delta: ', ' },
                { type: 'text-delta', id: 'text-1', delta: 'Premium Title' },
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
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: 'Hello' },
                { type: 'text-delta', id: 'text-1', delta: ', ' },
                { type: 'text-delta', id: 'text-1', delta: 'Premium Title' },
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
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: 'Hello' },
                { type: 'text-delta', id: 'text-1', delta: ', Second' },
                { type: 'text-delta', id: 'text-1', delta: 'Premium Title' },
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
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: 'Hello' },
                { type: 'text-delta', id: 'text-1', delta: ', ' },
                { type: 'text-delta', id: 'text-1', delta: 'Premium Title' },
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
          id: 'test-model-list-agent',
          name: 'Update Model Agent',
          instructions: 'test agent',
          model: [{ model: v2Model }, { model: v1Model }],
        });

        try {
          await agent.getLLM();
          expect.fail('Expected getLLM() to throw an error');
        } catch (err) {
          expect(err.message).toContain('Only v2/v3 models are allowed when an array of models is provided');
        }

        try {
          await agent.generate('Hello');
          expect.fail('Expected getLLM() to throw an error');
        } catch (err) {
          expect(err.message).toContain('Only v2/v3 models are allowed when an array of models is provided');
        }

        try {
          await agent.stream('Hello');
          expect.fail('Expected getLLM() to throw an error');
        } catch (err) {
          expect(err.message).toContain('Only v2/v3 models are allowed when an array of models is provided');
        }

        try {
          await agent.generate('Hello');
          expect.fail('Expected getLLM() to throw an error');
        } catch (err) {
          expect(err.message).toContain('Only v2/v3 models are allowed when an array of models is provided');
        }

        try {
          await agent.stream('Hello');
          expect.fail('Expected getLLM() to throw an error');
        } catch (err) {
          expect(err.message).toContain('Only v2/v3 models are allowed when an array of models is provided');
        }
      });
    },
  );
}

modelListTests('v1');
modelListTests('v2');
