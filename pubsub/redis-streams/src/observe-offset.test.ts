/**
 * observe(runId, { offset }) on RedisStreamsPubSub resumes after the frames the
 * caller already has (issue #28324). Redis Streams replays a topic's retained
 * entries to every new subscriber, so frames before the offset must not reach
 * the observer a second time, and an offset past the end of a finished
 * run must deliver nothing.
 *
 * Covers both engines with a Redis server cache, and the durable engine with
 * the default in-memory server cache (its single process numbers every frame).
 *
 * The evented engine with the default in-memory server cache is a known
 * limitation: its step executor publishes unnumbered frames on a cross-process
 * pubsub (per-process counters would disagree), and an unnumbered frame cannot
 * be skipped by position, so the observer still receives frames from before
 * the offset. That row pins the one-time warning CachingPubSub logs instead,
 * and that the observation still closes.
 *
 * Requires a Redis server at REDIS_URL; the model is served by AIMock.
 */
import { randomUUID } from 'node:crypto';

import { createOpenAI } from '@ai-sdk/openai-v5';
import { LLMock } from '@copilotkit/aimock';
import { Agent } from '@mastra/core/agent';
import { createDurableAgent, createEventedAgent } from '@mastra/core/agent/durable';
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

async function collect(stream: AsyncIterable<any>, timeoutMs = 15_000): Promise<Frame[]> {
  const frames: Frame[] = [];
  const read = (async () => {
    for await (const chunk of stream) frames.push(toFrame(chunk));
  })();
  await Promise.race([
    read,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`observation did not close: ${JSON.stringify(frames)}`)), timeoutMs),
    ),
  ]);
  return frames;
}

const matrix = [
  { engine: 'durable', cache: 'default', numbered: true },
  { engine: 'durable', cache: 'redis', numbered: true },
  { engine: 'evented', cache: 'redis', numbered: true },
  { engine: 'evented', cache: 'default', numbered: false },
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

    describe.each(matrix)('$engine engine, $cache server cache', ({ engine, cache, numbered }) => {
      let mastra: Mastra;
      let durable: any;
      let cacheClient: ReturnType<typeof createClient> | undefined;
      let cleanupStorage: () => Promise<void>;
      let releaseTool: () => void;
      let toolStarted: Promise<void>;
      let warn: ReturnType<typeof vi.spyOn>;
      const notNumberedWarnings = () =>
        warn.mock.calls.filter(([message]) => String(message).includes('are not numbered'));

      /** Numbered frames resume exactly at the offset; unnumbered ones warn once and still close. */
      const expectResumed = (resumed: Frame[], expected: Frame[]) => {
        if (numbered) {
          expect(resumed).toEqual(expected);
          expect(notNumberedWarnings()).toHaveLength(0);
        } else {
          expect(notNumberedWarnings()).toHaveLength(1);
          expect(notNumberedWarnings()[0]![0]).toContain('RedisServerCache');
          expect(resumed.at(-1)?.type).toBe('finish');
        }
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

      it('resumes a live run after the offset without repeating earlier frames', async () => {
        const run = await durable.stream('Echo hi', { maxSteps: 5 });
        const callerFrames = collect(run.fullStream);
        await toolStarted;

        const offset = 3;
        const observation = await durable.observe(run.runId, { offset });
        const observed = collect(observation.fullStream);
        // Let the observer attach while the run is parked in the tool, then finish it.
        await new Promise(resolve => setTimeout(resolve, 500));
        releaseTool();

        const caller = await callerFrames;
        const resumed = await observed;

        expect(caller.length).toBeGreaterThan(offset);
        expectResumed(resumed, caller.slice(offset));
      });

      it('delivers nothing for an offset past the end of a finished run', async () => {
        releaseTool();
        const run = await durable.stream('Echo hi', { maxSteps: 5 });
        await collect(run.fullStream);

        expectResumed(await collect((await durable.observe(run.runId, { offset: 1_000 })).fullStream), []);
      });

      it('replays a finished run from a mid-run offset', async () => {
        releaseTool();
        const run = await durable.stream('Echo hi', { maxSteps: 5 });
        const caller = await collect(run.fullStream);

        const resumed = await collect((await durable.observe(run.runId, { offset: 3 })).fullStream);

        expectResumed(resumed, caller.slice(3));
      });
    });
  },
);
