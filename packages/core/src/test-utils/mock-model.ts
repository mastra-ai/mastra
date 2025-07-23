import { simulateReadableStream } from 'ai';
import { MockLanguageModelV1 } from 'ai/test';

export function createMockModel({
  objectGenerationMode,
  mockText,
  spyGenerate,
  spyStream,
}: {
  objectGenerationMode?: 'json';
  mockText: string | Record<string, any>;
  spyGenerate?: (props: any) => void;
  spyStream?: (props: any) => void;
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

  return mockModel;
}
