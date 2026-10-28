import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EventEmitterPubSub } from '../../events/event-emitter';
import { MockMemory } from '../../memory/mock';
import { Agent } from '../agent';
import { createSignal } from '../signals';
import { AgentThreadStreamRuntime, agentThreadStreamRuntime } from '../thread-stream-runtime';
import {
  createTextStreamModel,
  createBlockingFirstTextStreamModel,
  nextTick,
  ControlledLeasePubSub,
  createFakeThreadRun,
} from './signals-test-utils';

describe('Agent signals: pending cancellation', () => {
  beforeEach(() => {
    agentThreadStreamRuntime.resetForTests();
  });

  describe('thread-scoped pending signal cancellation', () => {
    it.each(['live', 'retained'] as const)('does not report completed %s observer input as cancelled', async mode => {
      const scope = { resourceId: 'completed-observer', threadId: 'completed-observer' };
      const pubsub = new ControlledLeasePubSub();
      const { model, releaseFirst, getStreamCount } = createBlockingFirstTextStreamModel('first', 'done');
      const agent = new Agent({ id: 'completed-observer', name: 'Observer', model, instructions: 'Test', pubsub });
      const follower = new AgentThreadStreamRuntime();
      let observer = mode === 'live' ? await follower.subscribeToThread(agent, scope, pubsub) : undefined;
      try {
        const first = await agent.stream('initial', { memory: { resource: scope.resourceId, thread: scope.threadId } });
        await vi.waitFor(() => expect(getStreamCount()).toBe(1));
        const signal = agent.sendSignal({ type: 'user-message', contents: 'already answered' }, scope);
        await signal.accepted;
        releaseFirst();
        await first.text;
        await vi.waitFor(() => expect(getStreamCount()).toBe(2));
        await vi.waitFor(() => expect(agentThreadStreamRuntime.getActiveThreadRunId(scope, pubsub)).toBeUndefined());
        observer ??= await follower.subscribeToThread(agent, scope, pubsub);
        await pubsub.flush();
        await nextTick();
        expect(follower.cancelQueuedMessages(agent, { ...scope, signalIds: [signal.signal.id] }, pubsub)).toEqual({
          cancelledSignalIds: [],
        });
        expect(pubsub.publishedData.filter(data => data.type === 'signals-cancelled')).toEqual([
          { type: 'signals-cancelled', signalIds: [signal.signal.id] },
        ]);
      } finally {
        observer?.unsubscribe();
        releaseFirst();
      }
    });

    it('queues a retained signal this runtime only forwarded when it later owns the run', async () => {
      const scope = { resourceId: 'forwarded-replay', threadId: 'forwarded-replay' };
      const pubsub = new ControlledLeasePubSub();
      const topic = `agent.thread-stream.${encodeURIComponent(`${scope.resourceId}\u0000${scope.threadId}`)}`;
      const { model, releaseFirst, getStreamCount } = createBlockingFirstTextStreamModel('first', 'follow-up');
      const agent = new Agent({ id: 'forwarded-replay', name: 'Forwarded', instructions: 'Test', model, pubsub });
      try {
        const first = await agent.stream('initial', { memory: { resource: scope.resourceId, thread: scope.threadId } });
        await vi.waitFor(() => expect(getStreamCount()).toBe(1));
        const ownSourceId = pubsub.publishedData.find(data => typeof data.sourceId === 'string')?.sourceId;
        expect(ownSourceId).toBeTypeOf('string');
        // Retained replay of a signal this runtime forwarded to a previous owner (lease-lost path)
        // and therefore never queued locally.
        const signal = createSignal({ id: 'forwarded-n2', type: 'user-message', contents: 'forwarded notification' });
        await pubsub.publish(topic, {
          type: 'signal-enqueued',
          data: {
            type: 'signal-enqueued',
            runId: first.runId,
            sourceId: ownSourceId,
            signal: signal.toDataPart().data,
          },
        });
        await pubsub.flush();
        await nextTick();
        releaseFirst();
        await first.text;
        await vi.waitFor(() => expect(getStreamCount()).toBe(2));
        await vi.waitFor(() => expect(agentThreadStreamRuntime.getActiveThreadRunId(scope, pubsub)).toBeUndefined());
        expect(JSON.stringify(model.doStreamCalls[1]?.prompt).split('forwarded notification')).toHaveLength(2);
      } finally {
        releaseFirst();
      }
    });

    it('does not re-queue the echo of a signal this runtime queued locally', async () => {
      const scope = { resourceId: 'local-echo', threadId: 'local-echo' };
      const pubsub = new ControlledLeasePubSub();
      const { model, releaseFirst, getStreamCount } = createBlockingFirstTextStreamModel('first', 'follow-up');
      const agent = new Agent({ id: 'local-echo', name: 'Echo', instructions: 'Test', model, pubsub });
      try {
        const first = await agent.stream('initial', { memory: { resource: scope.resourceId, thread: scope.threadId } });
        await vi.waitFor(() => expect(getStreamCount()).toBe(1));
        await agent.sendSignal({ type: 'user-message', contents: 'local follow-up' }, scope).accepted;
        await pubsub.flush();
        await nextTick();
        releaseFirst();
        await first.text;
        await vi.waitFor(() => expect(getStreamCount()).toBe(2));
        await vi.waitFor(() => expect(agentThreadStreamRuntime.getActiveThreadRunId(scope, pubsub)).toBeUndefined());
        expect(getStreamCount()).toBe(2);
        expect(JSON.stringify(model.doStreamCalls[1]?.prompt).split('local follow-up')).toHaveLength(2);
      } finally {
        releaseFirst();
      }
    });

    it.each([false, true])(
      'keeps cancellation ahead of delayed enqueue retries with initial delivery=%s',
      async delivered => {
        const scope = { resourceId: 'retry-cancel', threadId: 'retry-cancel' };
        const pubsub = new ControlledLeasePubSub();
        const topic = `agent.thread-stream.${encodeURIComponent(`${scope.resourceId}\u0000${scope.threadId}`)}`;
        const { model, releaseFirst, getStreamCount } = createBlockingFirstTextStreamModel('first', 'survivor');
        const agent = new Agent({ id: 'retry-cancel', name: 'Retry', instructions: 'Test', model, pubsub });
        let release!: () => void;
        const gate = new Promise<void>(resolve => {
          release = resolve;
        });
        const first = await agent.stream('initial', { memory: { resource: scope.resourceId, thread: scope.threadId } });
        await vi.waitFor(() => expect(getStreamCount()).toBe(1));
        const signal = createSignal({ id: 'delayed-retry', type: 'user-message', contents: 'cancelled retry input' });
        const enqueue = {
          type: 'signal-enqueued',
          data: { type: 'signal-enqueued', runId: first.runId, sourceId: 'remote', signal: signal.toDataPart().data },
        };
        const registration = pubsub.publishedData.find(
          data => data.type === 'run-registered' && data.runId === first.runId,
        );
        const readOwner = vi.spyOn(pubsub, 'getLeaseOwner').mockImplementationOnce(async () => {
          await gate;
          return undefined;
        });
        try {
          if (delivered) {
            await pubsub.publish(topic, enqueue);
            await pubsub.flush();
            await nextTick();
          }
          // Hold a real control handler while cancellation and a Redis-style republished retry arrive.
          // Only a clearing abort reads the lease, so that is the request that can be held.
          await pubsub.publish(topic, {
            type: 'run-abort-requested',
            data: {
              type: 'run-abort-requested',
              runId: first.runId,
              streamId: registration.streamId,
              clearPendingSignals: true,
            },
          });
          await vi.waitFor(() => expect(readOwner).toHaveBeenCalled());
          await pubsub.publish(topic, {
            type: 'signals-cancelled',
            data: { type: 'signals-cancelled', signalIds: [signal.id] },
          });
          await pubsub.publish(topic, { ...enqueue, deliveryAttempt: 2 });
          await pubsub.flush();
          release();
          await nextTick();
          expect(agent.cancelQueuedMessages({ ...scope, signalIds: [signal.id] })).toEqual({ cancelledSignalIds: [] });
          await agent.queueMessage('surviving retry input', scope).accepted;
          releaseFirst();
          await first.text;
          await vi.waitFor(() => expect(getStreamCount()).toBe(2));
          await vi.waitFor(() => expect(agentThreadStreamRuntime.getActiveThreadRunId(scope, pubsub)).toBeUndefined());
          expect(JSON.stringify(model.doStreamCalls[1]?.prompt)).toContain('surviving retry input');
          expect(JSON.stringify(model.doStreamCalls[1]?.prompt)).not.toContain('cancelled retry input');
          await vi.waitFor(() => expect(pubsub.subscriberCount(topic)).toBe(0));
        } finally {
          release();
          releaseFirst();
          readOwner.mockRestore();
        }
      },
    );

    it.each([false, true])('preserves in-flight remote input during handoff with observer=%s', async observed => {
      const scope = { resourceId: 'transfer-ingress', threadId: 'transfer-ingress' };
      const pubsub = new ControlledLeasePubSub();
      const { model, releaseFirst, getStreamCount } = createBlockingFirstTextStreamModel('first', 'next');
      const agent = new Agent({ id: 'transfer-ingress', name: 'Transfer', model, pubsub, instructions: 'Test' });
      const subscription = observed ? await agent.subscribeToThread(scope) : undefined;
      let entered!: () => void;
      const entering = new Promise<void>(resolve => {
        entered = resolve;
      });
      let release!: () => void;
      const gate = new Promise<void>(resolve => {
        release = resolve;
      });
      let deliver!: () => void;
      const delivery = new Promise<void>(resolve => {
        deliver = resolve;
      });
      let sending!: () => void;
      const sent = new Promise<void>(resolve => {
        sending = resolve;
      });
      const publish = pubsub.publish.bind(pubsub);
      vi.spyOn(pubsub, 'publish').mockImplementation(async (topic, event) => {
        if (event.data?.type === 'signal-enqueued' && event.data.signal.contents === 'late forwarded input') {
          sending();
          await delivery;
        }
        await publish(topic, event);
      });
      const remote = new AgentThreadStreamRuntime();
      try {
        const first = await agent.stream('initial', { memory: { resource: scope.resourceId, thread: scope.threadId } });
        await vi.waitFor(() => expect(getStreamCount()).toBe(1));
        await agent.sendSignal({ type: 'user-message', contents: 'followup' }, scope).accepted;
        const forwarded = remote.sendSignal(
          agent,
          { type: 'user-message', contents: 'late forwarded input' },
          scope,
          pubsub,
        );
        await sent;
        pubsub.transferLeaseWait = gate;
        pubsub.onTransferLease = entered;
        agent.abortThreadStream(scope);
        releaseFirst();
        await first.text;
        await entering;
        deliver();
        await forwarded.accepted;
        await pubsub.flush();
        await nextTick();
        release();
        await vi.waitFor(() => expect(agentThreadStreamRuntime.getActiveThreadRunId(scope, pubsub)).toBeUndefined());
        expect(JSON.stringify(model.doStreamCalls.slice(1))).toContain('late forwarded input');
      } finally {
        deliver();
        release();
        releaseFirst();
        subscription?.unsubscribe();
      }
    });

    it('releases follower control after observed work finishes and the last observer disconnects', async () => {
      const scope = { resourceId: 'observed-copy', threadId: 'observed-copy' };
      const topic = `agent.thread-stream.${encodeURIComponent(`${scope.resourceId}\u0000${scope.threadId}`)}`;
      const pubsub = new ControlledLeasePubSub();
      const { model, releaseFirst, getStreamCount } = createBlockingFirstTextStreamModel('first', 'next');
      const agent = new Agent({ id: 'observed-copy', name: 'Copy', model, pubsub, instructions: 'Test' });
      const followerRuntime = new AgentThreadStreamRuntime();
      const follower = await followerRuntime.subscribeToThread(agent, scope, pubsub);
      try {
        const first = await agent.stream('initial', { memory: { resource: scope.resourceId, thread: scope.threadId } });
        await vi.waitFor(() => expect(getStreamCount()).toBe(1));
        await agent.sendSignal({ type: 'user-message', contents: 'already consumed input' }, scope).accepted;
        await pubsub.flush();
        await nextTick();
        releaseFirst();
        await first.text;
        await vi.waitFor(() => expect(getStreamCount()).toBe(2));
        await vi.waitFor(() => expect(pubsub.subscriberCount(topic)).toBe(2));
        follower.unsubscribe();
        await vi.waitFor(() => expect(pubsub.subscriberCount(topic)).toBe(0));
      } finally {
        releaseFirst();
        follower.unsubscribe();
      }
    });
    it.each([false, true])(
      'does not execute retained observer history after listener recreation with new runtime=%s',
      async newRuntime => {
        const scope = { resourceId: 'retained-lifetime', threadId: 'retained-lifetime' };
        const topic = `agent.thread-stream.${encodeURIComponent(`${scope.resourceId}\u0000${scope.threadId}`)}`;
        const pubsub = new ControlledLeasePubSub();
        const { model, releaseFirst, getStreamCount } = createBlockingFirstTextStreamModel('first', 'next');
        const agent = new Agent({ id: 'retained-lifetime', name: 'Retained', model, pubsub, instructions: 'Test' });
        const options = { memory: { resource: scope.resourceId, thread: scope.threadId } };
        const first = await agent.stream('initial', options);
        await vi.waitFor(() => expect(getStreamCount()).toBe(1));
        await agent.sendSignal({ type: 'user-message', contents: 'already executed' }, scope).accepted;
        const cancelled = createSignal({ type: 'user-message', contents: 'already cancelled' });
        await pubsub.publish(topic, {
          type: 'signal-enqueued',
          data: {
            type: 'signal-enqueued',
            runId: first.runId,
            signal: cancelled.toDataPart().data,
            sourceId: 'foreign',
          },
        });
        await pubsub.flush();
        await nextTick();
        expect(agent.cancelQueuedMessages({ ...scope, signalIds: [cancelled.id] }).cancelledSignalIds).toEqual([
          cancelled.id,
        ]);
        releaseFirst();
        await first.text;
        await vi.waitFor(() => expect(pubsub.subscriberCount(topic)).toBe(0));
        const runtime = newRuntime ? new AgentThreadStreamRuntime() : agentThreadStreamRuntime;
        for (let lifetime = 0; lifetime < 2; lifetime++) {
          const subscription = await runtime.subscribeToThread(agent, scope, pubsub);
          const runId = `fresh-run-${lifetime}`;
          try {
            await runtime.waitForCrossAgentThreadRun(agent, { ...options, runId }, pubsub);
            await pubsub.flush();
            await nextTick();
            expect(runtime.drainPendingSignals(runId, pubsub, 'pre-run')).toEqual([]);
            expect(runtime.drainPendingSignals(runId, pubsub)).toEqual([]);
          } finally {
            runtime.releaseThreadRunReservation(runId, pubsub);
            subscription.unsubscribe();
          }
          await vi.waitFor(() => expect(pubsub.subscriberCount(topic)).toBe(0));
        }
        expect(getStreamCount()).toBe(2);
      },
    );

    it('does not readmit consumed or cancelled input on duplicate control delivery', async () => {
      const scope = { resourceId: 'duplicate-control', threadId: 'duplicate-control' };
      const topic = `agent.thread-stream.${encodeURIComponent(`${scope.resourceId}\u0000${scope.threadId}`)}`;
      const pubsub = new ControlledLeasePubSub();
      const runtime = new AgentThreadStreamRuntime();
      const agent = new Agent({
        id: 'duplicate-control',
        name: 'Duplicate',
        instructions: 'Test',
        model: createTextStreamModel('unused'),
        pubsub,
      });
      const runId = 'duplicate-run';
      await runtime.waitForCrossAgentThreadRun(
        agent,
        { runId, memory: { resource: scope.resourceId, thread: scope.threadId } },
        pubsub,
      );
      try {
        for (const cancel of [false, true]) {
          const signal = createSignal({ type: 'user-message', contents: 'once' });
          const event = {
            type: 'signal-enqueued',
            data: { type: 'signal-enqueued', runId, sourceId: 'foreign', signal: signal.toDataPart().data },
          };
          await pubsub.publish(topic, event);
          await pubsub.flush();
          await nextTick();
          if (cancel) {
            expect(
              runtime.cancelQueuedMessages(agent, { ...scope, signalIds: [signal.id] }, pubsub).cancelledSignalIds,
            ).toEqual([signal.id]);
          } else expect(runtime.drainPendingSignals(runId, pubsub).map(entry => entry.id)).toEqual([signal.id]);
          await pubsub.publish(topic, event);
          await pubsub.flush();
          await nextTick();
          expect(runtime.drainPendingSignals(runId, pubsub)).toEqual([]);
        }
      } finally {
        runtime.releaseThreadRunReservation(runId, pubsub);
      }
      await vi.waitFor(() => expect(pubsub.subscriberCount(topic)).toBe(0));
    });

    it('receives remote input without observers and cleans up without replaying it into later runs', async () => {
      const scope = { resourceId: 'control-user', threadId: 'control-thread' };
      const topic = `agent.thread-stream.${encodeURIComponent(`${scope.resourceId}\u0000${scope.threadId}`)}`;
      const pubsub = new ControlledLeasePubSub();
      const { model, releaseFirst, getStreamCount } = createBlockingFirstTextStreamModel('first', 'next');
      const agent = new Agent({ id: 'control-owner', name: 'Control', instructions: 'Test', model, pubsub });
      const options = { memory: { resource: scope.resourceId, thread: scope.threadId } };
      try {
        const first = await agent.stream('initial', options);
        await vi.waitFor(() => expect(getStreamCount()).toBe(1));
        expect(pubsub.subscriberCount(topic)).toBe(1);
        const signal = createSignal({ type: 'user-message', contents: 'remote input exactly once' });
        await pubsub.publish(topic, {
          type: 'signal-enqueued',
          data: { type: 'signal-enqueued', runId: first.runId, sourceId: 'remote', signal: signal.toDataPart().data },
        });
        await pubsub.flush();
        await nextTick();
        releaseFirst();
        await first.text;
        await vi.waitFor(() => expect(pubsub.subscriberCount(topic)).toBe(0));
        expect(getStreamCount()).toBe(2);
        expect(JSON.stringify(model.doStreamCalls[1]?.prompt)).toContain('remote input exactly once');
        const next = await agent.stream('new request', options);
        await next.text;
        await vi.waitFor(() => expect(pubsub.subscriberCount(topic)).toBe(0));
        expect(getStreamCount()).toBe(3);
        expect(JSON.stringify(model.doStreamCalls[2]?.prompt)).not.toContain('remote input exactly once');
      } finally {
        releaseFirst();
      }
    });

    it.each(['success', 'failure'] as const)(
      'cancels remote pre-run input without observers and cleans up on preparation %s',
      async outcome => {
        const scope = { resourceId: 'prepare-control-user', threadId: 'prepare-control-thread' };
        const topic = `agent.thread-stream.${encodeURIComponent(`${scope.resourceId}\u0000${scope.threadId}`)}`;
        const pubsub = new ControlledLeasePubSub();
        const model = createTextStreamModel('answer');
        let entered!: () => void;
        let release!: () => void;
        const preparing = new Promise<void>(resolve => {
          entered = resolve;
        });
        const gate = new Promise<void>(resolve => {
          release = resolve;
        });
        const agent = new Agent({
          id: 'prepare-control',
          name: 'Prepare',
          model,
          pubsub,
          instructions: async () => {
            entered();
            await gate;
            if (outcome === 'failure') throw new Error('Preparation failed');
            return 'Test';
          },
        });
        const starting = agent.stream('initial', { memory: { resource: scope.resourceId, thread: scope.threadId } });
        void starting.catch(() => {});
        try {
          await preparing;
          expect(pubsub.subscriberCount(topic)).toBe(1);
          const pending = agent.sendSignal({ type: 'user-message', contents: 'cancel before registration' }, scope);
          await pending.accepted;
          await pubsub.publish(topic, {
            type: 'signals-cancelled',
            data: { type: 'signals-cancelled', signalIds: [pending.signal.id] },
          });
          await pubsub.flush();
          await nextTick();
          expect(agent.cancelQueuedMessages({ ...scope, signalIds: [pending.signal.id] })).toEqual({
            cancelledSignalIds: [],
          });
          release();
          if (outcome === 'failure') await expect(starting).rejects.toThrow('Preparation failed');
          else {
            await (
              await starting
            ).text;
            expect(JSON.stringify(model.doStreamCalls[0]?.prompt)).not.toContain('cancel before registration');
          }
          await vi.waitFor(() => expect(pubsub.subscriberCount(topic)).toBe(0));
        } finally {
          release();
        }
      },
    );

    it('keeps control listening while suspended without observers and releases it after resume', async () => {
      const scope = { resourceId: 'suspended-control-user', threadId: 'suspended-control-thread' };
      const topic = `agent.thread-stream.${encodeURIComponent(`${scope.resourceId}\u0000${scope.threadId}`)}`;
      const pubsub = new ControlledLeasePubSub();
      const runtime = new AgentThreadStreamRuntime();
      const agent = new Agent({
        id: 'suspended-control',
        name: 'Suspended',
        instructions: 'Test',
        model: createTextStreamModel('unused'),
        pubsub,
      });
      const runId = 'suspended-control-run';
      let finish!: () => void;
      const finished = new Promise<void>(resolve => {
        finish = resolve;
      });
      const output = createFakeThreadRun(runId, finished);
      output.status = 'suspended';
      output.fullStream = new ReadableStream({
        start(controller) {
          controller.enqueue({
            type: 'tool-call-approval',
            runId,
            payload: { toolCallId: 'approval', toolName: 'test' },
          });
          controller.close();
        },
      });
      const options = { memory: { resource: scope.resourceId, thread: scope.threadId } };
      await runtime.registerRun(agent, output, options, pubsub);
      await vi.waitFor(() => expect(runtime.getResumableThreadRun({ ...scope, runId }, pubsub)).toBeDefined());
      finish();
      await vi.waitFor(() => expect(pubsub.publishedData.some(data => data.type === 'run-suspended')).toBe(true));
      expect(pubsub.subscriberCount(topic)).toBe(1);
      const pending = runtime.queueMessage(agent, 'cancel behind approval', scope, pubsub);
      await pending.accepted;
      await pubsub.publish(topic, {
        type: 'signals-cancelled',
        data: { type: 'signals-cancelled', signalIds: [pending.signal.id] },
      });
      await pubsub.flush();
      await nextTick();
      expect(runtime.cancelQueuedMessages(agent, { ...scope, signalIds: [pending.signal.id] }, pubsub)).toEqual({
        cancelledSignalIds: [],
      });
      expect(pubsub.subscriberCount(topic)).toBe(1);
      await runtime.registerRun(agent, createFakeThreadRun(runId, Promise.resolve()), options, pubsub);
      await vi.waitFor(() => expect(pubsub.subscriberCount(topic)).toBe(0));
    });

    it('waits for the control subscription before preparing a run and recovers from subscription failure', async () => {
      const scope = { resourceId: 'ready-user', threadId: 'ready-thread' };
      const pubsub = new ControlledLeasePubSub();
      let release!: () => void;
      const gate = new Promise<void>(resolve => {
        release = resolve;
      });
      const subscribeNormally = pubsub.subscribe.bind(pubsub);
      const subscribe = vi.spyOn(pubsub, 'subscribe').mockImplementationOnce(async (topic, callback) => {
        await subscribeNormally(topic, callback);
        await gate;
        throw new Error('Subscription unavailable');
      });
      const instructions = vi.fn(() => 'Test');
      const agent = new Agent({
        id: 'ready-control',
        name: 'Ready',
        instructions,
        model: createTextStreamModel('answer'),
        pubsub,
      });
      const options = { memory: { resource: scope.resourceId, thread: scope.threadId } };
      const starting = agent.stream('initial', options);
      void starting.catch(() => {});
      try {
        await vi.waitFor(() => expect(subscribe).toHaveBeenCalledTimes(1));
        expect(instructions).not.toHaveBeenCalled();
        release();
        await expect(starting).rejects.toThrow('Subscription unavailable');
        expect(
          pubsub.subscriberCount(
            `agent.thread-stream.${encodeURIComponent(`${scope.resourceId}\u0000${scope.threadId}`)}`,
          ),
        ).toBe(0);
        subscribe.mockRestore();
        await expect((await agent.stream('retry', options)).text).resolves.toBe('answer');
      } finally {
        release();
        subscribe.mockRestore();
      }
    });

    it.each(
      (['connected', 'absent', 'disconnected'] as const).flatMap(observer =>
        [false, true].map(localCopy => ({ observer, localCopy })),
      ),
    )(
      'propagates requested IDs with owner observer $observer and local copy $localCopy without cancelling survivors',
      async ({ observer, localCopy }) => {
        const scope = { resourceId: 'propagate-user', threadId: 'propagate-thread' };
        const pubsub = new ControlledLeasePubSub();
        const followerRuntime = new AgentThreadStreamRuntime();
        const { model, releaseFirst, getStreamCount } = createBlockingFirstTextStreamModel('first', 'survivor answer');
        const agent = new Agent({
          id: 'propagate-agent',
          name: 'Propagation',
          instructions: 'Test',
          model,
          memory: new MockMemory(),
          pubsub,
        });
        const owner = observer === 'absent' ? undefined : await agent.subscribeToThread(scope);
        const follower = await followerRuntime.subscribeToThread(agent, scope, pubsub);
        try {
          const first = await agent.stream('initial', {
            memory: { resource: scope.resourceId, thread: scope.threadId },
          });
          await vi.waitFor(() => expect(getStreamCount()).toBe(1));
          await pubsub.flush();
          await vi.waitFor(() => expect(follower.activeRunId()).toBe(first.runId));
          const removed = localCopy
            ? followerRuntime.queueMessage(agent, 'cancelled remote input', scope, pubsub)
            : agent.sendSignal({ type: 'user-message', contents: 'cancelled remote input' }, scope);
          await removed.accepted;
          // Model a pending copy routed to the execution owner, not an observer-only history entry.
          if (localCopy) {
            await pubsub.publish(
              `agent.thread-stream.${encodeURIComponent(`${scope.resourceId}\u0000${scope.threadId}`)}`,
              {
                type: 'signal-enqueued',
                data: {
                  type: 'signal-enqueued',
                  runId: first.runId,
                  signal: removed.signal.toDataPart().data,
                  sourceId: 'follower',
                },
              },
            );
          }
          const ownerOnly = agent.queueMessage('cancelled owner-only input', scope);
          await ownerOnly.accepted;
          const survivor = agent.queueMessage('surviving input', scope);
          await survivor.accepted;
          await pubsub.flush();
          await nextTick();
          if (observer === 'disconnected') owner?.unsubscribe();
          // Requested remote-only IDs are published but never included in the local result.
          expect(
            followerRuntime.cancelQueuedMessages(
              agent,
              { ...scope, signalIds: [removed.signal.id, removed.signal.id, ownerOnly.signal.id, 'missing'] },
              pubsub,
            ),
          ).toEqual({ cancelledSignalIds: localCopy ? [removed.signal.id] : [] });
          await pubsub.flush();
          await nextTick();
          expect(pubsub.publishedData.filter(data => data.type === 'signals-cancelled')).toEqual([
            { type: 'signals-cancelled', signalIds: [removed.signal.id, ownerOnly.signal.id, 'missing'] },
          ]);
          expect(agent.cancelQueuedMessages({ ...scope, signalIds: [removed.signal.id, ownerOnly.signal.id] })).toEqual(
            {
              cancelledSignalIds: [],
            },
          );
          releaseFirst();
          await first.text;
          await vi.waitFor(() => expect(getStreamCount()).toBe(2));
          await vi.waitFor(() => expect(agentThreadStreamRuntime.getActiveThreadRunId(scope, pubsub)).toBeUndefined());
          const prompt = JSON.stringify(model.doStreamCalls[1]?.prompt);
          expect(prompt).toContain('surviving input');
          expect(prompt).not.toContain('cancelled remote input');
          expect(prompt).not.toContain('cancelled owner-only input');
          expect(getStreamCount()).toBe(2);
        } finally {
          releaseFirst();
          owner?.unsubscribe();
          follower.unsubscribe();
        }
      },
    );

    it.each([false, true])(
      'applies ordered cancellation events with retained replay=%s and duplicate subscribers',
      async replay => {
        const scope = { resourceId: 'replay-cancel-user', threadId: 'replay-cancel-thread' };
        const pubsub = new ControlledLeasePubSub();
        const runtime = new AgentThreadStreamRuntime();
        const agent = new Agent({
          id: 'replay-cancel-agent',
          name: 'Replay cancellation',
          instructions: 'Test',
          model: createTextStreamModel('unused'),
          pubsub,
        });
        const topic = `agent.thread-stream.${encodeURIComponent(`${scope.resourceId}\u0000${scope.threadId}`)}`;
        const subscriptions: Array<Awaited<ReturnType<typeof runtime.subscribeToThread>>> = [];
        const subscribe = async () => {
          await runtime.waitForCrossAgentThreadRun(
            agent,
            { runId: 'queued-run', memory: { resource: scope.resourceId, thread: scope.threadId } },
            pubsub,
          );
          subscriptions.push(await runtime.subscribeToThread(agent, scope, pubsub));
          subscriptions.push(await runtime.subscribeToThread(agent, scope, pubsub));
        };
        try {
          if (!replay) await subscribe();
          for (const preRun of [true, false]) {
            const signal = createSignal({ id: `cancel-replay-${preRun}`, type: 'user-message', contents: 'cancel' });
            await pubsub.publish(topic, {
              type: 'signal-enqueued',
              data: {
                type: 'signal-enqueued',
                runId: 'queued-run',
                signal: signal.toDataPart().data,
                sourceId: 'remote',
                preRun,
              },
            });
          }
          const event = {
            type: 'signals-cancelled',
            data: { type: 'signals-cancelled', signalIds: ['cancel-replay-true', 'cancel-replay-false', 'missing'] },
          };
          await pubsub.publish(topic, event);
          await pubsub.publish(topic, event);
          const marker = createSignal({ id: 'after-cancellation', type: 'user-message', contents: 'keep' });
          await pubsub.publish(topic, {
            type: 'signal-enqueued',
            data: {
              type: 'signal-enqueued',
              runId: 'queued-run',
              signal: marker.toDataPart().data,
              sourceId: 'remote',
            },
          });
          await pubsub.flush();
          if (replay) await subscribe();
          await nextTick();
          expect(
            runtime.cancelQueuedMessages(
              agent,
              { ...scope, signalIds: ['cancel-replay-true', 'cancel-replay-false'] },
              pubsub,
            ),
          ).toEqual({ cancelledSignalIds: [] });
          expect(pubsub.publishedData.filter(data => data.type === 'signals-cancelled')).toHaveLength(3);
          expect(runtime.cancelQueuedMessages(agent, { ...scope, signalIds: [marker.id] }, pubsub)).toEqual({
            cancelledSignalIds: [marker.id],
          });
        } finally {
          runtime.releaseThreadRunReservation('queued-run', pubsub);
          subscriptions.forEach(subscription => subscription.unsubscribe());
        }
      },
    );

    it('notifies idle queue observers once when remote cancellation is delivered twice', async () => {
      const scope = { resourceId: 'remote-count-user', threadId: 'remote-count-thread' };
      const pubsub = new ControlledLeasePubSub();
      const runtime = new AgentThreadStreamRuntime();
      const agent = new Agent({
        id: 'remote-count-agent',
        name: 'Remote count',
        instructions: 'Test',
        model: createTextStreamModel('unused'),
        pubsub,
      });
      await runtime.registerRun(
        agent,
        createFakeThreadRun('remote-count-run', new Promise<void>(() => {})),
        { memory: { resource: scope.resourceId, thread: scope.threadId } },
        pubsub,
      );
      const subscription = await runtime.subscribeToThread(agent, scope, pubsub);
      const counts: number[] = [];
      const unsubscribe = runtime.subscribeThreadEvents(agent, scope, event => counts.push(event.count), pubsub);
      try {
        const queued = runtime.queueMessage(agent, 'cancel remote idle input', scope, pubsub);
        await queued.accepted;
        expect(counts).toEqual([0, 1]);
        const topic = `agent.thread-stream.${encodeURIComponent(`${scope.resourceId}\u0000${scope.threadId}`)}`;
        const event = { type: 'signals-cancelled', data: { type: 'signals-cancelled', signalIds: [queued.signal.id] } };
        await pubsub.publish(topic, event);
        await pubsub.publish(topic, event);
        await pubsub.flush();
        await nextTick();
        expect(counts).toEqual([0, 1, 0]);
        expect(pubsub.publishedData.filter(data => data.type === 'signals-cancelled')).toHaveLength(2);
        expect(runtime.cancelQueuedMessages(agent, { ...scope, signalIds: [queued.signal.id] }, pubsub)).toEqual({
          cancelledSignalIds: [],
        });
      } finally {
        unsubscribe();
        subscription.unsubscribe();
      }
    });

    it('preserves a queued continuation when clear-on-abort removes pending and idle signals', async () => {
      const scope = { resourceId: 'clear-continuation-user', threadId: 'clear-continuation-thread' };
      const pubsub = new ControlledLeasePubSub();
      const { model, releaseFirst, getStreamCount } = createBlockingFirstTextStreamModel(
        'first',
        'continuation answer',
      );
      const memory = new MockMemory();
      const agent = new Agent({
        id: 'clear-continuation',
        name: 'Clear continuation',
        instructions: 'Test',
        model,
        memory,
        pubsub,
      });
      const subscription = await agent.subscribeToThread(scope);
      try {
        const first = await agent.stream('initial', { memory: { resource: scope.resourceId, thread: scope.threadId } });
        await vi.waitFor(() => expect(getStreamCount()).toBe(1));
        await agent.sendSignal({ type: 'user-message', contents: 'cleared pending input' }, scope).accepted;
        await agent.queueMessage('cleared idle input', scope).accepted;
        agentThreadStreamRuntime.continueWithMessages(agent, 'surviving continuation', scope, pubsub);
        expect(subscription.abort({ clearPendingSignals: true })).toBe(true);
        releaseFirst();
        await first.text;
        await vi.waitFor(() => expect(getStreamCount()).toBe(2));
        await vi.waitFor(() => expect(pubsub.owners.get(`${scope.resourceId}\u0000${scope.threadId}`)).toBeUndefined());
        const prompt = JSON.stringify(model.doStreamCalls[1]?.prompt);
        expect(prompt).toContain('surviving continuation');
        expect(prompt).not.toContain('cleared pending input');
        expect(prompt).not.toContain('cleared idle input');
        const { messages } = await memory.recall(scope);
        expect(messages.at(-1)).toMatchObject({
          role: 'assistant',
          content: {
            parts: expect.arrayContaining([expect.objectContaining({ type: 'text', text: 'continuation answer' })]),
          },
        });
        expect(getStreamCount()).toBe(2);
      } finally {
        releaseFirst();
        subscription.unsubscribe();
      }
    });

    it.each(['local', 'remote'] as const)(
      'clears requeued input via %s cancellation without observers or an active run',
      async origin => {
        const scope = { resourceId: 'inactive-clear-user', threadId: 'inactive-clear-thread' };
        const pubsub = new ControlledLeasePubSub();
        const { model, releaseFirst, getStreamCount } = createBlockingFirstTextStreamModel('first', 'new answer');
        let preparations = 0;
        const agent = new Agent({
          id: 'inactive-clear',
          name: 'Inactive clear',
          model,
          memory: new MockMemory(),
          pubsub,
          instructions: () => {
            if (++preparations === 2) throw new Error('Queued preparation failed');
            return 'Test';
          },
        });
        const topic = `agent.thread-stream.${encodeURIComponent(`${scope.resourceId}\u0000${scope.threadId}`)}`;
        try {
          const first = await agent.stream('initial', {
            memory: { resource: scope.resourceId, thread: scope.threadId },
          });
          await vi.waitFor(() => expect(getStreamCount()).toBe(1));
          const pending = agent.sendSignal({ type: 'user-message', contents: 'requeued input to clear' }, scope);
          await pending.accepted;
          expect(agent.abortThreadStream(scope)).toBe(true);
          releaseFirst();
          await first.text;
          await vi.waitFor(() =>
            expect(
              pubsub.publishedData.some(data => data.type === 'run-failed' && data.error.includes('requeued')),
            ).toBe(true),
          );
          await vi.waitFor(() => expect(agentThreadStreamRuntime.getActiveThreadRunId(scope, pubsub)).toBeUndefined());
          expect(pubsub.subscriberCount(topic)).toBe(1);
          if (origin === 'remote') {
            await pubsub.publish(topic, {
              type: 'signals-cancelled',
              data: { type: 'signals-cancelled', signalIds: [pending.signal.id] },
            });
            await pubsub.flush();
            await nextTick();
            expect(agent.cancelQueuedMessages({ ...scope, signalIds: [pending.signal.id] })).toEqual({
              cancelledSignalIds: [],
            });
          }
          expect(agent.abortThreadStream({ ...scope, clearPendingSignals: true })).toBe(false);
          await vi.waitFor(() => expect(pubsub.subscriberCount(topic)).toBe(0));
          const next = await agent.stream('new input', {
            memory: { resource: scope.resourceId, thread: scope.threadId },
          });
          await next.text;
          expect(getStreamCount()).toBe(2);
          expect(JSON.stringify(model.doStreamCalls[1]?.prompt)).toContain('new input');
          expect(JSON.stringify(model.doStreamCalls[1]?.prompt)).not.toContain('requeued input to clear');
          await vi.waitFor(() =>
            expect(pubsub.owners.get(`${scope.resourceId}\u0000${scope.threadId}`)).toBeUndefined(),
          );
          await vi.waitFor(() => expect(pubsub.subscriberCount(topic)).toBe(0));
        } finally {
          releaseFirst();
        }
      },
    );

    it('ignores remote clear after ownership changes during lease verification', async () => {
      const scope = { resourceId: 'stale-clear-user', threadId: 'stale-clear-thread' };
      const key = `${scope.resourceId}\u0000${scope.threadId}`;
      const pubsub = new ControlledLeasePubSub();
      const owner = new AgentThreadStreamRuntime();
      const follower = new AgentThreadStreamRuntime();
      const agent = new Agent({
        id: 'stale-clear',
        name: 'Stale clear',
        instructions: 'Test',
        model: createTextStreamModel('unused'),
        memory: new MockMemory(),
        pubsub,
      });
      const local = await owner.subscribeToThread(agent, scope, pubsub);
      const remote = await follower.subscribeToThread(agent, scope, pubsub);
      let finish!: () => void;
      const finished = new Promise<void>(resolve => {
        finish = resolve;
      });
      let checking!: () => void;
      const checked = new Promise<void>(resolve => {
        checking = resolve;
      });
      let release!: () => void;
      const gate = new Promise<void>(resolve => {
        release = resolve;
      });
      try {
        const oldOptions = owner.prepareRunOptions(
          { runId: 'old-clear-run', memory: { resource: scope.resourceId, thread: scope.threadId } },
          pubsub,
        );
        await owner.registerRun(
          agent,
          {
            runId: 'old-clear-run',
            status: 'running',
            fullStream: (async function* () {})(),
            _waitUntilFinished: () => finished,
          } as any,
          oldOptions,
          pubsub,
        );
        await vi.waitFor(() => expect(remote.activeRunId()).toBe('old-clear-run'));
        // A lease read can have observed the old owner before its response arrives.
        vi.spyOn(pubsub, 'getLeaseOwner').mockImplementationOnce(async () => {
          checking();
          await gate;
          return 'old-clear-run';
        });
        expect(remote.abort({ clearPendingSignals: true })).toBe(true);
        await checked;
        pubsub.owners.set(key, 'new-clear-run');
        const newOptions = owner.prepareRunOptions(
          { runId: 'new-clear-run', memory: { resource: scope.resourceId, thread: scope.threadId } },
          pubsub,
        );
        const registration = owner.registerRun(
          agent,
          {
            runId: 'new-clear-run',
            status: 'running',
            fullStream: (async function* () {})(),
            _waitUntilFinished: () => finished,
          } as any,
          newOptions,
          pubsub,
        );
        await vi.waitFor(() => expect(owner.getActiveThreadRunId(scope, pubsub)).toBe('new-clear-run'));
        const survivor = owner.queueMessage(agent, 'successor pending input', scope, pubsub);
        await survivor.accepted;
        release();
        await registration;
        // This marker is handled after the stale request on the owner's serialized event tail.
        const marker = createSignal({ id: 'stale-clear-marker', type: 'user-message', contents: 'marker' });
        await pubsub.publish(`agent.thread-stream.${encodeURIComponent(key)}`, {
          type: 'agent.thread-stream',
          data: {
            type: 'signal-enqueued',
            runId: 'new-clear-run',
            signal: marker.toDataPart().data,
            sourceId: 'marker-source',
          },
        });
        await pubsub.flush();
        await nextTick();
        expect(owner.cancelQueuedMessages(agent, { ...scope, signalIds: [marker.id] }, pubsub)).toEqual({
          cancelledSignalIds: [marker.id],
        });
        expect(owner.isRunAborted('new-clear-run', pubsub)).toBe(false);
        expect(owner.isRunAborted('old-clear-run', pubsub)).toBe(false);
        expect(owner.cancelQueuedMessages(agent, { ...scope, signalIds: [survivor.signal.id] }, pubsub)).toEqual({
          cancelledSignalIds: [survivor.signal.id],
        });
        expect(pubsub.owners.get(key)).toBe('new-clear-run');
      } finally {
        release();
        finish();
        local.unsubscribe();
        remote.unsubscribe();
      }
    });
    it.each(['success', 'failure'] as const)(
      'notifies reentrant listeners after abort before preparation %s',
      async outcome => {
        const scope = { resourceId: 'reentrant-clear-user', threadId: 'reentrant-clear-thread' };
        const pubsub = new ControlledLeasePubSub();
        const { model, releaseFirst, getStreamCount } = createBlockingFirstTextStreamModel('first', 'next');
        let preparing!: () => void;
        const prepared = new Promise<void>(resolve => {
          preparing = resolve;
        });
        let release!: () => void;
        const gate = new Promise<void>(resolve => {
          release = resolve;
        });
        let preparations = 0;
        const agent = new Agent({
          id: 'reentrant-clear',
          name: 'Reentrant clear',
          model,
          memory: new MockMemory(),
          pubsub,
          instructions: async () => {
            if (++preparations === 2) {
              preparing();
              await gate;
              if (outcome === 'failure') throw new Error('Preparation failed');
            }
            return 'Test';
          },
        });
        const subscription = await agent.subscribeToThread(scope);
        let armed = false;
        let abortedBeforeNotification: boolean | undefined;
        let startupRunId: string | undefined;
        let survivor: ReturnType<typeof agent.queueMessage> | undefined;
        const unsubscribe = agent.subscribeThreadEvents(scope, event => {
          if (!armed || event.count !== 0) return;
          armed = false;
          abortedBeforeNotification = !!startupRunId && agentThreadStreamRuntime.isRunAborted(startupRunId, pubsub);
          subscription.abort({ clearPendingSignals: true });
          survivor = agent.queueMessage('listener survivor', scope);
          throw new Error('Listener errors must not interrupt abort cleanup');
        });
        try {
          const first = await agent.stream('initial', {
            memory: { resource: scope.resourceId, thread: scope.threadId },
          });
          await vi.waitFor(() => expect(getStreamCount()).toBe(1));
          await agent.sendSignal({ type: 'user-message', contents: 'aborted startup' }, scope).accepted;
          subscription.abort();
          releaseFirst();
          await first.text;
          await prepared;
          startupRunId = agentThreadStreamRuntime.getActiveThreadRunId(scope, pubsub);
          await agent.queueMessage('cleared idle', scope).accepted;
          armed = true;
          expect(subscription.abort({ clearPendingSignals: true })).toBe(true);
          expect(abortedBeforeNotification).toBe(true);
          expect(survivor).toBeDefined();
          await survivor?.accepted;
          release();
          await vi.waitFor(() => expect(getStreamCount()).toBe(2));
          await vi.waitFor(() =>
            expect(pubsub.owners.get(`${scope.resourceId}\u0000${scope.threadId}`)).toBeUndefined(),
          );
          const prompts = JSON.stringify(model.doStreamCalls.slice(1));
          expect(prompts).toContain('listener survivor');
          // Successful preparation can persist aborted input as history; it must not execute it again.
          if (outcome === 'failure') expect(prompts).not.toContain('aborted startup');
          expect(JSON.stringify(model.doStreamCalls[1]?.prompt.at(-1))).toContain('listener survivor');
          expect(JSON.stringify(model.doStreamCalls[1]?.prompt.at(-1))).not.toContain('aborted startup');
          expect(prompts).not.toContain('cleared idle');
          const next = await agent.stream('after clear', {
            memory: { resource: scope.resourceId, thread: scope.threadId },
          });
          await next.text;
          expect(getStreamCount()).toBe(3);
        } finally {
          armed = false;
          release();
          releaseFirst();
          unsubscribe();
          subscription.unsubscribe();
        }
      },
    );
    it.each(
      (['pending', 'idle'] as const).flatMap(queue =>
        [false, true].flatMap(clearPendingSignals =>
          [false, true].map(cancelById => ({ queue, clearPendingSignals, cancelById })),
        ),
      ),
    )(
      'handles failed $queue preparation after abort with clearPendingSignals=$clearPendingSignals and cancelById=$cancelById',
      async ({ queue, clearPendingSignals, cancelById }) => {
        const scope = { resourceId: 'failed-clear-user', threadId: 'failed-clear-thread' };
        const pubsub = new ControlledLeasePubSub();
        const { model, releaseFirst, getStreamCount } = createBlockingFirstTextStreamModel('first', 'next');
        let preparing!: () => void;
        const prepared = new Promise<void>(resolve => {
          preparing = resolve;
        });
        let release!: () => void;
        const gate = new Promise<void>(resolve => {
          release = resolve;
        });
        let preparations = 0;
        const agent = new Agent({
          id: 'failed-clear',
          name: 'Failed clear',
          model,
          memory: new MockMemory(),
          pubsub,
          instructions: async () => {
            if (++preparations === 2) {
              preparing();
              await gate;
              throw new Error('Queued preparation failed');
            }
            return 'Test';
          },
        });
        const subscription = await agent.subscribeToThread(scope);
        try {
          const first = await agent.stream('initial', {
            memory: { resource: scope.resourceId, thread: scope.threadId },
          });
          await vi.waitFor(() => expect(getStreamCount()).toBe(1));
          const queued =
            queue === 'pending'
              ? agent.sendSignal({ type: 'user-message', contents: 'failed queued input' }, scope)
              : agent.queueMessage('failed queued input', scope);
          await queued.accepted;
          subscription.abort();
          releaseFirst();
          await first.text;
          await prepared;
          if (cancelById) {
            // Handoff prevents local success; deliver the request before testing preparation cleanup.
            expect(agent.cancelQueuedMessages({ ...scope, signalIds: [queued.signal.id] })).toEqual({
              cancelledSignalIds: [],
            });
            await pubsub.flush();
            await nextTick();
          }
          expect(subscription.abort({ clearPendingSignals })).toBe(true);
          release();
          await vi.waitFor(() => expect(pubsub.publishedData.some(data => data.type === 'run-failed')).toBe(true));
          await vi.waitFor(() => expect(agentThreadStreamRuntime.getActiveThreadRunId(scope, pubsub)).toBeUndefined());
          const next = await agent.stream('new input', {
            memory: { resource: scope.resourceId, thread: scope.threadId },
          });
          await next.text;
          await vi.waitFor(() => expect(agentThreadStreamRuntime.getActiveThreadRunId(scope, pubsub)).toBeUndefined());
          const prompts = JSON.stringify(model.doStreamCalls.slice(1));
          if (queue === 'pending' && !clearPendingSignals) expect(prompts).toContain('failed queued input');
          else expect(prompts).not.toContain('failed queued input');
          await vi.waitFor(() =>
            expect(pubsub.owners.get(`${scope.resourceId}\u0000${scope.threadId}`)).toBeUndefined(),
          );
        } finally {
          release();
          releaseFirst();
          subscription.unsubscribe();
        }
      },
    );
    it.each(['local', 'remote'] as const)(
      'clears pending and cross-agent idle work on %s abort only when requested',
      async origin => {
        for (const clearPendingSignals of [false, true]) {
          const scope = { resourceId: 'clear-user', threadId: `clear-${origin}-${clearPendingSignals}` };
          const pubsub = new ControlledLeasePubSub();
          const memory = new MockMemory();
          const { model, releaseFirst, getStreamCount } = createBlockingFirstTextStreamModel('first', 'next');
          const agent = new Agent({ id: 'clear-owner', name: 'Owner', instructions: 'Test', model, memory, pubsub });
          const other = new Agent({ id: 'clear-other', name: 'Other', instructions: 'Test', model, memory, pubsub });
          const subscription = origin === 'local' ? await agent.subscribeToThread(scope) : undefined;
          const remote = new AgentThreadStreamRuntime();
          const follower = await remote.subscribeToThread(agent, scope, pubsub);
          try {
            const output = await agent.stream('initial', {
              memory: { resource: scope.resourceId, thread: scope.threadId },
            });
            await vi.waitFor(() => expect(getStreamCount()).toBe(1));
            const pending = agent.sendSignal({ type: 'user-message', contents: 'pending to clear' }, scope);
            await pending.accepted;
            const idle = other.queueMessage('other agent idle', scope);
            await idle.accepted;
            await vi.waitFor(() => expect(follower.activeRunId()).toBe(output.runId));
            expect(
              origin === 'local'
                ? agent.abortThreadStream({ ...scope, clearPendingSignals })
                : follower.abort({ clearPendingSignals }),
            ).toBe(true);
            await vi.waitFor(() =>
              expect(
                pubsub.publishedData.some(data => data.type === 'run-aborted' && data.runId === output.runId),
              ).toBe(true),
            );
            releaseFirst();
            await output.text;
            await vi.waitFor(() =>
              expect(agentThreadStreamRuntime.getActiveThreadRunId(scope, pubsub)).toBeUndefined(),
            );
            await vi.waitFor(() => expect(getStreamCount()).toBe(clearPendingSignals ? 1 : 3));
            await vi.waitFor(() =>
              expect(pubsub.owners.get(`${scope.resourceId}\u0000${scope.threadId}`)).toBeUndefined(),
            );
            const { messages } = await memory.recall(scope);
            const texts = JSON.stringify(messages);
            if (clearPendingSignals) {
              expect(texts).not.toContain('pending to clear');
              expect(texts).not.toContain('other agent idle');
            } else {
              expect(texts).toContain('pending to clear');
              expect(texts).toContain('other agent idle');
            }
            await vi.waitFor(() =>
              expect(pubsub.owners.get(`${scope.resourceId}\u0000${scope.threadId}`)).toBeUndefined(),
            );
          } finally {
            releaseFirst();
            subscription?.unsubscribe();
            follower.unsubscribe();
          }
        }
      },
    );

    it('cancels selected pre-run and idle signals across Agents without changing owner-group cancellation', async () => {
      const scope = { resourceId: 'selected-user', threadId: 'selected-thread' };
      const pubsub = new ControlledLeasePubSub();
      const memory = new MockMemory();
      const model = createTextStreamModel('answer');
      let preparing!: () => void;
      const prepared = new Promise<void>(resolve => {
        preparing = resolve;
      });
      let release!: () => void;
      const gate = new Promise<void>(resolve => {
        release = resolve;
      });
      const agent = new Agent({
        id: 'selected-owner',
        name: 'Owner',
        model,
        memory,
        pubsub,
        instructions: async () => {
          preparing();
          await gate;
          return 'Test';
        },
      });
      const other = new Agent({ id: 'selected-other', name: 'Other', model, memory, pubsub, instructions: 'Test' });
      const counts: number[] = [];
      const unsubscribe = agent.subscribeThreadEvents(scope, event => counts.push(event.count));
      const subscription = await agent.subscribeToThread(scope);
      const started = agent.stream('initial', { memory: { resource: scope.resourceId, thread: scope.threadId } });
      try {
        await prepared;
        const preRun = agent.sendSignal({ type: 'user-message', contents: 'remove pre-run' }, scope);
        await preRun.accepted;
        const idle = other.queueMessage('remove other idle', { ...scope, queueOwnerId: 'group' });
        await idle.accepted;
        await other.queueMessage('keep other idle', { ...scope, queueOwnerId: 'keep' }).accepted;
        expect(agent.cancelQueuedMessages({ ...scope, queueOwnerId: 'group' })).toEqual({ cancelledSignalIds: [] });
        expect(
          agent.cancelQueuedMessages({
            ...scope,
            threadId: 'wrong-thread',
            signalIds: [preRun.signal.id, idle.signal.id],
          }),
        ).toEqual({ cancelledSignalIds: [] });
        expect(
          agent.cancelQueuedMessages({ ...scope, resourceId: 'wrong-user', signalIds: [preRun.signal.id] }),
        ).toEqual({ cancelledSignalIds: [] });
        expect(
          other.cancelQueuedMessages({
            ...scope,
            signalIds: [preRun.signal.id, idle.signal.id, preRun.signal.id, 'missing'],
          }),
        ).toEqual({ cancelledSignalIds: [preRun.signal.id, idle.signal.id] });
        expect(other.cancelQueuedMessages({ ...scope, signalIds: [preRun.signal.id] })).toEqual({
          cancelledSignalIds: [],
        });
        expect(counts.at(-1)).toBe(1);
        release();
        const output = await started;
        await output.text;
        await vi.waitFor(() => expect(model.doStreamCalls).toHaveLength(2));
        await vi.waitFor(() => expect(agentThreadStreamRuntime.getActiveThreadRunId(scope, pubsub)).toBeUndefined());
        const { messages } = await memory.recall(scope);
        expect(JSON.stringify(messages)).not.toContain('remove pre-run');
        expect(JSON.stringify(messages)).not.toContain('remove other idle');
        expect(JSON.stringify(messages)).toContain('keep other idle');
        expect(model.doStreamCalls).toHaveLength(2);
        expect(counts.at(-1)).toBe(0);
      } finally {
        release();
        subscription.unsubscribe();
        unsubscribe();
      }
    });

    it('does not report a signal as cancelled after forwarding to another owner starts', async () => {
      const scope = { resourceId: 'forward-user', threadId: 'forward-thread' };
      const key = `${scope.resourceId}\u0000${scope.threadId}`;
      const pubsub = new ControlledLeasePubSub();
      const { model, releaseFirst, getStreamCount } = createBlockingFirstTextStreamModel('first', 'next');
      const agent = new Agent({
        id: 'forward-agent',
        name: 'Forward',
        instructions: 'Test',
        model,
        memory: new MockMemory(),
        pubsub,
      });
      const subscription = await agent.subscribeToThread(scope);
      let forwarding!: () => void;
      const forwarded = new Promise<void>(resolve => {
        forwarding = resolve;
      });
      let release!: () => void;
      const gate = new Promise<void>(resolve => {
        release = resolve;
      });
      const publish = pubsub.publish.bind(pubsub);
      vi.spyOn(pubsub, 'publish').mockImplementation(async (topic, event) => {
        if (event.data?.type === 'signal-enqueued' && event.data.runId === 'new-owner') {
          forwarding();
          await gate;
        }
        await publish(topic, event);
      });
      try {
        const output = await agent.stream('initial', {
          memory: { resource: scope.resourceId, thread: scope.threadId },
        });
        await vi.waitFor(() => expect(getStreamCount()).toBe(1));
        const queued = agent.sendSignal({ type: 'user-message', contents: 'forwarded input' }, scope);
        await queued.accepted;
        pubsub.onTransferLease = () => {
          pubsub.owners.set(key, 'new-owner');
        };
        expect(subscription.abort()).toBe(true);
        releaseFirst();
        await output.text;
        await forwarded;
        expect(agent.cancelQueuedMessages({ ...scope, signalIds: [queued.signal.id] })).toEqual({
          cancelledSignalIds: [],
        });
        release();
        await vi.waitFor(() =>
          expect(pubsub.publishedData.some(data => data.type === 'signal-enqueued' && data.runId === 'new-owner')).toBe(
            true,
          ),
        );
        expect(getStreamCount()).toBe(1);
      } finally {
        release();
        releaseFirst();
        subscription.unsubscribe();
      }
    });

    it.each(
      (['pending', 'idle'] as const).flatMap(queue =>
        (['success', 'lost', 'transfer-rejection'] as const).flatMap(outcome =>
          (['local', 'remote'] as const).map(source => [queue, outcome, source] as const),
        ),
      ),
    )(
      'does not restore or forward a cancelled %s signal after lease %s via %s cancellation',
      async (queue, outcome, source) => {
        const scope = { resourceId: 'cancel-transfer-user', threadId: `cancel-transfer-${queue}-${outcome}-${source}` };
        const key = `${scope.resourceId}\u0000${scope.threadId}`;
        const pubsub = new ControlledLeasePubSub();
        const memory = new MockMemory();
        const { model, releaseFirst, getStreamCount } = createBlockingFirstTextStreamModel('first', 'after');
        const agent = new Agent({
          id: 'cancel-transfer',
          name: 'Transfer',
          instructions: 'Test',
          model,
          memory,
          pubsub,
        });
        const subscription = source === 'local' ? await agent.subscribeToThread(scope) : undefined;
        let transferStarted!: () => void;
        const transferring = new Promise<void>(resolve => {
          transferStarted = resolve;
        });
        let release!: () => void;
        const gate = new Promise<void>(resolve => {
          release = resolve;
        });
        try {
          const output = await agent.stream('initial', {
            memory: { resource: scope.resourceId, thread: scope.threadId },
          });
          await vi.waitFor(() => expect(getStreamCount()).toBe(1));
          const queued =
            queue === 'pending'
              ? agent.sendSignal({ type: 'user-message', contents: 'cancel during lease' }, scope)
              : agent.queueMessage('cancel during lease', scope);
          await queued.accepted;
          pubsub.transferLeaseWait = gate;
          pubsub.onTransferLease = transferStarted;
          const acquireLease = vi.spyOn(pubsub, 'acquireLease');
          // Provider rejection falls back to acquisition, rather than entering failed-start recovery.
          if (outcome === 'transfer-rejection') {
            vi.spyOn(pubsub, 'transferLease').mockImplementationOnce(async () => {
              transferStarted();
              await gate;
              throw new Error('Lease unavailable');
            });
          }
          expect(agent.abortThreadStream(scope)).toBe(true);
          releaseFirst();
          await output.text;
          await transferring;
          if (source === 'remote') {
            await pubsub.publish(`agent.thread-stream.${encodeURIComponent(key)}`, {
              type: 'signals-cancelled',
              data: { type: 'signals-cancelled', signalIds: [queued.signal.id] },
            });
            await pubsub.flush();
            await nextTick();
          } else {
            expect(agent.cancelQueuedMessages({ ...scope, signalIds: [queued.signal.id, queued.signal.id] })).toEqual({
              cancelledSignalIds: [queued.signal.id],
            });
          }
          expect(agent.cancelQueuedMessages({ ...scope, signalIds: [queued.signal.id] })).toEqual({
            cancelledSignalIds: [],
          });
          if (outcome === 'lost') pubsub.owners.set(key, 'new-owner');
          release();
          await vi.waitFor(() => expect(agentThreadStreamRuntime.getActiveThreadRunId(scope, pubsub)).toBeUndefined());
          expect(getStreamCount()).toBe(1);
          expect(
            pubsub.publishedData.filter(
              data =>
                data.type === 'signal-enqueued' && data.signal.id === queued.signal.id && data.runId !== output.runId,
            ),
          ).toEqual([]);
          if (outcome === 'transfer-rejection') {
            expect(acquireLease).toHaveBeenCalled();
            expect(pubsub.publishedData.some(data => data.type === 'run-failed')).toBe(false);
          }
          if (outcome === 'lost') {
            expect(pubsub.owners.get(key)).toBe('new-owner');
            await pubsub.releaseLease(key, 'new-owner');
          } else await vi.waitFor(() => expect(pubsub.owners.get(key)).toBeUndefined());
          const after = await agent.stream('after cancellation', {
            memory: { resource: scope.resourceId, thread: scope.threadId },
          });
          await after.text;
          expect(model.doStreamCalls).toHaveLength(2);
          expect(JSON.stringify(model.doStreamCalls[1]?.prompt)).not.toContain('cancel during lease');
          if (source === 'remote') {
            await vi.waitFor(() =>
              expect(pubsub.subscriberCount(`agent.thread-stream.${encodeURIComponent(key)}`)).toBe(0),
            );
          }
        } finally {
          release();
          releaseFirst();
          subscription?.unsubscribe();
        }
      },
    );
  });

  it.each(['pre-run', 'pending'] as const)(
    'admits a forwarded signal once when first queued as %s',
    async firstQueue => {
      const pubsub = new ControlledLeasePubSub();
      const scope = { resourceId: 'forwarded-pre-run-user', threadId: 'forwarded-pre-run-thread' };
      const memory = new MockMemory();
      const model = createTextStreamModel('winner answer');
      const agent = new Agent({
        id: 'forwarded-pre-run',
        name: 'Forwarded pre-run',
        instructions: 'Test',
        model,
        memory,
        pubsub,
      });
      const subscription = await agent.subscribeToThread(scope);
      const signal = createSignal({
        id: 'same-forwarded-signal',
        type: 'user-message',
        contents: 'Only handle A once',
      });
      try {
        await agentThreadStreamRuntime.waitForCrossAgentThreadRun(
          agent,
          { runId: 'winner-run', memory: { resource: scope.resourceId, thread: scope.threadId } },
          pubsub,
        );
        for (const preRun of [firstQueue === 'pre-run', firstQueue !== 'pre-run']) {
          const runId = 'winner-run';
          await pubsub.publish(
            `agent.thread-stream.${encodeURIComponent(`${scope.resourceId}\u0000${scope.threadId}`)}`,
            {
              type: 'signal-enqueued',
              runId,
              data: { type: 'signal-enqueued', runId, signal: signal.toDataPart().data, preRun, sourceId: 'old-owner' },
            },
          );
        }
        await pubsub.flush();
        const output = await agent.stream('winner input', {
          runId: 'winner-run',
          memory: { resource: scope.resourceId, thread: scope.threadId },
        });
        await output.text;
        await vi.waitFor(() => expect(agentThreadStreamRuntime.getActiveThreadRunId(scope, pubsub)).toBeUndefined());
        expect(model.doStreamCalls).toHaveLength(firstQueue === 'pre-run' ? 1 : 2);
        const prompt = model.doStreamCalls.at(-1)?.prompt;
        expect(JSON.stringify(prompt).match(/Only handle A once/g)).toHaveLength(1);
        const { messages } = await memory.recall(scope);
        expect(
          messages.filter(message =>
            message.content.parts.some(part => part.type === 'text' && part.text === 'Only handle A once'),
          ),
        ).toHaveLength(1);
      } finally {
        subscription.unsubscribe();
      }
    },
  );

  it.each(['thread', 'upstream', 'none'] as const)(
    'preserves pending order after %s cancellation and idle preparation failure',
    async cancellation => {
      const scope = { resourceId: 'idle-failure-user', threadId: `idle-failure-${cancellation}` };
      const pubsub = new ControlledLeasePubSub();
      const memory = new MockMemory();
      const { model, releaseFirst, getStreamCount } = createBlockingFirstTextStreamModel('first response', 'answer');
      let preparing!: () => void;
      const prepared = new Promise<void>(resolve => {
        preparing = resolve;
      });
      let release!: () => void;
      const gate = new Promise<void>(resolve => {
        release = resolve;
      });
      const abort = new AbortController();
      let calls = 0;
      const agent = new Agent({
        id: 'idle-failure',
        name: 'Idle failure',
        model,
        memory,
        pubsub,
        instructions: async () => {
          if (++calls === 2) {
            preparing();
            await gate;
            throw new Error('Idle preparation failed');
          }
          return 'Test';
        },
      });
      const subscription = await agent.subscribeToThread(scope);
      try {
        const initial = await agent.stream('initial', {
          memory: { resource: scope.resourceId, thread: scope.threadId },
        });
        await vi.waitFor(() => expect(getStreamCount()).toBe(1));
        await agent.queueMessage('failed startup', {
          ...scope,
          ifIdle: { streamOptions: { abortSignal: abort.signal } },
        }).accepted;
        releaseFirst();
        await initial.text;
        await prepared;
        await agent.sendSignal({ type: 'user-message', contents: 'pre-run A' }, scope).accepted;
        await agent.queueMessage('idle C', scope).accepted;
        if (cancellation === 'thread') expect(subscription.abort()).toBe(true);
        if (cancellation === 'upstream') abort.abort();
        release();
        await vi.waitFor(() => expect(pubsub.publishedData.some(data => data.type === 'run-failed')).toBe(true));
        await vi.waitFor(() => expect(agentThreadStreamRuntime.getActiveThreadRunId(scope, pubsub)).toBeUndefined());
        const { messages } = await memory.recall(scope);
        const order = messages.flatMap(message =>
          message.content.parts.flatMap(part =>
            part.type === 'text' && ['pre-run A', 'idle C'].includes(part.text) ? [part.text] : [],
          ),
        );
        expect(order).toEqual(['pre-run A', 'idle C']);
        expect(model.doStreamCalls).toHaveLength(3);
        expect(JSON.stringify(model.doStreamCalls[1]?.prompt)).toContain('pre-run A');
        expect(JSON.stringify(model.doStreamCalls[1]?.prompt)).not.toContain('idle C');
        expect(JSON.stringify(model.doStreamCalls[2]?.prompt)).toContain('idle C');
        expect(calls).toBe(4);
        await vi.waitFor(() => expect(pubsub.owners.get(`${scope.resourceId}\u0000${scope.threadId}`)).toBeUndefined());
      } finally {
        releaseFirst();
        release();
        subscription.unsubscribe();
      }
    },
  );

  it.each(['success', 'failure'] as const)(
    'delivers pre-run and idle signals after aborting before preparation %s',
    async outcome => {
      const scope = { resourceId: 'preparation-abort-user', threadId: 'preparation-abort-thread' };
      const pubsub = new ControlledLeasePubSub();
      const memory = new MockMemory();
      let reachedPreparation!: () => void;
      const preparing = new Promise<void>(resolve => {
        reachedPreparation = resolve;
      });
      let releasePreparation!: () => void;
      const preparationGate = new Promise<void>(resolve => {
        releasePreparation = resolve;
      });
      const model = createTextStreamModel('queued answer');
      let firstPreparation = true;
      const agent = new Agent({
        id: 'preparation-abort',
        name: 'Preparation abort',
        model,
        memory,
        pubsub,
        instructions: async () => {
          if (!firstPreparation) return 'Test';
          firstPreparation = false;
          reachedPreparation();
          await preparationGate;
          if (outcome === 'failure') throw new Error('Preparation failed after abort');
          return 'Test';
        },
      });
      const subscription = await agent.subscribeToThread(scope);
      const runId = 'aborted-preparation';
      const streamPromise = agent.stream('first', {
        runId,
        memory: { resource: scope.resourceId, thread: scope.threadId },
      });
      void streamPromise.catch(() => {});
      try {
        await preparing;
        expect(agentThreadStreamRuntime.getActiveThreadRunId(scope, pubsub)).toBe(runId);
        expect(agentThreadStreamRuntime.hasThreadRun(runId, pubsub)).toBe(false);
        await agent.sendSignal({ type: 'user-message', contents: 'pre-run A' }, scope).accepted;
        await agent.queueMessage('idle B', scope).accepted;
        expect(subscription.abort()).toBe(true);
        expect(agentThreadStreamRuntime.drainPendingSignals(runId, pubsub, 'pre-run')).toEqual([]);
        releasePreparation();
        if (outcome === 'failure') {
          await expect(streamPromise).rejects.toThrow('Preparation failed after abort');
        } else {
          const stream = await streamPromise;
          await stream.text;
        }
        await vi.waitFor(() => expect(agentThreadStreamRuntime.getActiveThreadRunId(scope, pubsub)).toBeUndefined());
        await vi.waitFor(() => expect(model.doStreamCalls).toHaveLength(2));
        const { messages } = await memory.recall(scope);
        const order = messages.flatMap(message =>
          message.content.parts.flatMap(part =>
            part.type === 'text' && ['pre-run A', 'idle B'].includes(part.text) ? [part.text] : [],
          ),
        );
        expect(order).toEqual(['pre-run A', 'idle B']);
        expect(JSON.stringify(model.doStreamCalls[0]?.prompt)).toContain('pre-run A');
        expect(JSON.stringify(model.doStreamCalls[0]?.prompt)).not.toContain('idle B');
        expect(JSON.stringify(model.doStreamCalls[1]?.prompt)).toContain('idle B');
        await vi.waitFor(() => expect(pubsub.owners.get(`${scope.resourceId}\u0000${scope.threadId}`)).toBeUndefined());
      } finally {
        releasePreparation();
        subscription.unsubscribe();
      }
    },
  );

  it.each(
    (['none', 'thread', 'upstream', 'remote'] as const).flatMap(cancellation =>
      (['owner', 'follower'] as const).map(queueLocation => [cancellation, queueLocation] as const),
    ),
  )(
    'preserves pending-before-idle order after %s cancellation with idle work on the %s',
    async (cancellation, queueLocation) => {
      const scope = { resourceId: 'mixed-queue-user', threadId: `mixed-${cancellation}` };
      const pubsub = new ControlledLeasePubSub();
      const memory = new MockMemory();
      const upstream = new AbortController();
      const { model, releaseFirst, getStreamCount } = createBlockingFirstTextStreamModel(
        'first response',
        'later response',
      );
      const agent = new Agent({ id: 'mixed-queue', name: 'Mixed queue', instructions: 'Test', model, memory, pubsub });
      const subscription = await agent.subscribeToThread(scope);
      // A separate runtime has no owner records and must forward abort over PubSub.
      const follower = new AgentThreadStreamRuntime();
      const remoteSubscription = await follower.subscribeToThread(agent, scope, pubsub);
      const stream = await agent.stream('first', {
        memory: { resource: scope.resourceId, thread: scope.threadId },
        abortSignal: upstream.signal,
      });
      try {
        await vi.waitFor(() => expect(getStreamCount()).toBe(1));
        await agent.sendSignal({ type: 'user-message', contents: 'pending A' }, scope).accepted;
        await vi.waitFor(() => expect(remoteSubscription.activeRunId()).toBe(stream.runId));
        await (
          queueLocation === 'owner'
            ? agent.queueMessage('idle B', scope)
            : follower.queueMessage(agent, 'idle B', scope, pubsub)
        ).accepted;
        if (cancellation === 'thread') expect(subscription.abort()).toBe(true);
        if (cancellation === 'upstream') upstream.abort();
        if (cancellation === 'remote') {
          await vi.waitFor(() => expect(remoteSubscription.activeRunId()).toBe(stream.runId));
          expect(remoteSubscription.abort()).toBe(true);
          await vi.waitFor(() =>
            expect(pubsub.publishedData.some(data => data.type === 'run-aborted' && data.runId === stream.runId)).toBe(
              true,
            ),
          );
          expect(
            pubsub.publishedData.some(data => data.type === 'run-abort-requested' && data.runId === stream.runId),
          ).toBe(true);
        }
        releaseFirst();
        await stream.text;
        await vi.waitFor(() => expect(getStreamCount()).toBe(3));
        await vi.waitFor(() => expect(agentThreadStreamRuntime.getActiveThreadRunId(scope, pubsub)).toBeUndefined());
        const { messages } = await memory.recall(scope);
        const order = messages.flatMap(message =>
          message.content.parts.flatMap(part =>
            part.type === 'text' && ['pending A', 'idle B'].includes(part.text) ? [part.text] : [],
          ),
        );
        expect(order).toEqual(['pending A', 'idle B']);
        expect(JSON.stringify(model.doStreamCalls[1]?.prompt)).toContain('pending A');
        expect(JSON.stringify(model.doStreamCalls[1]?.prompt)).not.toContain('idle B');
        expect(JSON.stringify(model.doStreamCalls[2]?.prompt)).toContain('idle B');
        await vi.waitFor(() => expect(pubsub.owners.get(`${scope.resourceId}\u0000${scope.threadId}`)).toBeUndefined());
      } finally {
        releaseFirst();
        subscription.unsubscribe();
        remoteSubscription.unsubscribe();
      }
    },
  );

  it('does not recursively retry a cancelled follow-up whose preparation also fails', async () => {
    const scope = { resourceId: 'failed-recovery-user', threadId: 'failed-recovery-thread' };
    const pubsub = new ControlledLeasePubSub();
    const memory = new MockMemory();
    const model = createTextStreamModel('recovered answer');
    let preparing!: () => void;
    const started = new Promise<void>(resolve => {
      preparing = resolve;
    });
    let release!: () => void;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    let preparations = 0;
    const agent = new Agent({
      id: 'failed-recovery',
      name: 'Failed recovery',
      memory,
      model,
      pubsub,
      instructions: async () => {
        preparations++;
        if (preparations === 1) {
          preparing();
          await gate;
          throw new Error('Initial preparation failed');
        }
        if (preparations === 2) {
          expect(subscription.abort()).toBe(true);
          throw new Error('Follow-up preparation failed');
        }
        return 'Test';
      },
    });
    const subscription = await agent.subscribeToThread(scope);
    const first = agent.stream('first', { memory: { resource: scope.resourceId, thread: scope.threadId } });
    void first.catch(() => {});
    try {
      await started;
      await agent.sendSignal({ type: 'user-message', contents: 'preserved A' }, scope).accepted;
      await agent.sendSignal({ type: 'user-message', contents: 'preserved B' }, scope).accepted;
      expect(subscription.abort()).toBe(true);
      release();
      await expect(first).rejects.toThrow('Initial preparation failed');
      await vi.waitFor(() =>
        expect(
          pubsub.publishedData.some(
            data => data.type === 'run-failed' && data.error.includes('Follow-up preparation failed'),
          ),
        ).toBe(true),
      );
      await vi.waitFor(() => expect(pubsub.owners.get(`${scope.resourceId}\u0000${scope.threadId}`)).toBeUndefined());
      expect(preparations).toBe(2);
      expect(model.doStreamCalls).toHaveLength(0);
      const recovered = await agent.stream('natural next turn', {
        memory: { resource: scope.resourceId, thread: scope.threadId },
      });
      await recovered.text;
      await vi.waitFor(() => expect(agentThreadStreamRuntime.getActiveThreadRunId(scope, pubsub)).toBeUndefined());
      expect(preparations).toBe(3);
      const { messages } = await memory.recall(scope);
      const preserved = messages.flatMap(message =>
        message.content.parts.flatMap(part =>
          part.type === 'text' && ['preserved A', 'preserved B'].includes(part.text) ? [part.text] : [],
        ),
      );
      expect(preserved).toEqual(['preserved A', 'preserved B']);
      expect(model.doStreamCalls).toHaveLength(2);
      expect(JSON.stringify(model.doStreamCalls[1]?.prompt)).toContain('preserved A');
      expect(JSON.stringify(model.doStreamCalls[1]?.prompt)).toContain('preserved B');
    } finally {
      release();
      subscription.unsubscribe();
    }
  });

  it('executes forwarded messages once on a real winner after an aborted owner loses its lease', async () => {
    const scope = { resourceId: 'real-winner-user', threadId: 'real-winner-thread' };
    const key = `${scope.resourceId}\u0000${scope.threadId}`;
    const pubsub = new ControlledLeasePubSub();
    const owner = new AgentThreadStreamRuntime();
    const memory = new MockMemory();
    const model = createTextStreamModel('winner answer');
    let preparing!: () => void;
    const preparingWinner = new Promise<void>(resolve => {
      preparing = resolve;
    });
    let releaseWinner!: () => void;
    const winnerGate = new Promise<void>(resolve => {
      releaseWinner = resolve;
    });
    const agent = new Agent({
      id: 'real-winner',
      name: 'Real winner',
      model,
      memory,
      pubsub,
      instructions: async () => {
        preparing();
        await winnerGate;
        return 'Test';
      },
    });
    const ownerSubscription = await owner.subscribeToThread(agent, scope, pubsub);
    const winnerSubscription = await agent.subscribeToThread(scope);
    let finishOwner!: () => void;
    const ownerFinished = new Promise<void>(resolve => {
      finishOwner = resolve;
    });
    const oldRunId = 'aborted-losing-owner';
    const winnerRunId = 'real-winning-run';
    const options = owner.prepareRunOptions(
      { runId: oldRunId, memory: { resource: scope.resourceId, thread: scope.threadId } },
      pubsub,
    );
    await owner.registerRun(
      agent,
      {
        runId: oldRunId,
        status: 'running',
        fullStream: (async function* () {})(),
        _waitUntilFinished: () => ownerFinished,
      } as any,
      options,
      pubsub,
    );
    let releaseTransfer!: () => void;
    const transferGate = new Promise<void>(resolve => {
      releaseTransfer = resolve;
    });
    let transferring!: () => void;
    const transferStarted = new Promise<void>(resolve => {
      transferring = resolve;
    });
    try {
      const pending = owner.sendSignal(agent, { type: 'user-message', contents: 'pending A' }, scope, pubsub);
      await pending.accepted;
      const idle = owner.queueMessage(agent, 'idle B', scope, pubsub);
      await idle.accepted;
      pubsub.transferLeaseWait = transferGate;
      pubsub.onTransferLease = transferring;
      expect(ownerSubscription.abort()).toBe(true);
      finishOwner();
      await transferStarted;
      pubsub.owners.set(key, winnerRunId);
      const winning = agent.stream('winner input', {
        runId: winnerRunId,
        memory: { resource: scope.resourceId, thread: scope.threadId },
      });
      await preparingWinner;
      releaseTransfer();
      await vi.waitFor(() =>
        expect(
          pubsub.publishedData.filter(
            data =>
              data.type === 'signal-enqueued' &&
              data.runId === winnerRunId &&
              [pending.signal.id, idle.signal.id].includes(data.signal.id),
          ),
        ).toHaveLength(2),
      );
      await pubsub.flush();
      expect(model.doStreamCalls).toHaveLength(0);
      releaseWinner();
      const output = await winning;
      await output.text;
      await vi.waitFor(() => expect(agentThreadStreamRuntime.getActiveThreadRunId(scope, pubsub)).toBeUndefined());
      expect(model.doStreamCalls).toHaveLength(2);
      const prompt = JSON.stringify(model.doStreamCalls[1]?.prompt);
      expect(prompt.match(/pending A/g)).toHaveLength(1);
      expect(prompt.match(/idle B/g)).toHaveLength(1);
      const { messages } = await memory.recall(scope);
      const delivered = messages.flatMap(message =>
        message.content.parts.flatMap(part =>
          part.type === 'text' && ['pending A', 'idle B'].includes(part.text) ? [part.text] : [],
        ),
      );
      expect(delivered).toEqual(['pending A', 'idle B']);
      expect(messages.filter(message => message.role === 'assistant')).toHaveLength(2);
      await vi.waitFor(() => expect(pubsub.owners.get(key)).toBeUndefined());
      const next = await agent.stream('after handoff', {
        memory: { resource: scope.resourceId, thread: scope.threadId },
      });
      await next.text;
      expect(model.doStreamCalls).toHaveLength(3);
      await vi.waitFor(() => expect(pubsub.owners.get(key)).toBeUndefined());
    } finally {
      finishOwner();
      releaseTransfer();
      releaseWinner();
      ownerSubscription.unsubscribe();
      winnerSubscription.unsubscribe();
    }
  });

  it.each(['retain', 'lose'] as const)(
    'preserves queued input when abort %s ownership during a delayed handoff',
    async ownership => {
      const scope = { resourceId: 'abort-handoff-user', threadId: `abort-handoff-${ownership}` };
      const key = `${scope.resourceId}\u0000${scope.threadId}`;
      const pubsub = new ControlledLeasePubSub();
      const memory = new MockMemory();
      const { model, releaseFirst, getStreamCount } = createBlockingFirstTextStreamModel(
        'first response',
        'queued response',
      );
      const agent = new Agent({
        id: 'abort-handoff',
        name: 'Abort handoff',
        instructions: 'Test',
        model,
        memory,
        pubsub,
      });
      const subscription = await agent.subscribeToThread(scope);
      const winner = new AgentThreadStreamRuntime();
      const winnerSubscription = await winner.subscribeToThread(agent, scope, pubsub);
      const stream = await agent.stream('first', { memory: { resource: scope.resourceId, thread: scope.threadId } });
      let releaseTransfer!: () => void;
      const transferGate = new Promise<void>(resolve => {
        releaseTransfer = resolve;
      });
      let transferStarted!: () => void;
      const transferring = new Promise<void>(resolve => {
        transferStarted = resolve;
      });
      let finishWinner!: () => void;
      const winnerFinished = new Promise<void>(resolve => {
        finishWinner = resolve;
      });
      const winnerRunId = 'competing-abort-winner';
      try {
        await vi.waitFor(() => expect(getStreamCount()).toBe(1));
        const pending = agent.sendSignal({ type: 'user-message', contents: 'pending A' }, scope);
        await pending.accepted;
        const idle = agent.queueMessage('idle B', scope);
        await idle.accepted;
        pubsub.transferLeaseWait = transferGate;
        pubsub.onTransferLease = transferStarted;
        expect(subscription.abort()).toBe(true);
        releaseFirst();
        await transferring;
        expect(getStreamCount()).toBe(1);
        if (ownership === 'lose') {
          pubsub.owners.set(key, winnerRunId);
          await winner.registerRun(
            agent,
            {
              runId: winnerRunId,
              status: 'running',
              fullStream: (async function* () {})(),
              _waitUntilFinished: () => winnerFinished,
            } as any,
            { runId: winnerRunId, memory: { resource: scope.resourceId, thread: scope.threadId } },
            pubsub,
          );
        }
        releaseTransfer();
        if (ownership === 'lose') {
          await vi.waitFor(() =>
            expect(
              pubsub.publishedData.filter(
                data =>
                  data.type === 'signal-enqueued' && data.runId === winnerRunId && data.signal.id === pending.signal.id,
              ),
            ).toHaveLength(1),
          );
          await vi.waitFor(() =>
            expect(
              pubsub.publishedData.filter(
                data =>
                  data.type === 'signal-enqueued' && data.runId === winnerRunId && data.signal.id === idle.signal.id,
              ),
            ).toHaveLength(1),
          );
          await pubsub.flush();
          expect(winner.drainPendingSignals(winnerRunId, pubsub).map(signal => signal.id)).toEqual([
            pending.signal.id,
            idle.signal.id,
          ]);
          expect(winner.drainPendingSignals(winnerRunId, pubsub)).toEqual([]);
          expect(getStreamCount()).toBe(1);
          expect(pubsub.owners.get(key)).toBe(winnerRunId);
          finishWinner();
        }
        await stream.text;
        await vi.waitFor(() => expect(getStreamCount()).toBe(ownership === 'lose' ? 1 : 3));
        await vi.waitFor(() => expect(pubsub.owners.get(key)).toBeUndefined());
        const prompts = model.doStreamCalls.slice(1).map(call => JSON.stringify(call.prompt));
        if (ownership === 'retain') {
          expect(prompts[0]).toContain('pending A');
          expect(prompts[0]).not.toContain('idle B');
          expect(prompts.at(-1)).toContain('idle B');
        }
        await vi.waitFor(() => expect(agentThreadStreamRuntime.getActiveThreadRunId(scope, pubsub)).toBeUndefined());
      } finally {
        releaseFirst();
        releaseTransfer();
        finishWinner();
        subscription.unsubscribe();
        winnerSubscription.unsubscribe();
      }
    },
  );

  describe.each(['sendSignal', 'queueMessage'] as const)('pending %s cancellation', enqueue => {
    it.each(['none', 'thread', 'upstream'] as const)(
      'answers the follow-up after %s cancellation',
      async cancellation => {
        const scope = { resourceId: 'abort-queue-user', threadId: `abort-${enqueue}-${cancellation}` };
        const pubsub = new EventEmitterPubSub();
        const memory = new MockMemory();
        const upstream = new AbortController();
        const { model, releaseFirst, getStreamCount } = createBlockingFirstTextStreamModel(
          'first response',
          'follow-up response',
        );
        const agent = new Agent({
          id: 'abort-queue',
          name: 'Abort queue',
          instructions: 'Test',
          model,
          memory,
          pubsub,
        });
        const subscription = await agent.subscribeToThread(scope);
        const stream = await agent.stream('first', {
          memory: { thread: scope.threadId, resource: scope.resourceId },
          abortSignal: upstream.signal,
        });

        try {
          await vi.waitFor(() => expect(getStreamCount()).toBe(1));
          const queued =
            enqueue === 'queueMessage'
              ? agent.queueMessage('follow-up', scope)
              : agent.sendSignal({ type: 'user-message', contents: 'follow-up' }, scope);
          await queued.accepted;
          if (cancellation === 'thread') expect(subscription.abort()).toBe(true);
          if (cancellation === 'upstream') upstream.abort();
          releaseFirst();
          await stream.text;

          await vi.waitFor(async () => {
            const { messages } = await memory.recall(scope);
            const followUps = messages.filter(message =>
              message.content.parts.some(part => part.type === 'text' && part.text === 'follow-up'),
            );
            expect(followUps).toHaveLength(1);
            expect(messages.at(-1)).toMatchObject({
              role: 'assistant',
              content: {
                parts: expect.arrayContaining([expect.objectContaining({ type: 'text', text: 'follow-up response' })]),
              },
            });
          });
          expect(getStreamCount()).toBe(2);
          await vi.waitFor(() => expect(agentThreadStreamRuntime.getActiveThreadRunId(scope, pubsub)).toBeUndefined());
        } finally {
          releaseFirst();
          subscription.unsubscribe();
        }
      },
    );
  });

  it('preserves an explicitly supplied queued-message abort signal while allowing later queued work', async () => {
    const scope = { resourceId: 'explicit-abort-user', threadId: 'explicit-abort-thread' };
    const pubsub = new EventEmitterPubSub();
    const memory = new MockMemory();
    const { model, releaseFirst, getStreamCount } = createBlockingFirstTextStreamModel(
      'first response',
      'surviving response',
    );
    const agent = new Agent({
      id: 'explicit-abort',
      name: 'Explicit abort',
      instructions: 'Test',
      model,
      memory,
      pubsub,
    });
    const subscription = await agent.subscribeToThread(scope);
    const stream = await agent.stream('first', { memory: { thread: scope.threadId, resource: scope.resourceId } });
    const queuedAbort = new AbortController();

    try {
      await vi.waitFor(() => expect(getStreamCount()).toBe(1));
      await agent.queueMessage('cancelled follow-up', {
        ...scope,
        ifIdle: { streamOptions: { abortSignal: queuedAbort.signal } },
      }).accepted;
      await agent.queueMessage('surviving follow-up', scope).accepted;
      queuedAbort.abort();
      expect(subscription.abort()).toBe(true);
      releaseFirst();
      await stream.text;

      await vi.waitFor(async () => {
        const { messages } = await memory.recall(scope);
        expect(messages.at(-1)).toMatchObject({
          role: 'assistant',
          content: { parts: [expect.objectContaining({ type: 'text', text: 'surviving response' })] },
        });
      });
      expect(getStreamCount()).toBe(2);
      const prompt = model.doStreamCalls[1]?.prompt;
      expect(prompt?.at(-1)).toMatchObject({
        role: 'user',
        content: expect.arrayContaining([
          expect.objectContaining({ type: 'text', text: expect.stringContaining('surviving follow-up') }),
        ]),
      });
      await vi.waitFor(() => expect(agentThreadStreamRuntime.getActiveThreadRunId(scope, pubsub)).toBeUndefined());
    } finally {
      releaseFirst();
      subscription.unsubscribe();
    }
  });

  it('answers every signal sent to an aborted run in one follow-up run, then queued messages one at a time', async () => {
    const scope = { resourceId: 'abort-batch-user', threadId: 'abort-batch-thread' };
    const pubsub = new EventEmitterPubSub();
    const { model, releaseFirst, getStreamCount } = createBlockingFirstTextStreamModel('first', 'next');
    const agent = new Agent({
      id: 'abort-batch',
      name: 'Abort batch',
      instructions: 'Test',
      model,
      memory: new MockMemory(),
      pubsub,
    });
    const subscription = await agent.subscribeToThread(scope);
    const stream = await agent.stream('initial', { memory: { thread: scope.threadId, resource: scope.resourceId } });

    try {
      await vi.waitFor(() => expect(getStreamCount()).toBe(1));
      for (const contents of ['sent A', 'sent B', 'sent C']) {
        await agent.sendSignal({ type: 'user-message', contents }, scope).accepted;
      }
      await agent.queueMessage('queued X', scope).accepted;
      await agent.queueMessage('queued Y', scope).accepted;
      expect(subscription.abort()).toBe(true);
      releaseFirst();
      await stream.text;

      await vi.waitFor(() => expect(getStreamCount()).toBe(4));
      await vi.waitFor(() => expect(agentThreadStreamRuntime.getActiveThreadRunId(scope, pubsub)).toBeUndefined());
      expect(getStreamCount()).toBe(4);

      const followUp = JSON.stringify(model.doStreamCalls[1]?.prompt);
      const positions = ['sent A', 'sent B', 'sent C'].map(contents => followUp.indexOf(contents));
      expect(positions.every(position => position >= 0)).toBe(true);
      expect(positions).toEqual([...positions].sort((a, b) => a - b));
      expect(followUp).not.toContain('queued X');

      const queuedX = JSON.stringify(model.doStreamCalls[2]?.prompt);
      expect(queuedX).toContain('queued X');
      expect(queuedX).not.toContain('queued Y');
      expect(JSON.stringify(model.doStreamCalls[3]?.prompt)).toContain('queued Y');
    } finally {
      releaseFirst();
      subscription.unsubscribe();
    }
  });
});
