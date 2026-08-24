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
 */

import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Agent } from '../../agent/agent';
import { createDurableAgent } from '../../agent/durable/create-durable-agent';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';

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

interface WriteStats {
  /** Number of `persistWorkflowSnapshot` calls made during the run. */
  writes: number;
  /** Sum of serialized snapshot sizes across every write. */
  totalBytes: number;
  /** Largest single serialized snapshot written. */
  peakBytes: number;
  /** Number of writes made with status `running` (the durable per-step writes). */
  runningWrites: number;
  /** Largest single serialized `running` snapshot written. */
  runningPeakBytes: number;
  /**
   * Most copies of one early tool result found inside a single `running`
   * snapshot. This is the duplication factor: how many times one piece of
   * conversation is re-serialized per write.
   */
  maxDuplicatesPerWrite: number;
}

/**
 * Runs a durable agent for `toolIterations` tool steps and records what the
 * storage layer was actually asked to write.
 */
async function measureRun(toolIterations: number): Promise<WriteStats> {
  // Each tool result carries a realistic payload so snapshot growth tracks
  // accumulated conversation rather than bookkeeping noise.
  const filler = 'x'.repeat(2000);

  const echoTool = createTool({
    id: 'echoTool',
    description: 'Echoes a payload back',
    inputSchema: z.object({ index: z.number() }),
    execute: async ({ index }: { index: number }) => ({ index, payload: `result ${index}: ${filler}` }),
  });

  const baseAgent = new Agent({
    id: 'amplification-agent',
    name: 'Amplification Agent',
    instructions: 'Call the echo tool repeatedly.',
    model: createLoopingModel(toolIterations, 'echoTool') as any,
    tools: { echoTool },
  });

  const durableAgent = createDurableAgent({ agent: baseAgent });
  const store = new InMemoryStore();
  const mastra = new Mastra({
    agents: { 'amplification-agent': durableAgent as any },
    logger: false,
    storage: store,
  });

  const workflowsStore = (await mastra.getStorage()!.getStore('workflows'))! as any;
  const stats: WriteStats = {
    writes: 0,
    totalBytes: 0,
    peakBytes: 0,
    runningWrites: 0,
    runningPeakBytes: 0,
    maxDuplicatesPerWrite: 0,
  };
  // A marker unique to the first tool result, so it exists for every run length
  // and its copy count is directly comparable across them.
  const marker = `result 1: ${filler}`;
  const originalPersist = workflowsStore.persistWorkflowSnapshot.bind(workflowsStore);
  workflowsStore.persistWorkflowSnapshot = async (args: any) => {
    const serialized = JSON.stringify(args.snapshot ?? {});
    stats.writes += 1;
    stats.totalBytes += serialized.length;
    stats.peakBytes = Math.max(stats.peakBytes, serialized.length);
    if (args.snapshot?.status === 'running') {
      stats.runningWrites += 1;
      stats.runningPeakBytes = Math.max(stats.runningPeakBytes, serialized.length);
      stats.maxDuplicatesPerWrite = Math.max(stats.maxDuplicatesPerWrite, serialized.split(marker).length - 1);
    }
    return originalPersist(args);
  };

  const result: any = await durableAgent.stream(`Call the echo tool ${toolIterations} times`, {
    maxSteps: toolIterations + 2,
  });
  // Drive the stream to completion so every step persists.
  if (result?.fullStream) {
    for await (const _chunk of result.fullStream as AsyncIterable<any>) {
      // drain
    }
  }

  // The durable engine keeps persisting after the stream closes (the loop and
  // execution workflows each finish their own bookkeeping writes), so measuring
  // at stream end undercounts. Wait for writes to quiesce.
  let seen = -1;
  while (seen !== stats.writes) {
    seen = stats.writes;
    await new Promise(resolve => setTimeout(resolve, 250));
  }

  return stats;
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
    // deliberately not attempted here.
    const runningPeakGrowth = large.runningPeakBytes / Math.max(small.runningPeakBytes, 1);
    expect(runningPeakGrowth).toBeLessThan(1.65);

    // Total bytes handed to storage across the whole run. Before: 11.8 MB at 4
    // steps, 33.9 MB at 8 (2.88x). After: 4.2 MB and 10.2 MB (2.45x) — roughly
    // 3x less written, with the saving widening as runs get longer.
    const growth = large.totalBytes / Math.max(small.totalBytes, 1);
    expect(growth).toBeLessThan(2.6);
  }, 120000);
});
