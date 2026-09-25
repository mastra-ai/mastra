/**
 * Runs the publish-lag thread-history scenarios (Agent and DurableAgent) on a
 * real Redis: dedupe against storage, answered approvals, per-step trimming.
 */
import { createClient } from 'redis';
import type { RedisClientType } from 'redis';
import { afterAll, beforeAll } from 'vitest';

// The shared scenarios live with @mastra/core's tests; there is no public export.
import { definePublishLagSuite } from '../../../packages/core/src/agent/__tests__/thread-stream-publish-lag.suite';
import { flushRedis, REDIS_URL } from '../test-fixtures/harness';
import { RedisStreamsPubSub } from './index';

const SEP = '\u0000';
let inspector: RedisClientType;
const created: RedisStreamsPubSub[] = [];

beforeAll(async () => {
  inspector = createClient({ url: REDIS_URL }) as RedisClientType;
  await inspector.connect();
});
afterAll(async () => {
  await inspector.quit();
});

definePublishLagSuite('redis', {
  create(delayMs) {
    const pubsub = new RedisStreamsPubSub({ url: REDIS_URL });
    created.push(pubsub);
    const publish = pubsub.publish.bind(pubsub);
    pubsub.publish = async (topic, event) => {
      if (delayMs && event.data?.type === 'stream-part') await new Promise(r => setTimeout(r, delayMs));
      return publish(topic, event);
    };
    return pubsub;
  },
  async topicParts(_pubsub, { threadId, resourceId }) {
    const key = `mastra:topic:agent.thread-stream.${encodeURIComponent(`${resourceId}${SEP}${threadId}`)}`;
    const entries = await inspector.xRange(key, '-', '+');
    return entries.flatMap(({ message }) => {
      const event = JSON.parse(message.event ?? 'null');
      return event?.data?.type === 'stream-part' ? [event.data.part.type as string] : [];
    });
  },
  async cleanup() {
    while (created.length) await created.pop()?.close?.();
    await flushRedis();
  },
});
