import { describe, expect, it } from 'vitest';
import { InMemoryServerCache } from '../../cache/inmemory';
import { CachingPubSub } from '../../events/caching-pubsub';
import { EventEmitterPubSub } from '../../events/event-emitter';
import type { Event, EventCallback } from '../../events/types';
import { fencePubSub } from '../durable/execution-fence';
import { abortAckTopic } from './abort-transport';
import { bindAgentPubSub } from './agent-pubsub';
import { AGENT_CONTROL_TOPIC, AGENT_STREAM_TOPIC } from './constants';

describe('agent-scoped transport delivery', () => {
  it('isolates retained replay, live delivery, offsets and cleanup on one cached transport', async () => {
    const transport = new CachingPubSub(new EventEmitterPubSub(), new InMemoryServerCache());
    const alice = bindAgentPubSub(transport, 'alice');
    const bob = bindAgentPubSub(transport, 'bob');
    const topic = AGENT_STREAM_TOPIC('shared');
    await alice.publish(topic, { type: 'alice-first', runId: 'shared', data: {} });
    await bob.publish(topic, { type: 'bob-first', runId: 'shared', data: {} });
    const received: Event[] = [];
    const receive: EventCallback = event => {
      received.push(event);
    };
    await bob.subscribeWithReplay(topic, receive);
    await alice.publish(topic, { type: 'alice-second', runId: 'shared', data: {} });
    await bob.publish(topic, { type: 'bob-second', runId: 'shared', data: {} });
    await transport.flush();
    expect(received.map(event => [event.type, event.index])).toEqual([
      ['bob-first', 0],
      ['bob-second', 1],
    ]);
    await bob.unsubscribe(topic, receive);
    await alice.clearTopic(topic);
    expect(await alice.getHistory(topic)).toEqual([]);
    expect((await bob.getHistory(topic)).map(event => event.type)).toEqual(['bob-first', 'bob-second']);
    const offsetEvents: Event[] = [];
    const fromOffset: EventCallback = event => {
      offsetEvents.push(event);
    };
    await bob.subscribeFromOffset(topic, 1, fromOffset);
    expect(offsetEvents.map(event => event.type)).toEqual(['bob-second']);
    await bob.unsubscribe(topic, fromOffset);
  });

  it('keeps abort acknowledgements distinct from a run whose id ends in .ack', async () => {
    const transport = new CachingPubSub(new EventEmitterPubSub(), new InMemoryServerCache());
    const agent = bindAgentPubSub(transport, 'agent');
    await agent.publish(abortAckTopic('run'), { type: 'ack', runId: 'run', data: {} });
    await agent.publish(AGENT_CONTROL_TOPIC('run.ack'), { type: 'abort', runId: 'run.ack', data: {} });
    expect((await agent.getHistory(abortAckTopic('run'))).map(event => event.type)).toEqual(['ack']);
    expect((await agent.getHistory(AGENT_CONTROL_TOPIC('run.ack'))).map(event => event.type)).toEqual(['abort']);
  });

  it('does not double-map fenced delivery or bypass its ownership guard', async () => {
    const transport = new CachingPubSub(new EventEmitterPubSub(), new InMemoryServerCache());
    const agent = bindAgentPubSub(transport, 'agent');
    let lost = false;
    const guarded = fencePubSub(agent, { isLost: () => lost });
    const rebound = bindAgentPubSub(guarded, 'agent');
    expect(rebound).toBe(guarded);
    expect(() => bindAgentPubSub(guarded, 'other')).toThrow('Cannot rebind');
    await rebound.publish(AGENT_STREAM_TOPIC('run'), { type: 'owned', runId: 'run', data: {} });
    lost = true;
    await rebound.publish(AGENT_STREAM_TOPIC('run'), { type: 'stale', runId: 'run', data: {} });
    expect((await agent.getHistory(AGENT_STREAM_TOPIC('run'))).map(event => event.type)).toEqual(['owned']);
    expect(bindAgentPubSub(agent, 'other')).toBe(bindAgentPubSub(transport, 'other'));
    expect(agent.__rawBus()).toBe(transport.__rawBus());
    expect(agent.__self()).toBe(agent);
  });

  it('leaves workflow and thread discovery topics on the shared transport', async () => {
    const transport = new CachingPubSub(new EventEmitterPubSub(), new InMemoryServerCache());
    const alice = bindAgentPubSub(transport, 'alice');
    const bob = bindAgentPubSub(transport, 'bob');
    for (const topic of ['workflow.events.v2.run', 'agent.thread.discovery', 'thread.control.run']) {
      await alice.publish(topic, { type: 'shared', runId: 'run', data: {} });
      expect((await bob.getHistory(topic)).map(event => event.type)).toEqual(['shared']);
    }
  });
});
