import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { RequestContext } from '../../request-context';
import { Agent } from '../agent';
import { createSignal } from '../signals';
import { AgentThreadStreamRuntime, agentThreadStreamRuntime } from '../thread-stream-runtime';
import {
  createTextStreamModel,
  nextTick,
  RetainedAsyncCallbackPubSub,
  readNextRun,
  readNextRunWithParts,
  waitForCondition,
  withTimeout,
} from './signals-test-utils';

describe('Agent signals: thread subscriptions', () => {
  beforeEach(() => {
    agentThreadStreamRuntime.resetForTests();
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

  it('does not seed a replacement subscriber with an aborted run that has not terminalized (#24174)', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const agent = { id: 'aborted-seed-agent' } as Agent<any, any, any, any>;
    const threadId = 'aborted-seed-thread';
    const resourceId = 'aborted-seed-user';
    const memory = { thread: threadId, resource: resourceId };

    const registerRun = (runId: string, parts: any[]) => {
      runtime.prepareRunOptions({ runId, memory } as any);
      let finish!: () => void;
      const finished = new Promise<void>(resolve => {
        finish = resolve;
      });
      let streamController!: ReadableStreamDefaultController<any>;
      const fullStream = new ReadableStream({
        start(controller) {
          streamController = controller;
          for (const part of parts) controller.enqueue(part);
        },
      });
      runtime.registerRun(
        agent,
        { runId, status: 'running', fullStream, _waitUntilFinished: () => finished } as any,
        {
          memory,
        } as any,
      );
      return (closingParts: any[]) => {
        for (const part of closingParts) streamController.enqueue(part);
        streamController.close();
        finish();
      };
    };

    const firstSubscription = await runtime.subscribeToThread(agent, { threadId, resourceId });
    const firstIterator = firstSubscription.stream[Symbol.asyncIterator]();
    let secondSubscription: Awaited<ReturnType<typeof runtime.subscribeToThread>> | undefined;

    try {
      const firstPart = firstIterator.next();
      const endRun1 = registerRun('aborted-seed-run-1', [{ type: 'start', runId: 'aborted-seed-run-1' }]);
      expect((await withTimeout(firstPart, 'first subscriber never saw run 1')).value).toMatchObject({
        runId: 'aborted-seed-run-1',
      });

      // The consumer detaches before the abort, so no subscriber clears run 1's active entry.
      firstSubscription.unsubscribe();
      expect(runtime.abortRun('aborted-seed-run-1')).toBe(true);
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(runtime.getActiveThreadRunId({ threadId, resourceId })).toBe('aborted-seed-run-1');

      // A replacement subscription opened while run 1 is aborted but not yet terminalized.
      secondSubscription = await runtime.subscribeToThread(agent, { threadId, resourceId });
      const secondIterator = secondSubscription.stream[Symbol.asyncIterator]();
      const secondRun = readNextRun(secondIterator);

      // Run 1 then emits its abort chunk and closes.
      endRun1([{ type: 'abort', runId: 'aborted-seed-run-1', payload: {} }]);
      await new Promise(resolve => setTimeout(resolve, 10));

      registerRun('aborted-seed-run-2', [
        { type: 'start', runId: 'aborted-seed-run-2' },
        { type: 'text-delta', runId: 'aborted-seed-run-2', payload: { id: 't', text: 'follow-up' } },
        {
          type: 'finish',
          runId: 'aborted-seed-run-2',
          payload: { usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }, finishReason: 'stop' },
        },
      ])([]);

      // The replacement subscriber sees only the follow-up, never a replay of the aborted run.
      const received = await withTimeout(secondRun, 'replacement subscriber never received the follow-up run');
      expect(received.value).toMatchObject({ runId: 'aborted-seed-run-2', text: 'follow-up' });
    } finally {
      firstSubscription.unsubscribe();
      secondSubscription?.unsubscribe();
    }
  });

  it('keeps request context associated with the exact queued stream record', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const agent = { id: 'request-context-stream-agent' } as Agent<any, any, any, any>;
    const threadId = 'request-context-stream-thread';
    const resourceId = 'request-context-stream-user';
    const runId = 'shared-run-id';
    const firstContext = new RequestContext();
    firstContext.set('name', 'first-context');
    const secondContext = new RequestContext();
    secondContext.set('name', 'second-context');

    const subscription = await runtime.subscribeToThread(agent, { threadId, resourceId });
    const iterator = subscription.stream[Symbol.asyncIterator]();

    const registerCompletedRun = async (requestContext: RequestContext) => {
      let finish!: () => void;
      const finished = new Promise<void>(resolve => {
        finish = resolve;
      });
      const parts = [
        { type: 'start', runId },
        { type: 'finish', runId, payload: { finishReason: 'stop' } },
      ];
      const output = {
        runId,
        status: 'running',
        fullStream: new ReadableStream({
          pull(controller) {
            const part = parts.shift();
            if (part) {
              controller.enqueue(part);
            } else {
              controller.close();
              finish();
            }
          },
        }),
        _waitUntilFinished: () => finished,
      } as any;
      await runtime.registerRun(agent, output, {
        memory: { thread: threadId, resource: resourceId },
        requestContext,
      } as any);
      await nextTick();
    };

    try {
      await registerCompletedRun(firstContext);
      await registerCompletedRun(secondContext);

      const firstStart = await withTimeout(iterator.next(), 'Timed out waiting for first queued stream');
      expect(firstStart.value).toMatchObject({ type: 'start', runId });
      expect(subscription.__getCurrentRunRequestContext()).toBe(firstContext);
      await withTimeout(iterator.next(), 'Timed out waiting for first queued stream finish');

      const secondStart = await withTimeout(iterator.next(), 'Timed out waiting for second queued stream');
      expect(secondStart.value).toMatchObject({ type: 'start', runId });
      expect(subscription.__getCurrentRunRequestContext()).toBe(secondContext);
      await withTimeout(iterator.next(), 'Timed out waiting for second queued stream finish');
    } finally {
      subscription.unsubscribe();
    }
  });

  it('replays completed same-runtime runs without duplicating live local parts', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new RetainedAsyncCallbackPubSub();
    const agent = { id: 'retained-replay-agent' } as Agent<any, any, any, any>;
    const threadId = 'retained-replay-thread';
    const resourceId = 'retained-replay-user';

    const registerRun = (runId: string, text: string) => {
      let finish!: () => void;
      const finished = new Promise<void>(resolve => {
        finish = resolve;
      });
      const parts = [
        { type: 'start', runId },
        { type: 'text-delta', runId, payload: { id: 'text-1', text } },
        { type: 'finish', runId, payload: { finishReason: 'stop' } },
      ];
      const fullStream = new ReadableStream({
        start(controller) {
          setTimeout(() => {
            for (const part of parts) controller.enqueue(part);
            controller.close();
            finish();
          }, 10);
        },
      });
      runtime.registerRun(
        agent,
        { runId, status: 'running', fullStream, _waitUntilFinished: () => finished } as any,
        { memory: { thread: threadId, resource: resourceId } } as any,
        pubsub,
      );
      return parts;
    };

    const liveSubscription = await runtime.subscribeToThread(agent, { threadId, resourceId }, pubsub);
    const expected = registerRun('retained-run-1', 'first');
    const liveRun = await withTimeout(
      readNextRunWithParts(liveSubscription.stream[Symbol.asyncIterator]()),
      'Timed out waiting for live local run',
    );
    expect(liveRun.value.parts).toEqual(expected);
    liveSubscription.unsubscribe();

    await pubsub.flush();
    await nextTick();
    await pubsub.flush();

    const replaySubscription = await runtime.subscribeToThread(agent, { threadId, resourceId }, pubsub);
    const replayIterator = replaySubscription.stream[Symbol.asyncIterator]();
    try {
      const replayedRun = await withTimeout(
        readNextRunWithParts(replayIterator),
        'Timed out waiting for completed same-runtime replay',
      );
      expect(replayedRun.value.parts).toEqual(expected);

      const nextRunPromise = readNextRunWithParts(replayIterator);
      const nextExpected = registerRun('retained-run-2', 'second');
      const nextRun = await withTimeout(nextRunPromise, 'Timed out waiting for run after replay');
      expect(nextRun.value.parts).toEqual(nextExpected);
    } finally {
      replaySubscription.unsubscribe();
      await pubsub.flush();
      await nextTick();
      await pubsub.flush();
    }
  });

  it.each([
    [false, false],
    [false, true],
    [true, false],
    [true, true],
  ])(
    'keeps exclusion policies independent for live and replayed runs (remote: %s, booleans: %s)',
    async (remote, booleans) => {
      const owner = new AgentThreadStreamRuntime();
      const follower = remote ? new AgentThreadStreamRuntime() : owner;
      const pubsub = new RetainedAsyncCallbackPubSub();
      const agent = { id: 'excluded-replay-agent' } as Agent<any, any, any, any>;
      const identity = { threadId: 'excluded-replay-thread', resourceId: 'excluded-replay-user' };
      const runId = 'excluded-replay-run';
      const parts = [
        { type: 'start', runId },
        ...(['reactive', 'user', 'state', 'notification'] as const).map(type => ({
          ...createSignal({ type, contents: `${type} context` }).toDataPart(),
          runId,
        })),
        { type: 'data-signal', runId, data: { type: 'unknown', contents: 'keep unknown' } },
        { type: 'text-delta', runId, payload: { id: 'text', text: 'visible text' } },
        { type: 'finish', runId, payload: { finishReason: 'stop' } },
      ];
      const expectedFiltered = [parts[0], ...parts.slice(5)];
      const subscribe = (excluded: boolean) =>
        follower.subscribeToThread(
          agent,
          {
            ...identity,
            hideSignals: booleans
              ? excluded
              : excluded
                ? ['system-reminder', 'user-message', 'state', 'notification']
                : [],
          },
          pubsub,
        );
      const subscriptions = await Promise.all([subscribe(false), subscribe(true)]);
      try {
        const pendingRuns = subscriptions.map(subscription =>
          readNextRunWithParts(subscription.stream[Symbol.asyncIterator]()),
        );
        let finish!: () => void;
        const finished = new Promise<void>(resolve => {
          finish = resolve;
        });
        await owner.registerRun(
          agent,
          {
            runId,
            status: 'running',
            fullStream: new ReadableStream({
              start(controller) {
                for (const part of parts) controller.enqueue(part);
                controller.close();
                finish();
              },
            }),
            _waitUntilFinished: () => finished,
          } as any,
          { memory: { thread: identity.threadId, resource: identity.resourceId } },
          pubsub,
        );
        const [visible, filtered] = await withTimeout(Promise.all(pendingRuns), 'live filtered fanout stalled');
        expect(visible.value.parts).toEqual(parts);
        expect(filtered.value.parts).toEqual(expectedFiltered);
        subscriptions.forEach(subscription => subscription.unsubscribe());
        await pubsub.flush();
        await nextTick();
        await pubsub.flush();
        const replays = await Promise.all([subscribe(true), subscribe(false)]);
        subscriptions.push(...replays);
        const [filteredReplay, visibleReplay] = await withTimeout(
          Promise.all(replays.map(subscription => readNextRunWithParts(subscription.stream[Symbol.asyncIterator]()))),
          'filtered replay stalled',
        );
        expect(filteredReplay.value.parts).toEqual(expectedFiltered);
        expect(visibleReplay.value.parts).toEqual(parts);
      } finally {
        subscriptions.forEach(subscription => subscription.unsubscribe());
        await pubsub.flush();
        await nextTick();
        await pubsub.flush();
        owner.resetForTests();
        follower.resetForTests();
      }
    },
  );

  it('delivers resumed runs with the same run id to thread subscribers', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const agent = { id: 'resumed-thread-agent' } as Agent<any, any, any, any>;
    const threadId = 'resumed-thread';
    const resourceId = 'resumed-user';
    const runId = 'resumed-run';

    const createRun = (parts: any[]) => {
      let finish!: () => void;
      const finished = new Promise<void>(resolve => {
        finish = resolve;
      });
      const fullStream = new ReadableStream({
        start(controller) {
          setTimeout(() => {
            for (const part of parts) controller.enqueue(part);
            controller.close();
            finish();
          }, 5);
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
    };

    const subscription = await runtime.subscribeToThread(agent, { threadId, resourceId });
    const iterator = subscription.stream[Symbol.asyncIterator]();

    try {
      createRun([
        { type: 'start', runId },
        {
          type: 'tool-call-suspended',
          runId,
          payload: { toolCallId: 'tool-call-1', toolName: 'testTool' },
        },
      ]);

      await withTimeout(iterator.next(), 'Timed out waiting for initial resumed-run start');
      const suspended = await withTimeout(iterator.next(), 'Timed out waiting for suspended chunk');
      expect(suspended.value).toMatchObject({ type: 'tool-call-suspended', runId });
      await waitForCondition(() => subscription.activeRunId() === null);

      const resumedRun = readNextRun(iterator);
      createRun([
        { type: 'start', runId },
        { type: 'text-start', runId, payload: { id: 'text-1' } },
        { type: 'text-delta', runId, payload: { id: 'text-1', text: 'approved response' } },
        { type: 'text-end', runId, payload: { id: 'text-1' } },
        {
          type: 'finish',
          runId,
          payload: { usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }, finishReason: 'stop' },
        },
      ]);

      await expect(withTimeout(resumedRun, 'Timed out waiting for resumed run')).resolves.toMatchObject({
        value: { runId, text: 'approved response' },
      });
    } finally {
      subscription.unsubscribe();
    }
  });

  it('keeps subscriber streams open across tool-call finish boundaries until tool results arrive', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const agent = { id: 'tool-call-boundary-agent' } as Agent<any, any, any, any>;
    const threadId = 'tool-call-boundary-thread';
    const resourceId = 'tool-call-boundary-user';
    const runId = 'tool-call-boundary-run';
    let finish!: () => void;
    const finished = new Promise<void>(resolve => {
      finish = resolve;
    });
    const fullStream = new ReadableStream({
      start(controller) {
        controller.enqueue({ type: 'start', runId });
        controller.enqueue({ type: 'tool-call', runId, payload: { toolCallId: 'tool-1', toolName: 'testTool' } });
        controller.enqueue({
          type: 'finish',
          runId,
          payload: { finishReason: 'tool-calls', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
        });
        controller.enqueue({ type: 'tool-result', runId, payload: { toolCallId: 'tool-1', result: 'tool output' } });
        controller.enqueue({
          type: 'finish',
          runId,
          payload: { finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
        });
        controller.close();
        finish();
      },
    });

    const subscription = await runtime.subscribeToThread(agent, { threadId, resourceId });
    const iterator = subscription.stream[Symbol.asyncIterator]();

    try {
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

      await expect(withTimeout(iterator.next(), 'Timed out waiting for boundary start')).resolves.toMatchObject({
        value: { type: 'start', runId },
      });
      await expect(withTimeout(iterator.next(), 'Timed out waiting for boundary tool call')).resolves.toMatchObject({
        value: { type: 'tool-call', runId },
      });
      await expect(withTimeout(iterator.next(), 'Timed out waiting for tool-call finish')).resolves.toMatchObject({
        value: { type: 'finish', runId, payload: expect.objectContaining({ finishReason: 'tool-calls' }) },
      });
      await expect(withTimeout(iterator.next(), 'Timed out waiting for live tool result')).resolves.toMatchObject({
        value: { type: 'tool-result', runId, payload: expect.objectContaining({ toolCallId: 'tool-1' }) },
      });
      await expect(withTimeout(iterator.next(), 'Timed out waiting for final finish')).resolves.toMatchObject({
        value: { type: 'finish', runId, payload: expect.objectContaining({ finishReason: 'stop' }) },
      });
    } finally {
      subscription.unsubscribe();
    }
  });

  it('assigns a new stream identity to same-run registrations without stale cleanup clearing the active stream', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new EventEmitterPubSub();
    const agent = { id: 'stream-identity-agent' } as Agent<any, any, any, any>;
    const threadId = 'stream-identity-thread';
    const resourceId = 'stream-identity-resource';
    const runId = 'stream-identity-run';
    const topic = `agent.thread-stream.${encodeURIComponent(`${resourceId}\u0000${threadId}`)}`;
    const publishedEvents: any[] = [];
    await pubsub.subscribe(topic, event => publishedEvents.push(event.data));

    const createRun = (text: string, finished: Promise<void>) => {
      const fullStream = new ReadableStream({
        start(controller) {
          controller.enqueue({ type: 'start', runId });
          controller.enqueue({ type: 'text-delta', runId, payload: { text } });
          controller.enqueue({ type: 'finish', runId, payload: { finishReason: 'stop' } });
          controller.close();
        },
      });

      return runtime.registerRun(
        agent,
        {
          runId,
          status: 'running',
          fullStream,
          _waitUntilFinished: () => finished,
        } as any,
        { memory: { thread: threadId, resource: resourceId } } as any,
        pubsub,
      );
    };

    let finishInitial!: () => void;
    const initialFinished = new Promise<void>(resolve => {
      finishInitial = resolve;
    });
    let finishResumed!: () => void;
    const resumedFinished = new Promise<void>(resolve => {
      finishResumed = resolve;
    });

    const subscription = await runtime.subscribeToThread(agent, { threadId, resourceId }, pubsub);
    const iterator = subscription.stream[Symbol.asyncIterator]();

    try {
      const initialRun = readNextRun(iterator);
      await createRun('initial response', initialFinished);
      await expect(withTimeout(initialRun, 'Timed out waiting for initial stream identity run')).resolves.toMatchObject(
        {
          value: { runId, text: 'initial response' },
        },
      );
      expect(subscription.activeRunId()).toBe(runId);

      const resumedRun = readNextRun(iterator);
      await createRun('resumed response', resumedFinished);
      await expect(withTimeout(resumedRun, 'Timed out waiting for resumed stream identity run')).resolves.toMatchObject(
        {
          value: { runId, text: 'resumed response' },
        },
      );

      const registeredEvents = publishedEvents.filter(event => event?.type === 'run-registered');
      expect(registeredEvents).toHaveLength(2);
      expect(registeredEvents.map(event => event.runId)).toEqual([runId, runId]);
      expect(registeredEvents.map(event => event.streamSeq)).toEqual([1, 2]);
      expect(registeredEvents[0].streamId).toEqual(expect.any(String));
      expect(registeredEvents[1].streamId).toEqual(expect.any(String));
      expect(registeredEvents[1].streamId).not.toBe(registeredEvents[0].streamId);

      finishInitial();
      await nextTick();
      expect(subscription.activeRunId()).toBe(runId);

      finishResumed();
      await waitForCondition(() => subscription.activeRunId() === null);
    } finally {
      subscription.unsubscribe();
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
    await expect(signalResult.accepted).resolves.toMatchObject({ action: 'wake', runId: signalRun.value.runId });
    expect(signalResult.signal.id).toBeDefined();
    expect(signalRun.value.text).toBe('standalone shared response');

    subscription.unsubscribe();
  });

  it('propagates standalone parent pubsub to child agents without their own pubsub', async () => {
    const pubsub = new EventEmitterPubSub();
    const child = new Agent({
      id: 'standalone-child-agent',
      name: 'Standalone Child Agent',
      instructions: 'Test',
      model: createTextStreamModel('child response'),
    });
    const parent = new Agent({
      id: 'standalone-parent-agent',
      name: 'Standalone Parent Agent',
      instructions: 'Test',
      model: createTextStreamModel('parent response'),
      pubsub,
      agents: { child },
    });

    await parent.listAgents();

    expect(child.getPubSub()).toBe(pubsub);

    const secondPubSub = new EventEmitterPubSub();
    const secondParent = new Agent({
      id: 'second-standalone-parent-agent',
      name: 'Second Standalone Parent Agent',
      instructions: 'Test',
      model: createTextStreamModel('second parent response'),
      pubsub: secondPubSub,
      agents: { child },
    });

    await secondParent.listAgents();

    expect(child.getPubSub()).toBe(secondPubSub);
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

    await runner.getPubSub()?.flush?.();
    const result = await Promise.race([
      nextRunPromise.then(() => 'delivered'),
      new Promise<'timeout'>(resolve => setTimeout(() => resolve('timeout'), 100)),
    ]);
    expect(result).toBe('timeout');

    subscription.unsubscribe();
    await nextRunPromise;
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
    // Mastra wraps the raw pubsub in a Proxy (for localOnly tagging), so
    // reference equality against the raw instance won't hold. Verify both
    // agents share the *same* (proxy-wrapped) pubsub instead.
    expect(runner.getPubSub()).toBe(observer.getPubSub());

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
    await expect(signalResult.accepted).resolves.toMatchObject({ action: 'wake', runId: signalRun.value.runId });
    expect(signalResult.signal.id).toBeDefined();
    expect(signalRun.value.text).toBe('shared response');

    subscription.unsubscribe();
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

  it('allows a thread follower to abort the active run controller', () => {
    const runtime = new AgentThreadStreamRuntime();
    const options = runtime.prepareRunOptions({
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
});
