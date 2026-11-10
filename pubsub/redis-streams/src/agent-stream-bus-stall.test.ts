/**
 * COR-1519 cell 2: a slow or stalled run-stream bus. Real Redis is stalled with
 * `CLIENT PAUSE <ms> ALL` while an Agent (plain) or DurableAgent streams through
 * the public `agent.stream()` / `agent.observe()` API.
 *
 * - Plain agents publish fire-and-forget, so with an in-memory server cache the
 *   caller must not wait on the stall; with a Redis server cache the run-record
 *   writes on the caller's path wait it out. Observers must get every frame, in
 *   order, once Redis resumes.
 * - DurableAgent callers read their frames back from the bus, so the caller is
 *   expected to wait out the stall, but must then finish with every frame.
 *
 * Runs with both the default in-memory server cache and a Redis server cache
 * (which the pause stalls too). Requires a Redis server at REDIS_URL; the model
 * is served by AIMock.
 */
import { randomUUID } from 'node:crypto';

import { createOpenAI } from '@ai-sdk/openai-v5';
import { LLMock } from '@copilotkit/aimock';
import { Agent } from '@mastra/core/agent';
import { createDurableAgent } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { createClient } from 'redis';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { nodeRedisPreset, RedisServerCache } from '../../../stores/redis/src/cache';
import { flushRedis, REDIS_URL } from '../test-fixtures/harness';
import { RedisStreamsPubSub } from './index';

const REPLY = Array.from({ length: 40 }, (_, i) => `word${i}`).join(' ');

type Read = { types: string[]; text: string; ms: number };

async function read(stream: AsyncIterable<any>, startedAt: number, timeoutMs: number): Promise<Read> {
  const types: string[] = [];
  let text = '';
  const drain = (async () => {
    for await (const chunk of stream) {
      types.push(chunk.type);
      if (chunk.type === 'text-delta') text += chunk.payload?.text ?? '';
    }
  })();
  await Promise.race([
    drain,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`stream did not close: ${JSON.stringify(types)}`)), timeoutMs),
    ),
  ]);
  return { types, text, ms: Date.now() - startedAt };
}

const matrix = [
  { engine: 'plain', cache: 'default' },
  { engine: 'plain', cache: 'redis' },
  { engine: 'durable', cache: 'default' },
  { engine: 'durable', cache: 'redis' },
] as const;

