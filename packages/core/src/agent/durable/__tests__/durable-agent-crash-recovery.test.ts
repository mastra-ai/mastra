/**
 * Crash recovery from every checkpoint of a default-engine DurableAgent run.
 *
 * Running snapshots trim conversation history to keep storage small. That
 * trimming must never remove what a restart reads back, or `recover()` fails
 * with errors like `reading 'messages'` (COR-1306). This test captures the
 * workflow store after every snapshot write of a two-round tool-calling run,
 * then recovers from each capture in a fresh module graph (standing in for a
 * fresh process) and requires the run to finish.
 */

import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { WorkflowRunState } from '../../../workflows/types';
import { DurableStepIds } from '../constants';

const RECOVERY_TIMEOUT_MS = 5_000;

type SnapshotRow = { workflowName: string; runId: string; resourceId?: string; snapshot: WorkflowRunState };
type Checkpoint = { outer?: WorkflowRunState; inner?: WorkflowRunState; rows: SnapshotRow[] };

const streamStart = (id: string) => [
  { type: 'stream-start', warnings: [] },
  { type: 'response-metadata', id, modelId: 'mock-model-id', timestamp: new Date(0) },
];
const finish = (finishReason: string) => ({
  type: 'finish',
  finishReason,
  usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
});

// Decides from the transcript, so a recovered process makes the same call the
// original process made for the same history: two tool rounds, then text.
function createModel() {
  return new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      const answered = prompt.filter(m => m.role === 'tool').flatMap(m => m.content).length;
      const parts =
        answered < 2
          ? [
              ...streamStart(`call-${answered}`),
              {
                type: 'tool-call',
                toolCallId: `call-${answered}`,
                toolName: 'lookup',
                input: JSON.stringify({ index: answered }),
              },
              finish('tool-calls'),
            ]
          : [
              ...streamStart('text'),
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'done' },
              { type: 'text-end', id: 'text-1' },
              finish('stop'),
            ];
      return { stream: convertArrayToReadableStream(parts as any[]), rawCall: { rawPrompt: null, rawSettings: {} } };
    },
  });
}

// A fresh module graph per process keeps module-level state (run registry,
// local recovery claims) from leaking between the original run and recovery.
async function startProcess() {
  vi.resetModules();
  const [{ Mastra }, { InMemoryStore }, { Agent }, { createDurableAgent }, { globalRunRegistry }] = await Promise.all([
    import('../../../mastra'),
    import('../../../storage'),
    import('../../agent'),
    import('../create-durable-agent'),
    import('../run-registry'),
  ]);

  const agent = new Agent({
    id: 'crash-agent',
    name: 'crash-agent',
    instructions: 'Use your tools.',
    model: createModel(),
    tools: {
      lookup: {
        id: 'lookup',
        description: 'Looks something up',
        inputSchema: z.object({ index: z.number() }),
        execute: async () => ({ ok: true }),
      },
    },
  });
  const durableAgent = createDurableAgent({ agent });
  const mastra = new Mastra({
    agents: { crashAgent: durableAgent },
    storage: new InMemoryStore(),
    logger: false,
    recovery: { durableAgents: 'auto' },
  });
  const workflows = (await mastra.getStorage()!.getStore('workflows'))!;
  return { durableAgent, workflows, globalRunRegistry };
}

function activeStepIds(snapshot: WorkflowRunState | undefined) {
  return Object.keys(snapshot?.activeStepsPath ?? {});
}

function describeCheckpoint({ outer, inner }: Checkpoint) {
  const part = (name: string, s?: WorkflowRunState) =>
    s ? `${name}:${s.status}[${activeStepIds(s).join('|') || '-'}]@${JSON.stringify(s.activePaths)}` : '';
  return [part('outer', outer), part('inner', inner)].filter(Boolean).join(' ');
}

/**
 * Checkpoints that can't recover for reasons unrelated to snapshot trimming.
 * Each is tracked separately; drop an exclusion once its bug is fixed.
 */
function knownUnrecoverable({ outer, inner }: Checkpoint): string | undefined {
  // Written before the run started. listActiveRuns() only returns running
  // rows, so nothing tries to recover from this checkpoint.
  if (outer?.status !== 'running') return 'run not started';

  // The outer run marked the nested iteration workflow active, but the nested
  // run has not saved its first snapshot yet. Restart then fails with
  // "This workflow run was not active".
  if (activeStepIds(outer).includes(DurableStepIds.AGENTIC_EXECUTION) && !inner) return 'nested start race';

  // The run already finished its last model turn; restarting at scorer
  // execution completes the workflow but the recovered stream never closes.
  const target = outer.serializedStepGraph?.[outer.activePaths?.[0] ?? -1];
  if (target && 'id' in target && target.id === 'execute-scorers') return 'recovered stream hangs at end of run';

  return undefined;
}

