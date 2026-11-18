/**
 * A pending/queued user-message presentation must not outlive the run that admitted
 * it. It is published under that run's id so a broker's `trimTopic` retires it with
 * the run's output. Published under the thread key instead, no trim ever matches it
 * and every new `subscribeToThread()` replays the stale projection.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage';
import { Agent } from '../agent';
import { agentThreadStreamRuntime } from '../thread-stream-runtime';
import { createBlockingFirstTextStreamModel, waitForActiveRun, waitForCondition } from './signals-test-utils';
import { LeasePubSub } from './thread-stream-test-utils';

const threadId = 'presentation-trim-thread';
const resourceId = 'presentation-trim-user';
const scope = { threadId, resourceId };

/**
 * A retaining pubsub whose `trimTopic` matches the envelope `runId`, the way the
 * redis-streams and valkey-streams brokers do.
 */
function retainingPubSub() {
  const pubsub = new LeasePubSub();
  pubsub.retain = true;
  const topics = new Set<string>();
  const published: any[] = [];
  const publish = pubsub.publish.bind(pubsub);
  pubsub.publish = async (topic: string, event: any) => {
    topics.add(topic);
    published.push(event);
    return publish(topic, event);
  };
  return {
    pubsub,
    published,
    retained: () => [...topics].flatMap(topic => pubsub.retainedEvents(topic)),
  };
}

const ofType = (events: any[], type: string) => events.filter(event => event.type === type);
const forSignal = (signalId: string) => (event: any) =>
  event.data?.chunk?.data?.id === signalId || event.data?.signalId === signalId;

function createAgent(
  pubsub: LeasePubSub,
  model: ConstructorParameters<typeof Agent>[0]['model'],
  id: string,
): Agent<any, any, any, any> {
  const agent = new Agent({ id, name: id, instructions: 'Test', model, memory: new MockMemory(), pubsub });
  new Mastra({ agents: { agent }, storage: new InMemoryStore(), logger: false, pubsub });
  return agent;
}

describe('thread-stream presentation trim', () => {
  beforeEach(() => {
    agentThreadStreamRuntime.resetForTests();
  });

  it('publishes a steer presentation under the run that answers it, and trims it with that run', async () => {
    const { pubsub, published, retained } = retainingPubSub();
    const { model, releaseFirst } = createBlockingFirstTextStreamModel('first response', 'steered response');
    const agent = createAgent(pubsub, model, 'presentation-steer-agent');
    const subscription = await agent.subscribeToThread(scope);
    void (async () => {
      for await (const part of subscription.stream) void part;
    })();

    const stream = await agent.stream('Hello', { memory: { thread: threadId, resource: resourceId } });
    await waitForActiveRun(subscription);
    await waitForCondition(() => stream._getImmediateText() === 'first response');

    const steer = agent.sendMessage({ contents: 'also include pricing' }, scope);
    await steer.accepted;

    // The run is still blocked mid-step, so this can only be the accept-time presentation.
    await waitForCondition(
      () => ofType(published, 'user-message-presentation').some(forSignal(steer.signal.id)),
      5_000,
    );
    const pending = ofType(published, 'user-message-presentation').find(forSignal(steer.signal.id))!;
    // The envelope run id is what a broker's trimTopic matches on.
    expect(pending.runId).toBe(stream.runId);
    expect(pending.data.chunk.data.metadata).toMatchObject({ status: 'pending' });

    releaseFirst();
    await stream.text;

    // The same run echoes the message, and the delivered marker it publishes is
    // stamped with that run too, not the thread key.
    await waitForCondition(() => ofType(published, 'user-message-delivered').length > 0, 5_000);
    for (const delivered of ofType(published, 'user-message-delivered')) {
      expect(delivered.runId).toBe(stream.runId);
    }

    await waitForCondition(
      () => !ofType(retained(), 'user-message-presentation').some(forSignal(steer.signal.id)),
      5_000,
    );
    expect(ofType(retained(), 'user-message-presentation')).toHaveLength(0);
    expect(ofType(retained(), 'user-message-delivered')).toHaveLength(0);

    // A subscriber that joins after the run must not be handed the stale projection.
    const late = await agent.subscribeToThread({ ...scope, withInitialHistory: false });
    const lateParts: any[] = [];
    void (async () => {
      for await (const part of late.stream) lateParts.push(part);
    })();
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(lateParts.some(forSignal(steer.signal.id))).toBe(false);
    late.unsubscribe();

    subscription.unsubscribe();
  });

  it('publishes a queued follow-up under the run holding the thread, and trims it with that run', async () => {
    const { pubsub, published, retained } = retainingPubSub();
    const { model, releaseFirst } = createBlockingFirstTextStreamModel('first response', 'queued response');
    const agent = createAgent(pubsub, model, 'presentation-queue-agent');
    const subscription = await agent.subscribeToThread(scope);
    void (async () => {
      for await (const part of subscription.stream) void part;
    })();

    const stream = await agent.stream('Hello', { memory: { thread: threadId, resource: resourceId } });
    await waitForActiveRun(subscription);
    await waitForCondition(() => stream._getImmediateText() === 'first response');

    const queued = agent.queueMessage({ contents: 'then summarise' }, scope);
    await queued.accepted;

    await waitForCondition(
      () => ofType(published, 'user-message-presentation').some(forSignal(queued.signal.id)),
      5_000,
    );
    const pending = ofType(published, 'user-message-presentation').find(forSignal(queued.signal.id))!;
    expect(pending.runId).toBe(stream.runId);
    expect(pending.data.chunk.data.metadata).toMatchObject({ status: 'queued' });

    releaseFirst();
    await stream.text;

    // The queue is handed to the follow-up's own run, whose presentation was already
    // retired with the run that admitted it.
    await waitForCondition(
      () => !ofType(retained(), 'user-message-presentation').some(forSignal(queued.signal.id)),
      5_000,
    );

    subscription.unsubscribe();
  });
});
