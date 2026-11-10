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
          execute: async ({ q }) => ({ value: `RESULT-${q}` }),
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
      });

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
        // is stored no more often than the last one.
        expect(log.split('RESULT-0').length).toBe(log.split(`RESULT-${TOOL_STEPS - 1}`).length);

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
    });
  },
);
