import { openai as openai_v5 } from '@ai-sdk/openai-v5';
import { openai as openai_v6 } from '@ai-sdk/openai-v6';
import { openai as openai_v7 } from '@ai-sdk/openai-v7';
import { simulateReadableStream } from '@internal/ai-sdk-v5';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import {
  convertArrayToReadableStream as convertArrayToReadableStreamV3,
  MockLanguageModelV3,
} from '@internal/ai-v6/test';
import {
  convertArrayToReadableStream as convertArrayToReadableStreamV4,
  MockLanguageModelV4,
} from '@internal/ai-v7/test';

export type MockModelSpecVersion = 'v2' | 'v3' | 'v4';

// Return type is a union of AI SDK provider return types - we use a generic return to avoid type portability issues
export function getOpenAIModel(
  version: MockModelSpecVersion,
): ReturnType<typeof openai_v5> | ReturnType<typeof openai_v6> | ReturnType<typeof openai_v7> {
  if (version === 'v2') {
    return openai_v5('gpt-4o-mini');
  }
  if (version === 'v3') {
    return openai_v6('gpt-4o-mini');
  }
  // v4
  return openai_v7('gpt-4o-mini');
}

export function getSingleDummyResponseModel(version: MockModelSpecVersion) {
  if (version === 'v2') {
    return new MockLanguageModelV2({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        content: [
          {
            type: 'text',
            text: 'Dummy response',
          },
        ],
        warnings: [],
      }),
      doStream: async () => ({
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
          { type: 'text-delta', id: 'text-1', delta: 'Dummy response' },
          { type: 'text-end', id: 'text-1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ]),
      }),
    });
  } else if (version === 'v3') {
    return new MockLanguageModelV3({
      doGenerate: async () => ({
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: {
          inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
          outputTokens: { total: 20, text: 20, reasoning: undefined },
        },
        content: [
          {
            type: 'text',
            text: 'Dummy response',
          },
        ],
        warnings: [],
      }),
      doStream: async () => ({
        stream: convertArrayToReadableStreamV3([
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
          { type: 'text-delta', id: 'text-1', delta: 'Dummy response' },
          { type: 'text-end', id: 'text-1' },
          {
            type: 'finish',
            finishReason: { unified: 'stop', raw: 'stop' },
            usage: {
              inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
              outputTokens: { total: 20, text: 20, reasoning: undefined },
            },
          },
        ]),
      }),
    });
  } else {
    // v4
    return new MockLanguageModelV4({
      doGenerate: async () => ({
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: {
          inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
          outputTokens: { total: 20, text: 20, reasoning: undefined },
        },
        content: [
          {
            type: 'text',
            text: 'Dummy response',
          },
        ],
        warnings: [],
      }),
      doStream: async () => ({
        stream: convertArrayToReadableStreamV4([
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
          { type: 'text-delta', id: 'text-1', delta: 'Dummy response' },
          { type: 'text-end', id: 'text-1' },
          {
            type: 'finish',
            finishReason: { unified: 'stop', raw: 'stop' },
            usage: {
              inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
              outputTokens: { total: 20, text: 20, reasoning: undefined },
            },
          },
        ]),
      }),
    });
  }
}

