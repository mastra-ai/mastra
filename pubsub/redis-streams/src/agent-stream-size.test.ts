/**
 * What a plain Agent run leaves in Redis on its stream topic.
 *
 * A registered Agent publishes every run on `agent.stream.<runId>` so it can be
 * observed and resumed. Redis keeps that log (in the stream key and, with a
 * Redis server cache, in the replay list) until the run is cleaned up. Each
 * step used to repeat the whole prompt and every earlier step, so one long run
 * took hundreds of MB to GBs. The log must hold the prompt once, and an
 * observer must still replay the run.
 *
 * Requires a Redis server at REDIS_URL; the model is served by AIMock.
 */
import { randomUUID } from 'node:crypto';

import { createOpenAI } from '@ai-sdk/openai-v5';
import { LLMock } from '@copilotkit/aimock';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { createTool } from '@mastra/core/tools';
import { LibSQLStore } from '@mastra/libsql';
import { createClient } from 'redis';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { nodeRedisPreset, RedisServerCache } from '../../../stores/redis/src/cache';
import { flushRedis, makeStorageDir, REDIS_URL } from '../test-fixtures/harness';
import { RedisStreamsPubSub } from './index';

const PROMPT_MARKER = 'PROMPT-MARKER-c41e';
const TOOL_STEPS = 6;
/** Appended to every tool result; the growth test makes results large. */
let resultPadding = '';

