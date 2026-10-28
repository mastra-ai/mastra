import type { LanguageModelV2CallWarning, LanguageModelV2StreamPart } from '@ai-sdk/provider-v5';
import { convertArrayToReadableStream, mockId } from '@internal/ai-sdk-v5/test';
import type { ModelManagerModelConfig } from '../../stream/types';
import { MessageList } from '../../agent/message-list';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { MastraLanguageModelV2Mock as MockLanguageModelV2 } from './MastraLanguageModelV2Mock';

export const mockDate = new Date('2024-01-01T00:00:00Z');

export async function createTestMastra(): Promise<{ mastra: Mastra; dispose: () => Promise<void> }> {
  const mastra = new Mastra({
    logger: false,
    storage: new InMemoryStore(),
    pubsub: new EventEmitterPubSub(),
  });
  await mastra.startWorkers();
  return {
    mastra,
    dispose: async () => {
      await mastra.stopWorkers();
    },
  };
}

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

export const testUsage = {
  inputTokens: 3,
  outputTokens: 10,
  totalTokens: 13,
  reasoningTokens: undefined,
  cachedInputTokens: undefined,
};

export function createTestModels({
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
} = {}): ModelManagerModelConfig[] {
  const model = new MockLanguageModelV2({
    doStream: async () => ({ stream, request, response, warnings }),
    doGenerate: async () => ({
      content: [{ type: 'text' as const, text: 'Hello, world!' }],
      finishReason: 'stop',
      usage: testUsage,
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

export const createMessageListWithUserMessage = () => {
  const messageList = new MessageList();
  messageList.add(
    {
      id: 'msg-1',
      role: 'user',
      content: [{ type: 'text', text: 'test-input' }],
    },
    'input',
  );
  return messageList;
};