export function getDummyResponseModel(version: MockModelSpecVersion) {
  if (version === 'v2') {
    return new MockLanguageModelV2({
      doGenerate: async _options => ({
        text: Array.from({ length: 10 }, (_, count) => `Dummy response ${count}`).join(' '),
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
        content: [
          {
            type: 'text',
            text: Array.from({ length: 10 }, (_, count) => `Dummy response ${count}`).join(' '),
          },
        ],
        warnings: [],
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
      doStream: async _options => ({
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
          ...Array.from({ length: 10 }, (_, count) => ({
            type: 'text-delta' as const,
            id: '1',
            delta: `Dummy response ${count}`,
          })),
          { type: 'text-end', id: 'text-1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
          },
        ]),
      }),
    });
  } else if (version === 'v3') {
    return new MockLanguageModelV3({
      doGenerate: async _options => ({
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: {
          inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
          outputTokens: { total: 10, text: 10, reasoning: undefined },
        },
        content: [
          {
            type: 'text',
            text: Array.from({ length: 10 }, (_, count) => `Dummy response ${count}`).join(' '),
          },
        ],
        warnings: [],
      }),
      doStream: async _options => ({
        stream: convertArrayToReadableStreamV3([
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
          ...Array.from({ length: 10 }, (_, count) => ({
            type: 'text-delta' as const,
            id: 'text-1',
            delta: `Dummy response ${count}`,
          })),
          { type: 'text-end', id: 'text-1' },
          {
            type: 'finish',
            finishReason: { unified: 'stop', raw: 'stop' },
            usage: {
              inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
              outputTokens: { total: 10, text: 10, reasoning: undefined },
            },
          },
        ]),
      }),
    });
  } else {
    // v4
    return new MockLanguageModelV4({
      doGenerate: async _options => ({
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: {
          inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
          outputTokens: { total: 10, text: 10, reasoning: undefined },
        },
        content: [
          {
            type: 'text',
            text: Array.from({ length: 10 }, (_, count) => `Dummy response ${count}`).join(' '),
          },
        ],
        warnings: [],
      }),
      doStream: async _options => ({
        stream: convertArrayToReadableStreamV4([
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
          ...Array.from({ length: 10 }, (_, count) => ({
            type: 'text-delta' as const,
            id: 'text-1',
            delta: `Dummy response ${count}`,
          })),
          { type: 'text-end', id: 'text-1' },
          {
            type: 'finish',
            finishReason: { unified: 'stop', raw: 'stop' },
            usage: {
              inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
              outputTokens: { total: 10, text: 10, reasoning: undefined },
            },
          },
        ]),
      }),
    });
  }
}

export function getEmptyResponseModel(version: MockModelSpecVersion) {
  if (version === 'v2') {
    return new MockLanguageModelV2({
      doGenerate: async _options => ({
        text: undefined,
        finishReason: 'stop',
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        content: [],
        warnings: [],
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
      doStream: async () => ({
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
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
          },
        ]),
      }),
    });
  } else if (version === 'v3') {
    return new MockLanguageModelV3({
      doGenerate: async _options => ({
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: {
          inputTokens: { total: 0, noCache: 0, cacheRead: undefined, cacheWrite: undefined },
          outputTokens: { total: 0, text: 0, reasoning: undefined },
        },
        content: [],
        warnings: [],
      }),
      doStream: async () => ({
        stream: convertArrayToReadableStreamV3([
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
          {
            type: 'finish',
            finishReason: { unified: 'stop', raw: 'stop' },
            usage: {
              inputTokens: { total: 0, noCache: 0, cacheRead: undefined, cacheWrite: undefined },
              outputTokens: { total: 0, text: 0, reasoning: undefined },
            },
          },
        ]),
      }),
    });
  } else {
    // v4
    return new MockLanguageModelV4({
      doGenerate: async _options => ({
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: {
          inputTokens: { total: 0, noCache: 0, cacheRead: undefined, cacheWrite: undefined },
          outputTokens: { total: 0, text: 0, reasoning: undefined },
        },
        content: [],
        warnings: [],
      }),
      doStream: async () => ({
        stream: convertArrayToReadableStreamV4([
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
          {
            type: 'finish',
            finishReason: { unified: 'stop', raw: 'stop' },
            usage: {
              inputTokens: { total: 0, noCache: 0, cacheRead: undefined, cacheWrite: undefined },
              outputTokens: { total: 0, text: 0, reasoning: undefined },
            },
          },
        ]),
      }),
    });
  }
}

export function getErrorResponseModel(version: MockModelSpecVersion) {
  if (version === 'v2') {
    // Model throws immediately before emitting any part
    return new MockLanguageModelV2({
      doGenerate: async _options => {
        throw new Error('Immediate interruption');
      },
      doStream: async _options => {
        throw new Error('Immediate interruption');
      },
    });
  } else if (version === 'v3') {
    // v3: Model throws immediately before emitting any part
    return new MockLanguageModelV3({
      doGenerate: async _options => {
        throw new Error('Immediate interruption');
      },
      doStream: async _options => {
        throw new Error('Immediate interruption');
      },
    });
  } else {
    // v4: Model throws immediately before emitting any part
    return new MockLanguageModelV4({
      doGenerate: async _options => {
        throw new Error('Immediate interruption');
      },
      doStream: async _options => {
        throw new Error('Immediate interruption');
      },
    });
  }
}

// Re-export mock classes for direct use in tests
export { MockLanguageModelV2, MockLanguageModelV3, MockLanguageModelV4 };
export { convertArrayToReadableStream, convertArrayToReadableStreamV3, convertArrayToReadableStreamV4 };
