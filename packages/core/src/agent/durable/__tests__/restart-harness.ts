/**
 * Restart a durable run from a checkpoint in a fresh module graph.
 *
 * A scenario runs the same agent or workflow in two module graphs:
 *
 * 1. `start(drive)` builds graph 1 (`vi.resetModules()` + fresh imports, a new
 *    `InMemoryStore`, a new `Mastra`) and starts the run without awaiting it.
 * 2. A checkpoint copies graph 1's workflow rows, either
 *    - at a gate: the test blocks a tool or step on a promise it controls and
 *      calls `original.checkpoint()` once the gate is reached, or
 *    - at a held write: `hold.when(snapshot)` picks the write to park inside, so
 *      the cut lands between two persisted states (after a step's success is
 *      saved but before the next one starts), or
 *    - after every write: `original.checkpoints` holds one copy per snapshot
 *      write, so a test can restart from each of them.
 * 3. `restart(checkpoint)` builds graph 2 the same way, seeds its new store with
 *    everything graph 1 had persisted — the checkpoint's workflow rows *and*
 *    every other storage domain's data — and recovers the run
 *    (`recover(runId)` for agents, `run.restart()` for workflows).
 *
 * @example Gate checkpoint
 * ```ts
 * const gate = createGate();
 * const scenario = createRestartScenario({
 *   kind: 'durable',
 *   runId: 'run-1',
 *   build: ({ core, generation }) => new core.Agent({ ...tools that await gate.wait() when generation === 1 }),
 * });
 * const original = await scenario.start(({ agent, runId }) => agent.stream('hi', { runId }));
 * await gate.reached;
 * const recovered = await scenario.restart(await original.checkpoint());
 * expect(recovered.finishEvents).toBe(1);
 * ```
 *
 * @example Every-write checkpoints
 * ```ts
 * const original = await scenario.start(drive);
 * await original.settled;
 * for (const checkpoint of original.checkpoints.filter(hasRunningRow)) await scenario.restart(checkpoint);
 * ```
 *
 * @example Held-write checkpoint
 * ```ts
 * const scenario = createRestartScenario({
 *   kind: 'workflow',
 *   runId: 'wf-1',
 *   build: ({ core }) => stepsAThenB(core),
 *   // The cut point: the write that saved `a`, before `b` starts.
 *   hold: { when: snapshot => snapshot.context?.a?.status === 'success' && !snapshot.context?.b },
 * });
 * const original = await scenario.start(drive);
 * await original.held; // the engine is parked inside that write
 * const recovered = await scenario.restart(await original.checkpoint());
 * ```
 *
 * What this simulates: a new process that shares no *module* state with the
 * crashed one. Graph 2 has its own module singletons (`globalRunRegistry`,
 * local recovery claims, the default pubsub), its own `Mastra` and a store
 * that only holds what graph 1 had written at the checkpoint. Closures the
 * test itself supplies to both graphs — gates, tool logs, model probes — are
 * deliberately shared, and are the only channel between the two.
 *
 * What it does not simulate: process death. Graph 1 keeps running in the
 * same Node process — its blocked promises, timers and objects stay alive.
 * It cannot reach graph 2 because the graphs share no store, pubsub or module
 * state, but it still consumes CPU and can log. Release graph 1's gates when
 * the test ends.
 *
 * What graph 2's store holds: the checkpoint's workflow rows, and the rest of
 * graph 1's storage copied as of the `restart()` call. For the two cut modes
 * that park graph 1 (a gate, a held write) those are the same moment. For an
 * every-write checkpoint that is not the one being restarted, the non-workflow
 * domains are a little ahead of that checkpoint — workflow rows still come from
 * the checkpoint itself.
 */

import { expect, vi } from 'vitest';
import type { WorkflowRunState } from '../../../workflows/types';
import type { Agent } from '../../agent';
import { AGENT_STREAM_TOPIC, AgentStreamEventTypes, DurableStepIds } from '../constants';

export type RestartKind = 'durable' | 'evented' | 'evented-fallback' | 'workflow';

/**
 * How long a scenario waits for a restart to settle. Also the budget tests pass
 * to `vi.waitFor`, which otherwise gives up after 1s — under load the engine can
 * take longer than that to delete a finished run's snapshot.
 */
