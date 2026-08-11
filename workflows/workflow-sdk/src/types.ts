import type { ActorSignal } from '@mastra/core/auth/ee';
import type { Step, WorkflowConfig } from '@mastra/core/workflows';

export { WORKFLOW_SDK_ENGINE_TYPE, MASTRA_EVENT_NAMESPACE } from './constants';

/**
 * Engine marker for steps and workflows created through {@link init}.
 *
 * Mastra threads this through its generics so a step authored for one engine
 * cannot be dropped into a workflow running on another.
 */
export type WorkflowSdkEngineType = {
  step: any;
};

/**
 * The `mastraRunner` workflow function, threaded through `init({ runner })`.
 *
 * Every run is started by calling the function the consumer handed to
 * `init()` — the one they re-exported from their own `workflows/` directory —
 * never a copy imported inside this package. Host-side modules importing the
 * runner directly would pull `"use workflow"` and `"use step"` code into the
 * host bundle, which the Workflow SDK then discovers as a second workflow
 * module and compiles along with everything the host imports.
 *
 * Declared here rather than next to `WorkflowSdkWorkflow` so `run.ts` can name
 * the type without importing from the module that constructs it.
 */
export type WorkflowSdkRunnerRef = (...args: any[]) => Promise<any>;

export type WorkflowSdkWorkflowConfig<
  TWorkflowId extends string,
  TState,
  TInput,
  TOutput,
  TSteps extends Step<string, any, any, any, any, any, WorkflowSdkEngineType, any>[],
  TRequestContext extends Record<string, any> | unknown = unknown,
> = WorkflowConfig<TWorkflowId, TState, TInput, TOutput, TSteps, TRequestContext>;

/**
 * Address of one executable unit inside a Mastra execution graph.
 *
 * Indices are resolved left to right against `workflow.executionGraph.steps`.
 * A `parallel` or `conditional` entry consumes one more index to pick a branch;
 * `loop` and `foreach` entries hold a single step, so the path ends there.
 *
 * Paths — not step ids — are the addressing scheme because the same step object
 * can legally appear at several points in one graph.
 */
export type MastraOpPath = number[];

/** Fields shared by every graph-addressed op. */
interface MastraOpBase {
  path: MastraOpPath;
  /**
   * Paths of the nested-workflow wrapper steps enclosing this op, outermost
   * first. Each path is resolved against the execution graph of the workflow
   * above it; `path` itself is then relative to the innermost nested graph.
   * Absent for ops in the root graph, which keeps their identities — and
   * therefore replay compatibility — unchanged from before nesting existed.
   */
  workflowPath?: MastraOpPath[];
}

/** The kind of callable the host should invoke at a {@link MastraOpPath}. */
export type MastraOp =
  | (MastraOpBase & { kind: 'step' })
  /** One predicate of a `.branch()` entry, chosen by `conditionIndex`. */
  | (MastraOpBase & { kind: 'condition'; conditionIndex: number })
  /** The predicate of a `.dowhile()` / `.dountil()` entry. */
  | (MastraOpBase & { kind: 'loop-condition' })
  /** A `.sleep(fn)` callback; resolves to a duration in milliseconds. */
  | (MastraOpBase & { kind: 'sleep-duration' })
  /** A `.sleepUntil(fn)` callback; resolves to an epoch-milliseconds timestamp. */
  | (MastraOpBase & { kind: 'sleep-until-date' })
  /** A `.foreach()` concurrency resolver; resolves to a positive integer. */
  | (MastraOpBase & { kind: 'foreach-concurrency' });

/**
 * Records the run's terminal state in Mastra storage.
 *
 * Unlike every other op this one addresses no graph node — it runs once, after
 * the walk, and touches only storage. It exists because steps persist
 * `running` as they go and nothing runs after the walk: without a final write
 * a finished run stays `running` in storage forever, so `getWorkflowRunById()`
 * and the playground never see it settle. The write has to be driven from
 * inside the durable workflow because `startAsync()` returns while the run is
 * still going and its caller is gone by the time the run ends.
 */
export type MastraFinalizeOp = {
  kind: 'finalize';
  status: 'success' | 'failed' | 'canceled';
  result?: unknown;
  error?: SerializedOpError;
};

