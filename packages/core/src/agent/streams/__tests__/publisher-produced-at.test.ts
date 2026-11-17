/**
 * Every chunk event a plain Agent publishes carries when the loop produced the
 * chunk (`producedAt`), not when the publish queue got to it. Thread history
 * compares it with the stored message's stamp to tell a replayed part that is
 * already stored from a new one.
 */
import { describe, expect, it } from 'vitest';
import { InMemoryServerCache } from '../../../cache/inmemory';
import { CachingPubSub } from '../../../events/caching-pubsub';
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
    const publisher = coordinator.attachEventProducer({
      pubsub,
      publisherId: 'worker',
      assertOwnership: async () => controller.signal.throwIfAborted(),
    });
    try {
      const pending = publisher.publishEvent({ type: AgentStreamEventTypes.CHUNK, runId, data: { text: 'stale' } });
      const successor = coordinator.attachEventProducer({
        pubsub,
        publisherId: 'successor',
        assertOwnership: async () => {},
      });
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
    const owner = publisher.attachOwner({
      pubsub,
      publisherId,
      cleanupTimeoutMs: 0,
      record: { ...record, resourceId: 'resource', threadId: 'thread' },
    });
    await owner.ready;
    const worker = publisher.attachEventProducer({ pubsub, publisherId, assertOwnership: async () => {} });
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
    const owner = publisher.attachOwner({ pubsub, record, publisherId: 'execution', cleanupTimeoutMs: 0 });
    await owner.ready;
    const ownerRecord = await readAgentRunRecord(cache, record.agentId, runId);
    const worker = publisher.attachEventProducer({ pubsub, publisherId: 'execution', assertOwnership: async () => {} });
    const sibling = publisher.attachEventProducer({ pubsub, publisherId: 'sibling', assertOwnership: async () => {} });
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
    const owner = publisher.attachOwner({
      pubsub,
      publisherId: 'execution',
      cleanupTimeoutMs: 0,
      listenForAbort: false,
      record: { cache, agentId: 'shared-agent' },
    });
    const worker = publisher.attachEventProducer({ pubsub, publisherId: 'execution', assertOwnership: async () => {} });
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

describe('agent stream publisher cleanup', () => {
  it.each(['before drain', 'after drain', 'authorized'] as const)(
    'preserves record recovery unless cleanup is authorized (%s)',
    async stage => {
      class RecoveringCache extends InMemoryServerCache {
        private failNextWrite = true;
        override async set(...args: Parameters<InMemoryServerCache['set']>) {
          if (this.failNextWrite) {
            this.failNextWrite = false;
            throw new Error('Cache temporarily unavailable');
          }
          return super.set(...args);
        }
      }
      const runId = `cleanup-retry-${stage}`;
      const cache = new RecoveringCache();
      const source = new EventEmitterPubSub();
      const coordinator = createAgentStreamPublisherCoordinator(runId);
      let checks = 0;
      const owner = coordinator.attachOwner({
        pubsub: source,
        publisherId: 'execution',
        record: { cache, agentId: 'cleanup-agent' },
        cleanupTimeoutMs: 0,
        listenForAbort: false,
        assertCleanupOwnership: async () => {
          checks++;
          if ((stage === 'before drain' && checks === 1) || (stage === 'after drain' && checks === 2)) {
            throw new Error('Cleanup ownership temporarily unavailable');
          }
        },
      });
      coordinator.attachEventProducer({ pubsub: source, publisherId: 'execution', assertOwnership: async () => {} });
      try {
        await owner.ready;
        expect(await readAgentRunRecord(cache, 'cleanup-agent', runId)).toBeUndefined();
        await owner.cleanup();
        if (stage === 'authorized') {
          await new Promise(resolve => setTimeout(resolve, 1200));
          expect(await readAgentRunRecord(cache, 'cleanup-agent', runId)).toBeUndefined();
        } else {
          await expect
            .poll(() => readAgentRunRecord(cache, 'cleanup-agent', runId), { timeout: 2000 })
            .toMatchObject({ publisherId: 'execution', status: 'running' });
        }
      } finally {
        await coordinator.detach();
        await source.close();
      }
    },
  );

  it.each(['execution', 'previous-execution'])(
    'does not recreate replay history from in-flight producer %s after cleanup begins',
    async publisherId => {
      const runId = 'cleanup-inflight';
      const topic = AGENT_STREAM_TOPIC(runId);
      let release!: () => void;
      const gate = new Promise<void>(resolve => (release = resolve));
      let started!: () => void;
      const entered = new Promise<void>(resolve => (started = resolve));
      class GatedPubSub extends CachingPubSub {
        override async publish(...args: Parameters<CachingPubSub['publish']>) {
          if (args[0] === topic) {
            started();
            await gate;
          }
          return super.publish(...args);
        }
      }
      const source = new EventEmitterPubSub();
      const cache = new InMemoryServerCache();
      const pubsub = new GatedPubSub(source, cache);
      const coordinator = createAgentStreamPublisherCoordinator(runId);
      const owner = coordinator.attachOwner({
        pubsub,
        publisherId: 'execution',
        cleanupTimeoutMs: 0,
        listenForAbort: false,
      });
      await owner.ready;
      const producer = coordinator.attachEventProducer({ pubsub, publisherId, assertOwnership: async () => {} });
      try {
        const publishing = producer.publishEvent({
          type: AgentStreamEventTypes.CHUNK,
          runId,
          data: { text: 'in-flight' },
        });
        await entered;
        const cleaning = owner.cleanup();
        // Let cleanup reach its destructive boundary while the transport is blocked.
        await new Promise<void>(resolve => setImmediate(resolve));
        release();
        await Promise.all([publishing, cleaning]);
        await new Promise<void>(resolve => setImmediate(resolve));
        expect(await pubsub.getHistory(topic)).toEqual([]);
      } finally {
        release();
        await coordinator.detach();
        await source.close();
      }
    },
  );
  it('stops the cleaned producer without stopping a different execution', async () => {
    const runId = 'cleanup-admission';
    const source = new EventEmitterPubSub();
    const pubsub = new CachingPubSub(source, new InMemoryServerCache());
    const coordinator = createAgentStreamPublisherCoordinator(runId);
    const owner = coordinator.attachOwner({
      pubsub,
      publisherId: 'execution',
      cleanupTimeoutMs: 0,
      listenForAbort: false,
    });
    await owner.ready;
    const producer = coordinator.attachEventProducer({
      pubsub,
      publisherId: 'execution',
      assertOwnership: async () => {},
    });
    const successor = coordinator.attachEventProducer({
      pubsub,
      publisherId: 'successor',
      assertOwnership: async () => {},
    });
    try {
      await owner.cleanup();
      await new Promise<void>(resolve => setImmediate(resolve));
      await producer.publishEvent({ type: AgentStreamEventTypes.CHUNK, runId, data: { text: 'late-old' } });
      await successor.publishEvent({ type: AgentStreamEventTypes.CHUNK, runId, data: { text: 'successor' } });
      expect((await pubsub.getHistory(AGENT_STREAM_TOPIC(runId))).map(event => event.data.text)).toEqual(['successor']);
    } finally {
      await coordinator.detach();
      await source.close();
    }
  });
  it('does not release producers when cleanup ownership is denied', async () => {
    const runId = 'cleanup-denied';
    const source = new EventEmitterPubSub();
    const pubsub = new CachingPubSub(source, new InMemoryServerCache());
    const coordinator = createAgentStreamPublisherCoordinator(runId);
    const owner = coordinator.attachOwner({
      pubsub,
      publisherId: 'execution',
      cleanupTimeoutMs: 0,
      listenForAbort: false,
      assertCleanupOwnership: async () => {
        throw new Error('Not cleanup owner');
      },
    });
    await owner.ready;
    const producer = coordinator.attachEventProducer({
      pubsub,
      publisherId: 'execution',
      assertOwnership: async () => {},
    });
    try {
      await owner.cleanup();
      await producer.publishEvent({ type: AgentStreamEventTypes.CHUNK, runId, data: { text: 'still-live' } });
      expect((await pubsub.getHistory(AGENT_STREAM_TOPIC(runId))).map(event => event.data.text)).toEqual([
        'still-live',
      ]);
    } finally {
      await coordinator.detach();
      await source.close();
    }
  });

  it('preserves a successor that takes over while cleanup drains a blocked producer', async () => {
    const runId = 'cleanup-takeover';
    let release!: () => void;
    const gate = new Promise<void>(resolve => (release = resolve));
    let started!: () => void;
    const entered = new Promise<void>(resolve => (started = resolve));
    class GatedPubSub extends CachingPubSub {
      override async publish(...args: Parameters<CachingPubSub['publish']>) {
        if (args[1].data?.text === 'blocked') {
          started();
          await gate;
        }
        return super.publish(...args);
      }
    }
    const source = new EventEmitterPubSub();
    const cache = new InMemoryServerCache();
    const pubsub = new GatedPubSub(source, cache);
    const coordinator = createAgentStreamPublisherCoordinator(runId);
    const record = { cache, agentId: 'cleanup-agent' };
    const owner = coordinator.attachOwner({
      pubsub,
      record,
      publisherId: 'execution',
      cleanupTimeoutMs: 0,
      listenForAbort: false,
    });
    await owner.ready;
    const producer = coordinator.attachEventProducer({
      pubsub,
      publisherId: 'execution',
      assertOwnership: async () => {},
    });
    try {
      const publishing = producer.publishEvent({ type: AgentStreamEventTypes.CHUNK, runId, data: { text: 'blocked' } });
      await entered;
      const cleaning = owner.cleanup();
      await new Promise<void>(resolve => setImmediate(resolve));
      const successorOwner = coordinator.attachOwner({
        pubsub,
        record,
        publisherId: 'successor',
        cleanupTimeoutMs: 0,
        listenForAbort: false,
      });
      await successorOwner.ready;
      const successor = coordinator.attachEventProducer({
        pubsub,
        publisherId: 'successor',
        assertOwnership: async () => {},
      });
      await successor.publishEvent({ type: AgentStreamEventTypes.CHUNK, runId, data: { text: 'successor' } });
      release();
      await Promise.all([publishing, cleaning]);
      await new Promise<void>(resolve => setImmediate(resolve));
      expect(await readAgentRunRecord(cache, record.agentId, runId)).toMatchObject({
        publisherId: 'successor',
        status: 'running',
      });
      expect((await pubsub.getHistory(AGENT_STREAM_TOPIC(runId))).map(event => event.data.text)).toContain('successor');
    } finally {
      release();
      await coordinator.detach();
      await source.close();
    }
  });
});
