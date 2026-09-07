/**
 * End-to-end crash recovery for a durable run whose snapshot was pruned
 * (issue #22636).
 *
 * `recoverActiveRuns()` / `recover()` re-drive a `running` snapshot through
 * `restart()`, and the engine reads *outputs* on the way back in: a restarted
 * step is fed its predecessor's `output` (`engine.getStepOutput`), and the
 * durable loop's `collect-tool-results` map re-reads
 * `getStepResult('durable-llm-execution')` after the tool-call foreach. The
 * running-history pruner removed `messageListState` from every completed step,
 * so both reads handed `MessageList.deserialize` an `undefined` and recovery
 * died with `Cannot read properties of undefined (reading 'messages')`:
 *
 *  - killed while `durable-llm-execution` is active -> the restarted step
 *    itself throws, in `resolveRuntimeDependencies`;
 *  - killed while the `durable-tool-call` foreach is active -> the tool call
 *    re-runs fine and the run dies one step later, in `durable-llm-mapping`;
 *  - killed between iterations -> the nested run's last step has written its
 *    `entry-end` snapshot and the outer loop is awaiting its predicate (where
 *    user `onIterationComplete` hooks run). Nothing is listed as active any
 *    more, so which output restart needs can only be read off the graph
 *    position; getting it wrong dies reading `accumulatedSteps.length`.
 *
 * All three shapes are covered here. Each test captures a real `running`
 * snapshot from a live run, JSON round-trips it (a fresh process only ever
 * sees serialized state), and recovers it against a second store with the
 * run's in-process registry entry dropped — the state a restarted worker
 * actually starts from.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Mastra } from '../../../mastra';
import { InMemoryStore } from '../../../storage';
import { createTool } from '../../../tools';
import type { WorkflowRunState } from '../../../workflows/types';
import { Agent } from '../../agent';
import { DurableStepIds } from '../constants';
import { createDurableAgent } from '../create-durable-agent';
import { globalRunRegistry } from '../run-registry';

const AGENT_ID = 'crash-recovery-agent';
const TOOL_NAME = 'slowTool';
/** The last step of the nested execution workflow (see `workflows/steps/goal.ts`). */
const GOAL_STEP_ID = 'durable-goal';
const CAPTURE_TIMEOUT_MS = 20_000;

type ModelTurn = 'tool-call' | 'text';

/** Minimal v3 model that emits one tool call, then finishing text. */
function createScriptedModel(turns: ModelTurn[], finalText: string, onCall: () => void = () => {}) {
  let call = 0;
  return {
    specificationVersion: 'v3' as const,
    provider: 'crash-recovery',
    modelId: 'crash-recovery-model',
    supportedUrls: {},
    async doGenerate() {
      throw new Error('Streaming only');
    },
    async doStream() {
      const turn = turns[Math.min(call, turns.length - 1)];
      call += 1;
      onCall();
      return {
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            if (turn === 'tool-call') {
              controller.enqueue({
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: TOOL_NAME,
                input: JSON.stringify({ value: 'x' }),
                providerExecuted: false,
              });
              controller.enqueue({ type: 'finish', finishReason: 'tool-calls', usage: usage() });
            } else {
              controller.enqueue({ type: 'text-start', id: 'text' });
              controller.enqueue({ type: 'text-delta', id: 'text', delta: finalText });
              controller.enqueue({ type: 'text-end', id: 'text' });
              controller.enqueue({ type: 'finish', finishReason: 'stop', usage: usage() });
            }
            controller.close();
          },
        }),
      };
    },
  };
}

function usage() {
  return {
    inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 1, text: 1, reasoning: 0 },
  };
}

async function createStack(model: unknown, execute: (args: any) => Promise<any>) {
  const store = new InMemoryStore();
  // A database holds a serialized copy of each write. `InMemoryStore` keeps the
  // object it is handed, and the engine hands it its live `activeStepsPath`, so
  // without this the stored snapshot would silently track in-process mutations
  // that a real store never sees.
  const workflows = (await store.getStore('workflows'))!;
  const persist = workflows.persistWorkflowSnapshot.bind(workflows);
  workflows.persistWorkflowSnapshot = (args: Parameters<typeof persist>[0]) =>
    persist({ ...args, snapshot: JSON.parse(JSON.stringify(args.snapshot)) });

  const durableAgent = createDurableAgent({
    agent: new Agent({
      id: AGENT_ID,
      name: 'Crash Recovery Agent',
      instructions: 'Call the tool, then answer.',
      model: model as any,
      tools: {
        [TOOL_NAME]: createTool({
          id: TOOL_NAME,
          description: 'A tool the capture process never returns from.',
          inputSchema: z.object({ value: z.string() }),
          execute,
        }),
      },
    }),
  });
  const mastra = new Mastra({ agents: { [AGENT_ID]: durableAgent as any }, logger: false, storage: store });
  return { mastra, store, agent: mastra.getAgentById(AGENT_ID) as any };
}

