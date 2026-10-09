/**
 * Evented durable snapshot retention (COR-1431).
 *
 * The evented engine persists step results with `updateWorkflowResults`, a merge
 * write that bypasses the workflow's `pruneSnapshot` hook, so a completed step
 * keeps its full `payload`/`output`. For the durable loop that means each step
 * re-embeds the whole iteration state (`accumulatedSteps`, `messageListState`),
 * and since every merge re-reads and re-serializes the stored row, the row — and
 * the heap cost of each write — grows with run length until the process OOMs.
 *
 * This suite runs the SAME durable loop on both engines and pins how much
 * completed-step history a single running write retains, so a regression shows
 * up as a size/duplication change rather than a production OOM.
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
  // The durable loop's per-step state is `accumulatedSteps` (plus the
  // `messageListState` conversation copy); a completed step must not keep them.
  let maxRunningAccumulatedSteps = 0;
  let maxRunningMessageListState = 0;

  // Every mutating path re-serializes the whole snapshot (libsql rewrites the
  // whole `snapshot` column), so wrapping only `persistWorkflowSnapshot` would
  // badly undercount evented; wrap all three and record the row size after each.
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
      // Counted here (not when aggregating below) so the quiesce wait after the
      // run can observe progress as writes land.
      stats.writes += 1;
      // Measured across all `running` writes: with the prune removed the
      // evented merge keeps the full completed-step history and this count
      // rises (9 vs 4), so the check fails rather than passing vacuously.
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

  // Draining `fullStream` does not mean the writes are done: the durable loop
  // emits `FINISH` before its workflow step returns, and the evented step-end
  // handler then merges the result (and prunes) some time later. Wait for the
  // run itself to reach a terminal state first — the handler that performs
  // those trailing writes also drives that transition — then wait for writes to
  // quiesce, so a lull between `FINISH` and those writes cannot end the wait.
  const runDeadline = Date.now() + 30_000;
  while (Date.now() < runDeadline) {
    const run = await workflowsStore.getWorkflowRunById({ runId: result?.runId });
    const status = run?.snapshot?.status;
    if (!run || status === 'success' || status === 'failed') break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  let seen = -1;
  while (seen !== stats.writes) {
    seen = stats.writes;
    await new Promise(resolve => setTimeout(resolve, 250));
  }

  for (const record of records) {
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

    // Regression: evented must not accumulate per-completed-step history in the
    // running write. Pre-fix it held one `accumulatedSteps` copy per completed
    // step (9 at both 4 and 8 iterations); post-fix only the active step's
    // transient copies remain, matching the default engine's order (COR-1431).
    expect(eventedLarge.maxRunningAccumulatedSteps).toBeLessThanOrEqual(defaultLarge.maxRunningAccumulatedSteps + 3);
    expect(eventedLarge.maxDuplicatesPerWrite).toBeLessThanOrEqual(defaultLarge.maxDuplicatesPerWrite + 2);

    // ...and that constant must not grow with the number of iterations.
    expect(eventedLarge.maxRunningAccumulatedSteps).toBeLessThanOrEqual(eventedSmall.maxRunningAccumulatedSteps + 1);
    expect(eventedLarge.maxDuplicatesPerWrite).toBeLessThanOrEqual(eventedSmall.maxDuplicatesPerWrite + 2);
    expect(eventedLarge.maxRunningMessageListState).toBeLessThanOrEqual(eventedSmall.maxRunningMessageListState + 1);
  }, 240000);
});
