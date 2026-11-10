/**
 * AIMock Scenario: replay shows each event as it was published
 *
 * The loop keeps mutating objects after it emits them: a run resumed after an
 * approval pushes its next step onto the same `steps` array the first
 * step-finish carried. Replay through `Agent.observe()` must show what live
 * readers saw when each event was published, including when the cache append
 * lands after the run has already moved on.
 *
 * Durable and evented runs publish a different step-finish payload (no
 * `output.steps`) and wait on the cache append, so they are not covered here.
 */
import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { InMemoryServerCache } from '../../../../cache/inmemory';
import { createTool } from '../../../../tools';
import { createSharedAgent, describeForAllEngines, useLoopScenarioAimock } from '../aimock-scenario';

type Chunk = { type: string; payload?: any };
type Observation = { fullStream: AsyncIterable<Chunk>; detach: () => void };

/** Holds every list append until `release()`, like a slow remote cache. */
class HeldAppendCache extends InMemoryServerCache {
  #held: Array<() => void> = [];
  #holding = true;

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

/**
 * Step counts of each step-finish, read when the chunk arrives: the caller's
 * stream hands out the loop's live objects, so reading later would show the
 * mutated state.
 */
async function collectStepCounts(stream: AsyncIterable<Chunk>, until?: string) {
  const counts: number[] = [];
  let stoppedAt: Chunk | undefined;
  for await (const chunk of stream) {
    if (chunk.type === 'step-finish') counts.push(chunk.payload?.output?.steps?.length);
    if (until && chunk.type === until) {
      stoppedAt = chunk;
      break;
    }
  }
  return { counts, stoppedAt };
}

describeForAllEngines(
  'AIMock loop scenario: replay snapshots published events',
  engine => {
    const getMock = useLoopScenarioAimock();

    async function runApprovalAndReplay(cache?: HeldAppendCache) {
      const llm = getMock();
      llm.on(
        { endpoint: 'chat', hasToolResult: false },
        { toolCalls: [{ id: 'call_approve', name: 'lookup_status', arguments: { query: 'alpha' } }] },
      );
      llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Approved and done.' });
      const lookup = createTool({
        id: 'lookup_status',
        description: 'Look up a status.',
        inputSchema: z.object({ query: z.string() }),
        execute: async ({ query }) => ({ status: `OK:${query}` }),
      });
      const { agent, mastra } = await createSharedAgent(llm, {
        engine,
        tools: { lookup_status: lookup },
        ...(cache ? { cache } : {}),
      });

      const run: any = await agent.stream('Look up alpha', { requireToolApproval: true, maxSteps: 5 });
      let resumed: any;
      try {
        const first = await collectStepCounts(run.fullStream, 'tool-call-approval');
        expect(first.stoppedAt?.payload?.toolCallId).toBe('call_approve');
        // Let the suspension settle before resuming.
        await new Promise(resolve => setTimeout(resolve, 300));

        resumed = await agent.approveToolCall({ runId: run.runId, toolCallId: 'call_approve' });
        const second = await collectStepCounts(resumed.fullStream);
        cache?.release();

        const replay = await drain((await agent.observe(run.runId)) as Observation, 10_000);
        expect(replay.timedOut).toBe(false);
        const replayCounts = replay.chunks
          .filter(chunk => chunk.type === 'step-finish')
          .map(chunk => chunk.payload?.output?.steps?.length);
        return { live: [...first.counts, ...second.counts], replay: replayCounts };
      } finally {
        cache?.release();
        resumed?.cleanup?.();
        run.cleanup?.();
        await mastra.shutdown();
      }
    }

    it('replays step-finish payloads as they were published', async () => {
      const { live, replay } = await runApprovalAndReplay();
      expect(live).toEqual([1, 2]);
      expect(replay).toEqual(live);
    }, 30_000);

    it('replays published payloads even when the cache append lands after resume', async () => {
      const { live, replay } = await runApprovalAndReplay(new HeldAppendCache());
      expect(live).toEqual([1, 2]);
      expect(replay).toEqual(live);
    }, 30_000);
  },
  { skip: ['durable', 'evented'] },
);
