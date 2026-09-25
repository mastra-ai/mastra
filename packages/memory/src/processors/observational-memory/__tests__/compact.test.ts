/**
 * Forced compaction and observation-boundary marker placement (#21657).
 *
 * - `observe({ messages })` on a subset must place its boundary marker inside the
 *   observed set, never on a newer message the Observer did not see.
 * - `compact()` must compact below the observation threshold without persisting any
 *   config override, in oldest-first chunks.
 */

import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { Agent, MessageList } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import type { Processor } from '@mastra/core/processors';
import { InMemoryMemory, InMemoryDB, InMemoryStore } from '@mastra/core/storage';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { Memory } from '../../../index';
import { filterObservedMessages, findObservationMarkerTargetIndex } from '../message-utils';
import { ObservationalMemory } from '../observational-memory';
import type { ObserveHooks } from '../types';

const threadId = 'compact-thread';
const resourceId = 'compact-resource';
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

/** Token count of one user + assistant pair, as `compact()` sums it when sizing chunks. */
async function pairTokenCount(om: ObservationalMemory, messages: MastraDBMessage[]): Promise<number> {
  const counter = om.getTokenCounter();
  return (await counter.countMessageAsync(messages[0]!)) + (await counter.countMessageAsync(messages[1]!));
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

describe('compact() (#21657)', () => {
  let storage: InMemoryMemory;

  function createOM(messageTokens: number, hooks?: ObserveHooks) {
    return new ObservationalMemory({
      storage,
      hooks,
      scope: 'thread',
      observation: { model: createObserverModel(), messageTokens, bufferTokens: false },
      reflection: { model: createObserverModel(), observationTokens: 50_000 },
    });
  }

  async function storedMessages(): Promise<MastraDBMessage[]> {
    return (await storage.listMessages({ threadId, perPage: false })).messages;
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
  });

  it('compacts below the observation threshold, where observe() is a no-op, without persisting a config override', async () => {
    const onObservationStart = vi.fn();
    const om = createOM(100_000, { onObservationStart });
    const messages = conversation(6);
    await storage.saveMessages({ messages });

    const observeResult = await om.observe({ threadId, resourceId });
    expect(observeResult.observed).toBe(false);
    const thresholdBefore = (await om.getStatus({ threadId, resourceId })).threshold;

    // Default target: compact everything pending, however far below the threshold it is.
    const result = await om.compact({ threadId, resourceId });

    expect(result.compacted).toBe(true);
    expect(result.reachedTarget).toBe(true);
    expect(result.pendingTokens).toBe(0);
    expect(result.tokensCompacted).toBeGreaterThan(0);
    expect(result.record.activeObservations).toContain('Observed older conversation');
    expect((result.record.config as Record<string, unknown>)._overrides).toBeUndefined();
    expect(onObservationStart).toHaveBeenCalledWith(expect.objectContaining({ trigger: 'compact' }));

    const status = await om.getStatus({ threadId, resourceId });
    expect(status.pendingTokens).toBe(0);
    expect(status.shouldObserve).toBe(false);
    expect(status.threshold).toBe(thresholdBefore);
  });

  it('compacts oldest-first in bounded chunks and keeps the newest context unobserved', async () => {
    const om = createOM(100_000);
    const messages = conversation(8);
    await storage.saveMessages({ messages });
    const pairTokens = await pairTokenCount(om, messages);
    const startingPending = (await om.getStatus({ threadId, resourceId })).pendingTokens;

    const result = await om.compact({
      threadId,
      resourceId,
      maxChunkTokens: pairTokens,
      targetTokens: startingPending - pairTokens * 2 - 1,
    });

    expect(result.iterations).toBe(3);
    expect(result.reachedTarget).toBe(true);
    expect(result.record.observedMessageIds).toEqual(['m0', 'm1', 'm2', 'm3', 'm4', 'm5']);

    const stored = await storedMessages();
    expect(stored.filter(message => partTypes(message).includes('data-om-observation-end')).map(m => m.id)).toEqual([
      'm1',
      'm3',
      'm5',
    ]);
    const unobserved = await om.loadUnobservedMessages({ threadId, resourceId });
    expect(unobserved.map(message => message.id)).toEqual(['m6', 'm7']);
  });

  it('stops at maxIterations', async () => {
    const om = createOM(100_000);
    const messages = conversation(8);
    await storage.saveMessages({ messages });
    const pairTokens = await pairTokenCount(om, messages);

    const result = await om.compact({
      threadId,
      resourceId,
      maxChunkTokens: pairTokens,
      targetTokens: 0,
      maxIterations: 2,
    });

    expect(result.iterations).toBe(2);
    expect(result.reachedTarget).toBe(false);
    expect(result.record.observedMessageIds).toEqual(['m0', 'm1', 'm2', 'm3']);
  });

  it('is a no-op when there is nothing to compact', async () => {
    const om = createOM(100_000);

    const result = await om.compact({ threadId, resourceId, targetTokens: 0 });

    expect(result).toMatchObject({ compacted: false, activated: false, iterations: 0, tokensCompacted: 0 });
    expect(result.record.activeObservations).toBeFalsy();
  });

  it('is a no-op when pending context is already at or below the target', async () => {
    const om = createOM(100_000);
    await storage.saveMessages({ messages: conversation(4) });

    const result = await om.compact({ threadId, resourceId, targetTokens: 1_000_000 });

    expect(result).toMatchObject({ compacted: false, iterations: 0, reachedTarget: true });
  });

  it('removes compacted messages from a live MessageList so a retried call sends less context', async () => {
    const om = createOM(100_000);
    const messages = conversation(6);
    await storage.saveMessages({ messages });
    const messageList = new MessageList({ threadId, resourceId });
    messageList.add(messages, 'memory');
    const pairTokens = await pairTokenCount(om, messages);

    const result = await om.compact({
      threadId,
      resourceId,
      messageList,
      maxChunkTokens: pairTokens * 2,
      maxIterations: 1,
      targetTokens: 0,
    });

    expect(result.compacted).toBe(true);
    expect(messageList.get.all.db().map(message => message.id)).toEqual(['m4', 'm5']);
    expect(partTypes((await storedMessages()).find(message => message.id === 'm3'))).toContain(
      'data-om-observation-end',
    );
  });

  it('keeps and saves the in-flight prompt when compacting a failed request', async () => {
    const om = createOM(100_000);
    const history = conversation(4);
    await storage.saveMessages({ messages: history });
    const prompt = textMessage('prompt', 'user', 10);
    const messageList = new MessageList({ threadId, resourceId });
    messageList.add(history, 'memory');
    messageList.add(prompt, 'input');

    const result = await om.compact({ threadId, resourceId, messageList });

    expect(result.compacted).toBe(true);
    expect(messageList.get.all.db().map(message => message.id)).toEqual(['prompt']);
    expect(messageList.get.input.db().map(message => message.id)).toEqual(['prompt']);
    expect((await storedMessages()).map(message => message.id)).toEqual(['m0', 'm1', 'm2', 'm3', 'prompt']);
  });

  it('observes every pending message of the resource in one pass in resource scope', async () => {
    const om = new ObservationalMemory({
      storage,
      scope: 'resource',
      observation: { model: createObserverModel(), messageTokens: 100_000, bufferTokens: false },
      reflection: { model: createObserverModel(), observationTokens: 50_000 },
    });
    const messages = conversation(8);
    await storage.saveMessages({ messages });
    const pairTokens = await pairTokenCount(om, messages);

    const result = await om.compact({ threadId, resourceId, maxChunkTokens: pairTokens, maxIterations: 1 });

    expect(result.iterations).toBe(1);
    expect(result.pendingTokens).toBe(0);
    expect(await om.loadUnobservedMessages({ threadId, resourceId })).toEqual([]);
  });

  it('removes every message a resource-scope pass observed, not just the sized chunk', async () => {
    const om = new ObservationalMemory({
      storage,
      scope: 'resource',
      observation: { model: createObserverModel(), messageTokens: 100_000, bufferTokens: false },
      reflection: { model: createObserverModel(), observationTokens: 50_000 },
    });
    const messages = conversation(8);
    await storage.saveMessages({ messages });
    const messageList = new MessageList({ threadId, resourceId });
    messageList.add(messages, 'memory');
    // One pair fits a chunk, but a resource-scope pass observes all 8 pending messages.
    const pairTokens = await pairTokenCount(om, messages);

    const result = await om.compact({
      threadId,
      resourceId,
      messageList,
      maxChunkTokens: pairTokens,
      maxIterations: 1,
    });

    expect(result.iterations).toBe(1);
    expect(messageList.get.all.db()).toEqual([]);
  });

  it('compacts another thread of the resource when the failed thread has nothing pending', async () => {
    const om = new ObservationalMemory({
      storage,
      scope: 'resource',
      observation: { model: createObserverModel(), messageTokens: 100_000, bufferTokens: false },
      reflection: { model: createObserverModel(), observationTokens: 50_000 },
    });
    const otherThreadId = 'compact-other-thread';
    await storage.saveThread({
      thread: {
        id: otherThreadId,
        resourceId,
        title: 'other thread',
        createdAt: new Date(baseTime),
        updatedAt: new Date(baseTime),
      },
    });

    // Observe the failed thread's history first, so only the other thread is pending.
    await storage.saveMessages({ messages: conversation(2) });
    await om.compact({ threadId, resourceId });

    const other = conversation(4).map((message, index) => ({
      ...message,
      id: `other-${index}`,
      threadId: otherThreadId,
      createdAt: new Date(baseTime + 60_000 + index * 1000),
    }));
    await storage.saveMessages({ messages: other });
    expect(await om.getOtherThreadsContext(resourceId, threadId)).toBeTruthy();

    const messageList = new MessageList({ threadId, resourceId });
    messageList.add((await storage.listMessages({ threadId, perPage: false })).messages, 'memory');

    const result = await om.compact({ threadId, resourceId, messageList });

    expect(result.compacted).toBe(true);
    expect(result.pendingTokens).toBe(0);
    expect(await om.getOtherThreadsContext(resourceId, threadId)).toBeUndefined();
    expect(await om.loadUnobservedMessages({ threadId: otherThreadId, resourceId })).toEqual([]);
  });

  it('counts the resource unobserved messages once, not their formatted block too', async () => {
    const om = new ObservationalMemory({
      storage,
      scope: 'resource',
      observation: { model: createObserverModel(), messageTokens: 100_000, bufferTokens: false },
      reflection: { model: createObserverModel(), observationTokens: 50_000 },
    });
    const otherThreadId = 'compact-other-thread';
    await storage.saveThread({
      thread: {
        id: otherThreadId,
        resourceId,
        title: 'other thread',
        createdAt: new Date(baseTime),
        updatedAt: new Date(baseTime),
      },
    });
    await storage.saveMessages({ messages: conversation(2) });
    await om.compact({ threadId, resourceId });
    const other = conversation(8).map((message, index) => ({
      ...message,
      id: `other-${index}`,
      threadId: otherThreadId,
      createdAt: new Date(baseTime + 60_000 + index * 1000),
    }));
    await storage.saveMessages({ messages: other });

    const messageList = new MessageList({ threadId, resourceId });
    messageList.add((await storage.listMessages({ threadId, perPage: false })).messages, 'memory');
    const realPending = await om
      .getTokenCounter()
      .countMessagesAsync(await om.loadUnobservedMessages({ threadId, resourceId }));
    // getStatus() adds the formatted other-thread block on top of those same messages.
    const statusPending = (await om.getStatus({ threadId, resourceId })).pendingTokens;
    expect(statusPending).toBeGreaterThan(realPending);

    // No passes run, so the result reports the pending material the caller still has to deal with.
    const result = await om.compact({ threadId, resourceId, messageList, maxIterations: 0 });

    expect(result.pendingTokens).toBe(realPending);
  });
});

