import { convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';

import { MessageList } from '../../../agent/message-list';
import type { MastraDBMessage } from '../../../agent/message-list/state/types';
import { RequestContext } from '../../../request-context';
import { PUBSUB_SYMBOL, STREAM_FORMAT_SYMBOL } from '../../../workflows/constants';
import { testUsage } from '../../test-utils/utils';
import type { OuterLLMRun } from '../../types';
import { createAgenticExecutionWorkflow } from './index';

function countOpenAIItemIds(messages: MastraDBMessage[]) {
  const counts = new Map<string, number>();

  for (const message of messages) {
    for (const part of message.content.parts) {
      const itemId = (part as any).providerMetadata?.openai?.itemId;
      if (typeof itemId === 'string') {
        counts.set(itemId, (counts.get(itemId) ?? 0) + 1);
      }
    }
  }

  return counts;
}

describe('createAgenticExecutionWorkflow response message handling', () => {
  it('does not re-add streamed response provider items from the output message snapshot', async () => {
    const messageList = new MessageList({ threadId: 'thread-1', resourceId: 'resource-1' });
    messageList.add({ role: 'user', content: 'hello' }, 'input');
    messageList.add(
      {
        id: 'msg-1',
        role: 'assistant',
        createdAt: new Date(0),
        threadId: 'thread-1',
        resourceId: 'resource-1',
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'previous assistant context' }],
        },
      },
      'memory',
    );

    const workflow = createAgenticExecutionWorkflow({
      agentId: 'test-agent',
      messageId: 'msg-1',
      runId: 'test-run',
      startTimestamp: Date.now(),
      methodType: 'stream',
      controller: {
        enqueue: vi.fn(),
        desiredSize: 1,
        close: vi.fn(),
        error: vi.fn(),
      } as unknown as ReadableStreamDefaultController,
      outputWriter: vi.fn(),
      messageList,
      models: [
        {
          id: 'test-model',
          maxRetries: 0,
          model: {
            specificationVersion: 'v2' as const,
            provider: 'mock-provider',
            modelId: 'mock-model-id',
            supportedUrls: {},
            doGenerate: vi.fn(),
            doStream: vi.fn(async () => ({
              stream: convertArrayToReadableStream([
                { type: 'response-metadata', id: 'resp-1', modelId: 'mock-model-id', timestamp: new Date(0) },
                { type: 'text-start', id: 'text-1', providerMetadata: { openai: { itemId: 'msg_duplicate' } } },
                { type: 'text-delta', id: 'text-1', delta: 'streamed text' },
                { type: 'text-end', id: 'text-1', providerMetadata: { openai: { itemId: 'msg_duplicate' } } },
                { type: 'finish', finishReason: 'stop', usage: testUsage },
              ]),
              request: {},
              response: { headers: undefined },
              warnings: [],
            })),
          } as any,
        },
      ],
      tools: {},
      streamState: {
        serialize: vi.fn(),
        deserialize: vi.fn(),
      },
      requestContext: new RequestContext(),
      _internal: {
        generateId: () => 'generated-id',
      },
      logger: {
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      } as any,
    } as unknown as OuterLLMRun<{}>);

    const run = await workflow.createRun({ runId: 'test-run' });
    const result = await run.start({
      inputData: {
        messageId: 'msg-1',
        messages: {
          all: messageList.get.all.aiV5.model(),
          user: messageList.get.input.aiV5.model(),
          nonUser: messageList.get.response.aiV5.model(),
        },
        output: {
          usage: testUsage,
          steps: [],
        },
        metadata: {},
        stepResult: {
          reason: 'stop',
          warnings: [],
          isContinued: true,
          totalUsage: testUsage,
        },
      },
      [PUBSUB_SYMBOL]: {} as any,
      [STREAM_FORMAT_SYMBOL]: undefined,
    } as any);

    expect(result.status).toBe('success');
    expect(countOpenAIItemIds(messageList.get.all.db()).get('msg_duplicate')).toBe(1);
  });
});
