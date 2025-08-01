import type { LanguageModelV1CallWarning } from '@ai-sdk/provider';
import type { LanguageModelV1, LanguageModelV1StreamPart } from 'ai';
import { MockLanguageModelV1, convertArrayToReadableStream } from 'ai/test';

const modelWithReasoning = new MockLanguageModelV1({
  doStream: async () => ({
    stream: convertArrayToReadableStream([
      {
        type: 'response-metadata',
        id: 'id-0',
        modelId: 'mock-model-id',
        timestamp: new Date(0),
      },
      { type: 'reasoning', textDelta: 'I will open the conversation' },
      { type: 'reasoning', textDelta: ' with witty banter.' },
      { type: 'reasoning-signature', signature: 'signature' },
      { type: 'redacted-reasoning', data: 'redacted-reasoning-data' },
      { type: 'reasoning-signature', signature: '1234567890' },
      { type: 'text-delta', textDelta: 'Hello, ' },
      { type: 'text-delta', textDelta: 'world!' },
      {
        type: 'finish',
        finishReason: 'stop',
        logprobs: undefined,
        usage: { completionTokens: 20, promptTokens: 10 },
      },
    ]),
    rawCall: { rawPrompt: 'prompt', rawSettings: {} },
  }),
});

function createTestModel({
  stream = convertArrayToReadableStream([
    {
      type: 'response-metadata',
      id: 'id-0',
      modelId: 'mock-model-id',
      timestamp: new Date(0),
    },
    { type: 'text-delta', textDelta: 'Hello' },
    { type: 'text-delta', textDelta: ', ' },
    { type: 'text-delta', textDelta: `world!` },
    {
      type: 'finish',
      finishReason: 'stop',
      logprobs: undefined,
      usage: { completionTokens: 10, promptTokens: 3 },
    },
  ]),
  rawCall = { rawPrompt: 'prompt', rawSettings: {} },
  rawResponse = undefined,
  request = undefined,
  warnings,
}: {
  stream?: ReadableStream<LanguageModelV1StreamPart>;
  rawResponse?: { headers: Record<string, string> };
  rawCall?: { rawPrompt: string; rawSettings: Record<string, unknown> };
  request?: { body: string };
  warnings?: LanguageModelV1CallWarning[];
} = {}): LanguageModelV1 {
  return new MockLanguageModelV1({
    doStream: async () => ({ stream, rawCall, rawResponse, request, warnings }),
  });
}

const modelWithSources = new MockLanguageModelV1({
  doStream: async () => ({
    stream: convertArrayToReadableStream([
      {
        type: 'source',
        source: {
          sourceType: 'url' as const,
          id: '123',
          url: 'https://example.com',
          title: 'Example',
          providerMetadata: { provider: { custom: 'value' } },
        },
      },
      { type: 'text-delta', textDelta: 'Hello!' },
      {
        type: 'source',
        source: {
          sourceType: 'url' as const,
          id: '456',
          url: 'https://example.com/2',
          title: 'Example 2',
          providerMetadata: { provider: { custom: 'value2' } },
        },
      },
      {
        type: 'finish',
        finishReason: 'stop',
        logprobs: undefined,
        usage: { completionTokens: 10, promptTokens: 3 },
        providerMetadata: { testprovider: { testkey: 'testvalue' } },
      },
    ]),
    rawCall: { rawPrompt: 'prompt', rawSettings: {} },
  }),
});

const modelWithFiles = new MockLanguageModelV1({
  doStream: async () => ({
    stream: convertArrayToReadableStream([
      {
        type: 'file',
        data: new Uint8Array([1, 2, 3]),
        mimeType: 'image/png',
      },
      { type: 'text-delta', textDelta: 'Hello, world!' },
      {
        type: 'file',
        data: 'QkFVRw==',
        mimeType: 'image/jpeg',
      },
      {
        type: 'finish',
        finishReason: 'stop',
        logprobs: undefined,
        usage: { completionTokens: 20, promptTokens: 10 },
      },
    ]),
    rawCall: { rawPrompt: 'prompt', rawSettings: {} },
  }),
});

export { modelWithReasoning, createTestModel, modelWithSources, modelWithFiles };
