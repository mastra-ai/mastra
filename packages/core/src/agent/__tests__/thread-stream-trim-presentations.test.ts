/**
 * A pending or queued user message is announced on the thread topic. Once the
 * run it waits on completes, its trim must remove that announcement, or every
 * later subscriber replays a message stuck as "sending".
 */
import { describe, expect, it } from 'vitest';

import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage';
import { Agent } from '../agent';
import { createBlockingFirstTextStreamModel, waitForActiveRun, waitForCondition } from './signals-test-utils';
import { LeasePubSub } from './thread-stream-test-utils';

const resourceId = 'presentation-trim-user';

function setup(threadId: string, { delayFirstPresentationMs = 0 } = {}) {
  const pubsub = new LeasePubSub();
  pubsub.retain = true;
  const topics = new Set<string>();
  const completed: string[] = [];
  const publish = pubsub.publish.bind(pubsub);
  let presentationDelayed = false;
  pubsub.publish = async (topic: string, event: any) => {
    topics.add(topic);
    if (event.type === 'run-completed') completed.push(event.runId);
    if (delayFirstPresentationMs > 0 && event.type === 'user-message-presentation' && !presentationDelayed) {
      // The first append fails transiently and the backend retries it after a delay, as Redis Streams' publish does.
      presentationDelayed = true;
      await new Promise(resolve => setTimeout(resolve, delayFirstPresentationMs));
    }
    return publish(topic, event);
  };
  const { model, releaseFirst } = createBlockingFirstTextStreamModel('first response', 'later response');
  const agent = new Agent({
    id: `${threadId}-agent`,
    name: 'Presentation Trim Agent',
    instructions: 'test',
    model,
    memory: new MockMemory(),
  });
  const mastra = new Mastra({ agents: { agent }, storage: new InMemoryStore(), logger: false, pubsub });
  const retained = () => [...topics].flatMap(topic => pubsub.retainedEvents(topic));
  return { agent: mastra.getAgent('agent'), releaseFirst, completed, retained };
}

async function replayedPending(agent: Agent<any, any, any, any>, threadId: string) {
  const subscription = await agent.subscribeToThread({ threadId, resourceId });
  const parts: any[] = [];
  void (async () => {
    for await (const part of subscription.stream) parts.push(part);
  })();
  await new Promise(resolve => setTimeout(resolve, 50));
  subscription.unsubscribe();
  return parts.filter(part => part.type === 'data-user-message-pending');
}

describe('user message presentation trim', () => {
  it('removes a steered message announcement once the run that drained it completes', async () => {
    const threadId = 'presentation-trim-steer';
    const { agent, releaseFirst, completed, retained } = setup(threadId);
    const watcher = await agent.subscribeToThread({ threadId, resourceId });
    void (async () => {
      for await (const _ of watcher.stream);
    })();

    const stream = await agent.stream('Hello', { memory: { thread: threadId, resource: resourceId } });
    await waitForActiveRun(watcher);
    await waitForCondition(() => stream._getImmediateText() === 'first response');
    const steer = agent.sendMessage({ contents: 'also include pricing' }, { resourceId, threadId });
    await steer.accepted;
    await waitForCondition(() => retained().some(event => event.type === 'user-message-presentation'));

    releaseFirst();
    await stream.text;
    await waitForCondition(() => completed.includes(stream.runId), 2_000);
    await waitForCondition(() => !retained().some(event => event.type === 'user-message-presentation'), 2_000);
    watcher.unsubscribe();

    expect(await replayedPending(agent, threadId)).toEqual([]);
  });

  it('removes a queued message announcement once the run it waited on completes', async () => {
    const threadId = 'presentation-trim-queue';
    const { agent, releaseFirst, completed, retained } = setup(threadId);
    const watcher = await agent.subscribeToThread({ threadId, resourceId });
    void (async () => {
      for await (const _ of watcher.stream);
    })();

    const stream = await agent.stream('Hello', { memory: { thread: threadId, resource: resourceId } });
    await waitForActiveRun(watcher);
    await waitForCondition(() => stream._getImmediateText() === 'first response');
    const queued = agent.queueMessage({ contents: 'then summarise' }, { resourceId, threadId });
    await queued.accepted;
    await waitForCondition(() => retained().some(event => event.type === 'user-message-presentation'));

    releaseFirst();
    await stream.text;
    await waitForCondition(() => completed.length === 2, 2_000);
    await waitForCondition(() => !retained().some(event => event.type === 'user-message-presentation'), 2_000);
    watcher.unsubscribe();

    expect(await replayedPending(agent, threadId)).toEqual([]);
  });

  it('removes a queued message announcement whose append is retried while the run it waited on completes', async () => {
    const threadId = 'presentation-trim-retried';
    const { agent, releaseFirst, completed, retained } = setup(threadId, { delayFirstPresentationMs: 300 });
    const watcher = await agent.subscribeToThread({ threadId, resourceId });
    void (async () => {
      for await (const _ of watcher.stream);
    })();

    const stream = await agent.stream('Hello', { memory: { thread: threadId, resource: resourceId } });
    await waitForActiveRun(watcher);
    await waitForCondition(() => stream._getImmediateText() === 'first response');
    const queued = agent.queueMessage({ contents: 'then summarise' }, { resourceId, threadId });
    await queued.accepted;

    releaseFirst();
    await stream.text;
    await waitForCondition(() => completed.length === 2, 2_000);
    // Past the retry, so an announcement appended after its run's trim would be in the stream by now.
    await new Promise(resolve => setTimeout(resolve, 400));
    expect(retained().some(event => event.type === 'user-message-presentation')).toBe(false);
    watcher.unsubscribe();

    expect(await replayedPending(agent, threadId)).toEqual([]);
  });
});
