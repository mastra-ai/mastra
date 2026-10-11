/**
 * Observation-boundary marker placement (#21657).
 *
 * `observe({ messages })` on part of a thread must place its boundary marker inside the
 * observed set, never on a newer message the Observer did not see.
 */

import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { MessageList } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import { InMemoryMemory, InMemoryDB } from '@mastra/core/storage';
import { describe, it, expect, beforeEach } from 'vitest';

import { filterObservedMessages, findObservationMarkerTargetIndex } from '../message-utils';
import { ObservationalMemory } from '../observational-memory';

const threadId = 'marker-thread';
const resourceId = 'marker-resource';
const observationText = '<observations>\n* Observed older conversation\n</observations>';
const baseTime = Date.now() - 10 * 60_000;

function createObserverModel() {
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
      warnings: [],
      content: [{ type: 'text', text: observationText }],
    }),
    doStream: async () => ({
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue({ type: 'stream-start', warnings: [] });
          controller.enqueue({ type: 'text-start', id: 'text-1' });
          controller.enqueue({ type: 'text-delta', id: 'text-1', delta: observationText });
          controller.enqueue({ type: 'text-end', id: 'text-1' });
          controller.enqueue({
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
          });
          controller.close();
        },
      }),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  } as any);
}

function textMessage(id: string, role: 'user' | 'assistant', index: number): MastraDBMessage {
  return {
    id,
    role,
    threadId,
    resourceId,
    type: 'text',
    createdAt: new Date(baseTime + index * 1000),
    content: { format: 2, parts: [{ type: 'text', text: `${id} `.padEnd(800, 'x') }] },
  };
}

function assistantWithToolResult(id: string, index: number): MastraDBMessage {
  return {
    ...textMessage(id, 'assistant', index),
    content: {
      format: 2,
      parts: [
        { type: 'text', text: 'Looking that up' },
        {
          type: 'tool-invocation',
          toolInvocation: {
            state: 'result',
            toolCallId: 'call-1',
            toolName: 'search',
            args: { q: 'weather' },
            result: { forecast: 'sunny' },
          },
        },
      ],
    },
  };
}

function conversation(count: number): MastraDBMessage[] {
  return Array.from({ length: count }, (_, i) => textMessage(`m${i}`, i % 2 === 0 ? 'user' : 'assistant', i));
}

function partTypes(message: MastraDBMessage | undefined): string[] {
  return (message?.content.parts ?? []).map(part => part.type);
}

function hasEndMarker(message: MastraDBMessage | undefined): boolean {
  return partTypes(message).includes('data-om-observation-end');
}

