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

/** The kind of callable the host should invoke at a {@link MastraOpPath}. */
export type MastraOp =
  | { kind: 'step'; path: MastraOpPath }
  /** One predicate of a `.branch()` entry, chosen by `conditionIndex`. */
  | { kind: 'condition'; path: MastraOpPath; conditionIndex: number }
  /** The predicate of a `.dowhile()` / `.dountil()` entry. */
  | { kind: 'loop-condition'; path: MastraOpPath }
  /** A `.sleep(fn)` callback; resolves to a duration in milliseconds. */
  | { kind: 'sleep-duration'; path: MastraOpPath }
  /** A `.sleepUntil(fn)` callback; resolves to an epoch-milliseconds timestamp. */
  | { kind: 'sleep-until-date'; path: MastraOpPath }
  /** A `.foreach()` concurrency resolver; resolves to a positive integer. */
  | { kind: 'foreach-concurrency'; path: MastraOpPath };

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
  status: 'success' | 'failed';
  result?: unknown;
  error?: SerializedOpError;
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
  op: MastraOp | MastraFinalizeOp;
  /** Input for this op — the previous entry's output, or a foreach element. */
  inputData: unknown;
  /** Run state as of this call. The host returns the (possibly updated) state. */
  state: Record<string, unknown>;
  /** The workflow's own input, backing `getInitData()`. */
  initData: unknown;
  /** Results recorded so far, backing `getStepResult()`. */
  stepResults: Record<string, unknown>;
  requestContext: [string, unknown][];
  /** Payload handed back to a step that previously suspended. */
  resumeData?: unknown;
  /** 0-based iteration counter for loop conditions. */
  iterationCount?: number;
  /** Element index when the op runs inside a `foreach`. */
  foreachIndex?: number;
  /** 0-based attempt counter, surfaced to the step as `retryCount`. */
  retryCount?: number;
}

export interface SerializedOpError {
  message: string;
  name?: string;
  stack?: string;
  /** Set when the step threw `MastraNonRetryableError`. */
  nonRetryable?: boolean;
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
}

export type MastraOpResponse =
  | (MastraOpResponseBase & {
      status: 'success';
      output: unknown;
      startedAt: number;
      endedAt: number;
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
}

/** Terminal shape the runner returns to `Run#returnValue`. */
export interface MastraRunnerResult {
  status: 'success' | 'failed' | 'suspended' | 'bailed';
  result?: unknown;
  error?: SerializedOpError;
  state: Record<string, unknown>;
  steps: Record<string, unknown>;
  input: unknown;
}
