/**
 * A plain Agent run when its Redis server cache stops answering.
 *
 * Every registered plain Agent publishes its run on Redis, and starting a run
 * read the run's shared record from the server cache first. With the cache
 * frozen (a paused server: nothing answers and nothing fails), `stream()` waited
 * for the whole outage before the first chunk. A run must degrade instead:
 *
 * - a run on a generated id has no record to read, and streams to its caller
 * - a run on a caller-supplied id may collide with a run elsewhere, so its record
 *   is still checked, and it is refused within a bound rather than held
 * - events the frozen bus can't take pile up in the run's publish queue, which is
 *   capped: the replay that `observe()` reads ends with an incomplete marker
 *   rather than passing for the whole run
 *
 * Requires a Redis server at REDIS_URL; the model is served by AIMock. Redis is
 * reached through a proxy that freezes every connection, like `docker pause`.
 */
import { randomUUID } from 'node:crypto';

import { createOpenAI } from '@ai-sdk/openai-v5';
import { LLMock } from '@copilotkit/aimock';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { createTool } from '@mastra/core/tools';
import { LibSQLStore } from '@mastra/libsql';
import { createClient } from 'redis';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { nodeRedisPreset, RedisServerCache } from '../../../stores/redis/src/cache';
import { flushRedis, makeFreezingProxy, makeStorageDir, REDIS_URL } from '../test-fixtures/harness';
import { RedisStreamsPubSub } from './index';

/** Pending events the publisher holds before it leaves the rest of a run out of its replay. */
const MAX_PENDING_STREAM_EVENTS = 10_000;
/** How long a run on a caller-supplied id waits for its record before it is refused. */
const RUN_RECORD_ADMISSION_TIMEOUT_MS = 5_000;

type Settled<T> = { status: 'resolved'; value: T } | { status: 'rejected'; error: any } | { status: 'pending' };

