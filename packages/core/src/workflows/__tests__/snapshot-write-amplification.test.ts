/**
 * Snapshot write amplification for durable agent runs (issue #20747).
 *
 * The persisted snapshot is cumulative: `persistStepUpdate` rebuilds
 * `WorkflowRunState` from the whole `stepResults` map on every write
 * (`workflows/handlers/entry.ts`), and every storage adapter rewrites the whole
 * value — Postgres does `ON CONFLICT DO UPDATE SET snapshot = $4` over a full
 * JSON column, Upstash does a Lua `GET` + `SET` of the whole record. There is
 * no delta contract.
 *
 * That is affordable for the plain agentic loop, which gates
 * `shouldPersistSnapshot` to `pending | paused | suspended` and so writes about
 * twice per run. The durable loop deliberately also persists `running` on every
 * step, so `recoverActiveRuns()` can find in-flight runs after a crash
 * (issue #19056) — which means N writes of an O(N)-sized snapshot, i.e. O(N^2)
 * total bytes. A 57-step run reported 135 MB on disk for a ~300 kB
 * conversation, and 231 s wall clock against 53 s for the same run in plain
 * mode.
 *
 * This test pins the *shape of the growth curve* rather than absolute byte
 * counts, which would be brittle against unrelated payload changes. Doubling
 * the step count must not quadruple the bytes written.
 *
 * It also compares storage v1 (whole snapshots, pruned) with storage v2 (step
 * entries and state patches, not pruned) for the same runs.
 */

import type { LanguageModelV2StreamPart } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Agent } from '../../agent/agent';
import { createDurableAgent } from '../../agent/durable/create-durable-agent';
import { DurableAgent } from '../../agent/durable/durable-agent';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import type * as StatePatchModule from '../../storage/domains/workflows/state-patch';
import type { StatePatchOp } from '../../storage/domains/workflows/state-patch';
import { createTool } from '../../tools';

// Time spent diffing a v2 run's state against its last write.
const diffTiming = vi.hoisted(() => ({ calls: 0, totalMs: 0, maxMs: 0 }));

vi.mock('../../storage/domains/workflows/state-patch', async importOriginal => {
  const actual = await importOriginal<typeof StatePatchModule>();
  return {
    ...actual,
    diffState: (prev: unknown, next: unknown) => {
      const start = performance.now();
      const ops = actual.diffState(prev, next);
      const ms = performance.now() - start;
      diffTiming.calls += 1;
      diffTiming.totalMs += ms;
      diffTiming.maxMs = Math.max(diffTiming.maxMs, ms);
      return ops;
    },
  };
});

/**
 * Mock model that drives `toolIterations` sequential tool calls before
 * finishing with text — each iteration is one persisted step in the durable
 * loop. Like a real provider, it echoes the request it was sent (the whole
 * prompt plus every tool schema), so the echo grows with the conversation.
 */
function createLoopingModel(toolIterations: number, toolName: string) {
  let callCount = 0;
  return new MockLanguageModelV2({
    doStream: async ({ prompt, tools }) => {
      callCount += 1;
      const stream =
        callCount <= toolIterations
          ? convertArrayToReadableStream<LanguageModelV2StreamPart>([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: `id-${callCount}`, modelId: 'mock-model-id', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallId: `call-${callCount}`,
                toolName,
                input: JSON.stringify({ index: callCount }),
                providerExecuted: false,
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              },
            ])
          : convertArrayToReadableStream<LanguageModelV2StreamPart>([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: `id-${callCount}`, modelId: 'mock-model-id', timestamp: new Date(0) },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'done' },
              { type: 'text-end', id: 'text-1' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              },
            ]);
      return {
        stream,
        request: { body: JSON.stringify({ prompt, tools }) },
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  });
}

/**
 * How the run persists: `'auto'` turns crash recovery on, so every step
 * boundary is written while the run is `running`. `'suspend-only'` leaves it
 * off and gates every tool call on approval, so the run is written each time
 * it suspends.
 */
type Recovery = 'auto' | 'suspend-only';

interface RunConfig {
  storageVersion: 1 | 2;
  recovery: Recovery;
}

