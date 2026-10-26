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
import { createScorer } from '../../../evals';
import type { SerializedWorkflowRow } from '../../../storage/domains/workflows/serializing-store.test-utils';
import type { WorkflowRunState } from '../../../workflows/types';
import { AGENT_STREAM_TOPIC, AgentStreamEventTypes, DurableStepIds } from '../constants';
import { MAP_FINAL_OUTPUT_STEP_ID } from '../workflows/durable-loop-builder';
import { consumeText, createRestartScenario, findRow } from './restart-harness';

const RECOVERY_TIMEOUT_MS = 5_000;

// Every simulated process evaluates a fresh module graph, and each graph
// creates its own module-level AsyncLocalStorage instances. On Node 22, every
// enabled instance adds work to each promise created afterwards, so a few
// hundred recoveries slow down until the tests time out. Disabling a dead
// process's stores keeps each recovery's cost constant.
const asyncStores = vi.hoisted(() => new Set<{ disable(): void }>());
vi.mock('node:async_hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('node:async_hooks')>();
  class TrackedAsyncLocalStorage<T> extends actual.AsyncLocalStorage<T> {
    constructor() {
      super();
      asyncStores.add(this);
    }
  }
  return { ...actual, AsyncLocalStorage: TrackedAsyncLocalStorage };
});

function disposeAsyncStores() {
  for (const store of asyncStores) store.disable();
  asyncStores.clear();
}

type SnapshotRow = { workflowName: string; runId: string; resourceId?: string; snapshot: WorkflowRunState };
type Checkpoint = {
  outer?: WorkflowRunState;
  inner?: WorkflowRunState;
  rows: SnapshotRow[];
  /** Span-end events the original process had emitted when this checkpoint was written */
  endedSpanCount: number;
};

type RecordedSpan = { id: string; traceId: string; parentSpanId?: string; type: string; name: string; output?: any };

/**
 * Stands in for an observability store that persists only span-end events
 * (the insert-only strategy). Each span end overwrites the stored record, like
 * a store update. `ended` is the event log, so a crash is a prefix of it.
 */
class SpanRecorder {
  ended: RecordedSpan[] = [];
  #nextId = 0;

  constructor(private readonly prefix: string) {}

  #span(data: RecordedSpan): any {
    const recorder = this;
    const span: any = {
      ...data,
      startTime: new Date(),
      isInternal: false,
      isEvent: false,
      isValid: true,
      isRootSpan: !data.parentSpanId,
      end: (opts?: { output?: unknown }) => recorder.ended.push({ ...data, output: opts?.output }),
      error: (opts?: { error?: unknown }) => recorder.ended.push({ ...data, output: { error: String(opts?.error) } }),
      update: () => {},
      exportSpan: () => ({ ...data }),
      snapshot: () => ({ ...data }),
      getParentSpanId: () => data.parentSpanId,
      findParent: () => undefined,
      executeInContext: async (fn: () => Promise<unknown>) => fn(),
      executeInContextSync: (fn: () => unknown) => fn(),
      externalTraceId: data.traceId,
      getCorrelationContext: () => undefined,
      observabilityInstance: {},
      createChildSpan: (opts: any) => recorder.#start({ ...opts, traceId: data.traceId, parentSpanId: data.id }),
      createEventSpan: (opts: any) => recorder.#start({ ...opts, traceId: data.traceId, parentSpanId: data.id }),
      createTracker: () => {
        let step: any;
        return {
          getTracingContext: () => ({ currentSpan: step ?? span }),
          reportGenerationError: () => {},
          endGeneration: (opts?: { output?: unknown }) => span.end(opts),
          updateGeneration: () => {},
          wrapStream: <T>(stream: T) => stream,
          startStep: () => {
            step ??= span.createChildSpan({ type: 'model_step', name: 'step' });
          },
          startInference: () => {},
          updateStep: () => {},
          setStepIndex: () => {},
          setDeferStepClose: () => {},
          setInferenceContext: () => {},
          exportCurrentStep: () => step?.exportSpan(),
          getPendingStepFinishPayload: () => undefined,
        };
      },
    };
    return span;
  }

  #start(opts: { type: string; name?: string; traceId?: string; parentSpanId?: string }) {
    const id = `${this.prefix}-${++this.#nextId}`;
    return this.#span({
      id,
      traceId: opts.traceId ?? `trace-${id}`,
      parentSpanId: opts.parentSpanId,
      type: opts.type,
      name: opts.name ?? opts.type,
    });
  }

  entrypoint() {
    const instance = {
      getConfig: () => ({ serviceName: 'test' }),
      getExporters: () => [],
      getSpanOutputProcessors: () => [],
      getLogger: () => undefined,
      getBridge: () => undefined,
      startSpan: (opts: any) => this.#start(opts),
      rebuildSpan: (data: RecordedSpan) => this.#span(data),
      flush: async () => {},
      shutdown: async () => {},
      __setLogger: () => {},
      __setMastraEnvironment: () => {},
    };
    return {
      shutdown: async () => {},
      setMastraContext: () => {},
      setLogger: () => {},
      getSelectedInstance: () => instance,
      registerInstance: () => {},
      getInstance: () => instance,
      getDefaultInstance: () => instance,
      listInstances: () => new Map([['default', instance]]),
      unregisterInstance: () => false,
      hasInstance: () => true,
      setConfigSelector: () => {},
      clear: () => {},
    };
  }
}

