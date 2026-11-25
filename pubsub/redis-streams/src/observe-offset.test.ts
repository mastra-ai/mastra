/**
 * observe(runId, { offset }) on RedisStreamsPubSub resumes after the frames the
 * caller already has (issue #28324). Redis Streams replays a topic's retained
 * entries to every new subscriber, so frames before the offset must not reach
 * the observer a second time, and an offset past the end of a finished
 * run must deliver nothing.
 *
 * Covers both engines with both a Redis server cache and the default in-memory
 * server cache. With the in-memory cache, both engines run every step in this
 * process. Evented step frames are numbered because they extend the run log
 * the caller started with its `start` frame.
 *
 * Requires a Redis server at REDIS_URL; the model is served by AIMock.
 */
import { randomUUID } from 'node:crypto';

import { createOpenAI } from '@ai-sdk/openai-v5';
import { LLMock } from '@copilotkit/aimock';
import { Agent } from '@mastra/core/agent';
import { AGENT_STREAM_TOPIC, createDurableAgent, createEventedAgent } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { createTool } from '@mastra/core/tools';
import { LibSQLStore } from '@mastra/libsql';
import { createClient } from 'redis';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { nodeRedisPreset, RedisServerCache } from '../../../stores/redis/src/cache';
import { flushRedis, makeStorageDir, REDIS_URL } from '../test-fixtures/harness';
import { RedisStreamsPubSub } from './index';

type Frame = { type: string; text?: string };

const toFrame = (chunk: any): Frame => ({
  type: chunk.type,
  ...(chunk.type === 'text-delta' ? { text: chunk.payload?.text } : {}),
});

async function collectChunks(stream: AsyncIterable<any>, timeoutMs = 15_000): Promise<any[]> {
  const chunks: any[] = [];
  const read = (async () => {
    for await (const chunk of stream) chunks.push(chunk);
  })();
  await Promise.race([
    read,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`observation did not close: ${JSON.stringify(chunks.map(toFrame))}`)),
        timeoutMs,
      ),
    ),
  ]);
  return chunks;
}

async function collect(stream: AsyncIterable<any>, timeoutMs = 15_000): Promise<Frame[]> {
  return (await collectChunks(stream, timeoutMs)).map(toFrame);
}

/**
 * The run log index each chunk was published at. Indices are opaque cursors —
 * a log is seeded from the clock when it is created — so a client resumes from
 * a chunk's own index rather than counting frames.
 */
const indicesOf = (chunks: any[]): number[] => chunks.map(chunk => chunk.index as number);

const matrix = [
  { engine: 'durable', cache: 'default' },
  { engine: 'durable', cache: 'redis' },
  { engine: 'evented', cache: 'redis' },
  { engine: 'evented', cache: 'default' },
] as const;