interface WriteStats {
  /** Number of storage writes made during the run, of every kind. */
  writes: number;
  /** Writes that went to the v2 methods (entries, checkpoints, header updates). */
  v2Writes: number;
  /** Sum of serialized write sizes across every write. */
  totalBytes: number;
  /** Largest single serialized write. */
  peakBytes: number;
  /** Number of writes made with status `running` (the durable per-step writes). */
  runningWrites: number;
  /** Largest single serialized `running` write. */
  runningPeakBytes: number;
  /**
   * Most copies of one early tool result found inside a single write. This is
   * the duplication factor: how many times one piece of conversation is
   * re-serialized per write.
   */
  maxDuplicatesPerWrite: number;
  /** Most step records (`accumulatedSteps` entries) sent in a single write. */
  maxStepRecordsPerWrite: number;
  /** State diffs made by v2 writes, their total time and the slowest one. */
  diffCalls: number;
  diffMs: number;
  maxDiffMs: number;
  /** Wall-clock time of the whole run. */
  wallMs: number;
}

/** Step records in `value`, counted wherever an `accumulatedSteps` array sits in it. */
function countStepRecords(value: unknown): number {
  if (Array.isArray(value)) return value.reduce((sum: number, item) => sum + countStepRecords(item), 0);
  if (typeof value !== 'object' || value === null) return 0;
  let count = 0;
  for (const [key, child] of Object.entries(value)) {
    count += key === 'accumulatedSteps' && Array.isArray(child) ? child.length : countStepRecords(child);
  }
  return count;
}

/** Step records a state patch sets: whole `accumulatedSteps` arrays, or the records it adds or changes. */
function countPatchedStepRecords(ops: StatePatchOp[] | undefined): number {
  let count = 0;
  const touched = new Set<string>();
  for (const op of ops ?? []) {
    const at = op.path.indexOf('accumulatedSteps');
    if (at === -1) {
      if (op.op === 'set') count += countStepRecords(op.value);
    } else if (op.path.length === at + 1) {
      if (op.op === 'set') count += countStepRecords({ accumulatedSteps: op.value });
    } else {
      touched.add(JSON.stringify(op.path.slice(0, at + 2)));
    }
  }
  return count + touched.size;
}

/**
 * Runs a durable agent for `toolIterations` tool steps and records what the
 * storage layer was actually asked to write.
 */