describe.skipIf(!process.env.REDIS_URL && !process.env.CI && process.env.SKIP_REDIS_TESTS === '1')(
  'plain Agent run log size on Redis',
  () => {
    let llm: LLMock;

    beforeAll(async () => {
      llm = new LLMock({ port: 0 });
      await llm.start();
    });

    afterAll(async () => {
      await llm.stop();
    });

    describe.each(['default', 'redis'] as const)('%s server cache', cache => {
      let mastra: Mastra;
      let redis: ReturnType<typeof createClient>;
      let cacheClient: ReturnType<typeof createClient> | undefined;
      let cleanupStorage: () => Promise<void>;

      beforeEach(async () => {
        await flushRedis();
        const storage = await makeStorageDir('mastra-agent-stream-size-');
        cleanupStorage = storage.cleanup;
        const keyPrefix = `agent-stream-size-${randomUUID()}`;
        redis = createClient({ url: REDIS_URL });
        await redis.connect();

        const lookup = createTool({
          id: 'lookup',
          description: 'Look something up.',
          inputSchema: z.object({ q: z.string() }),
          execute: async ({ q }) => ({ value: `RESULT-${q}${resultPadding}` }),
        });
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_0', name: 'lookup', arguments: { q: '0' } }] },
        );
        for (let i = 1; i < TOOL_STEPS; i++) {
          llm.on(
            { endpoint: 'chat', toolCallId: `call_${i - 1}`, hasToolResult: true },
            { toolCalls: [{ id: `call_${i}`, name: 'lookup', arguments: { q: String(i) } }] },
          );
        }
        llm.on(
          { endpoint: 'chat', toolCallId: `call_${TOOL_STEPS - 1}`, hasToolResult: true },
          { content: 'All done.' },
        );

        const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url.replace(/\/+$/, '')}/v1` });
        const agent = new Agent({
          id: 'size-agent',
          name: 'Size Agent',
          instructions: 'You are a test agent driven by scripted AIMock responses.',
          model: openai('gpt-4o-mini'),
          tools: { lookup },
        });

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
          storage: new LibSQLStore({ id: 'agent-stream-size-storage', url: storage.storageUrl }),
          pubsub: new RedisStreamsPubSub({ url: REDIS_URL, keyPrefix, blockMs: 200 }),
          ...(serverCache ? { cache: serverCache } : {}),
          agents: { sizeAgent: agent },
        });
      });

      afterEach(async () => {
        llm.clearFixtures?.();
        llm.reset?.();
        await mastra?.shutdown?.().catch(() => {});
        await cacheClient?.quit().catch(() => {});
        cacheClient = undefined;
        await redis?.quit().catch(() => {});
        await cleanupStorage?.();
        resultPadding = '';
      });

      /** Waits for the run's finish event, then reports the Redis memory its stream log takes. */
      async function storedRunBytes(runId: string): Promise<number> {
        // The stream key and, with a Redis cache, the replay list are appended separately: wait
        // until each holds the finish event, so both runs are measured complete.
        const logKeys = cache === 'redis' ? 2 : 1;
        let keys: string[] = [];
        await vi.waitFor(async () => {
          keys = [];
          for (const key of await redis.keys(`*agent.stream.${runId}*`)) {
            const type = await redis.type(key);
            if (type !== 'stream' && type !== 'list') continue;
            const entries =
              type === 'stream'
                ? (await redis.xRange(key, '-', '+')).map(entry => JSON.stringify(entry.message))
                : await redis.lRange(key, 0, -1);
            expect(entries.join('\n')).toMatch(/\\?"type\\?":\\?"finish\\?"/);
            keys.push(key);
          }
          expect(keys).toHaveLength(logKeys);
        });
        let bytes = 0;
        for (const key of keys) bytes += Number((await redis.memoryUsage(key, { SAMPLES: 0 })) ?? 0);
        return bytes;
      }

      /** Everything Redis holds for the run's stream topic, as stored. */
      async function storedRunLog(runId: string): Promise<string> {
        const keys = await redis.keys(`*agent.stream.${runId}*`);
        expect(keys.length).toBeGreaterThan(0);
        const parts: string[] = [];
        for (const key of keys) {
          const type = await redis.type(key);
          if (type === 'stream') {
            for (const entry of await redis.xRange(key, '-', '+')) parts.push(JSON.stringify(entry.message));
          } else if (type === 'list') {
            parts.push(...(await redis.lRange(key, 0, -1)));
          }
        }
        return parts.join('\n');
      }

      it('stores the prompt once and still replays the run to an observer', async () => {
        const agent = mastra.getAgent('sizeAgent');
        const run = await agent.stream(`${PROMPT_MARKER} ${'Look this up carefully. '.repeat(400)}`, {
          maxSteps: 10,
        });
        await run.consumeStream();
        expect(await run.text).toBe('All done.');

        // The publisher appends after the caller's stream ends; wait for the run's finish event.
        let log = '';
        await vi.waitFor(async () => {
          log = await storedRunLog(run.runId);
          expect(log).toMatch(/\\?"type\\?":\\?"finish\\?"/);
        });
        // The finish event carries the conversation once (`messages.all` and `messages.user`); the
        // stream key and the replay list each keep a copy of the log.
        const copies = cache === 'redis' ? 2 : 1;
        expect(log.split(PROMPT_MARKER).length - 1).toBeLessThanOrEqual(2 * copies);
        // Each step-finish sends only the response messages that changed, so the first tool result
        // is stored about as often as the last one: once more per whole list resent in between, which
        // a run this short does at most once (it was once per step).
        const first = log.split('RESULT-0').length - 1;
        const last = log.split(`RESULT-${TOOL_STEPS - 1}`).length - 1;
        expect(first - last).toBeLessThanOrEqual(copies);

        const observed: any[] = [];
        const observation = await agent.observe(run.runId, { onStepFinish: step => void observed.push(step) });
        const replayed: string[] = [];
        for await (const chunk of observation.fullStream) {
          if (chunk.type === 'text-delta') replayed.push(chunk.payload.text);
        }
        expect(replayed.join('')).toBe('All done.');
        expect(observed).toHaveLength(TOOL_STEPS + 1);
        expect(JSON.stringify(observed[3].content)).toContain('RESULT-3');
      });

      // Technical: each step-finish used to repeat the run's prompt and response messages so far, so
      // a run's log grew with the square (or cube) of its steps. Production runs of a few dozen steps
      // took GBs; this run shape (30 KB prompt, 20 KB tool results) took 1.25 GB at 40 steps.
      it('keeps a run log proportional to its steps', async () => {
        llm.clearFixtures?.();
        resultPadding = 'r'.repeat(20_000);
        const agent = mastra.getAgent('sizeAgent');

        const runBytes = async (label: string, steps: number) => {
          const id = (i: number) => `${label}_${i}`;
          llm.on(
            {
              endpoint: 'chat',
              predicate: (req: any) =>
                !req.messages.some((m: any) => m.role === 'tool') && JSON.stringify(req.messages).includes(label),
            },
            { toolCalls: [{ id: id(0), name: 'lookup', arguments: { q: '0' } }] },
          );
          for (let i = 1; i < steps - 1; i++) {
            llm.on(
              { endpoint: 'chat', toolCallId: id(i - 1), hasToolResult: true },
              { toolCalls: [{ id: id(i), name: 'lookup', arguments: { q: String(i) } }] },
            );
          }
          llm.on({ endpoint: 'chat', toolCallId: id(steps - 2), hasToolResult: true }, { content: 'All done.' });
          const run = await agent.stream(`${label} ${'Look this up carefully. '.repeat(1_250)}`, {
            maxSteps: steps + 2,
          });
          await run.consumeStream();
          expect((await run.steps).length).toBe(steps);
          return storedRunBytes(run.runId);
        };

        const short = await runBytes('RUN-SHORT', 10);
        const long = await runBytes('RUN-LONG', 20);
        // Twice the steps take about twice the memory (it was about 7x on main, and about 3x when
        // every step-finish still repeated the response messages so far).
        expect(long / short).toBeLessThan(2.5);
        expect(long).toBeLessThan(8 * 1024 * 1024);
      }, 120_000);
    });
  },
);