async function recoverFrom(checkpoint: Checkpoint, runId: string): Promise<string> {
  const { durableAgent, workflows, globalRunRegistry } = await startProcess();
  for (const row of checkpoint.rows) await workflows.persistWorkflowSnapshot(row);

  const attempt = (async () => {
    const recovered = await durableAgent.recover(runId);
    const execution = globalRunRegistry.get(runId)?.workflowExecution;
    const errors: string[] = [];
    // Read the answer from the finish payload: a checkpoint saved after the final
    // model turn recovers without streaming any text.
    let finalText: string | undefined;
    for await (const chunk of recovered.fullStream) {
      if (chunk.type === 'error') errors.push(String((chunk.payload as any)?.error?.message ?? chunk.payload));
      if (chunk.type === 'finish') finalText = String((chunk.payload.output as { text?: string }).text);
    }
    const executionError = await Promise.resolve(execution).then(
      () => undefined,
      (error: unknown) => String((error as Error)?.message ?? error),
    );
    if (errors.length) return `stream error: ${errors[0]}`;
    if (executionError) return `workflow error: ${executionError}`;
    if (finalText === undefined) return 'stream closed without finish';
    return finalText === 'done' ? 'ok' : `finished with text ${JSON.stringify(finalText)}`;
  })();

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<string>(resolve => {
    timer = setTimeout(() => resolve(`no result after ${RECOVERY_TIMEOUT_MS}ms`), RECOVERY_TIMEOUT_MS);
  });
  try {
    return await Promise.race([
      attempt.catch((error: unknown) => `threw: ${(error as Error)?.message ?? error}`),
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
  }
}

describe('DurableAgent crash recovery', () => {
  it('recovers from every checkpoint of a tool-calling run', async () => {
    // Process 1: run to completion, copying the workflow store after every write.
    const original = await startProcess();
    const rows = new Map<string, SnapshotRow>();
    const checkpoints: Checkpoint[] = [];
    const persist = original.workflows.persistWorkflowSnapshot.bind(original.workflows);
    original.workflows.persistWorkflowSnapshot = async args => {
      rows.set(`${args.workflowName}:${args.runId}`, structuredClone(args));
      const copy = [...rows.values()].map(row => structuredClone(row));
      checkpoints.push({
        outer: copy.find(row => row.workflowName === DurableStepIds.AGENTIC_LOOP)?.snapshot,
        inner: copy.find(row => row.workflowName !== DurableStepIds.AGENTIC_LOOP)?.snapshot,
        rows: copy,
      });
      return persist(args);
    };

    const result = await original.durableAgent.stream('Look two things up');
    let text = '';
    for await (const chunk of result.fullStream) {
      if (chunk.type === 'text-delta') text += chunk.payload.text;
    }
    expect(text).toBe('done');
    // A finished run deletes its snapshots; wait for that so every write has been captured.
    await vi.waitFor(
      async () =>
        expect(
          await original.workflows.loadWorkflowSnapshot({
            workflowName: DurableStepIds.AGENTIC_LOOP,
            runId: result.runId,
          }),
        ).toBeFalsy(),
      { timeout: 5_000 },
    );

    const recoverable = checkpoints.filter(checkpoint => !knownUnrecoverable(checkpoint));
    // Each case the trimming used to break must be among the recovered checkpoints.
    const inner = (c: Checkpoint) => c.inner?.status === 'running';
    expect(recoverable.some(c => inner(c) && activeStepIds(c.inner).includes(DurableStepIds.TOOL_CALL))).toBe(true);
    expect(recoverable.some(c => inner(c) && activeStepIds(c.inner).length === 0)).toBe(true);
    expect(recoverable.some(c => inner(c) && activeStepIds(c.outer).length === 0)).toBe(true);

    const failures: string[] = [];
    for (const [index, checkpoint] of checkpoints.entries()) {
      if (knownUnrecoverable(checkpoint)) continue;
      const outcome = await recoverFrom(checkpoint, result.runId);
      if (outcome !== 'ok') failures.push(`#${index} ${describeCheckpoint(checkpoint)}: ${outcome}`);
    }
    expect(failures).toEqual([]);
    expect(checkpoints.length - recoverable.length).toBeLessThanOrEqual(4);
  }, 120_000);
});