async function measureRun(
  toolIterations: number,
  { storageVersion = 1, recovery = 'auto' }: Partial<RunConfig> = {},
): Promise<WriteStats> {
  // Each tool result carries a realistic payload so snapshot growth tracks
  // accumulated conversation rather than bookkeeping noise.
  const filler = 'x'.repeat(2000);

  const echoTool = createTool({
    id: 'echoTool',
    description: 'Echoes a payload back',
    inputSchema: z.object({ index: z.number() }),
    requireApproval: recovery === 'suspend-only',
    execute: async ({ index }: { index: number }) => ({ index, payload: `result ${index}: ${filler}` }),
  });

  const baseAgent = new Agent({
    id: 'amplification-agent',
    name: 'Amplification Agent',
    instructions: 'Call the echo tool repeatedly.',
    model: createLoopingModel(toolIterations, 'echoTool') as any,
    tools: { echoTool },
  });

  // The agent picks the storage version for its new runs.
  const journal = vi
    .spyOn(DurableAgent.prototype as any, 'storesRunsInJournal', 'get')
    .mockReturnValue(storageVersion === 2);
  try {
    const durableAgent = createDurableAgent({ agent: baseAgent });
    const store = new InMemoryStore();
    const mastra = new Mastra({
      agents: { 'amplification-agent': durableAgent as any },
      logger: false,
      storage: store,
      // `running` checkpoints are only persisted when crash recovery is enabled
      // (issue #23915).
      ...(recovery === 'auto' ? { recovery: { durableAgents: 'auto' as const } } : {}),
    });

    const workflowsStore = (await mastra.getStorage()!.getStore('workflows'))! as any;
    const stats: WriteStats = {
      writes: 0,
      v2Writes: 0,
      totalBytes: 0,
      peakBytes: 0,
      runningWrites: 0,
      runningPeakBytes: 0,
      maxDuplicatesPerWrite: 0,
      maxStepRecordsPerWrite: 0,
      diffCalls: 0,
      diffMs: 0,
      maxDiffMs: 0,
      wallMs: 0,
    };
    // A marker unique to the first tool result, so it exists for every run length
    // and its copy count is directly comparable across them.
    const marker = `result 1: ${filler}`;
    const record = (write: { serialized: string; status?: string; stepRecords: number; v2: boolean }) => {
      const bytes = write.serialized.length;
      stats.writes += 1;
      if (write.v2) stats.v2Writes += 1;
      stats.totalBytes += bytes;
      stats.peakBytes = Math.max(stats.peakBytes, bytes);
      stats.maxDuplicatesPerWrite = Math.max(stats.maxDuplicatesPerWrite, write.serialized.split(marker).length - 1);
      stats.maxStepRecordsPerWrite = Math.max(stats.maxStepRecordsPerWrite, write.stepRecords);
      if (write.status === 'running') {
        stats.runningWrites += 1;
        stats.runningPeakBytes = Math.max(stats.runningPeakBytes, bytes);
      }
    };
    const wrap = (method: string, describeWrite: (args: any) => Parameters<typeof record>[0]) => {
      const original = workflowsStore[method].bind(workflowsStore);
      workflowsStore[method] = async (args: any) => {
        record(describeWrite(args));
        return original(args);
      };
    };
    wrap('persistWorkflowSnapshot', args => ({
      serialized: JSON.stringify(args.snapshot ?? {}),
      status: args.snapshot?.status,
      stepRecords: countStepRecords(args.snapshot),
      v2: false,
    }));
    wrap('updateWorkflowState', args => ({
      serialized: JSON.stringify(args.opts ?? {}),
      status: args.opts?.status,
      stepRecords: 0,
      v2: false,
    }));
    for (const method of ['appendWorkflowRunEntries', 'writeWorkflowRunCheckpoint']) {
      wrap(method, args => ({
        serialized: JSON.stringify({
          header: args.header,
          steps: args.steps,
          state: args.state,
          patch: args.statePatch,
        }),
        status: args.header?.status,
        stepRecords:
          countStepRecords({ steps: args.steps, state: args.state }) + countPatchedStepRecords(args.statePatch),
        v2: true,
      }));
    }
    wrap('updateWorkflowRunHeader', args => ({
      serialized: JSON.stringify(args.opts ?? {}),
      status: args.opts?.status,
      stepRecords: 0,
      v2: true,
    }));

    Object.assign(diffTiming, { calls: 0, totalMs: 0, maxMs: 0 });
    const started = performance.now();
    const prompt = `Call the echo tool ${toolIterations} times`;
    const maxSteps = toolIterations + 2;
    if (recovery === 'auto') {
      const result: any = await durableAgent.stream(prompt, { maxSteps });
      // Drive the stream to completion so every step persists.
      for await (const _chunk of result.fullStream as AsyncIterable<any>) {
        // drain
      }
    } else {
      // Each stream closes when the run suspends; resuming it runs the next step.
      const drain = async (result: { fullStream: AsyncIterable<unknown> }) => {
        for await (const _chunk of result.fullStream) {
          // drain
        }
      };
      const streams = [await durableAgent.stream(prompt, { maxSteps, closeOnSuspend: true })];
      await drain(streams[0]!);
      for (let call = 1; call <= toolIterations; call++) {
        const resumed = await durableAgent.resume(
          streams[0]!.runId,
          { approved: true },
          { toolCallId: `call-${call}`, closeOnSuspend: true },
        );
        streams.push(resumed);
        await drain(resumed);
      }
      expect(await streams.at(-1)!.output.text).toBe('done');
      for (const stream of streams.reverse()) stream.cleanup();
    }

    // The durable engine keeps persisting after the stream closes (the loop and
    // execution workflows each finish their own bookkeeping writes), so measuring
    // at stream end undercounts. Wait for writes to quiesce.
    let seen = -1;
    while (seen !== stats.writes) {
      seen = stats.writes;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    stats.wallMs = performance.now() - started - 250;
    Object.assign(stats, { diffCalls: diffTiming.calls, diffMs: diffTiming.totalMs, maxDiffMs: diffTiming.maxMs });

    return stats;
  } finally {
    journal.mockRestore();
  }
}

function logStats(label: string, stats: WriteStats) {
  const kB = (bytes: number) => `${(bytes / 1024).toFixed(0)}kB`;
  // eslint-disable-next-line no-console
  console.log(
    `[write-amplification] ${label} writes=${stats.writes} (v2=${stats.v2Writes}) total=${(stats.totalBytes / 1048576).toFixed(2)}MB ` +
      `largest=${kB(stats.peakBytes)} runningPeak=${kB(stats.runningPeakBytes)} dup=${stats.maxDuplicatesPerWrite} ` +
      `stepRecords=${stats.maxStepRecordsPerWrite} diffs=${stats.diffCalls} diffMs=${stats.diffMs.toFixed(1)} ` +
      `(max ${stats.maxDiffMs.toFixed(2)}) wall=${stats.wallMs.toFixed(0)}ms`,
  );
}

describe('durable snapshot write amplification (issue #20747)', () => {
  it('bounds how much a durable run writes per step', async () => {
    const small = await measureRun(4);
    const large = await measureRun(8);

    // Sanity: the durable path really does persist `running` per step,
    // otherwise this test would pass vacuously and stop guarding anything.
    expect(small.runningWrites).toBeGreaterThan(2);
    expect(large.runningWrites).toBeGreaterThan(small.runningWrites);

    // The duplication factor: how many times one tool result is re-serialized
    // inside a single running write. Completed steps used to carry their own
    // copy on the payload side, the output side, and again nested under
    // `llmOutput`. Measured 30 before this fix, 12 after.
    //
    // It must not grow with run length, and it must not creep back up.
    expect(large.maxDuplicatesPerWrite).toBeLessThanOrEqual(small.maxDuplicatesPerWrite);
    expect(large.maxDuplicatesPerWrite).toBeLessThanOrEqual(12);

    // Size of a single running write. Before: 301 kB at 4 steps, 561 kB at 8
    // (1.86x). After: 78 kB and 118 kB (1.51x). This still grows, because a
    // running snapshot retains `context.input` — the one copy recovery reads
    // to re-drive the run — and that input accumulates with the conversation.
    // Removing it is an architectural change to the recovery contract and is
    // deliberately not attempted here. Keeping the step records in workflow
    // state, where storage v2 stores them as patches, moved this to 73 kB and
    // 119 kB (1.63x): the loop run's own snapshot now holds them too.
    const runningPeakGrowth = large.runningPeakBytes / Math.max(small.runningPeakBytes, 1);
    expect(runningPeakGrowth).toBeLessThan(1.65);

    // Total bytes handed to storage across the whole run. Before: 11.8 MB at 4
    // steps, 33.9 MB at 8 (2.88x). After: 4.2 MB and 10.2 MB (2.45x) — roughly
    // 3x less written, with the saving widening as runs get longer. Keeping
    // the copies a crash restart reads back (COR-1306) moved this to 4.8 MB
    // and 12.2 MB (2.53x) without changing the duplication factor above.
    const growth = large.totalBytes / Math.max(small.totalBytes, 1);
    expect(growth).toBeLessThan(2.6);
  }, 120000);

  // Durable agents keep new runs on storage v1 (`DurableAgent.storesRunsInJournal`)
  // because of what this measures. At 16 steps, v2 writes 10.2 MB against v1's
  // 25.3 MB with recovery `auto`, and 2.0 MB against 3.6 MB with suspend-only,
  // but its largest single write with suspend-only is 155 kB against v1's
  // 103 kB. That write is the agent's nested run pausing: its step entries
  // keep four copies of the provider request body, 35 kB each, which v1 prunes.
  it.each<Recovery>(['auto', 'suspend-only'])(
    'compares storage v1 and v2 writes with recovery %s',
    async recovery => {
      const results: Record<1 | 2, WriteStats[]> = { 1: [], 2: [] };
      for (const toolIterations of [4, 8, 16]) {
        for (const storageVersion of [1, 2] as const) {
          const stats = await measureRun(toolIterations, { storageVersion, recovery });
          logStats(`${recovery} v${storageVersion} N=${toolIterations}`, stats);
          results[storageVersion].push(stats);
        }
      }
      const [v1, v2] = [results[1], results[2]];

      // Each run really wrote in its version.
      for (const stats of v1) expect(stats.v2Writes).toBe(0);
      for (const stats of v2) expect(stats.v2Writes).toBe(stats.writes);

      // v2 writes less in total than v1 for every run length.
      v2.forEach((stats, i) => expect(stats.totalBytes).toBeLessThan(v1[i]!.totalBytes));

      // A v2 write sends the step records it adds, not all of them so far.
      expect(v2[2]!.maxStepRecordsPerWrite).toBeLessThanOrEqual(v2[0]!.maxStepRecordsPerWrite);
      expect(v1[2]!.maxStepRecordsPerWrite).toBeGreaterThan(v1[0]!.maxStepRecordsPerWrite);
    },
    240000,
  );
});