/**
 * Records a perStep pause in Mastra storage before the walker parks.
 *
 * Like `finalize` it addresses no graph node and touches only storage: the
 * snapshot is written with status `paused` and the hook token the walker is
 * about to wait on, so `getWorkflowRunById()` reports the pause and a later
 * `resume()` can read the token back and continue the run by one more step.
 */
export type MastraPauseOp = {
  kind: 'pause';
  /** 0-based count of pauses so far in this run; makes token and identity unique. */
  pauseSeq: number;
  /** Hook token the walker parks on after this op returns. */
  pauseToken: string;
};

/**
 * Everything the host needs to run one op.
 *
 * This crosses the sandbox boundary and lands in the Workflow SDK event log, so every
 * field has to be serializable. That is why `requestContext` travels as entries
 * rather than as a live `RequestContext`.
 */
export interface MastraOpRequest {
  workflowId: string;
  runId: string;
  resourceId?: string;
  op: MastraOp | MastraFinalizeOp | MastraPauseOp;
  /** Input for this op — the previous entry's output, or a foreach element. */
  inputData: unknown;
  /** Run state as of this call. The host returns the (possibly updated) state. */
  state: Record<string, unknown>;
  /** The workflow's own input, backing `getInitData()`. */
  initData: unknown;
  /** Results recorded so far, backing `getStepResult()`. */
  stepResults: Record<string, unknown>;
  /**
   * Dotted chain of nested-workflow step ids enclosing this op (for example
   * `"outer-wf"` or `"outer-wf.inner-wf"`). The host prefixes step ids with it
   * when recording events, snapshots and suspended paths, so a nested step
   * cannot collide with a same-named step elsewhere in the run.
   */
  stepIdPrefix?: string;
  requestContext: [string, unknown][];
  /** Payload handed back to a step that previously suspended. */
  resumeData?: unknown;
  /** 0-based iteration counter for loop conditions. */
  iterationCount?: number;
  /** Element index when the op runs inside a `foreach`. */
  foreachIndex?: number;
  /** 0-based attempt counter, surfaced to the step as `retryCount`. */
  retryCount?: number;
  /**
   * How many times this step has already parked on a suspend hook in this run.
   * The host folds it into the persisted resume token so `resume()` targets
   * the hook the walker will actually wait on (tokens are single-use).
   */
  suspendSeq?: number;
  /** Per-run scorer opt-out, forwarded to `runScorersForStep` on the host. */
  disableScorers?: boolean;
  /** Trusted server-side actor signal from `start({ actor })`, JSON-safe. */
  actor?: ActorSignal;
  /**
   * Trace correlation ids for the run's root `WORKFLOW_RUN` span, created
   * host-side by `start()`. Each op creates its own step span as a child of
   * these ids — the host is stateless across ops, so a live parent span object
   * cannot survive; linking by persisted ids is the durable equivalent.
   */
  tracingIds?: MastraTracingIds;
  /**
   * Exported root span (`span.exportSpan()`), carried so the `finalize` op can
   * rebuild it via `observability.rebuildSpan()` and end or error it.
   */
  workflowSpanData?: Record<string, unknown>;
}

/** Trace/span ids correlating per-op spans into one trace. */
export interface MastraTracingIds {
  traceId: string;
  workflowSpanId: string;
}

export interface SerializedOpError {
  message: string;
  name?: string;
  stack?: string;
  /** Set when the step threw `MastraNonRetryableError`. */
  nonRetryable?: boolean;
  /**
   * JSON-safe projection of `error.cause`, kept so validation failures preserve
   * their ZodError (e.g. `cause.issues`) across the sandbox boundary like the
   * default engine does in process.
   */
  cause?: unknown;
}

/**
 * Result of one op.
 *
 * `state` always comes back so a `setState()` inside a step survives the trip
 * to the sandbox, which holds the authoritative copy between ops.
 */
/**
 * Fields every op response carries.
 *
 * `identity` is what makes replay safe. The Workflow SDK keys journal entries
 * positionally and its divergence guard compares only the step *name* — and
 * every op here runs through the same `executeMastraOp` function, so that guard
 * cannot tell one graph node from another. Echoing the resolved identity back
 * lets the walker check that the result it just got really belongs to the node
 * it is standing on, turning a silent mis-pairing into a loud error.
 */
