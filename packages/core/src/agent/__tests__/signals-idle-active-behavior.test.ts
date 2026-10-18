import { fork } from 'node:child_process';

import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { RequestContext } from '../../request-context';
import { Agent } from '../agent';
import { createSignal } from '../signals';
import { AgentThreadStreamRuntime, agentThreadStreamRuntime } from '../thread-stream-runtime';
import {
  createTextStreamModel,
  createBlockingFirstTextStreamModel,
  nextTick,
  RetainedAsyncCallbackPubSub,
  ControlledLeasePubSub,
  readNextRunWithParts,
  waitForCondition,
  withTimeout,
} from './signals-test-utils';

describe('Agent signals: idle and active behaviors', () => {
  beforeEach(() => {
    agentThreadStreamRuntime.resetForTests();
  });

  it('fans out sequential idle signal runs to many same-thread subscribers', async () => {
    const resourceId = 'share-resource';
    const threadId = 'share-thread';
    const subscriberCount = 100;
    const runCount = 5;
    let streamCount = 0;
    const agent = new Agent({
      id: 'share-signal-agent',
      name: 'Share Signal Agent',
      instructions: 'Test',
      model: new MockLanguageModelV2({
        doStream: async () => {
          streamCount += 1;
          const text = `signal response ${streamCount}`;
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: new ReadableStream({
              async start(controller) {
                const parts = [
                  { type: 'stream-start', warnings: [] },
                  {
                    type: 'response-metadata',
                    id: `id-${streamCount}`,
                    modelId: 'mock-model-id',
                    timestamp: new Date(0),
                  },
                  { type: 'text-start', id: 'text-1' },
                  { type: 'text-delta', id: 'text-1', delta: text },
                  { type: 'text-end', id: 'text-1' },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                  },
                ] as any[];
                for (const part of parts) {
                  await nextTick();
                  controller.enqueue(part);
                }
                controller.close();
              },
            }),
          };
        },
      }),
    });

    const subscriptions = await Promise.all(
      Array.from({ length: subscriberCount }, () => agent.subscribeToThread({ threadId, resourceId })),
    );
    const iterators = subscriptions.map(subscription => subscription.stream[Symbol.asyncIterator]());

    try {
      for (let runIndex = 1; runIndex <= runCount; runIndex += 1) {
        const nextRuns = iterators.map(iterator => readNextRunWithParts(iterator));
        const contents = `Hello from signal ${runIndex}`;

        const signalResult = await agent.sendSignal(
          { type: 'user-message', contents },
          { resourceId, threadId, ifIdle: { streamOptions: { memory: { resource: resourceId, thread: threadId } } } },
        );

        const runs = await withTimeout(
          Promise.all(nextRuns),
          `Timed out waiting for ${subscriberCount} subscribers to receive idle signal run ${runIndex}`,
        );
        const [firstRun] = runs;

        await expect(signalResult.accepted).resolves.toMatchObject({ action: 'wake', runId: firstRun.value.runId });
        expect(firstRun.value.text).toBe(`signal response ${runIndex}`);

        for (const run of runs) {
          expect(run.value.runId).toBe(firstRun.value.runId);
          expect(run.value.text).toBe(`signal response ${runIndex}`);
          const signalPart = run.value.parts.find((part: any) => part.type === 'data-user-message');
          expect(signalPart?.data).toMatchObject({
            id: signalResult.signal.id,
            contents,
            acceptedAt: signalResult.signal.acceptedAt?.toISOString(),
          });
          expect(signalPart?.data.createdAt).toBeDefined();
          expect(signalPart?.transient).toBe(true);
        }
      }

      expect(streamCount).toBe(runCount);
    } finally {
      for (const subscription of subscriptions) {
        subscription.unsubscribe();
      }
    }
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

    await expect(result.accepted).resolves.toMatchObject({ action: 'wake' });
  });

  it('reports the reserved runId as active before registerRun populates the stream record', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const threadId = 'reservation-gap-thread';
    const resourceId = 'reservation-gap-user';

    // agent.stream is awaited inside the idle-wake path before registerRun fires. Returning
    // a never-resolving promise pins the runtime in the gap where sendSignal has reserved
    // activeThreadRunIds + threadKeysByRunId but threadRunsById is still empty.
    const agent = {
      id: 'reservation-gap-agent',
      stream: () => new Promise(() => {}),
    } as unknown as Agent<any, any, any, any>;

    const subscription = await runtime.subscribeToThread(agent, { threadId, resourceId });
    expect(subscription.activeRunId()).toBeNull();

    const result = runtime.sendSignal(agent, createSignal({ type: 'user-message', contents: 'hello' }), {
      resourceId,
      threadId,
      ifIdle: { streamOptions: { memory: { resource: resourceId, thread: threadId } } as any },
    });

    // accepted never settles here because agent.stream is pinned; the reserved runId is
    // observable via the subscription's active run id before registerRun populates the stream.
    expect(result.accepted).toBeInstanceOf(Promise);
    expect(subscription.activeRunId()).not.toBeNull();

    const queued = runtime.queueMessage(agent, 'separate queued message', { resourceId, threadId });
    await expect(queued.accepted).resolves.toMatchObject({ action: 'deliver' });
    expect(runtime.cancelQueuedMessages(agent, { resourceId, threadId, signalIds: [queued.signal.id] })).toEqual({
      cancelledSignalIds: [queued.signal.id],
    });

    subscription.unsubscribe();
  });

  it('lets a run start immediately after a persisted idle signal without starving the event loop', async () => {
    // Runs in a child process on purpose: the regression starves the macrotask queue, so an
    // in-process timeout would never fire. The parent bounds it with SIGKILL instead.
    const fixture = new URL('./fixtures/persisted-signal-immediate-run.ts', import.meta.url);
    const child = fork(fixture, { execArgv: ['--import', import.meta.resolve('tsx')], silent: true });
    const stderr: Buffer[] = [];
    child.stderr?.on('data', chunk => stderr.push(chunk));
    let reachedWait = false;
    let completed = false;
    child.on('message', message => {
      if (message === 'waiting') reachedWait = true;
      if (message === 'ok') completed = true;
    });

    const result = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
      const timeout = setTimeout(() => child.kill('SIGKILL'), 10_000);
      child.once('error', error => {
        clearTimeout(timeout);
        reject(error);
      });
      child.once('close', (code, signal) => {
        clearTimeout(timeout);
        resolve({ code, signal });
      });
    });

    const diagnostics = `reached wait: ${reachedWait}\n${Buffer.concat(stderr).toString() || 'child produced no stderr'}`;
    expect({ ...result, completed }, diagnostics).toEqual({
      code: 0,
      signal: null,
      completed: true,
    });
  }, 20_000);

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

    const subscription = await agent.subscribeToThread({
      resourceId: 'idle-persist-user',
      threadId: 'idle-persist-thread',
    });
    const nextRun = readNextRunWithParts(subscription.stream[Symbol.asyncIterator]());

    try {
      const result = agent.sendSignal(
        { type: 'user-message', contents: 'persist without waking' },
        { resourceId: 'idle-persist-user', threadId: 'idle-persist-thread', ifIdle: { behavior: 'persist' } },
      );
      await expect(result.persisted).resolves.toBeUndefined();

      const subscribedRun = await withTimeout(nextRun, 'Timed out waiting for persisted signal broadcast');
      expect(subscribedRun.value.parts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'data-user-message',
            data: expect.objectContaining({ contents: 'persist without waking' }),
          }),
        ]),
      );
      expect(subscribedRun.value.part).toMatchObject({
        type: 'finish',
        payload: {
          stepResult: { reason: 'stop' },
          output: { usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } },
        },
      });
      expect(subscribedRun.value.part.payload).not.toHaveProperty('usage');

      const recalled = await memory.recall({ threadId: 'idle-persist-thread', resourceId: 'idle-persist-user' });
      expect(streamCount).toBe(0);
      expect(recalled.messages).toHaveLength(1);
      // The synthesized `start` chunk must match the shape of every real start emitter
      // (from + payload.id/messageId) so chunk consumers don't crash on `payload.messageId`.
      expect(subscribedRun.value.parts[0]).toEqual({
        type: 'start',
        runId: expect.any(String),
        from: 'AGENT',
        payload: { id: 'idle-persist-agent', messageId: `persisted-signal:${recalled.messages[0]?.id}` },
      });
      expect(new Set(subscribedRun.value.parts.map(part => part.runId))).toEqual(
        new Set([subscribedRun.value.part.runId]),
      );
      expect((subscribedRun.value.parts[0] as any).payload.messageId).not.toBe(recalled.messages[0]?.id);
      // Stash dropped; payload lives in content.parts now.
      expect(recalled.messages[0]?.content.metadata?.signal).toMatchObject({ type: 'user', tagName: 'user' });
      expect(recalled.messages[0]?.content.parts).toEqual(
        expect.arrayContaining([expect.objectContaining({ type: 'text', text: 'persist without waking' })]),
      );
    } finally {
      subscription.unsubscribe();
    }
  });

  it.each(['reactive', 'system-reminder'] as const)(
    'persists and broadcasts an idle %s signal with independent subscriber exclusions',
    async type => {
      const memory = new MockMemory();
      const target = { threadId: 'hidden-persist-thread', resourceId: 'hidden-persist-user' };
      await memory.createThread(target);
      const agent = new Agent({
        id: 'hidden-persist-agent',
        name: 'Hidden Persist Agent',
        instructions: 'Test',
        model: createTextStreamModel('unused'),
        memory,
      });
      const subscription = await agent.subscribeToThread(target);
      const excluding = await agent.subscribeToThread({ ...target, hideSignals: ['system-reminder'] });
      const includedIterator = subscription.stream[Symbol.asyncIterator]();
      const excludedIterator = excluding.stream[Symbol.asyncIterator]();
      const includedRun = readNextRunWithParts(includedIterator);
      const excludedRun = readNextRunWithParts(excludedIterator);
      try {
        const result = agent.sendSignal(
          { type, contents: 'internal context' },
          {
            ...target,
            ifIdle: { behavior: 'persist' },
          },
        );
        await expect(result.accepted).resolves.toMatchObject({ action: 'persist' });
        await result.persisted;
        expect((await memory.recall(target)).messages).toHaveLength(0);
        const stored = await memory.recall({ ...target, includeSystemReminders: true });
        expect(stored.messages).toHaveLength(1);
        expect(stored.messages[0]?.content.parts).toContainEqual({ type: 'text', text: 'internal context' });
        const [included, excluded] = await withTimeout(
          Promise.all([includedRun, excludedRun]),
          'Idle signal broadcast',
        );
        expect(included.value.parts).toContainEqual(
          expect.objectContaining({
            type: 'data-signal',
            data: expect.objectContaining({ type: 'reactive', contents: 'internal context' }),
          }),
        );
        expect(excluded.value.parts.some(part => part.type === 'data-signal')).toBe(false);
        expect(included.value.part.type).toBe('finish');
        expect(excluded.value.part.type).toBe('finish');
        const idleReaders = Promise.all([includedIterator.next(), excludedIterator.next()]);
        await waitForCondition(() => subscription.activeRunId() === null && excluding.activeRunId() === null);
        expect(subscription.activeRunId()).toBeNull();
        subscription.unsubscribe();
        excluding.unsubscribe();
        await idleReaders;
      } finally {
        subscription.unsubscribe();
        excluding.unsubscribe();
      }
    },
  );

  it.each([undefined, false, true, [], ['reactive'], ['system-reminder']] as const)(
    'keeps stream exclusions %j local while transforms, subscribers and model retain signals',
    async exclusions => {
      const memory = new MockMemory();
      const target = { threadId: crypto.randomUUID(), resourceId: 'exclusions-user' };
      const model = createTextStreamModel('ordinary response');
      const transformed: unknown[] = [];
      const onChunk = vi.fn();
      const agent = new Agent({
        id: 'caller-exclusions-agent',
        name: 'Caller Exclusions',
        instructions: 'Test',
        model,
        memory,
        inputProcessors: [
          {
            id: 'emit-signals',
            processInputStep: async ({ stepNumber, sendSignal }) => {
              if (stepNumber === 0) {
                await sendSignal({ type: 'reactive', id: 'reminder-id', contents: 'retained reminder' });
                await sendSignal({ type: 'state', id: 'state-id', contents: 'retained state' });
              }
            },
          },
        ],
      });
      const subscription = await agent.subscribeToThread({ ...target, hideSignals: false });
      const allExcluded = await agent.subscribeToThread({
        ...target,
        hideSignals: true,
      });
      const includedRun = readNextRunWithParts(subscription.stream[Symbol.asyncIterator]());
      const excludedRun = readNextRunWithParts(allExcluded.stream[Symbol.asyncIterator]());
      try {
        const output = await agent.stream('hello', {
          memory: { thread: target.threadId, resource: target.resourceId },
          hideSignals: typeof exclusions === 'boolean' ? exclusions : exclusions ? [...exclusions] : undefined,
          onChunk,
          experimentalTransform: () =>
            new TransformStream({
              transform(chunk, controller) {
                transformed.push(chunk);
                controller.enqueue(chunk);
              },
            }),
        });
        const direct: unknown[] = [];
        for await (const chunk of output.fullStream) direct.push(chunk);
        const [included, excluded] = await withTimeout(
          Promise.all([includedRun, excludedRun]),
          'Independent signal consumers',
        );
        const reminder = expect.objectContaining({
          type: 'data-signal',
          data: expect.objectContaining({ type: 'reactive', contents: 'retained reminder' }),
        });
        if (exclusions === true || (Array.isArray(exclusions) && exclusions.length))
          expect(direct).not.toContainEqual(reminder);
        else expect(direct).toContainEqual(reminder);
        const state = expect.objectContaining({
          type: 'data-signal',
          data: expect.objectContaining({ type: 'state' }),
        });
        if (exclusions === true) expect(direct).not.toContainEqual(state);
        else expect(direct).toContainEqual(state);
        expect(direct).toContainEqual(expect.objectContaining({ type: 'text-delta' }));
        expect(transformed).toContainEqual(reminder);
        expect(onChunk).toHaveBeenCalledExactlyOnceWith(
          expect.objectContaining({
            type: 'text-delta',
            payload: expect.objectContaining({ text: 'ordinary response' }),
          }),
        );
        expect(included.value.parts).toContainEqual(reminder);
        expect(excluded.value.parts.some(part => part.type === 'data-signal')).toBe(false);
        expect(excluded.value.part.type).toBe('finish');
        expect(JSON.stringify(model.doStreamCalls[0]?.prompt)).toContain('retained reminder');
        expect(await output.text).toBe('ordinary response');
        const stored = await memory.recall({ ...target, includeSystemReminders: true });
        expect(stored.messages.map(message => message.id)).toEqual(expect.arrayContaining(['reminder-id', 'state-id']));
      } finally {
        subscription.unsubscribe();
        allExcluded.unsubscribe();
      }
    },
  );

  it('does not persist or broadcast a transient idle signal when idle behavior is persist', async () => {
    const memory = new MockMemory();
    await memory.createThread({ threadId: 'transient-idle-persist-thread', resourceId: 'transient-idle-persist-user' });
    const agent = new Agent({
      id: 'transient-idle-persist-agent',
      name: 'Transient Idle Persist Agent',
      instructions: 'Test',
      model: createTextStreamModel('unused response'),
      memory,
    });
    const subscription = await agent.subscribeToThread({
      resourceId: 'transient-idle-persist-user',
      threadId: 'transient-idle-persist-thread',
    });
    const iterator = subscription.stream[Symbol.asyncIterator]();

    try {
      const result = agent.sendSignal(
        { type: 'user-message', contents: 'do not retain', transient: true },
        {
          resourceId: 'transient-idle-persist-user',
          threadId: 'transient-idle-persist-thread',
          ifIdle: { behavior: 'persist' },
        },
      );
      await expect(result.accepted).resolves.toEqual({ action: 'discard' });
      expect(result.persisted).toBeUndefined();

      const recalled = await memory.recall({
        threadId: 'transient-idle-persist-thread',
        resourceId: 'transient-idle-persist-user',
      });
      expect(recalled.messages).toHaveLength(0);
      await expect(
        Promise.race([
          iterator.next().then(() => 'broadcast'),
          new Promise(resolve => setTimeout(resolve, 25, 'none')),
        ]),
      ).resolves.toBe('none');
    } finally {
      subscription.unsubscribe();
    }
  });

  it('reports discard and skips storage for a transient active signal when active behavior is persist', async () => {
    const { model, releaseFirst } = createBlockingFirstTextStreamModel('first response', 'unused');
    const memory = new MockMemory();
    await memory.createThread({
      threadId: 'transient-active-persist-thread',
      resourceId: 'transient-active-persist-user',
    });
    const agent = new Agent({
      id: 'transient-active-persist-agent',
      name: 'Transient Active Persist Agent',
      instructions: 'Test',
      model,
      memory,
    });

    const stream = await agent.stream('Hello', {
      memory: { thread: 'transient-active-persist-thread', resource: 'transient-active-persist-user' },
    });
    try {
      const result = agent.sendSignal(
        { type: 'user-message', contents: 'do not retain', transient: true },
        {
          resourceId: 'transient-active-persist-user',
          threadId: 'transient-active-persist-thread',
          ifActive: { behavior: 'persist' },
        },
      );
      await expect(result.accepted).resolves.toEqual({ action: 'discard' });
      expect(result.persisted).toBeUndefined();

      const recalled = await memory.recall({
        threadId: 'transient-active-persist-thread',
        resourceId: 'transient-active-persist-user',
      });
      expect(recalled.messages.filter(message => message.role === 'signal')).toHaveLength(0);
    } finally {
      releaseFirst();
    }
    await expect(stream.text).resolves.toBe('first response');
  });

  it('uses lease ownership as the authority for remote active thread state', async () => {
    const agent = { id: 'lease-authority-agent' } as Agent<any, any, any, any>;
    const key = 'lease-authority-resource\u0000lease-authority-thread';
    const topic = `agent.thread-stream.${encodeURIComponent(key)}`;

    const fallbackPubSub = new RetainedAsyncCallbackPubSub();
    const fallbackRuntime = new AgentThreadStreamRuntime();
    const fallbackSubscription = await fallbackRuntime.subscribeToThread(
      agent,
      { resourceId: 'lease-authority-resource', threadId: 'lease-authority-thread' },
      fallbackPubSub,
    );
    await fallbackPubSub.publish(topic, {
      type: 'run-registered',
      runId: 'fallback-run',
      data: { type: 'run-registered', runId: 'fallback-run', streamId: 'fallback-stream', streamSeq: 1 },
    });
    await fallbackPubSub.flush();
    await waitForCondition(() => fallbackSubscription.activeRunId() === 'fallback-run');
    fallbackSubscription.unsubscribe();

    const stalePubSub = new ControlledLeasePubSub();
    const staleRuntime = new AgentThreadStreamRuntime();
    const staleSubscription = await staleRuntime.subscribeToThread(
      agent,
      { resourceId: 'lease-authority-resource', threadId: 'lease-authority-thread' },
      stalePubSub,
    );
    await stalePubSub.publish(topic, {
      type: 'run-registered',
      runId: 'stale-run',
      data: { type: 'run-registered', runId: 'stale-run', streamId: 'stale-stream', streamSeq: 1 },
    });
    await stalePubSub.flush();
    await nextTick();
    expect(staleSubscription.activeRunId()).toBeNull();
    staleSubscription.unsubscribe();

    const livePubSub = new ControlledLeasePubSub();
    livePubSub.owners.set(key, 'live-run');
    livePubSub.ownerReadFailures = 1;
    const liveRuntime = new AgentThreadStreamRuntime();
    const liveSubscription = await liveRuntime.subscribeToThread(
      agent,
      { resourceId: 'lease-authority-resource', threadId: 'lease-authority-thread' },
      livePubSub,
    );
    await livePubSub.publish(topic, {
      type: 'run-registered',
      runId: 'live-run',
      data: { type: 'run-registered', runId: 'live-run', streamId: 'live-stream', streamSeq: 1 },
    });
    await livePubSub.publish(topic, {
      type: 'stream-part',
      runId: 'live-run',
      data: {
        type: 'stream-part',
        runId: 'live-run',
        streamId: 'live-stream',
        sourceId: 'peer-runtime',
        part: { type: 'start', runId: 'live-run' },
      },
    });
    await livePubSub.flush();
    await waitForCondition(() => liveSubscription.activeRunId() === 'live-run');
    liveSubscription.unsubscribe();
  });

  it('discards local pre-run copies when a drained run loses its reserved lease', async () => {
    const pubsub = new ControlledLeasePubSub();
    const runtime = new AgentThreadStreamRuntime();
    const resourceId = 'drained-reservation-resource';
    const threadId = 'drained-reservation-thread';
    const key = `${resourceId}\u0000${threadId}`;
    const oldRunId = 'drained-reservation-old-run';
    let finishOldRun!: () => void;
    const oldRunFinished = new Promise<void>(resolve => {
      finishOldRun = resolve;
    });
    let signalTransferStarted!: () => void;
    const transferStarted = new Promise<void>(resolve => {
      signalTransferStarted = resolve;
    });
    let releaseTransfer!: () => void;
    pubsub.transferLeaseWait = new Promise<void>(resolve => {
      releaseTransfer = resolve;
    });
    pubsub.onTransferLease = signalTransferStarted;
    pubsub.owners.set(key, oldRunId);

    const agent = { id: 'drained-reservation-agent' } as Agent<any, any, any, any>;
    agent.stream = vi.fn(async (_signal, options) => ({ runId: options.runId })) as any;
    runtime.registerRun(
      agent,
      {
        runId: oldRunId,
        status: 'running',
        fullStream: (async function* () {})(),
        _waitUntilFinished: () => oldRunFinished,
      } as any,
      { runId: oldRunId, memory: { resource: resourceId, thread: threadId } } as any,
      pubsub,
    );
    runtime.sendSignal(
      agent,
      { type: 'user-message', contents: 'start drained run' },
      { resourceId, threadId },
      pubsub,
    );

    finishOldRun();
    await transferStarted;
    const reservedRunId = runtime.getActiveThreadRunId({ resourceId, threadId }, pubsub)!;
    const followUp = runtime.sendSignal(
      agent,
      { type: 'user-message', contents: 'attach during transfer' },
      { resourceId, threadId },
      pubsub,
    );
    await expect(followUp.accepted).resolves.toMatchObject({ action: 'deliver', runId: reservedRunId });

    const winnerRunId = 'drained-reservation-winner';
    pubsub.owners.set(key, winnerRunId);
    releaseTransfer();
    await waitForCondition(() => runtime.getActiveThreadRunId({ resourceId, threadId }, pubsub) === undefined);

    const recoveryRunId = 'drained-reservation-recovery';
    let finishRecovery!: () => void;
    const recoveryFinished = new Promise<void>(resolve => {
      finishRecovery = resolve;
    });
    runtime.registerRun(
      agent,
      {
        runId: recoveryRunId,
        status: 'running',
        fullStream: (async function* () {})(),
        _waitUntilFinished: () => recoveryFinished,
      } as any,
      { runId: recoveryRunId, memory: { resource: resourceId, thread: threadId } } as any,
      pubsub,
    );
    expect(runtime.drainPendingSignals(recoveryRunId, pubsub, 'pre-run')).toEqual([]);
    expect(agent.stream).not.toHaveBeenCalled();
    finishRecovery();
    await pubsub.releaseLease(key, winnerRunId);
  });

  it('drains queued messages when a pre-registration reservation is released', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const resourceId = 'released-reservation-resource';
    const threadId = 'released-reservation-thread';
    const agent = {
      id: 'released-reservation-agent',
      stream: vi.fn(async (_signal, options) => ({ runId: options.runId })),
    } as any;

    await runtime.waitForCrossAgentThreadRun(agent, {
      runId: 'reservation-run',
      memory: { resource: resourceId, thread: threadId },
    });
    const queued = runtime.queueMessage(agent, { contents: 'queued after reservation' }, { resourceId, threadId });
    await expect(queued.accepted).resolves.toMatchObject({ action: 'deliver' });

    runtime.releaseThreadRunReservation('reservation-run');
    await waitForCondition(() => agent.stream.mock.calls.length === 1);

    expect(agent.stream).toHaveBeenCalledWith(
      expect.objectContaining({ contents: 'queued after reservation' }),
      expect.objectContaining({ memory: expect.objectContaining({ resource: resourceId, thread: threadId }) }),
    );
  });

  it('updates the controller request context with the prepared run abort signal', () => {
    const runtime = new AgentThreadStreamRuntime();
    const requestContext = new RequestContext();
    const upstreamAbortController = new AbortController();
    requestContext.set('controller', { abortSignal: upstreamAbortController.signal });

    const prepared = runtime.prepareRunOptions({
      runId: 'controller-abort-run',
      memory: { resource: 'controller-abort-resource', thread: 'controller-abort-thread' },
      abortSignal: upstreamAbortController.signal,
      requestContext,
    } as any);
    const controller = prepared.requestContext?.get('controller') as { abortSignal: AbortSignal };

    expect(controller.abortSignal).toBe(prepared.abortSignal);
    expect(controller.abortSignal).not.toBe(upstreamAbortController.signal);
    expect((requestContext.get('controller') as { abortSignal: AbortSignal }).abortSignal).toBe(
      upstreamAbortController.signal,
    );

    expect(runtime.abortRun('controller-abort-run')).toBe(true);
    expect(controller.abortSignal.aborted).toBe(true);
  });

  it('preserves abort intent for a thread reserved by a signal wake before its run is prepared', async () => {
    const pubsub = new ControlledLeasePubSub();
    const runtime = new AgentThreadStreamRuntime();
    const resourceId = 'reservation-abort-resource';
    const threadId = 'reservation-abort-thread';
    const preparedAborted: boolean[] = [];
    const agent = { id: 'reservation-abort-agent' } as Agent<any, any, any, any>;
    agent.stream = vi.fn(async (_signal, options) => {
      const prepared = runtime.prepareRunOptions(options as any, pubsub);
      preparedAborted.push(prepared.abortSignal?.aborted ?? false);
      if (prepared.abortSignal?.aborted) {
        throw new Error('aborted before start');
      }
      return { runId: (options as any).runId } as any;
    }) as any;

    const result = runtime.sendSignal(
      agent,
      { type: 'user-message', contents: 'wake' },
      { resourceId, threadId },
      pubsub,
    );
    // The thread reservation is taken synchronously inside sendSignal; the lease
    // acquire has not resolved yet, so the run is not in preparedRunsById.
    expect(runtime.abortThread({ resourceId, threadId }, pubsub)).toBe(true);

    await expect(result.accepted).rejects.toThrow('aborted before start');
    expect(preparedAborted).toEqual([true]);
    expect(runtime.getActiveThreadRunId({ resourceId, threadId }, pubsub)).toBeUndefined();
  });

  it('keeps follow-ups attached while a continuation reserves its lease', async () => {
    const pubsub = new ControlledLeasePubSub();
    const runtime = new AgentThreadStreamRuntime();
    const resourceId = 'continuation-reservation-resource';
    const threadId = 'continuation-reservation-thread';
    const key = `${resourceId}\u0000${threadId}`;
    const oldRunId = 'continuation-reservation-old-run';
    let finishOldRun!: () => void;
    const oldRunFinished = new Promise<void>(resolve => {
      finishOldRun = resolve;
    });
    let signalTransferStarted!: () => void;
    const transferStarted = new Promise<void>(resolve => {
      signalTransferStarted = resolve;
    });
    let releaseTransfer!: () => void;
    pubsub.transferLeaseWait = new Promise<void>(resolve => {
      releaseTransfer = resolve;
    });
    pubsub.onTransferLease = signalTransferStarted;
    pubsub.owners.set(key, oldRunId);

    const agent = {
      id: 'continuation-reservation-agent',
      stream: vi.fn(async (_messages, options) => ({ runId: options.runId })),
    } as unknown as Agent<any, any, any, any>;
    runtime.registerRun(
      agent,
      {
        runId: oldRunId,
        status: 'running',
        fullStream: (async function* () {})(),
        _waitUntilFinished: () => oldRunFinished,
      } as any,
      { runId: oldRunId, memory: { resource: resourceId, thread: threadId } } as any,
      pubsub,
    );
    const continuation = runtime.continueWithMessages(
      agent,
      [] as any,
      { resourceId, threadId, streamOptions: { memory: { resource: resourceId, thread: threadId } } as any },
      pubsub,
    );

    finishOldRun();
    await transferStarted;
    const followUp = runtime.sendSignal(
      agent,
      { type: 'user-message', contents: 'attach to continuation' },
      { resourceId, threadId },
      pubsub,
    );
    await expect(followUp.accepted).resolves.toMatchObject({ action: 'deliver', runId: continuation.runId });
    expect(runtime.drainPendingSignals(continuation.runId, pubsub, 'pre-run')).toEqual([
      expect.objectContaining({ contents: 'attach to continuation' }),
    ]);

    releaseTransfer();
    await waitForCondition(() => vi.mocked(agent.stream).mock.calls.length === 1);
    await pubsub.releaseLease(key, continuation.runId);
  });

  it('orders delayed lease validation and ignores stale stream terminal events', async () => {
    const pubsub = new ControlledLeasePubSub();
    const runtime = new AgentThreadStreamRuntime();
    const key = 'ordered-resource\u0000ordered-thread';
    const topic = `agent.thread-stream.${encodeURIComponent(key)}`;
    const runId = 'ordered-run';
    pubsub.owners.set(key, runId);
    pubsub.ownerReadDelayMs = 10;
    const subscription = await runtime.subscribeToThread(
      { id: 'ordered-agent' } as Agent<any, any, any, any>,
      { resourceId: 'ordered-resource', threadId: 'ordered-thread' },
      pubsub,
    );

    for (const data of [
      { type: 'run-registered', runId, streamId: 'ordered-stream-1', streamSeq: 1 },
      { type: 'run-registered', runId, streamId: 'ordered-stream-2', streamSeq: 2 },
      { type: 'run-completed', runId, streamId: 'ordered-stream-1' },
    ]) {
      await pubsub.publish(topic, { type: data.type, runId, data });
    }
    await pubsub.flush();
    await waitForCondition(() => subscription.activeRunId() === runId);
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(subscription.abort()).toBe(true);
    await pubsub.flush();
    await waitForCondition(() =>
      pubsub.publishedData.some(data => data?.type === 'run-abort-requested' && data.streamId === 'ordered-stream-2'),
    );
    subscription.unsubscribe();
  });

  it('bounds remote waits by renewed lease ownership and unsubscribes on exit', async () => {
    const pubsub = new ControlledLeasePubSub();
    const runtime = new AgentThreadStreamRuntime();
    const key = 'bounded-resource\u0000bounded-thread';
    const topic = `agent.thread-stream.${encodeURIComponent(key)}`;
    const runId = 'bounded-run';
    pubsub.owners.set(key, runId);
    const subscription = await runtime.subscribeToThread(
      { id: 'bounded-owner-agent' } as Agent<any, any, any, any>,
      { resourceId: 'bounded-resource', threadId: 'bounded-thread' },
      pubsub,
    );
    await pubsub.publish(topic, {
      type: 'run-registered',
      runId,
      data: { type: 'run-registered', runId, streamId: 'bounded-stream', streamSeq: 1 },
    });
    await pubsub.flush();
    await waitForCondition(() => subscription.activeRunId() === runId);

    vi.useFakeTimers();
    try {
      let resolved = false;
      const wait = runtime
        .waitForCrossAgentThreadRun(
          { id: 'bounded-other-agent' } as Agent<any, any, any, any>,
          { memory: { resource: 'bounded-resource', thread: 'bounded-thread' } },
          pubsub,
        )
        .then(() => {
          resolved = true;
        });
      await vi.advanceTimersByTimeAsync(15_000);
      expect(resolved).toBe(false);
      pubsub.owners.delete(key);
      await vi.advanceTimersByTimeAsync(15_000);
      await wait;
      expect(resolved).toBe(true);
      expect(pubsub.unsubscribeCount).toBeGreaterThanOrEqual(1);
      expect(subscription.activeRunId()).toBeNull();
    } finally {
      vi.useRealTimers();
      subscription.unsubscribe();
    }
  });

  it.each(['run-completed', 'run-discarded'] as const)(
    'ends a remote wait on %s before the lease deadline',
    async terminalType => {
      const pubsub = new ControlledLeasePubSub();
      const runtime = new AgentThreadStreamRuntime();
      const key = 'terminal-wait-resource\u0000terminal-wait-thread';
      const topic = `agent.thread-stream.${encodeURIComponent(key)}`;
      const runId = 'terminal-wait-run';
      pubsub.owners.set(key, runId);
      const subscription = await runtime.subscribeToThread(
        { id: 'terminal-wait-owner' } as Agent<any, any, any, any>,
        { resourceId: 'terminal-wait-resource', threadId: 'terminal-wait-thread' },
        pubsub,
      );
      await pubsub.publish(topic, {
        type: 'run-registered',
        runId,
        data: { type: 'run-registered', runId, streamId: 'terminal-wait-stream', streamSeq: 1 },
      });
      await pubsub.flush();
      await waitForCondition(() => subscription.activeRunId() === runId);

      const wait = runtime.waitForCrossAgentThreadRun(
        { id: 'terminal-wait-other' } as Agent<any, any, any, any>,
        { memory: { resource: 'terminal-wait-resource', thread: 'terminal-wait-thread' } },
        pubsub,
      );
      await pubsub.publish(topic, {
        type: terminalType,
        runId,
        data: { type: terminalType, runId, streamId: 'terminal-wait-stream' },
      });
      await pubsub.flush();
      await expect(wait).resolves.toBeUndefined();
      expect(pubsub.unsubscribeCount).toBeGreaterThanOrEqual(1);
      subscription.unsubscribe();
    },
  );

  it.each(['reactive', 'system-reminder'] as const)(
    'delivers idle %s context to the model and echoes it',
    async type => {
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

      const subscription = await agent.subscribeToThread({
        resourceId: 'system-signal-user',
        threadId: 'system-signal-thread',
      });
      const runPromise = readNextRunWithParts(subscription.stream[Symbol.asyncIterator]());
      const stream = await agent.sendSignal(
        { type, contents: 'continue', attributes: { reminderType: 'test-reminder' } },
        {
          resourceId: 'system-signal-user',
          threadId: 'system-signal-thread',
          ifIdle: { streamOptions: { memory: { resource: 'system-signal-user', thread: 'system-signal-thread' } } },
        },
      );

      await expect(stream.accepted).resolves.toMatchObject({ action: 'wake' });
      const run = await runPromise;
      subscription.unsubscribe();
      expect(run.value.parts.filter((part: any) => part.type === 'data-signal')).toEqual([
        expect.objectContaining({ data: expect.objectContaining({ type: 'reactive', contents: 'continue' }) }),
      ]);
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
    },
  );
});