describe.skipIf(!process.env.REDIS_URL && !process.env.CI && process.env.SKIP_REDIS_TESTS === '1')(
  'observe(runId, { offset }) on Redis Streams (#28324)',
  () => {
    let llm: LLMock;

    beforeAll(async () => {
      llm = new LLMock({ port: 0 });
      await llm.start();
    });

    afterAll(async () => {
      await llm.stop();
    });

    describe.each(matrix)('$engine engine, $cache server cache', ({ engine, cache }) => {
      let mastra: Mastra;
      let durable: any;
      let cacheClient: ReturnType<typeof createClient> | undefined;
      let cleanupStorage: () => Promise<void>;
      let releaseTool: () => void;
      let toolStarted: Promise<void>;
      let warn: ReturnType<typeof vi.spyOn>;
      const notNumberedWarnings = () =>
        warn.mock.calls.filter(([message]) => String(message).includes('are not numbered'));

      /** Numbered frames resume exactly at the offset. */
      const expectResumed = (resumed: Frame[], expected: Frame[]) => {
        expect(resumed).toEqual(expected);
        expect(notNumberedWarnings()).toHaveLength(0);
      };

      beforeEach(async () => {
        warn = vi.spyOn(console, 'warn');
        await flushRedis();
        const storage = await makeStorageDir('mastra-observe-offset-');
        cleanupStorage = storage.cleanup;
        const keyPrefix = `observe-offset-${randomUUID()}`;

        let markStarted!: () => void;
        toolStarted = new Promise(resolve => (markStarted = resolve));
        const gate = new Promise<void>(resolve => (releaseTool = resolve));
        const echo = createTool({
          id: 'echo',
          description: 'Echoes its input once released.',
          inputSchema: z.object({ text: z.string() }),
          execute: async ({ text }) => {
            markStarted();
            await gate;
            return { echoed: text };
          },
        });

        llm.on(
          { endpoint: 'chat', predicate: (req: any) => !req.messages.some((m: any) => m.role === 'tool') },
          { toolCalls: [{ id: 'call_echo', name: 'echo', arguments: JSON.stringify({ text: 'hi' }) }] },
        );
        llm.on(
          { endpoint: 'chat', predicate: (req: any) => req.messages.some((m: any) => m.role === 'tool') },
          { content: 'Echoed hi.' },
        );

        const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url.replace(/\/+$/, '')}/v1` });
        const base = new Agent({
          id: 'offset-agent',
          name: 'Offset Agent',
          instructions: 'You are a test agent driven by scripted AIMock responses.',
          model: openai('gpt-4o-mini'),
          tools: { echo },
        });
        const agent = engine === 'evented' ? createEventedAgent({ agent: base }) : createDurableAgent({ agent: base });

        let serverCache: RedisServerCache | undefined;
        if (cache === 'redis') {
          cacheClient = createClient({ url: REDIS_URL });
          await cacheClient.connect();
          serverCache = new RedisServerCache(
            { client: cacheClient as any },
            { ...nodeRedisPreset, keyPrefix: `${keyPrefix}:cache` },
          );
        }

        mastra = new Mastra({
          logger: false,
          storage: new LibSQLStore({ id: 'observe-offset-storage', url: storage.storageUrl }),
          pubsub: new RedisStreamsPubSub({ url: REDIS_URL, keyPrefix, blockMs: 200 }),
          ...(serverCache ? { cache: serverCache } : {}),
          agents: { offsetAgent: agent },
        });
        durable = mastra.getAgent('offsetAgent');
      });

      afterEach(async () => {
        warn.mockRestore();
        releaseTool?.();
        llm.clearFixtures?.();
        llm.reset?.();
        await mastra?.shutdown?.().catch(() => {});
        await cacheClient?.quit().catch(() => {});
        cacheClient = undefined;
        await cleanupStorage?.();
      });

      /** An index past every one the run's log has issued. */
      const pastEndOffset = async (runId: string) => {
        const history = await durable.pubsub.getHistory(AGENT_STREAM_TOPIC(runId), 0);
        return Math.max(0, ...history.map((event: any) => (event.index as number | undefined) ?? 0)) + 1_000;
      };

      it('resumes a live run after the offset without repeating earlier frames', async () => {
        const run = await durable.stream('Echo hi', { maxSteps: 5 });
        const callerChunks = collectChunks(run.fullStream);
        await toolStarted;

        // The observer has to attach before the caller's frames are known, so
        // take the offset from the log: the run's own fourth entry. Lifecycle
        // entries share the log with the caller's chunks, so which caller
        // frame that lands on is derived below rather than assumed.
        const history = await durable.pubsub.getHistory(AGENT_STREAM_TOPIC(run.runId), 0);
        const offset = (history[0].index as number) + 3;
        const observation = await durable.observe(run.runId, { offset });
        const observed = collect(observation.fullStream);
        // Let the observer attach while the run is parked in the tool, then finish it.
        await new Promise(resolve => setTimeout(resolve, 500));
        releaseTool();

        const chunks = await callerChunks;
        const caller = chunks.map(toFrame);
        const resumed = await observed;

        // Exactly the caller's frames from the offset onwards: none of the
        // earlier ones repeat, and none of the later ones are missing.
        const firstKept = indicesOf(chunks).findIndex(index => index >= offset);
        expect(firstKept).toBeGreaterThan(0);
        expectResumed(resumed, caller.slice(firstKept));
      });

      it('delivers nothing for an offset past the end of a finished run', async () => {
        releaseTool();
        const run = await durable.stream('Echo hi', { maxSteps: 5 });
        await collect(run.fullStream);

        const offset = await pastEndOffset(run.runId);
        expectResumed(await collect((await durable.observe(run.runId, { offset })).fullStream), []);
      });

      it('replays a finished run from a mid-run offset', async () => {
        releaseTool();
        const run = await durable.stream('Echo hi', { maxSteps: 5 });
        const chunks = await collectChunks(run.fullStream);
        const caller = chunks.map(toFrame);

        // Resuming at a chunk's own index replays that chunk and every one
        // after it — the cursor a client keeps from a previous chunk.
        const skipped = 3;
        const offset = indicesOf(chunks)[skipped]!;
        const resumed = await collect((await durable.observe(run.runId, { offset })).fullStream);

        expectResumed(resumed, caller.slice(skipped));
      });
    });
  },
);
