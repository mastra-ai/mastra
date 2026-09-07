import { stepCountIs } from '@internal/ai-sdk-v5';
import { convertArrayToReadableStream, mockValues, mockId } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { Mastra } from '../..';
import { MessageList } from '../../agent/message-list';
import { EventEmitterPubSub } from '../../events';
import { loop } from '../../loop/loop';
import { MastraLanguageModelV2Mock } from '../../loop/test-utils/MastraLanguageModelV2Mock';
import type { MastraDBMessage } from '../../memory/types';
import { InMemoryStore } from '../../storage';
import { ProcessorRunner } from '../runner';

import { ToolCallFilter } from './tool-call-filter';

/**
 * Regression coverage for the data-loss bug where ToolCallFilter rewrote the
 * shared MessageList, so the filtered messages were written back to storage and
 * the original tool-invocation parts were lost forever.
 */

const rememberedMessages = (): MastraDBMessage[] => [
  {
    id: 'msg-user',
    role: 'user',
    content: {
      format: 2,
      content: 'Search for papers',
      parts: [{ type: 'text', text: 'Search for papers' }],
    },
    createdAt: new Date(0),
  },
  {
    id: 'msg-tools',
    role: 'assistant',
    content: {
      format: 2,
      content: '',
      parts: [
        {
          type: 'tool-invocation',
          toolInvocation: {
            state: 'result',
            toolCallId: 'call-search',
            toolName: 'search',
            args: { query: 'transformers' },
            result: { raw: 'FULL_RAW_TOOL_RESULT' },
          },
          providerMetadata: { mastra: { modelOutput: { type: 'text', value: 'compact result' } } },
        },
      ],
    },
    createdAt: new Date(1000),
  },
];

const toolInvocationParts = (messages: MastraDBMessage[]) =>
  messages
    .flatMap(message => (typeof message.content === 'string' ? [] : message.content.parts))
    .filter((part: any) => part.type === 'tool-invocation');

describe('ToolCallFilter does not persist its rewrites', () => {
  let mastra: Mastra;

  beforeEach(async () => {
    mastra = new Mastra({
      logger: false,
      storage: new InMemoryStore(),
      pubsub: new EventEmitterPubSub(),
    });
    await mastra.startWorkers();
  });

  afterEach(async () => {
    await mastra.stopWorkers();
  });

  it('leaves the shared message list untouched when input processors run', async () => {
    const messageList = new MessageList({ threadId: 'thread-1', resourceId: 'resource-1' });
    messageList.add(rememberedMessages(), 'memory');
    const before = structuredClone(messageList.get.all.db());

    const runner = new ProcessorRunner({
      inputProcessors: [new ToolCallFilter({ preserveModelOutput: true })],
      outputProcessors: [],
      logger: false as any,
      agentName: 'test-agent',
    });

    await runner.runInputProcessors(messageList);

    expect(messageList.get.all.db()).toEqual(before);
    expect(toolInvocationParts(messageList.get.all.db())).toHaveLength(1);
  });

  it('never re-saves a remembered message with its tool-invocation parts replaced', async () => {
    const messageList = new MessageList({ threadId: 'thread-1', resourceId: 'resource-1' });
    messageList.add(rememberedMessages(), 'memory');

    const runner = new ProcessorRunner({
      inputProcessors: [new ToolCallFilter({ preserveModelOutput: true })],
      outputProcessors: [],
      logger: false as any,
      agentName: 'test-agent',
    });

    await runner.runInputProcessors(messageList);

    // stepStart moves touched messages into the response bucket, which is what
    // previously flushed the rewritten message back to storage.
    messageList.stepStart();
    const unsaved = messageList.drainUnsavedMessages();

    // The message may legitimately be re-saved (stepStart appends a step-start
    // part), but it must never be re-saved in its filtered form.
    const resaved = unsaved.find(message => message.id === 'msg-tools');
    if (resaved) {
      expect(toolInvocationParts([resaved])).toHaveLength(1);
    }
    expect(JSON.stringify(unsaved)).not.toContain('search result:');
  });

  it('filters the model prompt while storage keeps the full tool invocation', async () => {
    const promptsSeen: any[] = [];

    const messageList = new MessageList({ threadId: 'thread-1', resourceId: 'resource-1' });
    messageList.add(rememberedMessages(), 'memory');
    messageList.add({ id: 'msg-followup', role: 'user', content: [{ type: 'text', text: 'Summarize that' }] }, 'input');

    const result = await loop({
      methodType: 'stream',
      runId: 'toolcallfilter-persistence',
      models: [
        {
          id: 'test-model',
          maxRetries: 0,
          model: new MastraLanguageModelV2Mock({
            doStream: async ({ prompt }: { prompt: unknown }) => {
              promptsSeen.push(prompt);
              return {
                stream: convertArrayToReadableStream([
                  { type: 'response-metadata', id: 'resp-0', modelId: 'mock-model-id', timestamp: new Date(0) },
                  { type: 'text-start', id: 'text-1' },
                  { type: 'text-delta', id: 'text-1', delta: 'Here is the summary.' },
                  { type: 'text-end', id: 'text-1' },
                  { type: 'finish', finishReason: 'stop', usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 } },
                ]),
              };
            },
          }),
        },
      ],
      inputProcessors: [new ToolCallFilter({ preserveModelOutput: true })],
      messageList,
      stopWhen: stepCountIs(2),
      _internal: {
        now: mockValues(0, 100, 500),
        generateId: mockId({ prefix: 'id' }),
      },
      agentId: 'test-agent',
      mastra,
    });

    await result.consumeStream();

    // The model saw the compacted history...
    const prompt = promptsSeen[0] as any[];
    expect(JSON.stringify(prompt)).not.toContain('FULL_RAW_TOOL_RESULT');
    const promptTexts = prompt.flatMap((message: any) =>
      typeof message.content === 'string'
        ? [message.content]
        : message.content.flatMap((part: any) => (part.type === 'text' ? [part.text] : [])),
    );
    expect(promptTexts).toContain('search result:\ncompact result');
    expect(JSON.stringify(prompt)).not.toContain('tool-call');

    // ...while the stored message still has its original tool-invocation part.
    const stored = messageList.get.all.db().find(message => message.id === 'msg-tools')!;
    expect(toolInvocationParts([stored])).toHaveLength(1);
    expect(JSON.stringify(stored)).toContain('FULL_RAW_TOOL_RESULT');
  });
});
