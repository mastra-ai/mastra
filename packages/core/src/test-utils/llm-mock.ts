import type { LanguageModelV2CallOptions, LanguageModelV2StreamPart } from '@ai-sdk/provider';
import type { FinishReason, LanguageModelUsage, CallWarning } from 'ai';
import { simulateReadableStream } from 'ai';
import { MockLanguageModelV2 } from 'ai/test';
import { MastraLLM } from '../llm/model/model';

// Helper type for the 'content' array in doGenerate response, as LanguageModelV2Content is not directly exported
type MockTextContentPart = { type: 'text'; text: string };

export function createMockModel({
  objectGenerationMode,
  mockText,
  spyGenerate,
  spyStream,
}: {
  objectGenerationMode?: 'json';
  mockText: string | Record<string, any>;
  spyGenerate?: (props: LanguageModelV2CallOptions) => void;
  spyStream?: (props: LanguageModelV2CallOptions) => void;
}) {
  const mockModel = new MockLanguageModelV2({
    doGenerate: async (props: LanguageModelV2CallOptions) => {
      if (spyGenerate) {
        spyGenerate(props);
      }

      if (objectGenerationMode === 'json') {
        return {
          finishReason: 'stop' as FinishReason,
          usage: {
            promptTokens: 10,
            completionTokens: 20,
            inputTokens: 10,
            outputTokens: 20,
            totalTokens: 30,
          } as LanguageModelUsage,
          content: [{ type: 'text', text: JSON.stringify(mockText) }] as MockTextContentPart[],
          warnings: [] as CallWarning[],
        };
      }

      return {
        finishReason: 'stop' as FinishReason,
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          inputTokens: 10,
          outputTokens: 20,
          totalTokens: 30,
        } as LanguageModelUsage,
        content: [
          { type: 'text', text: typeof mockText === 'string' ? mockText : JSON.stringify(mockText) },
        ] as MockTextContentPart[],
        warnings: [] as CallWarning[],
      };
    },
    doStream: async (props: LanguageModelV2CallOptions) => {
      if (spyStream) {
        spyStream(props);
      }

      const text = typeof mockText === 'string' ? mockText : JSON.stringify(mockText);
      const textId = 'text-1';

      // Create proper streaming events for AI SDK v5
      const streamParts: LanguageModelV2StreamPart[] = [
        // Start the text block
        {
          type: 'text-start',
          id: textId,
        },
        // Split text into words and create delta events
        ...text.split(' ').map(word => ({
          type: 'text-delta' as const,
          id: textId,
          delta: word + ' ',
        })),
        // End the text block
        {
          type: 'text-end',
          id: textId,
        },
      ];

      const finishChunk: LanguageModelV2StreamPart = {
        type: 'finish',
        finishReason: 'stop' as FinishReason,
        usage: {
          completionTokens: 10,
          promptTokens: 3,
          inputTokens: 3,
          outputTokens: 10,
          totalTokens: 13,
        } as LanguageModelUsage,
      };

      return {
        stream: simulateReadableStream({
          chunks: [...streamParts, finishChunk] as LanguageModelV2StreamPart[], // Type the chunks array
        }),
        request: {}, // Added empty request object
        response: {}, // Added empty response object
      };
    },
  });

  return mockModel;
}

export class MockProvider extends MastraLLM {
  constructor({
    spyGenerate,
    spyStream,
    objectGenerationMode,
    mockText = 'Hello, world!',
  }: {
    spyGenerate?: (props: LanguageModelV2CallOptions) => void;
    spyStream?: (props: LanguageModelV2CallOptions) => void;
    objectGenerationMode?: 'json';
    mockText?: string | Record<string, any>;
  }) {
    const mockModel = new MockLanguageModelV2({
      doGenerate: async (props: LanguageModelV2CallOptions) => {
        if (spyGenerate) {
          spyGenerate(props);
        }

        if (objectGenerationMode === 'json') {
          return {
            finishReason: 'stop' as FinishReason,
            usage: {
              promptTokens: 10,
              completionTokens: 20,
              inputTokens: 10,
              outputTokens: 20,
              totalTokens: 30,
            } as LanguageModelUsage,
            content: [{ type: 'text', text: JSON.stringify(mockText) }] as MockTextContentPart[],
            warnings: [] as CallWarning[],
          };
        }

        return {
          finishReason: 'stop' as FinishReason,
          usage: {
            promptTokens: 10,
            completionTokens: 20,
            inputTokens: 10,
            outputTokens: 20,
            totalTokens: 30,
          } as LanguageModelUsage,
          content: [
            { type: 'text', text: typeof mockText === 'string' ? mockText : JSON.stringify(mockText) },
          ] as MockTextContentPart[],
          warnings: [] as CallWarning[],
        };
      },
      doStream: async (props: LanguageModelV2CallOptions) => {
        if (spyStream) {
          spyStream(props);
        }

        const text = typeof mockText === 'string' ? mockText : JSON.stringify(mockText);
        const textId = 'text-1';

        // Create proper streaming events for AI SDK v5
        const streamParts: LanguageModelV2StreamPart[] = [
          // Start the text block
          {
            type: 'text-start',
            id: textId,
          },
          // Split text into words and create delta events
          ...text.split(' ').map(word => ({
            type: 'text-delta' as const,
            id: textId,
            delta: word + ' ',
          })),
          // End the text block
          {
            type: 'text-end',
            id: textId,
          },
        ];

        const finishChunk: LanguageModelV2StreamPart = {
          type: 'finish',
          finishReason: 'stop' as FinishReason,
          usage: {
            completionTokens: 10,
            promptTokens: 3,
            inputTokens: 3,
            outputTokens: 10,
            totalTokens: 13,
          } as LanguageModelUsage,
        };

        return {
          stream: simulateReadableStream<LanguageModelV2StreamPart>({
            chunks: [...streamParts, finishChunk] as LanguageModelV2StreamPart[],
          }),
          request: {}, // Added empty request object
          response: {}, // Added empty response object
        };
      },
    });

    super({ model: mockModel });
  }

  // @ts-ignore
  stream(...args: any): PromiseLike<StreamReturn<any, any, any>> {
    // @ts-ignore
    const result = super.stream(...args);

    return {
      ...result,
      // @ts-ignore
      fullStream: result.fullStream,
      // @ts-ignore on await read the stream
      then: (onfulfilled, onrejected) => {
        // @ts-ignore
        return result.baseStream.pipeTo(new WritableStream()).then(onfulfilled, onrejected);
      },
    };
  }

  // @ts-ignore
  __streamObject(...args): PromiseLike<StreamObjectResult<any>> {
    // @ts-ignore
    const result = super.__streamObject(...args);

    return {
      ...result,
      // @ts-ignore on await read the stream
      then: (onfulfilled, onrejected) => {
        // @ts-ignore
        return result.baseStream.pipeTo(new WritableStream()).then(onfulfilled, onrejected);
      },
    };
  }
}