interface MastraOpResponseBase {
  /** `<kind>@<path>#<resolved id>`, produced by the host from the live graph. */
  identity: string;
  state: Record<string, unknown>;
  /**
   * Request-context entries after the op ran. The host builds a fresh
   * `RequestContext` per op, so step-written mutations only survive because
   * they are echoed back here and re-sent by the walker with the next op.
   */
  requestContext?: [string, unknown][];
}

export type MastraOpResponse =
  | (MastraOpResponseBase & {
      status: 'success';
      output: unknown;
      startedAt: number;
      endedAt: number;
      /**
       * The step called `abort()` from its execution context. The step itself
       * settled normally; the walker stops the run with status `canceled`
       * before any later step executes — same shape as the default engine's
       * between-steps abort check.
       */
      aborted?: boolean;
    })
  | (MastraOpResponseBase & {
      status: 'suspended';
      suspendPayload: unknown;
      startedAt: number;
      suspendedAt: number;
    })
  /** `bail()` — the workflow finishes early with this value. */
  | (MastraOpResponseBase & {
      status: 'bailed';
      output: unknown;
      startedAt: number;
      endedAt: number;
    })
  | (MastraOpResponseBase & {
      status: 'failed';
      error: SerializedOpError;
      startedAt: number;
      endedAt: number;
    });

/**
 * Serializable time-travel payload carried in the run input.
 *
 * Produced host-side by `createTimeTravelExecutionParams` (the same helper the
 * default engine uses) and interpreted by the walker: entries walk in bypass —
 * seeded results stand in for execution — until the target step is reached.
 */
export interface MastraTimeTravelParams {
  /**
   * Step-id chain from the root graph to the target, one segment per nested
   * workflow wrapper: `['step2']`, or `['outer-wf', 'inner-step']`.
   */
  steps: string[];
  /**
   * Seeded step results keyed by dotted qualified id, including the `input`
   * entry. Steps before the target settle from these instead of executing.
   */
  stepResults: Record<string, unknown>;
  /** Resume payload applied to the target when it was suspended in the source run. */
  resumeData?: unknown;
}

/**
 * Serializable restart payload carried in the run input.
 *
 * Produced host-side by `createRestartExecutionParams` (the same helper the
 * default engine uses) and interpreted by the walker: steps seeded `success`
 * settle from their historical results — no ops, no events — while active
 * steps (and everything after them) execute normally.
 */
export interface MastraRestartParams {
  /**
   * Seeded step results keyed by dotted qualified id, including the `input`
   * entry: the interrupted run's snapshot context, with nested workflow
   * snapshots flattened under their wrapper's prefix.
   */
  stepResults: Record<string, unknown>;
}

/** Arguments the `mastraRunner` workflow function receives from `start()`. */
export interface MastraRunnerParams {
  workflowId: string;
  runId: string;
  resourceId?: string;
  inputData: unknown;
  initialState: Record<string, unknown>;
  requestContext: [string, unknown][];
  /**
   * Serialized graph, carried in the run input rather than read from the
   * registry: the sandbox has no access to the live workflow object.
   */
  serializedStepGraph: unknown[];
  /** Per-run scorer opt-out from `createRun({ disableScorers })`. */
  disableScorers?: boolean;
  /**
   * perStep execution mode: run one step, then pause the walk on a hook until
   * `resume()` grants the next step. Forces sequential execution of parallel
   * groups so branches cannot race for the step budget.
   */
  perStep?: boolean;
  /** Trusted server-side actor signal from `start({ actor })`. */
  actor?: ActorSignal;
  /** Time-travel payload from `timeTravel()`; absent for normal runs. */
  timeTravel?: MastraTimeTravelParams;
  /** Restart payload from `restart()`; absent for normal runs. */
  restart?: MastraRestartParams;
  /** Root-span ids from the host-side `WORKFLOW_RUN` span, if tracing is on. */
  tracingIds?: MastraTracingIds;
  /** Exported root span, forwarded to the `finalize` op so it can be ended. */
  workflowSpanData?: Record<string, unknown>;
}

/** Terminal shape the runner returns to `Run#returnValue`. */
export interface MastraRunnerResult {
  status: 'success' | 'failed' | 'suspended' | 'bailed' | 'canceled';
  result?: unknown;
  error?: SerializedOpError;
  state: Record<string, unknown>;
  steps: Record<string, unknown>;
  input: unknown;
}