describe('compact() from processAPIError (#21657)', () => {
  it('retries with the user prompt kept and saved after compacting on a context-overflow error', async () => {
    const store = new InMemoryStore();
    const memory = new Memory({
      storage: store,
      options: {
        observationalMemory: {
          enabled: true,
          observation: { model: createObserverModel(), messageTokens: 100_000, bufferTokens: false },
          reflection: { model: createObserverModel(), observationTokens: 50_000 },
        },
      },
    });
    const memoryStore = await store.getStore('memory');
    await memoryStore!.saveThread({
      thread: {
        id: threadId,
        resourceId,
        title: 'thread',
        createdAt: new Date(baseTime),
        updatedAt: new Date(baseTime),
      },
    });
    await memoryStore!.saveMessages({ messages: conversation(4) });

    const prompts: string[] = [];
    let calls = 0;
    const model = new MockLanguageModelV2({
      doGenerate: async ({ prompt }) => {
        calls++;
        if (calls === 1) throw new Error('This model maximum context length exceeded');
        prompts.push(JSON.stringify(prompt));
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
          content: [{ type: 'text', text: 'Here is the answer.' }],
          warnings: [],
        };
      },
    });

    const compactResults: boolean[] = [];
    const recovery: Processor = {
      id: 'context-overflow-recovery',
      async processAPIError({ error, retryCount, messageList, requestContext }) {
        if (retryCount > 0 || !(error instanceof Error) || !/context length/.test(error.message)) return;
        const om = await memory.omEngine;
        const context = om?.getThreadContext(requestContext, messageList);
        if (!om || !context) return;
        const result = await om.compact({ ...context, messageList, requestContext });
        compactResults.push(result.compacted);
        return { retry: result.compacted };
      },
    };

    const agent = new Agent({
      id: 'compact-agent',
      name: 'Compact agent',
      instructions: 'Answer the question.',
      model,
      memory,
      errorProcessors: [recovery],
    });

    const result = await agent.generate('What is the current question?', {
      memory: { thread: threadId, resource: resourceId },
    });

    expect(result.text).toBe('Here is the answer.');
    expect(compactResults).toEqual([true]);
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toContain('What is the current question?');
    expect(prompts[0]).not.toContain('m0 xxx');
    expect(prompts[0]).toContain('Observed older conversation');

    const stored = (await memoryStore!.listMessages({ threadId, perPage: false })).messages;
    expect(
      stored.some(message => message.role === 'user' && JSON.stringify(message.content).includes('current question')),
    ).toBe(true);
  });
});
