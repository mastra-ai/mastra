/**
 * Evented durable snapshot retention (COR-1431).
 *
 * Mastra Code on the evented experimental agent OOMs inside `JSON.parse` on
 * load and string flattening on write of the persisted durable-loop snapshot.
 * The evented engine re-persists the whole `stepResults` map as a full
 * `running` snapshot on every step boundary
 * (`workflows/evented/workflow-event-processor/index.ts`), and unlike the
 * default engine it does NOT strip terminal-step history: the durable loop sets
 * `retainRunningHistory = engine === 'evented'`
 * (`agent/durable/workflows/durable-loop-builder.ts`), which skips
 * `pruneRunningHistory` (`loop/workflows/prune-snapshot.ts`) — the strip that
 * removes `accumulatedSteps` / `messageListState` from the payload/output of
 * every completed step.
 *
 * This suite runs the SAME durable loop on both engines and pins the delta, so
 * a regression in evented retention shows up as a size/duplication change
 * rather than a production OOM.
 */

import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Mastra } from '../../../mastra';
import { InMemoryStore } from '../../../storage';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';
import { createEventedAgent } from '../create-evented-agent';

/**
 * Mock model that drives `toolIterations` sequential tool calls before
 * finishing with text — each iteration is one persisted step in the durable
 * loop.
 */
function createLoopingModel(toolIterations: number, toolName: string) {
  let callCount = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      callCount += 1;
      const stream =
        callCount <= toolIterations
          ? convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: `id-${callCount}`, modelId: 'mock-model-id', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallType: 'function',
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
          : convertArrayToReadableStream([
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
      return { stream, rawCall: { rawPrompt: null, rawSettings: {} }, warnings: [] };
    },
  });
}

interface WriteRecord {
  method: string;
  workflowName: string;
  status: string;
  /** Serialized size of the whole row after this write — what a full-rewrite adapter hands the DB. */
  bytes: number;
}

interface WriteStats {
  writes: number;
  totalBytes: number;
  peakBytes: number;
  runningWrites: number;
  runningPeakBytes: number;
  maxDuplicatesPerWrite: number;
  /** Max copies of `accumulatedSteps` retained inside a single running write. */
  maxRunningAccumulatedSteps: number;
  /** Max copies of `messageListState` retained inside a single running write. */
  maxRunningMessageListState: number;
  /** Per-workflow-name byte totals, so the loop vs nested-execution split is visible. */
  byWorkflow: Record<string, { writes: number; totalBytes: number; peakBytes: number }>;
}

/**
 * Runs the durable loop for `toolIterations` tool steps on the given engine and
 * records what storage was actually asked to write.
 */
