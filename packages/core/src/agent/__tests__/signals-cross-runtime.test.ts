import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import { EventEmitterPubSub } from '../../events/event-emitter';
import { UnixSocketPubSub } from '../../events/unix-socket-pubsub';
import { Agent } from '../agent';
import { AgentThreadStreamRuntime, agentThreadStreamRuntime } from '../thread-stream-runtime';
import {
  createTextStreamModel,
  nextTick,
  ControlledLeasePubSub,
  readNextRun,
  readNextRunWithParts,
  waitForCondition,
  withTimeout,
} from './signals-test-utils';

describe('Agent signals: cross-runtime routing', () => {
  beforeEach(() => {
    agentThreadStreamRuntime.resetForTests();
  });

  it('does not abort a successor run when the expected run has completed', async () => {
    const pubsub = new ControlledLeasePubSub();
    const runtime = new AgentThreadStreamRuntime();
    const resourceId = 'conditional-abort-resource';
    const threadId = 'conditional-abort-thread';
    const successorRunId = 'run-b';
    const options = runtime.prepareRunOptions(
      { runId: successorRunId, memory: { resource: resourceId, thread: threadId } } as any,
      pubsub,
    );

    runtime.registerRun(
      { id: 'conditional-abort-agent' } as Agent<any, any, any, any>,
      {
        runId: successorRunId,
        status: 'running',
        fullStream: (async function* () {})(),
        _waitUntilFinished: () => new Promise<void>(() => {}),
      } as any,
      options,
      pubsub,
    );

    const agent = { id: 'conditional-abort-agent' } as Agent<any, any, any, any>;
    const pending = runtime.sendSignal(
      agent,
      { type: 'user-message', contents: 'queued for successor' },
      { resourceId, threadId },
      pubsub,
    );
    await pending.accepted;

    // A stale clear-on-abort must neither stop the successor nor drop its queued input.
    expect(
      runtime.abortThread({ resourceId, threadId, expectedRunId: 'run-a', clearPendingSignals: true }, pubsub),
    ).toBe(false);
    expect(options.abortSignal?.aborted).toBe(false);
    expect(runtime.getActiveThreadRunId({ resourceId, threadId }, pubsub)).toBe(successorRunId);
    expect(
      runtime.cancelQueuedMessages(agent, { resourceId, threadId, signalIds: [pending.signal.id] }, pubsub),
    ).toEqual({ cancelledSignalIds: [pending.signal.id] });

    expect(runtime.abortThread({ resourceId, threadId, expectedRunId: successorRunId }, pubsub)).toBe(true);
    expect(options.abortSignal?.aborted).toBe(true);
  });

  it('routes remote abort requests to only the live lease owner', async () => {
    const pubsub = new ControlledLeasePubSub();
    const ownerRuntime = new AgentThreadStreamRuntime();
    const followerRuntime = new AgentThreadStreamRuntime();
    const key = 'remote-abort-resource\u0000remote-abort-thread';
    const runId = 'remote-abort-run';
    pubsub.owners.set(key, runId);
    const ownerSubscription = await ownerRuntime.subscribeToThread(
      { id: 'remote-abort-agent' } as Agent<any, any, any, any>,
      { resourceId: 'remote-abort-resource', threadId: 'remote-abort-thread' },
      pubsub,
    );
    const followerSubscription = await followerRuntime.subscribeToThread(
      { id: 'remote-abort-agent' } as Agent<any, any, any, any>,
      { resourceId: 'remote-abort-resource', threadId: 'remote-abort-thread' },
      pubsub,
    );
    expect(followerSubscription.abort()).toBe(false);

    const options = ownerRuntime.prepareRunOptions(
      { runId, memory: { resource: 'remote-abort-resource', thread: 'remote-abort-thread' } } as any,
      pubsub,
    );
    ownerRuntime.registerRun(
      { id: 'remote-abort-agent' } as Agent<any, any, any, any>,
      {
        runId,
        status: 'running',
        fullStream: (async function* () {})(),
        _waitUntilFinished: () => new Promise<void>(() => {}),
      } as any,
      options,
      pubsub,
    );
    await pubsub.flush();
    await waitForCondition(() => followerSubscription.activeRunId() === runId);
    const publishedBeforeMismatch = pubsub.publishedData.length;
    expect(
      followerRuntime.abortThread(
        {
          resourceId: 'remote-abort-resource',
          threadId: 'remote-abort-thread',
          expectedRunId: 'completed-run',
        },
        pubsub,
      ),
    ).toBe(false);
    expect(pubsub.publishedData).toHaveLength(publishedBeforeMismatch);
    expect(
      followerRuntime.abortThread(
        { resourceId: 'remote-abort-resource', threadId: 'remote-abort-thread', expectedRunId: runId },
        pubsub,
      ),
    ).toBe(true);
    expect(options.abortSignal?.aborted).toBe(false);
    await pubsub.flush();
    await waitForCondition(() => options.abortSignal?.aborted === true);
    const requestIndex = pubsub.publishedData.findIndex(data => data?.type === 'run-abort-requested');
    const terminalIndex = pubsub.publishedData.findIndex(data => data?.type === 'run-aborted');
    expect(requestIndex).toBeGreaterThanOrEqual(0);
    expect(terminalIndex).toBeGreaterThan(requestIndex);
    expect(pubsub.owners.get(key)).toBeUndefined();

    const terminalCount = pubsub.publishedData.filter(data => data?.type === 'run-aborted').length;
    await pubsub.publish(`agent.thread-stream.${encodeURIComponent(key)}`, {
      type: 'run-abort-requested',
      runId,
      data: { type: 'run-abort-requested', runId, streamId: 'stale-stream' },
    });
    await pubsub.flush();
    await nextTick();
    expect(pubsub.publishedData.filter(data => data?.type === 'run-aborted')).toHaveLength(terminalCount);
    ownerSubscription.unsubscribe();
    followerSubscription.unsubscribe();
  });

  it('keeps a remote owner run alive when a thread teardown aborts locally', async () => {
    const pubsub = new ControlledLeasePubSub();
    const ownerRuntime = new AgentThreadStreamRuntime();
    const followerRuntime = new AgentThreadStreamRuntime();
    const resourceId = 'local-abort-resource';
    const threadId = 'local-abort-thread';
    const key = `${resourceId}\u0000${threadId}`;
    const runId = 'local-abort-run';
    pubsub.owners.set(key, runId);
    const ownerSubscription = await ownerRuntime.subscribeToThread(
      { id: 'local-abort-agent' } as Agent<any, any, any, any>,
      { resourceId, threadId },
      pubsub,
    );
    const followerSubscription = await followerRuntime.subscribeToThread(
      { id: 'local-abort-agent' } as Agent<any, any, any, any>,
      { resourceId, threadId },
      pubsub,
    );

    const options = ownerRuntime.prepareRunOptions(
      { runId, memory: { resource: resourceId, thread: threadId } } as any,
      pubsub,
    );
    ownerRuntime.registerRun(
      { id: 'local-abort-agent' } as Agent<any, any, any, any>,
      {
        runId,
        status: 'running',
        fullStream: (async function* () {})(),
        _waitUntilFinished: () => new Promise<void>(() => {}),
      } as any,
      options,
      pubsub,
    );
    await pubsub.flush();
    await waitForCondition(() => followerSubscription.activeRunId() === runId);

    // Unbinding a thread (a follower running `/new`, or a session teardown) stops
    // this process's own run and must not reach the owner's run over PubSub.
    const publishedBeforeLocalAbort = pubsub.publishedData.length;
    expect(followerSubscription.abort({ localOnly: true })).toBe(false);
    await pubsub.flush();
    await nextTick();
    expect(options.abortSignal?.aborted).toBe(false);
    expect(pubsub.publishedData).toHaveLength(publishedBeforeLocalAbort);
    expect(pubsub.publishedData.some(data => data?.type === 'run-abort-requested')).toBe(false);
    // The owner still holds the live lease, so a real abort from this follower
    // would have been forwarded — the suppression above is what kept it alive.
    expect(pubsub.owners.get(key)).toBe(runId);

    ownerSubscription.unsubscribe();
    followerSubscription.unsubscribe();
  });

  it('routes remote abort requests to a parked suspended run on the lease owner', async () => {
    const pubsub = new ControlledLeasePubSub();
    const ownerRuntime = new AgentThreadStreamRuntime();
    const followerRuntime = new AgentThreadStreamRuntime();
    const resourceId = 'parked-remote-abort-resource';
    const threadId = 'parked-remote-abort-thread';
    const key = `${resourceId}\u0000${threadId}`;
    const runId = 'parked-remote-abort-run';
    const agent = { id: 'parked-remote-abort-agent' } as Agent<any, any, any, any>;
    pubsub.owners.set(key, runId);
    const ownerSubscription = await ownerRuntime.subscribeToThread(agent, { resourceId, threadId }, pubsub);
    const followerSubscription = await followerRuntime.subscribeToThread(agent, { resourceId, threadId }, pubsub);
    const iterator = ownerSubscription.stream[Symbol.asyncIterator]();
    let finishRun!: () => void;
    const finished = new Promise<void>(resolve => {
      finishRun = resolve;
    });

    try {
      ownerRuntime.registerRun(
        agent,
        {
          runId,
          status: 'suspended',
          fullStream: new ReadableStream({
            start(controller) {
              controller.enqueue({ type: 'start', runId });
              controller.enqueue({
                type: 'tool-call-suspended',
                runId,
                payload: { toolCallId: 'parked-remote-abort-call', toolName: 'ask_user' },
              });
              controller.close();
            },
          }),
          _waitUntilFinished: () => finished,
        } as any,
        { memory: { thread: threadId, resource: resourceId } } as any,
        pubsub,
      );
      await withTimeout(iterator.next(), 'Timed out waiting for parked remote run start');
      await withTimeout(iterator.next(), 'Timed out waiting for parked remote suspension chunk');
      await pubsub.flush();
      await waitForCondition(() => followerSubscription.activeRunId() === runId);

      // Park the run for real: the completion watcher evicts it from
      // preparedRunsById and marks its record lifecycle 'suspended'.
      finishRun();
      await pubsub.flush();
      await waitForCondition(() =>
        pubsub.publishedData.some(data => data?.type === 'run-suspended' && data.runId === runId),
      );
      expect(ownerRuntime.hasThreadRun(runId, pubsub)).toBe(true);
      expect(ownerRuntime.getActiveThreadRunId({ resourceId, threadId }, pubsub)).toBe(runId);

      // A forged request with a stale streamId is still dropped: the parked-run
      // guard relaxation must not weaken the ownership checks.
      await pubsub.publish(`agent.thread-stream.${encodeURIComponent(key)}`, {
        type: 'run-abort-requested',
        runId,
        data: { type: 'run-abort-requested', runId, streamId: 'stale-stream' },
      });
      await pubsub.flush();
      await nextTick();
      expect(pubsub.publishedData.some(data => data?.type === 'run-aborted')).toBe(false);
      expect(ownerRuntime.hasThreadRun(runId, pubsub)).toBe(true);
      expect(pubsub.owners.get(key)).toBe(runId);

      // The real remote abort releases the parked run on the owner.
      expect(followerSubscription.abort()).toBe(true);
      await pubsub.flush();
      await waitForCondition(() =>
        pubsub.publishedData.some(data => data?.type === 'run-aborted' && data.runId === runId),
      );
      const requestIndex = pubsub.publishedData.findIndex(
        data => data?.type === 'run-abort-requested' && data.streamId !== 'stale-stream',
      );
      const terminalIndex = pubsub.publishedData.findIndex(data => data?.type === 'run-aborted');
      expect(requestIndex).toBeGreaterThanOrEqual(0);
      expect(terminalIndex).toBeGreaterThan(requestIndex);
      expect(ownerRuntime.hasThreadRun(runId, pubsub)).toBe(false);
      expect(ownerRuntime.getActiveThreadRunId({ resourceId, threadId }, pubsub)).toBeUndefined();
      expect(ownerRuntime.getThreadState({ resourceId, threadId }, pubsub)).toBe('idle');
      expect(pubsub.owners.get(key)).toBeUndefined();
      expect(ownerRuntime.abortThread({ resourceId, threadId }, pubsub)).toBe(false);
    } finally {
      finishRun();
      ownerSubscription.unsubscribe();
      followerSubscription.unsubscribe();
    }
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

    await pubsub.acquireLease('remote-resource\u0000remote-thread', 'remote-run-1', 15000);
    ownerRuntime.registerRun(
      owner,
      output,
      { runId: 'remote-run-1', memory: { resource: 'remote-resource', thread: 'remote-thread' } } as any,
      pubsub,
    );
    await waitForCondition(() => senderSubscription.activeRunId() === 'remote-run-1');

    let waitResolved = false;
    const waitForRemoteRun = senderRuntime
      .waitForCrossAgentThreadRun(
        new Agent({
          id: 'remote-other-agent',
          name: 'Remote Other Agent',
          instructions: 'Test',
          model: createTextStreamModel('other response'),
        }),
        { memory: { resource: 'remote-resource', thread: 'remote-thread' } },
        pubsub,
      )
      .then(() => {
        waitResolved = true;
      });
    await nextTick();
    expect(waitResolved).toBe(false);

    const result = senderRuntime.sendSignal(
      sender,
      {
        type: 'user-message',
        contents: 'remote follow-up',
        metadata: { channel: { attachmentId: 'file-remote' } },
      },
      { resourceId: 'remote-resource', threadId: 'remote-thread' },
      pubsub,
    );

    await expect(result.accepted).resolves.toMatchObject({ action: 'deliver' });
    let deliveredSignals: ReturnType<typeof ownerRuntime.drainPendingSignals> = [];
    await waitForCondition(() => {
      deliveredSignals = ownerRuntime.drainPendingSignals('remote-run-1', pubsub);
      return deliveredSignals.length === 1;
    });
    expect(deliveredSignals[0]?.metadata).toEqual({ channel: { attachmentId: 'file-remote' } });

    finishRun();
    await waitForRemoteRun;
    await pubsub.releaseLease('remote-resource\u0000remote-thread', 'remote-run-1');
    ownerSubscription.unsubscribe();
    senderSubscription.unsubscribe();
  });

  it('wakes a new run instead of delivering to a stale remote active run id', async () => {
    const pubsub = new EventEmitterPubSub();
    const ownerRuntime = new AgentThreadStreamRuntime();
    const senderRuntime = new AgentThreadStreamRuntime();
    const owner = new Agent({
      id: 'stale-remote-signal-agent',
      name: 'Stale Remote Signal Owner Agent',
      instructions: 'Test',
      model: createTextStreamModel('owner response'),
    });
    const sender = new Agent({
      id: 'stale-remote-signal-agent',
      name: 'Stale Remote Signal Sender Agent',
      instructions: 'Test',
      model: createTextStreamModel('sender response'),
    });
    let finishRun!: () => void;
    const output = {
      runId: 'stale-remote-run-1',
      status: 'running',
      fullStream: (async function* () {})(),
      _waitUntilFinished: () => new Promise<void>(resolve => (finishRun = resolve)),
    } as any;

    const senderSubscription = await senderRuntime.subscribeToThread(
      sender,
      {
        resourceId: 'stale-remote-resource',
        threadId: 'stale-remote-thread',
      },
      pubsub,
    );
    await pubsub.acquireLease('stale-remote-resource\u0000stale-remote-thread', 'stale-remote-run-1', 15000);
    ownerRuntime.registerRun(
      owner,
      output,
      {
        runId: 'stale-remote-run-1',
        memory: { resource: 'stale-remote-resource', thread: 'stale-remote-thread' },
      } as any,
      pubsub,
    );
    await waitForCondition(() => senderSubscription.activeRunId() === 'stale-remote-run-1');

    senderSubscription.unsubscribe();
    finishRun();
    await nextTick();
    await pubsub.releaseLease('stale-remote-resource\u0000stale-remote-thread', 'stale-remote-run-1');

    const result = senderRuntime.sendSignal(
      sender,
      { type: 'user-message', contents: 'stale remote follow-up' },
      { resourceId: 'stale-remote-resource', threadId: 'stale-remote-thread' },
      pubsub,
    );

    await expect(result.accepted).resolves.toMatchObject({ action: 'wake' });
    await expect(result.accepted).resolves.not.toMatchObject({ runId: 'stale-remote-run-1' });
  });

  it('grants the wake output to exactly one runtime when two race to wake an idle thread', async () => {
    const pubsub = new EventEmitterPubSub();
    const runtimeA = new AgentThreadStreamRuntime();
    const runtimeB = new AgentThreadStreamRuntime();

    // Track which agents had their .stream invoked. Only the lease winner
    // should actually call .stream(); the loser must short-circuit.
    const streamCallsA: number[] = [];
    const streamCallsB: number[] = [];

    const makeStubAgent = (id: string, calls: number[]) => {
      let nextRunId = 0;
      return {
        id,
        stream: async () => {
          const runId = `${id}-run-${++nextRunId}`;
          calls.push(nextRunId);
          return {
            runId,
            status: 'running',
            fullStream: (async function* () {})(),
            _waitUntilFinished: () => new Promise<void>(() => {}),
          } as any;
        },
      } as any;
    };

    const agentA = makeStubAgent('race-agent-a', streamCallsA);
    const agentB = makeStubAgent('race-agent-b', streamCallsB);

    const target = {
      resourceId: 'race-resource',
      threadId: 'race-thread',
      ifIdle: {
        behavior: 'wake' as const,
        streamOptions: { memory: { resource: 'race-resource', thread: 'race-thread' } },
      },
    };

    // Fire both signals in the same microtask burst so the lease race is real.
    const resultA = runtimeA.sendSignal(agentA, { type: 'user-message', contents: 'from A' }, target, pubsub);
    const resultB = runtimeB.sendSignal(agentB, { type: 'user-message', contents: 'from B' }, target, pubsub);

    expect(resultA.accepted).toBeInstanceOf(Promise);
    expect(resultB.accepted).toBeInstanceOf(Promise);

    const [settledA, settledB] = await Promise.all([resultA.accepted, resultB.accepted]);

    // Exactly one runtime won the lease and ran the stream (`wake` + owned output); the
    // loser forwarded its signal to the winner and resolves to `deliver`.
    const ownerA = settledA.action === 'wake' ? settledA.output : undefined;
    const ownerB = settledB.action === 'wake' ? settledB.output : undefined;
    const winners = [ownerA, ownerB].filter(s => s !== undefined);
    expect(winners).toHaveLength(1);

    const actions = [settledA.action, settledB.action].sort();
    expect(actions).toEqual(['deliver', 'wake']);

    // Only the winner's agent.stream was invoked.
    const totalStreamCalls = streamCallsA.length + streamCallsB.length;
    expect(totalStreamCalls).toBe(1);
  });

  it.runIf(process.platform !== 'win32')(
    'queues a signal on the real UnixSocketPubSub execution-lease owner',
    async () => {
      const tempDir = await mkdtemp(join(tmpdir(), 'mastra-agent-execution-lease-'));
      const socketPath = join(tempDir, 'signals.sock');
      const ownerPubSub = new UnixSocketPubSub(socketPath);
      const senderPubSub = new UnixSocketPubSub(socketPath);
      const ownerRuntime = new AgentThreadStreamRuntime();
      const senderRuntime = new AgentThreadStreamRuntime();
      const owner = new Agent({
        id: 'unix-execution-lease-agent',
        name: 'Unix Execution Lease Owner',
        instructions: 'Test',
        model: createTextStreamModel('owner response'),
      });
      const sender = new Agent({
        id: 'unix-execution-lease-agent',
        name: 'Unix Execution Lease Sender',
        instructions: 'Test',
        model: createTextStreamModel('sender response'),
      });
      const scope = { resourceId: 'unix-execution-resource', threadId: 'unix-execution-thread' };
      const key = `${scope.resourceId}\u0000${scope.threadId}`;
      const runId = 'unix-execution-run';
      let finishRun!: () => void;
      const output = {
        runId,
        status: 'running',
        fullStream: (async function* () {})(),
        _waitUntilFinished: () => new Promise<void>(resolve => (finishRun = resolve)),
      } as any;

      try {
        const ownerSubscription = await ownerRuntime.subscribeToThread(owner, scope, ownerPubSub);
        const senderSubscription = await senderRuntime.subscribeToThread(sender, scope, senderPubSub);
        const ownerClaim = await ownerRuntime.claimThreadOwnership(
          owner,
          { ...scope, yieldOwnership: () => true },
          ownerPubSub,
        );
        expect(ownerClaim.claimed).toBe(true);
        expect(await ownerPubSub.acquireLease(key, runId, 15_000)).toMatchObject({ acquired: true });
        ownerRuntime.registerRun(
          owner,
          output,
          { runId, memory: { resource: scope.resourceId, thread: scope.threadId } } as any,
          ownerPubSub,
        );
        await waitForCondition(() => senderSubscription.activeRunId() === runId);

        const senderClaim = await senderRuntime.claimThreadOwnership(sender, scope, senderPubSub);
        expect(senderClaim.claimed).toBe(true);

        const send = async (contents: string) => {
          const result = senderRuntime.sendSignal(sender, { type: 'user-message', contents }, scope, senderPubSub);
          await expect(result.accepted).resolves.toMatchObject({ action: 'deliver' });

          let deliveredSignals: ReturnType<typeof ownerRuntime.drainPendingSignals> = [];
          await waitForCondition(() => {
            deliveredSignals = ownerRuntime.drainPendingSignals(runId, ownerPubSub);
            return deliveredSignals.length === 1;
          });
          expect(deliveredSignals[0]?.contents).toBe(contents);
        };

        await send('queued while remote run is active');
        await send('queued after claim ownership yielded');

        finishRun();
        senderClaim.unsubscribe();
        ownerClaim.unsubscribe();
        await ownerPubSub.releaseLease(key, runId);
        ownerSubscription.unsubscribe();
        senderSubscription.unsubscribe();
      } finally {
        await Promise.allSettled([ownerPubSub.close(), senderPubSub.close()]);
        await rm(tempDir, { recursive: true, force: true });
      }
    },
  );

  it.runIf(process.platform !== 'win32')(
    'broadcasts subscribed thread stream parts across UnixSocketPubSub runtime instances',
    async () => {
      const tempDir = await mkdtemp(join(tmpdir(), 'mastra-agent-signals-'));
      const ownerPubSub = new UnixSocketPubSub(join(tempDir, 'signals.sock'));
      const followerPubSub = new UnixSocketPubSub(join(tempDir, 'signals.sock'));
      const ownerRuntime = new AgentThreadStreamRuntime();
      const followerRuntime = new AgentThreadStreamRuntime();
      const owner = new Agent({
        id: 'unix-stream-agent',
        name: 'Unix Stream Owner Agent',
        instructions: 'Test',
        model: createTextStreamModel('owner response'),
      });
      const follower = new Agent({
        id: 'unix-stream-agent',
        name: 'Unix Stream Follower Agent',
        instructions: 'Test',
        model: createTextStreamModel('follower response'),
      });
      let finishRun!: () => void;
      const output = {
        runId: 'unix-run-1',
        status: 'running',
        fullStream: (async function* () {
          yield { type: 'text-delta', runId: 'unix-run-1', payload: { text: 'hello over uds' } };
          yield { type: 'finish', runId: 'unix-run-1', payload: {} };
        })(),
        _waitUntilFinished: () => new Promise<void>(resolve => (finishRun = resolve)),
      } as any;

      try {
        const ownerSubscription = await ownerRuntime.subscribeToThread(
          owner,
          { resourceId: 'unix-resource', threadId: 'unix-thread' },
          ownerPubSub,
        );
        const followerSubscription = await followerRuntime.subscribeToThread(
          follower,
          { resourceId: 'unix-resource', threadId: 'unix-thread' },
          followerPubSub,
        );
        const ownerRun = readNextRunWithParts(ownerSubscription.stream[Symbol.asyncIterator]());
        const followerRun = readNextRunWithParts(followerSubscription.stream[Symbol.asyncIterator]());

        ownerRuntime.registerRun(
          owner,
          output,
          { runId: 'unix-run-1', memory: { resource: 'unix-resource', thread: 'unix-thread' } } as any,
          ownerPubSub,
        );

        await expect(ownerRun).resolves.toMatchObject({ value: { text: 'hello over uds' }, done: false });
        await expect(followerRun).resolves.toMatchObject({ value: { text: 'hello over uds' }, done: false });
        finishRun();
        ownerSubscription.unsubscribe();
        followerSubscription.unsubscribe();
      } finally {
        await Promise.allSettled([ownerPubSub.close(), followerPubSub.close()]);
        await rm(tempDir, { recursive: true, force: true });
      }
    },
  );

  it.runIf(process.platform !== 'win32')(
    'lets a remote subscriber join an already-active UnixSocketPubSub run',
    async () => {
      const tempDir = await mkdtemp(join(tmpdir(), 'mastra-agent-late-subscriber-'));
      const ownerPubSub = new UnixSocketPubSub(join(tempDir, 'signals.sock'));
      const followerPubSub = new UnixSocketPubSub(join(tempDir, 'signals.sock'));
      const ownerRuntime = new AgentThreadStreamRuntime();
      const followerRuntime = new AgentThreadStreamRuntime();
      const owner = { id: 'late-subscriber-agent' } as Agent<any, any, any, any>;
      const follower = { id: 'late-subscriber-agent' } as Agent<any, any, any, any>;
      const runId = 'late-subscriber-run';
      const threadKey = 'late-subscriber-resource\u0000late-subscriber-thread';
      let firstPartBroadcasted!: () => void;
      let continueRun!: () => void;
      let finishLateRun!: () => void;
      let finishRun!: () => void;
      const firstPart = new Promise<void>(resolve => (firstPartBroadcasted = resolve));
      const continuePromise = new Promise<void>(resolve => (continueRun = resolve));
      const finishLateRunPromise = new Promise<void>(resolve => (finishLateRun = resolve));
      const finished = new Promise<void>(resolve => (finishRun = resolve));
      const output = {
        runId,
        status: 'running',
        fullStream: (async function* () {
          yield { type: 'text-delta', runId, payload: { text: 'before subscriber' } };
          firstPartBroadcasted();
          await continuePromise;
          yield { type: 'text-delta', runId, payload: { text: 'after subscriber' } };
          await finishLateRunPromise;
          yield { type: 'finish', runId, payload: {} };
          finishRun();
        })(),
        _waitUntilFinished: () => finished,
      } as any;

      try {
        await expect(ownerPubSub.acquireLease(threadKey, runId, 15_000)).resolves.toMatchObject({ acquired: true });
        ownerRuntime.registerRun(
          owner,
          output,
          { runId, memory: { resource: 'late-subscriber-resource', thread: 'late-subscriber-thread' } } as any,
          ownerPubSub,
        );
        await withTimeout(firstPart, 'Timed out waiting for owner run to start');
        await expect(followerPubSub.getLeaseOwner(threadKey)).resolves.toBe(runId);

        const followerSubscription = await followerRuntime.subscribeToThread(
          follower,
          { resourceId: 'late-subscriber-resource', threadId: 'late-subscriber-thread' },
          followerPubSub,
        );
        const followerPart = followerSubscription.stream[Symbol.asyncIterator]().next();

        continueRun();
        await expect(withTimeout(followerPart, 'Timed out waiting for late subscriber', 2_000)).resolves.toMatchObject({
          value: { runId, type: 'text-delta', payload: { text: 'after subscriber' } },
          done: false,
        });
        expect(followerSubscription.activeRunId()).toBe(runId);
        finishLateRun();
        followerSubscription.unsubscribe();
        await ownerPubSub.releaseLease(threadKey, runId);
      } finally {
        finishLateRun();
        await Promise.allSettled([ownerPubSub.close(), followerPubSub.close()]);
        await rm(tempDir, { recursive: true, force: true });
      }
    },
  );

  it.runIf(process.platform !== 'win32')(
    'broadcasts to a remote subscriber without a same-runtime subscriber',
    async () => {
      const tempDir = await mkdtemp(join(tmpdir(), 'mastra-agent-remote-only-'));
      const ownerPubSub = new UnixSocketPubSub(join(tempDir, 'signals.sock'));
      const followerPubSub = new UnixSocketPubSub(join(tempDir, 'signals.sock'));
      const ownerRuntime = new AgentThreadStreamRuntime();
      const followerRuntime = new AgentThreadStreamRuntime();
      const owner = { id: 'remote-only-agent' } as Agent<any, any, any, any>;
      const follower = { id: 'remote-only-agent' } as Agent<any, any, any, any>;
      const runId = 'remote-only-run';
      let finishRun!: () => void;
      const output = {
        runId,
        status: 'running',
        fullStream: (async function* () {
          yield { type: 'text-delta', runId, payload: { text: 'remote only response' } };
          yield { type: 'finish', runId, payload: {} };
        })(),
        _waitUntilFinished: () => new Promise<void>(resolve => (finishRun = resolve)),
      } as any;

      try {
        const followerSubscription = await followerRuntime.subscribeToThread(
          follower,
          { resourceId: 'remote-only-resource', threadId: 'remote-only-thread' },
          followerPubSub,
        );
        const followerRun = readNextRun(followerSubscription.stream[Symbol.asyncIterator]());

        ownerRuntime.registerRun(
          owner,
          output,
          { runId, memory: { resource: 'remote-only-resource', thread: 'remote-only-thread' } } as any,
          ownerPubSub,
        );

        await expect(withTimeout(followerRun, 'Timed out waiting for remote-only subscriber')).resolves.toMatchObject({
          value: { runId, text: 'remote only response' },
          done: false,
        });
        finishRun();
        followerSubscription.unsubscribe();
      } finally {
        await Promise.allSettled([ownerPubSub.close(), followerPubSub.close()]);
        await rm(tempDir, { recursive: true, force: true });
      }
    },
  );
});