type Snapshots = { loop: WorkflowRunState; execution: WorkflowRunState };

/** Polls until both workflow snapshots satisfy `ready`, then returns serialized copies. */
async function captureSnapshots(
  store: InMemoryStore,
  runId: string,
  ready: (loop: any, execution: any) => boolean,
  description: string,
): Promise<Snapshots> {
  const workflows = (await store.getStore('workflows'))!;
  const deadline = Date.now() + CAPTURE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const loop = await workflows.getWorkflowRunById({ runId, workflowName: DurableStepIds.AGENTIC_LOOP });
    const execution = await workflows.getWorkflowRunById({
      runId,
      workflowName: DurableStepIds.AGENTIC_EXECUTION,
    });
    if (ready(loop?.snapshot, execution?.snapshot)) {
      // A fresh process only ever sees serialized state.
      return JSON.parse(JSON.stringify({ loop: loop!.snapshot, execution: execution!.snapshot })) as Snapshots;
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out waiting for ${description}`);
}

function isActive(snapshot: any, activeStep: string): boolean {
  if (snapshot?.status !== 'running') return false;
  return JSON.stringify(snapshot.activeStepsPath?.[activeStep]) === JSON.stringify(snapshot.activePaths);
}

/** Both snapshots `running` with `activeStep` the live step of the nested run. */
function isRunningStep(activeStep: string) {
  return (loop: any, execution: any) =>
    isActive(loop, DurableStepIds.AGENTIC_EXECUTION) && isActive(execution, activeStep);
}

/**
 * The nested run's last step has completed and written its `entry-end`
 * snapshot, nothing has started since: the outer loop is inside its predicate.
 */
function isBetweenIterations(loop: any, execution: any): boolean {
  return (
    isActive(loop, DurableStepIds.AGENTIC_EXECUTION) &&
    execution?.status === 'running' &&
    Object.keys(execution.activeStepsPath ?? {}).length === 0 &&
    execution.context?.[GOAL_STEP_ID]?.status === 'success'
  );
}

async function seedSnapshots(store: InMemoryStore, runId: string, snapshots: Snapshots) {
  const workflows = (await store.getStore('workflows'))!;
  await workflows.persistWorkflowSnapshot({
    workflowName: DurableStepIds.AGENTIC_LOOP,
    runId,
    snapshot: snapshots.loop,
  });
  await workflows.persistWorkflowSnapshot({
    workflowName: DurableStepIds.AGENTIC_EXECUTION,
    runId,
    snapshot: snapshots.execution,
  });
}

/** A durable run deletes both of its snapshot rows once it reaches a terminal state. */
async function waitForRunToFinish(store: InMemoryStore, runId: string) {
  const workflows = (await store.getStore('workflows'))!;
  const deadline = Date.now() + CAPTURE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const loop = await workflows.getWorkflowRunById({ runId, workflowName: DurableStepIds.AGENTIC_LOOP });
    if (!loop || (loop.snapshot as any)?.status !== 'running') return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error('Timed out waiting for the recovered run to finish');
}

const shutdowns: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (shutdowns.length) await shutdowns.pop()!().catch(() => undefined);
});

/**
 * Runs an agent until `activeStep` is the live step, then abandons it the way a
 * `SIGKILL` would: no cleanup, no shutdown, just the persisted snapshots.
 */
async function crashDuring(activeStep: string, runId: string) {
  // Deliberately never shut down: a killed process does not get to clean up.
  const captureStack = await createStack(createScriptedModel(['tool-call'], 'unused'), () => new Promise(() => {}));
  void captureStack.agent.stream('start', { runId }).catch(() => undefined);
  const snapshots = await captureSnapshots(
    captureStack.store,
    runId,
    isRunningStep(activeStep),
    `a running snapshot with ${activeStep} active`,
  );
  // A restarted worker has no in-process state for the run.
  globalRunRegistry.delete(runId);
  return snapshots;
}

describe('durable crash recovery after running-history pruning (issue #22636)', () => {
  it('recovers a run killed while the tool call was in flight', async () => {
    const runId = 'crash-in-tool-call';
    const snapshots = await crashDuring(DurableStepIds.TOOL_CALL, runId);

    let toolCalls = 0;
    const recoveryStack = await createStack(createScriptedModel(['text'], 'Recovered'), async () => {
      toolCalls += 1;
      return { ok: true };
    });
    shutdowns.push(() => recoveryStack.mastra.shutdown());
    await seedSnapshots(recoveryStack.store, runId, snapshots);

    const recovered = await recoveryStack.agent.recover(runId);
    const output = await recovered.output.getFullOutput();

    expect(output.text).toBe('Recovered');
    expect(toolCalls).toBe(1);
    recovered.cleanup?.();

    // What made that possible: exactly one completed conversation copy is
    // retained — the newest, which is what `collect-tool-results` reads back
    // after the foreach. The older one is still pruned.
    const execution = snapshots.execution.context as Record<string, any>;
    expect(execution[DurableStepIds.LLM_EXECUTION].output.messageListState).toBeDefined();
    expect(execution['map-to-llm-input'].output).not.toHaveProperty('messageListState');
  }, 60_000);

  it('recovers a run killed while the LLM step was in flight', async () => {
    const runId = 'crash-in-llm-execution';
    const captureStack = await createStack(
      {
        specificationVersion: 'v3' as const,
        provider: 'crash-recovery',
        modelId: 'crash-recovery-model',
        supportedUrls: {},
        async doGenerate() {
          throw new Error('Streaming only');
        },
        // Opens the stream and never closes it: the LLM step stays active.
        async doStream() {
          return {
            stream: new ReadableStream({
              start(controller) {
                controller.enqueue({ type: 'stream-start', warnings: [] });
              },
            }),
          };
        },
      },
      async () => ({ ok: true }),
    );
    void captureStack.agent.stream('start', { runId }).catch(() => undefined);
    const snapshots = await captureSnapshots(
      captureStack.store,
      runId,
      isRunningStep(DurableStepIds.LLM_EXECUTION),
      `a running snapshot with ${DurableStepIds.LLM_EXECUTION} active`,
    );
    globalRunRegistry.delete(runId);

    const recoveryStack = await createStack(createScriptedModel(['text'], 'Recovered'), async () => ({ ok: true }));
    shutdowns.push(() => recoveryStack.mastra.shutdown());
    await seedSnapshots(recoveryStack.store, runId, snapshots);

    const recovered = await recoveryStack.agent.recover(runId);
    const output = await recovered.output.getFullOutput();

    expect(output.text).toBe('Recovered');
    recovered.cleanup?.();

    // Restart feeds the LLM step its predecessor's output, and that
    // predecessor is terminal by the time the snapshot is written.
    const execution = snapshots.execution.context as Record<string, any>;
    expect(execution['map-to-llm-input'].output.messageListState).toBeDefined();
  }, 60_000);

  it('recovers a run killed between iterations, inside the loop predicate', async () => {
    const runId = 'crash-between-iterations';
    const captureStack = await createStack(createScriptedModel(['text'], 'Captured'), async () => ({ ok: true }));
    // Park the run in the predicate: the iteration is complete, its last step
    // has persisted, and a user hook that never settles keeps the next one
    // from starting — the window a slow `onIterationComplete` opens.
    void captureStack.agent
      .stream('start', { runId, onIterationComplete: () => new Promise<void>(() => {}) })
      .catch(() => undefined);
    const snapshots = await captureSnapshots(
      captureStack.store,
      runId,
      isBetweenIterations,
      'a running snapshot parked between iterations',
    );
    globalRunRegistry.delete(runId);

    let modelCalls = 0;
    const recoveryStack = await createStack(
      createScriptedModel(['text'], 'unused', () => {
        modelCalls += 1;
      }),
      async () => ({ ok: true }),
    );
    shutdowns.push(() => recoveryStack.mastra.shutdown());
    await seedSnapshots(recoveryStack.store, runId, snapshots);

    const recovered = await recoveryStack.agent.recover(runId);
    const output = await recovered.output.getFullOutput();
    await waitForRunToFinish(recoveryStack.store, runId);

    // The LLM turn had already finished before the crash: recovery completes
    // the run's bookkeeping without re-running it.
    expect(output.finishReason).toBe('stop');
    expect(modelCalls).toBe(0);
    recovered.cleanup?.();

    // Restart re-executes the step at the graph position the snapshot records
    // (`durable-goal`, no longer listed as active) from its own payload, fed
    // its predecessor's output; the output it will rebuild is the one dropped.
    const execution = snapshots.execution.context as Record<string, any>;
    expect(Object.keys(snapshots.execution.activeStepsPath ?? {})).toEqual([]);
    expect(execution[DurableStepIds.IS_TASK_COMPLETE].output.messageListState).toBeDefined();
    expect(execution[GOAL_STEP_ID].payload.messageListState).toBeDefined();
    expect(execution[GOAL_STEP_ID].output).not.toHaveProperty('messageListState');
  }, 60_000);
});
