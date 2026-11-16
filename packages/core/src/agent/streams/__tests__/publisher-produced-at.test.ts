/**
 * Every chunk event a plain Agent publishes carries when the loop produced the
 * chunk (`producedAt`), not when the publish queue got to it. Thread history
 * compares it with the stored message's stamp to tell a replayed part that is
 * already stored from a new one.
 */
import { describe, expect, it } from 'vitest';
import { InMemoryServerCache } from '../../../cache/inmemory';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import type { Event } from '../../../events/types';
import { stampChunkProducedAt } from '../../../stream/base/produced-at';
import { requestAcknowledgedAbort } from '../abort-transport';
import { AGENT_STREAM_TOPIC, AgentStreamEventTypes } from '../constants';
import { createAgentStreamPublisher, createAgentStreamPublisherCoordinator } from '../publisher';
import { readAgentRunRecord } from '../run-records';

describe('agent stream publisher', () => {
  it('rejects a queued worker chunk after its execution loses ownership', async () => {
    const pubsub = new EventEmitterPubSub();
    const controller = new AbortController();
    const runId = 'superseded-worker-chunk';
    const events: Event[] = [];
    await pubsub.subscribe(AGENT_STREAM_TOPIC(runId), event => void events.push(event));
    const coordinator = createAgentStreamPublisherCoordinator(runId);
    const publisher = coordinator.attachOutput({
      pubsub,
      publisherId: 'worker',
      assertOwnership: async () => controller.signal.throwIfAborted(),
    });
    try {
      const pending = publisher.publishEvent({ type: AgentStreamEventTypes.CHUNK, runId, data: { text: 'stale' } });
      const successor = coordinator.attachOutput({ pubsub, publisherId: 'successor', assertOwnership: async () => {} });
      controller.abort(new Error('Execution superseded'));
      await expect(pending).rejects.toThrow('Execution superseded');
      await successor.publishEvent({ type: AgentStreamEventTypes.CHUNK, runId, data: { text: 'current' } });
      await pubsub.flush();
      expect(events.map(event => event.data.text)).toEqual(['current']);
    } finally {
      await coordinator.detach();
      await pubsub.close();
    }
  });
  it.each([
    AgentStreamEventTypes.FINISH,
    AgentStreamEventTypes.ERROR,
    AgentStreamEventTypes.SUSPENDED,
    AgentStreamEventTypes.ABORT,
  ])('keeps replay authorization and lifecycle settlement with the reader for %s', async type => {
    const pubsub = new EventEmitterPubSub();
    const cache = new InMemoryServerCache();
    const runId = 'remote-terminal-owner';
    const publisherId = 'shared-execution';
    const record = { cache, agentId: 'shared-agent' };
    const publisher = createAgentStreamPublisherCoordinator(runId);
    const owner = publisher.attachLifecycle({
      pubsub,
      publisherId,
      cleanupTimeoutMs: 0,
      record: { ...record, resourceId: 'resource', threadId: 'thread' },
    });
    await owner.ready;
    const worker = publisher.attachOutput({ pubsub, publisherId, assertOwnership: async () => {} });
    try {
      await worker.publishEvent({ type, runId, data: {} });
      expect(await readAgentRunRecord(cache, record.agentId, runId)).toMatchObject({ status: 'running', publisherId });
      const status = type === AgentStreamEventTypes.SUSPENDED ? 'suspended' : 'finished';
      await owner.settle(status);
      expect(await readAgentRunRecord(cache, record.agentId, runId)).toMatchObject({
        status,
        publisherId,
        resourceId: 'resource',
        threadId: 'thread',
      });
    } finally {
      await owner.detach();
      await worker.detach();
      await pubsub.close();
    }
  });
  it('releases worker output without ending the reader or a sibling worker', async () => {
    const pubsub = new EventEmitterPubSub();
    const cache = new InMemoryServerCache();
    const runId = 'worker-release';
    const record = { cache, agentId: 'shared-agent' };
    const events: Event[] = [];
    await pubsub.subscribe(AGENT_STREAM_TOPIC(runId), event => void events.push(event));
    const publisher = createAgentStreamPublisherCoordinator(runId);
    const owner = publisher.attachLifecycle({ pubsub, record, publisherId: 'execution', cleanupTimeoutMs: 0 });
    await owner.ready;
    const ownerRecord = await readAgentRunRecord(cache, record.agentId, runId);
    const worker = publisher.attachOutput({ pubsub, publisherId: 'execution', assertOwnership: async () => {} });
    const sibling = publisher.attachOutput({ pubsub, publisherId: 'sibling', assertOwnership: async () => {} });
    try {
      await worker.publishEvent({ type: AgentStreamEventTypes.CHUNK, runId, data: { text: 'First' } });
      await worker.detach();
      await worker.publishEvent({ type: AgentStreamEventTypes.FINISH, runId, data: {} });
      await pubsub.flush();
      expect(events.map(event => event.type)).toEqual([AgentStreamEventTypes.CHUNK]);
      expect(await readAgentRunRecord(cache, record.agentId, runId)).toEqual(ownerRecord);
      await sibling.publishEvent({ type: AgentStreamEventTypes.CHUNK, runId, data: { text: 'Second' } });
      await owner.settle('finished');
      await pubsub.flush();
      expect(events.map(event => event.data.text)).toEqual(['First', 'Second']);
      expect(await readAgentRunRecord(cache, record.agentId, runId)).toMatchObject({
        status: 'finished',
        publisherId: ownerRecord?.publisherId,
      });
    } finally {
      await publisher.detach();
      await pubsub.close();
    }
  });

  it('keeps abort delivery and reader settlement responsive while worker output is stalled', async () => {
    const runId = 'stalled-worker-output';
    let release!: () => void;
    const stalled = new Promise<void>(resolve => (release = resolve));
    let started!: () => void;
    const publishing = new Promise<void>(resolve => (started = resolve));
    class SlowOutputPubSub extends EventEmitterPubSub {
      override async publish(topic: string, event: Omit<Event, 'id' | 'createdAt'>) {
        if (topic === AGENT_STREAM_TOPIC(runId)) {
          started();
          await stalled;
        }
        return super.publish(topic, event);
      }
    }
    const pubsub = new SlowOutputPubSub();
    const cache = new InMemoryServerCache();
    const publisher = createAgentStreamPublisherCoordinator(runId);
    const controller = new AbortController();
    const listener = publisher.listenForAbort(pubsub, () => controller.abort());
    await listener.ready;
    const owner = publisher.attachLifecycle({
      pubsub,
      publisherId: 'execution',
      cleanupTimeoutMs: 0,
      listenForAbort: false,
      record: { cache, agentId: 'shared-agent' },
    });
    const worker = publisher.attachOutput({ pubsub, publisherId: 'execution', assertOwnership: async () => {} });
    const pending = worker.publishEvent({ type: AgentStreamEventTypes.CHUNK, runId, data: { text: 'delayed' } });
    try {
      await publishing;
      expect(await requestAcknowledgedAbort(pubsub, runId)).toBe(true);
      expect(controller.signal.aborted).toBe(true);
      await owner.settle('finished');
      expect(await readAgentRunRecord(cache, 'shared-agent', runId)).toMatchObject({ status: 'finished' });
      release();
      await pending;
      await worker.detach();
      expect(await requestAcknowledgedAbort(pubsub, runId)).toBe(true);
    } finally {
      release();
      await pending;
      await publisher.detach();
      await pubsub.close();
    }
  });

  // Technical: a delegated agent's chunks arrive wrapped in `tool-output` / `workflow-step-output`
  // chunks and are published as a slimmed copy, which lost the loop's stamp, so the event carried
  // the time it was published instead.
  it.each(['tool-output', 'workflow-step-output'] as const)(
    'keeps the time the loop produced a slimmed %s chunk',
    async type => {
      const pubsub = new EventEmitterPubSub();
      const runId = `produced-at-${type}`;
      const events: Event[] = [];
      await pubsub.subscribe(AGENT_STREAM_TOPIC(runId), event => void events.push(event));
      const publisher = createAgentStreamPublisher({ pubsub, runId, cleanupTimeoutMs: 0 });

      const nested = {
        type: 'step-start',
        from: 'AGENT',
        runId: 'delegated-run',
        payload: { messageId: 'm1', request: { body: 'DELEGATED-PROMPT' } },
      };
      const chunk = { type, runId, from: 'USER', payload: { toolCallId: 'call_1', output: nested } };
      stampChunkProducedAt(chunk, 1);
      publisher.publish(chunk as any);
      await publisher.close();
      await pubsub.flush();

      const published = events.find(event => event.type === AgentStreamEventTypes.CHUNK && event.data?.type === type);
      // The delegated agent's prompt was slimmed off, so this is the copy.
      expect(JSON.stringify(published?.data)).not.toContain('DELEGATED-PROMPT');
      expect(published?.producedAt).toBe(1);
      await pubsub.close();
    },
  );

  // Technical: an `error` chunk is published as a copy with its error serialized, which lost the stamp too.
  it('keeps the time the loop produced an error chunk', async () => {
    const pubsub = new EventEmitterPubSub();
    const runId = 'produced-at-error';
    const events: Event[] = [];
    await pubsub.subscribe(AGENT_STREAM_TOPIC(runId), event => void events.push(event));
    const publisher = createAgentStreamPublisher({ pubsub, runId, cleanupTimeoutMs: 0 });

    const chunk = { type: 'error', runId, from: 'AGENT', payload: { error: new Error('boom') } };
    stampChunkProducedAt(chunk, 1);
    publisher.publish(chunk as any);
    await publisher.close();
    await pubsub.flush();

    const published = events.find(event => event.type === AgentStreamEventTypes.CHUNK && event.data?.type === 'error');
    expect(published?.data.payload.error.message).toBe('boom');
    expect(published?.producedAt).toBe(1);
    await pubsub.close();
  });
});
