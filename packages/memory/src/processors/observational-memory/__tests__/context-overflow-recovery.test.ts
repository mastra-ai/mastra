/**
 * Context-overflow recovery (#21657).
 *
 * - `observe({ force: true })` observes below the threshold without persisting a config override.
 * - When the provider rejects a request for exceeding its context window, the OM error processor
 *   activates and observes everything pending, then retries once; the retry's input step drops
 *   the observed messages from the prompt.
 */

import { APICallError } from '@internal/ai-sdk-v5';
import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { Agent, MessageList } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import { InMemoryMemory, InMemoryDB, InMemoryStore } from '@mastra/core/storage';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { Memory } from '../../../index';
import { getBufferedChunks } from '../message-utils';
import { ObservationalMemory } from '../observational-memory';
import { ObservationalMemoryProcessor } from '../processor';

const threadId = 'overflow-thread';
const resourceId = 'overflow-resource';
const observationText = '<observations>\n* Observed older conversation\n</observations>';
const baseTime = Date.now() - 10 * 60_000;

function createObserverModel(text = observationText) {
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
      warnings: [],
      content: [{ type: 'text', text }],
    }),
    doStream: async () => ({
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue({ type: 'stream-start', warnings: [] });
          controller.enqueue({ type: 'text-start', id: 'text-1' });
          controller.enqueue({ type: 'text-delta', id: 'text-1', delta: text });
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

function conversation(count: number): MastraDBMessage[] {
  return Array.from({ length: count }, (_, i) => textMessage(`m${i}`, i % 2 === 0 ? 'user' : 'assistant', i));
}

function overflowError() {
  return new APICallError({
    message: 'prompt is too long: 210345 tokens > 200000 maximum',
    url: 'https://api.example.com/v1/messages',
    requestBodyValues: {},
    statusCode: 400,
  });
}

describe('observe({ force })', () => {
  let storage: InMemoryMemory;

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

  it('observes below the threshold without persisting a config override', async () => {
    const om = new ObservationalMemory({
      storage,
      scope: 'thread',
      observation: { model: createObserverModel(), messageTokens: 100_000, bufferTokens: false },
      reflection: { model: createObserverModel(), observationTokens: 50_000 },
    });
    await storage.saveMessages({ messages: conversation(6) });
    const thresholdBefore = (await om.getStatus({ threadId, resourceId })).threshold;

    expect((await om.observe({ threadId, resourceId })).observed).toBe(false);
    const result = await om.observe({ threadId, resourceId, force: true });

    expect(result.observed).toBe(true);
    expect(result.record.activeObservations).toContain('Observed older conversation');
    expect((result.record.config as Record<string, unknown>)._overrides).toBeUndefined();
    const status = await om.getStatus({ threadId, resourceId });
    expect(status.pendingTokens).toBe(0);
    expect(status.threshold).toBe(thresholdBefore);
  });
});

describe('automatic context-overflow recovery in the OM processor (#21657)', () => {
  const question = 'What is the current question?';
  const answer = 'Here is the answer.';

  async function setup(opts: {
    observeOnContextOverflow?: boolean;
    scope?: 'thread' | 'resource';
    fail: (call: number) => Error | undefined;
  }) {
    const store = new InMemoryStore();
    const memory = new Memory({
      storage: store,
      options: {
        observationalMemory: {
          enabled: true,
          scope: opts.scope ?? 'thread',
          observation: {
            // Resource scope expects the Observer to group observations by thread.
            model: createObserverModel(
              opts.scope === 'resource'
                ? `<observations>\n<thread id="${threadId}">\n* Observed older conversation\n</thread>\n</observations>`
                : observationText,
            ),
            messageTokens: 100_000,
            bufferTokens: false,
            ...(opts.observeOnContextOverflow === undefined
              ? {}
              : { observeOnContextOverflow: opts.observeOnContextOverflow }),
          },
          reflection: { model: createObserverModel(), observationTokens: 50_000 },
        },
      },
    });
    const memoryStore = (await store.getStore('memory'))!;
    await memoryStore.saveThread({
      thread: {
        id: threadId,
        resourceId,
        title: 'thread',
        createdAt: new Date(baseTime),
        updatedAt: new Date(baseTime),
      },
    });
    await memoryStore.saveMessages({ messages: conversation(4) });

    const prompts: string[] = [];
    const call = (prompt: unknown) => {
      prompts.push(JSON.stringify(prompt));
      const error = opts.fail(prompts.length);
      if (error) throw error;
    };
    const usage = { inputTokens: 10, outputTokens: 10, totalTokens: 20 };
    const model = new MockLanguageModelV2({
      doGenerate: async ({ prompt }) => {
        call(prompt);
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage,
          content: [{ type: 'text', text: answer }],
          warnings: [],
        };
      },
      doStream: async ({ prompt }) => {
        call(prompt);
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue({ type: 'stream-start', warnings: [] });
              controller.enqueue({ type: 'text-start', id: 'text-1' });
              controller.enqueue({ type: 'text-delta', id: 'text-1', delta: answer });
              controller.enqueue({ type: 'text-end', id: 'text-1' });
              controller.enqueue({ type: 'finish', finishReason: 'stop', usage });
              controller.close();
            },
          }),
        };
      },
    });

    const agent = new Agent({
      id: 'overflow-agent',
      name: 'Overflow agent',
      instructions: 'Answer the question.',
      model,
      memory,
    });

    const memoryOptions = { memory: { thread: threadId, resource: resourceId } };
    const run = async (mode: 'generate' | 'stream' = 'generate') =>
      mode === 'generate'
        ? (await agent.generate(question, memoryOptions)).text
        : await (
            await agent.stream(question, memoryOptions)
          ).text;
    const stored = async () => (await memoryStore.listMessages({ threadId, perPage: false })).messages;
    return { run, prompts, stored };
  }

  it.each([
    ['thread', 'generate'],
    ['thread', 'stream'],
    ['resource', 'generate'],
    ['resource', 'stream'],
  ] as const)(
    'observes pending messages and retries with them dropped and the prompt kept (%s scope, %s)',
    async (scope, mode) => {
      const { run, prompts, stored } = await setup({ scope, fail: call => (call === 1 ? overflowError() : undefined) });

      expect(await run(mode)).toBe(answer);
      expect(prompts).toHaveLength(2);
      expect(prompts[0]).toContain('m0 xxx');
      expect(prompts[1]).toContain(question);
      expect(prompts[1]).not.toContain('m0 xxx');
      expect(prompts[1]).toContain('Observed older conversation');
      expect(
        (await stored()).some(
          message => message.role === 'user' && JSON.stringify(message.content).includes('current question'),
        ),
      ).toBe(true);
    },
  );

  it.each(['thread', 'resource'] as const)(
    'retries a step at most once when the provider keeps rejecting it (%s scope)',
    async scope => {
      const { run, prompts } = await setup({ scope, fail: () => overflowError() });

      await expect(run()).rejects.toThrow();
      expect(prompts).toHaveLength(2);
    },
  );

  it('recovers each step at most once, even when another pass would observe something', async () => {
    const om = new ObservationalMemory({
      storage: new InMemoryMemory({ db: new InMemoryDB() }),
      scope: 'thread',
      observation: { model: createObserverModel(), messageTokens: 100_000, bufferTokens: false },
      reflection: { model: createObserverModel(), observationTokens: 50_000 },
    });
    vi.spyOn(om, 'activate').mockResolvedValue({ activated: false, record: {} as any });
    const observe = vi.spyOn(om, 'observe').mockResolvedValue({ observed: true, record: {} as any } as any);
    const processor = new ObservationalMemoryProcessor(om, {
      getContext: async () => ({}) as any,
      persistMessages: async () => {},
    });
    const messageList = new MessageList({ threadId, resourceId });
    const state: Record<string, unknown> = {};
    const args = (stepNumber: number, retryCount: number) =>
      ({ error: overflowError(), messageList, messages: [], stepNumber, steps: [], state, retryCount }) as any;

    expect(await processor.processAPIError(args(0, 0))).toEqual({ retry: true });
    expect(await processor.processAPIError(args(0, 1))).toBeUndefined();
    expect(await processor.processAPIError(args(1, 1))).toEqual({ retry: true });
    expect(observe).toHaveBeenCalledTimes(2);
    expect(observe).toHaveBeenCalledWith(expect.objectContaining({ force: true }));
  });

  it('activates buffered observations before observing what is left', async () => {
    const storage = new InMemoryMemory({ db: new InMemoryDB() });
    await storage.saveThread({
      thread: {
        id: threadId,
        resourceId,
        title: 'thread',
        createdAt: new Date(baseTime),
        updatedAt: new Date(baseTime),
      },
    });
    const om = new ObservationalMemory({
      storage,
      scope: 'thread',
      observation: { model: createObserverModel(), messageTokens: 100_000, bufferTokens: 1_000 },
      reflection: { model: createObserverModel(), observationTokens: 50_000 },
    });
    const history = conversation(6);
    await storage.saveMessages({ messages: history.slice(0, 4) });
    await om.buffer({ threadId, resourceId, skipMinimumTokenCheck: true });
    await om.waitForBuffering(threadId, resourceId);
    expect(getBufferedChunks(await om.getRecord(threadId, resourceId))).not.toHaveLength(0);
    await storage.saveMessages({ messages: history.slice(4) });

    const processor = new ObservationalMemoryProcessor(om, {
      getContext: async () => ({}) as any,
      persistMessages: async () => {},
    });
    const messageList = new MessageList({ threadId, resourceId });
    messageList.add(history, 'memory');
    const result = await processor.processAPIError({
      error: overflowError(),
      messageList,
      messages: [],
      stepNumber: 0,
      steps: [],
      state: {},
      retryCount: 0,
    } as any);

    expect(result).toEqual({ retry: true });
    const record = await om.getRecord(threadId, resourceId);
    expect(getBufferedChunks(record)).toHaveLength(0);
    expect(record?.activeObservations).toContain('Observed older conversation');
    expect(await om.loadUnobservedMessages({ threadId, resourceId })).toEqual([]);
  });

  it('does not retry when observeOnContextOverflow is false', async () => {
    const { run, prompts } = await setup({
      observeOnContextOverflow: false,
      fail: call => (call === 1 ? overflowError() : undefined),
    });

    await expect(run()).rejects.toThrow();
    expect(prompts).toHaveLength(1);
  });

  it('does not retry errors that are not context overflow', async () => {
    const { run, prompts } = await setup({
      fail: call =>
        call === 1
          ? new APICallError({
              message: 'Incorrect API key provided',
              url: 'https://api.example.com/v1/messages',
              requestBodyValues: {},
              statusCode: 401,
            })
          : undefined,
    });

    await expect(run()).rejects.toThrow();
    expect(prompts).toHaveLength(1);
  });
});