export const DEFAULT_TIMEOUT_MS = 10_000;

/** One module graph: every import a scenario needs, loaded after `vi.resetModules()`. */
export async function loadGraph() {
  vi.resetModules();
  const [
    { Mastra },
    { InMemoryStore },
    { Agent },
    { createTool },
    { createDurableAgent },
    { createEventedAgent },
    { globalRunRegistry },
    workflows,
    eventedWorkflows,
  ] = await Promise.all([
    import('../../../mastra'),
    import('../../../storage'),
    import('../../agent'),
    import('../../../tools'),
    import('../create-durable-agent'),
    import('../create-evented-agent'),
    import('../run-registry'),
    import('../../../workflows'),
    import('../../../workflows/evented'),
  ]);
  return {
    Mastra,
    InMemoryStore,
    Agent,
    createTool,
    createDurableAgent,
    createEventedAgent,
    globalRunRegistry,
    createWorkflow: workflows.createWorkflow,
    createStep: workflows.createStep,
    createEventedWorkflow: eventedWorkflows.createWorkflow,
    createEventedStep: eventedWorkflows.createStep,
  };
}

export type CoreGraph = Awaited<ReturnType<typeof loadGraph>>;

export type SnapshotRow = {
  workflowName: string;
  runId: string;
  resourceId?: string;
  snapshot: WorkflowRunState;
};

export type Checkpoint = {
  /**
   * Every workflow row as it stood when the copy was taken.
   *
   * The copy is read from storage *after* the write that triggered it completes,
   * so a concurrent write that lands in between is included: two checkpoints with
   * distinct `write` indexes can therefore describe the same later state. Exact
   * per-write coverage of concurrently written steps is not guaranteed.
   */
  rows: SnapshotRow[];
  /** 1-based index of the write this copy was taken after; 0 for a gate checkpoint. */
  write: number;
};

/** A test-controlled promise that blocks a tool or step until released. */
export function createGate() {
  let markReached!: () => void;
  let release!: () => void;
  const reached = new Promise<void>(resolve => (markReached = resolve));
  const released = new Promise<void>(resolve => (release = resolve));
  let waiters = 0;
  return {
    /** Resolves when something first waits on the gate. */
    reached,
    get waiters() {
      return waiters;
    },
    wait() {
      waiters++;
      markReached();
      return released;
    },
    release() {
      release();
    },
  };
}

export type Gate = ReturnType<typeof createGate>;

type BuildContext = { core: CoreGraph; generation: number };

type AgentBuild = (ctx: BuildContext) => Agent<any, any, any>;
type WorkflowBuild = (ctx: BuildContext) => any;

/**
 * A cut point between two persisted states: the first write to the workflow's
 * row that leaves a snapshot matching `when` is parked inside — it has landed,
 * but the engine does not get past the call. The cut is therefore deterministic
 * (no polling, no timers) and graph 1 cannot advance while `original.held` is
 * pending.
 */
export type HoldWrite = {
  /**
   * Only writes to this workflow's rows are inspected. Defaults to the
   * scenario's root workflow: the agent's agentic loop, or the workflow itself.
   * A nested workflow's writes need its own id.
   */
  workflowName?: string;
  when: (snapshot: WorkflowRunState) => boolean;
};

export type ScenarioOptions<K extends RestartKind> = {
  kind: K;
  /** Pass explicit ids: core's Vitest setup stubs `crypto.randomUUID()`. */
  runId: string;
  /** Builds the agent (a plain `Agent`, wrapped per `kind`) or the committed workflow. Called once per graph. */
  build: K extends 'workflow' ? WorkflowBuild : AgentBuild;
  /** Park graph 1 inside the write that leaves the snapshot this picks out. */
  hold?: HoldWrite;
  timeoutMs?: number;
};

export type Graph = {
  /** The wrapped durable/evented agent (agent kinds). */
  agent?: any;
  /** The registered workflow (workflow kind). */
  workflow?: any;
  core: CoreGraph;
  mastra: any;
  storage: any;
  workflows: any;
  generation: number;
};

