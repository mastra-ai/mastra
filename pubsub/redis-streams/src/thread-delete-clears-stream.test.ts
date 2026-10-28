import { randomUUID } from 'node:crypto';
import { createOpenAI } from '@ai-sdk/openai-v5';
import { LLMock } from '@copilotkit/aimock';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { Memory } from '@mastra/memory';
import { createClient } from 'redis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RedisStreamsPubSub } from './index';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6381';

/**
 * Thread streams are open-ended topics: no run lifecycle ever ends them, so
 * nothing called `clearTopic` and a deleted thread's stream stayed in Redis
 * until the idle TTL (or forever without one). Deleting the thread is the one
 * moment the stream is known to be dead.
 */
describe('Memory.deleteThread clears the thread event stream in Redis', () => {
  let mock: LLMock;
  let redis: ReturnType<typeof createClient>;

  beforeAll(async () => {
    mock = new LLMock({ port: 0 });
    await mock.start();
    redis = createClient({ url: REDIS_URL });
    await redis.connect();
  });

  afterAll(async () => {
    await mock.stop();
    await redis.quit();
  });

  // Built independently of core's topic helper, matching agent-thread-history.test.ts.
  const streamKeyFor = (keyPrefix: string, resourceId: string, threadId: string) =>
    `${keyPrefix}:agent.thread-stream.${encodeURIComponent(`${resourceId}\u0000${threadId}`)}`;

  it('deletes only the deleted thread’s stream', async () => {
    mock.on({ endpoint: 'chat' }, { content: 'hello back' });
    const keyPrefix = `thread-delete-${randomUUID()}`;
    const pubsub = new RedisStreamsPubSub({ url: REDIS_URL, keyPrefix, blockMs: 50 });
    const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${mock.url.replace(/\/+$/, '')}/v1` });
    const memory = new Memory();
    const agent = new Agent({
      id: 'thread-delete-agent',
      name: 'Thread delete agent',
      instructions: 'Reply briefly.',
      model: openai('gpt-4o-mini'),
      memory,
    });
    const mastra = new Mastra({ agents: { agent }, logger: false, storage: new InMemoryStore(), pubsub });

    const resourceId = `user-${randomUUID()}`;
    const deletedThread = `thread-${randomUUID()}`;
    const keptThread = `thread-${randomUUID()}`;
    try {
      for (const thread of [deletedThread, keptThread]) {
        const output = await mastra.getAgent('agent').stream('hi', { memory: { thread, resource: resourceId } });
        await output.consumeStream();
      }
      const deletedKey = streamKeyFor(keyPrefix, resourceId, deletedThread);
      const keptKey = streamKeyFor(keyPrefix, resourceId, keptThread);
      await expect.poll(() => redis.exists([deletedKey, keptKey]), { timeout: 5_000 }).toBe(2);

      await memory.deleteThread(deletedThread);
      // The stream is cleared in the background; settled() is the join point.
      await memory.settled();

      expect(await memory.getThreadById({ threadId: deletedThread })).toBeNull();
      expect(await redis.exists(deletedKey)).toBe(0);
      expect(await redis.exists(keptKey)).toBe(1);
      expect(await memory.getThreadById({ threadId: keptThread })).not.toBeNull();
    } finally {
      await pubsub.close();
      const leftovers = await redis.keys(`${keyPrefix}:*`);
      if (leftovers.length) await redis.del(leftovers);
    }
  }, 30_000);

  it('does not wait on an unreachable pubsub to delete the thread', async () => {
    // Nothing listens on port 1; the client keeps reconnecting forever.
    const client = createClient({ url: 'redis://127.0.0.1:1', socket: { reconnectStrategy: 50 } });
    client.on('error', () => {});
    const pubsub = new RedisStreamsPubSub({ client: client as never });
    const memory = new Memory();
    const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${mock.url.replace(/\/+$/, '')}/v1` });
    const agent = new Agent({ id: 'a', name: 'a', instructions: 'Reply.', model: openai('gpt-4o-mini'), memory });
    const mastra = new Mastra({ agents: { agent }, logger: false, storage: new InMemoryStore(), pubsub });
    await mastra.getAgent('agent').getMemory(); // registers Mastra (storage + pubsub) on the memory
    const thread = await memory.createThread({ resourceId: 'user-1', threadId: `thread-${randomUUID()}` });

    const deleted = memory.deleteThread(thread.id).then(() => 'deleted');
    const timedOut = new Promise(resolve => setTimeout(() => resolve('timed out'), 2_000));
    expect(await Promise.race([deleted, timedOut])).toBe('deleted');
    expect(await memory.getThreadById({ threadId: thread.id })).toBeNull();
    client.destroy();
  }, 10_000);
});
