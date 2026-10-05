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
 *    - after every write: `original.checkpoints` holds one copy per snapshot
 *      write, so a test can restart from each of them.
 * 3. `restart(checkpoint)` builds graph 2 the same way, seeds a new store with
 *    the copied rows and recovers the run (`recover(runId)` for agents,
 *    `run.restart()` for workflows).
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
 * What this simulates: a new process that shares nothing in memory with the
 * crashed one. Graph 2 has its own module singletons (`globalRunRegistry`,
 * local recovery claims, the default pubsub), its own `Mastra` and a store
 * that only holds what graph 1 had written at the checkpoint.
 *
 * What it does not simulate: process death. Graph 1 keeps running in the
 * same Node process — its blocked promises, timers and objects stay alive.
 * They cannot reach graph 2 because the two graphs share no store, pubsub or
 * module state, but they still consume CPU and can log. Release graph 1's
 * gates when the test ends. Only workflow rows are copied: memory threads,
 * observability and other storage domains start empty in graph 2.
 */

import { expect, vi } from 'vitest';
import type { WorkflowRunState } from '../../../workflows/types';
import type { Agent } from '../../agent';
import { AGENT_STREAM_TOPIC, AgentStreamEventTypes, DurableStepIds } from '../constants';

export type RestartKind = 'durable' | 'evented' | 'evented-fallback' | 'workflow';

const DEFAULT_TIMEOUT_MS = 10_000;

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

export type ScenarioOptions<K extends RestartKind> = {
  kind: K;
  /** Pass explicit ids: core's Vitest setup stubs `crypto.randomUUID()`. */
  runId: string;
  /** Builds the agent (a plain `Agent`, wrapped per `kind`) or the committed workflow. Called once per graph. */
  build: K extends 'workflow' ? WorkflowBuild : AgentBuild;
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

  if (options.kind === 'workflow') {
    const mastra = new core.Mastra({ logger: false, storage, workflows: { [built.id]: built } });
    if (built.engineType === 'evented') await mastra.startWorkers();
    const workflows = await mastra.getStorage()!.getStore('workflows');
    return { core, mastra, storage, workflows, generation, workflow: mastra.getWorkflowById(built.id) };
  }

  const agent =
    options.kind === 'durable' ? core.createDurableAgent({ agent: built }) : core.createEventedAgent({ agent: built });
  // Before `new Mastra(...)`: the engine resolves during agent registration.
  if (options.kind === 'evented-fallback') {
    vi.spyOn(storage.stores.workflows!, 'supportsConcurrentUpdates').mockReturnValue(false);
  }
  const mastra = new core.Mastra({
    logger: false,
    storage,
    agents: { [built.id]: agent as any },
    recovery: { durableAgents: 'auto' },
  });
  const expectedEngine = options.kind === 'evented' ? 'evented' : 'default';
  expect((agent.getWorkflow() as { engineType?: string }).engineType).toBe(expectedEngine);
  const workflows = await mastra.getStorage()!.getStore('workflows');
  return { core, mastra, storage, workflows, generation, agent };
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
  /** FINISH events published on the run's agent stream topic in graph 2. */
  finishEvents: number;
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
  let generation = 0;

  return {
    /** Builds graph 1, records a copy of its workflow rows after every write, and starts the run. */
    async start(drive: (ctx: Graph & { runId: string }) => Promise<unknown>) {
      const graph = await buildGraph(options, ++generation);
      const checkpoints: Checkpoint[] = [];
      for (const method of WRITE_METHODS) {
        const original = graph.workflows[method].bind(graph.workflows);
        graph.workflows[method] = async (...args: unknown[]) => {
          const result = await original(...args);
          checkpoints.push({ rows: await copyRows(graph.workflows), write: checkpoints.length + 1 });
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
        /** A copy of graph 1's workflow rows right now (gate checkpoint). */
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
        const executionError = await Promise.resolve(execution).then(
          () => undefined,
          (error: unknown) => String((error as Error)?.message ?? error),
        );
        recovered.cleanup?.();
        return { text, usage, streamErrors, chunkTypes, executionError };
      })();
      const outcome = await withTimeout(attempt, timeoutMs, `recover(${options.runId})`);
      return { ...outcome, finishEvents, onFinishCalls, graph };
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