async function buildGraph<K extends RestartKind>(options: ScenarioOptions<K>, generation: number): Promise<Graph> {
  const core = await loadGraph();
  const storage = new core.InMemoryStore();
  const built = options.build({ core, generation } as BuildContext);
  let mastra: any;
  try {
    if (options.kind === 'workflow') {
      mastra = new core.Mastra({ logger: false, storage, workflows: { [built.id]: built } });
      if (built.engineType === 'evented') await mastra.startWorkers();
      const workflows = await mastra.getStorage()!.getStore('workflows');
      return { core, mastra, storage, workflows, generation, workflow: mastra.getWorkflowById(built.id) };
    }

    const agent =
      options.kind === 'durable'
        ? core.createDurableAgent({ agent: built })
        : core.createEventedAgent({ agent: built });
    // Before `new Mastra(...)`: the engine resolves during agent registration.
    if (options.kind === 'evented-fallback') {
      vi.spyOn(storage.stores.workflows!, 'supportsConcurrentUpdates').mockReturnValue(false);
    }
    mastra = new core.Mastra({
      logger: false,
      storage,
      agents: { [built.id]: agent as any },
      recovery: { durableAgents: 'auto' },
    });
    const expectedEngine = options.kind === 'evented' ? 'evented' : 'default';
    expect((agent.getWorkflow() as { engineType?: string }).engineType).toBe(expectedEngine);
    const workflows = await mastra.getStorage()!.getStore('workflows');
    return { core, mastra, storage, workflows, generation, agent };
  } catch (error) {
    // A graph that fails to build must not leak the event workers it already started, and a failure
    // to stop them must not hide why the build failed.
    try {
      await mastra?.stopWorkers?.();
    } catch {
      // keep the construction error
    }
    throw error;
  }
}

async function copyRows(workflows: any): Promise<SnapshotRow[]> {
  const { runs } = await workflows.listWorkflowRuns();
  return runs.map((run: any) =>
    structuredClone({
      workflowName: run.workflowName,
      runId: run.runId,
      resourceId: run.resourceId,
      snapshot: typeof run.snapshot === 'string' ? JSON.parse(run.snapshot) : run.snapshot,
    }),
  );
}

/**
 * Copy everything graph 1 had persisted into graph 2's fresh store.
 *
 * Graph 2 needs its own store, otherwise graph 1 could keep writing into the
 * one the recovered run reads. But a run is not only its workflow rows: a test
 * that asserts on memory, scores or traces after a restart needs what graph 1
 * wrote to those domains too.
 *
 * `InMemoryStore` keeps all of it in one shared `InMemoryDB` whose fields are
 * public Maps, arrays and counters, and the domains hold a reference to it
 * (`private` in TypeScript, the same object at runtime). Storage exposes no
 * public dump, so this clones that object — in one `structuredClone` call, so
 * aliasing inside it survives, such as the observability cursor maps keyed by
 * the very record objects held in its arrays — and refills the new store's db
 * field by field. Maps and arrays are refilled in place because the domains
 * captured their references at construction.
 *
 * Workflow rows are left to the caller: they come from the checkpoint being
 * restarted, which is not necessarily the store's current state.
 */
function copyStore(from: any, to: any) {
  const source = (from.stores.workflows as any)?.db;
  const target = (to.stores.workflows as any)?.db;
  if (!source || !target) throw new Error('copyStore: expected an InMemoryStore with a shared db');
  const snapshot = structuredClone(source) as Record<string, any>;
  for (const [key, value] of Object.entries(snapshot)) {
    if (key === 'workflows') continue;
    const existing = target[key];
    if (value instanceof Map && existing instanceof Map) {
      existing.clear();
      for (const [k, v] of value) existing.set(k, v);
    } else if (Array.isArray(value) && Array.isArray(existing)) {
      existing.splice(0, existing.length, ...value);
    } else {
      // Drop the readonly marker on the class field; the values are plain data.
      (target as Record<string, any>)[key] = value;
    }
  }
}

const WRITE_METHODS = [
  'persistWorkflowSnapshot',
  'updateWorkflowState',
  'updateWorkflowResults',
  'deleteWorkflowRunById',
] as const;