describe('observation marker placement (#21657)', () => {
  let storage: InMemoryMemory;
  let om: ObservationalMemory;

  async function seed(messages: MastraDBMessage[]) {
    await storage.saveMessages({ messages });
  }

  async function storedMessages(): Promise<MastraDBMessage[]> {
    const result = await storage.listMessages({ threadId, perPage: false });
    return result.messages;
  }

  async function storedMessage(id: string) {
    return (await storedMessages()).find(message => message.id === id);
  }

  beforeEach(async () => {
    storage = new InMemoryMemory({ db: new InMemoryDB() });
    await storage.saveThread({
      thread: {
        id: threadId,
        resourceId,
        title: 'thread',
        createdAt: new Date(baseTime),
        updatedAt: new Date(baseTime),
      },
    });
    om = new ObservationalMemory({
      storage,
      scope: 'thread',
      observation: { model: createObserverModel(), messageTokens: 100, bufferTokens: false },
      reflection: { model: createObserverModel(), observationTokens: 50_000 },
    });
  });

  function issueThread() {
    return [
      textMessage('old-user', 'user', 1),
      textMessage('old-assistant', 'assistant', 2),
      textMessage('new-user', 'user', 3),
      assistantWithToolResult('new-assistant', 4),
    ];
  }

  it('storage path: observing a prefix marks the prefix, not the newest assistant', async () => {
    const messages = issueThread();
    await seed(messages);

    const result = await om.observe({ threadId, resourceId, messages: messages.slice(0, 2) });
    expect(result.observed).toBe(true);

    expect(hasEndMarker(await storedMessage('old-assistant'))).toBe(true);
    expect(partTypes(await storedMessage('new-assistant'))).toEqual(['text', 'tool-invocation']);

    const unobserved = await om.loadUnobservedMessages({ threadId, resourceId });
    expect(unobserved.map(message => message.id)).toEqual(['new-user', 'new-assistant']);
    expect(partTypes(unobserved[1])).toEqual(['text', 'tool-invocation']);

    const messageList = new MessageList({ threadId, resourceId });
    messageList.add(await storedMessages(), 'memory');
    filterObservedMessages({ messageList, record: result.record });
    const remaining = messageList.get.all.db();
    expect(remaining.map(message => message.id)).toEqual(['new-user', 'new-assistant']);
    expect(partTypes(remaining[1])).toEqual(['text', 'tool-invocation']);
  });

  it('live MessageList path: observing a prefix marks the prefix in the list', async () => {
    const messages = issueThread();
    await seed(messages);
    const messageList = new MessageList({ threadId, resourceId });
    messageList.add(await storedMessages(), 'memory');

    await om.observe({ threadId, resourceId, messages: messages.slice(0, 2), messageList });

    const live = messageList.get.all.db();
    expect(hasEndMarker(live.find(message => message.id === 'old-assistant'))).toBe(true);
    expect(partTypes(live.find(message => message.id === 'new-assistant'))).toEqual(['text', 'tool-invocation']);
    expect(partTypes(await storedMessage('new-assistant'))).toEqual(['text', 'tool-invocation']);
  });

  it('places the marker on the observed prefix when it is older than the newest storage page', async () => {
    const messages = conversation(30);
    await seed(messages);

    await om.observe({ threadId, resourceId, messages: messages.slice(0, 2) });

    const stored = await storedMessages();
    expect(stored.filter(hasEndMarker).map(message => message.id)).toEqual(['m1']);
  });

  it('does not mark a newer assistant with content when the observed set has no assistant', async () => {
    const messages = [textMessage('only-user', 'user', 1), assistantWithToolResult('reply', 2)];
    await seed(messages);

    const result = await om.observe({ threadId, resourceId, messages: messages.slice(0, 1) });
    expect(result.observed).toBe(true);

    expect(partTypes(await storedMessage('reply'))).toEqual(['text', 'tool-invocation']);
    const unobserved = await om.loadUnobservedMessages({ threadId, resourceId });
    expect(unobserved.map(message => message.id)).toEqual(['reply']);
  });

  it('still marks an empty assistant message that follows the observed set (step-0 seed)', async () => {
    const user = textMessage('prompt', 'user', 1);
    const seededResponse: MastraDBMessage = {
      ...textMessage('response', 'assistant', 2),
      content: { format: 2, parts: [] },
    };
    const messageList = new MessageList({ threadId, resourceId });
    messageList.add(user, 'input');
    messageList.add(seededResponse, 'response');

    await om.observe({ threadId, resourceId, messages: [user], messageList });

    const response = messageList.get.all.db().find(message => message.id === 'response');
    expect(partTypes(response)).toEqual(['data-om-observation-start', 'data-om-observation-end']);
  });

  it('finds no target when every message in the view is newer than an absent anchor', () => {
    const emptyAssistant: MastraDBMessage = {
      ...textMessage('seed', 'assistant', 5),
      content: { format: 2, parts: [] },
    };
    const index = findObservationMarkerTargetIndex([emptyAssistant, textMessage('later-user', 'user', 6)], {
      id: 'not-in-view',
      createdAt: new Date(baseTime),
    });
    expect(index).toBe(-1);
  });

  it('marks the newest assistant when observing the whole thread', async () => {
    const messages = issueThread();
    await seed(messages);

    await om.observe({ threadId, resourceId, messages });

    expect(hasEndMarker(await storedMessage('new-assistant'))).toBe(true);
    expect(hasEndMarker(await storedMessage('old-assistant'))).toBe(false);
  });
});
