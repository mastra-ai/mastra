import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EventEmitterPubSub } from '../../events/event-emitter';
import type { EventCallback } from '../../events/types';
import { RequestContext } from '../../request-context';
import { Agent } from '../agent';
import { AgentThreadStreamRuntime, agentThreadStreamRuntime } from '../thread-stream-runtime';
import {
  createTextStreamModel,
  createBlockingFirstTextStreamModel,
  nextTick,
  RetainedAsyncCallbackPubSub,
  ControlledLeasePubSub,
  HangingUnsubscribePubSub,
  DroppingAcceptanceReplyPubSub,
  readNextRunWithParts,
  waitForCondition,
  withTimeout,
} from './signals-test-utils';

describe('Agent signals: claimed thread ownership', () => {
  beforeEach(() => {
    agentThreadStreamRuntime.resetForTests();
  });

  it('starts an idle thread run without cross-agent owner discovery when a user-message signal is sent', async () => {
    const pubsub = new ControlledLeasePubSub();
    const agent = new Agent({
      id: 'idle-signal-agent',
      name: 'Idle Signal Agent',
      instructions: 'Test',
      model: createTextStreamModel('signal response'),
      pubsub,
    });

    const subscription = await agent.subscribeToThread({
      threadId: 'idle-thread',
      resourceId: 'idle-user',
    });
    const nextRun = readNextRunWithParts(subscription.stream[Symbol.asyncIterator]());

    const signalResult = await agent.sendSignal(
      { type: 'user-message', contents: 'Hello from signal' },
      {
        resourceId: 'idle-user',
        threadId: 'idle-thread',
        ifIdle: { streamOptions: { memory: { resource: 'idle-user', thread: 'idle-thread' } } },
      },
    );

    const subscribedRun = await nextRun;
    await expect(signalResult.accepted).resolves.toMatchObject({ action: 'wake', runId: subscribedRun.value.runId });
    expect(pubsub.publishedData.some(data => data?.type === 'thread-owner-discovery')).toBe(false);
    expect(signalResult.signal.id).toBeDefined();
    expect(signalResult.signal.acceptedAt).toBeInstanceOf(Date);
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

  it('wakes idle threads through the registered thread-runtime agent instead of the wrapped agent', async () => {
    // Durable wrappers that are not Agent subclasses (the Inngest Proxy) forward
    // sendSignal() to the wrapped agent. The runtime must still start the idle
    // run on the wrapper so the woken turn takes the durable path.
    const pubsub = new EventEmitterPubSub();
    const agent = new Agent({
      id: 'runtime-agent-wrapper',
      name: 'Runtime Agent Wrapper',
      instructions: 'Test',
      model: createTextStreamModel('wrapped response'),
      pubsub,
    });
    const wrapper = {
      id: agent.id,
      stream: vi.fn((...args: Parameters<Agent['stream']>) => agent.stream(...args)),
    };
    agent.__setThreadRuntimeAgent(wrapper as unknown as Agent<any, any, any, any>);

    const signalResult = await agent.sendSignal(
      { type: 'user-message', contents: 'Hello through the wrapper' },
      {
        resourceId: 'wrapper-user',
        threadId: 'wrapper-thread',
        ifIdle: { streamOptions: { memory: { resource: 'wrapper-user', thread: 'wrapper-thread' } } },
      },
    );

    const accepted = await signalResult.accepted;
    expect(accepted).toMatchObject({ action: 'wake' });
    if (accepted.action !== 'wake') throw new Error('Expected signal wake');
    expect(await accepted.output.text).toBe('wrapped response');
    expect(wrapper.stream).toHaveBeenCalledTimes(1);
    expect(wrapper.stream.mock.calls[0]?.[0]).toBe(signalResult.signal);
    expect(wrapper.stream.mock.calls[0]?.[1]).toMatchObject({ untilIdle: true, runId: accepted.runId });
  });

  it('wakes the claimed owner when the current runtime owns the thread claim', async () => {
    const pubsub = new EventEmitterPubSub();
    const agent = new Agent({
      id: 'local-owner-agent',
      name: 'Local Owner Agent',
      instructions: 'Test',
      model: createTextStreamModel('local owner response'),
      pubsub,
    });

    const subscription = await agent.subscribeToThread({
      resourceId: 'local-owner-user',
      threadId: 'local-owner-thread',
    });
    const nextRun = readNextRunWithParts(subscription.stream[Symbol.asyncIterator]());
    const claim = await agent.claimThreadOwnership({
      resourceId: 'local-owner-user',
      threadId: 'local-owner-thread',
      streamOptions: { memory: { resource: 'local-owner-user', thread: 'local-owner-thread' } },
    });
    expect(claim.claimed).toBe(true);

    const signalResult = await agent.sendSignal(
      { type: 'user-message', contents: 'wake local owner' },
      {
        resourceId: 'local-owner-user',
        threadId: 'local-owner-thread',
        ifIdle: {
          behavior: 'wake',
          streamOptions: { memory: { resource: 'local-owner-user', thread: 'local-owner-thread' } },
        },
      },
    );

    const subscribedRun = await withTimeout(nextRun, 'Timed out waiting for local owner run');
    // The claimed owner ran the turn in this process, so this is a `wake`, not a
    // `deliver`: `deliver` means no run started locally and the signal joined a
    // run that was already in flight.
    await expect(signalResult.accepted).resolves.toMatchObject({ action: 'wake', runId: subscribedRun.value.runId });
    expect(subscribedRun.value.text).toBe('local owner response');

    claim.unsubscribe();
    subscription.unsubscribe();
  });

  it('honors the incoming request context when waking a locally claimed thread owner', async () => {
    // A claimed owner's stream options belong to whichever run claimed the
    // thread, so they do not carry the context of every later wake. A wake that
    // brings its own request context — a dispatcher starting a turn on behalf of
    // an authenticated caller — has to have it applied to the woken run, or the
    // run starts anonymously and downstream resolution rejects the caller.
    const pubsub = new EventEmitterPubSub();
    const runtime = new AgentThreadStreamRuntime();
    const ownerAgent = {
      id: 'context-owner',
      stream: vi.fn(async () => ({})),
    } as unknown as Agent;
    const senderAgent = new Agent({
      id: 'context-sender',
      name: 'Context Sender',
      instructions: 'Test',
      model: createTextStreamModel('sender response'),
      pubsub,
    });
    const claim = await runtime.claimThreadOwnership(
      ownerAgent,
      {
        resourceId: 'context-user',
        threadId: 'context-thread',
        streamOptions: { memory: { resource: 'context-user', thread: 'context-thread' } },
      },
      pubsub,
    );
    expect(claim.claimed).toBe(true);
    const requestContext = new RequestContext();
    requestContext.set('caller', { organizationId: 'context-org' });

    const signalResult = runtime.sendSignal(
      senderAgent,
      { type: 'user-message', contents: 'wake with context' },
      {
        resourceId: 'context-user',
        threadId: 'context-thread',
        ifIdle: {
          behavior: 'wake',
          requireClaimedOwner: true,
          streamOptions: { requestContext },
        },
      },
      pubsub,
    );

    const accepted = await signalResult.accepted;
    expect(accepted).toMatchObject({ action: 'wake' });
    if (accepted.action !== 'wake') throw new Error('Expected signal wake');
    expect(accepted.output).toBeDefined();
    expect(ownerAgent.stream).toHaveBeenCalledTimes(1);
    expect(ownerAgent.stream.mock.calls[0]?.[1]).toMatchObject({ requestContext });
    // Options the claim itself contributed must survive the merge.
    expect(ownerAgent.stream.mock.calls[0]?.[1]?.memory).toEqual({
      resource: 'context-user',
      thread: 'context-thread',
    });

    claim.unsubscribe();
  });

  it('routes idle signals to the claimed thread owner runtime', async () => {
    const pubsub = new EventEmitterPubSub();
    const ownerRuntime = agentThreadStreamRuntime;
    const senderRuntime = new AgentThreadStreamRuntime();
    const ownerAgent = new Agent({
      id: 'owner-agent',
      name: 'Owner Agent',
      instructions: 'Test',
      model: createTextStreamModel('owner response'),
      pubsub,
    });
    const senderAgent = new Agent({
      id: 'owner-sender',
      name: 'Owner Sender',
      instructions: 'Test',
      model: createTextStreamModel('sender response'),
      pubsub,
    });

    const subscription = await ownerRuntime.subscribeToThread(
      ownerAgent,
      {
        resourceId: 'owner-user',
        threadId: 'owner-thread',
      },
      pubsub,
    );
    const nextRun = readNextRunWithParts(subscription.stream[Symbol.asyncIterator]());
    const claim = await ownerRuntime.claimThreadOwnership(
      ownerAgent,
      {
        resourceId: 'owner-user',
        threadId: 'owner-thread',
        streamOptions: { memory: { resource: 'owner-user', thread: 'owner-thread' } },
      },
      pubsub,
    );
    expect(claim.claimed).toBe(true);

    const signalResult = senderRuntime.sendSignal(
      senderAgent,
      { type: 'user-message', contents: 'wake the owner' },
      {
        resourceId: 'owner-user',
        threadId: 'owner-thread',
        ifIdle: { behavior: 'wake', requireClaimedOwner: true },
      },
      pubsub,
    );

    await expect(signalResult.accepted).resolves.toMatchObject({ action: 'deliver' });
    const subscribedRun = await nextRun;
    expect(subscribedRun.value.text).toBe('owner response');

    claim.unsubscribe();
    subscription.unsubscribe();
  });

  it('routes concurrent idle signals that arrive during claimed-owner discovery', async () => {
    const pubsub = new ControlledLeasePubSub();
    const ownerRuntime = agentThreadStreamRuntime;
    const senderRuntime = new AgentThreadStreamRuntime();
    const ownerAgent = new Agent({
      id: 'concurrent-discovery-owner',
      name: 'Concurrent Discovery Owner',
      instructions: 'Test',
      model: createTextStreamModel('concurrent owner response'),
      pubsub,
    });
    const senderAgent = new Agent({
      id: 'concurrent-discovery-sender',
      name: 'Concurrent Discovery Sender',
      instructions: 'Test',
      model: createTextStreamModel('sender response'),
      pubsub,
    });
    const subscription = await ownerRuntime.subscribeToThread(
      ownerAgent,
      { resourceId: 'concurrent-discovery-user', threadId: 'concurrent-discovery-thread' },
      pubsub,
    );
    const iterator = subscription.stream[Symbol.asyncIterator]();
    const firstRun = readNextRunWithParts(iterator);
    const claim = await ownerRuntime.claimThreadOwnership(
      ownerAgent,
      { resourceId: 'concurrent-discovery-user', threadId: 'concurrent-discovery-thread' },
      pubsub,
    );

    try {
      const firstSignal = senderRuntime.sendSignal(
        senderAgent,
        { type: 'user-message', contents: 'first concurrent signal' },
        {
          resourceId: 'concurrent-discovery-user',
          threadId: 'concurrent-discovery-thread',
          ifIdle: { behavior: 'wake', requireClaimedOwner: true },
        },
        pubsub,
      );
      const secondSignal = senderRuntime.sendSignal(
        senderAgent,
        { type: 'user-message', contents: 'second concurrent signal' },
        {
          resourceId: 'concurrent-discovery-user',
          threadId: 'concurrent-discovery-thread',
          ifIdle: { behavior: 'wake' },
        },
        pubsub,
      );

      await expect(Promise.all([firstSignal.accepted, secondSignal.accepted])).resolves.toEqual([
        expect.objectContaining({ action: 'deliver' }),
        expect.objectContaining({ action: 'deliver' }),
      ]);
      const deliveredRuns = [
        await firstRun,
        await withTimeout(readNextRunWithParts(iterator), 'Timed out waiting for concurrent owner run'),
      ];
      expect(deliveredRuns.map(run => run.value.text)).toEqual([
        'concurrent owner response',
        'concurrent owner response',
      ]);
      expect(
        deliveredRuns.map(run => run.value.parts.find((part: any) => part.type === 'data-user-message')?.data.contents),
      ).toEqual(expect.arrayContaining(['first concurrent signal', 'second concurrent signal']));
    } finally {
      claim.unsubscribe();
      subscription.unsubscribe();
    }
  });

  it('acknowledges remote claimed-owner delivery only after stream admission', async () => {
    const pubsub = new ControlledLeasePubSub();
    const ownerRuntime = new AgentThreadStreamRuntime();
    const senderRuntime = new AgentThreadStreamRuntime();
    let releaseAdmission!: () => void;
    let markAdmissionStarted!: () => void;
    const admissionGate = new Promise<void>(resolve => {
      releaseAdmission = resolve;
    });
    const admissionStarted = new Promise<void>(resolve => {
      markAdmissionStarted = resolve;
    });
    const ownerAgent = {
      id: 'admission-owner',
      stream: vi.fn(async () => {
        markAdmissionStarted();
        await admissionGate;
        return {};
      }),
    } as unknown as Agent;
    const senderAgent = new Agent({
      id: 'admission-sender',
      name: 'Admission Sender',
      instructions: 'Test',
      model: createTextStreamModel('sender response'),
      pubsub,
    });
    const claim = await ownerRuntime.claimThreadOwnership(
      ownerAgent,
      { resourceId: 'admission-user', threadId: 'admission-thread' },
      pubsub,
    );

    const signalResult = senderRuntime.sendSignal(
      senderAgent,
      { type: 'user-message', contents: 'wait for admission' },
      {
        resourceId: 'admission-user',
        threadId: 'admission-thread',
        ifIdle: { behavior: 'wake', requireClaimedOwner: true },
      },
      pubsub,
    );
    let settled = false;
    void signalResult.accepted.finally(() => {
      settled = true;
    });

    await admissionStarted;
    await Promise.resolve();
    expect(settled).toBe(false);
    releaseAdmission();
    await expect(signalResult.accepted).resolves.toMatchObject({ action: 'deliver' });

    claim.unsubscribe();
  });

  it('rejects remote claimed-owner delivery when stream admission fails', async () => {
    const pubsub = new ControlledLeasePubSub();
    const ownerRuntime = new AgentThreadStreamRuntime();
    const senderRuntime = new AgentThreadStreamRuntime();
    const ownerAgent = {
      id: 'rejected-owner',
      stream: vi.fn().mockRejectedValue(new Error('stream admission failed')),
    } as unknown as Agent;
    const senderAgent = new Agent({
      id: 'rejected-sender',
      name: 'Rejected Sender',
      instructions: 'Test',
      model: createTextStreamModel('sender response'),
      pubsub,
    });
    const claim = await ownerRuntime.claimThreadOwnership(
      ownerAgent,
      { resourceId: 'rejected-user', threadId: 'rejected-thread' },
      pubsub,
    );

    const signalResult = senderRuntime.sendSignal(
      senderAgent,
      { type: 'user-message', contents: 'reject failed admission' },
      {
        resourceId: 'rejected-user',
        threadId: 'rejected-thread',
        ifIdle: { behavior: 'wake', requireClaimedOwner: true },
      },
      pubsub,
    );

    await expect(signalResult.accepted).rejects.toThrow('stream admission failed');

    claim.unsubscribe();
  });

  it('keeps an admitted claimed-owner run when acknowledgement publication rejects after delivery', async () => {
    const pubsub = new ControlledLeasePubSub();
    const ownerRuntime = new AgentThreadStreamRuntime();
    const senderRuntime = new AgentThreadStreamRuntime();
    const ownerAgent = new Agent({
      id: 'delivered-ack-owner',
      name: 'Delivered Ack Owner',
      instructions: 'Test',
      model: createTextStreamModel('admitted owner response'),
      pubsub,
    });
    const senderAgent = new Agent({
      id: 'delivered-ack-sender',
      name: 'Delivered Ack Sender',
      instructions: 'Test',
      model: createTextStreamModel('sender response'),
      pubsub,
    });
    const subscription = await ownerRuntime.subscribeToThread(
      ownerAgent,
      { resourceId: 'delivered-ack-user', threadId: 'delivered-ack-thread' },
      pubsub,
    );
    const nextRun = readNextRunWithParts(subscription.stream[Symbol.asyncIterator]());
    const claim = await ownerRuntime.claimThreadOwnership(
      ownerAgent,
      { resourceId: 'delivered-ack-user', threadId: 'delivered-ack-thread' },
      pubsub,
    );
    pubsub.rejectPublishedTypes.add('idle-signal-accepted');

    const signalResult = senderRuntime.sendSignal(
      senderAgent,
      { type: 'user-message', contents: 'admit despite post-delivery rejection' },
      {
        resourceId: 'delivered-ack-user',
        threadId: 'delivered-ack-thread',
        ifIdle: { behavior: 'wake', requireClaimedOwner: true },
      },
      pubsub,
    );

    await expect(signalResult.accepted).resolves.toMatchObject({ action: 'deliver' });
    await expect(nextRun).resolves.toMatchObject({ value: { text: 'admitted owner response' } });
    expect(pubsub.publishedData.filter(data => data?.type === 'idle-signal-rejected')).toHaveLength(0);

    claim.unsubscribe();
    subscription.unsubscribe();
  });

  it('deduplicates a retried logical message when the acceptance reply is lost', async () => {
    const pubsub = new DroppingAcceptanceReplyPubSub();
    const ownerRuntime = new AgentThreadStreamRuntime();
    const senderRuntime = new AgentThreadStreamRuntime();
    const { model, releaseFirst, getStreamCount } = createBlockingFirstTextStreamModel(
      'first retried owner response',
      'duplicate retried owner response',
    );
    const ownerAgent = new Agent({
      id: 'retry-logical-owner',
      name: 'Retry Logical Owner',
      instructions: 'Test',
      model,
      pubsub,
    });
    const senderAgent = new Agent({
      id: 'retry-logical-sender',
      name: 'Retry Logical Sender',
      instructions: 'Test',
      model: createTextStreamModel('sender response'),
      pubsub,
    });
    const target = { resourceId: 'retry-logical-user', threadId: 'retry-logical-thread' };
    const attributes = { messageId: 'retry-logical-message', sourcePeerId: 'retry-logical-peer' };
    const subscription = await ownerRuntime.subscribeToThread(ownerAgent, target, pubsub);
    const firstRun = readNextRunWithParts(subscription.stream[Symbol.asyncIterator]());
    const claim = await ownerRuntime.claimThreadOwnership(ownerAgent, target, pubsub);
    pubsub.droppedAcceptanceReplies = 1;

    try {
      const firstSignal = senderRuntime.sendSignal(
        senderAgent,
        { type: 'user-message', contents: 'wake the owner exactly once', attributes },
        { ...target, ifIdle: { behavior: 'wake', requireClaimedOwner: true } },
        pubsub,
      );
      await waitForCondition(() => getStreamCount() === 1);
      await waitForCondition(() => pubsub.publishedData.some(data => data?.type === 'idle-signal-accepted'));
      const originalRunId = pubsub.publishedData.find(data => data?.type === 'idle-signal-accepted')?.runId;
      expect(originalRunId).toBeTruthy();

      // The sender never received that acknowledgement, so it retries the same
      // logical message. The retry mints a fresh transport request id, which the
      // request-id dedup cannot catch, so the owner must recognise the logical
      // identity and report the acceptance it already made instead of waking again.
      const retrySignal = senderRuntime.sendSignal(
        senderAgent,
        { type: 'user-message', contents: 'wake the owner exactly once', attributes },
        { ...target, ifIdle: { behavior: 'wake', requireClaimedOwner: true } },
        pubsub,
      );
      await expect(retrySignal.accepted).resolves.toMatchObject({ action: 'deliver', runId: originalRunId });
      expect(getStreamCount()).toBe(1);

      releaseFirst();
      await firstRun;
      await pubsub.flush();
      expect(getStreamCount()).toBe(1);
      expect(pubsub.publishedData.filter(data => data?.type === 'idle-signal-rejected')).toHaveLength(0);
      // The first attempt stays pending until its acceptance timeout; swallow the
      // eventual rejection so it cannot surface as an unhandled rejection.
      void firstSignal.accepted.catch(() => {});
    } finally {
      releaseFirst();
      claim.unsubscribe();
      subscription.unsubscribe();
    }
  });

  it('resolves a retry of a completed logical message to the completed run', async () => {
    const pubsub = new ControlledLeasePubSub();
    const ownerRuntime = new AgentThreadStreamRuntime();
    const senderRuntime = new AgentThreadStreamRuntime();
    const { model, releaseFirst, getStreamCount } = createBlockingFirstTextStreamModel(
      'completed retried owner response',
      'unexpected duplicate owner response',
    );
    const ownerAgent = new Agent({
      id: 'retry-completed-owner',
      name: 'Retry Completed Owner',
      instructions: 'Test',
      model,
      pubsub,
    });
    const senderAgent = new Agent({
      id: 'retry-completed-sender',
      name: 'Retry Completed Sender',
      instructions: 'Test',
      model: createTextStreamModel('sender response'),
      pubsub,
    });
    const target = { resourceId: 'retry-completed-user', threadId: 'retry-completed-thread' };
    const attributes = { messageId: 'retry-completed-message', sourcePeerId: 'retry-completed-peer' };
    const subscription = await ownerRuntime.subscribeToThread(ownerAgent, target, pubsub);
    const firstRun = readNextRunWithParts(subscription.stream[Symbol.asyncIterator]());
    const claim = await ownerRuntime.claimThreadOwnership(ownerAgent, target, pubsub);

    try {
      const firstSignal = senderRuntime.sendSignal(
        senderAgent,
        { type: 'user-message', contents: 'complete the owner run once', attributes },
        { ...target, ifIdle: { behavior: 'wake', requireClaimedOwner: true } },
        pubsub,
      );
      const firstAccepted = await firstSignal.accepted;
      expect(firstAccepted).toMatchObject({ action: 'deliver' });
      await waitForCondition(() => getStreamCount() === 1);

      releaseFirst();
      await expect(firstRun).resolves.toMatchObject({ value: { text: 'completed retried owner response' } });

      const retrySignal = senderRuntime.sendSignal(
        senderAgent,
        { type: 'user-message', contents: 'complete the owner run once', attributes },
        { ...target, ifIdle: { behavior: 'wake', requireClaimedOwner: true } },
        pubsub,
      );
      await expect(retrySignal.accepted).resolves.toMatchObject({
        action: 'deliver',
        runId: (firstAccepted as { runId: string }).runId,
      });
      await pubsub.flush();
      expect(getStreamCount()).toBe(1);
    } finally {
      releaseFirst();
      claim.unsubscribe();
      subscription.unsubscribe();
    }
  });

  it('reports the terminal cancellation to a retry of a cancelled queued message', async () => {
    const pubsub = new ControlledLeasePubSub();
    const ownerRuntime = new AgentThreadStreamRuntime();
    const senderRuntime = new AgentThreadStreamRuntime();
    const { model, releaseFirst, getStreamCount } = createBlockingFirstTextStreamModel(
      'held owner response',
      'unexpected drained owner response',
    );
    const ownerAgent = new Agent({
      id: 'retry-cancelled-owner',
      name: 'Retry Cancelled Owner',
      instructions: 'Test',
      model,
      pubsub,
    });
    const senderAgent = new Agent({
      id: 'retry-cancelled-sender',
      name: 'Retry Cancelled Sender',
      instructions: 'Test',
      model: createTextStreamModel('sender response'),
      pubsub,
    });
    const target = { resourceId: 'retry-cancelled-user', threadId: 'retry-cancelled-thread' };
    const attributes = { messageId: 'retry-cancelled-message', sourcePeerId: 'retry-cancelled-peer' };
    const subscription = await ownerRuntime.subscribeToThread(ownerAgent, target, pubsub);
    const firstRun = readNextRunWithParts(subscription.stream[Symbol.asyncIterator]());
    const claim = await ownerRuntime.claimThreadOwnership(ownerAgent, target, pubsub);

    try {
      const holdSignal = senderRuntime.sendSignal(
        senderAgent,
        {
          type: 'user-message',
          contents: 'hold the thread',
          attributes: { messageId: 'retry-cancelled-hold', sourcePeerId: 'retry-cancelled-peer' },
        },
        { ...target, ifIdle: { behavior: 'wake', requireClaimedOwner: true } },
        pubsub,
      );
      await expect(holdSignal.accepted).resolves.toMatchObject({ action: 'deliver' });
      await waitForCondition(() => getStreamCount() === 1);

      const queuedSignal = senderRuntime.sendSignal(
        senderAgent,
        { type: 'user-message', contents: 'queue then cancel', attributes },
        { ...target, ifIdle: { behavior: 'wake', requireClaimedOwner: true } },
        pubsub,
      );
      await expect(queuedSignal.accepted).resolves.toMatchObject({ action: 'deliver' });
      expect(getStreamCount()).toBe(1);

      const cancelled = ownerRuntime.cancelQueuedMessages(
        ownerAgent,
        { ...target, signalIds: [queuedSignal.signal.id] },
        pubsub,
      );
      expect(cancelled.cancelledSignalIds).toEqual([queuedSignal.signal.id]);

      const retrySignal = senderRuntime.sendSignal(
        senderAgent,
        { type: 'user-message', contents: 'queue then cancel', attributes },
        { ...target, ifIdle: { behavior: 'wake', requireClaimedOwner: true } },
        pubsub,
      );
      await expect(retrySignal.accepted).rejects.toThrow('cancelled before it ran');
      expect(getStreamCount()).toBe(1);

      releaseFirst();
      await expect(firstRun).resolves.toMatchObject({ value: { text: 'held owner response' } });
      await pubsub.flush();
      expect(getStreamCount()).toBe(1);
    } finally {
      releaseFirst();
      claim.unsubscribe();
      subscription.unsubscribe();
    }
  });

  it('releases the logical message reservation when the owner rejects its stream options, so a retry can route', async () => {
    const pubsub = new ControlledLeasePubSub();
    const ownerRuntime = new AgentThreadStreamRuntime();
    const senderRuntime = new AgentThreadStreamRuntime();
    const model = createTextStreamModel('routed owner response');
    const ownerAgent = new Agent({
      id: 'retry-stream-options-owner',
      name: 'Retry Stream Options Owner',
      instructions: 'Test',
      model,
      pubsub,
    });
    const senderAgent = new Agent({
      id: 'retry-stream-options-sender',
      name: 'Retry Stream Options Sender',
      instructions: 'Test',
      model: createTextStreamModel('sender response'),
      pubsub,
    });
    const target = { resourceId: 'retry-stream-options-user', threadId: 'retry-stream-options-thread' };
    const attributes = { messageId: 'retry-stream-options-message', sourcePeerId: 'retry-stream-options-peer' };
    const subscription = await ownerRuntime.subscribeToThread(ownerAgent, target, pubsub);
    // Only the first wake attempt fails to resolve its options. Claiming the thread
    // must still be able to resolve them, so the flag is raised after the claim.
    let failNextStreamOptions = false;
    const claim = await ownerRuntime.claimThreadOwnership(
      ownerAgent,
      {
        resourceId: target.resourceId,
        threadId: target.threadId,
        streamOptions: () => {
          if (failNextStreamOptions) {
            failNextStreamOptions = false;
            throw new Error('retry stream options rejected');
          }
          return {};
        },
      },
      pubsub,
    );
    failNextStreamOptions = true;

    try {
      const firstSignal = senderRuntime.sendSignal(
        senderAgent,
        { type: 'user-message', contents: 'route the retried wake', attributes },
        { ...target, ifIdle: { behavior: 'wake', requireClaimedOwner: true } },
        pubsub,
      );
      // The attempt never admitted a run, so the sender must be told it failed
      // rather than that this logical message was already accepted.
      await expect(firstSignal.accepted).rejects.toThrow('retry stream options rejected');
      expect(model.doStreamCalls ?? []).toHaveLength(0);

      // The retry carries the same logical identity. Its fresh transport request id
      // cannot reach the reservation, so only releasing it on the failed attempt lets
      // this wake route instead of being resolved to a run that never started.
      const retryRun = readNextRunWithParts(subscription.stream[Symbol.asyncIterator]());
      const retrySignal = senderRuntime.sendSignal(
        senderAgent,
        { type: 'user-message', contents: 'route the retried wake', attributes },
        { ...target, ifIdle: { behavior: 'wake', requireClaimedOwner: true } },
        pubsub,
      );
      await expect(retrySignal.accepted).resolves.toMatchObject({ action: 'deliver' });
      // A leaked reservation resolves the retry without running it, so assert the
      // wake actually reached the model before waiting on the run to finish.
      await waitForCondition(() => (model.doStreamCalls ?? []).length === 1);
      await expect(retryRun).resolves.toMatchObject({ value: { text: 'routed owner response' } });
      expect(failNextStreamOptions).toBe(false);
      expect(model.doStreamCalls ?? []).toHaveLength(1);
    } finally {
      claim.unsubscribe();
      subscription.unsubscribe();
    }
  });

  it('holds a concurrent retry until the first admission resolves, so a rejected wake is not reported as delivered', async () => {
    const scope = { resourceId: 'race-admission', threadId: 'race-admission' };
    const pubsub = new ControlledLeasePubSub();
    const model = createTextStreamModel('unused');
    const agent = new Agent({ id: 'race-admission', name: 'Race Admission', instructions: 'Test', model, pubsub });
    let release!: () => void;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    let entered!: () => void;
    const entering = new Promise<void>(resolve => {
      entered = resolve;
    });
    let streamOptionsCalls = 0;
    const claim = await agent.claimThreadOwnership({
      ...scope,
      streamOptions: async () => {
        streamOptionsCalls += 1;
        entered();
        await gate;
        throw new Error('concurrent retry rejected');
      },
    });
    const attributes = { messageId: 'race-admission-message', sourcePeerId: 'race-admission-peer' };
    const first = agent.sendSignal({ type: 'user-message', contents: 'race the admission', attributes }, scope);
    void first.accepted.catch(() => {});
    try {
      // The first delivery has reserved the logical message and is still resolving
      // its admission: it has neither queued nor started a run, and may still reject.
      await entering;

      // The retry carries the same logical identity with a fresh transport request
      // id, so only the shared reservation can recognise it. It must wait for the
      // first attempt's real admission instead of being answered from the
      // provisional reservation, which would report a delivery for a wake that
      // never ran.
      const retry = agent.sendSignal({ type: 'user-message', contents: 'race the admission', attributes }, scope);
      let retrySettled = false;
      const retryAccepted = retry.accepted.then(
        value => {
          retrySettled = true;
          return value;
        },
        error => {
          retrySettled = true;
          throw error;
        },
      );
      void retryAccepted.catch(() => {});
      await new Promise(resolve => setTimeout(resolve, 20));
      expect(retrySettled).toBe(false);
      // The retry did not start an admission of its own while the first was pending.
      expect(streamOptionsCalls).toBe(1);

      release();
      await expect(first.accepted).rejects.toThrow('concurrent retry rejected');
      await expect(retryAccepted).rejects.toThrow('concurrent retry rejected');
      expect(model.doStreamCalls).toHaveLength(0);
    } finally {
      release();
      claim.unsubscribe();
    }
  });

  it('reports a failed run to a retry of the same logical message instead of running it again', async () => {
    const pubsub = new ControlledLeasePubSub();
    const ownerRuntime = new AgentThreadStreamRuntime();
    const senderRuntime = new AgentThreadStreamRuntime();
    const model = createTextStreamModel('owner response that should never stream');
    let failNextRun = false;
    const ownerAgent = new Agent({
      id: 'retry-failed-owner',
      name: 'Retry Failed Owner',
      instructions: async () => {
        if (failNextRun) {
          failNextRun = false;
          throw new Error('owner preparation failed');
        }
        return 'Test';
      },
      model,
      pubsub,
    });
    const senderAgent = new Agent({
      id: 'retry-failed-sender',
      name: 'Retry Failed Sender',
      instructions: 'Test',
      model: createTextStreamModel('sender response'),
      pubsub,
    });
    const target = { resourceId: 'retry-failed-user', threadId: 'retry-failed-thread' };
    const attributes = { messageId: 'retry-failed-message', sourcePeerId: 'retry-failed-peer' };
    const subscription = await ownerRuntime.subscribeToThread(ownerAgent, target, pubsub);
    const claim = await ownerRuntime.claimThreadOwnership(ownerAgent, target, pubsub);
    // Raised only once the owner is claimed, so claiming the thread can still resolve
    // the owner's instructions.
    failNextRun = true;

    try {
      const firstSignal = senderRuntime.sendSignal(
        senderAgent,
        { type: 'user-message', contents: 'run once and fail', attributes },
        { ...target, ifIdle: { behavior: 'wake', requireClaimedOwner: true } },
        pubsub,
      );
      await expect(firstSignal.accepted).rejects.toThrow('owner preparation failed');

      // The failed attempt did run, so its identity stays recorded: the retry must
      // learn the original turn failed rather than repeat its tools.
      const retrySignal = senderRuntime.sendSignal(
        senderAgent,
        { type: 'user-message', contents: 'run once and fail', attributes },
        { ...target, ifIdle: { behavior: 'wake', requireClaimedOwner: true } },
        pubsub,
      );
      await expect(retrySignal.accepted).rejects.toThrow('owner preparation failed');
      expect(model.doStreamCalls ?? []).toHaveLength(0);
    } finally {
      claim.unsubscribe();
      subscription.unsubscribe();
    }
  });

  it('reports a queued run failure to a retry of the same logical message', async () => {
    const pubsub = new ControlledLeasePubSub();
    const ownerRuntime = new AgentThreadStreamRuntime();
    const senderRuntime = new AgentThreadStreamRuntime();
    const { model, releaseFirst, getStreamCount } = createBlockingFirstTextStreamModel(
      'held owner response',
      'queued owner response',
    );
    let failNextRun = false;
    const ownerAgent = new Agent({
      id: 'retry-queued-failed-owner',
      name: 'Retry Queued Failed Owner',
      instructions: async () => {
        if (failNextRun) {
          failNextRun = false;
          throw new Error('queued owner preparation failed');
        }
        return 'Test';
      },
      model,
      pubsub,
    });
    const senderAgent = new Agent({
      id: 'retry-queued-failed-sender',
      name: 'Retry Queued Failed Sender',
      instructions: 'Test',
      model: createTextStreamModel('sender response'),
      pubsub,
    });
    const target = { resourceId: 'retry-queued-failed-user', threadId: 'retry-queued-failed-thread' };
    const holdAttributes = { messageId: 'retry-queued-failed-hold', sourcePeerId: 'retry-queued-failed-peer' };
    const attributes = { messageId: 'retry-queued-failed-message', sourcePeerId: 'retry-queued-failed-peer' };
    const subscription = await ownerRuntime.subscribeToThread(ownerAgent, target, pubsub);
    const claim = await ownerRuntime.claimThreadOwnership(ownerAgent, target, pubsub);

    try {
      // Hold the thread so the logical message under test is queued behind a run
      // rather than admitted directly.
      const holdSignal = senderRuntime.sendSignal(
        senderAgent,
        { type: 'user-message', contents: 'hold the thread', attributes: holdAttributes },
        { ...target, ifIdle: { behavior: 'wake', requireClaimedOwner: true } },
        pubsub,
      );
      await expect(holdSignal.accepted).resolves.toMatchObject({ action: 'deliver' });
      await waitForCondition(() => getStreamCount() === 1);

      const queuedSignal = senderRuntime.sendSignal(
        senderAgent,
        { type: 'user-message', contents: 'queue then fail', attributes },
        { ...target, ifIdle: { behavior: 'wake', requireClaimedOwner: true } },
        pubsub,
      );
      await expect(queuedSignal.accepted).resolves.toMatchObject({ action: 'deliver' });

      // The queued wake is the one that fails: arm the failing instructions once it
      // is queued and only the drain is left to run it.
      failNextRun = true;
      releaseFirst();
      await waitForCondition(() =>
        pubsub.publishedData.some(
          data => data?.type === 'run-failed' && data?.error === 'queued owner preparation failed',
        ),
      );

      // The queued run started and failed, so its identity must stay recorded on
      // that failure: the retry has to learn the turn failed rather than resolve to
      // a run that already errored.
      const retrySignal = senderRuntime.sendSignal(
        senderAgent,
        { type: 'user-message', contents: 'queue then fail', attributes },
        { ...target, ifIdle: { behavior: 'wake', requireClaimedOwner: true } },
        pubsub,
      );
      await expect(retrySignal.accepted).rejects.toThrow('queued owner preparation failed');
      expect(getStreamCount()).toBe(1);
    } finally {
      releaseFirst();
      claim.unsubscribe();
      subscription.unsubscribe();
    }
  });

  it('lets a retry of a queued wake route when the drain cannot hand over the lease', async () => {
    const pubsub = new ControlledLeasePubSub();
    const ownerRuntime = new AgentThreadStreamRuntime();
    const senderRuntime = new AgentThreadStreamRuntime();
    const { model, releaseFirst, getStreamCount } = createBlockingFirstTextStreamModel(
      'held owner response',
      'routed owner response',
    );
    const ownerAgent = new Agent({
      id: 'retry-drain-lease-owner',
      name: 'Retry Drain Lease Owner',
      instructions: 'Test',
      model,
      pubsub,
    });
    const senderAgent = new Agent({
      id: 'retry-drain-lease-sender',
      name: 'Retry Drain Lease Sender',
      instructions: 'Test',
      model: createTextStreamModel('sender response'),
      pubsub,
    });
    const target = { resourceId: 'retry-drain-lease-user', threadId: 'retry-drain-lease-thread' };
    const holdAttributes = { messageId: 'retry-drain-lease-hold', sourcePeerId: 'retry-drain-lease-peer' };
    const attributes = { messageId: 'retry-drain-lease-message', sourcePeerId: 'retry-drain-lease-peer' };
    const subscription = await ownerRuntime.subscribeToThread(ownerAgent, target, pubsub);
    const claim = await ownerRuntime.claimThreadOwnership(ownerAgent, target, pubsub);

    try {
      // Hold the thread so the logical message under test is queued behind a run.
      const holdSignal = senderRuntime.sendSignal(
        senderAgent,
        { type: 'user-message', contents: 'hold the thread', attributes: holdAttributes },
        { ...target, ifIdle: { behavior: 'wake', requireClaimedOwner: true } },
        pubsub,
      );
      await expect(holdSignal.accepted).resolves.toMatchObject({ action: 'deliver' });
      await waitForCondition(() => getStreamCount() === 1);

      const queuedSignal = senderRuntime.sendSignal(
        senderAgent,
        { type: 'user-message', contents: 'queue then lose the lease', attributes },
        { ...target, ifIdle: { behavior: 'wake', requireClaimedOwner: true } },
        pubsub,
      );
      await expect(queuedSignal.accepted).resolves.toMatchObject({ action: 'deliver' });

      // Only a SYNCHRONOUS throw reaches the drain's catch; an async provider
      // rejection is handled as a lease-lost handoff instead. The drain that
      // follows the held run performs the first lease transfer of this exchange.
      vi.spyOn(pubsub, 'transferLease').mockImplementationOnce(() => {
        throw new Error('lease backend down');
      });
      releaseFirst();
      await waitForCondition(() =>
        pubsub.publishedData.some(data => data?.type === 'run-failed' && data?.error === 'lease backend down'),
      );

      // The queued wake never started and is not retried from the queue, so its
      // identity must not keep claiming delivery: the retry has to route and run
      // instead of resolving to a wake that never happened.
      const retrySignal = senderRuntime.sendSignal(
        senderAgent,
        { type: 'user-message', contents: 'queue then lose the lease', attributes },
        { ...target, ifIdle: { behavior: 'wake', requireClaimedOwner: true } },
        pubsub,
      );
      await expect(retrySignal.accepted).resolves.toMatchObject({ action: 'deliver' });
      await waitForCondition(() => getStreamCount() === 2);
    } finally {
      releaseFirst();
      claim.unsubscribe();
      subscription.unsubscribe();
    }
  });

  it('keeps the cancellation of a draining wake when the drain cannot hand over the lease', async () => {
    const pubsub = new ControlledLeasePubSub();
    const ownerRuntime = new AgentThreadStreamRuntime();
    const senderRuntime = new AgentThreadStreamRuntime();
    const { model, releaseFirst, getStreamCount } = createBlockingFirstTextStreamModel(
      'held cancel response',
      'cancelled drain response',
    );
    const ownerAgent = new Agent({
      id: 'cancel-drain-lease-owner',
      name: 'Cancel Drain Lease Owner',
      instructions: 'Test',
      model,
      pubsub,
    });
    const senderAgent = new Agent({
      id: 'cancel-drain-lease-sender',
      name: 'Cancel Drain Lease Sender',
      instructions: 'Test',
      model: createTextStreamModel('sender response'),
      pubsub,
    });
    const target = { resourceId: 'cancel-drain-lease-user', threadId: 'cancel-drain-lease-thread' };
    const holdAttributes = { messageId: 'cancel-drain-lease-hold', sourcePeerId: 'cancel-drain-lease-peer' };
    const attributes = { messageId: 'cancel-drain-lease-message', sourcePeerId: 'cancel-drain-lease-peer' };
    const subscription = await ownerRuntime.subscribeToThread(ownerAgent, target, pubsub);
    const claim = await ownerRuntime.claimThreadOwnership(ownerAgent, target, pubsub);

    try {
      // Hold the thread so the logical message under test is queued behind a run.
      const holdSignal = senderRuntime.sendSignal(
        senderAgent,
        { type: 'user-message', contents: 'hold the thread', attributes: holdAttributes },
        { ...target, ifIdle: { behavior: 'wake', requireClaimedOwner: true } },
        pubsub,
      );
      await expect(holdSignal.accepted).resolves.toMatchObject({ action: 'deliver' });
      await waitForCondition(() => getStreamCount() === 1);

      const queuedSignal = senderRuntime.sendSignal(
        senderAgent,
        { type: 'user-message', contents: 'queue then cancel', attributes },
        { ...target, ifIdle: { behavior: 'wake', requireClaimedOwner: true } },
        pubsub,
      );
      await expect(queuedSignal.accepted).resolves.toMatchObject({ action: 'deliver' });

      // The drain that follows the held run cancels the message it is about to
      // start and then loses the lease. Only a SYNCHRONOUS throw reaches the
      // drain's catch, so the cancellation must land synchronously with it.
      vi.spyOn(pubsub, 'transferLease').mockImplementationOnce(() => {
        ownerRuntime.cancelQueuedMessages(
          ownerAgent,
          { resourceId: target.resourceId, threadId: target.threadId, signalIds: [queuedSignal.signal.id] },
          pubsub,
        );
        throw new Error('lease backend down');
      });
      releaseFirst();
      await waitForCondition(() =>
        pubsub.publishedData.some(data => data?.type === 'run-failed' && data?.error === 'lease backend down'),
      );

      // The cancellation is the outcome the sender must observe: a retry of the
      // cancelled message is told it was cancelled rather than quietly starting
      // the turn the user cancelled.
      const retrySignal = senderRuntime.sendSignal(
        senderAgent,
        { type: 'user-message', contents: 'queue then cancel', attributes },
        { ...target, ifIdle: { behavior: 'wake', requireClaimedOwner: true } },
        pubsub,
      );
      await expect(retrySignal.accepted).rejects.toThrow('The accepted message was cancelled before it ran');
      expect(getStreamCount()).toBe(1);
    } finally {
      releaseFirst();
      claim.unsubscribe();
      subscription.unsubscribe();
    }
  });

  it.each(['released', 'expired', 'rejected'] as const)(
    'does not retain controls or execute a claim whose options are %s',
    async outcome => {
      const scope = { resourceId: 'claim-options', threadId: 'claim-options' };
      const topic = `agent.thread-stream.${encodeURIComponent(`${scope.resourceId}\u0000${scope.threadId}`)}`;
      const pubsub = new ControlledLeasePubSub();
      const model = createTextStreamModel('unused');
      const agent = new Agent({ id: 'claim-options', name: 'Options', instructions: 'Test', model, pubsub });
      let release!: () => void;
      const gate = new Promise<void>(resolve => {
        release = resolve;
      });
      let entered!: () => void;
      const entering = new Promise<void>(resolve => {
        entered = resolve;
      });
      const now = vi.spyOn(Date, 'now').mockReturnValue(1000);
      const claim = await agent.claimThreadOwnership({
        ...scope,
        streamOptions: async () => {
          entered();
          await gate;
          if (outcome === 'rejected') throw new Error('Options rejected');
          return {};
        },
      });
      const pending = agent.sendSignal({ type: 'user-message', contents: 'invalid claim' }, scope);
      void pending.accepted.catch(() => {});
      try {
        await entering;
        expect(pubsub.subscriberCount(topic)).toBe(1);
        if (outcome === 'released') claim.unsubscribe();
        if (outcome === 'expired') now.mockReturnValue(10000);
        release();
        await expect(pending.accepted).rejects.toThrow(
          outcome === 'released'
            ? 'owner was released'
            : outcome === 'expired'
              ? 'acceptance expired'
              : 'Options rejected',
        );
        expect(model.doStreamCalls).toHaveLength(0);
        expect(agentThreadStreamRuntime.getActiveThreadRunId(scope, pubsub)).toBeUndefined();
        claim.unsubscribe();
        await vi.waitFor(() => expect(pubsub.subscriberCount(topic)).toBe(0));
      } finally {
        release();
        claim.unsubscribe();
        now.mockRestore();
      }
    },
  );

  it.each(['released', 'failed'] as const)('cleans up claimed startup when control readiness is %s', async outcome => {
    const scope = { resourceId: 'claim-ready', threadId: 'claim-ready' };
    const topic = `agent.thread-stream.${encodeURIComponent(`${scope.resourceId}\u0000${scope.threadId}`)}`;
    const pubsub = new ControlledLeasePubSub();
    const model = createTextStreamModel('unused');
    const agent = new Agent({ id: 'claim-ready', name: 'Ready', instructions: 'Test', model, pubsub });
    const claim = await agent.claimThreadOwnership(scope);
    let release!: () => void;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    let entered!: () => void;
    const entering = new Promise<void>(resolve => {
      entered = resolve;
    });
    const subscribe = pubsub.subscribe.bind(pubsub);
    vi.spyOn(pubsub, 'subscribe').mockImplementationOnce(async (topic, callback) => {
      await subscribe(topic, callback);
      entered();
      await gate;
      if (outcome === 'failed') throw new Error('Controls unavailable');
    });
    const pending = agent.sendSignal({ type: 'user-message', contents: 'claim input' }, scope);
    void pending.accepted.catch(() => {});
    try {
      await entering;
      expect(agentThreadStreamRuntime.getActiveThreadRunId(scope, pubsub)).toBeUndefined();
      if (outcome === 'released') claim.unsubscribe();
      release();
      await expect(pending.accepted).rejects.toThrow(
        outcome === 'released' ? 'owner was released' : 'Controls unavailable',
      );
      claim.unsubscribe();
      await vi.waitFor(() => expect(pubsub.subscriberCount(topic)).toBe(0));
      expect(model.doStreamCalls).toHaveLength(0);
    } finally {
      release();
      claim.unsubscribe();
    }
  });

  it('cancels claimant-held idle input after claim release without any thread observers', async () => {
    const scope = { resourceId: 'claim-control-user', threadId: 'claim-control-thread' };
    const key = `${scope.resourceId}\u0000${scope.threadId}`;
    const topic = `agent.thread-stream.${encodeURIComponent(key)}`;
    const pubsub = new ControlledLeasePubSub();
    const model = createTextStreamModel('should not execute');
    const agent = new Agent({ id: 'claim-control', name: 'Claim control', instructions: 'Test', model, pubsub });
    const sender = new AgentThreadStreamRuntime();
    const claim = await agent.claimThreadOwnership(scope);
    let release!: () => void;
    pubsub.acquireLeaseWait = new Promise<void>(resolve => {
      release = resolve;
    });
    let entered!: () => void;
    const acquiring = new Promise<void>(resolve => {
      entered = resolve;
    });
    pubsub.onAcquireLease = entered;
    const first = agent.sendSignal({ type: 'user-message', contents: 'reserved claim startup' }, scope);
    void first.accepted.catch(() => {});
    try {
      await acquiring;
      const queued = sender.sendSignal(
        agent,
        { type: 'user-message', contents: 'claimant queued input' },
        {
          ...scope,
          ifIdle: { behavior: 'wake', requireClaimedOwner: true },
        },
        pubsub,
      );
      await queued.accepted;
      expect(model.doStreamCalls).toHaveLength(0);
      claim.unsubscribe();
      await pubsub.publish(topic, {
        type: 'signals-cancelled',
        data: { type: 'signals-cancelled', signalIds: [queued.signal.id] },
      });
      await pubsub.flush();
      await nextTick();
      expect(agent.cancelQueuedMessages({ ...scope, signalIds: [queued.signal.id] })).toEqual({
        cancelledSignalIds: [],
      });
      release();
      await expect(first.accepted).rejects.toThrow('Claimed thread owner was released');
      await vi.waitFor(() => expect(pubsub.subscriberCount(topic)).toBe(0));
      expect(pubsub.owners.get(key)).toBeUndefined();
      expect(model.doStreamCalls).toHaveLength(0);
    } finally {
      release();
      claim.unsubscribe();
      await first.accepted.catch(() => {});
    }
  });

  it('cancels idle input behind a background claimed run after releasing its claim', async () => {
    const scope = { resourceId: 'background-claim', threadId: 'background-claim' };
    const topic = `agent.thread-stream.${encodeURIComponent(`${scope.resourceId}\u0000${scope.threadId}`)}`;
    const pubsub = new ControlledLeasePubSub();
    const { model, releaseFirst, getStreamCount } = createBlockingFirstTextStreamModel('first', 'cancelled');
    const agent = new Agent({ id: 'background-claim', name: 'Background', instructions: 'Test', model, pubsub });
    const sender = new AgentThreadStreamRuntime();
    const claim = await agent.claimThreadOwnership(scope);
    try {
      await agent.sendSignal({ type: 'user-message', contents: 'first claim input' }, scope).accepted;
      await vi.waitFor(() => expect(getStreamCount()).toBe(1));
      const queued = sender.sendSignal(
        agent,
        { type: 'user-message', contents: 'cancel queued claim input' },
        {
          ...scope,
          ifIdle: { behavior: 'wake', requireClaimedOwner: true },
        },
        pubsub,
      );
      await queued.accepted;
      claim.unsubscribe();
      await pubsub.publish(topic, {
        type: 'signals-cancelled',
        data: { type: 'signals-cancelled', signalIds: [queued.signal.id] },
      });
      await pubsub.flush();
      await nextTick();
      expect(agent.cancelQueuedMessages({ ...scope, signalIds: [queued.signal.id] })).toEqual({
        cancelledSignalIds: [],
      });
      releaseFirst();
      await vi.waitFor(() => expect(pubsub.subscriberCount(topic)).toBe(0));
      expect(getStreamCount()).toBe(1);
      expect(agentThreadStreamRuntime.getActiveThreadRunId(scope, pubsub)).toBeUndefined();
      expect(pubsub.owners.get(`${scope.resourceId}\u0000${scope.threadId}`)).toBeUndefined();
    } finally {
      releaseFirst();
      claim.unsubscribe();
    }
  });

  it('preserves an acknowledged remote wake when the busy owner releases its claim', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000);
    const pubsub = new ControlledLeasePubSub();
    const ownerRuntime = new AgentThreadStreamRuntime();
    const senderRuntime = new AgentThreadStreamRuntime();
    const { model, releaseFirst, getStreamCount } = createBlockingFirstTextStreamModel(
      'first owner response',
      'queued owner response',
    );
    const ownerAgent = new Agent({
      id: 'queued-admission-owner',
      name: 'Queued Admission Owner',
      instructions: 'Test',
      model,
      pubsub,
    });
    const senderAgent = new Agent({
      id: 'queued-admission-sender',
      name: 'Queued Admission Sender',
      instructions: 'Test',
      model: createTextStreamModel('sender response'),
      pubsub,
    });
    const subscription = await ownerRuntime.subscribeToThread(
      ownerAgent,
      { resourceId: 'queued-admission-user', threadId: 'queued-admission-thread' },
      pubsub,
    );
    const iterator = subscription.stream[Symbol.asyncIterator]();
    const firstRun = readNextRunWithParts(iterator);
    const claim = await ownerRuntime.claimThreadOwnership(
      ownerAgent,
      { resourceId: 'queued-admission-user', threadId: 'queued-admission-thread' },
      pubsub,
    );

    try {
      const firstSignal = senderRuntime.sendSignal(
        senderAgent,
        { type: 'user-message', contents: 'start the first owner run' },
        {
          resourceId: 'queued-admission-user',
          threadId: 'queued-admission-thread',
          ifIdle: { behavior: 'wake', requireClaimedOwner: true },
        },
        pubsub,
      );
      await expect(firstSignal.accepted).resolves.toMatchObject({ action: 'deliver' });
      await waitForCondition(() => getStreamCount() === 1);

      const queuedSignal = senderRuntime.sendSignal(
        senderAgent,
        { type: 'user-message', contents: 'queue the second owner run' },
        {
          resourceId: 'queued-admission-user',
          threadId: 'queued-admission-thread',
          ifIdle: { behavior: 'wake', requireClaimedOwner: true },
        },
        pubsub,
      );
      await expect(queuedSignal.accepted).resolves.toMatchObject({ action: 'deliver' });
      expect(getStreamCount()).toBe(1);

      // Once accepted, queued work remains in flight even if the claim is released.
      claim.unsubscribe();
      now.mockReturnValue(10_000);
      releaseFirst();
      await firstRun;
      const queuedRun = await readNextRunWithParts(iterator);
      expect(queuedRun.value.text).toBe('queued owner response');
      expect(getStreamCount()).toBe(2);
    } finally {
      releaseFirst();
      now.mockRestore();
      claim.unsubscribe();
      subscription.unsubscribe();
    }
  });

  it('acknowledges a queued remote wake before a later lease handoff failure', async () => {
    const pubsub = new ControlledLeasePubSub();
    const ownerRuntime = new AgentThreadStreamRuntime();
    const senderRuntime = new AgentThreadStreamRuntime();
    const { model, releaseFirst, getStreamCount } = createBlockingFirstTextStreamModel(
      'first owner response',
      'queued owner response',
    );
    const ownerAgent = new Agent({
      id: 'queued-lease-owner',
      name: 'Queued Lease Owner',
      instructions: 'Test',
      model,
      pubsub,
    });
    const senderAgent = new Agent({
      id: 'queued-lease-sender',
      name: 'Queued Lease Sender',
      instructions: 'Test',
      model: createTextStreamModel('sender response'),
      pubsub,
    });
    const subscription = await ownerRuntime.subscribeToThread(
      ownerAgent,
      { resourceId: 'queued-lease-user', threadId: 'queued-lease-thread' },
      pubsub,
    );
    const firstRun = readNextRunWithParts(subscription.stream[Symbol.asyncIterator]());
    const claim = await ownerRuntime.claimThreadOwnership(
      ownerAgent,
      { resourceId: 'queued-lease-user', threadId: 'queued-lease-thread' },
      pubsub,
    );

    const firstSignal = senderRuntime.sendSignal(
      senderAgent,
      { type: 'user-message', contents: 'start the lease owner run' },
      {
        resourceId: 'queued-lease-user',
        threadId: 'queued-lease-thread',
        ifIdle: { behavior: 'wake', requireClaimedOwner: true },
      },
      pubsub,
    );
    await expect(firstSignal.accepted).resolves.toMatchObject({ action: 'deliver' });
    await waitForCondition(() => getStreamCount() === 1);

    const queuedSignal = senderRuntime.sendSignal(
      senderAgent,
      { type: 'user-message', contents: 'lose the lease before this run starts' },
      {
        resourceId: 'queued-lease-user',
        threadId: 'queued-lease-thread',
        ifIdle: { behavior: 'wake', requireClaimedOwner: true },
      },
      pubsub,
    );
    await expect(queuedSignal.accepted).resolves.toMatchObject({ action: 'deliver' });
    pubsub.denyLeaseTransfer = true;
    pubsub.denyLeaseAcquisition = true;
    releaseFirst();
    await firstRun;
    await waitForCondition(() =>
      pubsub.publishedData.some(
        data => data?.type === 'signal-enqueued' && data.signal?.contents === 'lose the lease before this run starts',
      ),
    );

    expect(getStreamCount()).toBe(1);

    claim.unsubscribe();
    subscription.unsubscribe();
  });

  it('forwards concurrent remote wakes when the claimed owner loses the execution lease', async () => {
    const pubsub = new ControlledLeasePubSub();
    const ownerRuntime = new AgentThreadStreamRuntime();
    const firstSenderRuntime = new AgentThreadStreamRuntime();
    const secondSenderRuntime = new AgentThreadStreamRuntime();
    let releaseAcquire!: () => void;
    let markAcquireStarted!: () => void;
    const ownerAgent = {
      id: 'initial-lease-loss-owner',
      stream: vi.fn(),
    } as unknown as Agent;
    const firstSenderAgent = new Agent({
      id: 'initial-lease-loss-sender-1',
      name: 'Initial Lease Loss Sender 1',
      instructions: 'Test',
      model: createTextStreamModel('sender response'),
      pubsub,
    });
    const secondSenderAgent = new Agent({
      id: 'initial-lease-loss-sender-2',
      name: 'Initial Lease Loss Sender 2',
      instructions: 'Test',
      model: createTextStreamModel('sender response'),
      pubsub,
    });
    const claim = await ownerRuntime.claimThreadOwnership(
      ownerAgent,
      { resourceId: 'initial-lease-loss-user', threadId: 'initial-lease-loss-thread' },
      pubsub,
    );
    pubsub.acquireLeaseWait = new Promise<void>(resolve => {
      releaseAcquire = resolve;
    });
    const acquireStarted = new Promise<void>(resolve => {
      markAcquireStarted = resolve;
    });
    pubsub.onAcquireLease = markAcquireStarted;
    pubsub.denyLeaseAcquisition = true;

    const firstSignal = firstSenderRuntime.sendSignal(
      firstSenderAgent,
      { type: 'user-message', contents: 'lose the initial lease' },
      {
        resourceId: 'initial-lease-loss-user',
        threadId: 'initial-lease-loss-thread',
        ifIdle: { behavior: 'wake', requireClaimedOwner: true },
      },
      pubsub,
    );
    const firstOutcome = firstSignal.accepted.then(
      value => ({ value }),
      error => ({ error: error instanceof Error ? error : new Error(String(error)) }),
    );
    await acquireStarted;

    const secondSignal = secondSenderRuntime.sendSignal(
      secondSenderAgent,
      { type: 'user-message', contents: 'queue behind the losing acquisition' },
      {
        resourceId: 'initial-lease-loss-user',
        threadId: 'initial-lease-loss-thread',
        ifIdle: { behavior: 'wake', requireClaimedOwner: true },
      },
      pubsub,
    );
    const secondOutcome = secondSignal.accepted.then(
      value => ({ value }),
      error => ({ error: error instanceof Error ? error : new Error(String(error)) }),
    );
    await new Promise(resolve => setTimeout(resolve, 25));
    releaseAcquire();

    const [firstResult, secondResult] = await Promise.all([firstOutcome, secondOutcome]);
    expect(firstResult).toMatchObject({ value: { action: 'deliver', runId: 'competing-run' } });
    expect(secondResult).toMatchObject({ value: { action: 'deliver' } });
    expect(ownerAgent.stream).not.toHaveBeenCalled();

    claim.unsubscribe();
  });

  it('discards a forwarded concurrent input from the losing claimed reservation', async () => {
    const pubsub = new ControlledLeasePubSub();
    const runtime = agentThreadStreamRuntime;
    const target = { resourceId: 'claim-replay-user', threadId: 'claim-replay-thread' };
    const key = `${target.resourceId}\u0000${target.threadId}`;
    const agent = new Agent({
      id: 'claim-replay-agent',
      name: 'Claim Replay Agent',
      instructions: 'Test',
      model: createTextStreamModel('ok'),
      pubsub,
    });
    const claim = await runtime.claimThreadOwnership(agent, target, pubsub);
    let releaseAcquire!: () => void;
    pubsub.acquireLeaseWait = new Promise<void>(resolve => (releaseAcquire = resolve));
    const acquireStarted = new Promise<void>(resolve => {
      pubsub.onAcquireLease = resolve;
    });
    try {
      const first = runtime.sendSignal(
        agent,
        { type: 'user-message', contents: 'first wake' },
        { ...target, ifIdle: { behavior: 'wake' } },
        pubsub,
      );
      await acquireStarted;

      const second = runtime.sendSignal(
        agent,
        { type: 'user-message', contents: 'concurrent replay marker' },
        target,
        pubsub,
      );

      pubsub.owners.set(key, 'real-successor');
      releaseAcquire();

      const [firstAccepted, secondAccepted] = await Promise.all([first.accepted, second.accepted]);
      expect(firstAccepted).toMatchObject({ action: 'deliver', runId: 'real-successor' });
      expect(secondAccepted).toMatchObject({ action: 'deliver', runId: 'real-successor' });
      expect(
        pubsub.publishedData.filter(
          data =>
            data?.type === 'signal-enqueued' && data.signal?.id === second.signal.id && data.runId === 'real-successor',
        ),
      ).toHaveLength(1);

      await pubsub.releaseLease(key, 'real-successor');
      expect(await pubsub.acquireLease(key, 'recovery-run')).toEqual({
        acquired: true,
        owner: 'recovery-run',
      });
      let finishRecovery!: () => void;
      const finished = new Promise<void>(resolve => (finishRecovery = resolve));
      await runtime.registerRun(
        agent,
        {
          runId: 'recovery-run',
          status: 'running',
          fullStream: (async function* () {})(),
          _waitUntilFinished: () => finished,
        } as any,
        { runId: 'recovery-run', memory: { resource: target.resourceId, thread: target.threadId } } as any,
        pubsub,
      );
      // The concurrent input was already forwarded to the real successor, so the
      // reservation's losing rollback must not leave a local copy behind.
      expect(runtime.drainPendingSignals('recovery-run', pubsub, 'pre-run')).toEqual([]);
      finishRecovery();
    } finally {
      releaseAcquire();
      claim.unsubscribe();
      runtime.resetForTests();
    }
  });

  it('discards the concurrent input when the claimed attempt settles blocked', async () => {
    const pubsub = new ControlledLeasePubSub();
    const runtime = agentThreadStreamRuntime;
    const target = { resourceId: 'claim-blocked-user', threadId: 'claim-blocked-thread' };
    const key = `${target.resourceId}\u0000${target.threadId}`;
    const agent = new Agent({
      id: 'claim-blocked-agent',
      name: 'Claim Blocked Agent',
      instructions: 'Test',
      model: createTextStreamModel('ok'),
      pubsub,
    });
    const claim = await runtime.claimThreadOwnership(agent, target, pubsub);
    let releaseAcquire!: () => void;
    pubsub.acquireLeaseWait = new Promise<void>(resolve => (releaseAcquire = resolve));
    const acquireStarted = new Promise<void>(resolve => {
      pubsub.onAcquireLease = resolve;
    });
    try {
      const first = runtime.sendSignal(
        agent,
        { type: 'user-message', contents: 'first wake' },
        { ...target, ifIdle: { behavior: 'wake' } },
        pubsub,
      );
      await acquireStarted;

      const second = runtime.sendSignal(agent, { type: 'user-message', contents: 'blocked marker' }, target, pubsub);

      claim.unsubscribe();
      releaseAcquire();

      const firstOutcome = await first.accepted.then(
        (value: unknown) => ({ value }),
        (error: unknown) => ({ error }),
      );
      expect(firstOutcome.error).toBeDefined();
      await expect(second.accepted).resolves.toMatchObject({ action: 'blocked' });
      expect(
        pubsub.publishedData.filter(data => data?.type === 'signal-enqueued' && data.signal?.id === second.signal.id),
      ).toEqual([]);

      expect(await pubsub.acquireLease(key, 'recovery-run')).toEqual({
        acquired: true,
        owner: 'recovery-run',
      });
      let finishRecovery!: () => void;
      const finished = new Promise<void>(resolve => (finishRecovery = resolve));
      await runtime.registerRun(
        agent,
        {
          runId: 'recovery-run',
          status: 'running',
          fullStream: (async function* () {})(),
          _waitUntilFinished: () => finished,
        } as any,
        { runId: 'recovery-run', memory: { resource: target.resourceId, thread: target.threadId } } as any,
        pubsub,
      );
      // A blocked outcome delivered nothing, and it acknowledged nothing as
      // delivered, so no local copy may survive for a later run to replay.
      expect(runtime.drainPendingSignals('recovery-run', pubsub, 'pre-run')).toEqual([]);
      finishRecovery();
    } finally {
      releaseAcquire();
      claim.unsubscribe();
      runtime.resetForTests();
    }
  });

  it('keeps a later claimed attempt queuing its own concurrent input after a losing attempt cleaned up', async () => {
    const pubsub = new ControlledLeasePubSub();
    const runtime = agentThreadStreamRuntime;
    const target = { resourceId: 'claim-retain-user', threadId: 'claim-retain-thread' };
    const key = `${target.resourceId}\u0000${target.threadId}`;
    const agent = new Agent({
      id: 'claim-retain-agent',
      name: 'Claim Retain Agent',
      instructions: 'Test',
      model: createTextStreamModel('ok'),
      pubsub,
    });
    let releaseAcquire!: () => void;
    const firstClaim = await runtime.claimThreadOwnership(agent, target, pubsub);
    pubsub.acquireLeaseWait = new Promise<void>(resolve => (releaseAcquire = resolve));
    const firstAcquireStarted = new Promise<void>(resolve => {
      pubsub.onAcquireLease = resolve;
    });
    try {
      const first = runtime.sendSignal(
        agent,
        { type: 'user-message', contents: 'losing wake' },
        { ...target, ifIdle: { behavior: 'wake' } },
        pubsub,
      );
      await firstAcquireStarted;
      const second = runtime.sendSignal(agent, { type: 'user-message', contents: 'lost marker' }, target, pubsub);
      firstClaim.unsubscribe();
      releaseAcquire();
      await expect(second.accepted).resolves.toMatchObject({ action: 'blocked' });
      await first.accepted.catch(() => {});

      // A fresh claimed attempt must still be able to queue concurrent input
      // behind its own reservation and forward it exactly once.
      const secondClaim = await runtime.claimThreadOwnership(agent, target, pubsub);
      pubsub.acquireLeaseWait = new Promise<void>(resolve => (releaseAcquire = resolve));
      const secondAcquireStarted = new Promise<void>(resolve => {
        pubsub.onAcquireLease = resolve;
      });
      try {
        const third = runtime.sendSignal(
          agent,
          { type: 'user-message', contents: 'later wake' },
          { ...target, ifIdle: { behavior: 'wake' } },
          pubsub,
        );
        await secondAcquireStarted;
        const fourth = runtime.sendSignal(agent, { type: 'user-message', contents: 'retained marker' }, target, pubsub);

        pubsub.owners.set(key, 'second-successor');
        releaseAcquire();

        await expect(fourth.accepted).resolves.toMatchObject({
          action: 'deliver',
          runId: 'second-successor',
        });
        await third.accepted.catch(() => {});
        expect(
          pubsub.publishedData.filter(
            data =>
              data?.type === 'signal-enqueued' &&
              data.signal?.id === fourth.signal.id &&
              data.runId === 'second-successor',
          ),
        ).toHaveLength(1);

        await pubsub.releaseLease(key, 'second-successor');
        expect(await pubsub.acquireLease(key, 'recovery-run-2')).toEqual({
          acquired: true,
          owner: 'recovery-run-2',
        });
        let finishRecovery!: () => void;
        const finished = new Promise<void>(resolve => (finishRecovery = resolve));
        await runtime.registerRun(
          agent,
          {
            runId: 'recovery-run-2',
            status: 'running',
            fullStream: (async function* () {})(),
            _waitUntilFinished: () => finished,
          } as any,
          { runId: 'recovery-run-2', memory: { resource: target.resourceId, thread: target.threadId } } as any,
          pubsub,
        );
        expect(runtime.drainPendingSignals('recovery-run-2', pubsub, 'pre-run')).toEqual([]);
        finishRecovery();
      } finally {
        secondClaim.unsubscribe();
      }
    } finally {
      releaseAcquire();
      runtime.resetForTests();
    }
  });

  it.each(['remote-newer', 'error-newer', 'error-own'] as const)(
    'overlapping reservations keep only the newer input when the losing attempt settles %s',
    async mode => {
      const pubsub = new ControlledLeasePubSub();
      const runtime = agentThreadStreamRuntime;
      const target = { resourceId: 'claim-overlap-user', threadId: 'claim-overlap-thread' };
      const key = `${target.resourceId}\u0000${target.threadId}`;
      const agent = new Agent({
        id: 'claim-overlap-agent',
        name: 'Claim Overlap Agent',
        instructions: 'Test',
        model: createTextStreamModel('ok'),
        pubsub,
      });
      const claim = await runtime.claimThreadOwnership(agent, target, pubsub);
      let releaseAcquire!: () => void;
      const acquireStarted = new Promise<void>(resolve => {
        pubsub.onAcquireLease = resolve;
      });
      pubsub.acquireLeaseWait = new Promise<void>(resolve => (releaseAcquire = resolve));
      const acquire = vi.spyOn(pubsub, 'acquireLease').mockImplementationOnce(async () => {
        pubsub.onAcquireLease?.();
        await pubsub.acquireLeaseWait;
        if (mode === 'remote-newer') return { acquired: false, owner: 'foreign-owner' };
        throw new Error('injected backend rejection');
      });
      try {
        const first = runtime.sendSignal(
          agent,
          { type: 'user-message', contents: 'old wake' },
          { ...target, ifIdle: { behavior: 'wake' } },
          pubsub,
        );
        const firstOutcome = first.accepted.then(
          (value: unknown) => ({ value }),
          (error: unknown) => ({ error }),
        );
        await acquireStarted;
        const oldRunId = runtime.getActiveThreadRunId(target, pubsub)!;

        let oldConcurrent: ReturnType<AgentThreadStreamRuntime['sendSignal']> | undefined;
        let newer: ReturnType<AgentThreadStreamRuntime['sendSignal']> | undefined;
        if (mode !== 'error-own') {
          oldConcurrent = runtime.sendSignal(
            agent,
            { type: 'user-message', contents: 'old input must not replay' },
            target,
            pubsub,
          );
          // A newer reservation replaces the old one before the old attempt
          // settles, so the old rollback's slot guard must not clean the queue.
          runtime.releaseThreadRunReservation(oldRunId, pubsub);
          await runtime.waitForCrossAgentThreadRun(
            agent,
            { runId: 'newer-run', memory: { resource: target.resourceId, thread: target.threadId } },
            pubsub,
          );
          newer = runtime.sendSignal(
            agent,
            { type: 'user-message', contents: 'newer input must survive' },
            target,
            pubsub,
          );
          await expect(newer.accepted).resolves.toMatchObject({ action: 'deliver', runId: 'newer-run' });
        } else {
          oldConcurrent = runtime.sendSignal(
            agent,
            { type: 'user-message', contents: 'rejected attempt input' },
            target,
            pubsub,
          );
        }

        if (mode === 'remote-newer') pubsub.owners.set(key, 'foreign-owner');
        releaseAcquire();

        const settled = await firstOutcome;
        if (mode === 'remote-newer') {
          expect(settled).toMatchObject({ value: { action: 'deliver', runId: 'foreign-owner' } });
        } else {
          expect(settled.error).toBeDefined();
        }
        await expect(oldConcurrent!.accepted).resolves.toMatchObject({
          action: mode === 'remote-newer' ? 'deliver' : 'blocked',
        });
        if (mode === 'remote-newer') {
          expect(
            pubsub.publishedData.filter(
              data =>
                data?.type === 'signal-enqueued' &&
                data.signal?.id === oldConcurrent!.signal.id &&
                data.runId === 'foreign-owner',
            ),
          ).toHaveLength(1);
        }

        if (mode !== 'error-own') {
          // Only the newer reservation's own input may reach the newer run; the
          // old attempt's input was acknowledged (forwarded or blocked) and must
          // not replay here.
          expect(runtime.getActiveThreadRunId(target, pubsub)).toBe('newer-run');
          expect(runtime.drainPendingSignals('newer-run', pubsub, 'pre-run').map(signal => signal.id)).toEqual([
            newer!.signal.id,
          ]);
          runtime.releaseThreadRunReservation('newer-run', pubsub);
        } else {
          expect(runtime.getActiveThreadRunId(target, pubsub)).toBeUndefined();
          await runtime.waitForCrossAgentThreadRun(
            agent,
            { runId: 'recovery-run', memory: { resource: target.resourceId, thread: target.threadId } },
            pubsub,
          );
          expect(runtime.drainPendingSignals('recovery-run', pubsub, 'pre-run')).toEqual([]);
          runtime.releaseThreadRunReservation('recovery-run', pubsub);
        }
      } finally {
        releaseAcquire();
        acquire.mockRestore();
        claim.unsubscribe();
        runtime.resetForTests();
      }
    },
  );

  it('does not start a claimed-owner run when lease acquisition completes after the admission deadline', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000);
    try {
      const pubsub = new ControlledLeasePubSub();
      const ownerRuntime = new AgentThreadStreamRuntime();
      const senderRuntime = new AgentThreadStreamRuntime();
      let releaseAcquire!: () => void;
      let markAcquireStarted!: () => void;
      const ownerAgent = {
        id: 'expired-admission-owner',
        stream: vi.fn(),
      } as unknown as Agent;
      const senderAgent = new Agent({
        id: 'expired-admission-sender',
        name: 'Expired Admission Sender',
        instructions: 'Test',
        model: createTextStreamModel('sender response'),
        pubsub,
      });
      const claim = await ownerRuntime.claimThreadOwnership(
        ownerAgent,
        { resourceId: 'expired-admission-user', threadId: 'expired-admission-thread' },
        pubsub,
      );
      pubsub.acquireLeaseWait = new Promise<void>(resolve => {
        releaseAcquire = resolve;
      });
      const acquireStarted = new Promise<void>(resolve => {
        markAcquireStarted = resolve;
      });
      pubsub.onAcquireLease = markAcquireStarted;

      const signal = senderRuntime.sendSignal(
        senderAgent,
        { type: 'user-message', contents: 'expire while acquiring the lease' },
        {
          resourceId: 'expired-admission-user',
          threadId: 'expired-admission-thread',
          ifIdle: { behavior: 'wake', requireClaimedOwner: true },
        },
        pubsub,
      );
      await acquireStarted;
      now.mockReturnValue(6_001);
      releaseAcquire();

      await expect(signal.accepted).rejects.toThrow('acceptance expired');
      expect(ownerAgent.stream).not.toHaveBeenCalled();
      expect(pubsub.owners.get('expired-admission-user\u0000expired-admission-thread')).toBeUndefined();

      claim.unsubscribe();
    } finally {
      now.mockRestore();
    }
  });

  it('uses the thread lease to fence simultaneous claimed owners before acknowledging delivery', async () => {
    const pubsub = new ControlledLeasePubSub();
    const firstRuntime = new AgentThreadStreamRuntime();
    const secondRuntime = new AgentThreadStreamRuntime();
    const senderRuntime = new AgentThreadStreamRuntime();
    let streamCount = 0;
    const createCountingModel = (responseText: string) =>
      new MockLanguageModelV2({
        doStream: async () => {
          streamCount += 1;
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: responseText, modelId: 'mock-model-id', timestamp: new Date(0) },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: responseText },
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
    const firstAgent = new Agent({
      id: 'simultaneous-owner-1',
      name: 'Simultaneous Owner 1',
      instructions: 'Test',
      model: createCountingModel('first owner response'),
      pubsub,
    });
    const secondAgent = new Agent({
      id: 'simultaneous-owner-2',
      name: 'Simultaneous Owner 2',
      instructions: 'Test',
      model: createCountingModel('second owner response'),
      pubsub,
    });
    const senderAgent = new Agent({
      id: 'simultaneous-owner-sender',
      name: 'Simultaneous Owner Sender',
      instructions: 'Test',
      model: createTextStreamModel('sender response'),
      pubsub,
    });

    const firstSubscription = await firstRuntime.subscribeToThread(
      firstAgent,
      { resourceId: 'simultaneous-user', threadId: 'simultaneous-thread' },
      pubsub,
    );
    const secondSubscription = await secondRuntime.subscribeToThread(
      secondAgent,
      { resourceId: 'simultaneous-user', threadId: 'simultaneous-thread' },
      pubsub,
    );
    const [firstClaim, secondClaim] = await Promise.all([
      firstRuntime.claimThreadOwnership(
        firstAgent,
        { resourceId: 'simultaneous-user', threadId: 'simultaneous-thread' },
        pubsub,
      ),
      secondRuntime.claimThreadOwnership(
        secondAgent,
        { resourceId: 'simultaneous-user', threadId: 'simultaneous-thread' },
        pubsub,
      ),
    ]);
    expect([firstClaim.claimed, secondClaim.claimed].filter(Boolean)).toHaveLength(1);
    const ownerSubscription = firstClaim.claimed ? firstSubscription : secondSubscription;
    const nextRun = readNextRunWithParts(ownerSubscription.stream[Symbol.asyncIterator]());

    const signalResult = senderRuntime.sendSignal(
      senderAgent,
      { type: 'user-message', contents: 'wake exactly one claimed owner' },
      {
        resourceId: 'simultaneous-user',
        threadId: 'simultaneous-thread',
        ifIdle: { behavior: 'wake', requireClaimedOwner: true },
      },
      pubsub,
    );

    await expect(signalResult.accepted).resolves.toMatchObject({ action: 'deliver' });
    await nextRun;
    expect(streamCount).toBe(1);

    firstClaim.unsubscribe();
    secondClaim.unsubscribe();
    firstSubscription.unsubscribe();
    secondSubscription.unsubscribe();
  });

  it('encodes reserved characters in advertised thread peer IDs', async () => {
    const pubsub = new EventEmitterPubSub();
    const ownerAgent = new Agent({
      id: 'discoverable-agent',
      name: 'Discoverable Agent',
      instructions: 'Test',
      model: createTextStreamModel('discoverable response'),
      pubsub,
    });
    const discoveryAgent = new Agent({
      id: 'discovery-agent',
      name: 'Discovery Agent',
      instructions: 'Test',
      model: createTextStreamModel('discovery response'),
      pubsub,
    });

    const claim = await ownerAgent.claimThreadOwnership({
      resourceId: 'discoverable:resource',
      threadId: 'discoverable/thread',
      peer: {
        label: 'Discoverable peer',
        metadata: { mode: 'build' },
      },
    });

    const peers = await discoveryAgent.discoverThreadPeers();

    expect(peers).toEqual([
      expect.objectContaining({
        id: 'discoverable-agent:discoverable%3Aresource:discoverable%2Fthread',
        agentId: 'discoverable-agent',
        resourceId: 'discoverable:resource',
        threadId: 'discoverable/thread',
        label: 'Discoverable peer',
        metadata: { mode: 'build' },
      }),
    ]);
    expect(peers[0]?.discoveredAt).toBeInstanceOf(Date);

    claim.unsubscribe();
  });

  it('clears the per-request discovery reply topic once discovery settles', async () => {
    const cleared: string[] = [];
    class RecordingPubSub extends EventEmitterPubSub {
      override async clearTopic(topic: string): Promise<void> {
        cleared.push(topic);
      }
    }
    const pubsub = new RecordingPubSub();
    const discoveryAgent = new Agent({
      id: 'reply-topic-discovery-agent',
      name: 'Reply Topic Discovery Agent',
      instructions: 'Test',
      model: createTextStreamModel('discovery response'),
      pubsub,
    });

    await discoveryAgent.discoverThreadPeers({ timeoutMs: 10 });
    // releaseReplyTopic is fire-and-forget; let its unsubscribe → clearTopic chain flush.
    await new Promise(resolve => setTimeout(resolve, 0));

    // On persistent brokers the reply stream would otherwise outlive the
    // request forever — every discovery must drop its own reply topic.
    expect(cleared).toEqual([expect.stringMatching(/^agent\.thread-peer-discovery\./)]);
  });

  it('clears the owner-discovery and idle-acceptance reply topics after a claimed-owner wake', async () => {
    const cleared: string[] = [];
    class RecordingPubSub extends EventEmitterPubSub {
      override async clearTopic(topic: string): Promise<void> {
        cleared.push(topic);
      }
    }
    const pubsub = new RecordingPubSub();
    const ownerRuntime = agentThreadStreamRuntime;
    const senderRuntime = new AgentThreadStreamRuntime();
    const ownerAgent = new Agent({
      id: 'reply-topic-owner-agent',
      name: 'Reply Topic Owner Agent',
      instructions: 'Test',
      model: createTextStreamModel('owner response'),
      pubsub,
    });
    const senderAgent = new Agent({
      id: 'reply-topic-sender-agent',
      name: 'Reply Topic Sender Agent',
      instructions: 'Test',
      model: createTextStreamModel('sender response'),
      pubsub,
    });
    const target = { resourceId: 'reply-topic-user', threadId: 'reply-topic-thread' };

    const subscription = await ownerRuntime.subscribeToThread(ownerAgent, target, pubsub);
    const nextRun = readNextRunWithParts(subscription.stream[Symbol.asyncIterator]());
    const claim = await ownerRuntime.claimThreadOwnership(ownerAgent, target, pubsub);
    expect(claim.claimed).toBe(true);

    const signalResult = senderRuntime.sendSignal(
      senderAgent,
      { type: 'user-message', contents: 'wake the owner' },
      { ...target, ifIdle: { behavior: 'wake', requireClaimedOwner: true } },
      pubsub,
    );
    await expect(signalResult.accepted).resolves.toMatchObject({ action: 'deliver' });
    await nextRun;

    // Both per-request reply topics must be dropped once their round trips
    // settle — on persistent brokers each would otherwise leak a stream.
    await waitForCondition(
      () =>
        cleared.some(topic => topic.startsWith('agent.thread-owner-discovery.')) &&
        cleared.some(topic => topic.includes('.idle-acceptance.')),
    );

    claim.unsubscribe();
    subscription.unsubscribe();
  });

  it('delivers a claimed-owner wake when the owner answers discovery after the first attempt window', async () => {
    class SlowDiscoveryPubSub extends EventEmitterPubSub {
      override async publish(...args: Parameters<EventEmitterPubSub['publish']>): Promise<void> {
        const [topic, event] = args;
        if (
          topic === 'agent.thread-owner-discovery' &&
          (event.data as { type?: string } | undefined)?.type === 'thread-owner-request'
        ) {
          await new Promise(resolve => setTimeout(resolve, 150));
        }
        return super.publish(...args);
      }
    }
    const pubsub = new SlowDiscoveryPubSub();
    const ownerRuntime = agentThreadStreamRuntime;
    const senderRuntime = new AgentThreadStreamRuntime();
    const ownerAgent = new Agent({
      id: 'slow-discovery-owner-agent',
      name: 'Slow Discovery Owner Agent',
      instructions: 'Test',
      model: createTextStreamModel('owner response'),
      pubsub,
    });
    const senderAgent = new Agent({
      id: 'slow-discovery-sender-agent',
      name: 'Slow Discovery Sender Agent',
      instructions: 'Test',
      model: createTextStreamModel('sender response'),
      pubsub,
    });
    const target = { resourceId: 'slow-discovery-user', threadId: 'slow-discovery-thread' };

    const subscription = await ownerRuntime.subscribeToThread(ownerAgent, target, pubsub);
    const nextRun = readNextRunWithParts(subscription.stream[Symbol.asyncIterator]());
    const claim = await ownerRuntime.claimThreadOwnership(ownerAgent, target, pubsub);
    expect(claim.claimed).toBe(true);

    const signalResult = senderRuntime.sendSignal(
      senderAgent,
      { type: 'user-message', contents: 'wake the slow owner' },
      { ...target, ifIdle: { behavior: 'wake', requireClaimedOwner: true } },
      pubsub,
    );
    await expect(signalResult.accepted).resolves.toMatchObject({ action: 'deliver' });
    await nextRun;

    claim.unsubscribe();
    subscription.unsubscribe();
  });

  it('paces claimed-owner discovery retries when pubsub publish fails immediately', async () => {
    let discoveryRequests = 0;
    class FailingDiscoveryPubSub extends EventEmitterPubSub {
      override async publish(...args: Parameters<EventEmitterPubSub['publish']>): Promise<void> {
        const [topic, event] = args;
        if (
          topic === 'agent.thread-owner-discovery' &&
          (event.data as { type?: string } | undefined)?.type === 'thread-owner-request'
        ) {
          discoveryRequests++;
          throw new Error('pubsub unavailable');
        }
        return super.publish(...args);
      }
    }
    const pubsub = new FailingDiscoveryPubSub();
    const senderAgent = new Agent({
      id: 'failing-discovery-sender-agent',
      name: 'Failing Discovery Sender Agent',
      instructions: 'Test',
      model: createTextStreamModel('sender response'),
      pubsub,
    });

    const signalResult = new AgentThreadStreamRuntime().sendSignal(
      senderAgent,
      { type: 'user-message', contents: 'wake nobody' },
      {
        resourceId: 'failing-discovery-user',
        threadId: 'failing-discovery-thread',
        ifIdle: { behavior: 'wake', requireClaimedOwner: true },
      },
      pubsub,
    );
    // The whole message survives storage and display: no NUL from the internal thread key.
    await expect(signalResult.accepted).rejects.toThrow(
      'No claimed thread owner responded for thread failing-discovery-thread (resource failing-discovery-user) within 1000ms',
    );
    // 100 + 200 + 400 + remaining 300ms fits in the 1s budget.
    expect(discoveryRequests).toBeLessThanOrEqual(4);
  });

  it('escapes NUL characters inside ids in thread-owner errors', async () => {
    const pubsub = new EventEmitterPubSub();
    const senderAgent = new Agent({
      id: 'nul-id-sender-agent',
      name: 'NUL Id Sender Agent',
      instructions: 'Test',
      model: createTextStreamModel('sender response'),
      pubsub,
    });

    const signalResult = new AgentThreadStreamRuntime().sendSignal(
      senderAgent,
      { type: 'user-message', contents: 'wake nobody' },
      {
        resourceId: 'nul\0user',
        threadId: 'nul\0thread',
        ifIdle: { behavior: 'wake', requireClaimedOwner: true },
      },
      pubsub,
    );
    const error = await signalResult.accepted.then(
      () => undefined,
      (error: Error) => error,
    );
    expect(error?.message).toBe('No claimed thread owner responded for thread nul\\0user\\0nul\\0thread within 1000ms');
    expect(error?.message).not.toContain('\0');
  });

  it('clears the owner-discovery reply topic when discovery times out without an owner', async () => {
    const cleared: string[] = [];
    class RecordingPubSub extends EventEmitterPubSub {
      override async clearTopic(topic: string): Promise<void> {
        cleared.push(topic);
      }
    }
    const pubsub = new RecordingPubSub();
    const agent = new Agent({
      id: 'reply-topic-timeout-agent',
      name: 'Reply Topic Timeout Agent',
      instructions: 'Test',
      model: createTextStreamModel('must not run'),
      pubsub,
    });

    const result = agent.sendSignal(
      { type: 'user-message', contents: 'nobody home' },
      {
        resourceId: 'reply-topic-timeout-resource',
        threadId: 'reply-topic-timeout-thread',
        ifIdle: { behavior: 'wake', requireClaimedOwner: true },
      },
    );

    await expect(result.accepted).rejects.toThrow('No claimed thread owner responded');
    await waitForCondition(() => cleared.some(topic => topic.startsWith('agent.thread-owner-discovery.')));
  });

  it('skips the discovery request and re-releases the reply topic when subscribe finishes after the timeout', async () => {
    const cleared: string[] = [];
    const publishedTypes: string[] = [];
    let releaseSubscribe!: () => void;
    const subscribeGate = new Promise<void>(resolve => {
      releaseSubscribe = resolve;
    });
    class GatedSubscribePubSub extends EventEmitterPubSub {
      override async subscribe(topic: string, cb: EventCallback): Promise<void> {
        // Hold the per-request reply-topic subscribe past the discovery timeout.
        if (topic.startsWith('agent.thread-peer-discovery.')) await subscribeGate;
        return super.subscribe(topic, cb);
      }
      override async publish(topic: string, event: any): Promise<void> {
        publishedTypes.push(event.data?.type);
        return super.publish(topic, event);
      }
      override async clearTopic(topic: string): Promise<void> {
        cleared.push(topic);
      }
    }
    const pubsub = new GatedSubscribePubSub();
    const agent = new Agent({
      id: 'late-subscribe-discovery-agent',
      name: 'Late Subscribe Discovery Agent',
      instructions: 'Test',
      model: createTextStreamModel('discovery response'),
      pubsub,
    });

    await agent.discoverThreadPeers({ timeoutMs: 10 });
    expect(cleared).toEqual([expect.stringMatching(/^agent\.thread-peer-discovery\./)]);

    releaseSubscribe();
    await new Promise(resolve => setTimeout(resolve, 0));

    // The late subscribe must not publish the request (replies would recreate
    // the released reply stream) and must release the reply topic again, since
    // its callback attached after the first release.
    expect(publishedTypes).not.toContain('thread-peer-request');
    expect(cleared).toEqual([
      expect.stringMatching(/^agent\.thread-peer-discovery\./),
      expect.stringMatching(/^agent\.thread-peer-discovery\./),
    ]);
    expect(cleared[0]).toBe(cleared[1]);
  });

  it('updates advertised peer metadata without replacing thread ownership', async () => {
    const pubsub = new EventEmitterPubSub();
    const ownerAgent = new Agent({
      id: 'updatable-peer-agent',
      name: 'Updatable Peer Agent',
      instructions: 'Test',
      model: createTextStreamModel('owner response'),
      pubsub,
    });
    const discoveryAgent = new Agent({
      id: 'peer-discovery-agent',
      name: 'Peer Discovery Agent',
      instructions: 'Test',
      model: createTextStreamModel('discovery response'),
      pubsub,
    });
    const target = { resourceId: 'updatable-resource', threadId: 'updatable-thread' };
    const claim = await ownerAgent.claimThreadOwnership({
      ...target,
      peer: { label: 'Mastra', title: 'Initial title', metadata: { mode: 'build' } },
    });

    expect(
      ownerAgent.updateThreadPeerAdvertisement({
        ...target,
        peer: { title: 'Renamed thread', metadata: { mode: 'review' } },
      }),
    ).toBe(true);
    expect(discoveryAgent.updateThreadPeerAdvertisement({ ...target, peer: { title: 'Unauthorized rename' } })).toBe(
      false,
    );

    await expect(discoveryAgent.discoverThreadPeers()).resolves.toEqual([
      expect.objectContaining({
        id: 'updatable-peer-agent:updatable-resource:updatable-thread',
        label: 'Mastra',
        title: 'Renamed thread',
        metadata: { mode: 'review' },
      }),
    ]);

    expect(ownerAgent.updateThreadPeerAdvertisement({ ...target, peer: { metadata: undefined } })).toBe(true);
    const peersAfterClearingMetadata = await discoveryAgent.discoverThreadPeers();
    expect(peersAfterClearingMetadata).toEqual([
      expect.objectContaining({
        id: 'updatable-peer-agent:updatable-resource:updatable-thread',
        label: 'Mastra',
        title: 'Renamed thread',
      }),
    ]);
    expect(peersAfterClearingMetadata[0]?.metadata).toBeUndefined();

    claim.unsubscribe();
    await expect(discoveryAgent.discoverThreadPeers({ timeoutMs: 10 })).resolves.toEqual([]);
  });

  it('settles peer discovery without waiting for pubsub unsubscribe', async () => {
    const pubsub = new HangingUnsubscribePubSub();
    const agent = new Agent({
      id: 'hanging-unsubscribe-agent',
      name: 'Hanging Unsubscribe Agent',
      instructions: 'Test',
      model: createTextStreamModel('unused'),
      pubsub,
    });

    await expect(
      withTimeout(agent.discoverThreadPeers({ timeoutMs: 10 }), 'Peer discovery waited for unsubscribe', 100),
    ).resolves.toEqual([]);
  });

  it('rejects an idle wake that requires an unavailable claimed owner', async () => {
    const pubsub = new EventEmitterPubSub();
    const agent = new Agent({
      id: 'required-owner-agent',
      name: 'Required Owner Agent',
      instructions: 'Test',
      model: createTextStreamModel('must not run'),
      pubsub,
    });

    const result = agent.sendSignal(
      { type: 'user-message', contents: 'deliver remotely' },
      {
        resourceId: 'required-owner-resource',
        threadId: 'required-owner-thread',
        ifIdle: { behavior: 'wake', requireClaimedOwner: true },
      },
    );

    await expect(result.accepted).rejects.toThrow('No claimed thread owner responded');
    expect(
      agent.getActiveThreadRunId({ resourceId: 'required-owner-resource', threadId: 'required-owner-thread' }),
    ).toBe(undefined);
  });

  it('rejects every concurrent idle wake when claimed-owner discovery times out', async () => {
    const pubsub = new EventEmitterPubSub();
    const agent = new Agent({
      id: 'concurrent-required-owner-agent',
      name: 'Concurrent Required Owner Agent',
      instructions: 'Test',
      model: createTextStreamModel('must not run'),
      pubsub,
    });

    const firstSignal = agent.sendSignal(
      { type: 'user-message', contents: 'first remote delivery' },
      {
        resourceId: 'concurrent-required-owner-resource',
        threadId: 'concurrent-required-owner-thread',
        ifIdle: { behavior: 'wake', requireClaimedOwner: true },
      },
    );
    const secondSignal = agent.sendSignal(
      { type: 'user-message', contents: 'second remote delivery' },
      {
        resourceId: 'concurrent-required-owner-resource',
        threadId: 'concurrent-required-owner-thread',
        ifIdle: { behavior: 'wake' },
      },
    );

    const outcomes = await Promise.allSettled([firstSignal.accepted, secondSignal.accepted]);
    expect(outcomes).toHaveLength(2);
    for (const outcome of outcomes) {
      expect(outcome.status).toBe('rejected');
      if (outcome.status === 'rejected') {
        expect(outcome.reason).toEqual(
          expect.objectContaining({ message: expect.stringContaining('No claimed thread owner responded') }),
        );
      }
    }
  });

  it('does not answer ownership discovery after a claim is synchronously released', async () => {
    const pubsub = new RetainedAsyncCallbackPubSub();
    const firstRuntime = new AgentThreadStreamRuntime();
    const secondRuntime = new AgentThreadStreamRuntime();
    const firstAgent = new Agent({
      id: 'released-owner-agent',
      name: 'Released Owner Agent',
      instructions: 'Test',
      model: createTextStreamModel('first owner response'),
      pubsub,
    });
    const secondAgent = new Agent({
      id: 'replacement-owner-agent',
      name: 'Replacement Owner Agent',
      instructions: 'Test',
      model: createTextStreamModel('second owner response'),
      pubsub,
    });

    const firstClaim = await firstRuntime.claimThreadOwnership(
      firstAgent,
      { resourceId: 'released-owner-user', threadId: 'released-owner-thread' },
      pubsub,
    );
    const secondClaimPromise = secondRuntime.claimThreadOwnership(
      secondAgent,
      { resourceId: 'released-owner-user', threadId: 'released-owner-thread' },
      pubsub,
    );
    firstClaim.unsubscribe();

    const secondClaim = await secondClaimPromise;
    expect(secondClaim.claimed).toBe(true);
    secondClaim.unsubscribe();
  });

  it('keeps only one active same-runtime claim across concurrent replacements with distinct peer IDs', async () => {
    const pubsub = new RetainedAsyncCallbackPubSub();
    const runtime = new AgentThreadStreamRuntime();
    const agent = new Agent({
      id: 'concurrent-peer-owner-agent',
      name: 'Concurrent Peer Owner Agent',
      instructions: 'Test',
      model: createTextStreamModel('owner response'),
      pubsub,
    });
    const target = { resourceId: 'concurrent-peer-resource', threadId: 'concurrent-peer-thread' };

    const [firstClaim, secondClaim] = await Promise.all([
      runtime.claimThreadOwnership(agent, { ...target, peer: { id: 'first-custom-peer' } }, pubsub),
      runtime.claimThreadOwnership(agent, { ...target, peer: { id: 'second-custom-peer' } }, pubsub),
    ]);

    expect(firstClaim.claimed).toBe(true);
    expect(secondClaim.claimed).toBe(true);
    const peers = await runtime.discoverThreadPeers({ timeoutMs: 10 }, pubsub);
    expect(peers).toHaveLength(1);

    const displacedClaim = peers[0]?.id === 'first-custom-peer' ? secondClaim : firstClaim;
    const activeClaim = peers[0]?.id === 'first-custom-peer' ? firstClaim : secondClaim;
    displacedClaim.unsubscribe();
    await expect(runtime.discoverThreadPeers({ timeoutMs: 10 }, pubsub)).resolves.toHaveLength(1);
    activeClaim.unsubscribe();
  });

  it('keeps only one active same-runtime owner callback across concurrent peerless replacements', async () => {
    const pubsub = new RetainedAsyncCallbackPubSub();
    const runtime = new AgentThreadStreamRuntime();
    const firstAgent = new Agent({
      id: 'first-concurrent-owner-agent',
      name: 'First Concurrent Owner Agent',
      instructions: 'Test',
      model: createTextStreamModel('first owner response'),
      pubsub,
    });
    const secondAgent = new Agent({
      id: 'second-concurrent-owner-agent',
      name: 'Second Concurrent Owner Agent',
      instructions: 'Test',
      model: createTextStreamModel('second owner response'),
      pubsub,
    });
    const firstStream = vi.spyOn(firstAgent, 'stream');
    const secondStream = vi.spyOn(secondAgent, 'stream');
    const target = { resourceId: 'concurrent-owner-resource', threadId: 'concurrent-owner-thread' };

    const claims = await Promise.all([
      runtime.claimThreadOwnership(firstAgent, { ...target, peer: false }, pubsub),
      runtime.claimThreadOwnership(secondAgent, { ...target, peer: false }, pubsub),
    ]);
    const sender = new Agent({
      id: 'concurrent-owner-sender',
      name: 'Concurrent Owner Sender',
      instructions: 'Test',
      model: createTextStreamModel('unused'),
      pubsub,
    });

    await expect(
      sender.sendSignal(
        { type: 'user-message', contents: 'wake active owner' },
        {
          ...target,
          ifIdle: { behavior: 'wake', requireClaimedOwner: true },
        },
      ).accepted,
    ).resolves.toMatchObject({ action: 'deliver' });
    await pubsub.flush();
    await waitForCondition(() => firstStream.mock.calls.length + secondStream.mock.calls.length > 0);
    expect(firstStream.mock.calls.length + secondStream.mock.calls.length).toBe(1);

    claims.forEach(claim => claim.unsubscribe());
  });

  it('does not claim thread ownership when another runtime already owns the thread', async () => {
    const pubsub = new EventEmitterPubSub();
    const firstRuntime = new AgentThreadStreamRuntime();
    const secondRuntime = new AgentThreadStreamRuntime();
    const firstAgent = new Agent({
      id: 'first-owner-agent',
      name: 'First Owner Agent',
      instructions: 'Test',
      model: createTextStreamModel('first owner response'),
      pubsub,
    });
    const secondAgent = new Agent({
      id: 'second-owner-agent',
      name: 'Second Owner Agent',
      instructions: 'Test',
      model: createTextStreamModel('second owner response'),
      pubsub,
    });

    const firstClaim = await firstRuntime.claimThreadOwnership(
      firstAgent,
      {
        resourceId: 'claimed-user',
        threadId: 'claimed-thread',
      },
      pubsub,
    );
    const secondClaim = await secondRuntime.claimThreadOwnership(
      secondAgent,
      {
        resourceId: 'claimed-user',
        threadId: 'claimed-thread',
      },
      pubsub,
    );

    expect(firstClaim.claimed).toBe(true);
    expect(secondClaim.claimed).toBe(false);

    firstClaim.unsubscribe();
  });

  it('discovers advertised thread peers over pubsub', async () => {
    const pubsub = new EventEmitterPubSub();
    const ownerAgent = new Agent({
      id: 'peer-owner-agent',
      name: 'Peer Owner Agent',
      instructions: 'Test',
      model: createTextStreamModel('owner response'),
      pubsub,
    });
    const discovererAgent = new Agent({
      id: 'peer-discoverer-agent',
      name: 'Peer Discoverer Agent',
      instructions: 'Test',
      model: createTextStreamModel('discoverer response'),
      pubsub,
    });

    const claim = await ownerAgent.claimThreadOwnership({
      resourceId: 'peer-resource',
      threadId: 'peer-thread',
      peer: {
        label: 'Peer Owner',
        title: 'Owner Thread',
        metadata: { mode: 'build' },
      },
    });

    const peers = await discovererAgent.discoverThreadPeers({ timeoutMs: 10 });

    expect(peers).toHaveLength(1);
    expect(peers[0]).toMatchObject({
      id: 'peer-owner-agent:peer-resource:peer-thread',
      agentId: 'peer-owner-agent',
      resourceId: 'peer-resource',
      threadId: 'peer-thread',
      label: 'Peer Owner',
      title: 'Owner Thread',
      metadata: { mode: 'build' },
    });
    expect(peers[0].sourceId).toBeDefined();
    expect(peers[0].discoveredAt).toBeInstanceOf(Date);

    claim.unsubscribe();
  });

  it('marks the discovering agent own advertisements and leaves sibling agents discoverable', async () => {
    const pubsub = new EventEmitterPubSub();
    const sessionAgent = new Agent({
      id: 'session-peer-agent',
      name: 'Session Peer Agent',
      instructions: 'Test',
      model: createTextStreamModel('session response'),
      pubsub,
    });
    const siblingAgent = new Agent({
      id: 'sibling-peer-agent',
      name: 'Sibling Peer Agent',
      instructions: 'Test',
      model: createTextStreamModel('sibling response'),
      pubsub,
    });

    const sessionClaim = await sessionAgent.claimThreadOwnership({
      resourceId: 'shared-peer-resource',
      threadId: 'session-peer-thread',
      peer: { label: 'Session' },
    });
    const siblingClaim = await siblingAgent.claimThreadOwnership({
      resourceId: 'shared-peer-resource',
      threadId: 'sibling-peer-thread',
      peer: { label: 'Sibling' },
    });

    const peers = await sessionAgent.discoverThreadPeers({ timeoutMs: 10 });
    const byId = new Map(peers.map(peer => [peer.id, peer]));

    // Both advertisements live in one process-wide runtime, but only the caller's
    // own thread is the caller's own — a sibling agent is a peer it can address.
    expect(byId.get('session-peer-agent:shared-peer-resource:session-peer-thread')?.selfAdvertised).toBe(true);
    expect(byId.get('sibling-peer-agent:shared-peer-resource:sibling-peer-thread')?.selfAdvertised).toBeUndefined();

    sessionClaim.unsubscribe();
    siblingClaim.unsubscribe();
  });

  it('keeps the own-advertisement mark when another instance answers discovery for the same thread', async () => {
    const pubsub = new RetainedAsyncCallbackPubSub();
    const agent = new Agent({
      id: 'session-peer-agent',
      name: 'Session Peer Agent',
      instructions: 'Test',
      model: createTextStreamModel('session response'),
      pubsub,
    });

    const claim = await agent.claimThreadOwnership({
      resourceId: 'shared-peer-resource',
      threadId: 'session-peer-thread',
      peer: { label: 'Session' },
    });

    // A second live instance with the same thread loaded answers discovery too, and
    // its reply replaces the local entry with one rebuilt from the wire payload — so
    // a mark computed only from the local advertisements is lost on that path.
    const responder: EventCallback = async event => {
      const data = event.data as any;
      if (data?.type !== 'thread-peer-request') return;
      await pubsub.publish(data.replyTopic, {
        type: 'thread-peer-response',
        runId: data.requestId,
        data: {
          type: 'thread-peer-response',
          requestId: data.requestId,
          sourceId: 'other-instance-source',
          peer: {
            id: 'session-peer-agent:shared-peer-resource:session-peer-thread',
            agentId: 'session-peer-agent',
            resourceId: 'shared-peer-resource',
            threadId: 'session-peer-thread',
            label: 'Session',
          },
        },
      });
    };
    await pubsub.subscribe('agent.thread-peer-discovery', responder);

    const peers = await agent.discoverThreadPeers({ timeoutMs: 10 });
    const byId = new Map(peers.map(peer => [peer.id, peer]));

    expect(byId.get('session-peer-agent:shared-peer-resource:session-peer-thread')?.selfAdvertised).toBe(true);

    await pubsub.unsubscribe('agent.thread-peer-discovery', responder);
    claim.unsubscribe();
  });

  it('releases claimed ownership and peer advertisements when reset for tests', async () => {
    const ownerAgent = new Agent({
      id: 'reset-owner-agent',
      name: 'Reset Owner Agent',
      instructions: 'Test',
      model: createTextStreamModel('owner response'),
    });
    const discovererAgent = new Agent({
      id: 'reset-discoverer-agent',
      name: 'Reset Discoverer Agent',
      instructions: 'Test',
      model: createTextStreamModel('discoverer response'),
    });

    const claim = await ownerAgent.claimThreadOwnership({
      resourceId: 'reset-resource',
      threadId: 'reset-thread',
      peer: { label: 'Reset peer' },
    });
    expect(claim.claimed).toBe(true);
    await expect(discovererAgent.discoverThreadPeers({ timeoutMs: 10 })).resolves.toHaveLength(1);

    agentThreadStreamRuntime.resetForTests();

    await expect(discovererAgent.discoverThreadPeers({ timeoutMs: 10 })).resolves.toEqual([]);
  });
});
