import { RequestContext } from '@mastra/core/di';
import { PubSub } from '@mastra/core/events';
import type { Event, EventCallback } from '@mastra/core/events';
import { ToolStream } from '@mastra/core/tools';
import type {
  ExecutionGraph,
  SerializedStepFlowEntry,
  Step,
  StepFlowEntry,
  WorkflowRunState,
} from '@mastra/core/workflows';
import { PUBSUB_SYMBOL, STREAM_FORMAT_SYMBOL } from '@mastra/core/workflows/_constants';
import { getWorkflowMetadata, getWritable } from 'workflow';
import { FINALIZE_IDENTITY, MASTRA_EVENT_NAMESPACE } from './constants';
import { requireRegisteredWorkflow } from './registry';
import { readSdkRunId, withSdkRunId } from './snapshot';
import type { MastraOp, MastraOpRequest, MastraOpResponse, SerializedOpError } from './types';

/**
 * Host-side execution of a single Mastra callable.
 *
 * Reached only through the dynamic `import()` in `workflows/steps.ts`, so this
 * module — and everything it pulls in from `@mastra/core` — stays out of the
 * sandboxed workflow bundle.
 */

/**
 * Stand-in for the `PubSub` that Mastra's own engines hand to steps.
 *
 * Watch events reach subscribers through the Workflow SDK run stream instead, driven
 * by the walker so ordering is deterministic across replays. Accepting the
 * publishes and dropping them keeps steps that publish opportunistically from
 * crashing, without emitting each event twice.
 */
class InertPubSub extends PubSub {
  async publish(_topic: string, _event: Omit<Event, 'id' | 'createdAt'>): Promise<void> {}
  async subscribe(_topic: string, _cb: EventCallback): Promise<void> {}
  async unsubscribe(_topic: string, _cb: EventCallback): Promise<void> {}
  async flush(): Promise<void> {}
}

function serializeError(error: unknown): SerializedOpError {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
      // `MastraNonRetryableError` is matched by name so the check keeps working
      // whether the error came from core or was re-thrown across a boundary.
      nonRetryable:
        error.name === 'MastraNonRetryableError' || (error as { nonRetryable?: boolean }).nonRetryable === true,
    };
  }
  return { message: String(error) };
}

/** Walks `executionGraph.steps` to the entry a {@link MastraOp} addresses. */
function resolveEntry(graph: ExecutionGraph, path: number[]): StepFlowEntry {
  const [head, ...rest] = path;
  let entry: StepFlowEntry | undefined = graph.steps[head ?? -1];
  if (!entry) {
    throw new Error(`No step graph entry at index ${head} (path ${JSON.stringify(path)})`);
  }
  for (const index of rest) {
    if (entry.type !== 'parallel' && entry.type !== 'conditional') {
      throw new Error(
        `Cannot descend into a "${entry.type}" entry (path ${JSON.stringify(path)}). ` +
          `Only parallel and conditional entries have branches.`,
      );
    }
    const branch: StepFlowEntry | undefined = entry.steps[index];
    if (!branch) {
      throw new Error(`No branch at index ${index} (path ${JSON.stringify(path)})`);
    }
    entry = branch;
  }
  return entry;
}

/** Returns the `Step` an op addresses, for the op kinds that target one. */
function resolveStep(entry: StepFlowEntry, path: number[]): Step<any, any, any, any, any, any, any, any> {
  if (entry.type === 'step' || entry.type === 'loop' || entry.type === 'foreach') {
    return entry.step;
  }
  throw new Error(`Entry at ${JSON.stringify(path)} is a "${entry.type}" and has no single step`);
}

interface ResolvedCallable {
  /** The function to invoke with a Mastra execution context. */
  fn: (params: any) => Promise<unknown>;
  /** Step whose schemas and id describe this call, when there is one. */
  step?: Step<any, any, any, any, any, any, any, any>;
  /** Identifier used for logging and stream naming. */
  id: string;
}

/** See `MastraOpResponseBase.identity`. */
function opIdentity(op: MastraOp, resolvedId: string): string {
  return `${op.kind}@${op.path.join('.')}#${resolvedId}`;
}

