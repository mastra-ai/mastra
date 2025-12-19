import type { LanguageModelV3StreamPart, SharedV3Warning } from '@ai-sdk/provider-v6';
import { convertArrayToReadableStream, mockId } from '@internal/ai-v6/test';
import type { ModelManagerModelConfig } from '../../stream/types';
import { MastraLanguageModelV3Mock as MockLanguageModelV3 } from './MastraLanguageModelV3Mock';

export const mockDate = new Date('2024-01-01T00:00:00Z');

export const defaultSettings = () =>
  ({
    prompt: 'prompt',
    experimental_generateMessageId: mockId({ prefix: 'msg' }),
    _internal: {
      generateId: mockId({ prefix: 'id' }),
      currentDate: () => new Date(0),
    },
    agentId: 'agent-id',
    onError: () => {},
  }) as const;

// V3 usage format
export const testUsageV3 = {
  inputTokens: { total: 3, noCache: 3, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 10, text: 10, reasoning: undefined },
};

export const testUsageV3_2 = {
  inputTokens: { total: 3, noCache: 0, cacheRead: 3, cacheWrite: undefined },
  outputTokens: { total: 10, text: 0, reasoning: 10 },
};

export function createTestModelsV3({
  warnings = [],
  stream = convertArrayToReadableStream([
    {
      type: 'stream-start',
      warnings,
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
    { type: 'text-delta', id: 'text-1', delta: `world!` },
    { type: 'text-end', id: 'text-1' },
    {
      type: 'finish',
      finishReason: 'stop',
      usage: testUsageV3,
      providerMetadata: {
        testProvider: { testKey: 'testValue' },
      },
    },
  ]),
  request = undefined,
  response = undefined,
}: {
  stream?: ReadableStream<LanguageModelV3StreamPart>;
  request?: { body: string };
  response?: { headers: Record<string, string> };
  warnings?: SharedV3Warning[];
} = {}): ModelManagerModelConfig[] {
  const model = new MockLanguageModelV3({
    doStream: async () => ({ stream, request, response, warnings }),
    doGenerate: async () => ({
      content: [{ type: 'text' as const, text: 'Hello, world!' }],
      finishReason: 'stop',
      usage: testUsageV3,
      warnings,
      request,
      response: {
        id: 'id-0',
        modelId: 'mock-model-id',
        timestamp: new Date(0),
        ...response,
      },
    }),
  });
  return [
    {
      model,
      maxRetries: 0,
      id: 'test-model',
    },
  ];
}

export const modelWithSourcesV3 = new MockLanguageModelV3({
  doStream: async () => ({
    stream: convertArrayToReadableStream([
      {
        type: 'source',
        sourceType: 'url',
        id: '123',
        url: 'https://example.com',
        title: 'Example',
        providerMetadata: { provider: { custom: 'value' } },
      },
      { type: 'text-start', id: 'text-1' },
      { type: 'text-delta', id: 'text-1', delta: 'Hello!' },
      { type: 'text-end', id: 'text-1' },
      {
        type: 'source',
        sourceType: 'url',
        id: '456',
        url: 'https://example.com/2',
        title: 'Example 2',
        providerMetadata: { provider: { custom: 'value2' } },
      },
      {
        type: 'finish',
        finishReason: 'stop',
        usage: testUsageV3,
      },
    ]),
  }),
  doGenerate: async () => ({
    content: [
      {
        type: 'source' as const,
        sourceType: 'url' as const,
        id: '123',
        url: 'https://example.com',
        title: 'Example',
        providerMetadata: { provider: { custom: 'value' } },
      },
      { type: 'text' as const, text: 'Hello!' },
      {
        type: 'source' as const,
        sourceType: 'url' as const,
        id: '456',
        url: 'https://example.com/2',
        title: 'Example 2',
        providerMetadata: { provider: { custom: 'value2' } },
      },
    ],
    finishReason: 'stop',
    usage: testUsageV3,
    warnings: [],
  }),
});

export const modelWithFilesV3 = new MockLanguageModelV3({
  doStream: async () => ({
    stream: convertArrayToReadableStream([
      {
        type: 'file',
        data: 'Hello World',
        mediaType: 'text/plain',
      },
      { type: 'text-start', id: 'text-1' },
      { type: 'text-delta', id: 'text-1', delta: 'Hello!' },
      { type: 'text-end', id: 'text-1' },
      {
        type: 'file',
        data: 'QkFVRw==',
        mediaType: 'image/jpeg',
      },
      {
        type: 'finish',
        finishReason: 'stop',
        usage: testUsageV3,
      },
    ]),
  }),
  doGenerate: async () => ({
    content: [
      {
        type: 'file' as const,
        data: 'Hello World',
        mediaType: 'text/plain',
      },
      { type: 'text' as const, text: 'Hello!' },
      {
        type: 'file' as const,
        data: 'QkFVRw==',
        mediaType: 'image/jpeg',
      },
    ],
    finishReason: 'stop',
    usage: testUsageV3,
    warnings: [],
  }),
});

export const modelWithReasoningV3 = new MockLanguageModelV3({
  doStream: async () => ({
    stream: convertArrayToReadableStream([
      {
        type: 'response-metadata',
        id: 'id-0',
        modelId: 'mock-model-id',
        timestamp: new Date(0),
      },
      { type: 'reasoning-start', id: '1' },
      {
        type: 'reasoning-delta',
        id: '1',
        delta: 'I will open the conversation',
      },
      {
        type: 'reasoning-delta',
        id: '1',
        delta: ' with witty banter.',
      },
      {
        type: 'reasoning-delta',
        id: '1',
        delta: '',
        providerMetadata: {
          testProvider: { signature: '1234567890' },
        },
      },
      { type: 'reasoning-end', id: '1' },
      {
        type: 'reasoning-start',
        id: '2',
        providerMetadata: {
          testProvider: { redactedData: 'redacted-reasoning-data' },
        },
      },
      { type: 'reasoning-end', id: '2' },
      { type: 'reasoning-start', id: '3' },
      {
        type: 'reasoning-delta',
        id: '3',
        delta: ' Once the user has relaxed,',
      },
      {
        type: 'reasoning-delta',
        id: '3',
        delta: ' I will pry for valuable information.',
      },
      {
        type: 'reasoning-end',
        id: '3',
        providerMetadata: {
          testProvider: { signature: '1234567890' },
        },
      },
      {
        type: 'reasoning-start',
        id: '4',
        providerMetadata: {
          testProvider: { signature: '1234567890' },
        },
      },
      {
        type: 'reasoning-delta',
        id: '4',
        delta: ' I need to think about',
      },
      {
        type: 'reasoning-delta',
        id: '4',
        delta: ' this problem carefully.',
      },
      {
        type: 'reasoning-end',
        id: '4',
        providerMetadata: {
          testProvider: { signature: '0987654321' },
        },
      },
      {
        type: 'reasoning-start',
        id: '5',
        providerMetadata: {
          testProvider: { signature: '1234567890' },
        },
      },
      {
        type: 'reasoning-delta',
        id: '5',
        delta: ' The best solution',
      },
      {
        type: 'reasoning-delta',
        id: '5',
        delta: ' requires careful',
      },
      {
        type: 'reasoning-delta',
        id: '5',
        delta: ' consideration of all factors.',
      },
      {
        type: 'reasoning-end',
        id: '5',
        providerMetadata: {
          testProvider: { signature: '0987654321' },
        },
      },
      { type: 'text-start', id: 'text-1' },
      { type: 'text-delta', id: 'text-1', delta: 'Hi' },
      { type: 'text-delta', id: 'text-1', delta: ' there!' },
      { type: 'text-end', id: 'text-1' },
      {
        type: 'finish',
        finishReason: 'stop',
        usage: testUsageV3,
      },
    ]),
  }),
  doGenerate: async () => ({
    content: [
      {
        type: 'reasoning' as const,
        text: 'I will open the conversation with witty banter. Once the user has relaxed, I will pry for valuable information. I need to think about this problem carefully. The best solution requires careful consideration of all factors.',
      },
      { type: 'text' as const, text: 'Hi there!' },
    ],
    finishReason: 'stop',
    usage: testUsageV3,
    warnings: [],
    response: {
      id: 'id-0',
      modelId: 'mock-model-id',
      timestamp: new Date(0),
    },
  }),
});

export { createMessageListWithUserMessage } from './utils';
