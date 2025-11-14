import type { LanguageModelV2, LanguageModelV2CallWarning, LanguageModelV2StreamPart } from '@ai-sdk/provider-v5';
import { convertArrayToReadableStream, MockLanguageModelV2 } from 'ai-v5/test';

export const testUsage = {
  inputTokens: 3,
  outputTokens: 10,
  totalTokens: 13,
  reasoningTokens: undefined,
  cachedInputTokens: undefined,
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
    { type: 'reasoning-start', id: 'reasoning-1' },
    { type: 'reasoning-delta', id: 'reasoning-1', delta: 'I need to think about this...' },
    { type: 'reasoning-delta', id: 'reasoning-1', delta: ' Let me process the request.' },
    { type: 'reasoning-end', id: 'reasoning-1' },
    {
      type: 'source',
      sourceType: 'url',
      id: 'source-1',
      url: 'https://example.com/article',
      title: 'Example Article',
      providerMetadata: undefined,
    },
    {
      type: 'file',
      mediaType: 'image/png',
      data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    },
    {
      type: 'tool-call',
      toolCallId: 'call-1',
      toolName: 'get_weather',
      input: '{"location": "New York", "unit": "celsius"}',
      providerExecuted: false,
    },
    {
      type: 'tool-result',
      toolCallId: 'call-1',
      toolName: 'get_weather',
      result: { temperature: 22, condition: 'sunny', humidity: 65 },
      isError: false,
      providerExecuted: false,
    },
    {
      type: 'tool-input-start',
      id: 'input-1',
      toolName: 'calculate_sum',
      providerExecuted: false,
    },
    {
      type: 'tool-input-delta',
      id: 'input-1',
      delta: '{"a": 5, ',
    },
    {
      type: 'tool-input-delta',
      id: 'input-1',
      delta: '"b": 10}',
    },
    {
      type: 'tool-input-end',
      id: 'input-1',
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
