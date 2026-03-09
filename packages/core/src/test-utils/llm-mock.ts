import { simulateReadableStream } from '@internal/ai-sdk-v4';
import { MockLanguageModelV1 } from '@internal/ai-sdk-v4/test';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';

import { MastraLLMV1 } from '../llm/model/model';
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
  version?: 'v1' | 'v2';
}) {
  const text = typeof mockText === 'string' ? mockText : JSON.stringify(mockText);
  const finalText = objectGenerationMode === 'json' ? JSON.stringify(mockText) : text;

  if (version === 'v1') {
    // Return a v1 model
    const mockModel = new MockLanguageModelV1({
      defaultObjectGenerationMode: objectGenerationMode,
      doGenerate: async props => {
        if (spyGenerate) {
          spyGenerate(props);
        }

        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { promptTokens: 10, completionTokens: 20 },
          text: finalText,
        };
      },
      doStream: async props => {
        if (spyStream) {
          spyStream(props);
        }

        // Split the mock text into chunks for streaming
        const chunks = finalText.split(' ').map(word => ({
          type: 'text-delta' as const,
          textDelta: word + ' ',
        }));

        return {
          stream: simulateReadableStream({
            chunks: [
              ...chunks,
              {
                type: 'finish',
                finishReason: 'stop',
                logprobs: undefined,
                usage: { completionTokens: 10, promptTokens: 3 },
              },
            ],
          }),
          rawCall: { rawPrompt: null, rawSettings: {} },
        };
      },
    });

    return mockModel;
  }

  // Return a v2 model (default)
  const mockModel = new MockLanguageModelV2({
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

export class MockProvider extends MastraLLMV1 {
  constructor({
    spyGenerate,
    spyStream,
    objectGenerationMode,
    mockText = 'Hello, world!',
  }: {
    spyGenerate?: (props: any) => void;
    spyStream?: (props: any) => void;
    objectGenerationMode?: 'json';
    mockText?: string | Record<string, any>;
  }) {
    const mockModel = new MockLanguageModelV1({
      defaultObjectGenerationMode: objectGenerationMode,
      doGenerate: async props => {
        if (spyGenerate) {
          spyGenerate(props);
        }

        if (objectGenerationMode === 'json') {
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 20 },
            text: JSON.stringify(mockText),
          };
        }

        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { promptTokens: 10, completionTokens: 20 },
          text: typeof mockText === 'string' ? mockText : JSON.stringify(mockText),
        };
      },
      doStream: async props => {
        if (spyStream) {
          spyStream(props);
        }

        const text = typeof mockText === 'string' ? mockText : JSON.stringify(mockText);
        // Split the mock text into chunks for streaming
        const chunks = text.split(' ').map(word => ({
          type: 'text-delta' as const,
          textDelta: word + ' ',
        }));

        return {
          stream: simulateReadableStream({
            chunks: [
              ...chunks,
              {
                type: 'finish',
                finishReason: 'stop',
                logprobs: undefined,
                usage: { completionTokens: 10, promptTokens: 3 },
              },
            ],
          }),
          rawCall: { rawPrompt: null, rawSettings: {} },
        };
      },
    });

    super({ model: mockModel });
  }

  // @ts-expect-error
  stream(...args: any): PromiseLike<StreamReturn<any, any, any>> {
    // @ts-expect-error
    const result = super.stream(...args);

    return {
      ...result,
      then: (onfulfilled, onrejected) => {
        // @ts-expect-error
        return result.baseStream.pipeTo(new WritableStream()).then(onfulfilled, onrejected);
      },
    };
  }

  // @ts-expect-error
  __streamObject(...args): PromiseLike<StreamObjectResult<any>> {
    // @ts-expect-error
    const result = super.__streamObject(...args);

    return {
      ...result,
      then: (onfulfilled, onrejected) => {
        // @ts-expect-error
        return result.baseStream.pipeTo(new WritableStream()).then(onfulfilled, onrejected);
      },
    };
  }
}