async function measureRun(engine: 'default' | 'evented', toolIterations: number): Promise<WriteStats> {
  const filler = 'x'.repeat(2000);

  const echoTool = createTool({
    id: 'echoTool',
    description: 'Echoes a payload back',
    inputSchema: z.object({ index: z.number() }),
    execute: async ({ index }: { index: number }) => ({ index, payload: `result ${index}: ${filler}` }),
  });

  const baseAgent = new Agent({
    id: `amplification-${engine}-agent`,
    name: `Amplification ${engine} Agent`,
    instructions: 'Call the echo tool repeatedly.',
    model: createLoopingModel(toolIterations, 'echoTool') as any,
    tools: { echoTool },
  });

  const durableAgent =
    engine === 'evented' ? createEventedAgent({ agent: baseAgent }) : createDurableAgent({ agent: baseAgent });

  const store = new InMemoryStore();
  const mastra = new Mastra({
    agents: { [baseAgent.id]: durableAgent as any },
    logger: false,
    storage: store,
    // `running` checkpoints for the default engine are only persisted when
    // crash recovery is enabled (issue #23915); the evented engine pins the
    // full set regardless, so the option is only meaningful for default.
    ...(engine === 'default' ? { recovery: { durableAgents: 'auto' as const } } : {}),
  });

  const workflowsStore = (await mastra.getStorage()!.getStore('workflows'))! as any;
  const records: WriteRecord[] = [];
  const stats: WriteStats = {
    writes: 0,
    totalBytes: 0,
    peakBytes: 0,
    runningWrites: 0,
    runningPeakBytes: 0,
    maxDuplicatesPerWrite: 0,
    maxRunningAccumulatedSteps: 0,
    maxRunningMessageListState: 0,
    byWorkflow: {},
  };
  const marker = `result 1: ${filler}`;
  // Retained-history signals: the durable loop's growing per-step state is
  // `accumulatedSteps` (with `messageListState` the conversation copy). A
  // completed step must not keep them in its persisted payload/output.
  let maxRunningAccumulatedSteps = 0;
  let maxRunningMessageListState = 0;

  // Every mutating write path re-serializes the whole snapshot: the evented
  // engine merges suspensions via `updateWorkflowResults` / `updateWorkflowState`
  // (libsql rewrites the whole `snapshot` column), and the default engine goes
  // through `persistWorkflowSnapshot`. Measuring only `persistWorkflowSnapshot`
  // badly undercounts evented — we wrap all three and record the size of the
  // row after each write.
  for (const method of ['persistWorkflowSnapshot', 'updateWorkflowResults', 'updateWorkflowState'] as const) {
    const original = workflowsStore[method].bind(workflowsStore);
    workflowsStore[method] = async (args: any) => {
      const result = await original(args);
      const workflowName = args.workflowName ?? '?';
      const run = await workflowsStore.getWorkflowRunById({ workflowName, runId: args.runId });
      const snap = run?.snapshot;
      const serialized = typeof snap === 'string' ? snap : JSON.stringify(snap ?? {});
      const status = (typeof snap === 'string' ? undefined : snap?.status) ?? '?';
      records.push({ method, workflowName, status, bytes: serialized.length });
      // Retention is measured on the full-row `persistWorkflowSnapshot` write —
      // the default engine's per-step write and the evented prune's re-persist
      // — so both engines are compared on what is actually left in storage
      // after a step, not the evented merge's pre-prune transient row.
      if (status === 'running') {
        stats.maxDuplicatesPerWrite = Math.max(stats.maxDuplicatesPerWrite, serialized.split(marker).length - 1);
        maxRunningAccumulatedSteps = Math.max(
          maxRunningAccumulatedSteps,
          serialized.split('"accumulatedSteps"').length - 1,
        );
        maxRunningMessageListState = Math.max(
          maxRunningMessageListState,
          serialized.split('"messageListState"').length - 1,
        );
      }
      return result;
    };
  }

  const result: any = await durableAgent.stream(`Call the echo tool ${toolIterations} times`, {
    maxSteps: toolIterations + 2,
  });
  if (result?.fullStream) {
    for await (const _chunk of result.fullStream as AsyncIterable<any>) {
      // drain
    }
  }
  result?.cleanup?.();

  // The durable engine keeps persisting after the stream closes, so wait for
  // writes to quiesce before measuring.
  let seen = -1;
  while (seen !== stats.writes) {
    seen = stats.writes;
    await new Promise(resolve => setTimeout(resolve, 250));
  }

  for (const record of records) {
    stats.writes += 1;
    stats.totalBytes += record.bytes;
    stats.peakBytes = Math.max(stats.peakBytes, record.bytes);
    if (record.status === 'running') {
      stats.runningWrites += 1;
      stats.runningPeakBytes = Math.max(stats.runningPeakBytes, record.bytes);
    }
    const wf = (stats.byWorkflow[record.workflowName] ??= { writes: 0, totalBytes: 0, peakBytes: 0 });
    wf.writes += 1;
    wf.totalBytes += record.bytes;
    wf.peakBytes = Math.max(wf.peakBytes, record.bytes);
  }

  stats.maxRunningAccumulatedSteps = maxRunningAccumulatedSteps;
  stats.maxRunningMessageListState = maxRunningMessageListState;

  return stats;
}

describe('evented durable snapshot retention (COR-1431)', () => {
  it('does not retain completed-step history in the evented running snapshot', async () => {
    const defaultSmall = await measureRun('default', 4);
    const eventedSmall = await measureRun('evented', 4);
    const defaultLarge = await measureRun('default', 8);
    const eventedLarge = await measureRun('evented', 8);

    const rows = [
      ['default', 4, defaultSmall],
      ['evented', 4, eventedSmall],
      ['default', 8, defaultLarge],
      ['evented', 8, eventedLarge],
    ] as const;
    for (const [engine, iters, s] of rows) {
      // eslint-disable-next-line no-console
      console.log(
        `[COR-1431] ${engine} iters=${iters} writes=${s.writes} runningWrites=${s.runningWrites} ` +
          `runningPeak=${(s.runningPeakBytes / 1024).toFixed(0)}kB total=${(s.totalBytes / 1048576).toFixed(2)}MB ` +
          `dup=${s.maxDuplicatesPerWrite} accSteps=${s.maxRunningAccumulatedSteps} msgList=${s.maxRunningMessageListState}`,
      );
    }

    // Both engines must actually persist per-step running writes, or the
    // comparison is vacuous.
    expect(defaultSmall.runningWrites).toBeGreaterThan(2);
    expect(eventedSmall.runningWrites).toBeGreaterThan(2);

    // Regression: the evented engine must not accumulate per-completed-step
    // history in the running snapshot. Before the fix a single running write
    // retained one `accumulatedSteps` copy per completed step (9 copies for an
    // 8-step run, 9 already at 4 steps) because the merge write bypassed the
    // `pruneSnapshot` hook; after the fix only the active step's transient
    // copies remain — a small constant close to the default engine's — so the
    // persisted row no longer grows with the run (#COR-1431 heap OOM).
    expect(eventedLarge.maxRunningAccumulatedSteps).toBeLessThanOrEqual(defaultLarge.maxRunningAccumulatedSteps + 3);
    expect(eventedLarge.maxDuplicatesPerWrite).toBeLessThanOrEqual(defaultLarge.maxDuplicatesPerWrite + 2);

    // That constant must not grow with the number of iterations — the essence
    // of the unbounded-growth bug.
    expect(eventedLarge.maxRunningAccumulatedSteps).toBeLessThanOrEqual(eventedSmall.maxRunningAccumulatedSteps + 1);
    expect(eventedLarge.maxDuplicatesPerWrite).toBeLessThanOrEqual(eventedSmall.maxDuplicatesPerWrite + 2);
  }, 240000);
});