/** The stored trace: the last end event of each span, in first-end order. */
function storedSpans(events: RecordedSpan[]) {
  const byId = new Map<string, RecordedSpan>();
  for (const event of events) byId.set(event.id, event);
  return [...byId.values()];
}

const streamStart = (id: string) => [
  { type: 'stream-start', warnings: [] },
  { type: 'response-metadata', id, modelId: 'mock-model-id', timestamp: new Date(0) },
];
type TestUsage = { inputTokens: number | undefined; outputTokens: number | undefined; totalTokens: number | undefined };
const completeUsage: TestUsage = { inputTokens: 10, outputTokens: 20, totalTokens: 30 };
const finish = (finishReason: string, usage: TestUsage) => ({ type: 'finish', finishReason, usage });

// Decides from the transcript, so a recovered process makes the same call the
// original process made for the same history: two tool rounds, then text.
function createModel(usages: TestUsage[] = [completeUsage, completeUsage, completeUsage], onCall?: () => void) {
  return new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      onCall?.();
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
              finish('tool-calls', usages[answered] ?? completeUsage),
            ]
          : [
              ...streamStart('text'),
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'done' },
              { type: 'text-end', id: 'text-1' },
              finish('stop', usages[answered] ?? completeUsage),
            ];
      return { stream: convertArrayToReadableStream(parts as any[]), rawCall: { rawPrompt: null, rawSettings: {} } };
    },
  });
}

// `evented-fallback` is an EventedAgent on a store without atomic concurrent
// updates, which runs the loop on the default engine instead.
type AgentKind = 'durable' | 'evented-fallback';
type StorageMode = 'in-memory' | 'serializing';

// A fresh module graph per process keeps module-level state (run registry,
// local recovery claims) from leaking between the original run and recovery.
async function startProcess(
  kind: AgentKind,
  usages?: TestUsage[],
  observability?: SpanRecorder,
  storageMode: StorageMode = 'in-memory',
  onWrite?: (rows: SerializedWorkflowRow[]) => void,
) {
  disposeAsyncStores();
  vi.resetModules();
  const [
    { Mastra },
    { InMemoryStore },
    { Agent },
    { createDurableAgent },
    { createEventedAgent },
    { globalRunRegistry },
  ] = await Promise.all([
    import('../../../mastra'),
    import('../../../storage'),
    import('../../agent'),
    import('../create-durable-agent'),
    import('../create-evented-agent'),
    import('../run-registry'),
  ]);

  const agent = new Agent({
    id: 'crash-agent',
    name: 'crash-agent',
    instructions: 'Use your tools.',
    model: createModel(usages),
    tools: {
      lookup: {
        id: 'lookup',
        description: 'Looks something up',
        inputSchema: z.object({ index: z.number() }),
        execute: async () => ({ ok: true }),
      },
    },
  });
  const durableAgent = kind === 'durable' ? createDurableAgent({ agent }) : createEventedAgent({ agent });
  const storage =
    storageMode === 'serializing'
      ? (await import('../../../storage/domains/workflows/serializing-store.test-utils')).createSerializingStore(
          onWrite,
        ).store
      : new InMemoryStore();
  // Before `new Mastra(...)`: the engine resolves during agent registration.
  if (kind === 'evented-fallback') {
    vi.spyOn(storage.stores.workflows!, 'supportsConcurrentUpdates').mockReturnValue(false);
  }
  const mastra = new Mastra({
    agents: { crashAgent: durableAgent },
    storage,
    logger: false,
    recovery: { durableAgents: 'auto' },
    ...(observability ? { observability: observability.entrypoint() as any } : {}),
  });
  const workflows = (await mastra.getStorage()!.getStore('workflows'))!;
  return { durableAgent, workflows, globalRunRegistry, pubsub: mastra.pubsub };
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

  return undefined;
}