function resolveCallable(graph: ExecutionGraph, op: MastraOp): ResolvedCallable {
  const entry = resolveEntry(graph, op.path);

  switch (op.kind) {
    case 'step': {
      const step = resolveStep(entry, op.path);
      return { fn: step.execute as (params: any) => Promise<unknown>, step, id: step.id };
    }
    case 'condition': {
      if (entry.type !== 'conditional') {
        throw new Error(`Expected a conditional entry at ${JSON.stringify(op.path)}, got "${entry.type}"`);
      }
      const condition = entry.conditions[op.conditionIndex];
      if (!condition) {
        throw new Error(`No condition at index ${op.conditionIndex} of ${JSON.stringify(op.path)}`);
      }
      return {
        fn: condition as (params: any) => Promise<unknown>,
        id: `condition_${op.conditionIndex}`,
      };
    }
    case 'loop-condition': {
      if (entry.type !== 'loop') {
        throw new Error(`Expected a loop entry at ${JSON.stringify(op.path)}, got "${entry.type}"`);
      }
      return { fn: entry.condition as (params: any) => Promise<unknown>, id: `${entry.step.id}_condition` };
    }
    case 'sleep-duration':
    case 'sleep-until-date': {
      if (entry.type !== 'sleep' && entry.type !== 'sleepUntil') {
        throw new Error(`Expected a sleep entry at ${JSON.stringify(op.path)}, got "${entry.type}"`);
      }
      if (!entry.fn) {
        throw new Error(`Sleep entry "${entry.id}" has no resolver function`);
      }
      return { fn: entry.fn as (params: any) => Promise<unknown>, id: entry.id };
    }
    case 'foreach-concurrency': {
      if (entry.type !== 'foreach') {
        throw new Error(`Expected a foreach entry at ${JSON.stringify(op.path)}, got "${entry.type}"`);
      }
      const resolver = entry.opts.concurrency;
      if (typeof resolver !== 'function') {
        throw new Error(`Foreach entry "${entry.step.id}" has a static concurrency, not a resolver`);
      }
      return { fn: async (params: any) => resolver(params), id: `${entry.step.id}_concurrency` };
    }
    default: {
      const exhaustive = op as { kind: string };
      throw new Error(`Unknown Mastra op kind "${exhaustive.kind}"`);
    }
  }
}

/**
 * Runs one Mastra callable and reports the outcome.
 *
 * Never rejects for a step-level failure: the walker in the sandbox decides
 * whether to retry, so an error thrown here would let the Workflow SDK runtime retry
 * the invocation as well and the two policies would compound.
 */
export async function runMastraOp(request: MastraOpRequest): Promise<MastraOpResponse> {
  const startedAt = Date.now();
  const state: Record<string, unknown> = { ...(request.state ?? {}) };

  // Terminal write. No graph node to resolve, and no user code to run.
  if (request.op.kind === 'finalize') {
    await persistSnapshot(request, state, request.op.status, {
      result: request.op.result,
      error: request.op.error,
    });
    return {
      identity: FINALIZE_IDENTITY,
      status: 'success',
      output: undefined,
      state,
      startedAt,
      endedAt: Date.now(),
    };
  }

  // Only known once the callable resolves; until then the op's own address is
  // the best identity available, which is what a resolution failure reports.
  let identity = opIdentity(request.op, '<unresolved>');

  try {
    const workflow = requireRegisteredWorkflow(request.workflowId);
    const { fn, step, id } = resolveCallable(workflow.executionGraph, request.op);
    identity = opIdentity(request.op, id);

    let suspended: { payload: unknown } | undefined;
    let bailed: { payload: unknown } | undefined;
    const abortController = new AbortController();
    const requestContext = new RequestContext((request.requestContext ?? []) as [string, {} | undefined][]);

    const writable = getWritable<Record<string, unknown>>({ namespace: MASTRA_EVENT_NAMESPACE });
    const writer = new ToolStream(
      { prefix: 'step', callId: `${request.runId}:${id}`, name: id, runId: request.runId },
      async (chunk: unknown) => {
        const streamWriter = writable.getWriter();
        try {
          await streamWriter.write({
            type: 'workflow-step-output',
            runId: request.runId,
            payload: { id, output: chunk },
          });
        } finally {
          streamWriter.releaseLock();
        }
      },
    );

    const params = {
      runId: request.runId,
      resourceId: request.resourceId,
      workflowId: request.workflowId,
      mastra: workflow.mastra,
      requestContext,
      inputData: request.inputData,
      state,
      setState: async (next: Record<string, unknown>) => {
        for (const key of Object.keys(state)) {
          delete state[key];
        }
        Object.assign(state, next ?? {});
      },
      retryCount: request.retryCount ?? 0,
      resumeData: request.resumeData,
      getInitData: () => request.initData,
      getStepResult: (target: string | { id: string }) => {
        const key = typeof target === 'string' ? target : target?.id;
        const result = key ? (request.stepResults?.[key] as { status?: string; output?: unknown }) : undefined;
        return result?.status === 'success' ? result.output : null;
      },
      suspend: async (payload?: unknown) => {
        suspended = { payload };
      },
      bail: (result: unknown) => {
        bailed = { payload: result };
      },
      abort: () => abortController.abort(),
      abortSignal: abortController.signal,
      writer,
      engine: {},
      iterationCount: request.iterationCount,
      [PUBSUB_SYMBOL]: new InertPubSub(),
      [STREAM_FORMAT_SYMBOL]: 'vnext' as const,
      ...(request.resumeData === undefined
        ? {}
        : { resume: { steps: step ? [step.id] : [], resumePayload: request.resumeData } }),
    };

    const output = await fn(params);

    if (suspended) {
      const suspendedAt = Date.now();
      // Record which step is waiting, not just that something is: readers of
      // the snapshot — the playground, and anything building a resume UI — need
      // the step id to know what to ask for.
      await persistSnapshot(request, state, 'suspended', { suspendedPaths: { [id]: request.op.path } });
      return { identity, status: 'suspended', suspendPayload: suspended.payload, state, startedAt, suspendedAt };
    }
    if (bailed) {
      return { identity, status: 'bailed', output: bailed.payload, state, startedAt, endedAt: Date.now() };
    }
    if (request.op.kind === 'step') {
      await persistSnapshot(request, state, 'running');
    }
    return { identity, status: 'success', output, state, startedAt, endedAt: Date.now() };
  } catch (error) {
    return { identity, status: 'failed', error: serializeError(error), state, startedAt, endedAt: Date.now() };
  }
}

