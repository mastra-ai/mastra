import { simulateReadableStream } from '@internal/ai-v7';
import { convertArrayToReadableStream, MockLanguageModelV4 } from '@internal/ai-v7/test';

import { MastraLanguageModelV2Mock } from '../loop/test-utils/MastraLanguageModelV2Mock';

// Re-export for external use
export { simulateReadableStream, MastraLanguageModelV2Mock };

export function createMockModel({
  objectGenerationMode,
  mockText,
  spyGenerate,
  spyStream,
  version = 'v2',
}: {
  objectGenerationMode?: 'json';
  mockText: string | Record<string, any>;
  spyGenerate?: (props: any) => void;
  spyStream?: (props: any) => void;
  version?: 'v2';
}) {
  const text = typeof mockText === 'string' ? mockText : JSON.stringify(mockText);
  const finalText = objectGenerationMode === 'json' ? JSON.stringify(mockText) : text;

  // Return a v2 model (default)
  const mockModel = new MockLanguageModelV4({
    doGenerate: async props => {
      if (spyGenerate) {
        spyGenerate(props);
      }

      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        content: [
          {
            type: 'text',
            text: finalText,
          },
        ],
        warnings: [],
      };
    },
    doStream: async props => {
      if (spyStream) {
        spyStream(props);
      }

      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: finalText },
          { type: 'text-end', id: 'text-1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ]),
      };
    },
  });

  return mockModel;
}

type MockTextResponse = { text?: string };

/**
 * Builds a v2 mock model whose generate and stream calls both answer with the
 * text returned by `respond`. Errors thrown by `respond` surface from either call.
 */
export function mockTextModel(
  respond?: (options: any) => MockTextResponse | Promise<MockTextResponse>,
  { provider, modelId }: { provider?: string; modelId?: string } = {},
) {
  const textFor = async (options: any) => (await respond?.(options))?.text ?? '';
  const usage = { inputTokens: 10, outputTokens: 20, totalTokens: 30 };

  return new MockLanguageModelV4({
    ...(provider ? { provider } : {}),
    ...(modelId ? { modelId } : {}),
    doGenerate: async options => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage,
      content: [{ type: 'text', text: await textFor(options) }],
      warnings: [],
    }),
    doStream: async options => {
      const text = await textFor(options);
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: text },
          { type: 'text-end', id: 'text-1' },
          { type: 'finish', finishReason: 'stop', usage },
        ]),
      };
    },
  });
}