// FINISH went out before the crash, so recovery must publish it again.
function finishedBeforeCrash({ outer }: Checkpoint) {
  return outer?.context?.[MAP_FINAL_OUTPUT_STEP_ID]?.status === 'success';
}

// The outer step a restart from this checkpoint resumes from.
function outerTargetId({ outer }: Checkpoint) {
  return (outer?.serializedStepGraph?.[outer.activePaths?.[0] ?? -1] as { id?: string } | undefined)?.id;
}

// Runs a two-round tool-calling turn to completion, copying the workflow store
// after every write.
async function captureCheckpoints(
  kind: AgentKind,
  usages?: TestUsage[],
  observability?: SpanRecorder,
  storageMode: StorageMode = 'in-memory',
) {
  const checkpoints: Checkpoint[] = [];
  const capture = (rows: SnapshotRow[]) => {
    checkpoints.push({
      outer: rows.find(row => row.workflowName === DurableStepIds.AGENTIC_LOOP)?.snapshot,
      inner: rows.find(row => row.workflowName !== DurableStepIds.AGENTIC_LOOP)?.snapshot,
      rows,
      endedSpanCount: observability?.ended.length ?? 0,
    });
  };
  const original = await startProcess(kind, usages, observability, storageMode, rows => {
    // The observer runs synchronously after a successful write, including partial
    // updates. Recover only from JSON actually committed at this boundary.
    capture(
      rows.map(({ workflowName, runId, resourceId, snapshot }) => ({
        workflowName,
        runId,
        resourceId,
        snapshot: JSON.parse(snapshot),
      })),
    );
  });
  if (storageMode === 'in-memory') {
    const rows = new Map<string, SnapshotRow>();
    const persist = original.workflows.persistWorkflowSnapshot.bind(original.workflows);
    original.workflows.persistWorkflowSnapshot = async args => {
      rows.set(`${args.workflowName}:${args.runId}`, structuredClone(args));
      capture([...rows.values()].map(row => structuredClone(row)));
      return persist(args);
    };
  }

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
  return { agent: original.durableAgent, checkpoints, runId: result.runId };
}

