/**
 * A plain Agent's run keeps streaming to its caller when the stream bus stops
 * answering, so its publish queue is capped: past the cap the rest of the run
 * is left out of the replay, which ends with an `AGENT_STREAM_REPLAY_INCOMPLETE`
 * error instead of passing for the whole run.
 */
import { describe, expect, it } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import type { Event } from '../../../events/types';
import {
  AGENT_STREAM_REPLAY_INCOMPLETE,
  AGENT_STREAM_TOPIC,
  AgentStreamEventTypes,
  MAX_PENDING_STREAM_EVENTS,
} from '../constants';
import { createAgentStreamPublisher } from '../publisher';

/** A bus whose publishes wait until `release()`, like one that stopped answering. */
function stalledPubSub() {
  const pubsub = new EventEmitterPubSub();
  const publish = pubsub.publish.bind(pubsub);
  const held: Array<() => void> = [];
  let stalled = true;
  pubsub.publish = (topic, event) => {
    if (!stalled) return publish(topic, event);
    return new Promise<void>((resolve, reject) => held.push(() => publish(topic, event).then(resolve, reject)));
  };
  return {
    pubsub,
    release() {
      stalled = false;
      for (const next of held.splice(0)) next();
    },
  };
}

const textDelta = (runId: string, i: number) => ({
  type: 'text-delta',
  runId,
  from: 'AGENT',
  payload: { id: 't', text: String(i % 10) },
});

describe('agent stream publish queue', () => {
  it('ends the replay with an incomplete marker once the bus falls too far behind', async () => {
    const { pubsub, release } = stalledPubSub();
    const runId = 'queue-cap-overflow';
    const events: Event[] = [];
    await pubsub.subscribe(AGENT_STREAM_TOPIC(runId), event => void events.push(event));
    const publisher = createAgentStreamPublisher({ pubsub, runId, cleanupTimeoutMs: 0 });

    const total = MAX_PENDING_STREAM_EVENTS + 500;
    for (let i = 0; i < total; i++) publisher.publish(textDelta(runId, i) as any);
    publisher.publish({ type: 'finish', runId, from: 'AGENT', payload: { stepResult: { reason: 'stop' } } } as any);
    const closed = publisher.close();

    release();
    await closed;
    await pubsub.flush();

    const chunks = events.filter(event => event.type === AgentStreamEventTypes.CHUNK);
    expect(chunks.length).toBe(MAX_PENDING_STREAM_EVENTS);
    expect(chunks.length).toBeLessThan(total);
    const markerIndex = events.findIndex(event => event.type === AgentStreamEventTypes.ERROR);
    expect(events[markerIndex]?.data.error.id).toBe(AGENT_STREAM_REPLAY_INCOMPLETE);
    // The marker comes after every chunk that made it in, so readers stop exactly at the gap.
    expect(events.slice(markerIndex + 1).some(event => event.type === AgentStreamEventTypes.CHUNK)).toBe(false);
    await pubsub.close();
  });

  it('publishes a whole run that stays under the cap, with no marker', async () => {
    const { pubsub, release } = stalledPubSub();
    const runId = 'queue-cap-under';
    const events: Event[] = [];
    await pubsub.subscribe(AGENT_STREAM_TOPIC(runId), event => void events.push(event));
    const publisher = createAgentStreamPublisher({ pubsub, runId, cleanupTimeoutMs: 0 });

    const total = MAX_PENDING_STREAM_EVENTS - 10;
    for (let i = 0; i < total; i++) publisher.publish(textDelta(runId, i) as any);
    publisher.publish({ type: 'finish', runId, from: 'AGENT', payload: { stepResult: { reason: 'stop' } } } as any);
    const closed = publisher.close();

    release();
    await closed;
    await pubsub.flush();

    expect(events.filter(event => event.type === AgentStreamEventTypes.CHUNK).length).toBe(total);
    expect(events.some(event => event.type === AgentStreamEventTypes.ERROR)).toBe(false);
    expect(events.at(-1)?.type).toBe(AgentStreamEventTypes.FINISH);
    await pubsub.close();
  });
});
