import { MockLanguageModelV1 } from '@internal/ai-sdk-v4/test';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';

import { EventEmitterPubSub } from '../../events/event-emitter';
import { PubSub } from '../../events/pubsub';
import type { EventCallback, SubscribeOptions } from '../../events/types';
import { buildFakeOutput } from '../../harness/v1/__test-utils__/fake-output';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY, RequestContext } from '../../request-context';
import { Agent } from '../agent';
import {
  createSignal,
  dataPartToSignal,
  mastraDBMessageToSignal,
  resolveDeliveryAttributes,
  signalToDataPartFormat,
  signalToMastraDBMessage,
} from '../signals';
import { AgentThreadStreamRuntime, agentThreadStreamRuntime } from '../thread-stream-runtime';

function createTextStreamModel(responseText: string) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: responseText },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        },
      ]),
    }),
  });
}

function nextTick() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

class AsyncFanoutPubSub extends PubSub {
  #inner = new EventEmitterPubSub();

  async publish(topic: string, event: Parameters<PubSub['publish']>[1]): Promise<void> {
    await nextTick();
    await this.#inner.publish(topic, event);
  }

  async subscribe(topic: string, cb: EventCallback, options?: SubscribeOptions): Promise<void> {
    await this.#inner.subscribe(topic, cb, options);
  }

  async unsubscribe(topic: string, cb: EventCallback): Promise<void> {
    await this.#inner.unsubscribe(topic, cb);
  }

  async flush(): Promise<void> {
    await this.#inner.flush();
  }
}

class BlockingRunCompletedPubSub extends EventEmitterPubSub {
  #unblockRunCompleted!: () => void;
  readonly blockedRunCompleted = new Promise<void>(resolve => {
    this.#unblockRunCompleted = resolve;
  });
  sawRunCompleted = false;

  override async publish(topic: string, event: Parameters<PubSub['publish']>[1]): Promise<void> {
    if ((event as { data?: { type?: string } }).data?.type === 'run-completed') {
      this.sawRunCompleted = true;
      await this.blockedRunCompleted;
    }
    await super.publish(topic, event);
  }

  unblockRunCompleted() {
    this.#unblockRunCompleted();
  }
}

async function readNextRun(iterator: AsyncIterator<any>) {
  let runId: string | undefined;
  let text = '';
  const parts: any[] = [];

  while (true) {
    const next = await iterator.next();
    if (next.done) return next;

    const part = next.value;
    parts.push(part);
    runId ??= part.runId;
    if (part.type === 'text-delta') {
      text += part.payload.text;
    }
    if (part.type === 'finish' || part.type === 'error' || part.type === 'abort') {
      return { value: { runId, text, part, parts }, done: false };
    }
  }
}

async function waitForActiveRun(subscription: { activeRunId: () => string | null }, timeoutMs = 500) {
  const startedAt = Date.now();
  let runId = subscription.activeRunId();
  while (!runId) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error('Timed out waiting for active run');
    }
    await nextTick();
    runId = subscription.activeRunId();
  }
  return runId;
}

async function waitForCondition(predicate: () => boolean, timeoutMs = 500) {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error('Timed out waiting for condition');
    }
    await nextTick();
  }
}

async function withTimeout<T>(promise: Promise<T>, message: string, timeoutMs = 500): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

