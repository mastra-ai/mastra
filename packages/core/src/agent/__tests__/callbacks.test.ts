import { simulateReadableStream } from '@internal/ai-sdk-v4';
import { MockLanguageModelV1 } from '@internal/ai-sdk-v4/test';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, beforeEach } from 'vitest';
import { Agent } from '../agent';

function callbackTests(version: 'v1' | 'v2') {
  let dummyModel: MockLanguageModelV1 | MockLanguageModelV2;

  beforeEach(() => {
    if (version === 'v1') {
      dummyModel = new MockLanguageModelV1({
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { promptTokens: 10, completionTokens: 20 },
          text: 'Dummy response',
        }),
        doStream: async () => ({
          stream: simulateReadableStream({
            chunks: [{ type: 'text-delta', textDelta: 'Dummy response' }],
          }),
          rawCall: { rawPrompt: null, rawSettings: {} },
        }),
      });
    } else {
      dummyModel = new MockLanguageModelV2({
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          content: [{ type: 'text', text: 'Dummy response' }],
          warnings: [],
        }),
        doStream: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Dummy response' },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
          ]),
        }),
      });
    }
  });

  describe('defaultOptions onFinish callback bug', () => {
    it(`${version} - should call onFinish from defaultOptions when no options are passed to stream`, async () => {
      let onFinishCalled = false;
      let finishData: any = null;

      const agent = new Agent({
        id: 'test-default-onfinish',
        name: 'Test Default onFinish',
        model: dummyModel,
        instructions: 'You are a helpful assistant.',
        ...(version === 'v1'
          ? {
              defaultStreamOptionsLegacy: {
                onFinish: data => {
                  onFinishCalled = true;
                  finishData = data;
                },
              },
            }
          : {
              defaultOptions: {
                onFinish: data => {
                  onFinishCalled = true;
                  finishData = data;
                },
              },
            }),
      });

      // Call stream without passing any options - should use defaultOptions
      const result = version === 'v1' ? await agent.streamLegacy('How are you?') : await agent.stream('How are you?');

      // Consume the stream to trigger onFinish
      if (version === 'v1') {
        let fullText = '';
        for await (const chunk of result.textStream) {
          fullText += chunk;
        }
        expect(fullText).toBe('Dummy response');
      } else {
        await result.consumeStream();
      }

      expect(onFinishCalled).toBe(true);
      expect(finishData).toBeDefined();
    });

    it(`${version} - should call onFinish from defaultOptions when empty options are passed to stream`, async () => {
      let onFinishCalled = false;
      let finishData: any = null;

      const agent = new Agent({
        id: 'test-default-onfinish-empty',
        name: 'Test Default onFinish Empty',
        model: dummyModel,
        instructions: 'You are a helpful assistant.',
        ...(version === 'v1'
          ? {
              defaultStreamOptionsLegacy: {
                onFinish: data => {
                  onFinishCalled = true;
                  finishData = data;
                },
              },
            }
          : {
              defaultOptions: {
                onFinish: data => {
                  onFinishCalled = true;
                  finishData = data;
                },
              },
            }),
      });

      // Call stream with empty options - should still use defaultOptions
      const result =
        version === 'v1' ? await agent.streamLegacy('How are you?', {}) : await agent.stream('How are you?', {});

      // Consume the stream to trigger onFinish
      if (version === 'v1') {
        let fullText = '';
        for await (const chunk of result.textStream) {
          fullText += chunk;
        }
        expect(fullText).toBe('Dummy response');
      } else {
        await result.consumeStream();
      }

      expect(onFinishCalled).toBe(true);
      expect(finishData).toBeDefined();
    });

    it(`${version} - should prioritize passed onFinish over defaultOptions onFinish`, async () => {
      let defaultOnFinishCalled = false;
      let passedOnFinishCalled = false;
      let finishData: any = null;

      const agent = new Agent({
        id: 'test-override-onfinish',
        name: 'Test Override onFinish',
        model: dummyModel,
        instructions: 'You are a helpful assistant.',
        ...(version === 'v1'
          ? {
              defaultStreamOptionsLegacy: {
                onFinish: () => {
                  defaultOnFinishCalled = true;
                },
              },
            }
          : {
              defaultOptions: {
                onFinish: () => {
                  defaultOnFinishCalled = true;
                },
              },
            }),
      });

      // Call stream with explicit onFinish - should override defaultOptions
      const result =
        version === 'v1'
          ? await agent.streamLegacy('How are you?', {
              onFinish: data => {
                passedOnFinishCalled = true;
                finishData = data;
              },
            })
          : await agent.stream('How are you?', {
              onFinish: data => {
                passedOnFinishCalled = true;
                finishData = data;
              },
            });

      // Consume the stream to trigger onFinish
      if (version === 'v1') {
        let fullText = '';
        for await (const chunk of result.textStream) {
          fullText += chunk;
        }
        expect(fullText).toBe('Dummy response');
      } else {
        await result.consumeStream();
      }

      expect(defaultOnFinishCalled).toBe(false);
      expect(passedOnFinishCalled).toBe(true);
      expect(finishData).toBeDefined();
    });
  });

  describe(`${version} - stream onFinish usage bug`, () => {
    it(`should include usage property in onFinish callback for ${version}`, async () => {
      let onFinishCalled = false;
      let finishData: any = null;

      const agent = new Agent({
        id: 'test-usage-onfinish',
        name: 'Test Usage onFinish',
        model: dummyModel,
        instructions: 'You are a helpful assistant.',
      });

      let result: any;

      const onFinish = (data: any) => {
        onFinishCalled = true;
        finishData = data;
      };

      if (version === 'v1') {
        result = await agent.streamLegacy('How are you?', {
          onFinish,
        });
      } else {
        result = await agent.stream('How are you?', {
          onFinish,
        });
      }

      // Consume the stream to trigger onFinish
      await result.consumeStream();

      expect(onFinishCalled).toBe(true);
      expect(finishData).toBeDefined();
      expect(finishData).toHaveProperty('usage');
      expect(finishData.usage).toBeDefined();
      expect(typeof finishData.usage).toBe('object');

      // Check for expected usage properties
      if (finishData.usage) {
        expect(finishData.usage).toHaveProperty('totalTokens');
        expect(typeof finishData.usage.totalTokens).toBe('number');
      }
    });
  });

}

callbackTests('v1');
callbackTests('v2');
