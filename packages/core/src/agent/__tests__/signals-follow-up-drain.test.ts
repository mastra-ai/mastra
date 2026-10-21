import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { Agent } from '../agent';
import { mastraDBMessageToSignal } from '../signals';
import { agentThreadStreamRuntime } from '../thread-stream-runtime';
import {
  createTextStreamModel,
  nextTick,
  readNextRun,
  readNextRunWithParts,
  waitForActiveRun,
  waitForCondition,
} from './signals-test-utils';

describe('Agent signals: follow-up drain', () => {
  beforeEach(() => {
    agentThreadStreamRuntime.resetForTests();
  });

  it('drains multiple user-message signals into an active same-agent thread run without merging them into users', async () => {
    let releaseFirst!: () => void;
    const firstFinished = new Promise<void>(resolve => {
      releaseFirst = resolve;
    });
    let releaseSecond!: () => void;
    const secondFinished = new Promise<void>(resolve => {
      releaseSecond = resolve;
    });
    let streamCount = 0;
    const prompts: any[][] = [];

    const model = new MockLanguageModelV2({
      doStream: async ({ prompt }) => {
        streamCount += 1;
        const callIndex = streamCount;
        prompts.push(prompt);
        const responseText =
          callIndex === 1 ? 'first response' : callIndex === 2 ? 'first signal response' : 'second signal response';

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
              controller.enqueue({ type: 'text-start', id: `text-${callIndex}` });
              controller.enqueue({ type: 'text-delta', id: `text-${callIndex}`, delta: responseText });
              controller.enqueue({ type: 'text-end', id: `text-${callIndex}` });
              if (callIndex === 1) {
                await firstFinished;
              }
              if (callIndex === 2) {
                await secondFinished;
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
    await waitForCondition(() => stream._getImmediateText() === 'first response');

    const firstSignalResult = await agent.sendSignal(
      { type: 'user-message', contents: 'First signal while running' },
      { resourceId: 'active-user', threadId: 'active-thread' },
    );
    await expect(firstSignalResult.accepted).resolves.toMatchObject({ action: 'deliver', runId: stream.runId });
    expect(firstSignalResult.signal.id).toBeDefined();

    releaseFirst();
    await waitForCondition(() => streamCount === 2);
    await waitForCondition(() => stream._getImmediateText() === 'first responsefirst signal response');

    const secondSignalResult = await agent.sendSignal(
      { type: 'user-message', contents: 'Second signal while running' },
      { resourceId: 'active-user', threadId: 'active-thread' },
    );
    await expect(secondSignalResult.accepted).resolves.toMatchObject({ action: 'deliver', runId: stream.runId });
    expect(secondSignalResult.signal.id).toBeDefined();
    expect(secondSignalResult.signal.id).not.toBe(firstSignalResult.signal.id);

    releaseSecond();
    const firstRun = await firstRunPromise;
    expect(firstRun.value.text).toBe('first responsefirst signal responsesecond signal response');
    expect(streamCount).toBe(3);
    expect(JSON.stringify(prompts[1])).toContain('First signal while running');
    expect(JSON.stringify(prompts[1])).not.toContain('Second signal while running');
    expect(JSON.stringify(prompts[2])).toContain('First signal while running');
    expect(JSON.stringify(prompts[2])).toContain('Second signal while running');

    await stream.consumeStream();
    const recalled = await memory.recall({ threadId: 'active-thread', resourceId: 'active-user' });
    expect(recalled.messages.map(message => message.role)).toEqual([
      'user',
      'assistant',
      'signal',
      'assistant',
      'signal',
      'assistant',
    ]);
    expect(recalled.messages.map(message => message.content.parts.map(part => part.type))).toEqual([
      ['text'],
      ['text'],
      ['text'],
      ['text'],
      ['text'],
      ['text'],
    ]);
    expect(
      recalled.messages.map(message =>
        message.content.parts.map(part => (part.type === 'text' ? part.text : '')).join(''),
      ),
    ).toEqual([
      'Hello',
      'first response',
      'First signal while running',
      'first signal response',
      'Second signal while running',
      'second signal response',
    ]);

    const [userMessage, firstAssistant, firstSignal, secondAssistant, secondSignal, thirdAssistant] = recalled.messages;
    expect(firstSignal.id).toBe(firstSignalResult.signal.id);
    expect(secondSignal.id).toBe(secondSignalResult.signal.id);
    expect(firstSignal.id).not.toBe(userMessage.id);
    expect(secondSignal.id).not.toBe(userMessage.id);
    expect(firstSignal.createdAt.getTime()).toBeGreaterThan(firstAssistant.createdAt.getTime());
    expect(firstSignal.createdAt.getTime()).toBeLessThanOrEqual(secondAssistant.createdAt.getTime());
    expect(secondSignal.createdAt.getTime()).toBeGreaterThan(secondAssistant.createdAt.getTime());
    expect(secondSignal.createdAt.getTime()).toBeLessThanOrEqual(thirdAssistant.createdAt.getTime());

    const firstRecalledSignal = mastraDBMessageToSignal(firstSignal);
    const secondRecalledSignal = mastraDBMessageToSignal(secondSignal);
    expect(firstRecalledSignal.createdAt).toEqual(firstSignal.createdAt);
    expect(secondRecalledSignal.createdAt).toEqual(secondSignal.createdAt);
    expect(firstRecalledSignal.acceptedAt).toEqual(firstSignalResult.signal.acceptedAt);
    expect(secondRecalledSignal.acceptedAt).toEqual(secondSignalResult.signal.acceptedAt);

    const firstSignalMetadata = firstSignal.content.metadata?.signal as { createdAt?: string; acceptedAt?: string };
    const secondSignalMetadata = secondSignal.content.metadata?.signal as { createdAt?: string; acceptedAt?: string };
    expect(firstSignalMetadata).toMatchObject({
      createdAt: firstSignal.createdAt.toISOString(),
      acceptedAt: firstSignalResult.signal.acceptedAt?.toISOString(),
    });
    expect(secondSignalMetadata).toMatchObject({
      createdAt: secondSignal.createdAt.toISOString(),
      acceptedAt: secondSignalResult.signal.acceptedAt?.toISOString(),
    });
    expect(firstAssistant.content.metadata?.mastra).toMatchObject({ responseBoundary: true });
    expect(secondAssistant.content.metadata?.mastra).toMatchObject({ responseBoundary: true });

    subscription.unsubscribe();
  });

  it('preserves current-step tool calls before draining a follow-up signal', async () => {
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
    await expect(signalResult.accepted).resolves.toMatchObject({ action: 'deliver', runId: stream.runId });

    continueToToolCall();
    await waitForCondition(() => callCount === 2);
    await runPromise;

    expect(chunks.map(chunk => chunk.type)).toContain('tool-call');
    expect(JSON.stringify(prompts[1])).toContain('Actually stop and answer this instead');
    expect(JSON.stringify(prompts[1])).toContain('stale-tool-call');

    subscription.unsubscribe();
  });

  it('interrupts an active reasoning stream to drain thread-targeted follow-up signals', async () => {
    const prompts: any[][] = [];
    let callCount = 0;
    let reasoningReady = false;
    let providerAborted = false;
    const onAbort = vi.fn();

    const model = new MockLanguageModelV2({
      doStream: async ({ prompt, abortSignal }) => {
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
                abortSignal?.addEventListener(
                  'abort',
                  () => {
                    providerAborted = true;
                    controller.error(abortSignal.reason);
                  },
                  { once: true },
                );
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
      onAbort,
      onChunk: chunk => {
        if (chunk.type === 'reasoning-delta') reasoningReady = true;
      },
    });
    await expect(waitForActiveRun(subscription)).resolves.toBe(stream.runId);
    await waitForCondition(() => reasoningReady);

    const signalResult = await agent.sendSignal(
      { type: 'user-message', contents: 'Stop reasoning and answer this' },
      { resourceId: 'interleaved-reasoning-user', threadId: 'interleaved-reasoning-thread' },
    );
    await expect(signalResult.accepted).resolves.toMatchObject({ action: 'deliver', runId: stream.runId });

    await waitForCondition(() => callCount === 2);
    expect(providerAborted).toBe(true);

    const run = await runPromise;
    expect(run.value.text).toContain('signal response');
    expect(JSON.stringify(prompts[1])).toContain('Stop reasoning and answer this');
    expect(JSON.stringify(prompts[1])).not.toContain('thinking');
    expect(onAbort).not.toHaveBeenCalled();

    subscription.unsubscribe();
  });

  it.each(['user-message', 'reactive', 'system-reminder'] as const)(
    'drains pre-run %s signals with matching visibility',
    async type => {
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
      const runPromise = readNextRunWithParts(iterator);

      const firstSignal = await agent.sendSignal(
        { type: 'user-message', contents: 'start idle stream' },
        {
          resourceId: 'idle-start-user',
          threadId: 'idle-start-thread',
          ifIdle: { streamOptions: { memory: { resource: 'idle-start-user', thread: 'idle-start-thread' } } },
        },
      );

      const followUp = await agent.sendSignal(
        { type, contents: 'thread targeted follow up' },
        {
          resourceId: 'idle-start-user',
          threadId: 'idle-start-thread',
          ifIdle: { streamOptions: { memory: { resource: 'idle-start-user', thread: 'idle-start-thread' } } },
        },
      );

      const firstAccepted = await firstSignal.accepted;
      const followUpAccepted = await followUp.accepted;
      const firstRunId = 'runId' in firstAccepted ? firstAccepted.runId : undefined;
      const followUpRunId = 'runId' in followUpAccepted ? followUpAccepted.runId : undefined;
      expect(firstAccepted.action).toBe('wake');
      expect(followUpRunId).toBe(firstRunId);

      const run = await runPromise;
      expect(run.value.runId).toBe(firstRunId);
      expect(run.value.text).toBe('response');
      expect(run.value.parts.filter((part: any) => part.data?.contents === 'thread targeted follow up')).toHaveLength(
        1,
      );
      expect(prompts).toHaveLength(1);
      expect(JSON.stringify(prompts[0])).toContain('thread targeted follow up');

      subscription.unsubscribe();
    },
  );

  it('completes a signal-started run that no caller subscribes to or consumes', async () => {
    // Regression: a fire-and-forget wake (e.g. an agent schedule) starts a thread run
    // but never subscribes to or consumes the returned stream. The runtime must
    // still drive the stream to completion on its own so the run reaches a
    // terminal state and its active-run record releases. If it does not, the
    // thread stays wedged and every later signal coalesces into the stuck run.
    const agent = new Agent({
      id: 'unconsumed-wake-agent',
      name: 'Unconsumed Wake Agent',
      instructions: 'Test',
      model: createTextStreamModel('unconsumed response'),
    });

    const resourceId = 'unconsumed-wake-user';
    const threadId = 'unconsumed-wake-thread';

    // Wake the thread without subscribing or consuming the resulting stream.
    const accepted = await agent.sendSignal(
      { type: 'user-message', contents: 'wake without a consumer' },
      {
        resourceId,
        threadId,
        ifIdle: { streamOptions: { memory: { resource: resourceId, thread: threadId } } },
      },
    ).accepted;
    expect(accepted.action).toBe('wake');
    const runId = 'runId' in accepted ? accepted.runId : undefined;
    expect(runId).toBeTruthy();
    expect(agent.getActiveThreadRunId({ resourceId, threadId })).toBe(runId);

    // With no consumer, the run must still finish and release the active-run record.
    await waitForCondition(() => agent.getActiveThreadRunId({ resourceId, threadId }) === undefined, 2000);
    expect(agent.getActiveThreadRunId({ resourceId, threadId })).toBeUndefined();

    // A follow-up wake now starts a fresh run rather than coalescing into a stuck one.
    const followUp = await agent.sendSignal(
      { type: 'user-message', contents: 'second wake after first completed' },
      {
        resourceId,
        threadId,
        ifIdle: { streamOptions: { memory: { resource: resourceId, thread: threadId } } },
      },
    ).accepted;
    expect(followUp.action).toBe('wake');
    const followUpRunId = 'runId' in followUp ? followUp.runId : undefined;
    expect(followUpRunId).not.toBe(runId);
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

    const signalAccepted = await signalResult.accepted;
    const signalRunId = 'runId' in signalAccepted ? signalAccepted.runId : undefined;
    const secondRun = await readNextRun(iterator);
    expect(secondRun.value.runId).toBe(signalRunId);
    expect(secondRun.value.text).toBe('second response');
    expect(secondStarted).toBe(true);

    subscription.unsubscribe();
  });

  it.each(['user-message', 'reactive', 'system-reminder'] as const)(
    'drains active %s signals with matching visibility',
    async type => {
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
      const firstRunPromise = readNextRunWithParts(iterator);

      const stream = await agent.stream('Hello', {
        memory: { thread: 'run-id-thread', resource: 'run-id-user' },
      });
      await expect(waitForActiveRun(subscription)).resolves.toBe(stream.runId);
      await waitForCondition(() => stream._getImmediateText() === 'run id first response');

      const runIdSignalResult = agent.sendSignal({ type, contents: 'Hello by run id' }, { runId: stream.runId });
      await expect(runIdSignalResult.accepted).resolves.toMatchObject({ action: 'deliver', runId: stream.runId });

      releaseFirst();
      const run = await firstRunPromise;
      expect(run.value.parts.filter((part: any) => part.data?.contents === 'Hello by run id')).toHaveLength(1);
      await expect(stream.text).resolves.toBe('run id first responserun id signal response');
      expect(streamCount).toBe(2);
      expect(JSON.stringify(prompts[1])).toContain('Hello by run id');

      subscription.unsubscribe();
    },
  );

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
});