/** How `promise` settles within `ms`, without waiting past it. */
async function settle<T>(promise: Promise<T>, ms: number): Promise<Settled<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise.then(
        value => ({ status: 'resolved' as const, value }),
        error => ({ status: 'rejected' as const, error }),
      ),
      new Promise<Settled<T>>(resolve => {
        timer = setTimeout(() => resolve({ status: 'pending' }), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

describe.skipIf(!process.env.REDIS_URL && !process.env.CI && process.env.SKIP_REDIS_TESTS === '1')(
  'plain Agent run with a frozen Redis server cache',
  () => {
    let llm: LLMock;

    beforeAll(async () => {
      llm = new LLMock({ port: 0 });
      await llm.start();
    });

    afterAll(async () => {
      await llm.stop();
    });

    let proxy: ReturnType<typeof makeFreezingProxy>;
    let proxyUrl: string;
    let keyPrefix: string;
    const cleanups: Array<() => Promise<unknown>> = [];
    let releaseTool: () => void = () => {};

    beforeEach(async () => {
      await flushRedis();
      keyPrefix = `agent-cache-outage-${randomUUID()}`;
      const upstream = new URL(REDIS_URL);
      proxy = makeFreezingProxy({ host: upstream.hostname, port: Number(upstream.port) || 6379 });
      proxyUrl = `redis://127.0.0.1:${await proxy.listening}`;
    });

    afterEach(async () => {
      releaseTool();
      proxy.thaw();
      for (const cleanup of cleanups.splice(0).reverse()) await cleanup().catch(() => {});
      await proxy.close();
      llm.clearFixtures();
      llm.reset?.();
    });

    /** A Mastra server whose run records and stream bus are on Redis, behind the proxy. */
    async function startServer(agentId = 'outage-agent') {
      const storage = await makeStorageDir('mastra-agent-cache-outage-');
      cleanups.push(storage.cleanup);
      const cacheClient = createClient({ url: proxyUrl });
      await cacheClient.connect();
      cleanups.push(() => cacheClient.quit());

      let toolGate = Promise.resolve();
      const wait = createTool({
        id: 'wait',
        description: 'Waits until released.',
        inputSchema: z.object({}),
        execute: async () => {
          await toolGate;
          return { ok: true };
        },
      });
      const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url.replace(/\/+$/, '')}/v1` });
      const agent = new Agent({
        id: agentId,
        name: 'Outage Agent',
        instructions: 'You are a test agent driven by scripted AIMock responses.',
        model: openai('gpt-4o-mini'),
        tools: { wait },
      });
      const mastra = new Mastra({
        logger: false,
        storage: new LibSQLStore({ id: 'agent-cache-outage-storage', url: storage.storageUrl }),
        pubsub: new RedisStreamsPubSub({ url: proxyUrl, keyPrefix, blockMs: 200 }),
        cache: new RedisServerCache(
          { client: cacheClient as any },
          { ...nodeRedisPreset, keyPrefix: `${keyPrefix}:cache` },
        ),
        agents: { outageAgent: agent },
      });
      cleanups.push(() => mastra.shutdown());
      return {
        agent: mastra.getAgent('outageAgent'),
        /** Hold the `wait` tool until the returned release is called. */
        holdTool() {
          toolGate = new Promise<void>(resolve => {
            releaseTool = resolve;
          });
        },
      };
    }

    /** Run once while Redis answers, so every client has connected before the freeze. */
    async function warmUp(agent: Agent) {
      llm.on({ endpoint: 'chat', userMessage: 'warm up' }, { content: 'Warm.' });
      const run = await agent.stream('warm up');
      expect(await run.text).toBe('Warm.');
      expect(await observeRun(agent, run.runId)).toEqual({ text: 'Warm.', error: undefined });
    }

    /** The text an observer replays for `runId`, and the error the replay ended with, if any. */
    async function observeRun(agent: Agent, runId: string) {
      const observation = await agent.observe(runId);
      let text = '';
      let error: (Error & { id?: string }) | undefined;
      for await (const chunk of observation.fullStream) {
        if (chunk.type === 'text-delta') text += chunk.payload.text;
        if (chunk.type === 'error') error = chunk.payload.error as Error & { id?: string };
      }
      return { text, error };
    }

    it('streams a run on a generated id to its caller while the cache is frozen', async () => {
      const { agent } = await startServer();
      await warmUp(agent);
      llm.on({ endpoint: 'chat', userMessage: 'during the outage' }, { content: 'Answered without Redis.' });

      proxy.freeze();
      const started = Date.now();
      const outcome = await settle(
        agent.stream('during the outage').then(async run => ({ runId: run.runId, text: await run.text })),
        RUN_RECORD_ADMISSION_TIMEOUT_MS + 3_000,
      );

      expect(outcome).toEqual({
        status: 'resolved',
        value: expect.objectContaining({ text: 'Answered without Redis.' }),
      });
      // Nothing waited on the cache: no admission timeout ran first.
      expect(Date.now() - started).toBeLessThan(RUN_RECORD_ADMISSION_TIMEOUT_MS);

      // Once Redis answers again, the run's queued events reach the replay.
      proxy.thaw();
      const replay = await observeRun(agent, (outcome as { value: { runId: string } }).value.runId);
      expect(replay).toEqual({ text: 'Answered without Redis.', error: undefined });
    }, 30_000);

    it('refuses a run on a caller-supplied id within a bound while the cache is frozen', async () => {
      const { agent } = await startServer();
      await warmUp(agent);
      llm.on({ endpoint: 'chat', userMessage: 'supplied id' }, { content: 'Should not run.' });

      proxy.freeze();
      const started = Date.now();
      const outcome = await settle(agent.stream('supplied id', { runId: `supplied-${randomUUID()}` }), 15_000);

      expect(outcome).toEqual({
        status: 'rejected',
        error: expect.objectContaining({ id: 'AGENT_RUN_RECORD_UNAVAILABLE' }),
      });
      expect(Date.now() - started).toBeLessThan(RUN_RECORD_ADMISSION_TIMEOUT_MS + 2_000);
    }, 30_000);

    it('ends the replay with an incomplete marker when the run outgrows the publish queue', async () => {
      const { agent } = await startServer();
      await warmUp(agent);
      // One text-delta per character: more events than the queue holds while Redis is frozen.
      const content = 'x'.repeat(MAX_PENDING_STREAM_EVENTS + 1_000);
      llm.on({ endpoint: 'chat', userMessage: 'long answer' }, { content }, { chunkSize: 1 });

      proxy.freeze();
      const run = await agent.stream('long answer');
      // The caller's own stream is not held by the frozen bus or cut short by the cap.
      expect(await run.text).toBe(content);

      proxy.thaw();
      const replay = await observeRun(agent, run.runId);
      expect(replay.error?.id).toBe('AGENT_STREAM_REPLAY_INCOMPLETE');
      expect(replay.text.length).toBeGreaterThan(0);
      expect(replay.text.length).toBeLessThan(content.length);
      expect(content.startsWith(replay.text)).toBe(true);
    }, 60_000);

    describe('while Redis answers', () => {
      it('replays a whole run on a generated id, with no marker', async () => {
        const { agent } = await startServer();
        const content = 'y'.repeat(2_000);
        llm.on({ endpoint: 'chat', userMessage: 'healthy answer' }, { content }, { chunkSize: 1 });

        const run = await agent.stream('healthy answer');
        expect(await run.text).toBe(content);
        expect(await observeRun(agent, run.runId)).toEqual({ text: content, error: undefined });
      }, 30_000);

      it('runs a fresh caller-supplied id, and refuses it on another server while that run is going', async () => {
        const owner = await startServer();
        const other = await startServer();
        const runId = `shared-${randomUUID()}`;
        llm.on(
          { endpoint: 'chat', userMessage: 'collide', hasToolResult: false },
          { toolCalls: [{ id: 'call_wait', name: 'wait', arguments: {} }] },
        );
        llm.on({ endpoint: 'chat', userMessage: 'collide', hasToolResult: true }, { content: 'Owner done.' });

        owner.holdTool();
        const run = await owner.agent.stream('collide', { runId });
        // Wait until the run is in its tool call, so its record says it is running.
        const reader = run.fullStream.getReader();
        for (;;) {
          const { value, done } = await reader.read();
          if (done || value.type === 'tool-call') break;
        }

        const started = Date.now();
        const outcome = await settle(other.agent.stream('collide', { runId }), 10_000);
        expect(outcome).toEqual({
          status: 'rejected',
          error: expect.objectContaining({ id: 'AGENT_RUN_ID_ALREADY_CLAIMED' }),
        });
        expect(Date.now() - started).toBeLessThan(RUN_RECORD_ADMISSION_TIMEOUT_MS);

        releaseTool();
        reader.releaseLock();
        expect(await run.text).toBe('Owner done.');
      }, 30_000);
    });
  },
);
