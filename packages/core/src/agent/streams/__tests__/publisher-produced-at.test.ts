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
import type { ChunkType } from '../../../stream/types';
import { ChunkFrom } from '../../../stream/types';
import { AGENT_STREAM_TOPIC, AgentStreamEventTypes } from '../constants';
import { createAgentStreamPublisher } from '../publisher';
import { readAgentRunRecord } from '../run-records';

describe('agent stream publisher', () => {
  it('rejects a queued worker chunk after its execution loses ownership', async () => {
    const pubsub = new EventEmitterPubSub();
    const controller = new AbortController();
    const runId = 'superseded-worker-chunk';
    const events: Event[] = [];
    await pubsub.subscribe(AGENT_STREAM_TOPIC(runId), event => void events.push(event));
    const publisher = createAgentStreamPublisher({
      pubsub,
      runId,
      role: 'producer',
      cleanupTimeoutMs: 0,
      assertOwnership: async () => controller.signal.throwIfAborted(),
    });
    try {
      const pending = publisher.publishEvent({ type: AgentStreamEventTypes.CHUNK, runId, data: { text: 'stale' } });
      controller.abort(new Error('Execution superseded'));
      await expect(pending).rejects.toThrow('Execution superseded');
      await pubsub.flush();
      expect(events).toEqual([]);
    } finally {
      await publisher.detach();
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
    const owner = createAgentStreamPublisher({
      pubsub,
      runId,
      publisherId,
      cleanupTimeoutMs: 0,
      record: { ...record, resourceId: 'resource', threadId: 'thread' },
    });
    await owner.ready;
    const worker = createAgentStreamPublisher({
      pubsub,
      runId,
      publisherId,
      role: 'producer',
      record,
      cleanupTimeoutMs: 0,
    });
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
  it.each(['close', 'fail', 'detach'] as const)(
    'does not end another worker’s run when a producer calls %s',
    async method => {
      const pubsub = new EventEmitterPubSub();
      const cache = new InMemoryServerCache();
      const runId = `worker-detach-${method}`;
      const record = { cache, agentId: 'shared-agent' };
      const events: Event[] = [];
      await pubsub.subscribe(AGENT_STREAM_TOPIC(runId), event => void events.push(event));
      const owner = createAgentStreamPublisher({ pubsub, runId, record, cleanupTimeoutMs: 0 });
      await owner.ready;
      const ownerRecord = await readAgentRunRecord(cache, record.agentId, runId);
      const worker = createAgentStreamPublisher({
        pubsub,
        runId,
        record,
        cleanupTimeoutMs: 0,
        role: 'producer',
      });
      try {
        expect(ownerRecord).toMatchObject({ status: 'running' });
        const finish: ChunkType = {
          type: 'finish',
          runId,
          from: ChunkFrom.AGENT,
          payload: {
            stepResult: { reason: 'stop' },
            output: { usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } },
            metadata: {},
            messages: { all: [], user: [], nonUser: [] },
          },
        };
        worker.publish({ type: 'text-delta', runId, from: ChunkFrom.AGENT, payload: { id: 'text', text: 'First' } });
        worker.publish(finish);
        if (method === 'fail') await worker.fail(new Error('Step will retry'));
        else await worker[method]();
        await pubsub.flush();
        expect(events.map(event => event.type)).toEqual([AgentStreamEventTypes.CHUNK]);
        expect(await readAgentRunRecord(cache, record.agentId, runId)).toEqual(ownerRecord);
        owner.publish({ type: 'text-delta', runId, from: ChunkFrom.AGENT, payload: { id: 'text', text: 'Second' } });
        owner.publish(finish);
        await owner.close();
        await pubsub.flush();
        expect(
          events.filter(event => event.type === AgentStreamEventTypes.CHUNK).map(event => event.data.payload.text),
        ).toEqual(['First', 'Second']);
        expect(events.map(event => event.type)).toEqual([
          AgentStreamEventTypes.CHUNK,
          AgentStreamEventTypes.CHUNK,
          AgentStreamEventTypes.FINISH,
        ]);
        expect(await readAgentRunRecord(cache, record.agentId, runId)).toMatchObject({
          status: 'finished',
          publisherId: ownerRecord?.publisherId,
        });
      } finally {
        await worker.close();
        await owner.close();
        await pubsub.close();
      }
    },
  );

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