/**
 * The Workflow SDK run id of the run this step belongs to.
 *
 * Returns `undefined` when called outside a step — unit tests drive
 * {@link runMastraOp} directly, and a missing id must not fail the op.
 */
function currentSdkRunId(): string | undefined {
  try {
    return getWorkflowMetadata().workflowRunId;
  } catch {
    return undefined;
  }
}

/**
 * Mirrors the run into Mastra storage so `getWorkflowRunById()` and the
 * playground can see it, and so another process can map this Mastra run back
 * to its Workflow SDK run (see `snapshot.ts`).
 *
 * Best-effort by design: the Workflow SDK event log is the source of truth for
 * execution, and a storage hiccup should not fail an otherwise good step.
 */
async function persistSnapshot(
  request: MastraOpRequest,
  state: Record<string, unknown>,
  status: WorkflowRunState['status'],
  /**
   * Extra snapshot fields for this write: the terminal outcome that only the
   * `finalize` op has, and the suspended step that only a suspend has.
   */
  outcome: {
    result?: unknown;
    error?: SerializedOpError;
    suspendedPaths?: Record<string, number[]>;
  } = {},
): Promise<void> {
  try {
    const workflow = requireRegisteredWorkflow(request.workflowId);
    const store = await workflow.mastra?.getStorage()?.getStore('workflows');
    if (!store) {
      return;
    }
    const previous = await store
      .loadWorkflowSnapshot({ workflowName: request.workflowId, runId: request.runId })
      .catch(() => null);
    await store.persistWorkflowSnapshot({
      workflowName: request.workflowId,
      runId: request.runId,
      resourceId: request.resourceId,
      snapshot: withSdkRunId(
        {
          runId: request.runId,
          status,
          ...(outcome.result === undefined ? {} : { result: outcome.result as WorkflowRunState['result'] }),
          ...(outcome.error === undefined ? {} : { error: outcome.error as WorkflowRunState['error'] }),
          value: state as WorkflowRunState['value'],
          context: request.stepResults as WorkflowRunState['context'],
          activePaths: [],
          activeStepsPath: {},
          waitingPaths: {},
          suspendedPaths: outcome.suspendedPaths ?? {},
          resumeLabels: {},
          serializedStepGraph: workflow.serializedStepGraph as SerializedStepFlowEntry[],
          timestamp: Date.now(),
        },
        currentSdkRunId() ?? readSdkRunId(previous),
      ),
    });
  } catch {
    // Storage is optional for Workflow SDK-backed runs.
  }
}