describe('Agent signals', () => {
  beforeEach(() => {
    agentThreadStreamRuntime.resetForTests();
  });

  it('converts signals between DB, LLM, and data part formats', () => {
    const signal = createSignal({
      id: 'signal-1',
      type: 'user-message',
      contents: 'Signal contents',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      acceptedAt: new Date('2026-01-01T00:00:00.000Z'),
      attributes: { priority: 'high' },
      metadata: { source: 'test', signal: { userProvided: true } },
    });

    expect(signal.toLLMMessage()).toEqual({
      role: 'user',
      content: '<user-message priority="high">Signal contents</user-message>',
    });
    expect(signal.toDataPart()).toEqual({
      type: 'data-user-message',
      data: {
        id: 'signal-1',
        type: 'user-message',
        contents: 'Signal contents',
        createdAt: '2026-01-01T00:00:00.000Z',
        acceptedAt: '2026-01-01T00:00:00.000Z',
        attributes: { priority: 'high' },
        metadata: { source: 'test', signal: { userProvided: true } },
      },
      transient: true,
    });

    const dbMessage = signal.toDBMessage({ threadId: 'thread-1', resourceId: 'resource-1' });
    expect(dbMessage.role).toBe('signal');
    expect(dbMessage.content.metadata).toEqual({
      signal: {
        id: 'signal-1',
        type: 'user-message',
        createdAt: '2026-01-01T00:00:00.000Z',
        acceptedAt: '2026-01-01T00:00:00.000Z',
        attributes: { priority: 'high' },
        metadata: { source: 'test', signal: { userProvided: true } },
      },
    });
    expect(signalToMastraDBMessage(signal).role).toBe('signal');
    expect(mastraDBMessageToSignal(dbMessage).contents).toBe('Signal contents');
    expect(mastraDBMessageToSignal(dbMessage).acceptedAt).toEqual(new Date('2026-01-01T00:00:00.000Z'));
    expect(mastraDBMessageToSignal(dbMessage).attributes).toEqual({ priority: 'high' });
    expect(mastraDBMessageToSignal(dbMessage).metadata).toEqual({ source: 'test', signal: { userProvided: true } });
    expect(dataPartToSignal(signalToDataPartFormat(signal)).contents).toBe('Signal contents');

    const reminderSignal = createSignal({
      id: 'signal-2',
      type: 'system-reminder',
      contents: 'Use <safe> content & continue',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      attributes: { type: 'dynamic-agents-md', path: '/tmp/AGENTS.md', enabled: true, ignored: null },
    });

    expect(reminderSignal.toLLMMessage()).toEqual({
      role: 'user',
      content:
        '<system-reminder type="dynamic-agents-md" path="/tmp/AGENTS.md" enabled="true">Use &lt;safe&gt; content &amp; continue</system-reminder>',
    });
    expect(reminderSignal.toDataPart().data.attributes).toEqual({
      type: 'dynamic-agents-md',
      path: '/tmp/AGENTS.md',
      enabled: true,
      ignored: null,
    });
    expect(mastraDBMessageToSignal(reminderSignal.toDBMessage()).attributes).toEqual({
      type: 'dynamic-agents-md',
      path: '/tmp/AGENTS.md',
      enabled: true,
      ignored: null,
    });

    const fileContents = [
      { type: 'text' as const, text: 'Review this file' },
      {
        type: 'file' as const,
        data: 'data:text/plain;base64,aGVsbG8=',
        mediaType: 'text/plain',
        filename: 'note.txt',
      },
    ];
    const fileSignal = createSignal({
      id: 'signal-3',
      type: 'user-message',
      contents: fileContents,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    expect(fileSignal.toLLMMessage()).toEqual({ role: 'user', content: fileContents });
    expect(fileSignal.toDataPart().data.contents).toEqual(fileContents);
    expect(mastraDBMessageToSignal(fileSignal.toDBMessage()).contents).toEqual(fileContents);
  });

  it('rejects invalid XML names for contextual signal markup', () => {
    expect(() =>
      createSignal({
        type: 'system reminder',
        contents: 'invalid tag name',
      }).toLLMMessage(),
    ).toThrow('Invalid signal XML tag name: system reminder');

    expect(() =>
      createSignal({
        type: 'system-reminder',
        contents: 'invalid attribute name',
        attributes: { 'bad attr': 'value' },
      }).toLLMMessage(),
    ).toThrow('Invalid signal XML attribute name: bad attr');
  });

  it('subscribes to a future thread run', async () => {
    const agent = new Agent({
      id: 'future-thread-agent',
      name: 'Future Thread Agent',
      instructions: 'Test',
      model: createTextStreamModel('future response'),
    });

    const subscription = await agent.subscribeToThread({
      threadId: 'future-thread',
      resourceId: 'future-user',
    });
    const nextRun = readNextRun(subscription.stream[Symbol.asyncIterator]());

    const stream = await agent.stream('Hello', {
      memory: { thread: 'future-thread', resource: 'future-user' },
    });

    const subscribedRun = await nextRun;
    expect(subscribedRun.value.runId).toBe(stream.runId);
    expect(subscribedRun.value.text).toBe('future response');

    subscription.unsubscribe();
  });

  it('delivers each thread run to multiple same-runtime subscribers', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const agent = { id: 'multi-subscriber-thread-agent' } as Agent<any, any, any, any>;
    const threadId = 'multi-subscriber-thread';
    const resourceId = 'multi-subscriber-user';

    const registerRun = (runNumber: number) => {
      const runId = `multi-subscriber-run-${runNumber}`;
      let finish!: () => void;
      const finished = new Promise<void>(resolve => {
        finish = resolve;
      });
      const parts = [
        { type: 'start', runId },
        { type: 'text-start', runId, payload: { id: `text-${runNumber}` } },
        { type: 'text-delta', runId, payload: { id: `text-${runNumber}`, text: `response ${runNumber}` } },
        { type: 'text-end', runId, payload: { id: `text-${runNumber}` } },
        {
          type: 'finish',
          runId,
          payload: { usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }, finishReason: 'stop' },
        },
      ];
      const fullStream = new ReadableStream({
        start(controller) {
          setTimeout(() => {
            for (const part of parts) controller.enqueue(part);
            controller.close();
            finish();
          }, 25);
        },
      });

      runtime.registerRun(
        agent,
        {
          runId,
          status: 'running',
          fullStream,
          _waitUntilFinished: () => finished,
        } as any,
        { memory: { thread: threadId, resource: resourceId } } as any,
      );
      return runId;
    };

    const firstSubscription = await runtime.subscribeToThread(agent, { threadId, resourceId });
    const secondSubscription = await runtime.subscribeToThread(agent, { threadId, resourceId });
    const firstIterator = firstSubscription.stream[Symbol.asyncIterator]();
    const secondIterator = secondSubscription.stream[Symbol.asyncIterator]();

    try {
      const firstSubscriberRun1 = readNextRun(firstIterator);
      const secondSubscriberRun1 = readNextRun(secondIterator);
      const runId1 = registerRun(1);

      const [run1a, run1b] = await Promise.all([
        withTimeout(firstSubscriberRun1, 'Timed out waiting for first subscriber to receive run 1'),
        withTimeout(secondSubscriberRun1, 'Timed out waiting for second subscriber to receive run 1'),
      ]);
      expect(run1a.value).toMatchObject({ runId: runId1, text: 'response 1' });
      expect(run1b.value).toMatchObject({ runId: runId1, text: 'response 1' });

      const firstSubscriberRun2 = readNextRun(firstIterator);
      const secondSubscriberRun2 = readNextRun(secondIterator);
      const runId2 = registerRun(2);

      const [run2a, run2b] = await Promise.all([
        withTimeout(firstSubscriberRun2, 'Timed out waiting for first subscriber to receive run 2'),
        withTimeout(secondSubscriberRun2, 'Timed out waiting for second subscriber to receive run 2'),
      ]);
      expect(run2a.value).toMatchObject({ runId: runId2, text: 'response 2' });
      expect(run2b.value).toMatchObject({ runId: runId2, text: 'response 2' });
    } finally {
      firstSubscription.unsubscribe();
      secondSubscription.unsubscribe();
    }
  });

  it('keeps multicast thread streams alive when one subscriber unsubscribes mid-run', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const agent = { id: 'subscriber-cancel-agent' } as Agent<any, any, any, any>;
    const threadId = 'subscriber-cancel-thread';
    const resourceId = 'subscriber-cancel-user';
    const runId = 'subscriber-cancel-run';
    let finish!: () => void;
    const finished = new Promise<void>(resolve => {
      finish = resolve;
    });
    const parts = [
      { type: 'start', runId },
      { type: 'text-start', runId, payload: { id: 'text-1' } },
      { type: 'text-delta', runId, payload: { id: 'text-1', text: 'still running' } },
      { type: 'text-end', runId, payload: { id: 'text-1' } },
      {
        type: 'finish',
        runId,
        payload: { usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }, finishReason: 'stop' },
      },
    ];
    const fullStream = new ReadableStream({
      async start(controller) {
        for (const part of parts) {
          await new Promise(resolve => setTimeout(resolve, 5));
          controller.enqueue(part);
        }
        controller.close();
        finish();
      },
    });

    const firstSubscription = await runtime.subscribeToThread(agent, { threadId, resourceId });
    const secondSubscription = await runtime.subscribeToThread(agent, { threadId, resourceId });
    const firstIterator = firstSubscription.stream[Symbol.asyncIterator]();
    const secondIterator = secondSubscription.stream[Symbol.asyncIterator]();

    try {
      const secondRun = readNextRun(secondIterator);
      runtime.registerRun(
        agent,
        {
          runId,
          status: 'running',
          fullStream,
          _waitUntilFinished: () => finished,
        } as any,
        { memory: { thread: threadId, resource: resourceId } } as any,
      );

      const firstPart = await withTimeout(firstIterator.next(), 'Timed out waiting for first subscriber part');
      expect(firstPart.value).toMatchObject({ type: 'start', runId });
      await firstIterator.return?.();
      firstSubscription.unsubscribe();

      await expect(
        withTimeout(secondRun, 'Timed out waiting for second subscriber to finish run'),
      ).resolves.toMatchObject({
        value: { runId, text: 'still running' },
        done: false,
      });
    } finally {
      firstSubscription.unsubscribe();
      secondSubscription.unsubscribe();
    }
  });

  it('starts an idle thread run when a user-message signal is sent', async () => {
    const agent = new Agent({
      id: 'idle-signal-agent',
      name: 'Idle Signal Agent',
      instructions: 'Test',
      model: createTextStreamModel('signal response'),
    });

    const subscription = await agent.subscribeToThread({
      threadId: 'idle-thread',
      resourceId: 'idle-user',
    });
    const nextRun = readNextRun(subscription.stream[Symbol.asyncIterator]());

    const signalResult = await agent.sendSignal(
      { type: 'user-message', contents: 'Hello from signal' },
      {
        resourceId: 'idle-user',
        threadId: 'idle-thread',
        ifIdle: { streamOptions: { memory: { resource: 'idle-user', thread: 'idle-thread' } } },
      },
    );

    const subscribedRun = await nextRun;
    expect(signalResult).toEqual(expect.objectContaining({ accepted: true, runId: subscribedRun.value.runId }));
    expect(signalResult.signal.id).toBeDefined();
    expect(subscribedRun.value.text).toBe('signal response');
    const signalPart = subscribedRun.value.parts.find((part: any) => part.type === 'data-user-message');
    expect(signalPart?.data).toMatchObject({
      id: signalResult.signal.id,
      contents: 'Hello from signal',
      acceptedAt: signalResult.signal.acceptedAt?.toISOString(),
    });
    expect(signalPart?.data.createdAt).toBeDefined();
    expect(signalPart?.transient).toBe(true);

    subscription.unsubscribe();
  });

  it('starts an idle thread run by default when a thread-targeted signal is sent', async () => {
    const agent = new Agent({
      id: 'idle-signal-without-options-agent',
      name: 'Idle Signal Without Options Agent',
      instructions: 'Test',
      model: createTextStreamModel('signal response'),
    });

    const result = await agent.sendSignal(
      { type: 'user-message', contents: 'Hello from signal' },
      { resourceId: 'idle-user', threadId: 'idle-thread' },
    );

    expect(result).toEqual(expect.objectContaining({ accepted: true }));
  });

  it('persists an idle signal without waking the agent when idle behavior is persist', async () => {
    let streamCount = 0;
    const memory = new MockMemory();
    await memory.createThread({ threadId: 'idle-persist-thread', resourceId: 'idle-persist-user' });
    const agent = new Agent({
      id: 'idle-persist-agent',
      name: 'Idle Persist Agent',
      instructions: 'Test',
      model: new MockLanguageModelV2({
        doStream: async () => {
          streamCount += 1;
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([{ type: 'stream-start', warnings: [] }]),
          };
        },
      }),
      memory,
    });

    const result = agent.sendSignal(
      { type: 'user-message', contents: 'persist without waking' },
      { resourceId: 'idle-persist-user', threadId: 'idle-persist-thread', ifIdle: { behavior: 'persist' } },
    );
    await expect(result.persisted).resolves.toBeUndefined();

    const recalled = await memory.recall({ threadId: 'idle-persist-thread', resourceId: 'idle-persist-user' });
    expect(streamCount).toBe(0);
    expect(recalled.messages).toHaveLength(1);
    expect(recalled.messages[0]?.content.metadata?.signal).toMatchObject({ type: 'user-message' });
    expect(recalled.messages[0]?.content.parts).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'text', text: 'persist without waking' })]),
    );
  });

  it('discards an active signal when active behavior is discard', async () => {
    let releaseFirst!: () => void;
    const firstFinished = new Promise<void>(resolve => {
      releaseFirst = resolve;
    });
    let streamCount = 0;
    const prompts: any[][] = [];

    const agent = new Agent({
      id: 'active-discard-agent',
      name: 'Active Discard Agent',
      instructions: 'Test',
      model: new MockLanguageModelV2({
        doStream: async ({ prompt }) => {
          streamCount += 1;
          prompts.push(prompt);
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: new ReadableStream({
              async start(controller) {
                controller.enqueue({ type: 'stream-start', warnings: [] });
                controller.enqueue({
                  type: 'response-metadata',
                  id: `discard-${streamCount}`,
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                });
                controller.enqueue({ type: 'text-start', id: 'text-1' });
                controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'first response' });
                controller.enqueue({ type: 'text-end', id: 'text-1' });
                if (streamCount === 1) {
                  await firstFinished;
                }
                controller.enqueue({
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                });
                controller.close();
              },
            }),
          };
        },
      }),
    });

    const stream = await agent.stream('Hello', {
      memory: { thread: 'active-discard-thread', resource: 'active-discard-user' },
    });
    await agent.sendSignal(
      { type: 'user-message', contents: 'discard while running' },
      { resourceId: 'active-discard-user', threadId: 'active-discard-thread', ifActive: { behavior: 'discard' } },
    );

    releaseFirst();
    await expect(stream.text).resolves.toBe('first response');
    expect(streamCount).toBe(1);
    expect(JSON.stringify(prompts)).not.toContain('discard while running');
  });

  it('routes active-run signals across runtime instances through PubSub', async () => {
    const pubsub = new EventEmitterPubSub();
    const ownerRuntime = new AgentThreadStreamRuntime();
    const senderRuntime = new AgentThreadStreamRuntime();
    const owner = new Agent({
      id: 'remote-signal-agent',
      name: 'Remote Signal Owner Agent',
      instructions: 'Test',
      model: createTextStreamModel('owner response'),
    });
    const sender = new Agent({
      id: 'remote-signal-agent',
      name: 'Remote Signal Sender Agent',
      instructions: 'Test',
      model: createTextStreamModel('sender response'),
    });
    let finishRun!: () => void;
    const output = {
      runId: 'remote-run-1',
      status: 'running',
      fullStream: (async function* () {})(),
      _waitUntilFinished: () => new Promise<void>(resolve => (finishRun = resolve)),
    } as any;

    const ownerSubscription = await ownerRuntime.subscribeToThread(
      owner,
      {
        resourceId: 'remote-resource',
        threadId: 'remote-thread',
      },
      pubsub,
    );
    const senderSubscription = await senderRuntime.subscribeToThread(
      sender,
      {
        resourceId: 'remote-resource',
        threadId: 'remote-thread',
      },
      pubsub,
    );

    ownerRuntime.registerRun(
      owner,
      output,
      { runId: 'remote-run-1', memory: { resource: 'remote-resource', thread: 'remote-thread' } } as any,
      pubsub,
    );
    await waitForCondition(() => senderSubscription.activeRunId() === 'remote-run-1');

    const result = senderRuntime.sendSignal(
      sender,
      { type: 'user-message', contents: [{ role: 'user', content: 'remote follow-up' }] },
      { resourceId: 'remote-resource', threadId: 'remote-thread' },
      pubsub,
    );

    expect(result.accepted).toBe(true);
    await waitForCondition(() => ownerRuntime.drainPendingSignals('remote-run-1', pubsub).length === 1);

    finishRun();
    ownerSubscription.unsubscribe();
    senderSubscription.unsubscribe();
  });

  it('supports cross-instance thread subscriptions through an injected PubSub without Mastra', async () => {
    const pubsub = new EventEmitterPubSub();
    const runner = new Agent({
      id: 'standalone-shared-agent',
      name: 'Standalone Shared Runner Agent',
      instructions: 'Test',
      model: createTextStreamModel('standalone shared response'),
      pubsub,
    });
    const observer = new Agent({
      id: 'standalone-shared-agent',
      name: 'Standalone Shared Observer Agent',
      instructions: 'Test',
      model: createTextStreamModel('standalone observer response'),
      pubsub,
    });

    const subscription = await observer.subscribeToThread({
      threadId: 'standalone-shared-thread',
      resourceId: 'standalone-shared-user',
    });
    const iterator = subscription.stream[Symbol.asyncIterator]();
    const firstRunPromise = readNextRun(iterator);

    const stream = await runner.stream('Hello', {
      memory: { thread: 'standalone-shared-thread', resource: 'standalone-shared-user' },
    });

    const subscribedRun = await firstRunPromise;
    expect(subscribedRun.value.runId).toBe(stream.runId);
    expect(subscribedRun.value.text).toBe('standalone shared response');

    const secondRunPromise = readNextRun(iterator);
    const signalResult = await runner.sendSignal(
      { type: 'user-message', contents: 'Hello from standalone shared signal' },
      {
        resourceId: 'standalone-shared-user',
        threadId: 'standalone-shared-thread',
        ifIdle: {
          streamOptions: { memory: { resource: 'standalone-shared-user', thread: 'standalone-shared-thread' } },
        },
      },
    );
    const signalRun = await secondRunPromise;
    expect(signalResult).toEqual(expect.objectContaining({ accepted: true, runId: signalRun.value.runId }));
    expect(signalResult.signal.id).toBeDefined();
    expect(signalRun.value.text).toBe('standalone shared response');

    subscription.unsubscribe();
  });

  it('broadcasts through async PubSub without consuming the caller fullStream', async () => {
    const pubsub = new AsyncFanoutPubSub();
    const runner = new Agent({
      id: 'async-shared-agent',
      name: 'Async Shared Runner Agent',
      instructions: 'Test',
      model: createTextStreamModel('async shared response'),
      pubsub,
    });
    const observer = new Agent({
      id: 'async-shared-agent',
      name: 'Async Shared Observer Agent',
      instructions: 'Test',
      model: createTextStreamModel('async observer response'),
      pubsub,
    });
    const subscription = await observer.subscribeToThread({
      resourceId: 'async-user',
      threadId: 'async-thread',
    });

    const stream = await runner.stream('Hello', {
      memory: { resource: 'async-user', thread: 'async-thread' },
    });

    await expect(readNextRun(stream.fullStream[Symbol.asyncIterator]())).resolves.toMatchObject({
      value: { runId: stream.runId, text: 'async shared response' },
      done: false,
    });
    await expect(readNextRun(subscription.stream[Symbol.asyncIterator]())).resolves.toMatchObject({
      value: { runId: stream.runId, text: 'async shared response' },
      done: false,
    });

    subscription.unsubscribe();
  });

  it('broadcasts async PubSub stream parts across runtime instances in order', async () => {
    const pubsub = new AsyncFanoutPubSub();
    const ownerRuntime = new AgentThreadStreamRuntime();
    const observerRuntime = new AgentThreadStreamRuntime();
    const runId = 'async-remote-run';
    const chunks = [
      { type: 'stream-start', runId, from: 'AGENT', payload: { warnings: [] } },
      { type: 'text-start', runId, from: 'AGENT', payload: { id: 'text-1' } },
      { type: 'text-delta', runId, from: 'AGENT', payload: { id: 'text-1', text: 'remote async response' } },
      { type: 'text-end', runId, from: 'AGENT', payload: { id: 'text-1' } },
      { type: 'finish', runId, from: 'AGENT', payload: {} },
    ];
    let finish!: () => void;
    const finished = new Promise<void>(resolve => {
      finish = resolve;
    });

    const subscription = await observerRuntime.subscribeToThread(
      { id: 'async-remote-observer' } as any,
      {
        resourceId: 'async-remote-user',
        threadId: 'async-remote-thread',
      },
      pubsub,
    );
    const nextRun = readNextRun(subscription.stream[Symbol.asyncIterator]());
    const output = {
      runId,
      status: 'running',
      fullStream: new ReadableStream({
        start(controller) {
          for (const chunk of chunks) controller.enqueue(chunk);
          finish();
          controller.close();
        },
      }),
      _waitUntilFinished: () => finished,
    };

    ownerRuntime.registerRun(
      { id: 'async-remote-owner' } as any,
      output as any,
      {
        runId,
        memory: { resource: 'async-remote-user', thread: 'async-remote-thread' },
      } as any,
      pubsub,
    );
    await expect(
      readNextRun((output.fullStream as ReadableStream<unknown>)[Symbol.asyncIterator]()),
    ).resolves.toMatchObject({
      value: { runId, text: 'remote async response' },
      done: false,
    });

    await expect(nextRun).resolves.toMatchObject({
      value: { runId, text: 'remote async response' },
      done: false,
    });

    subscription.unsubscribe();
  });

  it('isolates standalone agents that use different injected pubsubs', async () => {
    const runner = new Agent({
      id: 'standalone-isolated-agent',
      name: 'Standalone Isolated Runner Agent',
      instructions: 'Test',
      model: createTextStreamModel('isolated response'),
      pubsub: new EventEmitterPubSub(),
    });
    const observer = new Agent({
      id: 'standalone-isolated-agent',
      name: 'Standalone Isolated Observer Agent',
      instructions: 'Test',
      model: createTextStreamModel('isolated observer response'),
      pubsub: new EventEmitterPubSub(),
    });

    const subscription = await observer.subscribeToThread({
      threadId: 'standalone-isolated-thread',
      resourceId: 'standalone-isolated-user',
    });
    const iterator = subscription.stream[Symbol.asyncIterator]();
    const nextRunPromise = readNextRun(iterator);

    await runner.stream('Hello', {
      memory: { thread: 'standalone-isolated-thread', resource: 'standalone-isolated-user' },
    });

    const result = await Promise.race([
      nextRunPromise.then(() => 'delivered'),
      new Promise<'timeout'>(resolve => setTimeout(() => resolve('timeout'), 20)),
    ]);
    expect(result).toBe('timeout');

    subscription.unsubscribe();
    await nextRunPromise;
  });

  it('passes parent PubSub to child agent execution without mutating shared child agents', async () => {
    const pubsub = new EventEmitterPubSub();
    const childCalls: Array<{ _pubsub?: PubSub }> = [];
    const createDelegatingModel = () => {
      let callCount = 0;
      return new MockLanguageModelV2({
        doGenerate: async () => {
          callCount += 1;
          if (callCount === 1) {
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              finishReason: 'tool-calls' as const,
              usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              text: '',
              content: [
                {
                  type: 'tool-call' as const,
                  toolCallId: `call-${callCount}`,
                  toolName: 'agent-child',
                  input: JSON.stringify({ prompt: 'ask child' }),
                },
              ],
              warnings: [],
            };
          }
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop' as const,
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            text: 'parent response',
            content: [{ type: 'text' as const, text: 'parent response' }],
            warnings: [],
          };
        },
      });
    };

    class CapturingChildAgent extends Agent {
      override async generate(_messages: any, options?: any) {
        childCalls.push(options ?? {});
        return {
          text: 'child response',
          finishReason: 'stop',
          runId: 'child-run',
          response: { dbMessages: [] },
        } as any;
      }

      override async stream(_messages: any, options?: any) {
        childCalls.push(options ?? {});
        const output = buildFakeOutput({
          runId: options?.runId ?? 'child-stream-run',
          fullOutput: {
            text: 'child response',
            finishReason: 'stop',
            response: { dbMessages: [] },
          },
        }) as any;
        return {
          ...output,
          messageList: {
            get: {
              response: {
                db: () => [],
              },
            },
          },
          toolResults: Promise.resolve([]),
        } as any;
      }
    }

    const child = new CapturingChildAgent({
      id: 'standalone-child-agent',
      name: 'Standalone Child Agent',
      instructions: 'Test',
      model: createTextStreamModel('child response'),
    });
    const parent = new Agent({
      id: 'standalone-parent-agent',
      name: 'Standalone Parent Agent',
      instructions: 'Test',
      model: createDelegatingModel(),
      pubsub,
      agents: { child },
    });

    await parent.generate('delegate to child', {
      runId: 'parent-run',
      maxSteps: 3,
    });

    expect(childCalls.at(-1)?._pubsub).toBe(pubsub);
    expect(child.getPubSub()).toBeUndefined();

    const secondPubSub = new EventEmitterPubSub();
    const secondParent = new Agent({
      id: 'second-standalone-parent-agent',
      name: 'Second Standalone Parent Agent',
      instructions: 'Test',
      model: createDelegatingModel(),
      pubsub: secondPubSub,
      agents: { child },
    });

    await secondParent.generate('delegate to child again', {
      runId: 'second-parent-run',
      maxSteps: 3,
    });

    expect(childCalls.at(-1)?._pubsub).toBe(secondPubSub);
    expect(child.getPubSub()).toBeUndefined();
    expect(child.hasOwnPubSub()).toBe(false);
  });

  it('preserves an injected PubSub when forking an agent', () => {
    const pubsub = new AsyncFanoutPubSub();
    const agent = new Agent({
      id: 'forked-agent-pubsub',
      name: 'Forked Agent PubSub',
      instructions: 'Test',
      model: createTextStreamModel('forked response'),
    });

    agent.__setPubSub(pubsub);
    const fork = agent.__fork();

    expect(fork.getPubSub()).toBe(pubsub);
    expect(fork.hasOwnPubSub()).toBe(false);
  });

  it('keeps one PubSub for a stream run when the agent gets a PubSub during execution setup', async () => {
    const swappedPubSub = new EventEmitterPubSub();
    let markDefaultOptionsStarted!: () => void;
    let releaseDefaultOptions!: () => void;
    const defaultOptionsStarted = new Promise<void>(resolve => {
      markDefaultOptionsStarted = resolve;
    });
    const defaultOptionsReleased = new Promise<void>(resolve => {
      releaseDefaultOptions = resolve;
    });
    let releaseFirst!: () => void;
    const firstFinished = new Promise<void>(resolve => {
      releaseFirst = resolve;
    });
    let streamCount = 0;
    const prompts: any[][] = [];

    const runner = new Agent({
      id: 'pubsub-snapshot-agent',
      name: 'PubSub Snapshot Runner',
      instructions: 'Test',
      defaultOptions: async () => {
        markDefaultOptionsStarted();
        await defaultOptionsReleased;
        return {};
      },
      model: new MockLanguageModelV2({
        doStream: async ({ prompt }) => {
          streamCount += 1;
          const callIndex = streamCount;
          prompts.push(prompt);
          const responseText = callIndex === 1 ? 'first response' : 'signal response';
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: new ReadableStream({
              async start(controller) {
                controller.enqueue({ type: 'stream-start', warnings: [] });
                controller.enqueue({
                  type: 'response-metadata',
                  id: `id-${callIndex}`,
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                });
                controller.enqueue({ type: 'text-start', id: 'text-1' });
                controller.enqueue({ type: 'text-delta', id: 'text-1', delta: responseText });
                controller.enqueue({ type: 'text-end', id: 'text-1' });
                if (callIndex === 1) {
                  await firstFinished;
                }
                controller.enqueue({
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                });
                controller.close();
              },
            }),
          };
        },
      }),
    });
    const initialObserver = new Agent({
      id: 'pubsub-snapshot-agent',
      name: 'Initial PubSub Observer',
      instructions: 'Test',
      model: createTextStreamModel('initial observer response'),
    });
    const initialSubscription = await initialObserver.subscribeToThread({
      threadId: 'pubsub-snapshot-thread',
      resourceId: 'pubsub-snapshot-user',
    });
    const initialIterator = initialSubscription.stream[Symbol.asyncIterator]();
    const initialNextRun = readNextRun(initialIterator);

    const streamPromise = runner.stream('Hello', {
      memory: { thread: 'pubsub-snapshot-thread', resource: 'pubsub-snapshot-user' },
    });
    await defaultOptionsStarted;
    runner.__setPubSub(swappedPubSub);
    const signalResult = await runner.sendSignal(
      { type: 'user-message', contents: 'Hello while running' },
      { resourceId: 'pubsub-snapshot-user', threadId: 'pubsub-snapshot-thread' },
    );
    expect(signalResult).toEqual(expect.objectContaining({ accepted: true }));
    releaseDefaultOptions();

    const stream = await streamPromise;
    await expect(waitForActiveRun(initialSubscription)).resolves.toBe(stream.runId);
    expect(runner.getRunOutput(stream.runId)).toBe(stream);
    expect(signalResult).toEqual(expect.objectContaining({ accepted: true, runId: stream.runId }));

    releaseFirst();
    const initialRun = await Promise.race([
      initialNextRun,
      new Promise<'timeout'>(resolve => setTimeout(() => resolve('timeout'), 500)),
    ]);
    expect(initialRun).not.toBe('timeout');
    expect(initialRun).toMatchObject({
      value: { runId: stream.runId, text: 'first response' },
      done: false,
    });
    await expect(stream.text).resolves.toBe('first response');
    expect(JSON.stringify(prompts)).toContain('Hello while running');

    initialSubscription.unsubscribe();
  });

  it('keeps one PubSub for a default idle wake signal when ifIdle options are omitted', async () => {
    const swappedPubSub = new EventEmitterPubSub();
    let markDefaultOptionsStarted!: () => void;
    let releaseDefaultOptions!: () => void;
    const defaultOptionsStarted = new Promise<void>(resolve => {
      markDefaultOptionsStarted = resolve;
    });
    const defaultOptionsReleased = new Promise<void>(resolve => {
      releaseDefaultOptions = resolve;
    });

    const runner = new Agent({
      id: 'default-idle-wake-pubsub-agent',
      name: 'Default Idle Wake PubSub Agent',
      instructions: 'Test',
      defaultOptions: async () => {
        markDefaultOptionsStarted();
        await defaultOptionsReleased;
        return {};
      },
      model: createTextStreamModel('default idle wake response'),
    });
    const initialObserver = new Agent({
      id: 'default-idle-wake-pubsub-agent',
      name: 'Default Idle Wake Initial Observer',
      instructions: 'Test',
      model: createTextStreamModel('observer response'),
    });
    const initialSubscription = await initialObserver.subscribeToThread({
      threadId: 'default-idle-wake-thread',
      resourceId: 'default-idle-wake-user',
    });
    const initialNextRun = readNextRun(initialSubscription.stream[Symbol.asyncIterator]());

    const signalResult = runner.sendSignal(
      { type: 'user-message', contents: 'Wake without explicit ifIdle' },
      { resourceId: 'default-idle-wake-user', threadId: 'default-idle-wake-thread' },
    );
    expect(signalResult.output).toBeDefined();
    await defaultOptionsStarted;
    runner.__setPubSub(swappedPubSub);
    releaseDefaultOptions();

    await expect(signalResult.output).resolves.toMatchObject({ runId: signalResult.runId });
    const initialRun = await Promise.race([
      initialNextRun,
      new Promise<'timeout'>(resolve => setTimeout(() => resolve('timeout'), 500)),
    ]);
    expect(initialRun).not.toBe('timeout');
    expect(initialRun).toMatchObject({
      value: { runId: signalResult.runId, text: 'default idle wake response' },
      done: false,
    });

    initialSubscription.unsubscribe();
  });

  it('tracks idle wake PubSub from ifIdle streamOptions memory when top-level thread target is omitted', async () => {
    const swappedPubSub = new EventEmitterPubSub();
    let markDefaultOptionsStarted!: () => void;
    let releaseDefaultOptions!: () => void;
    const defaultOptionsStarted = new Promise<void>(resolve => {
      markDefaultOptionsStarted = resolve;
    });
    const defaultOptionsReleased = new Promise<void>(resolve => {
      releaseDefaultOptions = resolve;
    });

    const runner = new Agent({
      id: 'stream-options-idle-wake-pubsub-agent',
      name: 'Stream Options Idle Wake PubSub Agent',
      instructions: 'Test',
      defaultOptions: async () => {
        markDefaultOptionsStarted();
        await defaultOptionsReleased;
        return {};
      },
      model: createTextStreamModel('stream options idle wake response'),
    });

    const signalResult = runner.sendSignal({ type: 'user-message', contents: 'Wake from streamOptions target' }, {
      ifIdle: {
        streamOptions: {
          memory: { resource: 'stream-options-idle-wake-user', thread: 'stream-options-idle-wake-thread' },
        },
      },
    } as any);
    expect(signalResult.output).toBeDefined();
    await defaultOptionsStarted;
    runner.__setPubSub(swappedPubSub);
    releaseDefaultOptions();

    const output = await signalResult.output;
    expect(output).toMatchObject({ runId: signalResult.runId });
    expect(runner.getRunOutput(signalResult.runId!)).toBe(output);
  });

  it('honors an injected PubSub for streamUntilIdle when the agent PubSub changes', async () => {
    const initialPubSub = new EventEmitterPubSub();
    const swappedPubSub = new EventEmitterPubSub();
    const runner = new Agent({
      id: 'stream-until-idle-pubsub-agent',
      name: 'Stream Until Idle PubSub Agent',
      instructions: 'Test',
      model: createTextStreamModel('stream until idle response'),
    });
    runner.__setPubSub(swappedPubSub);

    const observer = new Agent({
      id: 'stream-until-idle-pubsub-agent',
      name: 'Stream Until Idle PubSub Observer',
      instructions: 'Test',
      model: createTextStreamModel('observer response'),
    });
    observer.__setPubSub(initialPubSub);
    const subscription = await observer.subscribeToThread({
      threadId: 'stream-until-idle-thread',
      resourceId: 'stream-until-idle-user',
    });
    const nextRun = readNextRun(subscription.stream[Symbol.asyncIterator]());

    const stream = await runner.streamUntilIdle('Hello', {
      memory: { thread: 'stream-until-idle-thread', resource: 'stream-until-idle-user' },
      _pubsub: initialPubSub,
    } as any);

    await expect(stream.text).resolves.toBe('stream until idle response');
    await expect(nextRun).resolves.toMatchObject({
      value: { runId: stream.runId, text: 'stream until idle response' },
      done: false,
    });

    subscription.unsubscribe();
  });

  it('honors an injected PubSub when test agents register streams through the internal hook', async () => {
    const initialPubSub = new EventEmitterPubSub();
    const swappedPubSub = new EventEmitterPubSub();
    const agent = new Agent({
      id: 'internal-register-pubsub-agent',
      name: 'Internal Register PubSub Agent',
      instructions: 'Test',
      model: createTextStreamModel('unused'),
    });
    agent.__setPubSub(swappedPubSub);
    const observer = new Agent({
      id: 'internal-register-pubsub-agent',
      name: 'Internal Register Observer',
      instructions: 'Test',
      model: createTextStreamModel('observer response'),
    });
    observer.__setPubSub(initialPubSub);
    const subscription = await observer.subscribeToThread({
      threadId: 'internal-register-thread',
      resourceId: 'internal-register-user',
    });
    const nextRun = readNextRun(subscription.stream[Symbol.asyncIterator]());
    const output = buildFakeOutput({
      runId: 'internal-register-run',
      fullOutput: { text: 'internal response', finishReason: 'stop', usage: {} },
      chunks: [
        { runId: 'internal-register-run', type: 'text-delta', payload: { text: 'internal response' } },
        { runId: 'internal-register-run', type: 'finish', payload: {} },
      ],
    });

    agent._internalRegisterStreamRun(output, {
      runId: 'internal-register-run',
      memory: { resource: 'internal-register-user', thread: 'internal-register-thread' },
      _pubsub: initialPubSub,
    } as any);
    expect(agent.getRunOutput('internal-register-run')).toBe(output);

    await expect(nextRun).resolves.toMatchObject({
      value: { runId: 'internal-register-run', text: 'internal response' },
      done: false,
    });

    subscription.unsubscribe();
  });

  it('re-reserves a pre-default stream when default options change the request-context thread target', async () => {
    let markDefaultOptionsStarted!: () => void;
    let releaseDefaultOptions!: () => void;
    const defaultOptionsStarted = new Promise<void>(resolve => {
      markDefaultOptionsStarted = resolve;
    });
    const defaultOptionsReleased = new Promise<void>(resolve => {
      releaseDefaultOptions = resolve;
    });
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_RESOURCE_ID_KEY, 'default-context-user');
    requestContext.set(MASTRA_THREAD_ID_KEY, 'default-context-thread');

    const runner = new Agent({
      id: 'default-context-reservation-agent',
      name: 'Default Context Reservation Agent',
      instructions: 'Test',
      defaultOptions: async () => {
        markDefaultOptionsStarted();
        await defaultOptionsReleased;
        return { requestContext };
      },
      model: createTextStreamModel('default context response'),
    });
    const observer = new Agent({
      id: 'default-context-reservation-agent',
      name: 'Default Context Reservation Observer',
      instructions: 'Test',
      model: createTextStreamModel('observer response'),
    });
    const subscription = await observer.subscribeToThread({
      threadId: 'default-context-thread',
      resourceId: 'default-context-user',
    });
    const nextRun = readNextRun(subscription.stream[Symbol.asyncIterator]());

    const streamPromise = runner.stream('Hello', {
      memory: { thread: 'explicit-before-default-thread', resource: 'explicit-before-default-user' },
    });
    await defaultOptionsStarted;
    releaseDefaultOptions();

    const stream = await streamPromise;
    await expect(nextRun).resolves.toMatchObject({
      value: { runId: stream.runId, text: 'default context response' },
      done: false,
    });

    subscription.unsubscribe();
  });

  it('preserves accepted setup signals when default options retarget a reserved stream', async () => {
    let markDefaultOptionsStarted!: () => void;
    let releaseDefaultOptions!: () => void;
    const defaultOptionsStarted = new Promise<void>(resolve => {
      markDefaultOptionsStarted = resolve;
    });
    const defaultOptionsReleased = new Promise<void>(resolve => {
      releaseDefaultOptions = resolve;
    });
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_RESOURCE_ID_KEY, 'retarget-signal-context-user');
    requestContext.set(MASTRA_THREAD_ID_KEY, 'retarget-signal-context-thread');
    const prompts: any[][] = [];

    const runner = new Agent({
      id: 'retarget-preserve-signal-agent',
      name: 'Retarget Preserve Signal Agent',
      instructions: 'Test',
      defaultOptions: async () => {
        markDefaultOptionsStarted();
        await defaultOptionsReleased;
        return { requestContext };
      },
      model: new MockLanguageModelV2({
        doStream: async ({ prompt }) => {
          prompts.push(prompt);
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'retarget response' },
              { type: 'text-end', id: 'text-1' },
              { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
            ]),
          };
        },
      }),
    });

    const streamPromise = runner.stream('Hello', {
      memory: { thread: 'retarget-signal-original-thread', resource: 'retarget-signal-original-user' },
    });
    await defaultOptionsStarted;
    const signalResult = runner.sendSignal(
      { type: 'user-message', contents: 'accepted before retarget' },
      { resourceId: 'retarget-signal-original-user', threadId: 'retarget-signal-original-thread' },
    );
    releaseDefaultOptions();

    const stream = await streamPromise;
    expect(signalResult.runId).toBe(stream.runId);
    await expect(stream.text).resolves.toBe('retarget response');
    expect(JSON.stringify(prompts)).toContain('accepted before retarget');
  });

  it('forgets a re-reserved PubSub mapping when stream setup fails before preparation', async () => {
    const swappedPubSub = new EventEmitterPubSub();
    let useUnsupportedModel = true;
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_RESOURCE_ID_KEY, 'failed-rereserve-context-user');
    requestContext.set(MASTRA_THREAD_ID_KEY, 'failed-rereserve-context-thread');
    const unsupportedModel = new MockLanguageModelV1({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { promptTokens: 1, completionTokens: 1 },
        text: 'unsupported',
      }),
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        stream: convertArrayToReadableStream([]),
      }),
    });
    const supportedModel = createTextStreamModel('post failure response');

    const runner = new Agent({
      id: 'failed-rereserve-pubsub-agent',
      name: 'Failed Rereserve PubSub Agent',
      instructions: 'Test',
      defaultOptions: async () => ({ requestContext }),
      model: () => (useUnsupportedModel ? unsupportedModel : supportedModel),
    });

    await expect(
      runner.stream('Hello', {
        runId: 'failed-rereserve-explicit-run',
        memory: { thread: 'failed-rereserve-original-thread', resource: 'failed-rereserve-original-user' },
      }),
    ).rejects.toThrow('not compatible with stream()');

    useUnsupportedModel = false;
    runner.__setPubSub(swappedPubSub);
    const subscription = await runner.subscribeToThread({
      threadId: 'failed-rereserve-context-thread',
      resourceId: 'failed-rereserve-context-user',
    });
    const nextRun = readNextRun(subscription.stream[Symbol.asyncIterator]());
    const stream = await runner.stream('Hello again', {
      runId: 'failed-rereserve-explicit-run',
      memory: { thread: 'failed-rereserve-context-thread', resource: 'failed-rereserve-context-user' },
    });

    expect(stream.runId).toBe('failed-rereserve-explicit-run');
    await expect(stream.text).resolves.toBe('post failure response');
    const observedRun = await Promise.race([
      nextRun,
      new Promise<'timeout'>(resolve => setTimeout(() => resolve('timeout'), 500)),
    ]);
    expect(observedRun).not.toBe('timeout');
    expect(observedRun).toMatchObject({
      value: { runId: stream.runId, text: 'post failure response' },
      done: false,
    });

    subscription.unsubscribe();
  });

  it('reserves request-context scoped streams while default options are pending', async () => {
    let markDefaultOptionsStarted!: () => void;
    let releaseDefaultOptions!: () => void;
    const defaultOptionsStarted = new Promise<void>(resolve => {
      markDefaultOptionsStarted = resolve;
    });
    const defaultOptionsReleased = new Promise<void>(resolve => {
      releaseDefaultOptions = resolve;
    });
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_RESOURCE_ID_KEY, 'request-context-reserved-user');
    requestContext.set(MASTRA_THREAD_ID_KEY, 'request-context-reserved-thread');

    const runner = new Agent({
      id: 'request-context-reserved-agent',
      name: 'Request Context Reserved Agent',
      instructions: 'Test',
      defaultOptions: async () => {
        markDefaultOptionsStarted();
        await defaultOptionsReleased;
        return {};
      },
      model: createTextStreamModel('request context reserved response'),
    });

    const streamPromise = runner.stream('Hello', { requestContext });
    await defaultOptionsStarted;
    const signalResult = runner.sendSignal(
      { type: 'user-message', contents: 'Hello while request-context stream is starting' },
      { resourceId: 'request-context-reserved-user', threadId: 'request-context-reserved-thread' },
    );
    releaseDefaultOptions();

    const stream = await streamPromise;
    expect(signalResult).toEqual(expect.objectContaining({ accepted: true, runId: stream.runId }));
  });

  it('does not expose explicit thread streams when request context preflight fails', async () => {
    const requestContext = new RequestContext();
    requestContext.set('allowed', false);

    const runner = new Agent({
      id: 'preflight-denied-reservation-agent',
      name: 'Preflight Denied Reservation Agent',
      instructions: 'Test',
      requestContextSchema: z.object({ allowed: z.literal(true) }),
      model: createTextStreamModel('unused denied response'),
    });

    await expect(
      runner.stream('Hello', {
        runId: 'preflight-denied-run',
        memory: { resource: 'preflight-denied-user', thread: 'preflight-denied-thread' },
        requestContext,
      }),
    ).rejects.toThrow('Request context validation failed');

    const signalResult = runner.sendSignal(
      { type: 'user-message', contents: 'Should not attach to denied setup run' },
      {
        resourceId: 'preflight-denied-user',
        threadId: 'preflight-denied-thread',
        ifIdle: { behavior: 'discard' },
      },
    );

    expect(signalResult.runId).not.toBe('preflight-denied-run');
  });

  it('does not attach idle signals to explicit-context streams before preflight passes', async () => {
    const requestContext = new RequestContext();
    requestContext.set('allowed', false);

    const runner = new Agent({
      id: 'explicit-preflight-denied-reservation-agent',
      name: 'Explicit Preflight Denied Reservation Agent',
      instructions: 'Test',
      requestContextSchema: z.object({ allowed: z.literal(true) }),
      model: createTextStreamModel('unused denied explicit idle response'),
    });

    const wake = runner.sendSignal(
      { type: 'user-message', contents: 'Start denied explicit-context idle stream' },
      {
        resourceId: 'explicit-preflight-denied-user',
        threadId: 'explicit-preflight-denied-thread',
        ifIdle: { behavior: 'wake', streamOptions: { requestContext } },
      },
    );
    void wake.output?.catch(() => {});

    const followUp = runner.sendSignal(
      { type: 'user-message', contents: 'Should not attach before explicit preflight passes' },
      {
        resourceId: 'explicit-preflight-denied-user',
        threadId: 'explicit-preflight-denied-thread',
        ifIdle: { behavior: 'discard' },
      },
    );

    expect(followUp.runId).not.toBe(wake.runId);
    await expect(wake.output).rejects.toThrow('Request context validation failed');
  });

  it('does not reserve explicit-context streams before preflight passes', async () => {
    let markPreflightStarted!: () => void;
    let releasePreflight!: () => void;
    const preflightStarted = new Promise<void>(resolve => {
      markPreflightStarted = resolve;
    });
    const preflightReleased = new Promise<void>(resolve => {
      releasePreflight = resolve;
    });
    const requestContext = new RequestContext();
    requestContext.set('allowed', true);

    const runner = new Agent({
      id: 'explicit-preflight-allowed-reservation-agent',
      name: 'Explicit Preflight Allowed Reservation Agent',
      instructions: 'Test',
      requestContextSchema: z.object({ allowed: z.literal(true) }).superRefine(async () => {
        markPreflightStarted();
        await preflightReleased;
      }),
      model: createTextStreamModel('allowed explicit preflight response'),
    });

    const streamPromise = runner.stream('Hello', {
      memory: { resource: 'explicit-preflight-allowed-user', thread: 'explicit-preflight-allowed-thread' },
      requestContext,
    });
    await preflightStarted;

    const followUp = runner.sendSignal(
      { type: 'user-message', contents: 'Should not attach before explicit preflight passes' },
      {
        resourceId: 'explicit-preflight-allowed-user',
        threadId: 'explicit-preflight-allowed-thread',
        ifIdle: { behavior: 'discard' },
      },
    );
    expect(() =>
      runner.sendSignal(
        { type: 'user-message', contents: 'Thread-only signal should not see a pending reservation' },
        {
          threadId: 'explicit-preflight-allowed-thread',
        },
      ),
    ).toThrow('No active agent run found for signal target');
    const explicitActivePolicyFollowUp = runner.sendSignal(
      { type: 'user-message', contents: 'Explicit active-deliver signal should not attach before preflight passes' },
      {
        resourceId: 'explicit-preflight-allowed-user',
        threadId: 'explicit-preflight-allowed-thread',
        ifActive: { behavior: 'deliver' },
        ifIdle: { behavior: 'discard' },
      },
    );
    releasePreflight();

    const stream = await streamPromise;
    expect(followUp.runId).not.toBe(stream.runId);
    expect(explicitActivePolicyFollowUp.runId).not.toBe(stream.runId);
    await expect(stream.text).resolves.toBe('allowed explicit preflight response');
  });

  it('reserves explicit-context streams after preflight passes before defaults finish', async () => {
    let markPreflightStarted!: () => void;
    let releasePreflight!: () => void;
    let markDefaultOptionsStarted!: () => void;
    let releaseDefaultOptions!: () => void;
    const preflightStarted = new Promise<void>(resolve => {
      markPreflightStarted = resolve;
    });
    const preflightReleased = new Promise<void>(resolve => {
      releasePreflight = resolve;
    });
    const defaultOptionsStarted = new Promise<void>(resolve => {
      markDefaultOptionsStarted = resolve;
    });
    const defaultOptionsReleased = new Promise<void>(resolve => {
      releaseDefaultOptions = resolve;
    });
    const requestContext = new RequestContext();
    requestContext.set('allowed', true);

    const runner = new Agent({
      id: 'explicit-preflight-defaults-pending-agent',
      name: 'Explicit Preflight Defaults Pending Agent',
      instructions: 'Test',
      requestContextSchema: z.object({ allowed: z.literal(true) }).superRefine(async () => {
        markPreflightStarted();
        await preflightReleased;
      }),
      defaultOptions: async () => {
        markDefaultOptionsStarted();
        await defaultOptionsReleased;
        return {};
      },
      model: createTextStreamModel('allowed explicit preflight defaults response'),
    });

    const streamPromise = runner.stream('Hello', {
      runId: 'explicit-preflight-defaults-run',
      memory: { resource: 'explicit-preflight-defaults-user', thread: 'explicit-preflight-defaults-thread' },
      requestContext,
    });
    await preflightStarted;

    const beforePreflightFollowUp = runner.sendSignal(
      { type: 'user-message', contents: 'Should not attach before preflight passes' },
      {
        resourceId: 'explicit-preflight-defaults-user',
        threadId: 'explicit-preflight-defaults-thread',
        ifIdle: { behavior: 'discard' },
      },
    );
    expect(beforePreflightFollowUp.runId).not.toBe('explicit-preflight-defaults-run');

    releasePreflight();
    await defaultOptionsStarted;

    const afterPreflightFollowUp = runner.sendSignal(
      { type: 'user-message', contents: 'Should attach after preflight passes while defaults are pending' },
      {
        resourceId: 'explicit-preflight-defaults-user',
        threadId: 'explicit-preflight-defaults-thread',
        ifIdle: { behavior: 'discard' },
      },
    );
    releaseDefaultOptions();

    expect(afterPreflightFollowUp.runId).toBe('explicit-preflight-defaults-run');
    const stream = await streamPromise;
    expect(stream.runId).toBe('explicit-preflight-defaults-run');
    await expect(stream.text).resolves.toBe('allowed explicit preflight defaults response');
  });

  it('keeps direct preflight stream output waiters on the captured PubSub', async () => {
    const initialPubSub = new EventEmitterPubSub();
    const swappedPubSub = new EventEmitterPubSub();
    let markPreflightStarted!: () => void;
    let releasePreflight!: () => void;
    const preflightStarted = new Promise<void>(resolve => {
      markPreflightStarted = resolve;
    });
    const preflightReleased = new Promise<void>(resolve => {
      releasePreflight = resolve;
    });
    const requestContext = new RequestContext();
    requestContext.set('allowed', true);

    const runner = new Agent({
      id: 'direct-preflight-pubsub-agent',
      name: 'Direct Preflight PubSub Agent',
      instructions: 'Test',
      requestContextSchema: z.object({ allowed: z.literal(true) }).superRefine(async () => {
        markPreflightStarted();
        await preflightReleased;
      }),
      model: createTextStreamModel('direct preflight pubsub response'),
    });
    runner.__setPubSub(initialPubSub);

    const streamPromise = runner.stream('Hello', {
      runId: 'direct-preflight-pubsub-run',
      memory: { resource: 'direct-preflight-pubsub-user', thread: 'direct-preflight-pubsub-thread' },
      requestContext,
    });
    await preflightStarted;

    runner.__setPubSub(swappedPubSub);
    const outputPromise = runner.waitForRunOutput('direct-preflight-pubsub-run');
    releasePreflight();

    const output = await Promise.race([
      outputPromise,
      new Promise<'timeout'>(resolve => setTimeout(() => resolve('timeout'), 500)),
    ]);
    expect(output).not.toBe('timeout');
    if (output === 'timeout') return;
    expect(output.runId).toBe('direct-preflight-pubsub-run');
    await expect(output.text).resolves.toBe('direct preflight pubsub response');
    await expect(streamPromise).resolves.toBe(output);
  });

  it('does not tombstone an admitted stream when a duplicate explicit run id is rejected', async () => {
    let markModelStarted!: () => void;
    let releaseModel!: () => void;
    const modelStarted = new Promise<void>(resolve => {
      markModelStarted = resolve;
    });
    const modelReleased = new Promise<void>(resolve => {
      releaseModel = resolve;
    });
    const requestContext = new RequestContext();
    requestContext.set('allowed', true);

    const runner = new Agent({
      id: 'duplicate-preflight-run-id-agent',
      name: 'Duplicate Preflight Run Id Agent',
      instructions: 'Test',
      requestContextSchema: z.object({ allowed: z.literal(true) }),
      model: new MockLanguageModelV2({
        doStream: async () => {
          markModelStarted();
          await modelReleased;
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              {
                type: 'response-metadata',
                id: 'duplicate-preflight',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'first admitted response' },
              { type: 'text-end', id: 'text-1' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              },
            ]),
          };
        },
      }),
    });

    const firstStreamPromise = runner.stream('First', {
      runId: 'duplicate-preflight-run',
      memory: { resource: 'duplicate-preflight-user', thread: 'duplicate-preflight-thread' },
      requestContext,
    });
    await modelStarted;

    await expect(
      runner.stream('Duplicate', {
        runId: 'duplicate-preflight-run',
        memory: { resource: 'duplicate-preflight-user', thread: 'duplicate-preflight-thread' },
        requestContext,
      }),
    ).rejects.toThrow('already reserved');

    releaseModel();
    const firstStream = await firstStreamPromise;
    expect(firstStream.runId).toBe('duplicate-preflight-run');
    await expect(firstStream.text).resolves.toBe('first admitted response');
  });

  it('keeps explicit-context idle reservations when no preflight boundary is configured', async () => {
    let markDefaultOptionsStarted!: () => void;
    let releaseDefaultOptions!: () => void;
    const defaultOptionsStarted = new Promise<void>(resolve => {
      markDefaultOptionsStarted = resolve;
    });
    const defaultOptionsReleased = new Promise<void>(resolve => {
      releaseDefaultOptions = resolve;
    });
    const requestContext = new RequestContext();

    const runner = new Agent({
      id: 'explicit-context-no-preflight-agent',
      name: 'Explicit Context No Preflight Agent',
      instructions: 'Test',
      defaultOptions: async () => {
        markDefaultOptionsStarted();
        await defaultOptionsReleased;
        return {};
      },
      model: createTextStreamModel('explicit context no preflight response'),
    });

    const wake = runner.sendSignal(
      { type: 'user-message', contents: 'Start explicit-context idle stream' },
      {
        resourceId: 'explicit-context-no-preflight-user',
        threadId: 'explicit-context-no-preflight-thread',
        ifIdle: { behavior: 'wake', streamOptions: { requestContext } },
      },
    );
    await defaultOptionsStarted;

    const followUp = runner.sendSignal(
      { type: 'user-message', contents: 'Should attach when preflight cannot reject' },
      {
        resourceId: 'explicit-context-no-preflight-user',
        threadId: 'explicit-context-no-preflight-thread',
        ifIdle: { behavior: 'discard' },
      },
    );
    releaseDefaultOptions();

    expect(followUp.runId).toBe(wake.runId);
    await expect(wake.output).resolves.toMatchObject({ runId: wake.runId });
  });

  it('does not attach idle signals to default-context streams before preflight passes', async () => {
    let markDefaultOptionsStarted!: () => void;
    let releaseDefaultOptions!: () => void;
    const defaultOptionsStarted = new Promise<void>(resolve => {
      markDefaultOptionsStarted = resolve;
    });
    const defaultOptionsReleased = new Promise<void>(resolve => {
      releaseDefaultOptions = resolve;
    });
    const requestContext = new RequestContext();
    requestContext.set('allowed', false);

    const runner = new Agent({
      id: 'default-preflight-denied-reservation-agent',
      name: 'Default Preflight Denied Reservation Agent',
      instructions: 'Test',
      requestContextSchema: z.object({ allowed: z.literal(true) }),
      defaultOptions: async () => {
        markDefaultOptionsStarted();
        await defaultOptionsReleased;
        return { requestContext };
      },
      model: createTextStreamModel('unused denied idle response'),
    });

    const wake = runner.sendSignal(
      { type: 'user-message', contents: 'Start denied idle stream' },
      {
        resourceId: 'default-preflight-denied-user',
        threadId: 'default-preflight-denied-thread',
      },
    );
    await defaultOptionsStarted;
    const outputPromise = runner.waitForRunOutput(wake.runId);
    void wake.output?.catch(() => {});

    const followUp = runner.sendSignal(
      { type: 'user-message', contents: 'Should not attach before preflight passes' },
      {
        resourceId: 'default-preflight-denied-user',
        threadId: 'default-preflight-denied-thread',
        ifIdle: { behavior: 'discard' },
      },
    );
    const activePolicyResult = runner.sendSignal(
      { type: 'user-message', contents: 'Should not treat preflight-pending run as active' },
      {
        resourceId: 'default-preflight-denied-user',
        threadId: 'default-preflight-denied-thread',
        ifActive: { behavior: 'discard' },
        ifIdle: { behavior: 'discard' },
      },
    );
    const plainFollowUp = runner.sendSignal(
      { type: 'user-message', contents: 'Plain signal should not attach before preflight passes' },
      {
        resourceId: 'default-preflight-denied-user',
        threadId: 'default-preflight-denied-thread',
      },
    );
    void plainFollowUp.output?.catch(() => {});
    releaseDefaultOptions();

    expect(followUp.runId).not.toBe(wake.runId);
    expect(activePolicyResult.runId).not.toBe(wake.runId);
    expect(plainFollowUp.runId).not.toBe(wake.runId);
    await expect(outputPromise).rejects.toThrow(`Agent thread run id "${wake.runId}" was rejected`);
    await expect(wake.output).rejects.toThrow('Request context validation failed');
  });

  it('keeps idle wake output waiters pending while default-context preflight is pending', async () => {
    const initialPubSub = new EventEmitterPubSub();
    const swappedPubSub = new EventEmitterPubSub();
    let markDefaultOptionsStarted!: () => void;
    let releaseDefaultOptions!: () => void;
    const defaultOptionsStarted = new Promise<void>(resolve => {
      markDefaultOptionsStarted = resolve;
    });
    const defaultOptionsReleased = new Promise<void>(resolve => {
      releaseDefaultOptions = resolve;
    });
    const requestContext = new RequestContext();
    requestContext.set('allowed', true);

    const runner = new Agent({
      id: 'default-preflight-valid-waiter-agent',
      name: 'Default Preflight Valid Waiter Agent',
      instructions: 'Test',
      requestContextSchema: z.object({ allowed: z.literal(true) }),
      defaultOptions: async () => {
        markDefaultOptionsStarted();
        await defaultOptionsReleased;
        return { requestContext };
      },
      model: createTextStreamModel('valid default preflight response'),
    });
    runner.__setPubSub(initialPubSub);

    const wake = runner.sendSignal(
      { type: 'user-message', contents: 'Start valid idle stream' },
      {
        resourceId: 'default-preflight-valid-user',
        threadId: 'default-preflight-valid-thread',
      },
    );
    await defaultOptionsStarted;

    runner.__setPubSub(swappedPubSub);
    const outputPromise = runner.waitForRunOutput(wake.runId);
    releaseDefaultOptions();

    const output = await Promise.race([
      outputPromise,
      new Promise<'timeout'>(resolve => setTimeout(() => resolve('timeout'), 500)),
    ]);
    expect(output).not.toBe('timeout');
    if (output === 'timeout') return;
    expect(output.runId).toBe(wake.runId);
    await expect(output.text).resolves.toBe('valid default preflight response');
  });

  it('reserves thread-only streams while default options are pending', async () => {
    let markDefaultOptionsStarted!: () => void;
    let releaseDefaultOptions!: () => void;
    const defaultOptionsStarted = new Promise<void>(resolve => {
      markDefaultOptionsStarted = resolve;
    });
    const defaultOptionsReleased = new Promise<void>(resolve => {
      releaseDefaultOptions = resolve;
    });

    const runner = new Agent({
      id: 'thread-only-reserved-agent',
      name: 'Thread Only Reserved Agent',
      instructions: 'Test',
      defaultOptions: async () => {
        markDefaultOptionsStarted();
        await defaultOptionsReleased;
        return {};
      },
      model: createTextStreamModel('thread only reserved response'),
    });

    const streamPromise = runner.stream('Hello', { memory: { thread: 'thread-only-reserved-thread' } });
    await defaultOptionsStarted;
    const signalResult = runner.sendSignal(
      { type: 'user-message', contents: 'Hello while thread-only stream is starting' },
      { threadId: 'thread-only-reserved-thread' },
    );
    releaseDefaultOptions();

    const stream = await streamPromise;
    expect(signalResult).toEqual(expect.objectContaining({ accepted: true, runId: stream.runId }));
  });

  it('routes thread-only signals after default options add a resource target', async () => {
    let markDefaultOptionsStarted!: () => void;
    let releaseDefaultOptions!: () => void;
    let releaseStream!: () => void;
    const defaultOptionsStarted = new Promise<void>(resolve => {
      markDefaultOptionsStarted = resolve;
    });
    const defaultOptionsReleased = new Promise<void>(resolve => {
      releaseDefaultOptions = resolve;
    });
    const streamReleased = new Promise<void>(resolve => {
      releaseStream = resolve;
    });

    const runner = new Agent({
      id: 'thread-only-retargeted-agent',
      name: 'Thread Only Retargeted Agent',
      instructions: 'Test',
      defaultOptions: async () => {
        markDefaultOptionsStarted();
        await defaultOptionsReleased;
        return { memory: { resource: 'thread-only-retargeted-user' } };
      },
      model: new MockLanguageModelV2({
        doStream: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: new ReadableStream({
            async start(controller) {
              controller.enqueue({ type: 'stream-start', warnings: [] });
              controller.enqueue({
                type: 'response-metadata',
                id: 'thread-only-retargeted-id',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              });
              controller.enqueue({ type: 'text-start', id: 'text-1' });
              controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'thread only retargeted response' });
              controller.enqueue({ type: 'text-end', id: 'text-1' });
              await streamReleased;
              controller.enqueue({
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              });
              controller.close();
            },
          }),
        }),
      }),
    });

    const streamPromise = runner.stream('Hello', { memory: { thread: 'thread-only-retargeted-thread' } });
    await defaultOptionsStarted;
    const earlySignal = runner.sendSignal(
      { type: 'user-message', contents: 'Hello before retarget' },
      { threadId: 'thread-only-retargeted-thread' },
    );
    releaseDefaultOptions();

    const stream = await streamPromise;
    const lateSignal = runner.sendSignal(
      { type: 'user-message', contents: 'Hello after retarget' },
      { threadId: 'thread-only-retargeted-thread' },
    );

    expect(earlySignal).toEqual(expect.objectContaining({ accepted: true, runId: stream.runId }));
    expect(lateSignal).toEqual(expect.objectContaining({ accepted: true, runId: stream.runId }));
    releaseStream();
    await expect(stream.text).resolves.toBe('thread only retargeted response');
  });

  it('supports cross-instance thread subscriptions through the Mastra runtime', async () => {
    const pubsub = new EventEmitterPubSub();
    const runner = new Agent({
      id: 'shared-agent',
      name: 'Shared Runner Agent',
      instructions: 'Test',
      model: createTextStreamModel('shared response'),
    });
    const observer = new Agent({
      id: 'shared-agent',
      name: 'Shared Observer Agent',
      instructions: 'Test',
      model: createTextStreamModel('observer response'),
    });
    new Mastra({ agents: { runner, observer }, logger: false, pubsub });
    expect(runner.getPubSub()).toBe(pubsub);
    expect(observer.getPubSub()).toBe(pubsub);

    const subscription = await observer.subscribeToThread({
      threadId: 'shared-thread',
      resourceId: 'shared-user',
    });
    const iterator = subscription.stream[Symbol.asyncIterator]();
    const firstRunPromise = readNextRun(iterator);

    const stream = await runner.stream('Hello', {
      memory: { thread: 'shared-thread', resource: 'shared-user' },
    });

    const subscribedRun = await firstRunPromise;
    expect(subscribedRun.value.runId).toBe(stream.runId);
    expect(subscribedRun.value.text).toBe('shared response');

    const secondRunPromise = readNextRun(iterator);
    const signalResult = await runner.sendSignal(
      { type: 'user-message', contents: 'Hello from shared signal' },
      {
        resourceId: 'shared-user',
        threadId: 'shared-thread',
        ifIdle: { streamOptions: { memory: { resource: 'shared-user', thread: 'shared-thread' } } },
      },
    );
    const signalRun = await secondRunPromise;
    expect(signalResult).toEqual(expect.objectContaining({ accepted: true, runId: signalRun.value.runId }));
    expect(signalResult.signal.id).toBeDefined();
    expect(signalRun.value.text).toBe('shared response');

    subscription.unsubscribe();
  });

  it('drains a user-message signal into the active same-agent thread run', async () => {
    let releaseFirst!: () => void;
    const firstFinished = new Promise<void>(resolve => {
      releaseFirst = resolve;
    });
    let streamCount = 0;
    const prompts: any[][] = [];

    const model = new MockLanguageModelV2({
      doStream: async ({ prompt }) => {
        streamCount += 1;
        prompts.push(prompt);
        const responseText = streamCount === 1 ? 'first response' : 'signal response';

        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: new ReadableStream({
            async start(controller) {
              controller.enqueue({ type: 'stream-start', warnings: [] });
              controller.enqueue({
                type: 'response-metadata',
                id: `id-${streamCount}`,
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              });
              controller.enqueue({ type: 'text-start', id: 'text-1' });
              controller.enqueue({ type: 'text-delta', id: 'text-1', delta: responseText });
              controller.enqueue({ type: 'text-end', id: 'text-1' });
              if (streamCount === 1) {
                await firstFinished;
              }
              controller.enqueue({
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              });
              controller.close();
            },
          }),
        };
      },
    });

    const memory = new MockMemory();
    const agent = new Agent({
      id: 'active-signal-agent',
      name: 'Active Signal Agent',
      instructions: 'Test',
      model,
      memory,
    });

    const subscription = await agent.subscribeToThread({
      threadId: 'active-thread',
      resourceId: 'active-user',
    });
    const iterator = subscription.stream[Symbol.asyncIterator]();
    const firstRunPromise = readNextRun(iterator);

    const stream = await agent.stream('Hello', {
      memory: { thread: 'active-thread', resource: 'active-user' },
    });
    await expect(waitForActiveRun(subscription)).resolves.toBe(stream.runId);

    const signalResult = await agent.sendSignal(
      { type: 'user-message', contents: 'Hello while running' },
      { resourceId: 'active-user', threadId: 'active-thread' },
    );
    expect(signalResult).toEqual(expect.objectContaining({ accepted: true, runId: stream.runId }));
    expect(signalResult.signal.id).toBeDefined();

    releaseFirst();
    const firstRun = await firstRunPromise;
    expect(firstRun.value.text).toBe('first responsesignal response');
    expect(streamCount).toBe(2);
    expect(JSON.stringify(prompts[1])).toContain('Hello while running');

    await stream.consumeStream();
    const recalled = await memory.recall({ threadId: 'active-thread', resourceId: 'active-user' });
    expect(recalled.messages.map(message => message.role)).toEqual(['user', 'assistant', 'signal', 'assistant']);
    expect(recalled.messages.map(message => message.content.parts.map(part => part.type))).toEqual([
      ['text'],
      ['text'],
      ['text'],
      ['text'],
    ]);
    expect(
      recalled.messages.map(message =>
        message.content.parts.map(part => (part.type === 'text' ? part.text : '')).join(''),
      ),
    ).toEqual(['Hello', 'first response', 'Hello while running', 'signal response']);

    subscription.unsubscribe();
  });

  it('drops a not-yet-visible current-step tool call when draining a follow-up signal', async () => {
    const prompts: any[][] = [];
    let callCount = 0;
    let continueToToolCall!: () => void;
    const waitBeforeToolCall = new Promise<void>(resolve => {
      continueToToolCall = resolve;
    });

    const model = new MockLanguageModelV2({
      doStream: async ({ prompt }) => {
        callCount += 1;
        const callIndex = callCount;
        prompts.push(prompt);

        if (callIndex === 1) {
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: new ReadableStream({
              async start(controller) {
                controller.enqueue({ type: 'stream-start', warnings: [] });
                controller.enqueue({
                  type: 'response-metadata',
                  id: 'id-1',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                });
                controller.enqueue({ type: 'text-start', id: 'text-1' });
                controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'I will check' });
                await waitBeforeToolCall;
                controller.enqueue({
                  type: 'tool-call',
                  toolCallId: 'stale-tool-call',
                  toolName: 'staleTool',
                  input: '{}',
                });
                controller.enqueue({ type: 'text-end', id: 'text-1' });
                controller.enqueue({
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                });
                controller.close();
              },
            }),
          };
        }

        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-2', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-2' },
            { type: 'text-delta', id: 'text-2', delta: 'signal response' },
            { type: 'text-end', id: 'text-2' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            },
          ]),
        };
      },
    });

    const agent = new Agent({
      id: 'tool-interjection-signal-agent',
      name: 'Tool Interjection Signal Agent',
      instructions: 'Test',
      model,
    });

    const subscription = await agent.subscribeToThread({
      threadId: 'tool-interjection-thread',
      resourceId: 'tool-interjection-user',
    });
    const iterator = subscription.stream[Symbol.asyncIterator]();
    const chunks: any[] = [];
    const runPromise = (async () => {
      while (true) {
        const next = await iterator.next();
        if (next.done) return;
        chunks.push(next.value);
        if (next.value.type === 'finish' || next.value.type === 'error' || next.value.type === 'abort') return;
      }
    })();

    const stream = await agent.stream('Hello', {
      memory: { thread: 'tool-interjection-thread', resource: 'tool-interjection-user' },
    });
    await expect(waitForActiveRun(subscription)).resolves.toBe(stream.runId);

    const signalResult = await agent.sendSignal(
      { type: 'user-message', contents: 'Actually stop and answer this instead' },
      { resourceId: 'tool-interjection-user', threadId: 'tool-interjection-thread' },
    );
    expect(signalResult).toEqual(expect.objectContaining({ accepted: true, runId: stream.runId }));

    continueToToolCall();
    await waitForCondition(() => callCount === 2);
    await runPromise;

    expect(chunks.map(chunk => chunk.type)).not.toContain('tool-call');
    expect(JSON.stringify(prompts[1])).toContain('Actually stop and answer this instead');
    expect(JSON.stringify(prompts[1])).not.toContain('stale-tool-call');

    subscription.unsubscribe();
  });

  it('interrupts an active reasoning stream to drain thread-targeted follow-up signals', async () => {
    const prompts: any[][] = [];
    let callCount = 0;
    let releaseReasoningChunk: (() => void) | undefined;
    let finishFirstCall: (() => void) | undefined;

    const model = new MockLanguageModelV2({
      doStream: async ({ prompt }) => {
        callCount += 1;
        const callIndex = callCount;
        prompts.push(prompt);

        if (callIndex === 1) {
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: new ReadableStream({
              async start(controller) {
                controller.enqueue({ type: 'stream-start', warnings: [] });
                controller.enqueue({
                  type: 'response-metadata',
                  id: 'id-1',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                });
                controller.enqueue({ type: 'reasoning-start', id: 'reasoning-1' });
                controller.enqueue({ type: 'reasoning-delta', id: 'reasoning-1', delta: 'thinking' });
                await new Promise<void>(resolve => (releaseReasoningChunk = resolve));
                controller.enqueue({ type: 'reasoning-delta', id: 'reasoning-1', delta: ' still thinking' });
                await new Promise<void>(resolve => (finishFirstCall = resolve));
                controller.enqueue({ type: 'reasoning-end', id: 'reasoning-1' });
                controller.enqueue({
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                });
                controller.close();
              },
            }),
          };
        }

        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-2', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'signal response' },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            },
          ]),
        };
      },
    });

    const agent = new Agent({
      id: 'interleaved-reasoning-signal-agent',
      name: 'Interleaved Reasoning Signal Agent',
      instructions: 'Test',
      model,
    });

    const subscription = await agent.subscribeToThread({
      threadId: 'interleaved-reasoning-thread',
      resourceId: 'interleaved-reasoning-user',
    });
    const iterator = subscription.stream[Symbol.asyncIterator]();
    const runPromise = readNextRun(iterator);

    const stream = await agent.stream('Hello', {
      memory: { thread: 'interleaved-reasoning-thread', resource: 'interleaved-reasoning-user' },
    });
    await expect(waitForActiveRun(subscription)).resolves.toBe(stream.runId);
    await waitForCondition(() => !!releaseReasoningChunk);

    const signalResult = await agent.sendSignal(
      { type: 'user-message', contents: 'Stop reasoning and answer this' },
      { resourceId: 'interleaved-reasoning-user', threadId: 'interleaved-reasoning-thread' },
    );
    expect(signalResult).toEqual(expect.objectContaining({ accepted: true, runId: stream.runId }));

    releaseReasoningChunk?.();
    await waitForCondition(() => !!finishFirstCall);
    finishFirstCall?.();
    await waitForCondition(() => callCount === 2);

    const run = await runPromise;
    expect(run.value.text).toContain('signal response');
    expect(JSON.stringify(prompts[1])).toContain('Stop reasoning and answer this');

    subscription.unsubscribe();
  });

  it('drains thread-targeted follow-up signals into an idle-started run before the run record exists', async () => {
    const prompts: any[][] = [];

    const model = new MockLanguageModelV2({
      doStream: async ({ prompt }) => {
        prompts.push(prompt);

        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'response' },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            },
          ]),
        };
      },
    });

    const agent = new Agent({
      id: 'idle-start-thread-target-agent',
      name: 'Idle Start Thread Target Agent',
      instructions: 'Test',
      model,
    });

    const subscription = await agent.subscribeToThread({
      threadId: 'idle-start-thread',
      resourceId: 'idle-start-user',
    });
    const iterator = subscription.stream[Symbol.asyncIterator]();
    const runPromise = readNextRun(iterator);

    const firstSignal = await agent.sendSignal(
      { type: 'user-message', contents: 'start idle stream' },
      {
        resourceId: 'idle-start-user',
        threadId: 'idle-start-thread',
        ifIdle: { streamOptions: { memory: { resource: 'idle-start-user', thread: 'idle-start-thread' } } },
      },
    );

    const followUp = await agent.sendSignal(
      { type: 'user-message', contents: 'thread targeted follow up' },
      {
        resourceId: 'idle-start-user',
        threadId: 'idle-start-thread',
        ifIdle: { streamOptions: { memory: { resource: 'idle-start-user', thread: 'idle-start-thread' } } },
      },
    );

    expect(followUp.runId).toBe(firstSignal.runId);

    const run = await runPromise;
    expect(run.value.runId).toBe(firstSignal.runId);
    expect(run.value.text).toBe('response');
    expect(prompts).toHaveLength(1);
    expect(JSON.stringify(prompts[0])).toContain('thread targeted follow up');

    subscription.unsubscribe();
  });

  it('preserves active interjections sent immediately after repeated idle signal-started runs', async () => {
    const releaseInitialCalls: Array<() => void> = [];
    const prompts: any[][] = [];
    let callCount = 0;

    const model = new MockLanguageModelV2({
      doStream: async ({ prompt }) => {
        callCount += 1;
        const callIndex = callCount;
        prompts.push(prompt);

        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: new ReadableStream({
            async start(controller) {
              controller.enqueue({ type: 'stream-start', warnings: [] });
              controller.enqueue({
                type: 'response-metadata',
                id: `id-${callIndex}`,
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              });
              controller.enqueue({ type: 'text-start', id: 'text-1' });
              controller.enqueue({ type: 'text-delta', id: 'text-1', delta: `response ${callIndex}` });
              controller.enqueue({ type: 'text-end', id: 'text-1' });
              if (callIndex === 1 || callIndex === 2) {
                await new Promise<void>(resolve => releaseInitialCalls.push(resolve));
              }
              controller.enqueue({
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              });
              controller.close();
            },
          }),
        };
      },
    });

    const agent = new Agent({
      id: 'repeated-idle-signal-agent',
      name: 'Repeated Idle Signal Agent',
      instructions: 'Test',
      model,
    });

    const subscription = await agent.subscribeToThread({
      threadId: 'repeated-idle-thread',
      resourceId: 'repeated-idle-user',
    });
    const iterator = subscription.stream[Symbol.asyncIterator]();

    const firstRunPromise = readNextRun(iterator);
    const firstIdle = await agent.sendSignal(
      { type: 'user-message', contents: 'start first idle stream' },
      {
        resourceId: 'repeated-idle-user',
        threadId: 'repeated-idle-thread',
        ifIdle: { streamOptions: { memory: { resource: 'repeated-idle-user', thread: 'repeated-idle-thread' } } },
      },
    );
    await agent.sendSignal(
      { type: 'user-message', contents: 'first active interjection' },
      { runId: firstIdle.runId, resourceId: 'repeated-idle-user', threadId: 'repeated-idle-thread' },
    );
    while (releaseInitialCalls.length < 1) await nextTick();
    releaseInitialCalls.shift()?.();
    const firstRun = await firstRunPromise;
    expect(firstRun.value.text).toBe('response 1');
    expect(JSON.stringify(prompts[0])).toContain('first active interjection');

    const secondRunPromise = readNextRun(iterator);
    const secondIdle = await agent.sendSignal(
      { type: 'user-message', contents: 'start second idle stream' },
      {
        resourceId: 'repeated-idle-user',
        threadId: 'repeated-idle-thread',
        ifIdle: { streamOptions: { memory: { resource: 'repeated-idle-user', thread: 'repeated-idle-thread' } } },
      },
    );
    await agent.sendSignal(
      { type: 'user-message', contents: 'second active interjection' },
      { runId: secondIdle.runId, resourceId: 'repeated-idle-user', threadId: 'repeated-idle-thread' },
    );
    while (releaseInitialCalls.length < 1) await nextTick();
    releaseInitialCalls.shift()?.();
    const secondRun = await secondRunPromise;
    expect(secondRun.value.text).toBe('response 2');
    expect(JSON.stringify(prompts[1])).toContain('second active interjection');

    subscription.unsubscribe();
  });

  it('queues a signal from another agent until the active thread run finishes', async () => {
    let releaseFirst!: () => void;
    const firstFinished = new Promise<void>(resolve => {
      releaseFirst = resolve;
    });
    let firstStarted = false;
    let secondStarted = false;

    const firstAgent = new Agent({
      id: 'cross-agent-a',
      name: 'Cross Agent A',
      instructions: 'Test',
      model: new MockLanguageModelV2({
        doStream: async () => {
          firstStarted = true;
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: new ReadableStream({
              async start(controller) {
                controller.enqueue({ type: 'stream-start', warnings: [] });
                controller.enqueue({
                  type: 'response-metadata',
                  id: 'cross-a',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                });
                controller.enqueue({ type: 'text-start', id: 'text-1' });
                controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'first response' });
                controller.enqueue({ type: 'text-end', id: 'text-1' });
                await firstFinished;
                controller.enqueue({
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                });
                controller.close();
              },
            }),
          };
        },
      }),
    });
    const secondAgent = new Agent({
      id: 'cross-agent-b',
      name: 'Cross Agent B',
      instructions: 'Test',
      model: new MockLanguageModelV2({
        doStream: async () => {
          secondStarted = true;
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'cross-b', modelId: 'mock-model-id', timestamp: new Date(0) },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'second response' },
              { type: 'text-end', id: 'text-1' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              },
            ]),
          };
        },
      }),
    });
    new Mastra({ agents: { firstAgent, secondAgent }, logger: false });

    const subscription = await firstAgent.subscribeToThread({
      threadId: 'cross-agent-thread',
      resourceId: 'cross-agent-user',
    });
    const iterator = subscription.stream[Symbol.asyncIterator]();
    const firstRunPromise = readNextRun(iterator);

    const firstStream = await firstAgent.stream('Hello', {
      memory: { thread: 'cross-agent-thread', resource: 'cross-agent-user' },
    });
    const firstText = firstStream.text;
    await nextTick();
    expect(firstStarted).toBe(true);

    const signalResult = await secondAgent.sendSignal(
      { type: 'user-message', contents: 'Hello from another agent' },
      {
        resourceId: 'cross-agent-user',
        threadId: 'cross-agent-thread',
        ifIdle: { streamOptions: { memory: { resource: 'cross-agent-user', thread: 'cross-agent-thread' } } },
      },
    );
    await nextTick();
    expect(secondStarted).toBe(false);

    releaseFirst();
    await expect(firstText).resolves.toBe('first response');
    await expect(firstRunPromise).resolves.toMatchObject({ value: { runId: firstStream.runId }, done: false });

    const secondRun = await readNextRun(iterator);
    expect(secondRun.value.runId).toBe(signalResult.runId);
    expect(secondRun.value.text).toBe('second response');
    expect(secondStarted).toBe(true);

    subscription.unsubscribe();
  });

  it('preserves caller-provided runId for idle wake signals', async () => {
    const agent = new Agent({
      id: 'caller-run-id-agent',
      name: 'Caller Run Id Agent',
      instructions: 'Test',
      model: createTextStreamModel('caller run response'),
    });
    const subscription = await agent.subscribeToThread({
      resourceId: 'caller-run-user',
      threadId: 'caller-run-thread',
    });

    const signalResult = await agent.sendSignal(
      { type: 'user-message', contents: 'wake with caller id' },
      {
        runId: 'caller-provided-run',
        resourceId: 'caller-run-user',
        threadId: 'caller-run-thread',
        ifIdle: { streamOptions: { memory: { resource: 'caller-run-user', thread: 'caller-run-thread' } } },
      },
    );

    expect(signalResult).toEqual(expect.objectContaining({ accepted: true, runId: 'caller-provided-run' }));
    await expect(readNextRun(subscription.stream[Symbol.asyncIterator]())).resolves.toMatchObject({
      value: { runId: 'caller-provided-run', text: 'caller run response' },
      done: false,
    });

    subscription.unsubscribe();
  });

  it('runs idle wake rejection cleanup when a queued idle stream fails', async () => {
    const runtime = new AgentThreadStreamRuntime();
    let finishActive!: () => void;
    const activeFinished = new Promise<void>(resolve => {
      finishActive = resolve;
    });

    const completion = runtime.registerRun(
      { id: 'active-agent' } as any,
      {
        runId: 'active-run',
        status: 'running',
        _waitUntilFinished: () => activeFinished,
      } as any,
      {
        runId: 'active-run',
        memory: { resource: 'queued-failure-user', thread: 'queued-failure-thread' },
      } as any,
    );
    const cleanup = vi.fn();
    const stream = vi.fn(async () => {
      throw new Error('queued idle stream failed');
    });

    const result = runtime.sendSignal(
      { id: 'queued-idle-agent', stream } as any,
      { type: 'user-message', contents: 'queued wake' },
      {
        resourceId: 'queued-failure-user',
        threadId: 'queued-failure-thread',
        ifIdle: {
          streamOptions: { memory: { resource: 'queued-failure-user', thread: 'queued-failure-thread' } },
          _onThreadStreamRunRejected: cleanup,
        } as any,
      },
    );

    expect(result.output).toBeUndefined();
    expect(cleanup).not.toHaveBeenCalled();

    finishActive();
    await completion;

    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(stream).toHaveBeenCalledWith(
      expect.objectContaining({ contents: 'queued wake' }),
      expect.objectContaining({
        runId: result.runId,
        memory: { resource: 'queued-failure-user', thread: 'queued-failure-thread' },
      }),
    );
  });

  it('wakes reservation waiters when a queued idle stream fails', async () => {
    const runtime = new AgentThreadStreamRuntime();
    let finishActive!: () => void;
    const activeFinished = new Promise<void>(resolve => {
      finishActive = resolve;
    });
    let rejectStream!: (error: Error) => void;

    const completion = runtime.registerRun(
      { id: 'active-agent' } as any,
      {
        runId: 'active-run',
        status: 'running',
        _waitUntilFinished: () => activeFinished,
      } as any,
      {
        runId: 'active-run',
        memory: { resource: 'queued-waiter-user', thread: 'queued-waiter-thread' },
      } as any,
    );
    const stream = vi.fn(
      () =>
        new Promise((_resolve, reject) => {
          rejectStream = reject;
        }),
    );

    runtime.sendSignal(
      { id: 'queued-idle-agent', stream } as any,
      { type: 'user-message', contents: 'queued wake' },
      {
        resourceId: 'queued-waiter-user',
        threadId: 'queued-waiter-thread',
        ifIdle: {
          streamOptions: { memory: { resource: 'queued-waiter-user', thread: 'queued-waiter-thread' } },
        } as any,
      },
    );

    finishActive();
    await nextTick();
    expect(stream).toHaveBeenCalledTimes(1);

    let waiterResolved = false;
    const waiter = runtime
      .waitForCrossAgentThreadRun(
        { id: 'other-agent' } as any,
        {
          runId: 'other-run',
          memory: { resource: 'queued-waiter-user', thread: 'queued-waiter-thread' },
        } as any,
      )
      .then(() => {
        waiterResolved = true;
      });
    await nextTick();
    expect(waiterResolved).toBe(false);

    rejectStream(new Error('queued idle stream failed'));
    await completion;
    await waiter;
    expect(waiterResolved).toBe(true);
  });

  it('does not reserve queued idle streams before preflight when reservation is deferred', async () => {
    const runtime = new AgentThreadStreamRuntime();
    let finishActive!: () => void;
    const activeFinished = new Promise<void>(resolve => {
      finishActive = resolve;
    });
    let rejectFirstStream!: (error: Error) => void;

    const completion = runtime.registerRun(
      { id: 'active-agent' } as any,
      {
        runId: 'active-run',
        status: 'running',
        _waitUntilFinished: () => activeFinished,
      } as any,
      {
        runId: 'active-run',
        memory: { resource: 'queued-deferred-user', thread: 'queued-deferred-thread' },
      } as any,
    );
    const stream = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejectFirstStream = reject;
          }),
      )
      .mockResolvedValueOnce({ runId: 'queued-deferred-second-run' })
      .mockResolvedValueOnce({ runId: 'queued-deferred-retry-run' });

    const firstResult = runtime.sendSignal(
      { id: 'queued-deferred-agent', stream } as any,
      { id: 'queued-deferred-signal', type: 'user-message', contents: 'queued deferred wake' },
      {
        resourceId: 'queued-deferred-user',
        threadId: 'queued-deferred-thread',
        ifIdle: {
          _skipThreadRunReservationBeforePreflight: true,
          streamOptions: { memory: { resource: 'queued-deferred-user', thread: 'queued-deferred-thread' } },
        } as any,
      },
    );
    runtime.sendSignal(
      { id: 'queued-deferred-agent', stream } as any,
      { type: 'user-message', contents: 'queued second deferred wake' },
      {
        resourceId: 'queued-deferred-user',
        threadId: 'queued-deferred-thread',
        ifIdle: {
          _skipThreadRunReservationBeforePreflight: true,
          streamOptions: { memory: { resource: 'queued-deferred-user', thread: 'queued-deferred-thread' } },
        } as any,
      },
    );

    finishActive();
    await nextTick();
    expect(stream).toHaveBeenCalledWith(
      expect.objectContaining({ contents: 'queued deferred wake' }),
      expect.not.objectContaining({ _threadRunReservationOwner: true }),
    );

    let waiterResolved = false;
    await runtime
      .waitForCrossAgentThreadRun(
        { id: 'other-agent' } as any,
        {
          runId: 'other-run',
          memory: { resource: 'queued-deferred-user', thread: 'queued-deferred-thread' },
        } as any,
      )
      .then(() => {
        waiterResolved = true;
      });
    expect(waiterResolved).toBe(true);

    rejectFirstStream(new Error('queued deferred idle stream failed'));
    await completion;
    expect(stream).toHaveBeenCalledWith(
      expect.objectContaining({ contents: 'queued second deferred wake' }),
      expect.not.objectContaining({ _threadRunReservationOwner: true }),
    );
    expect(stream).toHaveBeenCalledTimes(2);

    const retryResult = runtime.sendSignal(
      { id: 'queued-deferred-agent', stream } as any,
      { id: 'queued-deferred-signal', type: 'user-message', contents: 'queued deferred wake' },
      {
        resourceId: 'queued-deferred-user',
        threadId: 'queued-deferred-thread',
        ifIdle: {
          _skipThreadRunReservationBeforePreflight: true,
          streamOptions: { memory: { resource: 'queued-deferred-user', thread: 'queued-deferred-thread' } },
        } as any,
      },
    );
    expect(retryResult.runId).not.toBe(firstResult.runId);
    expect(stream).toHaveBeenCalledTimes(3);
  });

  it('aborts queued deferred idle streams after they start preflight without reservation', async () => {
    const runtime = new AgentThreadStreamRuntime();
    let finishActive!: () => void;
    const activeFinished = new Promise<void>(resolve => {
      finishActive = resolve;
    });
    let rejectStream!: (error: Error) => void;

    const completion = runtime.registerRun(
      { id: 'active-agent' } as any,
      {
        runId: 'active-run',
        status: 'running',
        _waitUntilFinished: () => activeFinished,
      } as any,
      {
        runId: 'active-run',
        memory: { resource: 'queued-deferred-abort-user', thread: 'queued-deferred-abort-thread' },
      } as any,
    );
    const stream = vi.fn(
      () =>
        new Promise((_resolve, reject) => {
          rejectStream = reject;
        }),
    );

    const result = runtime.sendSignal(
      { id: 'queued-deferred-abort-agent', stream } as any,
      { type: 'user-message', contents: 'queued deferred abort wake' },
      {
        resourceId: 'queued-deferred-abort-user',
        threadId: 'queued-deferred-abort-thread',
        ifIdle: {
          _skipThreadRunReservationBeforePreflight: true,
          streamOptions: { memory: { resource: 'queued-deferred-abort-user', thread: 'queued-deferred-abort-thread' } },
        } as any,
      },
    );

    finishActive();
    await nextTick();
    expect(stream).toHaveBeenCalledTimes(1);

    const waiter = runtime.waitForRunOutput(result.runId);
    expect(runtime.abortRun(result.runId)).toBe(true);
    await expect(waiter).rejects.toThrow('has been aborted');

    rejectStream(new Error('queued deferred abort stream stopped'));
    await completion;
  });

  it('aborts immediate deferred idle streams while preflight is pending', async () => {
    const runtime = new AgentThreadStreamRuntime();
    let rejectStream!: (error: Error) => void;
    const stream = vi.fn(
      () =>
        new Promise((_resolve, reject) => {
          rejectStream = reject;
        }),
    );

    const result = runtime.sendSignal(
      { id: 'immediate-deferred-abort-agent', stream } as any,
      { type: 'user-message', contents: 'immediate deferred abort wake' },
      {
        resourceId: 'immediate-deferred-abort-user',
        threadId: 'immediate-deferred-abort-thread',
        ifIdle: {
          _skipThreadRunReservationBeforePreflight: true,
          streamOptions: {
            memory: { resource: 'immediate-deferred-abort-user', thread: 'immediate-deferred-abort-thread' },
          },
        } as any,
      },
    );
    void result.output?.catch(() => {});
    expect(stream).toHaveBeenCalledTimes(1);

    const waiter = runtime.waitForRunOutput(result.runId);
    expect(runtime.abortRun(result.runId)).toBe(true);
    await expect(waiter).rejects.toThrow('has been aborted');

    rejectStream(new Error('immediate deferred abort stream stopped'));
    await expect(result.output).rejects.toThrow('immediate deferred abort stream stopped');
  });

  it('blocks direct reservations while a deferred idle run id is inflight', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new EventEmitterPubSub();
    let rejectStream!: (error: Error) => void;
    const stream = vi.fn(
      () =>
        new Promise((_resolve, reject) => {
          rejectStream = reject;
        }),
    );

    const result = runtime.sendSignal(
      { id: 'inflight-deferred-owner-agent', stream } as any,
      { type: 'user-message', contents: 'inflight deferred wake' },
      {
        runId: 'inflight-deferred-run',
        resourceId: 'inflight-deferred-user',
        threadId: 'inflight-deferred-thread',
        ifIdle: {
          _skipThreadRunReservationBeforePreflight: true,
          streamOptions: { memory: { resource: 'inflight-deferred-user', thread: 'inflight-deferred-thread' } },
        } as any,
      },
      pubsub,
    );
    expect(stream).toHaveBeenCalledTimes(1);

    expect(() =>
      runtime.reserveRun(
        {
          runId: 'inflight-deferred-run',
          memory: { resource: 'inflight-deferred-user', thread: 'inflight-deferred-thread' },
        } as any,
        pubsub,
      ),
    ).toThrow('already reserved');

    const duplicateOutput = buildFakeOutput({
      runId: 'inflight-deferred-run',
      fullOutput: { text: 'duplicate response', finishReason: 'stop', usage: {} },
      chunks: [{ runId: 'inflight-deferred-run', type: 'finish', payload: {} }],
    });
    expect(() =>
      runtime.registerRun(
        { id: 'duplicate-inflight-agent' } as any,
        duplicateOutput,
        {
          runId: 'inflight-deferred-run',
          memory: { resource: 'inflight-deferred-user', thread: 'inflight-deferred-thread' },
        } as any,
        pubsub,
      ),
    ).toThrow('already reserved');

    rejectStream(new Error('inflight deferred stream stopped'));
    await expect(result.output).rejects.toThrow('inflight deferred stream stopped');
  });

  it('keeps deferred idle run ids inflight when owner reservation waits for an active thread', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new EventEmitterPubSub();
    let rejectStream!: (error: Error) => void;
    const stream = vi.fn((_signal, options) => {
      runtime.registerRun(
        { id: 'inflight-owner-blocking-agent' } as any,
        {
          runId: 'inflight-owner-blocking-active-run',
          status: 'running',
          fullStream: (async function* () {})(),
          _waitUntilFinished: () => new Promise<void>(() => {}),
        } as any,
        {
          runId: 'inflight-owner-blocking-active-run',
          memory: { resource: 'inflight-owner-blocked-user', thread: 'inflight-owner-blocked-thread' },
        } as any,
        pubsub,
      );
      expect(runtime.reserveRun(options as any, pubsub, 'inflight-owner-blocked-agent')).toBeUndefined();
      return new Promise((_resolve, reject) => {
        rejectStream = reject;
      });
    });

    const result = runtime.sendSignal(
      { id: 'inflight-owner-blocked-agent', stream } as any,
      { type: 'user-message', contents: 'inflight owner blocked wake' },
      {
        runId: 'inflight-owner-blocked-run',
        resourceId: 'inflight-owner-blocked-user',
        threadId: 'inflight-owner-blocked-thread',
        ifIdle: {
          _skipThreadRunReservationBeforePreflight: true,
          streamOptions: {
            memory: { resource: 'inflight-owner-blocked-user', thread: 'inflight-owner-blocked-thread' },
          },
        } as any,
      },
      pubsub,
    );
    expect(stream).toHaveBeenCalledTimes(1);

    expect(() =>
      runtime.reserveRun(
        {
          runId: 'inflight-owner-blocked-run',
          memory: { resource: 'inflight-owner-blocked-user', thread: 'inflight-owner-blocked-thread' },
        } as any,
        pubsub,
      ),
    ).toThrow('already reserved');
    expect(runtime.abortRun(result.runId, pubsub)).toBe(true);

    rejectStream(new Error('inflight owner blocked stream stopped'));
    await expect(result.output).rejects.toThrow('inflight owner blocked stream stopped');
  });

  it('wakes reservation waiters when an immediate idle stream fails', async () => {
    const runtime = new AgentThreadStreamRuntime();
    let rejectStream!: (error: Error) => void;
    const stream = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejectStream = reject;
          }),
      )
      .mockResolvedValueOnce({ runId: 'immediate-retry-run' });

    const result = runtime.sendSignal(
      { id: 'immediate-idle-agent', stream } as any,
      { id: 'immediate-wake-signal', type: 'user-message', contents: 'immediate wake' },
      {
        resourceId: 'immediate-waiter-user',
        threadId: 'immediate-waiter-thread',
        ifIdle: {
          streamOptions: { memory: { resource: 'immediate-waiter-user', thread: 'immediate-waiter-thread' } },
        } as any,
      },
    );
    expect(stream).toHaveBeenCalledTimes(1);

    let waiterResolved = false;
    const waiter = runtime
      .waitForCrossAgentThreadRun(
        { id: 'other-agent' } as any,
        {
          runId: 'other-run',
          memory: { resource: 'immediate-waiter-user', thread: 'immediate-waiter-thread' },
        } as any,
      )
      .then(() => {
        waiterResolved = true;
      });
    await nextTick();
    expect(waiterResolved).toBe(false);

    rejectStream(new Error('immediate idle stream failed'));
    await expect(result.output).rejects.toThrow('immediate idle stream failed');
    await expect(runtime.waitForRunOutput(result.runId)).rejects.toThrow('was rejected');
    await waiter;
    expect(waiterResolved).toBe(true);

    const retryResult = runtime.sendSignal(
      { id: 'immediate-idle-agent', stream } as any,
      { id: 'immediate-wake-signal', type: 'user-message', contents: 'immediate wake' },
      {
        resourceId: 'immediate-waiter-user',
        threadId: 'immediate-waiter-thread',
        ifIdle: {
          streamOptions: { memory: { resource: 'immediate-waiter-user', thread: 'immediate-waiter-thread' } },
        } as any,
      },
    );
    expect(retryResult.runId).not.toBe(result.runId);
    expect(stream).toHaveBeenCalledTimes(2);
  });

  it('wakes waiters and drops queued signals when a reserved setup run is released', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new EventEmitterPubSub();
    const streamOptions = {
      runId: 'reserved-setup-run',
      memory: { resource: 'reserved-setup-user', thread: 'reserved-setup-thread' },
    } as any;
    const release = runtime.reserveRun(streamOptions, pubsub);
    expect(release).toBeDefined();

    let waiterResolved = false;
    const waiter = runtime
      .waitForCrossAgentThreadRun(
        { id: 'other-agent' } as any,
        {
          runId: 'reserved-setup-run',
          memory: { resource: 'reserved-setup-user', thread: 'reserved-setup-thread' },
        } as any,
        pubsub,
      )
      .then(() => {
        waiterResolved = true;
      });
    await nextTick();
    expect(waiterResolved).toBe(false);

    const signalResult = runtime.sendSignal(
      { id: 'reserved-agent' } as any,
      { type: 'user-message', contents: 'stale setup signal' },
      {
        resourceId: 'reserved-setup-user',
        threadId: 'reserved-setup-thread',
      },
      pubsub,
    );
    expect(signalResult).toEqual(expect.objectContaining({ runId: 'reserved-setup-run' }));

    release!();
    await waiter;
    expect(waiterResolved).toBe(true);

    const laterRelease = runtime.reserveRun(
      {
        runId: 'later-run',
        memory: { resource: 'reserved-setup-user', thread: 'reserved-setup-thread' },
      } as any,
      pubsub,
    );
    expect(laterRelease).toBeDefined();
    expect(runtime.drainPendingSignals('later-run', pubsub)).toEqual([]);
    const laterSignal = runtime.sendSignal(
      { id: 'reserved-agent' } as any,
      { type: 'user-message', contents: 'successor signal' },
      {
        resourceId: 'reserved-setup-user',
        threadId: 'reserved-setup-thread',
      },
      pubsub,
    );
    expect(laterSignal).toEqual(expect.objectContaining({ runId: 'later-run' }));
    expect(runtime.drainPendingSignals('later-run', pubsub)).toHaveLength(1);
    laterRelease!();
  });

  it('does not overwrite an existing run reservation with a reused run id', () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new EventEmitterPubSub();
    const release = runtime.reserveRun(
      {
        runId: 'reused-reserved-run',
        memory: { resource: 'first-reservation-user', thread: 'first-reservation-thread' },
      } as any,
      pubsub,
    );

    expect(release).toBeDefined();
    expect(() =>
      runtime.reserveRun(
        {
          runId: 'reused-reserved-run',
          memory: { resource: 'first-reservation-user', thread: 'first-reservation-thread' },
        } as any,
        pubsub,
      ),
    ).toThrow('already reserved');
    expect(() =>
      runtime.reserveRun(
        {
          runId: 'reused-reserved-run',
          memory: { resource: 'second-reservation-user', thread: 'second-reservation-thread' },
        } as any,
        pubsub,
      ),
    ).toThrow('already reserved for another thread');
    expect(
      runtime.abortThread({ resourceId: 'second-reservation-user', threadId: 'second-reservation-thread' }, pubsub),
    ).toBe(false);
    expect(
      runtime.abortThread({ resourceId: 'first-reservation-user', threadId: 'first-reservation-thread' }, pubsub),
    ).toBe(true);
  });

  it('rejects duplicate queued idle run ids before either idle wake starts', () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new EventEmitterPubSub();
    const stream = vi.fn(async () => ({
      runId: 'queued-duplicate-idle-run',
      status: 'running',
      fullStream: (async function* () {})(),
      _waitUntilFinished: async () => {},
    }));

    runtime.registerRun(
      { id: 'active-agent' } as any,
      {
        runId: 'active-before-queued-duplicate',
        status: 'running',
        _waitUntilFinished: () => new Promise<any>(() => {}),
      } as any,
      {
        runId: 'active-before-queued-duplicate',
        memory: { resource: 'queued-duplicate-user', thread: 'queued-duplicate-thread' },
      } as any,
      pubsub,
    );

    const target = {
      runId: 'queued-duplicate-idle-run',
      resourceId: 'queued-duplicate-user',
      threadId: 'queued-duplicate-thread',
      ifIdle: {
        streamOptions: { memory: { resource: 'queued-duplicate-user', thread: 'queued-duplicate-thread' } },
      },
    } as any;

    expect(
      runtime.sendSignal(
        { id: 'queued-duplicate-agent', stream } as any,
        { type: 'user-message', contents: 'first queued idle' },
        target,
        pubsub,
      ),
    ).toEqual(expect.objectContaining({ accepted: true, runId: 'queued-duplicate-idle-run' }));
    expect(() =>
      runtime.sendSignal(
        { id: 'queued-duplicate-agent', stream } as any,
        { type: 'user-message', contents: 'second queued idle' },
        target,
        pubsub,
      ),
    ).toThrow('already reserved');
    expect(() =>
      runtime.reserveRun(
        {
          runId: 'queued-duplicate-idle-run',
          memory: { resource: 'queued-duplicate-user', thread: 'queued-duplicate-thread' },
        } as any,
        pubsub,
      ),
    ).toThrow('already reserved');
    expect(stream).not.toHaveBeenCalled();
  });

  it('clears caller-signal idempotency when a queued idle run is aborted', () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new EventEmitterPubSub();
    const stream = vi.fn(async () => ({
      runId: 'unused-queued-idempotency-run',
      status: 'running',
      fullStream: (async function* () {})(),
      _waitUntilFinished: async () => {},
    }));

    runtime.registerRun(
      { id: 'active-agent' } as any,
      {
        runId: 'active-before-queued-idempotency',
        status: 'running',
        _waitUntilFinished: () => new Promise<any>(() => {}),
      } as any,
      {
        runId: 'active-before-queued-idempotency',
        memory: { resource: 'queued-idempotency-user', thread: 'queued-idempotency-thread' },
      } as any,
      pubsub,
    );

    const target = {
      resourceId: 'queued-idempotency-user',
      threadId: 'queued-idempotency-thread',
      ifIdle: {
        streamOptions: { memory: { resource: 'queued-idempotency-user', thread: 'queued-idempotency-thread' } },
      },
    } as any;
    const signal = { id: 'caller-signal-id', type: 'user-message', contents: 'retry queued idle' } as any;

    const first = runtime.sendSignal({ id: 'queued-idempotency-agent', stream } as any, signal, target, pubsub);
    expect(runtime.abortRun(first.runId, pubsub)).toBe(true);
    const second = runtime.sendSignal({ id: 'queued-idempotency-agent', stream } as any, signal, target, pubsub);

    expect(second.runId).not.toBe(first.runId);
    expect(stream).not.toHaveBeenCalled();
  });

  it('rejects run-output waiters when a queued idle run is aborted before it starts', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new EventEmitterPubSub();

    runtime.registerRun(
      { id: 'active-agent' } as any,
      {
        runId: 'active-before-waiter-abort',
        status: 'running',
        fullStream: (async function* () {})(),
        _waitUntilFinished: () => new Promise<any>(() => {}),
      } as any,
      {
        runId: 'active-before-waiter-abort',
        memory: { resource: 'queued-waiter-abort-user', thread: 'queued-waiter-abort-thread' },
      } as any,
      pubsub,
    );

    const result = runtime.sendSignal(
      { id: 'queued-waiter-abort-agent', stream: vi.fn() } as any,
      { type: 'user-message', contents: 'queued waiter abort' },
      {
        resourceId: 'queued-waiter-abort-user',
        threadId: 'queued-waiter-abort-thread',
        ifIdle: {
          streamOptions: { memory: { resource: 'queued-waiter-abort-user', thread: 'queued-waiter-abort-thread' } },
        } as any,
      },
      pubsub,
    );
    const waiter = runtime.waitForRunOutput(result.runId, pubsub);

    expect(runtime.abortRun(result.runId, pubsub)).toBe(true);
    await expect(waiter).rejects.toThrow('has been aborted');
  });

  it('does not tombstone unknown run ids when abort returns false', () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new EventEmitterPubSub();

    expect(runtime.abortRun('unknown-abort-run', pubsub)).toBe(false);
    const output = buildFakeOutput({
      runId: 'unknown-abort-run',
      fullOutput: { text: 'not aborted', finishReason: 'stop', usage: {} },
      chunks: [{ runId: 'unknown-abort-run', type: 'finish', payload: {} }],
    });
    expect(() =>
      runtime.registerRun(
        { id: 'unknown-abort-agent' } as any,
        output,
        {
          runId: 'unknown-abort-run',
          memory: { resource: 'unknown-abort-user', thread: 'unknown-abort-thread' },
        } as any,
        pubsub,
      ),
    ).not.toThrow();
  });

  it('aborts a reserved setup run before stream preparation', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new EventEmitterPubSub();
    runtime.reserveRun(
      {
        runId: 'reserved-abort-run',
        memory: { resource: 'reserved-abort-user', thread: 'reserved-abort-thread' },
      } as any,
      pubsub,
    );

    expect(runtime.abortRun('reserved-abort-run', pubsub)).toBe(true);
    await expect(
      runtime.prepareRunOptions(
        {
          runId: 'reserved-abort-run',
          memory: { resource: 'reserved-abort-user', thread: 'reserved-abort-thread' },
        } as any,
        pubsub,
      ),
    ).rejects.toThrow('Agent thread run id "reserved-abort-run" has been aborted');
  });

  it('rejects run-output waiters and releases a prepared setup run on abort before registration', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new EventEmitterPubSub();
    runtime.reserveRun(
      {
        runId: 'prepared-setup-abort-run',
        memory: { resource: 'prepared-setup-abort-user', thread: 'prepared-setup-abort-thread' },
      } as any,
      pubsub,
    );
    await runtime.prepareRunOptions(
      {
        runId: 'prepared-setup-abort-run',
        memory: { resource: 'prepared-setup-abort-user', thread: 'prepared-setup-abort-thread' },
      } as any,
      pubsub,
    );
    const waiter = runtime.waitForRunOutput('prepared-setup-abort-run', pubsub);

    expect(runtime.abortRun('prepared-setup-abort-run', pubsub)).toBe(true);
    await expect(waiter).rejects.toThrow('has been aborted');
    const successorRelease = runtime.reserveRun(
      {
        runId: 'prepared-setup-successor-run',
        memory: { resource: 'prepared-setup-abort-user', thread: 'prepared-setup-abort-thread' },
      } as any,
      pubsub,
    );
    expect(successorRelease).toBeDefined();
    const lateOutput = buildFakeOutput({
      runId: 'prepared-setup-abort-run',
      fullOutput: { text: 'late aborted response', finishReason: 'stop', usage: {} },
      chunks: [{ runId: 'prepared-setup-abort-run', type: 'finish', payload: {} }],
    });
    expect(() =>
      runtime.registerRun(
        { id: 'prepared-setup-abort-agent' } as any,
        lateOutput,
        {
          runId: 'prepared-setup-abort-run',
          memory: { resource: 'prepared-setup-abort-user', thread: 'prepared-setup-abort-thread' },
        } as any,
        pubsub,
      ),
    ).toThrow('has been aborted');
  });

  it('keeps run-output waiters when a reservation is released for non-terminal retargeting', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new EventEmitterPubSub();
    runtime.reserveRun(
      {
        runId: 'retarget-waiter-run',
        memory: { resource: 'retarget-waiter-old-user', thread: 'retarget-waiter-old-thread' },
      } as any,
      pubsub,
    );
    const waiter = runtime.waitForRunOutput('retarget-waiter-run', pubsub);
    let waiterRejected = false;
    void waiter.catch(() => {
      waiterRejected = true;
    });

    expect(
      runtime.releaseRunReservation('retarget-waiter-run', pubsub, { cleanupPrepared: true, clearAbort: true }),
    ).toBe(true);
    await nextTick();
    expect(waiterRejected).toBe(false);

    runtime.reserveRun(
      {
        runId: 'retarget-waiter-run',
        memory: { resource: 'retarget-waiter-new-user', thread: 'retarget-waiter-new-thread' },
      } as any,
      pubsub,
    );
    const output = buildFakeOutput({
      runId: 'retarget-waiter-run',
      fullOutput: { text: 'retarget waiter response', finishReason: 'stop', usage: {} },
      chunks: [{ runId: 'retarget-waiter-run', type: 'finish', payload: {} }],
    });
    runtime.registerRun(
      { id: 'retarget-waiter-agent' } as any,
      output,
      {
        runId: 'retarget-waiter-run',
        memory: { resource: 'retarget-waiter-new-user', thread: 'retarget-waiter-new-thread' },
      } as any,
      pubsub,
    );

    await expect(waiter).resolves.toBe(output);
  });

  it('cancels run-output waiters without poisoning a later registration', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new EventEmitterPubSub();
    runtime.reserveRun(
      {
        runId: 'abortable-waiter-run',
        memory: { resource: 'abortable-waiter-user', thread: 'abortable-waiter-thread' },
      } as any,
      pubsub,
    );
    const waitAbortController = new AbortController();
    const waiter = runtime.waitForRunOutput('abortable-waiter-run', pubsub, waitAbortController.signal);

    waitAbortController.abort(new Error('stop waiting'));
    await expect(waiter).rejects.toThrow('stop waiting');

    const output = buildFakeOutput({
      runId: 'abortable-waiter-run',
      fullOutput: { text: 'abortable waiter response', finishReason: 'stop', usage: {} },
      chunks: [{ runId: 'abortable-waiter-run', type: 'finish', payload: {} }],
    });
    runtime.registerRun(
      { id: 'abortable-waiter-agent' } as any,
      output,
      {
        runId: 'abortable-waiter-run',
        memory: { resource: 'abortable-waiter-user', thread: 'abortable-waiter-thread' },
      } as any,
      pubsub,
    );

    await expect(runtime.waitForRunOutput('abortable-waiter-run', pubsub)).resolves.toBe(output);
  });

  it('keeps rejected run ids tombstoned when retry cannot reserve an active thread', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new EventEmitterPubSub();
    const releaseRejected = runtime.reserveRun(
      {
        runId: 'rejected-retry-run',
        memory: { resource: 'rejected-retry-user', thread: 'rejected-retry-thread' },
      } as any,
      pubsub,
    );
    const rejectedWaiter = runtime.waitForRunOutput('rejected-retry-run', pubsub);
    releaseRejected!();
    await expect(rejectedWaiter).rejects.toThrow('was rejected');
    runtime.registerRun(
      { id: 'active-retry-agent' } as any,
      {
        runId: 'active-retry-run',
        status: 'running',
        fullStream: (async function* () {})(),
        _waitUntilFinished: () => new Promise<void>(() => {}),
      } as any,
      {
        runId: 'active-retry-run',
        memory: { resource: 'rejected-retry-user', thread: 'rejected-retry-thread' },
      } as any,
      pubsub,
    );

    expect(
      runtime.reserveRun(
        {
          runId: 'rejected-retry-run',
          memory: { resource: 'rejected-retry-user', thread: 'rejected-retry-thread' },
        } as any,
        pubsub,
      ),
    ).toBeUndefined();

    const staleOutput = buildFakeOutput({
      runId: 'rejected-retry-run',
      fullOutput: { text: 'stale rejected response', finishReason: 'stop', usage: {} },
      chunks: [{ runId: 'rejected-retry-run', type: 'finish', payload: {} }],
    });
    expect(() =>
      runtime.registerRun(
        { id: 'stale-retry-agent' } as any,
        staleOutput,
        {
          runId: 'rejected-retry-run',
          memory: { resource: 'rejected-retry-user', thread: 'rejected-retry-thread' },
        } as any,
        pubsub,
      ),
    ).toThrow('was rejected');
  });

  it('starts queued idle wakes left behind when a reservation is retargeted', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new EventEmitterPubSub();
    runtime.reserveRun(
      {
        runId: 'retarget-with-idle-run',
        memory: { resource: 'retarget-idle-old-user', thread: 'retarget-idle-old-thread' },
      } as any,
      pubsub,
      'retarget-owner-agent',
    );
    const stream = vi.fn(async () => ({
      runId: 'retarget-queued-idle-run',
      status: 'running',
      fullStream: (async function* () {})(),
      _waitUntilFinished: async () => {},
    }));

    const result = runtime.sendSignal(
      { id: 'retarget-queued-idle-agent', stream } as any,
      { type: 'user-message', contents: 'wake after retarget' },
      {
        resourceId: 'retarget-idle-old-user',
        threadId: 'retarget-idle-old-thread',
        ifIdle: {
          streamOptions: { memory: { resource: 'retarget-idle-old-user', thread: 'retarget-idle-old-thread' } },
        } as any,
      },
      pubsub,
    );
    expect(stream).not.toHaveBeenCalled();

    expect(
      runtime.retargetReservedRun(
        'retarget-with-idle-run',
        { resourceId: 'retarget-idle-old-user', threadId: 'retarget-idle-old-thread' },
        { resourceId: 'retarget-idle-new-user', threadId: 'retarget-idle-new-thread' },
        pubsub,
        'retarget-owner-agent',
      ),
    ).toBe(true);
    await waitForCondition(() => stream.mock.calls.length > 0);
    expect(stream).toHaveBeenCalledWith(
      expect.objectContaining({ contents: 'wake after retarget' }),
      expect.objectContaining({
        runId: result.runId,
        memory: { resource: 'retarget-idle-old-user', thread: 'retarget-idle-old-thread' },
      }),
    );
  });

  it('wakes waiters parked on the old thread when a reservation is retargeted', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new EventEmitterPubSub();
    runtime.reserveRun(
      {
        runId: 'retarget-wakes-old-thread-run',
        memory: { resource: 'retarget-wakes-old-user', thread: 'retarget-wakes-old-thread' },
      } as any,
      pubsub,
      'retarget-wakes-owner',
    );

    let waiterResolved = false;
    const waiter = runtime
      .waitForCrossAgentThreadRun(
        { id: 'retarget-wakes-waiter' } as any,
        {
          runId: 'retarget-wakes-waiter-run',
          memory: { resource: 'retarget-wakes-old-user', thread: 'retarget-wakes-old-thread' },
        } as any,
        pubsub,
      )
      .then(() => {
        waiterResolved = true;
      });
    await nextTick();
    expect(waiterResolved).toBe(false);

    expect(
      runtime.retargetReservedRun(
        'retarget-wakes-old-thread-run',
        { resourceId: 'retarget-wakes-old-user', threadId: 'retarget-wakes-old-thread' },
        { resourceId: 'retarget-wakes-new-user', threadId: 'retarget-wakes-new-thread' },
        pubsub,
        'retarget-wakes-owner',
      ),
    ).toBe(true);

    await waiter;
    expect(waiterResolved).toBe(true);
  });

  it('starts a queued idle wake when a reserved setup run is aborted', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new EventEmitterPubSub();
    runtime.reserveRun(
      {
        runId: 'reserved-abort-with-idle-run',
        memory: { resource: 'reserved-abort-idle-user', thread: 'reserved-abort-idle-thread' },
      } as any,
      pubsub,
      'reserved-agent',
    );
    const stream = vi.fn(async () => ({
      runId: 'queued-idle-after-abort-run',
      status: 'running',
      fullStream: (async function* () {})(),
      _waitUntilFinished: async () => {},
    }));

    const result = runtime.sendSignal(
      { id: 'queued-idle-after-abort-agent', stream } as any,
      { type: 'user-message', contents: 'wake after abort' },
      {
        resourceId: 'reserved-abort-idle-user',
        threadId: 'reserved-abort-idle-thread',
        ifIdle: {
          streamOptions: { memory: { resource: 'reserved-abort-idle-user', thread: 'reserved-abort-idle-thread' } },
        } as any,
      },
      pubsub,
    );
    expect(result).toEqual(expect.objectContaining({ runId: expect.any(String) }));
    expect(stream).not.toHaveBeenCalled();

    expect(runtime.abortRun('reserved-abort-with-idle-run', pubsub)).toBe(true);
    await nextTick();
    expect(stream).toHaveBeenCalledWith(
      expect.objectContaining({ contents: 'wake after abort' }),
      expect.objectContaining({
        runId: result.runId,
        memory: { resource: 'reserved-abort-idle-user', thread: 'reserved-abort-idle-thread' },
      }),
    );
  });

  it('releases waiters when draining a queued active signal fails', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new EventEmitterPubSub();
    let finishActive!: () => void;
    const activeFinished = new Promise<void>(resolve => {
      finishActive = resolve;
    });
    const stream = vi.fn(async () => {
      throw new Error('queued active setup failed');
    });
    const owner = { id: 'queued-active-failure-agent', stream };
    const completion = runtime.registerRun(
      owner as any,
      {
        runId: 'queued-active-failure-run',
        status: 'running',
        fullStream: (async function* () {})(),
        _waitUntilFinished: () => activeFinished,
      } as any,
      {
        runId: 'queued-active-failure-run',
        memory: { resource: 'queued-active-failure-user', thread: 'queued-active-failure-thread' },
      } as any,
      pubsub,
    );
    const signalResult = runtime.sendSignal(
      owner as any,
      { type: 'user-message', contents: 'queued active failure' },
      { resourceId: 'queued-active-failure-user', threadId: 'queued-active-failure-thread' },
      pubsub,
    );
    expect(signalResult.accepted).toBe(true);

    let waiterResolved = false;
    const waiter = runtime
      .waitForCrossAgentThreadRun(
        { id: 'queued-active-failure-waiter' } as any,
        {
          runId: 'queued-active-failure-next-run',
          memory: { resource: 'queued-active-failure-user', thread: 'queued-active-failure-thread' },
        } as any,
        pubsub,
      )
      .then(() => {
        waiterResolved = true;
      });
    await nextTick();
    expect(waiterResolved).toBe(false);

    finishActive();
    await expect(completion).rejects.toThrow('queued active setup failed');
    await waiter;
    expect(waiterResolved).toBe(true);
    expect(
      runtime.reserveRun(
        {
          runId: 'queued-active-failure-next-run',
          memory: { resource: 'queued-active-failure-user', thread: 'queued-active-failure-thread' },
        } as any,
        pubsub,
      ),
    ).toEqual(expect.any(Function));
  });

  it('drops queued signals when a prepared run is aborted', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new EventEmitterPubSub();
    let finishActive!: () => void;
    const activeFinished = new Promise<void>(resolve => {
      finishActive = resolve;
    });

    const completion = runtime.registerRun(
      { id: 'active-agent' } as any,
      {
        runId: 'prepared-abort-run',
        status: 'running',
        fullStream: (async function* () {})(),
        _waitUntilFinished: () => activeFinished,
      } as any,
      {
        runId: 'prepared-abort-run',
        memory: { resource: 'prepared-abort-user', thread: 'prepared-abort-thread' },
      } as any,
      pubsub,
    );

    const signalResult = runtime.sendSignal(
      { id: 'active-agent' } as any,
      { type: 'user-message', contents: 'stale prepared signal' },
      {
        runId: 'prepared-abort-run',
      },
      pubsub,
    );
    expect(signalResult).toEqual(expect.objectContaining({ runId: 'prepared-abort-run' }));

    expect(runtime.abortRun('prepared-abort-run', pubsub)).toBe(true);
    expect(() =>
      runtime.sendSignal(
        { id: 'active-agent' } as any,
        { type: 'user-message', contents: 'post-abort stale signal' },
        {
          runId: 'prepared-abort-run',
        },
        pubsub,
      ),
    ).toThrow('has been aborted');
    finishActive();
    await completion;

    runtime.reserveRun(
      {
        runId: 'prepared-abort-successor-run',
        memory: { resource: 'prepared-abort-user', thread: 'prepared-abort-thread' },
      } as any,
      pubsub,
    );
    expect(runtime.drainPendingSignals('prepared-abort-successor-run', pubsub)).toEqual([]);
  });

  it('rejects duplicate registered run ids on the same thread', () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new EventEmitterPubSub();
    const streamOptions = {
      runId: 'duplicate-registered-run',
      memory: { resource: 'duplicate-registered-user', thread: 'duplicate-registered-thread' },
    } as any;

    runtime.registerRun(
      { id: 'active-agent' } as any,
      {
        runId: 'duplicate-registered-run',
        status: 'running',
        fullStream: (async function* () {})(),
        _waitUntilFinished: () => new Promise<void>(() => {}),
      } as any,
      streamOptions,
      pubsub,
    );

    expect(() =>
      runtime.registerRun(
        { id: 'active-agent' } as any,
        {
          runId: 'duplicate-registered-run',
          status: 'running',
          fullStream: (async function* () {})(),
          _waitUntilFinished: () => new Promise<void>(() => {}),
        } as any,
        streamOptions,
        pubsub,
      ),
    ).toThrow('already registered');
  });

  it('rejects same-agent registration when another run is active on the thread', () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new EventEmitterPubSub();
    const streamOptions = {
      memory: { resource: 'same-agent-active-user', thread: 'same-agent-active-thread' },
    } as any;

    runtime.registerRun(
      { id: 'same-active-agent' } as any,
      {
        runId: 'same-active-first-run',
        status: 'running',
        fullStream: (async function* () {})(),
        _waitUntilFinished: () => new Promise<void>(() => {}),
      } as any,
      { ...streamOptions, runId: 'same-active-first-run' },
      pubsub,
    );

    expect(() =>
      runtime.registerRun(
        { id: 'same-active-agent' } as any,
        {
          runId: 'same-active-second-run',
          status: 'running',
          fullStream: (async function* () {})(),
          _waitUntilFinished: () => new Promise<void>(() => {}),
        } as any,
        { ...streamOptions, runId: 'same-active-second-run' },
        pubsub,
      ),
    ).toThrow('already active for this thread');
  });

  it('waits for same-agent active runs before allowing another stream on the thread', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new EventEmitterPubSub();
    let finishActive!: () => void;
    const activeFinished = new Promise<void>(resolve => {
      finishActive = resolve;
    });
    const completion = runtime.registerRun(
      { id: 'same-wait-agent' } as any,
      {
        runId: 'same-wait-active-run',
        status: 'running',
        fullStream: (async function* () {})(),
        _waitUntilFinished: () => activeFinished,
      } as any,
      {
        runId: 'same-wait-active-run',
        memory: { resource: 'same-wait-user', thread: 'same-wait-thread' },
      } as any,
      pubsub,
    );

    let waiterResolved = false;
    const waiter = runtime
      .waitForCrossAgentThreadRun(
        { id: 'same-wait-agent' } as any,
        {
          runId: 'same-wait-next-run',
          memory: { resource: 'same-wait-user', thread: 'same-wait-thread' },
        } as any,
        pubsub,
      )
      .then(() => {
        waiterResolved = true;
      });
    await nextTick();
    expect(waiterResolved).toBe(false);

    finishActive();
    await completion;
    await waiter;
    expect(waiterResolved).toBe(true);
  });

  it('waits for completed active records to clear before allowing another stream on the thread', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new EventEmitterPubSub();
    let finishActive!: () => void;
    const activeFinished = new Promise<void>(resolve => {
      finishActive = resolve;
    });
    const completion = runtime.registerRun(
      { id: 'completed-window-agent' } as any,
      {
        runId: 'completed-window-active-run',
        status: 'success',
        fullStream: (async function* () {})(),
        _waitUntilFinished: () => activeFinished,
      } as any,
      {
        runId: 'completed-window-active-run',
        memory: { resource: 'completed-window-user', thread: 'completed-window-thread' },
      } as any,
      pubsub,
    );

    let waiterResolved = false;
    const waiter = runtime
      .waitForCrossAgentThreadRun(
        { id: 'completed-window-agent' } as any,
        {
          runId: 'completed-window-next-run',
          memory: { resource: 'completed-window-user', thread: 'completed-window-thread' },
        } as any,
        pubsub,
      )
      .then(() => {
        waiterResolved = true;
      });
    await nextTick();
    expect(waiterResolved).toBe(false);

    finishActive();
    await completion;
    await waiter;
    expect(waiterResolved).toBe(true);
  });

  it('reserves the thread after waiting so concurrent stream callers do not overlap execution', async () => {
    let finishActive!: () => void;
    const activeFinished = new Promise<void>(resolve => {
      finishActive = resolve;
    });
    let finishFirstWaiter!: () => void;
    const firstWaiterFinished = new Promise<void>(resolve => {
      finishFirstWaiter = resolve;
    });
    let streamCalls = 0;
    const runner = new Agent({
      id: 'post-wait-reservation-agent',
      name: 'Post Wait Reservation Agent',
      instructions: 'Test',
      model: new MockLanguageModelV2({
        doStream: async () => {
          streamCalls += 1;
          const call = streamCalls;
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: new ReadableStream({
              async start(controller) {
                controller.enqueue({ type: 'stream-start', warnings: [] });
                controller.enqueue({
                  type: 'response-metadata',
                  id: `id-${call}`,
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                });
                controller.enqueue({ type: 'text-start', id: `text-${call}` });
                controller.enqueue({ type: 'text-delta', id: `text-${call}`, delta: `response ${call}` });
                if (call === 1) await firstWaiterFinished;
                controller.enqueue({ type: 'text-end', id: `text-${call}` });
                controller.enqueue({
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                });
                controller.close();
              },
            }),
          };
        },
      }),
    });
    const activeCompletion = agentThreadStreamRuntime.registerRun(
      runner as any,
      {
        runId: 'post-wait-active-run',
        status: 'running',
        fullStream: (async function* () {})(),
        _waitUntilFinished: () => activeFinished,
      } as any,
      {
        runId: 'post-wait-active-run',
        memory: { resource: 'post-wait-user', thread: 'post-wait-thread' },
      } as any,
    );

    const first = runner.stream('first', {
      memory: { resource: 'post-wait-user', thread: 'post-wait-thread' },
    });
    const second = runner.stream('second', {
      memory: { resource: 'post-wait-user', thread: 'post-wait-thread' },
    });
    await nextTick();
    expect(streamCalls).toBe(0);

    finishActive();
    await activeCompletion;
    await waitForCondition(() => streamCalls === 1);
    await nextTick();
    expect(streamCalls).toBe(1);

    const firstOutput = await first;
    const firstText = firstOutput.text;
    finishFirstWaiter();
    await expect(firstText).resolves.toBe('response 1');
    await waitForCondition(() => streamCalls === 2);

    const secondOutput = await second;
    await expect(secondOutput.text).resolves.toBe('response 2');
  });

  it('drains accepted queued signals before releasing waiters after async completion publish', async () => {
    const runtime = agentThreadStreamRuntime;
    const pubsub = new BlockingRunCompletedPubSub();
    let finishActive!: () => void;
    const activeFinished = new Promise<void>(resolve => {
      finishActive = resolve;
    });
    let finishQueued!: () => void;
    const queuedFinished = new Promise<void>(resolve => {
      finishQueued = resolve;
    });
    const ownerCalls: string[] = [];
    const competitorCalls: string[] = [];
    const callOrder: string[] = [];
    const owner = new Agent({
      id: 'completion-drain-agent',
      name: 'Completion Drain Owner',
      instructions: 'Test',
      model: new MockLanguageModelV2({
        doStream: async ({ prompt }) => {
          callOrder.push('queued');
          ownerCalls.push(JSON.stringify(prompt));
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: new ReadableStream({
              async start(controller) {
                controller.enqueue({ type: 'stream-start', warnings: [] });
                controller.enqueue({
                  type: 'response-metadata',
                  id: 'queued-id',
                  modelId: 'mock-model-id',
                  timestamp: new Date(0),
                });
                controller.enqueue({ type: 'text-start', id: 'queued-text' });
                controller.enqueue({ type: 'text-delta', id: 'queued-text', delta: 'queued response' });
                await queuedFinished;
                controller.enqueue({ type: 'text-end', id: 'queued-text' });
                controller.enqueue({
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                });
                controller.close();
              },
            }),
          };
        },
      }),
    });
    const competitor = new Agent({
      id: 'completion-drain-agent',
      name: 'Completion Drain Competitor',
      instructions: 'Test',
      model: new MockLanguageModelV2({
        doStream: async ({ prompt }) => {
          callOrder.push('competitor');
          competitorCalls.push(JSON.stringify(prompt));
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'competitor-id', modelId: 'mock-model-id', timestamp: new Date(0) },
              { type: 'text-start', id: 'competitor-text' },
              { type: 'text-delta', id: 'competitor-text', delta: 'competitor response' },
              { type: 'text-end', id: 'competitor-text' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              },
            ]),
          };
        },
      }),
    });

    const completion = runtime.registerRun(
      owner as any,
      {
        runId: 'completion-drain-active-run',
        status: 'running',
        fullStream: (async function* () {})(),
        _waitUntilFinished: () => activeFinished,
      } as any,
      {
        runId: 'completion-drain-active-run',
        memory: { resource: 'completion-drain-user', thread: 'completion-drain-thread' },
      } as any,
      pubsub,
    );
    const queuedSignal = runtime.sendSignal(
      owner as any,
      { type: 'user-message', contents: 'queued signal' },
      { resourceId: 'completion-drain-user', threadId: 'completion-drain-thread' },
      pubsub,
    );
    expect(queuedSignal.accepted).toBe(true);

    finishActive();
    await waitForCondition(() => pubsub.sawRunCompleted);
    const competitorStream = competitor.stream('competing stream', {
      memory: { resource: 'completion-drain-user', thread: 'completion-drain-thread' },
      _pubsub: pubsub,
    } as any);
    await nextTick();
    expect(ownerCalls).toHaveLength(0);
    expect(competitorCalls).toHaveLength(0);

    pubsub.unblockRunCompleted();
    await waitForCondition(() => ownerCalls.length === 1);
    expect(JSON.stringify(ownerCalls)).toContain('queued signal');
    expect(callOrder[0]).toBe('queued');

    finishQueued();
    await completion;
    await expect(competitorStream.then(stream => stream.text)).resolves.toBe('competitor response');
    expect(competitorCalls).toHaveLength(1);
    expect(callOrder).toEqual(['queued', 'competitor']);
  });

  it('moves reservation waiters onto the registered run on setup success', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new EventEmitterPubSub();
    runtime.reserveRun(
      {
        runId: 'reserved-success-run',
        memory: { resource: 'reserved-success-user', thread: 'reserved-success-thread' },
      } as any,
      pubsub,
      'owner-agent',
    );

    let waiterResolved = false;
    const waiter = runtime
      .waitForCrossAgentThreadRun(
        { id: 'other-agent' } as any,
        {
          runId: 'other-run',
          memory: { resource: 'reserved-success-user', thread: 'reserved-success-thread' },
        } as any,
        pubsub,
      )
      .then(() => {
        waiterResolved = true;
      });
    await nextTick();
    expect(waiterResolved).toBe(false);

    let finishActive!: () => void;
    const activeFinished = new Promise<void>(resolve => {
      finishActive = resolve;
    });
    const completion = runtime.registerRun(
      { id: 'owner-agent' } as any,
      {
        runId: 'reserved-success-run',
        status: 'running',
        fullStream: (async function* () {})(),
        _waitUntilFinished: () => activeFinished,
      } as any,
      {
        runId: 'reserved-success-run',
        memory: { resource: 'reserved-success-user', thread: 'reserved-success-thread' },
      } as any,
      pubsub,
    );
    await nextTick();
    expect(waiterResolved).toBe(false);

    finishActive();
    await completion;
    await waiter;
    expect(waiterResolved).toBe(true);
  });

  it('does not treat matching run ids from another agent as its own reservation', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new EventEmitterPubSub();
    let finishActive!: () => void;
    const activeFinished = new Promise<void>(resolve => {
      finishActive = resolve;
    });

    const completion = runtime.registerRun(
      { id: 'owner-agent' } as any,
      {
        runId: 'shared-run-id',
        status: 'running',
        fullStream: (async function* () {})(),
        _waitUntilFinished: () => activeFinished,
      } as any,
      {
        runId: 'shared-run-id',
        memory: { resource: 'run-id-collision-user', thread: 'run-id-collision-thread' },
      } as any,
      pubsub,
    );

    let waiterResolved = false;
    const waiter = runtime
      .waitForCrossAgentThreadRun(
        { id: 'different-agent' } as any,
        {
          runId: 'shared-run-id',
          memory: { resource: 'run-id-collision-user', thread: 'run-id-collision-thread' },
        } as any,
        pubsub,
      )
      .then(() => {
        waiterResolved = true;
      });
    await nextTick();
    expect(waiterResolved).toBe(false);

    finishActive();
    await completion;
    await waiter;
    expect(waiterResolved).toBe(true);
  });

  it('does not treat matching run ids from the same agent as its own reservation without ownership', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new EventEmitterPubSub();
    const release = runtime.reserveRun(
      {
        runId: 'same-agent-shared-run-id',
        memory: { resource: 'same-agent-collision-user', thread: 'same-agent-collision-thread' },
      } as any,
      pubsub,
      'owner-agent',
    );

    let waiterResolved = false;
    const waiter = runtime
      .waitForCrossAgentThreadRun(
        { id: 'owner-agent' } as any,
        {
          runId: 'same-agent-shared-run-id',
          memory: { resource: 'same-agent-collision-user', thread: 'same-agent-collision-thread' },
        } as any,
        pubsub,
      )
      .then(() => {
        waiterResolved = true;
      });
    await nextTick();
    expect(waiterResolved).toBe(false);

    release?.();
    await waiter;
    expect(waiterResolved).toBe(true);
  });

  it('rejects registration when another agent owns the reservation', () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new EventEmitterPubSub();
    runtime.reserveRun(
      {
        runId: 'reserved-owner-register-run',
        memory: { resource: 'reserved-owner-register-user', thread: 'reserved-owner-register-thread' },
      } as any,
      pubsub,
      'owner-agent',
    );

    expect(() =>
      runtime.registerRun(
        { id: 'different-agent' } as any,
        {
          runId: 'reserved-owner-register-run',
          status: 'running',
          fullStream: (async function* () {})(),
          _waitUntilFinished: () => new Promise<void>(() => {}),
        } as any,
        {
          runId: 'reserved-owner-register-run',
          memory: { resource: 'reserved-owner-register-user', thread: 'reserved-owner-register-thread' },
        } as any,
        pubsub,
      ),
    ).toThrow('reserved by another agent');
  });

  it('cleans up a thread subscription and completes the iterator', async () => {
    const agent = new Agent({
      id: 'cleanup-signal-agent',
      name: 'Cleanup Signal Agent',
      instructions: 'Test',
      model: createTextStreamModel('cleanup response'),
    });

    const subscription = await agent.subscribeToThread({
      threadId: 'cleanup-thread',
      resourceId: 'cleanup-user',
    });
    const iterator = subscription.stream[Symbol.asyncIterator]();

    subscription.unsubscribe();
    await expect(iterator.next()).resolves.toEqual({ value: undefined, done: true });
  });

  it('allows a thread follower to abort the active run controller', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const options = await runtime.prepareRunOptions({
      runId: 'abort-run',
      memory: { thread: 'abort-thread', resource: 'abort-user' },
    } as any);
    const neverFinishes = new Promise<any>(() => {});

    runtime.registerRun(
      { id: 'abortable-agent' } as any,
      {
        runId: 'abort-run',
        status: 'running',
        _waitUntilFinished: () => neverFinishes,
      } as any,
      options,
    );

    expect(runtime.abortThread({ threadId: 'abort-thread', resourceId: 'abort-user' })).toBe(true);
    expect(options.abortSignal?.aborted).toBe(true);
  });

  it('does not consume active run output while watching for completion', () => {
    const runtime = new AgentThreadStreamRuntime();
    const getFullOutput = vi.fn();

    runtime.registerRun(
      { id: 'watch-agent' } as any,
      {
        runId: 'watch-run',
        status: 'running',
        getFullOutput,
        _waitUntilFinished: () => new Promise<any>(() => {}),
      } as any,
      {
        runId: 'watch-run',
        memory: { thread: 'watch-thread', resource: 'watch-user' },
      } as any,
    );

    expect(getFullOutput).not.toHaveBeenCalled();
  });

  it('delivers a future thread run to multiple subscribers', async () => {
    const agent = new Agent({
      id: 'multiple-subscriber-agent',
      name: 'Multiple Subscriber Agent',
      instructions: 'Test',
      model: createTextStreamModel('multi response'),
    });

    const firstSubscription = await agent.subscribeToThread({
      threadId: 'multi-thread',
      resourceId: 'multi-user',
    });
    const secondSubscription = await agent.subscribeToThread({
      threadId: 'multi-thread',
      resourceId: 'multi-user',
    });
    const firstRunPromise = readNextRun(firstSubscription.stream[Symbol.asyncIterator]());
    const secondRunPromise = readNextRun(secondSubscription.stream[Symbol.asyncIterator]());

    const stream = await agent.stream('Hello', {
      memory: { thread: 'multi-thread', resource: 'multi-user' },
    });

    await expect(firstRunPromise).resolves.toMatchObject({ value: { runId: stream.runId }, done: false });
    await expect(secondRunPromise).resolves.toMatchObject({ value: { runId: stream.runId }, done: false });

    firstSubscription.unsubscribe();
    secondSubscription.unsubscribe();
  });

  it('isolates subscriptions by resource and thread id', async () => {
    const agent = new Agent({
      id: 'isolated-signal-agent',
      name: 'Isolated Signal Agent',
      instructions: 'Test',
      model: createTextStreamModel('isolated response'),
    });

    const targetSubscription = await agent.subscribeToThread({
      threadId: 'isolated-thread',
      resourceId: 'isolated-user',
    });
    const otherResourceSubscription = await agent.subscribeToThread({
      threadId: 'isolated-thread',
      resourceId: 'other-user',
    });
    const otherThreadSubscription = await agent.subscribeToThread({
      threadId: 'other-thread',
      resourceId: 'isolated-user',
    });

    const targetNext = readNextRun(targetSubscription.stream[Symbol.asyncIterator]());
    const otherResourceNext = readNextRun(otherResourceSubscription.stream[Symbol.asyncIterator]());
    const otherThreadNext = readNextRun(otherThreadSubscription.stream[Symbol.asyncIterator]());

    const stream = await agent.stream('Hello', {
      memory: { thread: 'isolated-thread', resource: 'isolated-user' },
    });

    await expect(targetNext).resolves.toMatchObject({ value: { runId: stream.runId }, done: false });
    await nextTick();

    otherResourceSubscription.unsubscribe();
    otherThreadSubscription.unsubscribe();
    await expect(otherResourceNext).resolves.toEqual({ value: undefined, done: true });
    await expect(otherThreadNext).resolves.toEqual({ value: undefined, done: true });

    targetSubscription.unsubscribe();
  });

  it('does not replay completed thread runs to late subscribers', async () => {
    const agent = new Agent({
      id: 'late-subscription-agent',
      name: 'Late Subscription Agent',
      instructions: 'Test',
      model: createTextStreamModel('late response'),
    });

    const stream = await agent.stream('Hello', {
      memory: { thread: 'late-thread', resource: 'late-user' },
    });
    await stream.text;
    const subscription = await agent.subscribeToThread({
      threadId: 'late-thread',
      resourceId: 'late-user',
    });
    const iterator = subscription.stream[Symbol.asyncIterator]();

    const nextRun = readNextRun(iterator);
    await nextTick();
    subscription.unsubscribe();
    await expect(nextRun).resolves.toEqual({ value: undefined, done: true });
  });

  it('drains a signal by active run id into the active run', async () => {
    let releaseFirst!: () => void;
    const firstFinished = new Promise<void>(resolve => {
      releaseFirst = resolve;
    });
    let streamCount = 0;
    const prompts: any[][] = [];

    const model = new MockLanguageModelV2({
      doStream: async ({ prompt }) => {
        streamCount += 1;
        prompts.push(prompt);
        const responseText = streamCount === 1 ? 'run id first response' : 'run id signal response';

        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: new ReadableStream({
            async start(controller) {
              controller.enqueue({ type: 'stream-start', warnings: [] });
              controller.enqueue({
                type: 'response-metadata',
                id: `run-id-${streamCount}`,
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              });
              controller.enqueue({ type: 'text-start', id: 'text-1' });
              controller.enqueue({ type: 'text-delta', id: 'text-1', delta: responseText });
              controller.enqueue({ type: 'text-end', id: 'text-1' });
              if (streamCount === 1) {
                await firstFinished;
              }
              controller.enqueue({
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              });
              controller.close();
            },
          }),
        };
      },
    });

    const agent = new Agent({
      id: 'run-id-signal-agent',
      name: 'Run Id Signal Agent',
      instructions: 'Test',
      model,
    });
    const subscription = await agent.subscribeToThread({
      threadId: 'run-id-thread',
      resourceId: 'run-id-user',
    });
    const iterator = subscription.stream[Symbol.asyncIterator]();
    const firstRunPromise = readNextRun(iterator);

    const stream = await agent.stream('Hello', {
      memory: { thread: 'run-id-thread', resource: 'run-id-user' },
    });
    await expect(waitForActiveRun(subscription)).resolves.toBe(stream.runId);

    expect(agent.sendSignal({ type: 'user-message', contents: 'Hello by run id' }, { runId: stream.runId })).toEqual(
      expect.objectContaining({
        accepted: true,
        runId: stream.runId,
      }),
    );

    releaseFirst();
    await firstRunPromise;
    await expect(stream.text).resolves.toBe('run id first responserun id signal response');
    expect(streamCount).toBe(2);
    expect(JSON.stringify(prompts[1])).toContain('Hello by run id');

    subscription.unsubscribe();
  });

  it('throws when sending a signal to an unknown run id without a thread target', () => {
    const agent = new Agent({
      id: 'missing-run-signal-agent',
      name: 'Missing Run Signal Agent',
      instructions: 'Test',
      model: createTextStreamModel('missing run response'),
    });

    expect(() => agent.sendSignal({ type: 'user-message', contents: 'Hello' }, { runId: 'missing-run-id' })).toThrow(
      'No active agent run found for signal target',
    );
  });

  it('starts an idle thread run with a system-reminder signal as user-role XML context', async () => {
    let capturedPrompt: any[] | undefined;
    const model = new MockLanguageModelV2({
      doStream: async ({ prompt }) => {
        capturedPrompt = prompt;
        return {
          rawCall: { rawPrompt: prompt, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'system-signal-id', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'system signal response' },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            },
          ]),
        };
      },
    });

    const agent = new Agent({
      id: 'system-signal-agent',
      name: 'System Signal Agent',
      instructions: 'Test',
      model,
    });

    const stream = await agent.sendSignal(
      { type: 'system-reminder', contents: 'continue', attributes: { reminderType: 'test-reminder' } },
      {
        resourceId: 'system-signal-user',
        threadId: 'system-signal-thread',
        ifIdle: { streamOptions: { memory: { resource: 'system-signal-user', thread: 'system-signal-thread' } } },
      },
    );

    expect(stream.accepted).toBe(true);
    for (let i = 0; i < 10 && !capturedPrompt; i++) {
      await nextTick();
    }
    expect(
      capturedPrompt?.some(
        message =>
          message.role === 'user' &&
          Array.isArray(message.content) &&
          message.content.some(
            (part: any) => part.text === '<system-reminder reminderType="test-reminder">continue</system-reminder>',
          ),
      ),
    ).toBe(true);
  });

  describe('delivery option attributes', () => {
    it('resolveDeliveryAttributes merges option attributes into signal attributes', () => {
      const signal = createSignal({
        type: 'user-message',
        contents: 'hello',
        attributes: { existing: 'yes' },
      });

      const resolved = resolveDeliveryAttributes(signal, { delivery: 'while-active' });
      expect(resolved.attributes).toEqual({ existing: 'yes', delivery: 'while-active' });
    });

    it('resolveDeliveryAttributes returns same signal when no option attributes are selected', () => {
      const signal = createSignal({
        type: 'user-message',
        contents: 'hello',
      });

      const resolved = resolveDeliveryAttributes(signal, undefined);
      expect(resolved).toBe(signal);
    });

    it('resolved delivery attributes appear in toLLMMessage XML', () => {
      const signal = createSignal({
        type: 'user-message',
        contents: 'fix the bug',
      });

      const resolved = resolveDeliveryAttributes(signal, { delivery: 'while-active' });
      expect(resolved.toLLMMessage()).toEqual({
        role: 'user',
        content: '<user-message delivery="while-active">fix the bug</user-message>',
      });
    });

    it('resolved delivery attributes appear in toDBMessage and toDataPart', () => {
      const signal = createSignal({
        type: 'user-message',
        contents: 'fix the bug',
      });

      const resolved = resolveDeliveryAttributes(signal, { delivery: 'while-active' });
      const db = resolved.toDBMessage({ threadId: 't', resourceId: 'r' });
      expect((db.content.metadata!.signal as Record<string, unknown>).attributes).toEqual({
        delivery: 'while-active',
      });

      const dataPart = resolved.toDataPart();
      expect(dataPart.data.attributes).toEqual({ delivery: 'while-active' });
    });

    it('thread-stream-runtime resolves ifActive.attributes as while-active on active signal delivery', async () => {
      const runtime = new AgentThreadStreamRuntime();
      const pubsub = new EventEmitterPubSub();
      const agent = { id: 'delivery-active-agent' } as any;

      // Prepare and register a run that is still "running" so the thread is active.
      const options = await runtime.prepareRunOptions(
        {
          runId: 'active-run',
          memory: { thread: 'delivery-thread', resource: 'delivery-resource' },
        } as any,
        pubsub,
      );
      runtime.registerRun(
        agent,
        {
          runId: 'active-run',
          status: 'running',
          _waitUntilFinished: () => new Promise<any>(() => {}),
        } as any,
        options,
        pubsub,
      );

      // Send a signal while the run is still active.
      const result = runtime.sendSignal(
        agent,
        {
          type: 'user-message',
          contents: 'while-active test',
        },
        {
          resourceId: 'delivery-resource',
          threadId: 'delivery-thread',
          ifActive: { attributes: { delivery: 'while-active' } },
          ifIdle: {
            attributes: { delivery: 'message' },
            streamOptions: {
              memory: { thread: 'delivery-thread', resource: 'delivery-resource' },
            },
          },
        },
        pubsub,
      );

      // Active run → ifActive.attributes → delivery: 'while-active'
      expect(result.signal.attributes).toEqual({ delivery: 'while-active' });
    });

    it('thread-stream-runtime resolves ifIdle.attributes as message on idle signal delivery', () => {
      const runtime = new AgentThreadStreamRuntime();
      const pubsub = new EventEmitterPubSub();
      const agent = { id: 'delivery-idle-agent', stream: () => new Promise(() => {}) } as any;

      // No run registered → thread is idle.
      const result = runtime.sendSignal(
        agent,
        {
          type: 'user-message',
          contents: 'idle test',
        },
        {
          resourceId: 'idle-resource',
          threadId: 'idle-thread',
          ifActive: { attributes: { delivery: 'while-active' } },
          ifIdle: {
            attributes: { delivery: 'message' },
            streamOptions: {
              memory: { thread: 'idle-thread', resource: 'idle-resource' },
            },
          },
        },
        pubsub,
      );

      // No active run → ifIdle.attributes → delivery: 'message'
      expect(result.signal.attributes).toEqual({ delivery: 'message' });
    });
  });
});
