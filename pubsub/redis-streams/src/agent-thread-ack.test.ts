/**
 * Failing test for https://github.com/mastra-ai/mastra/issues/20154
 *
 * `subscribeToThread` subscribes to the agent thread-stream topic through the
 * shared PubSub. On Redis Streams, every subscriber without an explicit group
 * gets a private `__fanout-<uuid>` consumer group, and delivered entries stay
 * in that group's Pending Entries List (PEL) until the subscriber calls the
 * `ack` callback. The thread-stream subscribers in
 * `packages/core/src/agent/thread-stream-runtime.ts` never call `ack`, so the
 * PEL grows unbounded for as long as the subscription lives.
 *
 * This test drives one real streamed agent turn while a thread subscription is
 * open, then asserts the total pending count across all `__fanout-*` groups on
 * the thread topic drains to zero. Today it does not — the assertion failure
 * is the bug.
 */
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';
import { createClient } from 'redis';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { flushRedis, REDIS_URL, waitFor } from '../test-fixtures/harness';
import { RedisStreamsPubSub } from './index';

// Mirror AgentThreadStreamRuntime's thread topic:
// `agent.thread-stream.<encodeURIComponent(resourceId + '\u0000' + threadId)>`
// prefixed by RedisStreamsPubSub's default keyPrefix `mastra:topic`.
const AGENT_THREAD_KEY_SEPARATOR = '\u0000';
function threadStreamKeyFor(resourceId: string, threadId: string): string {
  const threadKey = `${resourceId}${AGENT_THREAD_KEY_SEPARATOR}${threadId}`;
  return `mastra:topic:agent.thread-stream.${encodeURIComponent(threadKey)}`;
}

function createTextStreamModel(responseText: string) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: responseText },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        },
      ]),
    }),
  });
}

interface FanoutGroupPending {
  name: string;
  pending: number;
  lastDeliveredId: string;
}

describe.skipIf(!process.env.REDIS_URL && !process.env.CI && process.env.SKIP_REDIS_TESTS === '1')(
  'thread subscription acks Redis Streams deliveries (#20154)',
  () => {
    let pubsub: RedisStreamsPubSub | undefined;
    let inspector: ReturnType<typeof createClient> | undefined;

    beforeAll(async () => {
      await flushRedis(REDIS_URL);
    });

    afterEach(async () => {
      if (inspector) {
        await inspector.quit().catch(() => {});
        inspector = undefined;
      }
      if (pubsub) {
        await pubsub.close().catch(() => {});
        pubsub = undefined;
      }
      await flushRedis(REDIS_URL).catch(() => {});
    });

    afterAll(async () => {
      await flushRedis(REDIS_URL).catch(() => {});
    });

    async function fanoutGroupsFor(streamKey: string): Promise<FanoutGroupPending[]> {
      if (!inspector) throw new Error('inspector client not connected');
      const exists = await inspector.exists(streamKey);
      if (!exists) return [];
      const groups = (await inspector.xInfoGroups(streamKey)) as Array<Record<string, unknown>>;
      return groups
        .filter(g => String(g.name).startsWith('__fanout-'))
        .map(g => ({
          name: String(g.name),
          pending: Number(g.pending),
          lastDeliveredId: String(g['last-delivered-id'] ?? g.lastDeliveredId ?? '0-0'),
        }));
    }

    it(
      'leaves zero pending entries in the subscription fanout groups after a streamed turn completes',
      async () => {
        const resourceId = `ack-resource-${Date.now()}`;
        const threadId = `ack-thread-${Date.now()}`;
        const streamKey = threadStreamKeyFor(resourceId, threadId);

        pubsub = new RedisStreamsPubSub({ url: REDIS_URL });
        inspector = createClient({ url: REDIS_URL });
        await inspector.connect();

        const memory = new MockMemory();
        await memory.createThread({ threadId, resourceId });

        const agent = new Agent({
          id: 'ack-agent',
          name: 'Ack Agent',
          instructions: 'Reply briefly.',
          model: createTextStreamModel('ack response'),
          memory,
        });
        new Mastra({ agents: { ackAgent: agent }, pubsub, logger: false });

        const subscription = await agent.subscribeToThread({ resourceId, threadId });

        try {
          // Drive one real streamed turn on the subscribed thread so
          // thread-stream events (run-registered, stream chunks, terminal
          // events) flow through the Redis subscription.
          const output = await agent.stream('hello', {
            memory: { thread: threadId, resource: resourceId },
          });
          for await (const _part of output.fullStream) {
            // drain the run to completion
          }

          // Sanity: the subscription must have gone through real Redis
          // fan-out — at least one private group exists on the thread topic
          // and entries were actually delivered to it. Anything else is a
          // harness problem, not the bug under test.
          await waitFor(async () => {
            const groups = await fanoutGroupsFor(streamKey);
            return groups.length > 0 && groups.some(g => g.lastDeliveredId !== '0-0');
          }, 15_000);

          // Give the subscriber a bounded window to ack: poll until the total
          // PEL across all fanout groups drains to zero, or 5s passes.
          const settleDeadline = Date.now() + 5_000;
          let groups = await fanoutGroupsFor(streamKey);
          let totalPending = groups.reduce((sum, g) => sum + g.pending, 0);
          while (totalPending > 0 && Date.now() < settleDeadline) {
            await new Promise(r => setTimeout(r, 250));
            groups = await fanoutGroupsFor(streamKey);
            totalPending = groups.reduce((sum, g) => sum + g.pending, 0);
          }

          // #20154: the thread-stream subscribers never call the `ack`
          // callback, so every delivered event stays in the PEL forever.
          expect(
            totalPending,
            `expected 0 pending (acked) entries across ${groups.length} __fanout-* group(s) on ${streamKey} after the run completed, ` +
              `but ${totalPending} delivered entr${totalPending === 1 ? 'y is' : 'ies are'} still un-acked: ` +
              groups.map(g => `${g.name}=${g.pending}`).join(', '),
          ).toBe(0);
        } finally {
          subscription.unsubscribe();
        }
      },
      60_000,
    );
  },
);
