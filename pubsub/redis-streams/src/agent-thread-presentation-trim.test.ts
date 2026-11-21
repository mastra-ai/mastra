/**
 * #30792 against a real Redis: a user message queued behind a running turn is
 * announced on the thread stream. Once that turn completes, its trim must
 * delete the announcement, or every later subscriber replays it as "sending".
 */
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { Memory } from '@mastra/memory';
import { createClient } from 'redis';
import type { RedisClientType } from 'redis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createBlockingFirstTextStreamModel } from '../../../packages/core/src/agent/__tests__/signals-test-utils';
import { flushRedis, REDIS_URL, waitFor } from '../test-fixtures/harness';
import { RedisStreamsPubSub } from './index';

const SEP = '\u0000';
const resourceId = 'presentation-trim-user';
const threadId = 'presentation-trim-thread';
const streamKey = `mastra:topic:agent.thread-stream.${encodeURIComponent(`${resourceId}${SEP}${threadId}`)}`;

let inspector: RedisClientType;

async function retainedPresentations() {
  const entries = await inspector.xRange(streamKey, '-', '+');
  return entries
    .map(entry => JSON.parse(entry.message.event ?? '{}'))
    .filter(event => event.type === 'user-message-presentation');
}

describe('thread stream user message presentation trim over Redis (#30792)', () => {
  beforeAll(async () => {
    await flushRedis();
    inspector = createClient({ url: REDIS_URL });
    await inspector.connect();
  });

  afterAll(async () => {
    await inspector.quit();
  });

  it('deletes a queued message announcement once the run it waited on completes', async () => {
    const pubsub = new RedisStreamsPubSub({ url: REDIS_URL, blockMs: 50 });
    const { model, releaseFirst } = createBlockingFirstTextStreamModel('first response', 'later response');
    const agent = new Agent({
      id: 'presentation-trim-agent',
      name: 'Agent',
      instructions: 'test',
      model,
      memory: new Memory(),
    });
    const mastra = new Mastra({ agents: { agent }, storage: new InMemoryStore(), logger: false, pubsub });
    const registered = mastra.getAgent('agent');
    try {
      const stream = await registered.stream('Hello', { memory: { thread: threadId, resource: resourceId } });
      await waitFor(async () => stream._getImmediateText() === 'first response', 5_000);
      const queued = registered.queueMessage({ contents: 'then summarise' }, { resourceId, threadId });
      await queued.accepted;
      let announced: any[] = [];
      await waitFor(async () => (announced = await retainedPresentations()).length > 0, 5_000);
      expect(announced[0].data.chunk).toMatchObject({ type: 'data-user-message-pending', runId: stream.runId });

      releaseFirst();
      await stream.text;
      await waitFor(async () => (await retainedPresentations()).length === 0, 5_000);

      const subscription = await registered.subscribeToThread({ threadId, resourceId });
      const parts: any[] = [];
      void (async () => {
        for await (const part of subscription.stream) parts.push(part);
      })();
      await new Promise(resolve => setTimeout(resolve, 300));
      subscription.unsubscribe();
      expect(parts.filter(part => part.type === 'data-user-message-pending')).toEqual([]);
    } finally {
      await pubsub.close();
    }
  }, 30_000);
});
