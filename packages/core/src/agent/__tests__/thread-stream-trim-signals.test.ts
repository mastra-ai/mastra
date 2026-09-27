/**
 * Persisted idle signals rebroadcast under their own runId. Once that run
 * completes, its entries must leave the topic like any saved run's.
 */
import { describe, expect, it, vi } from 'vitest';

import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage';
import { Agent } from '../agent';
import { MockLanguageModelV2 } from './mock-model';
import { LeasePubSub } from './thread-stream-test-utils';

const threadId = 'signal-trim-thread';
const resourceId = 'signal-trim-user';

async function waitFor(predicate: () => boolean, timeoutMs = 2_000) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('Timed out waiting for condition');
    await new Promise(resolve => setTimeout(resolve, 5));
  }
}

describe('persisted idle signal trim', () => {
  it('deletes the entries of signals persisted to an idle thread', async () => {
    const pubsub = new LeasePubSub();
    pubsub.retain = true;
    const topics = new Set<string>();
    const completed: string[] = [];
    const publish = pubsub.publish.bind(pubsub);
    pubsub.publish = async (topic: string, event: any) => {
      topics.add(topic);
      if (event.type === 'run-completed') completed.push(event.runId);
      return publish(topic, event);
    };
    const agent = new Agent({
      id: 'signal-trim-agent',
      name: 'Signal Trim Agent',
      instructions: 'test',
      model: new MockLanguageModelV2(),
      memory: new MockMemory(),
    });
    const mastra = new Mastra({ agents: { agent }, storage: new InMemoryStore(), logger: false, pubsub });
    const registered = mastra.getAgent('agent');
    const retained = () => [...topics].flatMap(topic => pubsub.retainedEvents(topic));

    for (let i = 0; i < 3; i++) {
      const result = registered.sendSignal(
        { type: 'system-reminder', contents: `reminder ${i}` },
        { resourceId, threadId, ifIdle: { behavior: 'persist' } },
      );
      await result.persisted;
    }

    await waitFor(() => completed.length === 3);
    await waitFor(() => retained().filter(event => event.runId !== undefined).length === 0);
    expect(retained().filter(event => event.runId !== undefined)).toEqual([]);
  });

  it('deletes the failure of a wake whose run could not start', async () => {
    const pubsub = new LeasePubSub();
    pubsub.retain = true;
    const topics = new Set<string>();
    const publish = pubsub.publish.bind(pubsub);
    pubsub.publish = async (topic: string, event: any) => {
      topics.add(topic);
      return publish(topic, event);
    };
    const agent = new Agent({
      id: 'wake-fail-agent',
      name: 'Wake Fail Agent',
      instructions: 'test',
      model: () => {
        throw new Error('No usable credential');
      },
      memory: new MockMemory(),
    });
    const mastra = new Mastra({ agents: { agent }, storage: new InMemoryStore(), logger: false, pubsub });
    const failures = () =>
      [...topics].flatMap(topic => pubsub.retainedEvents(topic)).filter(event => event.type === 'run-failed');

    vi.useFakeTimers({ toFake: ['setTimeout'] });
    try {
      const result = mastra
        .getAgent('agent')
        .sendSignal(
          { type: 'system-reminder', contents: 'wake up' },
          { resourceId, threadId, ifIdle: { behavior: 'wake' } },
        );
      await Promise.resolve(result.accepted).catch(() => {});
      await vi.advanceTimersByTimeAsync(1_000);
      expect(failures()).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(30_000);
    } finally {
      vi.useRealTimers();
    }
    await waitFor(() => failures().length === 0);
  });
});
