import { MessageList } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';

import { Memory } from '../../../index';

const threadId = 'om-filter-thread';
const resourceId = 'om-filter-resource';

function createToolMessage(id: string, sealed: boolean, createdAt: string): MastraDBMessage {
  return {
    id,
    role: 'assistant',
    threadId,
    resourceId,
    createdAt: new Date(createdAt),
    content: {
      format: 2,
      content: 'Final answer that stays visible',
      providerMetadata: { mastra: { rawProviderPayload: 'MESSAGE_PROVIDER_SECRET' } },
      metadata: sealed ? { mastra: { sealed: true } } : undefined,
      parts: [
        { type: 'text', text: 'Final answer that stays visible' },
        { type: 'data-om-observation-end', data: { cycleId: 'cycle-1' } },
        {
          type: 'tool-invocation',
          toolInvocation: {
            state: 'result',
            toolCallId: `call-${id}`,
            toolName: 'secret_tool',
            args: { secret: 'RAW_TOOL_ARGS_SECRET' },
            result: { secret: 'RAW_TOOL_RESULT_SECRET' },
          },
          providerMetadata: { mastra: { rawProviderPayload: 'PART_PROVIDER_SECRET' } },
          ...(sealed ? { metadata: { mastra: { sealedAt: 42 } } } : {}),
        },
      ],
      toolInvocations: [
        {
          state: 'result',
          toolCallId: `call-${id}`,
          toolName: 'secret_tool',
          args: { secret: 'TOP_LEVEL_TOOL_ARGS_SECRET' },
          result: 'TOP_LEVEL_TOOL_RESULT_SECRET',
        },
      ],
    },
  } as MastraDBMessage;
}

function serializedMessage(message: MastraDBMessage): string {
  return JSON.stringify(message);
}

describe('native Observational Memory tool-call filtering', () => {
  it('filters normal and sealed buffer writes while preserving the live message and seal boundary', async () => {
    const storage = new InMemoryStore();
    const memory = new Memory({
      storage,
      options: {
        observationalMemory: {
          toolCallFilter: { exclude: ['secret_tool'], preserveModelOutputFor: [] },
        },
      },
    });
    await memory.createThread({ threadId, resourceId });

    const om = await memory.omEngine;
    expect(om).not.toBeNull();

    const normalMessage = createToolMessage('normal-message', false, '2025-01-01T00:00:01.000Z');
    const bufferedMessage = createToolMessage('buffered-message', true, '2025-01-01T00:00:02.000Z');
    const normalBefore = serializedMessage(normalMessage);
    const bufferedBefore = serializedMessage(bufferedMessage);

    await om!.persistMessages([normalMessage], threadId, resourceId);
    await om!.persistMessagesForBuffering([bufferedMessage], threadId, resourceId);

    expect(serializedMessage(normalMessage)).toBe(normalBefore);
    expect(serializedMessage(bufferedMessage)).toBe(bufferedBefore);

    const stored = await (await storage.getStore('memory'))!.listMessages({
      threadId,
      resourceId,
      perPage: false,
      orderBy: { field: 'createdAt', direction: 'ASC' },
    });
    expect(stored.messages.map(message => message.id)).toEqual(['normal-message', 'buffered-message']);
    for (const message of stored.messages) {
      const serialized = serializedMessage(message);
      expect(serialized).toContain('Final answer that stays visible');
      expect(serialized).toContain('data-om-observation-end');
      expect(serialized).not.toContain('RAW_TOOL_ARGS_SECRET');
      expect(serialized).not.toContain('RAW_TOOL_RESULT_SECRET');
      expect(serialized).not.toContain('TOP_LEVEL_TOOL_ARGS_SECRET');
      expect(serialized).not.toContain('TOP_LEVEL_TOOL_RESULT_SECRET');
      expect(serialized).not.toContain('MESSAGE_PROVIDER_SECRET');
      expect(serialized).not.toContain('PART_PROVIDER_SECRET');
    }

    const storedBuffered = stored.messages[1]!;
    const lastPart = storedBuffered.content.parts.at(-1);
    expect(lastPart?.type).toBe('data-om-observation-end');
    expect((lastPart as any)?.metadata?.mastra?.sealedAt).toBe(42);
    expect(storedBuffered.content.metadata?.mastra?.sealed).toBe(true);

    const reloaded = new MessageList({ threadId, resourceId });
    reloaded.add(storedBuffered, 'memory');
    reloaded.add(
      {
        ...storedBuffered,
        content: {
          ...storedBuffered.content,
          parts: [{ type: 'text', text: 'content after reload' }],
        },
      },
      'response',
    );
    const readdedMessages = reloaded.get.all.db().filter(message => message.role === 'assistant');
    expect(readdedMessages).toHaveLength(2);
    expect(readdedMessages[1]?.id).not.toBe(storedBuffered.id);
    expect(readdedMessages[1]?.content.parts).toMatchObject([{ type: 'text', text: 'content after reload' }]);
  });

  it('filters seeded raw rows on context, observation, and recall reads', async () => {
    const storage = new InMemoryStore();
    const memory = new Memory({
      storage,
      options: {
        observationalMemory: {
          toolCallFilter: { exclude: ['secret_tool'], preserveModelOutputFor: [] },
        },
      },
    });
    await memory.createThread({ threadId: `${threadId}-reads`, resourceId: `${resourceId}-reads` });

    const seeded = createToolMessage('seeded-raw-message', true, '2025-01-01T00:00:03.000Z');
    seeded.threadId = `${threadId}-reads`;
    seeded.resourceId = `${resourceId}-reads`;
    await memory.persistMessages([seeded]);

    const om = await memory.omEngine;
    expect(om).not.toBeNull();
    const loadedForObservation = await (
      om as unknown as {
        loadMessagesFromStorage: (thread: string, resource?: string) => Promise<MastraDBMessage[]>;
      }
    ).loadMessagesFromStorage(`${threadId}-reads`, `${resourceId}-reads`);
    expect(serializedMessage(loadedForObservation[0]!)).not.toContain('RAW_TOOL_ARGS_SECRET');

    const context = await memory.getContext({ threadId: `${threadId}-reads`, resourceId: `${resourceId}-reads` });
    expect(serializedMessage(context.messages[0]!)).not.toContain('RAW_TOOL_ARGS_SECRET');
    expect(serializedMessage(context.messages[0]!)).not.toContain('MESSAGE_PROVIDER_SECRET');

    const recalled = await memory.recall({
      threadId: `${threadId}-reads`,
      resourceId: `${resourceId}-reads`,
      perPage: false,
    });
    expect(serializedMessage(recalled.messages[0]!)).not.toContain('RAW_TOOL_RESULT_SECRET');
    expect(serializedMessage(recalled.messages[0]!)).not.toContain('TOP_LEVEL_TOOL_RESULT_SECRET');
  });
});
