/**
 * Every chunk event a plain Agent publishes carries when the loop produced the
 * chunk (`producedAt`), not when the publish queue got to it. Thread history
 * compares it with the stored message's stamp to tell a replayed part that is
 * already stored from a new one.
 */
import { describe, expect, it } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import type { Event } from '../../../events/types';
import { stampChunkProducedAt } from '../../../stream/base/produced-at';
import { AGENT_STREAM_TOPIC, AgentStreamEventTypes } from '../constants';
import { createAgentStreamPublisher } from '../publisher';

describe('agent stream publisher', () => {
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
