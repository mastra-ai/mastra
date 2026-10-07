/**
 * Regression test for issue #25890 — DurableAgent.recover() dropped
 * agent-registered tools after a process crash.
 *
 * The registry entry rebuilt by `#rehydrateRecoveryState` carried a real model
 * but no `tools`/`baseTools`/`workspace`. `resolveRuntimeDependencies` treats an
 * entry with a real model as hydrated (`hasHydratedEntry`) and reads
 * `baseTools ?? tools ?? {}` straight off it instead of rebuilding from the
 * agent — so the recovered LLM step called the model with zero tools.
 *
 * Runs a real durable stream to persist resumable `running` snapshots, then
 * recovers in a fresh module graph (empty run registries, like a new process
 * after a crash) and asserts the tool registered on the agent reaches the model
 * request. The model is text-only (it never emits a tool call), so no tool-call
 * step runs during recovery — that keeps `rebuildRunToolsFromMastra` from
 * rebuilding the toolset and masking the missing registry entry. Without the
 * src fix the recovered model request carries no tools and this test fails.
 */

import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { WorkflowRunState } from '../../../workflows/types';
import { DurableStepIds } from '../constants';

const RECOVERY_TIMEOUT_MS = 5_000;
const TOOLS_AGENT_ID = 'tools-recover-agent';
const REGISTERED_TOOL = 'lookup';

type SnapshotRow = { workflowName: string; runId: string; resourceId?: string; snapshot: WorkflowRunState };
type Checkpoint = { rows: SnapshotRow[]; outer?: WorkflowRunState; inner?: WorkflowRunState };

/** A text-only model that records the `tools` of every request it receives. */
function createCapturingModel(captured: any[][]) {
  return new MockLanguageModelV2({
    doStream: async ({ tools }) => {
      captured.push((tools ?? []) as any[]);
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-0', modelId: 'mock', timestamp: new Date(0) },
          { type: 'text-start', id: 't' },
          { type: 'text-delta', id: 't', delta: 'done' },
          { type: 'text-end', id: 't' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
        ]),
      };
    },
  });
}

/** Starts a fresh process — a fresh module graph means empty run registries. */
async function startProcess(captured: any[][]) {
  vi.resetModules();
  const [{ Mastra }, { InMemoryStore }, { Agent }, { createDurableAgent }, { globalRunRegistry }] = await Promise.all([
    import('../../../mastra'),
    import('../../../storage'),
    import('../../agent'),
    import('../create-durable-agent'),
    import('../run-registry'),
  ]);

  const agent = new Agent({
    id: TOOLS_AGENT_ID,
    name: TOOLS_AGENT_ID,
    instructions: 'Use your tools.',
    model: createCapturingModel(captured) as any,
    tools: {
      [REGISTERED_TOOL]: {
        id: REGISTERED_TOOL,
        description: 'Looks something up',
        inputSchema: z.object({ index: z.number() }),
        execute: async () => ({ ok: true }),
      },
    },
  });
  const durableAgent = createDurableAgent({ agent });
  const storage = new InMemoryStore();
  const mastra = new Mastra({
    agents: { toolsRecoverAgent: durableAgent },
    storage,
    logger: false,
    recovery: { durableAgents: 'auto' },
  });
  const workflows = (await mastra.getStorage()!.getStore('workflows'))!;
  return { durableAgent, workflows, globalRunRegistry };
}

function activeStepIds(snapshot: WorkflowRunState | undefined) {
  return Object.keys(snapshot?.activeStepsPath ?? {});
}

/** Mirrors the crash-recovery recoverability filter. */
function isRecoverable({ outer, inner }: Checkpoint): boolean {
  // Only `running` snapshots are recovery sources, and a nested run that has
  // not saved its first inner snapshot yet cannot be restarted.
  if (outer?.status !== 'running') return false;
  if (activeStepIds(outer).includes(DurableStepIds.AGENTIC_EXECUTION) && !inner) return false;
  return true;
}

/** Runs a real stream, copying the workflow store after every snapshot write. */
async function captureCheckpoints() {
  // The original process's captures are irrelevant (and always include the
  // tool) — keep them out of the asserted array.
  const discarded: any[][] = [];
  const original = await startProcess(discarded);
  const rows = new Map<string, SnapshotRow>();
  const checkpoints: Checkpoint[] = [];
  const persist = original.workflows.persistWorkflowSnapshot.bind(original.workflows);
  original.workflows.persistWorkflowSnapshot = async args => {
    rows.set(`${args.workflowName}:${args.runId}`, structuredClone(args));
    const copy = [...rows.values()].map(row => structuredClone(row));
    checkpoints.push({
      rows: copy,
      outer: copy.find(row => row.workflowName === DurableStepIds.AGENTIC_LOOP)?.snapshot,
      inner: copy.find(row => row.workflowName !== DurableStepIds.AGENTIC_LOOP)?.snapshot,
    });
    return persist(args);
  };

  const result = await original.durableAgent.stream('Look something up');
  let text = '';
  for await (const chunk of result.fullStream) {
    if (chunk.type === 'text-delta') text += chunk.payload.text;
  }
  expect(text).toBe('done');
  return { checkpoints, runId: result.runId };
}

/** Recovers from a checkpoint in a fresh process; returns the tools seen. */
async function recoverAndCapture(checkpoint: Checkpoint, runId: string): Promise<any[][]> {
  const captured: any[][] = [];
  const { durableAgent, workflows, globalRunRegistry } = await startProcess(captured);
  for (const row of checkpoint.rows) await workflows.persistWorkflowSnapshot(row);

  const attempt = (async () => {
    const recovered = await durableAgent.recover(runId);
    const execution = globalRunRegistry.get(runId)?.workflowExecution;
    // Drain so the recovered workflow actually re-drives and calls the model.
    for await (const chunk of recovered.fullStream) void chunk;
    await Promise.resolve(execution).catch(() => {});
  })();

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>(resolve => {
    timer = setTimeout(resolve, RECOVERY_TIMEOUT_MS);
  });
  try {
    await Promise.race([attempt.catch(() => {}), timeout]);
  } finally {
    clearTimeout(timer);
  }
  return captured;
}

describe('DurableAgent.recover(runId) tool rehydration (#25890)', () => {
  it('delivers agent-registered tools to the model request after a crash', async () => {
    const { checkpoints, runId } = await captureCheckpoints();
    const recoverable = checkpoints.filter(isRecoverable);
    expect(recoverable.length).toBeGreaterThan(0);

    const sawRegisteredTool = (batches: any[][]) =>
      batches.some(tools => tools.some(tool => tool?.name === REGISTERED_TOOL));

    const seen: any[][] = [];
    for (const checkpoint of recoverable) {
      const captured = await recoverAndCapture(checkpoint, runId);
      seen.push(...captured);
      // With the fix the first recoverable checkpoint already rebuilds the
      // toolset; exit early instead of re-driving every checkpoint.
      if (sawRegisteredTool(captured)) break;
    }

    // Sanity: recovery re-ran the LLM step and the model was called.
    expect(seen.length).toBeGreaterThan(0);
    // The fix: the agent-registered tool reached the recovered model request.
    expect(sawRegisteredTool(seen)).toBe(true);
  }, 120_000);
});