describe('agent run-stream bus stalled by CLIENT PAUSE (COR-1519)', () => {
  let llm: LLMock;
  let admin: ReturnType<typeof createClient>;

  beforeAll(async () => {
    llm = new LLMock({ port: 0 });
    llm.on({ endpoint: 'chat' }, { content: REPLY });
    await llm.start();
    admin = createClient({ url: REDIS_URL });
    await admin.connect();
  });

  afterAll(async () => {
    await admin.sendCommand(['CLIENT', 'UNPAUSE']).catch(() => {});
    await admin.quit();
    await llm.stop();
  });

  describe.each(matrix)('$engine agent, $cache server cache', ({ engine, cache }) => {
    let mastra: Mastra;
    let agent: any;
    let pubsub: RedisStreamsPubSub;
    let cacheClient: ReturnType<typeof createClient> | undefined;

    beforeEach(async () => {
      await flushRedis();
      const keyPrefix = `bus-stall-${randomUUID()}`;
      const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url.replace(/\/+$/, '')}/v1` });
      const base = new Agent({
        id: 'stall-agent',
        name: 'Stall Agent',
        instructions: 'You are a test agent driven by scripted AIMock responses.',
        model: openai('gpt-4o-mini'),
      });
      pubsub = new RedisStreamsPubSub({ url: REDIS_URL, keyPrefix, blockMs: 200 });
      let serverCache: RedisServerCache | undefined;
      if (cache === 'redis') {
        cacheClient = createClient({ url: REDIS_URL });
        await cacheClient.connect();
        serverCache = new RedisServerCache(
          { client: cacheClient as any },
          { ...nodeRedisPreset, keyPrefix: `${keyPrefix}:cache:` },
        );
      }
      mastra = new Mastra({
        logger: false,
        pubsub,
        ...(serverCache ? { cache: serverCache } : {}),
        agents: { 'stall-agent': engine === 'durable' ? createDurableAgent({ agent: base }) : base },
      });
      agent = mastra.getAgent('stall-agent' as any);
    });

    afterEach(async () => {
      await admin.sendCommand(['CLIENT', 'UNPAUSE']).catch(() => {});
      await pubsub.close?.();
      await cacheClient?.quit();
      cacheClient = undefined;
    });

    /** Unstalled reference run: what the caller and a replaying observer see. */
    async function baseline() {
      const started = Date.now();
      const run = await agent.stream('Say the words.');
      const caller = await read(run.fullStream, started, 15_000);
      const replay = await read((await agent.observe(run.runId)).fullStream, Date.now(), 15_000);
      return { caller, replay };
    }

    it('caller and observers keep every frame through a 3s stall', async () => {
      const reference = await baseline();
      expect(reference.caller.text).toBe(REPLY);
      expect(reference.replay.text).toBe(REPLY);

      const PAUSE_MS = 3_000;
      await admin.sendCommand(['CLIENT', 'PAUSE', String(PAUSE_MS), 'ALL']);
      const started = Date.now();
      const run = await agent.stream('Say the words.');
      const streamReturnedMs = Date.now() - started;
      const callerRead = read(run.fullStream, started, PAUSE_MS + 20_000);
      // An observer that attaches during the stall.
      const liveObserve = agent.observe(run.runId).then((o: any) => read(o.fullStream, started, PAUSE_MS + 20_000));
      const caller = await callerRead;
      const live = await liveObserve;
      const replay = await read((await agent.observe(run.runId)).fullStream, Date.now(), 15_000);

      console.info(
        `[COR-1519 stall] ${engine}/${cache}: stream() returned ${streamReturnedMs}ms, caller closed ${caller.ms}ms, ` +
          `live observer closed ${live.ms}ms, replay ${replay.ms}ms (pause ${PAUSE_MS}ms); ` +
          `frames caller=${caller.types.length} live=${live.types.length} replay=${replay.types.length} ` +
          `reference=${reference.caller.types.length}/${reference.replay.types.length}`,
      );

      expect(caller.text).toBe(REPLY);
      expect(caller.types).toEqual(reference.caller.types);
      expect(live.text).toBe(REPLY);
      expect(replay.text).toBe(REPLY);
      expect(replay.types).toEqual(reference.replay.types);
      expect(live.types).toEqual(reference.replay.types);
      if (engine === 'plain' && cache === 'default') {
        // Fire-and-forget publishing: nothing on the caller's path touches Redis.
        expect(caller.ms).toBeLessThan(PAUSE_MS);
      } else {
        expect(caller.ms).toBeLessThan(PAUSE_MS + 10_000);
      }
    });

    it('a stall longer than the 5s connect timeout on a cold bus either waits it out or fails the run with an error frame', async () => {
      const PAUSE_MS = 7_000;
      await admin.sendCommand(['CLIENT', 'PAUSE', String(PAUSE_MS), 'ALL']);
      const started = Date.now();
      const outcome: Record<string, string> = {};
      let runId: string | undefined;
      try {
        const run = await agent.stream('Say the words.');
        runId = run.runId;
        const caller = await read(run.fullStream, started, PAUSE_MS + 20_000);
        outcome.caller = `closed ${caller.ms}ms text=${caller.text === REPLY ? 'full' : JSON.stringify(caller.text)} tail=${caller.types.slice(-2)}`;
      } catch (error) {
        outcome.caller = `threw ${Date.now() - started}ms: ${(error as Error).message}`;
      }
      await new Promise(r => setTimeout(r, Math.max(0, PAUSE_MS - (Date.now() - started)) + 500));
      if (runId) {
        try {
          const replay = await read((await agent.observe(runId)).fullStream, Date.now(), 15_000);
          outcome.replay = `text=${replay.text === REPLY ? 'full' : JSON.stringify(replay.text)} tail=${replay.types.slice(-2)}`;
        } catch (error) {
          outcome.replay = `threw: ${(error as Error).message}`;
        }
      }
      // A run after the stall on the same Mastra instance must work.
      const after = await baseline();
      outcome.after = `caller=${after.caller.text === REPLY} replay=${after.replay.text === REPLY}`;
      console.info(`[COR-1519 cold stall] ${engine}/${cache}: ${JSON.stringify(outcome)}`);
      if (engine === 'durable' && cache === 'default') {
        // The durable caller first subscribes on the cold bus: the connect timeout
        // (socket.connectTimeout, 5s) fails the run, and the error is replayable.
        expect(outcome.caller).toMatch(/^threw .*did not connect to Redis within 5000ms/);
        expect(outcome.replay).toBe('text="" tail=error');
      } else {
        expect(outcome.caller).toMatch(/text=full tail=step-finish,finish$/);
        expect(outcome.replay).toBe('text=full tail=step-finish,finish');
      }
      expect(after.caller.text).toBe(REPLY);
      expect(after.replay.text).toBe(REPLY);
    }, 60_000);

    it('read-back survives a stall longer than the 10s event-delivery wait on a connected bus', async () => {
      await baseline();
      const PAUSE_MS = 12_000;
      await admin.sendCommand(['CLIENT', 'PAUSE', String(PAUSE_MS), 'ALL']);
      const started = Date.now();
      const run = await agent.stream('Say the words.');
      const caller = await read(run.fullStream, started, PAUSE_MS + 30_000);
      const replay = await read((await agent.observe(run.runId)).fullStream, Date.now(), 15_000);
      console.info(
        `[COR-1519 long stall] ${engine}/${cache}: caller closed ${caller.ms}ms (pause ${PAUSE_MS}ms), ` +
          `frames caller=${caller.types.length} replay=${replay.types.length}; caller tail=${caller.types.slice(-3)}`,
      );
      expect(caller.text).toBe(REPLY);
      expect(caller.types.at(-1)).toBe('finish');
      expect(replay.text).toBe(REPLY);
      expect(replay.types.at(-1)).toBe('finish');
    }, 90_000);
  });
});
