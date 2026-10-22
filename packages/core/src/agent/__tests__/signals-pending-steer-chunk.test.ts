import { beforeEach, describe, expect, it } from 'vitest';

import { isUserMessagePendingChunk, isUserMessageCancelledChunk } from '../../stream/types';
import { Agent } from '../agent';
import { AgentThreadStreamRuntime, agentThreadStreamRuntime } from '../thread-stream-runtime';
import {
  ControlledLeasePubSub,
  createBlockingFirstTextStreamModel,
  waitForActiveRun,
  waitForCondition,
} from './signals-test-utils';

function collect(subscription: { stream: AsyncIterable<unknown> }) {
  const parts: unknown[] = [];
  const finished = (async () => {
    for await (const part of subscription.stream) parts.push(part);
  })();
  return { parts, finished };
}
const hasType = (part: unknown, type: string) =>
  !!part && typeof part === 'object' && 'type' in part && part.type === type;

describe('Agent signals: steer shown to subscribers on accept', () => {
  beforeEach(() => {
    agentThreadStreamRuntime.resetForTests();
  });

  it('publishes the steer as a pending chunk before the run drains it, then echoes the same id', async () => {
    const { model, releaseFirst } = createBlockingFirstTextStreamModel('first response', 'steered response');
    const agent = new Agent({ id: 'pending-steer-agent', name: 'Pending Steer Agent', instructions: 'Test', model });
    const subscription = await agent.subscribeToThread({ threadId: 'pending-steer-thread', resourceId: 'user' });
    const parts: any[] = [];
    void (async () => {
      for await (const part of subscription.stream) parts.push(part);
    })();
    const steerParts = () =>
      parts.filter(part => part.type === 'data-user-message' || part.type === 'data-user-message-pending');

    const stream = await agent.stream('Hello', { memory: { thread: 'pending-steer-thread', resource: 'user' } });
    await waitForActiveRun(subscription);
    await waitForCondition(() => stream._getImmediateText() === 'first response');

    const result = agent.sendMessage(
      { contents: 'also include pricing' },
      { resourceId: 'user', threadId: 'pending-steer-thread' },
    );
    await expect(result.accepted).resolves.toMatchObject({ action: 'deliver', runId: stream.runId });

    // The run is still blocked mid-step: the only way the steer can be here is the accept-time chunk.
    await waitForCondition(() => steerParts().some(part => part.data.id === result.signal.id));
    const pending = steerParts().find(part => part.data.id === result.signal.id);
    expect(pending).toMatchObject({
      runId: stream.runId,
      data: { id: result.signal.id, contents: 'also include pricing', metadata: { status: 'pending' } },
    });
    expect(parts.some(part => part.type === 'finish')).toBe(false);

    releaseFirst();
    await stream.text;
    await waitForCondition(() => parts.some(part => part.type === 'finish'));

    const echoes = steerParts().filter(part => part.data.id === result.signal.id);
    expect(echoes).toHaveLength(2);
    expect(echoes[1].data.metadata?.status).toBeUndefined();
    expect(parts.indexOf(echoes[0])).toBeLessThan(parts.indexOf(echoes[1]));

    subscription.unsubscribe();
  });

  it('publishes a queued follow-up as a queued chunk, then echoes the same id when its run starts', async () => {
    const { model, releaseFirst } = createBlockingFirstTextStreamModel('first response', 'queued response');
    const agent = new Agent({ id: 'pending-queue-agent', name: 'Pending Queue Agent', instructions: 'Test', model });
    const subscription = await agent.subscribeToThread({ threadId: 'pending-queue-thread', resourceId: 'user' });
    const parts: any[] = [];
    void (async () => {
      for await (const part of subscription.stream) parts.push(part);
    })();
    const userParts = (id: string) =>
      parts.filter(
        part => (part.type === 'data-user-message' || part.type === 'data-user-message-pending') && part.data.id === id,
      );

    const stream = await agent.stream('Hello', { memory: { thread: 'pending-queue-thread', resource: 'user' } });
    await waitForActiveRun(subscription);
    await waitForCondition(() => stream._getImmediateText() === 'first response');
    const queued = agent.queueMessage(
      { contents: 'then summarise' },
      { resourceId: 'user', threadId: 'pending-queue-thread' },
    );
    await queued.accepted;

    // The first run is still blocked, so the only way the follow-up is here is the queue-time chunk.
    await waitForCondition(() => userParts(queued.signal.id).length === 1);
    expect(userParts(queued.signal.id)[0]).toMatchObject({
      runId: stream.runId,
      data: { id: queued.signal.id, contents: 'then summarise', metadata: { status: 'queued' } },
    });
    expect(parts.some(part => part.type === 'finish')).toBe(false);

    releaseFirst();
    await stream.text;
    await waitForCondition(() => userParts(queued.signal.id).length === 2);
    const echo = userParts(queued.signal.id)[1];
    expect(echo.data.metadata?.status).toBeUndefined();
    expect(echo.runId).not.toBe(stream.runId);

    subscription.unsubscribe();
  });

  it('publishes a cancel chunk for a queued follow-up that is cancelled before it runs', async () => {
    const { model, releaseFirst } = createBlockingFirstTextStreamModel('first response', 'unused');
    const agent = new Agent({ id: 'cancel-queue-agent', name: 'Cancel Queue Agent', instructions: 'Test', model });
    const subscription = await agent.subscribeToThread({ threadId: 'cancel-queue-thread', resourceId: 'user' });
    const parts: any[] = [];
    void (async () => {
      for await (const part of subscription.stream) parts.push(part);
    })();

    const stream = await agent.stream('Hello', { memory: { thread: 'cancel-queue-thread', resource: 'user' } });
    await waitForActiveRun(subscription);
    await waitForCondition(() => stream._getImmediateText() === 'first response');
    const queued = agent.queueMessage(
      { contents: 'then summarise' },
      { resourceId: 'user', threadId: 'cancel-queue-thread' },
    );
    await queued.accepted;
    await waitForCondition(() =>
      parts.some(
        part =>
          (part.type === 'data-user-message' || part.type === 'data-user-message-pending') &&
          part.data.id === queued.signal.id,
      ),
    );

    const result = agent.cancelQueuedMessages({
      resourceId: 'user',
      threadId: 'cancel-queue-thread',
      signalIds: [queued.signal.id],
    });
    expect(result.cancelledSignalIds).toEqual([queued.signal.id]);
    await waitForCondition(() => parts.some(part => part.type === 'data-user-message-cancelled'));
    expect(parts.find(part => part.type === 'data-user-message-cancelled')).toMatchObject({
      data: { id: queued.signal.id },
    });

    releaseFirst();
    await stream.text;
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(
      parts.filter(
        part =>
          (part.type === 'data-user-message' || part.type === 'data-user-message-pending') &&
          part.data.id === queued.signal.id,
      ),
    ).toHaveLength(1);

    subscription.unsubscribe();
  });

  it.each(['steer', 'queue'] as const)(
    'removes a %s on both subscribers when cancellation is handled by another runtime',
    async kind => {
      const pubsub = new ControlledLeasePubSub();
      const scope = { resourceId: 'remote-user', threadId: `remote-${kind}` };
      const { model, releaseFirst, getStreamCount } = createBlockingFirstTextStreamModel('first response', 'unused');
      const agent = new Agent({ id: 'remote-cancel', name: 'Remote cancel', instructions: 'Test', model, pubsub });
      const own = await agent.subscribeToThread(scope);
      const follower = new AgentThreadStreamRuntime();
      const remote = await follower.subscribeToThread(agent, scope, pubsub);
      const ownRead = collect(own);
      const remoteRead = collect(remote);
      try {
        const first = await agent.stream('Hello', { memory: { resource: scope.resourceId, thread: scope.threadId } });
        await waitForActiveRun(remote);
        await waitForCondition(() => first._getImmediateText() === 'first response');
        const result =
          kind === 'steer' ? agent.sendMessage('do not deliver', scope) : agent.queueMessage('do not deliver', scope);
        await result.accepted;
        for (const read of [ownRead, remoteRead]) {
          await waitForCondition(() =>
            read.parts.some(part => isUserMessagePendingChunk(part) && part.data.id === result.signal.id),
          );
        }
        // This request receiver owns no queue: only the execution owner can confirm removal.
        expect(follower.cancelQueuedMessages(agent, { ...scope, signalIds: [result.signal.id] }, pubsub)).toEqual({
          cancelledSignalIds: [],
        });
        for (const read of [ownRead, remoteRead]) {
          await waitForCondition(() =>
            read.parts.some(part => isUserMessageCancelledChunk(part) && part.data.id === result.signal.id),
          );
        }
        releaseFirst();
        await first.text;
        await pubsub.flush();
        expect(getStreamCount()).toBe(1);
        expect(JSON.stringify(model.doStreamCalls)).not.toContain('do not deliver');
      } finally {
        releaseFirst();
        own.unsubscribe();
        remote.unsubscribe();
        await Promise.all([ownRead.finished, remoteRead.finished]);
      }
    },
  );

  it.each([false, true])(
    'clears pending UI on remote abort only when clearPendingSignals=%s',
    async clearPendingSignals => {
      const pubsub = new ControlledLeasePubSub();
      const scope = { resourceId: 'abort-user', threadId: `abort-${clearPendingSignals}` };
      const { model, releaseFirst } = createBlockingFirstTextStreamModel('first response', 'unused');
      const agent = new Agent({ id: 'abort-pending', name: 'Abort pending', instructions: 'Test', model, pubsub });
      const subscription = await agent.subscribeToThread(scope);
      const follower = new AgentThreadStreamRuntime();
      const remote = await follower.subscribeToThread(agent, scope, pubsub);
      const read = collect(subscription);
      try {
        const first = await agent.stream('Hello', { memory: { resource: scope.resourceId, thread: scope.threadId } });
        await waitForActiveRun(remote);
        await waitForCondition(() => first._getImmediateText() === 'first response');
        const steer = agent.sendMessage('pending steer', scope);
        const queued = agent.queueMessage('pending follow-up', scope);
        await Promise.all([steer.accepted, queued.accepted]);
        await waitForCondition(() => read.parts.filter(isUserMessagePendingChunk).length === 2);
        expect(remote.abort({ clearPendingSignals, expectedRunId: first.runId })).toBe(true);
        await pubsub.flush();
        if (clearPendingSignals) {
          await waitForCondition(() => read.parts.filter(isUserMessageCancelledChunk).length === 2);
          expect(
            read.parts
              .filter(isUserMessageCancelledChunk)
              .map(part => part.data.id)
              .sort(),
          ).toEqual([steer.signal.id, queued.signal.id].sort());
        } else {
          expect(read.parts.filter(isUserMessageCancelledChunk)).toEqual([]);
          agent.cancelQueuedMessages({ ...scope, signalIds: [steer.signal.id, queued.signal.id] });
        }
        releaseFirst();
        await first.text.catch(() => {});
      } finally {
        releaseFirst();
        subscription.unsubscribe();
        remote.unsubscribe();
        await read.finished;
      }
    },
  );

  it('still delivers delayed cancellation after abort closed the model stream', async () => {
    let releaseCancellation!: () => void;
    const cancellationGate = new Promise<void>(resolve => {
      releaseCancellation = resolve;
    });
    class DelayedCancellationPubSub extends ControlledLeasePubSub {
      override async publish(...args: Parameters<ControlledLeasePubSub['publish']>) {
        if (isUserMessageCancelledChunk(args[1].data?.chunk)) await cancellationGate;
        await super.publish(...args);
      }
    }
    const pubsub = new DelayedCancellationPubSub();
    const scope = { resourceId: 'delayed-user', threadId: 'delayed-abort' };
    const { model, releaseFirst } = createBlockingFirstTextStreamModel('first response', 'unused');
    const agent = new Agent({ id: 'delayed-cancel', name: 'Delayed cancel', instructions: 'Test', model, pubsub });
    const subscription = await agent.subscribeToThread(scope);
    const read = collect(subscription);
    try {
      const first = await agent.stream('Hello', { memory: { resource: scope.resourceId, thread: scope.threadId } });
      await waitForActiveRun(subscription);
      await waitForCondition(() => first._getImmediateText() === 'first response');
      const queued = agent.queueMessage('remove after abort', scope);
      await queued.accepted;
      await waitForCondition(() => read.parts.some(isUserMessagePendingChunk));
      subscription.abort({ clearPendingSignals: true });
      await waitForCondition(() => read.parts.some(part => hasType(part, 'abort')));
      expect(read.parts.some(isUserMessageCancelledChunk)).toBe(false);
      releaseCancellation();
      await waitForCondition(() =>
        read.parts.some(part => isUserMessageCancelledChunk(part) && part.data.id === queued.signal.id),
      );
      releaseFirst();
      await first.text.catch(() => {});
    } finally {
      releaseCancellation();
      releaseFirst();
      subscription.unsubscribe();
      await read.finished;
    }
  });
});
