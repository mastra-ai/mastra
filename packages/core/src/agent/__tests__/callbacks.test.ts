// Legacy (v1 model, streamLegacy) callback behaviour. The v2 `stream()` cases run on
// every engine in the aimock scenarios callbacks-default-options and usage-reporting.
import { simulateReadableStream } from '@internal/ai-sdk-v4';
import { MockLanguageModelV1 } from '@internal/ai-sdk-v4/test';
import { describe, expect, it, beforeEach } from 'vitest';
import { Agent } from '../agent';

describe('v1 - legacy stream callbacks', () => {
  let dummyModel: MockLanguageModelV1;

  beforeEach(() => {
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
  });

  async function readText(result: { textStream: AsyncIterable<string> }) {
    let fullText = '';
    for await (const chunk of result.textStream) {
      fullText += chunk;
    }
    return fullText;
  }

  describe('defaultStreamOptionsLegacy onFinish callback bug', () => {
    it('v1 - should call onFinish from defaultStreamOptionsLegacy when no options are passed to streamLegacy', async () => {
      let finishData: any = null;

      const agent = new Agent({
        id: 'test-default-onfinish',
        name: 'Test Default onFinish',
        model: dummyModel,
        instructions: 'You are a helpful assistant.',
        defaultStreamOptionsLegacy: {
          onFinish: data => {
            finishData = data;
          },
        },
      });

      const result = await agent.streamLegacy('How are you?');

      expect(await readText(result)).toBe('Dummy response');
      expect(finishData?.text).toBe('Dummy response');
    });

    it('v1 - should call onFinish from defaultStreamOptionsLegacy when empty options are passed to streamLegacy', async () => {
      let finishData: any = null;

      const agent = new Agent({
        id: 'test-default-onfinish-empty',
        name: 'Test Default onFinish Empty',
        model: dummyModel,
        instructions: 'You are a helpful assistant.',
        defaultStreamOptionsLegacy: {
          onFinish: data => {
            finishData = data;
          },
        },
      });

      const result = await agent.streamLegacy('How are you?', {});

      expect(await readText(result)).toBe('Dummy response');
      expect(finishData?.text).toBe('Dummy response');
    });

    it('v1 - should prioritize passed onFinish over defaultStreamOptionsLegacy onFinish', async () => {
      let defaultOnFinishCalled = false;
      let finishData: any = null;

      const agent = new Agent({
        id: 'test-override-onfinish',
        name: 'Test Override onFinish',
        model: dummyModel,
        instructions: 'You are a helpful assistant.',
        defaultStreamOptionsLegacy: {
          onFinish: () => {
            defaultOnFinishCalled = true;
          },
        },
      });

      const result = await agent.streamLegacy('How are you?', {
        onFinish: data => {
          finishData = data;
        },
      });

      expect(await readText(result)).toBe('Dummy response');
      expect(defaultOnFinishCalled).toBe(false);
      expect(finishData?.text).toBe('Dummy response');
    });
  });

  describe('v1 - stream onFinish usage bug', () => {
    it('should include usage property in onFinish callback for v1', async () => {
      let finishData: any = null;

      const agent = new Agent({
        id: 'test-usage-onfinish',
        name: 'Test Usage onFinish',
        model: dummyModel,
        instructions: 'You are a helpful assistant.',
      });

      const result = await agent.streamLegacy('How are you?', {
        onFinish: (data: any) => {
          finishData = data;
        },
      });

      await result.consumeStream();

      expect(typeof finishData?.usage?.totalTokens).toBe('number');
    });
  });
});
