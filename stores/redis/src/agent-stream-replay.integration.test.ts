/**
 * Replay of an agent run from a real Redis cache.
 *
 * A run resumed after an approval pushes its next step onto the same `steps`
 * array its first step-finish carried. Redis serializes each event when the
 * queued append runs, not when the loop publishes it, so without a snapshot
 * at publish time the stored history can contain the later state. These tests
 * replay through `Agent.observe()` and compare against what the caller saw
 * live, with appends landing immediately and held until after the resume.
 *
 * Requires the Redis container from docker-compose.yaml (port 6380).
 */
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { MastraLanguageModelV2Mock } from '@mastra/core/test-utils/llm-mock';
import { createTool } from '@mastra/core/tools';
import Redis from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { RedisServerCache } from './index';

const REDIS_URL = 'redis://:redis_password@localhost:6380';

type Chunk = { type: string; payload?: any };
type Observation = { fullStream: AsyncIterable<Chunk>; detach: () => void };

/** Holds list appends while `hold()` is on, like a slow network write. */
class HeldAppendRedisCache extends RedisServerCache {
  #held: Array<() => void> = [];
  #holding = false;

  hold() {
    this.#holding = true;
  }

  release() {
    this.#holding = false;
    for (const resume of this.#held.splice(0)) resume();
  }

  override async listPushIndexed(
    listKey: string,
    counterKey: string,
    value: Record<string, unknown>,
    ttlMs?: number,
  ): Promise<number> {
    if (this.#holding) await new Promise<void>(resolve => this.#held.push(resolve));
    return super.listPushIndexed(listKey, counterKey, value, ttlMs);
  }
}

function streamOf(parts: any[]) {
  return {
    stream: new ReadableStream({
      start(controller) {
        for (const part of parts) controller.enqueue(part);
        controller.close();
      },
    }),
  };
}

/** First call asks for the tool, second answers with text. */
function scriptedModel() {
  const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
  let call = 0;
  return new MastraLanguageModelV2Mock({
    doStream: async () => {
      call += 1;
      const head = [
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: `resp-${call}`, modelId: 'mock', timestamp: new Date(0) },
      ];
      if (call === 1) {
        return streamOf([
          ...head,
          {
            type: 'tool-call',
            toolCallId: 'call_approve',
            toolName: 'lookup_status',
            input: JSON.stringify({ query: 'alpha' }),
          },
          { type: 'finish', finishReason: 'tool-calls', usage },
        ]) as any;
      }
      return streamOf([
        ...head,
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'Approved and done.' },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage },
      ]) as any;
    },
  });
}

/** Step counts of each step-finish, read on arrival: the caller holds the loop's live objects. */
async function collectStepCounts(stream: AsyncIterable<Chunk>, until?: string) {
  const counts: number[] = [];
  for await (const chunk of stream) {
    if (chunk.type === 'step-finish') counts.push(chunk.payload?.output?.steps?.length);
    if (until && chunk.type === until) break;
  }
  return counts;
}

async function drain(observation: Observation, ms: number) {
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    observation.detach();
  }, ms);
  const chunks: Chunk[] = [];
  try {
    for await (const chunk of observation.fullStream) chunks.push(chunk);
  } finally {
    clearTimeout(timer);
    observation.detach();
  }
  return { chunks, timedOut };
}

describe('Agent stream replay from Redis', () => {
  let redis: Redis;

  beforeAll(async () => {
    redis = new Redis(REDIS_URL, { protocol: 2, maxRetriesPerRequest: 3 });
    await redis.ping();
  });

  afterAll(async () => {
    const keys = await redis.keys('agent-replay-test:*');
    if (keys.length) await redis.del(...keys);
    await redis.quit();
  });

  async function runApprovalAndReplay({ holdAppends }: { holdAppends: boolean }) {
    const cache = new HeldAppendRedisCache(
      { client: redis as any },
      { keyPrefix: 'agent-replay-test:', ttlSeconds: 60 },
    );
    const lookup = createTool({
      id: 'lookup_status',
      description: 'Look up a status.',
      execute: async (input: any) => ({ status: `OK:${input?.query}` }),
    });
    const agent = new Agent({
      id: 'redis-replay-agent',
      name: 'redis-replay-agent',
      instructions: 'Look things up.',
      model: scriptedModel() as any,
      tools: { lookup_status: lookup },
    });
    const mastra = new Mastra({
      agents: { agent },
      storage: new InMemoryStore(),
      cache,
      logger: false,
    });
    const registered = mastra.getAgent('agent');

    const run: any = await registered.stream('Look up alpha', { requireToolApproval: true, maxSteps: 5 });
    let resumed: any;
    try {
      const first = await collectStepCounts(run.fullStream, 'tool-call-approval');
      if (holdAppends) {
        cache.hold();
        await new Promise(resolve => setTimeout(resolve, 500));
      } else {
        // The first segment, suspension included, is in Redis before the resume.
        const before = await drain((await registered.observe(run.runId)) as Observation, 1_000);
        expect(before.chunks.map(chunk => chunk.type)).toContain('tool-call-approval');
      }

      resumed = await registered.approveToolCall({ runId: run.runId, toolCallId: 'call_approve' });
      const second = await collectStepCounts(resumed.fullStream);
      cache.release();

      const replay = await drain((await registered.observe(run.runId)) as Observation, 10_000);
      expect(replay.timedOut).toBe(false);
      const replayed = replay.chunks
        .filter(chunk => chunk.type === 'step-finish')
        .map(chunk => chunk.payload?.output?.steps?.length);
      return { live: [...first, ...second], replayed };
    } finally {
      cache.release();
      resumed?.cleanup?.();
      run.cleanup?.();
      await mastra.shutdown();
    }
  }

  it('replays step-finish payloads as the caller saw them', async () => {
    const { live, replayed } = await runApprovalAndReplay({ holdAppends: false });
    expect(live).toEqual([1, 2]);
    expect(replayed).toEqual(live);
  }, 30_000);

  it('replays step-finish payloads as published when the append lands after resume', async () => {
    const { live, replayed } = await runApprovalAndReplay({ holdAppends: true });
    expect(live).toEqual([1, 2]);
    expect(replayed).toEqual(live);
  }, 30_000);
});
