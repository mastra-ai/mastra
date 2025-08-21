import type {
  LanguageModelV2,
  LanguageModelV2CallWarning,
  LanguageModelV2StreamPart,
  SharedV2ProviderMetadata,
} from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream, mockId } from 'ai-v5/test';

export const defaultSettings = () =>
  ({
    prompt: 'prompt',
    experimental_generateMessageId: mockId({ prefix: 'msg' }),
    _internal: {
      generateId: mockId({ prefix: 'id' }),
      currentDate: () => new Date(0),
    },
    onError: () => {},
  }) as const;

export const testUsage = {
  inputTokens: 3,
  outputTokens: 10,
  totalTokens: 13,
  reasoningTokens: undefined,
  cachedInputTokens: undefined,
};

export const testUsage2 = {
  inputTokens: 3,
  outputTokens: 10,
  totalTokens: 23,
  reasoningTokens: 10,
  cachedInputTokens: 3,
};

export function createTestModel({
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
    { type: 'text-start', id: '1' },
    { type: 'text-delta', id: '1', delta: 'Hello' },
    { type: 'text-delta', id: '1', delta: ', ' },
    { type: 'text-delta', id: '1', delta: `world!` },
    { type: 'text-end', id: '1' },
    {
      type: 'finish',
      finishReason: 'stop',
      usage: testUsage,
      providerMetadata: {
        testProvider: { testKey: 'testValue' },
      },
    },
  ]),
  request = undefined,
  response = undefined,
}: {
  stream?: ReadableStream<LanguageModelV2StreamPart>;
  request?: { body: string };
  response?: { headers: Record<string, string> };
  warnings?: LanguageModelV2CallWarning[];
} = {}): LanguageModelV2 {
  return new MockLanguageModelV2({
    doStream: async () => ({ stream, request, response, warnings }),
  });
}

export const modelWithSources = new MockLanguageModelV2({
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
      { type: 'text-start', id: '1' },
      { type: 'text-delta', id: '1', delta: 'Hello!' },
      { type: 'text-end', id: '1' },
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
        usage: testUsage,
      },
    ]),
  }),
});

export const modelWithDocumentSources = new MockLanguageModelV2({
  doStream: async () => ({
    stream: convertArrayToReadableStream([
      {
        type: 'source',
        sourceType: 'document',
        id: 'doc-123',
        mediaType: 'application/pdf',
        title: 'Document Example',
        filename: 'example.pdf',
        providerMetadata: { provider: { custom: 'doc-value' } },
      },
      { type: 'text-start', id: '1' },
      { type: 'text-delta', id: '1', delta: 'Hello from document!' },
      { type: 'text-end', id: '1' },
      {
        type: 'source',
        sourceType: 'document',
        id: 'doc-456',
        mediaType: 'text/plain',
        title: 'Text Document',
        providerMetadata: { provider: { custom: 'doc-value2' } },
      },
      {
        type: 'finish',
        finishReason: 'stop',
        usage: testUsage,
      },
    ]),
  }),
});

export const modelWithFiles = new MockLanguageModelV2({
  doStream: async () => ({
    stream: convertArrayToReadableStream([
      {
        type: 'file',
        data: 'Hello World',
        mediaType: 'text/plain',
      },
      { type: 'text-start', id: '1' },
      { type: 'text-delta', id: '1', delta: 'Hello!' },
      { type: 'text-end', id: '1' },
      {
        type: 'file',
        data: 'QkFVRw==',
        mediaType: 'image/jpeg',
      },
      {
        type: 'finish',
        finishReason: 'stop',
        usage: testUsage,
      },
    ]),
  }),
});

export const modelWithReasoning = new MockLanguageModelV2({
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
        } as SharedV2ProviderMetadata,
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
        } as SharedV2ProviderMetadata,
      },
      {
        type: 'reasoning-start',
        id: '4',
        providerMetadata: {
          testProvider: { signature: '1234567890' },
        } as SharedV2ProviderMetadata,
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
        } as SharedV2ProviderMetadata,
      },
      {
        type: 'reasoning-start',
        id: '5',
        providerMetadata: {
          testProvider: { signature: '1234567890' },
        } as SharedV2ProviderMetadata,
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
        } as SharedV2ProviderMetadata,
      },
      { type: 'text-start', id: '1' },
      { type: 'text-delta', id: '1', delta: 'Hi' },
      { type: 'text-delta', id: '1', delta: ' there!' },
      { type: 'text-end', id: '1' },
      {
        type: 'finish',
        finishReason: 'stop',
        usage: testUsage,
      },
    ]),
  }),
});