async function recoverFrom(
  checkpoint: Checkpoint,
  runId: string,
  kind: AgentKind,
  expectedUsage: TestUsage = { inputTokens: 30, outputTokens: 60, totalTokens: 90 },
  usages?: TestUsage[],
  observability?: SpanRecorder,
  storageMode: StorageMode = 'in-memory',
): Promise<string> {
  const { durableAgent, workflows, globalRunRegistry, pubsub } = await startProcess(
    kind,
    usages,
    observability,
    storageMode,
  );
  for (const row of checkpoint.rows) await workflows.persistWorkflowSnapshot(row);

  let finishEvents = 0;
  const countFinish = async (event: { type: string }, ack?: () => Promise<void>) => {
    if (event.type === AgentStreamEventTypes.FINISH) finishEvents++;
    await ack?.();
  };
  await pubsub.subscribe(AGENT_STREAM_TOPIC(runId), countFinish);
  let onFinishCalls = 0;

  const attempt = (async () => {
    const recovered = await durableAgent.recover(runId, { onFinish: () => void onFinishCalls++ });
    const execution = globalRunRegistry.get(runId)?.workflowExecution;
    const errors: string[] = [];
    // Read the answer from the finish payload: a checkpoint saved after the final
    // model turn recovers without streaming any text.
    let finalText: string | undefined;
    let finalUsage: unknown;
    for await (const chunk of recovered.fullStream) {
      if (chunk.type === 'error') errors.push(String((chunk.payload as any)?.error?.message ?? chunk.payload));
      if (chunk.type === 'finish') {
        finalText = String((chunk.payload.output as { text?: string }).text);
        finalUsage = (chunk.payload.output as { usage?: unknown }).usage;
      }
    }
    const executionError = await Promise.resolve(execution).then(
      () => undefined,
      (error: unknown) => String((error as Error)?.message ?? error),
    );
    if (errors.length) return `stream error: ${errors[0]}`;
    if (executionError) return `workflow error: ${executionError}`;
    if (finalText === undefined) return 'stream closed without finish';
    if (finishEvents !== 1) return `published FINISH ${finishEvents} times`;
    if (onFinishCalls !== 1) return `onFinish fired ${onFinishCalls} times`;
    const usage = finalUsage as TestUsage | undefined;
    if (
      usage?.inputTokens !== expectedUsage.inputTokens ||
      usage?.outputTokens !== expectedUsage.outputTokens ||
      usage?.totalTokens !== expectedUsage.totalTokens
    ) {
      return `finished with usage ${JSON.stringify(finalUsage)}`;
    }
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
    await pubsub.unsubscribe(AGENT_STREAM_TOPIC(runId), countFinish);
  }
}

describe('DurableAgent crash recovery', () => {
  it.each(['durable', 'evented-fallback'] as const)(
    'releases abandoned observers after later tool iterations (%s, COR-1496)',
    async kind => {
      const { checkpoints, runId } = await captureCheckpoints(kind);
      const later = checkpoints.filter(checkpoint =>
        checkpoint.rows.some(row => Number(row.snapshot.context?.input?.iterationCount) >= 1),
      );
      expect(later.length).toBeGreaterThan(0);
      for (const checkpoint of later) {
        const { durableAgent, workflows } = await startProcess(kind);
        for (const row of checkpoint.rows) await workflows.persistWorkflowSnapshot(row);
        expect(await durableAgent.__getRunLiveness(runId), describeCheckpoint(checkpoint)).toMatchObject({
          status: 'inactive',
        });
      }
    },
    60_000,
  );

  it.each(['before-finish', 'after-finish', 'after-scorers'] as const)(
    'finishes genuine evented recovery %s without repeating saved effects (COR-1354)',
    async boundary => {
      const runId = `evented-finish-${boundary}`;
      const effects: Array<{ generation: number; effect: 'model' | 'tool' | 'scorer' }> = [];
      const matchesBoundary = (snapshot: WorkflowRunState) => {
        if (snapshot.status !== 'running') return false;
        const results = snapshot.context;
        if (boundary === 'before-finish') {
          return (
            results?.[DurableStepIds.AGENTIC_EXECUTION]?.status === 'success' && !results?.[MAP_FINAL_OUTPUT_STEP_ID]
          );
        }
        if (boundary === 'after-finish') {
          return results?.[MAP_FINAL_OUTPUT_STEP_ID]?.status === 'success' && !results?.['execute-scorers'];
        }
        return results?.['execute-scorers']?.status === 'success';
      };
      const scenario = createRestartScenario({
        kind: 'evented',
        runId,
        timeoutMs: RECOVERY_TIMEOUT_MS,
        hold: { workflowName: DurableStepIds.AGENTIC_LOOP, when: matchesBoundary },
        build: ({ core, generation }) => {
          const record = (effect: 'model' | 'tool' | 'scorer') => effects.push({ generation, effect });
          const scorer = createScorer({ id: 'recovery-scorer', name: 'Recovery scorer' }).generateScore(() => {
            record('scorer');
            return 1;
          });
          return new core.Agent({
            id: 'evented-finish-agent',
            name: 'Evented finish agent',
            instructions: 'Use your tools.',
            model: createModel(undefined, () => void record('model')),
            tools: {
              lookup: core.createTool({
                id: 'lookup',
                description: 'Look something up',
                inputSchema: z.object({ index: z.number() }),
                execute: async () => {
                  record('tool');
                  return { ok: true };
                },
              }),
            },
            scorers: { recovery: { scorer, sampling: { type: 'ratio', rate: 1 } } },
          });
        },
      });
      const original = await scenario.start(async ({ agent }) =>
        consumeText(await agent.stream('Look two things up', { runId })),
      );
      try {
        expect(original.graph.agent.getWorkflow().engineType).toBe('evented');
        let held = false;
        void original.held.then(() => (held = true));
        await vi.waitFor(() => expect(held).toBe(true), { timeout: RECOVERY_TIMEOUT_MS });
        const checkpoint = await original.checkpoint();
        const snapshot = findRow(checkpoint, DurableStepIds.AGENTIC_LOOP, runId)?.snapshot;
        expect(snapshot && matchesBoundary(snapshot)).toBe(true);
        expect(effects.filter(e => e.generation === 1 && e.effect === 'model')).toHaveLength(3);
        expect(effects.filter(e => e.generation === 1 && e.effect === 'tool')).toHaveLength(2);
        if (boundary === 'after-scorers') {
          await vi.waitFor(
            () => expect(effects.filter(e => e.generation === 1 && e.effect === 'scorer')).toHaveLength(1),
            { timeout: RECOVERY_TIMEOUT_MS },
          );
        }
        const recovered = await scenario.restart(checkpoint);
        expect(recovered.graph.agent.getWorkflow().engineType).toBe('evented');
        expect(recovered.executionError).toBeUndefined();
        expect(recovered.streamErrors).toEqual([]);
        expect(recovered.text).toBe('done');
        expect(recovered.usage).toMatchObject({ inputTokens: 30, outputTokens: 60, totalTokens: 90 });
        expect(recovered.chunkTypes.filter(type => type === 'finish')).toHaveLength(1);
        expect(recovered.finishEvents).toBe(1);
        expect(recovered.onFinishCalls).toBe(1);
        if (boundary !== 'after-scorers') {
          await vi.waitFor(
            () => expect(effects.filter(e => e.generation === 2 && e.effect === 'scorer')).toHaveLength(1),
            { timeout: RECOVERY_TIMEOUT_MS },
          );
        }
        expect(effects.filter(e => e.generation === 2)).toEqual(
          boundary === 'after-scorers' ? [] : [{ generation: 2, effect: 'scorer' }],
        );
        original.releaseHold();
        await original.settled;
        expect(recovered.finishEvents).toBe(1);
        expect(recovered.onFinishCalls).toBe(1);
      } finally {
        original.releaseHold();
        await scenario.stop();
      }
    },
    30_000,
  );

  it.each<StorageMode>(['in-memory', 'serializing'])(
    'recovers from every checkpoint of a tool-calling run (%s)',
    async storageMode => {
      const { checkpoints, runId } = await captureCheckpoints('durable', undefined, undefined, storageMode);

      const recoverable = checkpoints.filter(checkpoint => !knownUnrecoverable(checkpoint));
      // Each case the trimming used to break must be among the recovered checkpoints.
      const inner = (c: Checkpoint) => c.inner?.status === 'running';
      expect(recoverable.some(c => inner(c) && activeStepIds(c.inner).includes(DurableStepIds.TOOL_CALL))).toBe(true);
      expect(recoverable.some(c => inner(c) && activeStepIds(c.inner).length === 0)).toBe(true);
      expect(recoverable.some(c => inner(c) && activeStepIds(c.outer).length === 0)).toBe(true);
      // FINISH already went out: once with map-final-output as the step to resume
      // from, once with scorer execution running.
      const targets = (id: string) => recoverable.some(c => finishedBeforeCrash(c) && outerTargetId(c) === id);
      expect(targets(MAP_FINAL_OUTPUT_STEP_ID)).toBe(true);
      expect(targets('execute-scorers')).toBe(true);

      const failures: string[] = [];
      for (const [index, checkpoint] of checkpoints.entries()) {
        if (knownUnrecoverable(checkpoint)) continue;
        const outcome = await recoverFrom(checkpoint, runId, 'durable', undefined, undefined, undefined, storageMode);
        if (outcome !== 'ok') failures.push(`#${index} ${describeCheckpoint(checkpoint)}: ${outcome}`);
      }
      expect(failures).toEqual([]);
      expect(checkpoints.length - recoverable.length).toBeLessThanOrEqual(3);
    },
    120_000,
  );

  it('preserves unknown usage from before recovery', async () => {
    const unknownUsage: TestUsage = { inputTokens: undefined, outputTokens: undefined, totalTokens: undefined };
    const usages = [unknownUsage, completeUsage, completeUsage];
    const { checkpoints, runId } = await captureCheckpoints('durable', usages);

    const failures: string[] = [];
    for (const [index, checkpoint] of checkpoints.entries()) {
      if (knownUnrecoverable(checkpoint)) continue;
      const outcome = await recoverFrom(checkpoint, runId, 'durable', unknownUsage, usages);
      if (outcome !== 'ok') failures.push(`#${index} ${describeCheckpoint(checkpoint)}: ${outcome}`);
    }
    expect(failures).toEqual([]);
  }, 120_000);

  // #25718: the recovered AGENT_RUN nests under the original, and the stored
  // trace keeps exactly one root, which has ended.
  it('stores a single-rooted trace after recovering from every checkpoint', async () => {
    const original = new SpanRecorder('orig');
    const { checkpoints, runId } = await captureCheckpoints('durable', undefined, original);

    const failures: string[] = [];
    for (const [index, checkpoint] of checkpoints.entries()) {
      if (knownUnrecoverable(checkpoint)) continue;
      const recovery = new SpanRecorder(`rec${index}`);
      const outcome = await recoverFrom(checkpoint, runId, 'durable', undefined, undefined, recovery);
      const stored = storedSpans([...original.ended.slice(0, checkpoint.endedSpanCount), ...recovery.ended]);
      const roots = stored.filter(span => !span.parentSpanId);
      const recovered = stored.find(span => span.name.includes('(recovered)'));
      const problem =
        outcome !== 'ok'
          ? outcome
          : roots.length !== 1
            ? `${roots.length} root spans: ${roots.map(span => span.name).join(', ')}`
            : roots[0]!.type !== 'agent_run'
              ? `root is ${roots[0]!.type}`
              : !recovered
                ? 'recovered AGENT_RUN span never ended'
                : recovered.parentSpanId !== roots[0]!.id
                  ? 'recovered AGENT_RUN span is not a child of the root'
                  : undefined;
      if (problem) failures.push(`#${index} ${describeCheckpoint(checkpoint)}: ${problem}`);
    }
    expect(failures).toEqual([]);
  }, 120_000);

  // The fallback agent reports the evented engine but runs on the default one,
  // which skips the finished map-final-output on restart. Recovery must still
  // publish FINISH, or the recovered stream hangs.
  it('finishes the recovered stream of an EventedAgent that fell back to the default engine', async () => {
    const { agent, checkpoints, runId } = await captureCheckpoints('evented-fallback');
    expect((agent.getWorkflow() as any).engineType).toBe('default');

    const afterFinish = checkpoints.filter(c => !knownUnrecoverable(c) && finishedBeforeCrash(c));
    expect(afterFinish.some(c => outerTargetId(c) === MAP_FINAL_OUTPUT_STEP_ID)).toBe(true);
    expect(afterFinish.some(c => outerTargetId(c) === 'execute-scorers')).toBe(true);

    const failures: string[] = [];
    for (const checkpoint of afterFinish) {
      const outcome = await recoverFrom(checkpoint, runId, 'evented-fallback');
      if (outcome !== 'ok') failures.push(`${describeCheckpoint(checkpoint)}: ${outcome}`);
    }
    expect(failures).toEqual([]);
  }, 60_000);
});