/** The row a restart resumes from: the agent's outer loop, or the workflow itself. */
export function rootWorkflowName(kind: RestartKind, graph: { workflow?: any }) {
  return kind === 'workflow' ? graph.workflow.id : DurableStepIds.AGENTIC_LOOP;
}

export function findRow(checkpoint: Checkpoint, workflowName: string, runId: string) {
  return checkpoint.rows.find(row => row.workflowName === workflowName && row.runId === runId);
}

export type AgentRestartResult = {
  /** Text of the finish chunk; a run recovered after its last model turn streams no text deltas. */
  text?: string;
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  /** FINISH events published on the run's agent stream topic in graph 2. Live: reads the current count. */
  finishEvents: number;
  /** `onFinish` callbacks seen in graph 2. Live: reads the current count. */
  onFinishCalls: number;
  streamErrors: string[];
  executionError?: string;
  chunkTypes: string[];
};

export type WorkflowRestartResult = {
  /** What `run.restart()` resolved to. */
  result: any;
};

/** Agent kinds fill the agent fields, the workflow kind fills `result`. */
export type RestartResult = Partial<AgentRestartResult> & Partial<WorkflowRestartResult> & { graph: Graph };

function withTimeout<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} did not settle within ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export function createRestartScenario<K extends RestartKind>(options: ScenarioOptions<K>) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const graphs: Graph[] = [];
  const holds: Gate[] = [];
  let generation = 0;

  return {
    /** Builds graph 1, records a copy of its workflow rows after every write, and starts the run. */
    async start(drive: (ctx: Graph & { runId: string }) => Promise<unknown>) {
      const graph = await buildGraph(options, ++generation);
      graphs.push(graph);
      const checkpoints: Checkpoint[] = [];
      // A monotonic counter, not `checkpoints.length`: concurrent writes interleave
      // at the await, and duplicate `write` indexes would make them indistinguishable.
      let writes = 0;
      // `hold` parks one write; the gate is what `original.held` waits on.
      const holdGate = options.hold ? createGate() : undefined;
      if (holdGate) holds.push(holdGate);
      const target = options.hold ? (options.hold.workflowName ?? rootWorkflowName(options.kind, graph)) : undefined;
      let held = false;
      for (const method of WRITE_METHODS) {
        const original = graph.workflows[method].bind(graph.workflows);
        graph.workflows[method] = async (...args: unknown[]) => {
          const result = await original(...args);
          checkpoints.push({ rows: await copyRows(graph.workflows), write: ++writes });
          if (held || !options.hold || !holdGate) return result;
          const { workflowName, runId } = (args[0] ?? {}) as { workflowName?: string; runId?: string };
          // Match on the workflow name only: a hold aimed at a nested workflow (its own id and
          // own run id) must be able to park too, so the run id is not filtered here.
          if (workflowName !== target || !runId) return result;
          const row = await graph.workflows.getWorkflowRunById({ workflowName: target, runId });
          const snapshot: WorkflowRunState | undefined =
            typeof row?.snapshot === 'string' ? JSON.parse(row.snapshot) : row?.snapshot;
          if (!snapshot || !options.hold.when(snapshot)) return result;
          held = true;
          // The write has landed; the engine does not get past the call until the
          // test releases the hold, so nothing else can be persisted meanwhile.
          // Wait first, then hand back the original result: `updateWorkflowState`
          // and `updateWorkflowResults` return data the engine reads, and releasing
          // the hold must not turn that into `undefined`.
          await holdGate.wait();
          return result;
        };
      }
      const value = drive({ ...graph, runId: options.runId });
      // Settles when the drive call does; for agents that is when the stream is
      // set up, so await `consume()` to follow the run itself.
      const settled = value.then(
        result => ({ status: 'fulfilled' as const, result }),
        (error: unknown) => ({ status: 'rejected' as const, error }),
      );
      return {
        graph,
        driven: value,
        settled,
        /** Every-write copies, in write order. */
        checkpoints,
        /** Resolves once graph 1 is parked in the write `hold.when` picked. Never resolves without a `hold`. */
        releaseHold: () => holdGate?.release(),
        get held() {
          return holdGate?.reached;
        },
        /** A copy of graph 1's workflow rows right now (gate or held-write checkpoint). */
        checkpoint: async (): Promise<Checkpoint> => ({ rows: await copyRows(graph.workflows), write: 0 }),
      };
    },

    /**
     * Builds a fresh graph on a store seeded with the checkpoint's rows and
     * recovers the run. Fails if the checkpoint has no running row to recover
     * from, so a test cannot pass by recovering nothing.
     */
    async restart(checkpoint: Checkpoint): Promise<RestartResult> {
      const graph = await buildGraph(options, ++generation);
      graphs.push(graph);
      // Graph 1 is the one that ran; every later graph is seeded from it, not from a previous restart.
      copyStore(graphs[0]!.storage, graph.storage);
      const rootName = rootWorkflowName(options.kind, graph);
      const root = findRow(checkpoint, rootName, options.runId);
      if (root?.snapshot.status !== 'running') {
        throw new Error(
          `restart: checkpoint has no running ${rootName} row for run ${options.runId} ` +
            `(found ${root ? root.snapshot.status : 'none'}; rows: ${checkpoint.rows.map(r => `${r.workflowName}:${r.snapshot.status}`).join(', ') || 'none'})`,
        );
      }
      for (const row of checkpoint.rows) await graph.workflows.persistWorkflowSnapshot(structuredClone(row));

      if (options.kind === 'workflow') {
        const run = await graph.workflow.createRun({ runId: options.runId });
        const result = await withTimeout(run.restart(), timeoutMs, `restart(${options.runId})`);
        return { result, graph };
      }

      const agent = graph.agent;
      let finishEvents = 0;
      await graph.mastra.pubsub.subscribe(
        AGENT_STREAM_TOPIC(options.runId),
        async (event: { type: string }, ack?: () => Promise<void>) => {
          if (event.type === AgentStreamEventTypes.FINISH) finishEvents++;
          await ack?.();
        },
      );
      let onFinishCalls = 0;
      const attempt = (async () => {
        const recovered = await agent.recover(options.runId, { onFinish: () => void onFinishCalls++ });
        // Read while the run is live: the registry entry is cleared on cleanup.
        const execution = graph.core.globalRunRegistry.get(options.runId)?.workflowExecution;
        const streamErrors: string[] = [];
        const chunkTypes: string[] = [];
        let text: string | undefined;
        let usage: AgentRestartResult['usage'];
        for await (const chunk of recovered.fullStream) {
          chunkTypes.push(chunk.type);
          if (chunk.type === 'error') streamErrors.push(String(chunk.payload?.error?.message ?? chunk.payload));
          if (chunk.type === 'finish') {
            text = chunk.payload.output?.text;
            usage = chunk.payload.output?.usage;
          }
        }
        // An absent entry would make `expect(executionError).toBeUndefined()`
        // assert nothing, so report it as an error instead.
        const executionError =
          execution === undefined
            ? 'run registry entry missing after recovery'
            : await Promise.resolve(execution).then(
                () => undefined,
                (error: unknown) => String((error as Error)?.message ?? error),
              );
        recovered.cleanup?.();
        return { text, usage, streamErrors, chunkTypes, executionError };
      })();
      const outcome = await withTimeout(attempt, timeoutMs, `recover(${options.runId})`);
      // `finishEvents`/`onFinishCalls` are getters so a test can assert them
      // after releasing graph 1, catching a late publish that leaked across.
      const result = { ...outcome, graph } as RestartResult;
      Object.defineProperty(result, 'finishEvents', { get: () => finishEvents });
      Object.defineProperty(result, 'onFinishCalls', { get: () => onFinishCalls });
      return result;
    },

    /** Call at the end of a test to stop the event workers every graph started. */
    async stop() {
      // Release holds first: a parked write blocks the execution `stopWorkers()`
      // awaits, so stopping before releasing would deadlock.
      for (const hold of holds.splice(0)) hold.release();
      for (const graph of graphs) await graph.mastra?.stopWorkers?.();
    },
  };
}

/** Drains an agent stream result from graph 1 and returns its text. */
export async function consumeText(result: { fullStream: AsyncIterable<any> }) {
  let text = '';
  for await (const chunk of result.fullStream) {
    if (chunk.type === 'text-delta') text += chunk.payload.text;
  }
  return text;
}