describe("idle wakes queued behind another agent's run", () => {
  async function startBusyThread(id: string, secondOptions: Record<string, unknown> = {}) {
    const scope = { resourceId: id, threadId: id };
    let releaseFirst!: () => void;
    const firstReleased = new Promise<void>(resolve => {
      releaseFirst = resolve;
    });
    const firstAgent = new Agent({
      id: `${id}-first`,
      name: 'First',
      instructions: 'Test',
      model: new MockLanguageModelV2({
        doStream: async () => {
          await firstReleased;
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'first' },
              { type: 'text-end', id: 'text-1' },
              { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
            ]),
          };
        },
      }),
    });
    const tenants: unknown[] = [];
    const secondModel = createTextStreamModel('second');
    const secondAgent = new Agent({
      id: `${id}-second`,
      name: 'Second',
      instructions: 'Test',
      model: ({ requestContext }) => {
        tenants.push(requestContext.get('tenant'));
        return secondModel;
      },
      ...secondOptions,
    } as ConstructorParameters<typeof Agent>[0]);
    new Mastra({ agents: { firstAgent, secondAgent }, logger: false });
    const firstStream = await firstAgent.stream('Hello', { memory: { thread: id, resource: id } });
    return { scope, secondAgent, secondModel, tenants, releaseFirst, firstText: firstStream.text };
  }

  it('keeps the sender request context when explicit idle stream options omit it', async () => {
    const { scope, secondAgent, secondModel, tenants, releaseFirst, firstText } =
      await startBusyThread('queued-wake-context');
    const requestContext = new RequestContext();
    requestContext.set('tenant', 'acme');
    try {
      await secondAgent.sendSignal(
        { type: 'user-message', contents: 'queued' },
        { ...scope, requestContext, ifIdle: { behavior: 'wake', streamOptions: { maxSteps: 1 } } },
      ).accepted;
      await nextTick();
      expect(secondModel.doStreamCalls).toHaveLength(0);
      releaseFirst();
      await firstText;
      await vi.waitFor(() => expect(secondModel.doStreamCalls).toHaveLength(1));
      expect(tenants.length).toBeGreaterThan(0);
      expect(tenants.every(tenant => tenant === 'acme')).toBe(true);
    } finally {
      releaseFirst();
    }
  });

  it('does not start a queued wake that is cancelled while its wakeOptions hook resolves', async () => {
    let hookEntered!: () => void;
    const entered = new Promise<void>(resolve => {
      hookEntered = resolve;
    });
    let finishHook!: () => void;
    const hookDone = new Promise<void>(resolve => {
      finishHook = resolve;
    });
    const { scope, secondAgent, secondModel, releaseFirst, firstText } = await startBusyThread('queued-wake-cancel', {
      wakeOptions: async () => {
        hookEntered();
        await hookDone;
        return {};
      },
    });
    try {
      const queued = secondAgent.sendSignal(
        { type: 'user-message', contents: 'queued' },
        { ...scope, ifIdle: { behavior: 'wake' } },
      );
      await queued.accepted;
      releaseFirst();
      await firstText;
      await entered;
      expect(secondAgent.cancelQueuedMessages({ ...scope, signalIds: [queued.signal.id] })).toEqual({
        cancelledSignalIds: [queued.signal.id],
      });
      finishHook();
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(secondModel.doStreamCalls).toHaveLength(0);
    } finally {
      releaseFirst();
      finishHook();
    }
  });
});
