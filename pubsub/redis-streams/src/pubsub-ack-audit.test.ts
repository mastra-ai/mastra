/**
 * Audit of the remaining fan-out pubsub subscribers, proven against real Redis.
 *
 * Every ungrouped `subscribe()` creates a private consumer group. Redis holds
 * each delivered entry in that group's PEL until the consumer XACKs it, so any
 * subscriber that never acknowledges grows an unbounded pending list for as
 * long as it stays attached. These tests drive the production subscription
 * helpers directly and assert the PEL drains.
 */
import { AGENT_CONTROL_TOPIC, AgentControlEventTypes, subscribeToAbortRequests } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { createClient } from 'redis';
import type { RedisClientType } from 'redis';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { flushRedis, REDIS_URL, waitFor } from '../test-fixtures/harness';
import { RedisStreamsPubSub } from './index';

let inspector: RedisClientType;

function streamKeyFor(topic: string): string {
  return `mastra:topic:${topic}`;
}

async function pendingCount(topic: string): Promise<number> {
  const streamKey = streamKeyFor(topic);
  if (!(await inspector.exists(streamKey))) return 0;
  const groups = (await inspector.xInfoGroups(streamKey)) as Array<{ name: string; pending: number }>;
  return groups.reduce((total, group) => total + Number(group.pending ?? 0), 0);
}

async function entryCount(topic: string): Promise<number> {
  const streamKey = streamKeyFor(topic);
  if (!(await inspector.exists(streamKey))) return 0;
  return await inspector.xLen(streamKey);
}

describe('pubsub subscriber acknowledgement audit', () => {
  const created: RedisStreamsPubSub[] = [];

  const makePubSub = () => {
    const pubsub = new RedisStreamsPubSub({ url: REDIS_URL });
    created.push(pubsub);
    return pubsub;
  };

  beforeAll(async () => {
    inspector = createClient({ url: REDIS_URL }) as RedisClientType;
    await inspector.connect();
  });

  afterAll(async () => {
    await inspector.quit();
  });

  afterEach(async () => {
    while (created.length) {
      await created.pop()?.close?.();
    }
    await flushRedis();
  });

  it('drains the PEL for durable-agent abort listeners', async () => {
    const runId = `abort-run-${Date.now()}`;
    const topic = AGENT_CONTROL_TOPIC(runId);

    const listenerPubSub = makePubSub();
    let aborts = 0;
    const unsubscribe = await subscribeToAbortRequests(listenerPubSub, runId, () => {
      aborts++;
    });

    const producer = makePubSub();
    // An unrelated control event is filtered out by the handler but is still a
    // delivery, then a real abort request the handler acts on.
    await producer.publish(topic, { type: 'agent.control.other', runId, data: {} } as any);
    await producer.publish(topic, { type: AgentControlEventTypes.ABORT_REQUEST, runId, data: {} } as any);

    await waitFor(async () => aborts === 1);
    await waitFor(async () => (await entryCount(topic)) === 2);
    await waitFor(async () => (await pendingCount(topic)) === 0);

    expect(await pendingCount(topic)).toBe(0);
    await unsubscribe();
  });

  it('drains the PEL for user event listeners registered on Mastra', async () => {
    const topic = `user-topic-${Date.now()}`;
    const mastra = new Mastra({ pubsub: makePubSub() });
    const received: unknown[] = [];
    const listener = async (event: any) => {
      received.push(event);
    };
    await mastra.addTopicListener(topic, listener);

    const producer = makePubSub();
    await producer.publish(topic, { type: 'custom', runId: 'n/a', data: { i: 1 } } as any);
    await producer.publish(topic, { type: 'custom', runId: 'n/a', data: { i: 2 } } as any);

    await waitFor(async () => received.length === 2);
    await waitFor(async () => (await pendingCount(topic)) === 0);

    expect(await pendingCount(topic)).toBe(0);
    await mastra.removeTopicListener(topic, listener);
  });

  it('drains the PEL for workflow run watchers', async () => {
    const step = createStep({
      id: 'noop',
      inputSchema: undefined as any,
      outputSchema: undefined as any,
      execute: async () => ({}),
    });
    const workflow = createWorkflow({
      id: 'ack-audit-workflow',
      inputSchema: undefined as any,
      outputSchema: undefined as any,
    })
      .then(step)
      .commit();
    const mastra = new Mastra({ pubsub: makePubSub(), workflows: { 'ack-audit-workflow': workflow } });

    // Run.watch() subscribes on the run's own pubsub, which defaults to an
    // in-process EventEmitter, so hand it the Redis-backed one under test.
    const run = await mastra.getWorkflow('ack-audit-workflow').createRun({ pubsub: makePubSub() });
    const seen: unknown[] = [];
    const unwatch = run.watch(event => {
      seen.push(event);
    });

    const runTopic = `workflow.events.v2.${run.runId}`;
    const producer = makePubSub();
    // `run.watch()` subscribes in the background, so republish until the
    // watcher is actually attached instead of racing the first delivery.
    // `nested-watch` is a global topic: every watcher on the process receives
    // every nested workflow's events, including ones for other runs.
    await waitFor(async () => {
      await producer.publish(runTopic, { type: 'watch', runId: run.runId, data: { type: 'step-start' } } as any);
      await producer.publish('nested-watch', {
        type: 'watch',
        runId: 'some-other-run',
        data: { event: { type: 'step-start' }, workflowId: 'other' },
      } as any);
      return seen.length > 0;
    });
    await waitFor(async () => (await pendingCount(runTopic)) === 0);
    await waitFor(async () => (await pendingCount('nested-watch')) === 0);

    expect(await pendingCount(runTopic)).toBe(0);
    expect(await pendingCount('nested-watch')).toBe(0);
    unwatch();
  });
});
