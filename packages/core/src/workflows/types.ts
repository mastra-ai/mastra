import type { WritableStream } from 'node:stream/web';
import type { TextStreamPart } from '@internal/ai-sdk-v4';
import type { z } from 'zod/v4';
import type { ActorSignal } from '../auth/ee';
import type { SerializedError } from '../error';
import type { MastraScorers } from '../evals';
import type { PubSub } from '../events/pubsub';
import type { IMastraLogger } from '../logger';
import type { Mastra } from '../mastra';
import type { AnySpan, ObservabilityContext, TracingOptions, TracingPolicy, TracingProperties } from '../observability';
import type { RequestContext } from '../request-context';
import type { InferPublicSchema, PublicSchema, StandardSchemaWithJSON, InferStandardSchemaOutput } from '../schema';
import type { OutputSchema } from '../stream';
import type { SchemaWithValidation } from '../stream/base/schema';
import type { ChunkType, WorkflowStreamEvent } from '../stream/types';
import type { Tool, ToolExecutionContext } from '../tools';
import type { DynamicArgument } from '../types';
import type { ExecutionEngine } from './execution-engine';
import type { Predicate } from './predicate';
import type { WorkflowScheduleInput } from './scheduler/types';
import type { ConditionFunction, ExecuteFunction, ExecuteFunctionParams, LoopConditionFunction, Step } from './step';

export type OutputWriter<TChunk = any> = (chunk: TChunk, options?: { messageId?: string }) => Promise<void>;

/**
 * Options for `Run.start()` beyond the generic `inputData`/`initialState`/`requestContext` fields.
 */
export type WorkflowRunStartOptions = {
  outputWriter?: OutputWriter;
  actor?: ActorSignal;
  tracingOptions?: TracingOptions;
  outputOptions?: {
    includeState?: boolean;
    includeResumeLabels?: boolean;
  };
  perStep?: boolean;
} & Partial<ObservabilityContext>;

export type { ChunkType, WorkflowStreamEvent } from '../stream/types';
export type { MastraWorkflowStream } from '../stream/MastraWorkflowStream';

export type WorkflowEngineType = string;

/**
 * Type of workflow - determines how the workflow is categorized in the UI.
 * - 'default': Standard workflow
 * - 'processor': Workflow used as a processor for agent input/output processing
 */
export type WorkflowType = 'default' | 'processor';

export type RestartExecutionParams = {
  activePaths: number[];
  activeStepsPath: Record<string, number[]>;
  stepResults: Record<string, StepResult<any, any, any, any>>;
  state?: Record<string, any>;
  stepExecutionPath?: string[];
  isParallelOrConditionalRestarted?: boolean;
};

export type TimeTravelExecutionParams = {
  executionPath: number[];
  inputData?: any;
  stepResults: Record<string, StepResult<any, any, any, any>>;
  nestedStepResults?: Record<string, Record<string, StepResult<any, any, any, any>>>;
  steps: string[];
  state?: Record<string, any>;
  resumeData?: any;
  stepExecutionPath?: string[];
};

export type StepMetadata = Record<string, any>;

export type StepSuccess<Payload, Resume, Suspend, Output> = {
  status: 'success';
  output: Output;
  payload: Payload;
  resumePayload?: Resume;
  suspendPayload?: Suspend;
  suspendOutput?: Output;
  startedAt: number;
  endedAt: number;
  suspendedAt?: number;
  resumedAt?: number;
  metadata?: StepMetadata;
};

/** Tripwire data attached to a failed step when triggered by a processor */
export interface StepTripwireInfo {
  reason: string;
  retry?: boolean;
  metadata?: Record<string, unknown>;
  processorId?: string;
}

export type StepFailure<P, R, S, T> = {
  status: 'failed';
  error: Error;
  payload: P;
  resumePayload?: R;
  suspendPayload?: S;
  suspendOutput?: T;
  startedAt: number;
  endedAt: number;
  suspendedAt?: number;
  resumedAt?: number;
  metadata?: StepMetadata;
  /** Tripwire data when step failed due to processor rejection */
  tripwire?: StepTripwireInfo;
  /** Step failure marked as non-retryable (MastraNonRetryableError). */
  nonRetryable?: true;
};

export type StepSuspended<P, S, T> = {
  status: 'suspended';
  payload: P;
  suspendPayload?: S;
  suspendOutput?: T;
  startedAt: number;
  suspendedAt: number;
  metadata?: StepMetadata;
};

export type StepRunning<P, R, S, T> = {
  status: 'running';
  payload: P;
  resumePayload?: R;
  suspendPayload?: S;
  suspendOutput?: T;
  startedAt: number;
  suspendedAt?: number;
  resumedAt?: number;
  metadata?: StepMetadata;
};

export type StepWaiting<P, R, S, T> = {
  status: 'waiting';
  payload: P;
  suspendPayload?: S;
  resumePayload?: R;
  suspendOutput?: T;
  startedAt: number;
  metadata?: StepMetadata;
};

export type StepPaused<P, R, S, T> = {
  status: 'paused';
  payload: P;
  suspendPayload?: S;
  resumePayload?: R;
  suspendOutput?: T;
  startedAt: number;
  metadata?: StepMetadata;
};

export type StepSkipped<P, R, S, T> = {
  status: 'skipped';
  payload: P;
  resumePayload?: R;
  suspendPayload?: S;
  suspendOutput?: T;
  startedAt: number;
  endedAt: number;
  metadata?: StepMetadata;
};

export type StepResult<P, R, S, T> =
  | StepSuccess<P, R, S, T>
  | StepFailure<P, R, S, T>
  | StepSuspended<P, S, T>
  | StepRunning<P, R, S, T>
  | StepWaiting<P, R, S, T>
  | StepPaused<P, R, S, T>
  | StepSkipped<P, R, S, T>;

/**
 * Serialized version of StepFailure where error is a SerializedError
 * (used when loading workflow runs from storage)
 */
export type SerializedStepFailure<P, R, S, T> = Omit<StepFailure<P, R, S, T>, 'error'> & {
  error: SerializedError;
};

/**
 * Step result type that accounts for serialized errors when loaded from storage
 */
export type SerializedStepResult<P, R, S, T> =
  | StepSuccess<P, R, S, T>
  | SerializedStepFailure<P, R, S, T>
  | StepFailure<P, R, S, T>
  | StepSuspended<P, S, T>
  | StepRunning<P, R, S, T>
  | StepWaiting<P, R, S, T>
  | StepPaused<P, R, S, T>
  | StepSkipped<P, R, S, T>;

export type TimeTravelContext<P, R, S, T> = Record<
  string,
  {
    status: WorkflowRunStatus;
    payload?: P;
    output?: T;
    resumePayload?: R;
    suspendPayload?: S;
    suspendOutput?: T;
    startedAt?: number;
    endedAt?: number;
    suspendedAt?: number;
    resumedAt?: number;
    metadata?: StepMetadata;
  }
>;

export type WorkflowStepStatus = StepResult<any, any, any, any>['status'];

export type StepsRecord<T extends readonly Step<any, any, any, any, any, any, any>[]> = {
  [K in T[number]['id']]: Extract<T[number], { id: K }>;
};

export type DynamicMapping<TPrevSchema, TSchemaOut> = {
  fn: ExecuteFunction<any, TPrevSchema, TSchemaOut, any, any, any>;
  schema: TSchemaOut;
};

export type PathsToStringProps<T> =
  T extends z.ZodObject<infer V>
    ? PathsToStringProps<V>
    : T extends object
      ? {
          [K in keyof T]: T[K] extends object
            ? K extends string
              ? K | `${K}.${PathsToStringProps<T[K]>}`
              : never
            : K extends string
              ? K
              : never;
        }[keyof T]
      : never;

export type ExtractSchemaType<T extends StandardSchemaWithJSON> = T extends StandardSchemaWithJSON
  ? InferStandardSchemaOutput<T>
  : never;

export type ExtractSchemaFromStep<
  TStep extends Step<any, any, any, any, any, any, any>,
  TKey extends 'inputSchema' | 'outputSchema',
> = TStep[TKey];

export type VariableReference<
  TStep extends Step<string, any, any> = Step<string, any, any>,
  TVarPath extends PathsToStringProps<ExtractSchemaType<ExtractSchemaFromStep<TStep, 'outputSchema'>>> | '' | '.' =
    PathsToStringProps<ExtractSchemaType<ExtractSchemaFromStep<TStep, 'outputSchema'>>> | '' | '.',
> =
  | {
      step: TStep;
      path: TVarPath;
    }
  | { value: any; schema: OutputSchema };

export type StreamEvent =
  // old events
  | TextStreamPart<any>
  | {
      type: 'step-suspended';
      payload: any;
      id: string;
    }
  | {
      type: 'step-waiting';
      payload: any;
      id: string;
    }
  | {
      type: 'step-result';
      payload: any;
      id: string;
    }
  // vnext events
  | WorkflowStreamEvent;

export type WorkflowRunStatus =
  | 'running'
  | 'success'
  | 'failed'
  | 'tripwire'
  | 'suspended'
  | 'waiting'
  | 'pending'
  | 'canceled'
  | 'bailed'
  | 'paused'
  | 'skipped';

export type WorkflowResumeLabel = {
  stepId: string;
  foreachIndex?: number;
};

export type WorkflowStateSingleStepResult = {
  status: WorkflowStepStatus;
  output?: any;
  payload?: any;
  resumePayload?: any;
  suspendPayload?: any;
  suspendOutput?: any;
  error?: SerializedError;
  startedAt?: number;
  endedAt?: number;
  suspendedAt?: number;
  resumedAt?: number;
  metadata?: StepMetadata;
};

export type WorkflowStateStepResult = WorkflowStateSingleStepResult | WorkflowStateSingleStepResult[];

export type WorkflowStateTracingContext = {
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
};

/**
 * Unified workflow state that combines metadata with processed execution state.
 */
export interface WorkflowState {
  // Metadata
  runId: string;
  workflowName: string;
  resourceId?: string;
  createdAt: Date;
  updatedAt: Date;

  /**
   * Indicates whether this result came from in-memory storage rather than persistent storage.
   * When true, the data is approximate:
   * - createdAt/updatedAt are set to current time
   * - steps is empty {} (step data only available from persisted snapshots)
   *
   * This flag is useful for callers that need to distinguish between persisted and in-memory runs,
   * e.g., to decide whether to persist an initial snapshot.
   */
  isFromInMemory?: boolean;

  // Execution State
  status: WorkflowRunStatus;
  initialState?: Record<string, any>;
  stepExecutionPath?: string[];
  // Optional detailed fields (can be excluded for performance)
  activeStepsPath?: Record<string, number[]>;
  serializedStepGraph?: SerializedStepFlowEntry[];
  suspendedPaths?: Record<string, number[]>;
  resumeLabels?: Record<string, WorkflowResumeLabel>;
  waitingPaths?: Record<string, number[]>;
  requestContext?: Record<string, any>;
  tracingContext?: WorkflowStateTracingContext;
  // Step Information (processed) - optional when using field filtering
  steps?: Record<string, WorkflowStateStepResult>;
  result?: Record<string, any>;
  payload?: Record<string, any>;
  error?: SerializedError;
}

/**
 * Valid field names for filtering WorkflowState responses.
 * Use with getWorkflowRunById to reduce payload size.
 * Note: Metadata fields (runId, workflowName, resourceId, createdAt, updatedAt) and status are always included.
 * requestContext and tracingContext are only returned when explicitly requested.
 */
export type WorkflowStateField =
  | 'result'
  | 'error'
  | 'payload'
  | 'steps'
  | 'activeStepsPath'
  | 'serializedStepGraph'
  | 'suspendedPaths'
  | 'resumeLabels'
  | 'waitingPaths'
  | 'requestContext'
  | 'tracingContext';

export interface WorkflowRunState {
  // Core state info
  runId: string;
  status: WorkflowRunStatus;
  result?: Record<string, any>;
  error?: SerializedError;
  requestContext?: Record<string, any>;
  value: Record<string, string>;
  context: { input?: Record<string, any> } & Record<string, SerializedStepResult<any, any, any, any>>;
  serializedStepGraph: SerializedStepFlowEntry[];
  activePaths: Array<number>;
  activeStepsPath: Record<string, number[]>;
  suspendedPaths: Record<string, number[]>;
  resumeLabels: Record<string, WorkflowResumeLabel>;
  waitingPaths: Record<string, number[]>;
  timestamp: number;
  /** Tripwire data when status is 'tripwire' */
  tripwire?: StepTripwireInfo;
  stepExecutionPath?: string[];
  /**
   * Tracing context for span continuity during suspend/resume.
   * Persisted when workflow suspends to enable linking resumed spans
   * as children of the original suspended span.
   */
  tracingContext?: WorkflowStateTracingContext;
}

/**
 * Result object passed to the onFinish callback when a workflow completes.
 */
export interface WorkflowFinishCallbackResult {
  /** The final status of the workflow */
  status: WorkflowRunStatus;
  /** The workflow result (only for successful workflows) */
  result?: any;
  /** Error details (only for failed workflows) */
  error?: SerializedError;
  /** All step results */
  steps: Record<string, StepResult<any, any, any, any>>;
  /** Tripwire info (only if failure was due to tripwire) */
  tripwire?: StepTripwireInfo;
  /** The unique workflow run ID */
  runId: string;
  /** The workflow identifier */
  workflowId: string;
  /** Resource/user identifier for multi-tenant scenarios (optional) */
  resourceId?: string;
  /** Function to get the initial workflow input data */
  getInitData: () => any;
  /** The Mastra instance (if registered) */
  mastra?: Mastra;
  /** The request context */
  requestContext: RequestContext;
  /** The Mastra logger for structured logging */
  logger: IMastraLogger;
  /** The final workflow state */
  state: Record<string, any>;
  stepExecutionPath?: string[];
}

/**
 * Error info object passed to the onError callback when a workflow fails.
 */
export interface WorkflowErrorCallbackInfo {
  /** The failure status (either 'failed' or 'tripwire') */
  status: 'failed' | 'tripwire';
  /** Error details */
  error?: SerializedError;
  /** All step results */
  steps: Record<string, StepResult<any, any, any, any>>;
  /** Tripwire info (only if status is 'tripwire') */
  tripwire?: StepTripwireInfo;
  /** The unique workflow run ID */
  runId: string;
  /** The workflow identifier */
  workflowId: string;
  /** Resource/user identifier for multi-tenant scenarios (optional) */
  resourceId?: string;
  /** Function to get the initial workflow input data */
  getInitData: () => any;
  /** The Mastra instance (if registered) */
  mastra?: Mastra;
  /** The request context */
  requestContext: RequestContext;
  /** The Mastra logger for structured logging */
  logger: IMastraLogger;
  /** The final workflow state */
  state: Record<string, any>;
  stepExecutionPath?: string[];
}

export interface WorkflowOptions {
  tracingPolicy?: TracingPolicy;
  validateInputs?: boolean;
  /**
   * When true, nested runs created by execute() share the parent's pubsub
   * instance instead of creating an isolated one. Used by durable agent
   * workflows so inner step events reach the outer subscriber.
   */
  sharePubsub?: boolean;
  shouldPersistSnapshot?: (params: {
    stepResults: Record<string, StepResult<any, any, any, any>>;
    workflowStatus: WorkflowRunStatus;
  }) => boolean;

  /**
   * Transforms the run snapshot immediately before it is persisted.
   * Called at every snapshot persist site (both engines). Must be a pure
   * function returning JSON-safe data — the snapshot may cross a pubsub
   * codec boundary. Defaults to identity (no change).
   *
   * Used internally by agent-loop workflows to strip data that is never
   * read on resume (stale suspend payloads, duplicated message arrays).
   */
  pruneSnapshot?: (params: { snapshot: WorkflowRunState; workflowStatus: WorkflowRunStatus }) => WorkflowRunState;

  /**
   * Called when workflow execution completes (success, failed, suspended, or tripwire).
   * This callback is invoked server-side without requiring client-side .watch().
   * Errors thrown in this callback are caught and logged, not propagated.
   */
  onFinish?: (result: WorkflowFinishCallbackResult) => Promise<void> | void;

  /**
   * Called only when workflow execution fails (failed or tripwire status).
   * This callback is invoked server-side without requiring client-side .watch().
   * Errors thrown in this callback are caught and logged, not propagated.
   */
  onError?: (errorInfo: WorkflowErrorCallbackInfo) => Promise<void> | void;
}

export type WorkflowInfo = {
  steps: Record<string, SerializedStep>;
  allSteps: Record<string, SerializedStep>;
  name: string | undefined;
  description: string | undefined;
  metadata?: Record<string, unknown> | undefined;
  stepGraph: SerializedStepFlowEntry[];
  inputSchema: string | undefined;
  outputSchema: string | undefined;
  stateSchema: string | undefined;
  requestContextSchema: string | undefined;
  options?: WorkflowOptions;
  stepCount?: number;
  /** Whether this workflow is a processor workflow (auto-generated from agent processors) */
  isProcessorWorkflow?: boolean;
  /**
   * How this workflow got into the live registry. `'code'` for statically
   * authored / `addWorkflow()`-added workflows, `'stored'` for anything
   * hydrated or added via `addStoredWorkflow()` (HTTP or SDK).
   *
   * Optional so external consumers of `WorkflowInfo` don't break; the server
   * reads it from `workflow.origin`, which `rehydrateWorkflow` sets to
   * `'stored'` at construction time (defaults to `'code'`).
   */
  origin?: 'code' | 'stored';
};

export type DefaultEngineType = {};

/**
 * Object form of a `.map()` mapping config: a record of output keys to mapping
 * sources (`value`, `fn`, `requestContextPath`, `step`+`path`, `initData`+`path`).
 * Kept loose here because the precise per-key union lives in the `.map()` overload.
 */
export type MappingConfig = Record<string, any>;

/**
 * The "single step-like" graph entries: a plain user step plus the declarative
 * variants that Mastra interprets at execution time (agent / tool / mapping).
 *
 * The live form carries runtime references (`agent`, `tool`, `mapConfig`,
 * `options`) so the engine can materialize a runnable step on demand - mirroring
 * how `loop` carries a live `condition`. These references are intentionally loose
 * (`any`) because the public type-safety for these entries is enforced by the
 * `Workflow` builder method overloads, not by this internal union.
 */
export type SingleStepEntry<TEngineType = DefaultEngineType> =
  | { type: 'step'; step: Step }
  | { type: 'agent'; id: string; agentId: string; agent?: any; options?: any }
  | { type: 'tool'; id: string; toolId: string; tool?: any; options?: any }
  | { type: 'mapping'; id: string; mapConfig: MappingConfig | ExecuteFunction<any, any, any, any, any, TEngineType> };

/** The `{ type: 'step' }` variant of {@link SingleStepEntry}: a plain live step. */
export type StepEntry = Extract<SingleStepEntry, { type: 'step' }>;
/** The `{ type: 'agent' }` variant of {@link SingleStepEntry}. */
export type AgentStepEntry = Extract<SingleStepEntry, { type: 'agent' }>;
/** The `{ type: 'tool' }` variant of {@link SingleStepEntry}. */
export type ToolStepEntry = Extract<SingleStepEntry, { type: 'tool' }>;
/** The `{ type: 'mapping' }` variant of {@link SingleStepEntry}. */
export type MappingStepEntry<TEngineType = DefaultEngineType> = Extract<
  SingleStepEntry<TEngineType>,
  { type: 'mapping' }
>;

export type StepFlowEntry<TEngineType = DefaultEngineType> =
  | SingleStepEntry<TEngineType>
  | { type: 'sleep'; id: string; duration?: number; fn?: ExecuteFunction<any, any, any, any, any, TEngineType> }
  | { type: 'sleepUntil'; id: string; date?: Date; fn?: ExecuteFunction<any, any, any, any, any, TEngineType> }
  | {
      type: 'parallel';
      steps: SingleStepEntry<TEngineType>[];
    }
  | {
      type: 'conditional';
      steps: SingleStepEntry<TEngineType>[];
      conditions: ConditionFunction<any, any, any, any, any, TEngineType>[];
      serializedConditions: { id: string; fn: string }[];
      /**
       * Declarative predicates for each condition, aligned by index. Present
       * for entries built via the `.branch({ predicate })` overload; absent
       * for `.branch(fn)` closures. When present the entry is storable and
       * round-trips through `toStorableGraph` / `rehydrateWorkflow`.
       */
      predicates?: (Predicate | null)[];
    }
  | {
      // `loop` supports two condition forms: a closure (`.dowhile(fn)`, not
      // storable) and a declarative predicate (`.dowhile({ predicate })`,
      // storable). The live step shape is aligned with `parallel` / `foreach`
      // so the builder can accept an Agent / Tool directly.
      type: 'loop';
      step: SingleStepEntry<TEngineType>;
      condition: LoopConditionFunction<any, any, any, any, any, TEngineType>;
      serializedCondition: { id: string; fn: string };
      loopType: 'dowhile' | 'dountil';
      /**
       * Declarative predicate for the loop condition. Present when built via
       * `.dowhile({ predicate })` / `.dountil({ predicate })`; absent for
       * closure loops. Enables storage round-trip.
       */
      predicate?: Predicate;
    }
  | {
      type: 'foreach';
      step: SingleStepEntry<TEngineType>;
      opts: ForeachOptions;
    };

/**
 * Context passed to a foreach {@link ForeachConcurrencyResolver} when the
 * foreach entry is about to execute.
 */
export interface ForeachConcurrencyContext {
  /** The array the foreach iterates over (output of the previous step). */
  inputData: unknown;
  /** Returns the workflow run's init data (the workflow input). */
  getInitData: () => unknown;
}

/**
 * Resolves the foreach concurrency at execution time, per run.
 *
 * Use this instead of a static number when the effective concurrency depends
 * on run input (e.g. per-run options). Workflow graphs are built once and
 * shared across runs, so a resolver is the only safe way to vary concurrency
 * per run — mutating a shared options object races between concurrent runs
 * and does not survive durable-engine replays.
 */
export type ForeachConcurrencyResolver = (context: ForeachConcurrencyContext) => number;

export interface ForeachOptions {
  concurrency: number | ForeachConcurrencyResolver;
}

export type SerializedStep<TEngineType = DefaultEngineType> = Pick<
  Step<any, any, any, any, any, any, TEngineType>,
  'id' | 'description' | 'metadata'
> & {
  component?: string;
  serializedStepFlow?: SerializedStepFlowEntry[];
  mapConfig?: string;
  canSuspend?: boolean;
};

/**
 * JSON-safe mirror of {@link SingleStepEntry}: declarative variants carry
 * ids/strings only (no closures or live references).
 */
/**
 * JSON-safe subset of {@link AgentStepOptions} / tool step options carried on
 * a serialized declarative entry. Closure-valued fields (`onFinish`, function
 * `scorers`) don't round-trip and are rejected at `toStorableGraph` time.
 */
export type SerializedStepOptions = {
  retries?: number;
  metadata?: StepMetadata;
};

export type SerializedSingleStepEntry =
  | { type: 'step'; step: SerializedStep }
  | {
      type: 'agent';
      id: string;
      agentId: string;
      description?: string;
      /**
       * The step's output shape. When `.agent()` is called with
       * `structuredOutput.schema`, that schema becomes the step output; this
       * field captures it as JSON Schema so rehydration can reconstruct the
       * same `structuredOutput` wiring. Absent means the step produces the
       * default `{ text: string }`.
       */
      outputSchema?: Record<string, any>;
      options?: SerializedStepOptions;
    }
  | {
      type: 'tool';
      id: string;
      toolId: string;
      description?: string;
      // No outputSchema: a tool's output shape lives on the tool itself and is
      // looked up from the live Mastra instance at rehydration time.
      options?: SerializedStepOptions;
    }
  | { type: 'mapping'; id: string; mapConfig: string }
  /**
   * A nested workflow referenced by its registered id (code-defined or
   * another stored workflow). The referenced workflow must resolve on the
   * live Mastra registry at rehydration time; missing refs fail loudly.
   *
   * `serializedStepFlow` is the nested workflow's full graph, inlined for
   * Studio/API consumers (same role `SerializedStep.serializedStepFlow`
   * played when nested workflows were emitted as `type: 'step'` +
   * `component: 'WORKFLOW'`). Stored JSON definitions may omit it and keep
   * only the id reference.
   */
  | {
      type: 'workflow';
      id: string;
      workflowId: string;
      description?: string;
      serializedStepFlow?: SerializedStepFlowEntry[];
    };

export type SerializedStepFlowEntry =
  | SerializedSingleStepEntry
  | {
      type: 'sleep';
      id: string;
      duration?: number;
      fn?: string;
    }
  | {
      type: 'sleepUntil';
      id: string;
      date?: Date;
      fn?: string;
    }
  | {
      type: 'parallel';
      steps: SerializedSingleStepEntry[];
    }
  | {
      type: 'conditional';
      steps: SerializedSingleStepEntry[];
      serializedConditions: { id: string; fn: string }[];
      /**
       * Optional declarative predicate for each condition, aligned by index
       * with `steps` / `serializedConditions`. When present, the entry is
       * fully round-trippable through storage — the runtime rebuilds a live
       * `ConditionFunction` by evaluating the predicate against the workflow
       * context. When absent, the entry originated from a closure-based
       * `.branch(fn)` call and cannot be stored (see `toStorableGraph`).
       * Additive: never changes the shape of closure-based workflows.
       */
      predicates?: (Predicate | null)[];
    }
  | {
      type: 'loop';
      step: SerializedStep;
      serializedCondition: { id: string; fn: string };
      loopType: 'dowhile' | 'dountil';
      /**
       * Optional declarative predicate for the loop condition. When present,
       * the entry is fully round-trippable through storage. When absent, the
       * loop uses a closure predicate and cannot be stored. Additive.
       */
      predicate?: Predicate;
    }
  | {
      type: 'foreach';
      step: SerializedSingleStepEntry;
      /**
       * Optional. When omitted, the engine defaults to `concurrency: 1`. Present
       * when the foreach entry carries a static concurrency value or a
       * serialized concurrency resolver function.
       */
      opts?: {
        /** Static concurrency. Omitted when a resolver function is used. */
        concurrency?: number;
        /** Source of the concurrency resolver function, when one is used. */
        fn?: string;
      };
    };

export type StepWithComponent = Step<string, any, any, any, any, any> & {
  component?: string;
  steps?: Record<string, StepWithComponent>;
};

type InferParsedPublicSchema<TSchema extends PublicSchema<any>> = InferPublicSchema<TSchema>;

/**
 * StepParams with schema-based inference for better type errors.
 * Generic parameters are the SCHEMAS, and we infer value types from them.
 * Uses parsed schema output typing for contextual typing of the execute function.
 */
export type StepParams<
  TStepId extends string,
  TStateSchema extends PublicSchema<any> | undefined,
  TInputSchema extends PublicSchema<any>,
  TOutputSchema extends PublicSchema<any>,
  TResumeSchema extends PublicSchema<any> | undefined = undefined,
  TSuspendSchema extends PublicSchema<any> | undefined = undefined,
  TRequestContextSchema extends PublicSchema<any> | undefined = undefined,
> = {
  id: TStepId;
  description?: string;
  inputSchema: TInputSchema;
  outputSchema: TOutputSchema;
  resumeSchema?: TResumeSchema;
  suspendSchema?: TSuspendSchema;
  stateSchema?: TStateSchema;
  /**
   * Optional schema for validating request context values.
   * When provided, the request context will be validated against this schema before step execution.
   */
  requestContextSchema?: TRequestContextSchema;
  retries?: number;
  scorers?: DynamicArgument<MastraScorers>;
  metadata?: StepMetadata;
  execute: ExecuteFunction<
    TStateSchema extends PublicSchema<any> ? InferPublicSchema<TStateSchema> : unknown,
    InferParsedPublicSchema<TInputSchema>,
    InferPublicSchema<TOutputSchema>,
    TResumeSchema extends PublicSchema<any> ? InferPublicSchema<TResumeSchema> : unknown,
    TSuspendSchema extends PublicSchema<any> ? InferPublicSchema<TSuspendSchema> : unknown,
    DefaultEngineType,
    TRequestContextSchema extends PublicSchema<any> ? InferPublicSchema<TRequestContextSchema> : unknown
  >;
};

/**
 * Legacy StepParams type for backward compatibility.
 * Use the schema-based StepParams for new code.
 */
export type StepParamsLegacy<
  TStepId extends string,
  TState,
  TStepInput,
  TStepOutput,
  TResume,
  TSuspend,
  TRequestContext extends Record<string, any> | unknown = unknown,
> = {
  id: TStepId;
  description?: string;
  inputSchema: SchemaWithValidation<TStepInput>;
  outputSchema: SchemaWithValidation<TStepOutput>;
  resumeSchema?: SchemaWithValidation<TResume>;
  suspendSchema?: SchemaWithValidation<TSuspend>;
  stateSchema?: SchemaWithValidation<TState>;
  /**
   * Optional schema for validating request context values.
   * When provided, the request context will be validated against this schema before step execution.
   */
  requestContextSchema?: SchemaWithValidation<TRequestContext>;
  retries?: number;
  scorers?: DynamicArgument<MastraScorers>;
  execute: ExecuteFunction<TState, TStepInput, TStepOutput, TResume, TSuspend, DefaultEngineType, TRequestContext>;
};

export type ToolStep<
  TSchemaIn,
  TSuspendSchema,
  TResumeSchema,
  TSchemaOut,
  TContext extends ToolExecutionContext<TSuspendSchema, TResumeSchema>,
> = Tool<TSchemaIn, TSchemaOut, TSuspendSchema, TResumeSchema, TContext> & {
  inputSchema: StandardSchemaWithJSON<TSchemaIn>;
  outputSchema: StandardSchemaWithJSON<TSchemaOut>;
  execute: (input: TSchemaIn, context?: TContext) => Promise<any>;
};

export type WorkflowResult<TState, TInput, TOutput, TSteps extends Step<string, any, any, any, any, any>[]> =
  | ({
      status: 'success';
      state?: TState;
      stepExecutionPath?: string[];
      resumeLabels?: Record<string, { stepId: string; forEachIndex?: number }>;
      result: TOutput;
      input: TInput;
      steps: {
        [K in keyof StepsRecord<TSteps>]: StepsRecord<TSteps>[K]['outputSchema'] extends undefined
          ? StepResult<unknown, unknown, unknown, unknown>
          : StepResult<
              InferStandardSchemaOutput<StepsRecord<TSteps>[K]['inputSchema']>,
              StepsRecord<TSteps>[K]['resumeSchema'] extends StandardSchemaWithJSON<any>
                ? InferStandardSchemaOutput<StepsRecord<TSteps>[K]['resumeSchema']>
                : unknown,
              StepsRecord<TSteps>[K]['suspendSchema'] extends StandardSchemaWithJSON<any>
                ? InferStandardSchemaOutput<StepsRecord<TSteps>[K]['suspendSchema']>
                : unknown,
              InferStandardSchemaOutput<StepsRecord<TSteps>[K]['outputSchema']>
            >;
      };
    } & TracingProperties)
  | ({
      status: 'failed';
      input: TInput;
      state?: TState;
      stepExecutionPath?: string[];
      resumeLabels?: Record<string, { stepId: string; forEachIndex?: number }>;
      steps: {
        [K in keyof StepsRecord<TSteps>]: StepsRecord<TSteps>[K]['outputSchema'] extends undefined
          ? StepResult<unknown, unknown, unknown, unknown>
          : StepResult<
              InferStandardSchemaOutput<StepsRecord<TSteps>[K]['inputSchema']>,
              StepsRecord<TSteps>[K]['resumeSchema'] extends StandardSchemaWithJSON<any>
                ? InferStandardSchemaOutput<StepsRecord<TSteps>[K]['resumeSchema']>
                : unknown,
              StepsRecord<TSteps>[K]['suspendSchema'] extends StandardSchemaWithJSON<any>
                ? InferStandardSchemaOutput<StepsRecord<TSteps>[K]['suspendSchema']>
                : unknown,
              InferStandardSchemaOutput<StepsRecord<TSteps>[K]['outputSchema']>
            >;
      };
      error: Error;
    } & TracingProperties)
  | ({
      status: 'tripwire';
      input: TInput;
      state?: TState;
      stepExecutionPath?: string[];
      resumeLabels?: Record<string, { stepId: string; forEachIndex?: number }>;
      steps: {
        [K in keyof StepsRecord<TSteps>]: StepsRecord<TSteps>[K]['outputSchema'] extends undefined
          ? StepResult<unknown, unknown, unknown, unknown>
          : StepResult<
              InferStandardSchemaOutput<StepsRecord<TSteps>[K]['inputSchema']>,
              StepsRecord<TSteps>[K]['resumeSchema'] extends StandardSchemaWithJSON<any>
                ? InferStandardSchemaOutput<StepsRecord<TSteps>[K]['resumeSchema']>
                : unknown,
              StepsRecord<TSteps>[K]['suspendSchema'] extends StandardSchemaWithJSON<any>
                ? InferStandardSchemaOutput<StepsRecord<TSteps>[K]['suspendSchema']>
                : unknown,
              InferStandardSchemaOutput<StepsRecord<TSteps>[K]['outputSchema']>
            >;
      };
      /** Tripwire data including reason, retry flag, metadata, and processor ID */
      tripwire: StepTripwireInfo;
    } & TracingProperties)
  | ({
      status: 'suspended';
      input: TInput;
      state?: TState;
      stepExecutionPath?: string[];
      resumeLabels?: Record<string, { stepId: string; forEachIndex?: number }>;
      steps: {
        [K in keyof StepsRecord<TSteps>]: StepsRecord<TSteps>[K]['outputSchema'] extends undefined
          ? StepResult<unknown, unknown, unknown, unknown>
          : StepResult<
              InferStandardSchemaOutput<StepsRecord<TSteps>[K]['inputSchema']>,
              StepsRecord<TSteps>[K]['resumeSchema'] extends StandardSchemaWithJSON<any>
                ? InferStandardSchemaOutput<StepsRecord<TSteps>[K]['resumeSchema']>
                : unknown,
              StepsRecord<TSteps>[K]['suspendSchema'] extends StandardSchemaWithJSON<any>
                ? InferStandardSchemaOutput<StepsRecord<TSteps>[K]['suspendSchema']>
                : unknown,
              InferStandardSchemaOutput<StepsRecord<TSteps>[K]['outputSchema']>
            >;
      };
      suspendPayload: any;
      suspended: [string[], ...string[][]];
    } & TracingProperties)
  | ({
      status: 'paused';
      state?: TState;
      stepExecutionPath?: string[];
      resumeLabels?: Record<string, { stepId: string; forEachIndex?: number }>;
      input: TInput;
      steps: {
        [K in keyof StepsRecord<TSteps>]: StepsRecord<TSteps>[K]['outputSchema'] extends undefined
          ? StepResult<unknown, unknown, unknown, unknown>
          : StepResult<
              InferStandardSchemaOutput<StepsRecord<TSteps>[K]['inputSchema']>,
              StepsRecord<TSteps>[K]['resumeSchema'] extends StandardSchemaWithJSON<any>
                ? InferStandardSchemaOutput<StepsRecord<TSteps>[K]['resumeSchema']>
                : unknown,
              StepsRecord<TSteps>[K]['suspendSchema'] extends StandardSchemaWithJSON<any>
                ? InferStandardSchemaOutput<StepsRecord<TSteps>[K]['suspendSchema']>
                : unknown,
              InferStandardSchemaOutput<StepsRecord<TSteps>[K]['outputSchema']>
            >;
      };
    } & TracingProperties);

export type WorkflowStreamResult<TState, TInput, TOutput, TSteps extends Step<string, any, any>[]> =
  | WorkflowResult<TState, TInput, TOutput, TSteps>
  | {
      status: 'running' | 'waiting' | 'pending' | 'canceled';
      input: TInput;
      steps: {
        [K in keyof StepsRecord<TSteps>]: StepsRecord<TSteps>[K]['outputSchema'] extends undefined
          ? StepResult<unknown, unknown, unknown, unknown>
          : StepResult<
              InferStandardSchemaOutput<StepsRecord<TSteps>[K]['inputSchema']>,
              StepsRecord<TSteps>[K]['resumeSchema'] extends StandardSchemaWithJSON<any>
                ? InferStandardSchemaOutput<StepsRecord<TSteps>[K]['resumeSchema']>
                : unknown,
              StepsRecord<TSteps>[K]['suspendSchema'] extends StandardSchemaWithJSON<any>
                ? InferStandardSchemaOutput<StepsRecord<TSteps>[K]['suspendSchema']>
                : unknown,
              InferStandardSchemaOutput<StepsRecord<TSteps>[K]['outputSchema']>
            >;
      };
    };

export type WorkflowConfig<
  TWorkflowId extends string,
  TState,
  TInput,
  TOutput,
  TSteps extends Step[],
  TRequestContext extends Record<string, any> | unknown = unknown,
> = {
  mastra?: Mastra;
  id: TWorkflowId;
  description?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
  inputSchema: PublicSchema<TInput>;
  outputSchema: PublicSchema<TOutput>;
  stateSchema?: PublicSchema<TState>;
  /**
   * Optional schema for validating request context values.
   * When provided, the request context will be validated against this schema when the workflow starts.
   * If validation fails, a validation error is thrown.
   */
  requestContextSchema?: PublicSchema<TRequestContext>;
  executionEngine?: ExecutionEngine;
  steps?: TSteps;
  retryConfig?: {
    attempts?: number;
    delay?: number;
  };
  options?: WorkflowOptions;
  /** Type of workflow - 'processor' for processor workflows, 'default' otherwise */
  type?: WorkflowType;
  /**
   * Optional cron schedule configuration. When set, the Mastra scheduler will
   * publish a `workflow.start` event on the cron schedule.
   * Only supported on the evented engine.
   *
   * Accepts either a single schedule object or an array of schedule objects.
   * Array entries must each specify a unique stable `id`. The `inputData`,
   * `initialState`, and `requestContext` fields on each schedule are
   * type-checked against the workflow's `inputSchema`, `stateSchema`, and
   * `requestContextSchema` respectively.
   */
  schedule?: WorkflowScheduleInput<NoInfer<TInput>, NoInfer<TState>, NoInfer<TRequestContext>>;
};

/**
 * Infers the output type from a schema type that may be `undefined`.
 * Returns `unknown` when no schema is provided.
 */
export type InferSchemaOutput<T> = T extends PublicSchema<any> ? InferPublicSchema<T> : unknown;

/**
 * Schema-typed variant of `WorkflowConfig` used by `createWorkflow` factories.
 *
 * Instead of inferring output types through the `PublicSchema<TOutput>` union
 * (which forces TypeScript to distribute across 8+ union members and triggers
 * TS2589 "Type instantiation is excessively deep"), this type infers the
 * **schema type itself** (shallow inference) and defers output-type extraction
 * to `InferSchemaOutput` / `InferPublicSchema` (which use `_output` / `_type`
 * / `~standard` fast paths).
 */
export type CreateWorkflowParams<
  TWorkflowId extends string = string,
  TStateSchema extends PublicSchema<any> | undefined = undefined,
  TInputSchema extends PublicSchema<any> = PublicSchema<any>,
  TOutputSchema extends PublicSchema<any> = PublicSchema<any>,
  TSteps extends Step[] = Step[],
  TRequestContextSchema extends PublicSchema<any> | undefined = undefined,
> = {
  mastra?: Mastra;
  id: TWorkflowId;
  description?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
  inputSchema: TInputSchema;
  outputSchema: TOutputSchema;
  stateSchema?: TStateSchema;
  requestContextSchema?: TRequestContextSchema;
  executionEngine?: ExecutionEngine;
  steps?: TSteps;
  retryConfig?: { attempts?: number; delay?: number };
  options?: WorkflowOptions;
  type?: WorkflowType;
  schedule?: WorkflowScheduleInput<
    NoInfer<InferSchemaOutput<TInputSchema>>,
    NoInfer<InferSchemaOutput<TStateSchema>>,
    NoInfer<InferSchemaOutput<TRequestContextSchema>>
  >;
};

/**
 * Utility type to ensure that TStepState is a subset of TState.
 * This means that all properties in TStepState must exist in TState with compatible types.
 *
 * Special cases:
 * - If TState is `unknown`, any step state is allowed (workflow has no state constraint)
 * - If TStepState is `any`, it's allowed (step doesn't use state)
 * - If TStepState is `unknown`, it's allowed (step doesn't use state)
 */
export type SubsetOf<TStepState, TState> =
  // If workflow has no state (unknown), allow any step state
  unknown extends TState
    ? TStepState
    : // If step state is any or unknown, allow it
      0 extends 1 & TStepState
      ? TStepState
      : unknown extends TStepState
        ? TStepState
        : // Otherwise, check if step state is a subset of workflow state
          TStepState extends infer TStepShape
          ? TState extends infer TStateShape
            ? keyof TStepShape extends keyof TStateShape
              ? {
                  [K in keyof TStepShape]: TStepShape[K] extends TStateShape[K] ? TStepShape[K] : never;
                } extends TStepShape
                ? TStepState
                : never
              : never
            : never
          : never;

/**
 * Execution context passed through workflow execution
 */
export type ExecutionContext = {
  workflowId: string;
  runId: string;
  executionPath: number[];
  stepExecutionPath?: string[];
  activeStepsPath: Record<string, number[]>;
  foreachIndex?: number;
  suspendedPaths: Record<string, number[]>;
  resumeLabels: Record<
    string,
    {
      stepId: string;
      foreachIndex?: number;
    }
  >;
  waitingPaths?: Record<string, number[]>;
  retryConfig: {
    attempts: number;
    delay: number;
  };
  format?: 'legacy' | 'vnext' | undefined;
  state: Record<string, any>;
  /**
   * Trace IDs for creating child spans in durable execution.
   * Set after workflow root span is created, used by child step spans.
   */
  tracingIds?: {
    traceId: string;
    workflowSpanId: string;
  };
};

/**
 * Mutable context that can change during step execution.
 * This is a subset of ExecutionContext containing only the fields that
 * can be modified by step execution (via setState, suspend, etc.)
 */
export type MutableContext = {
  state: Record<string, any>;
  suspendedPaths: Record<string, number[]>;
  resumeLabels: Record<
    string,
    {
      stepId: string;
      foreachIndex?: number;
    }
  >;
};

/**
 * Result returned from step execution methods.
 * Wraps the StepResult with additional context needed for durable execution engines.
 */
export type StepExecutionResult = {
  result: StepResult<any, any, any, any>;
  stepResults: Record<string, StepResult<any, any, any, any>>;
  mutableContext: MutableContext;
  requestContext: Record<string, any>;
};

/**
 * Result returned from entry execution methods.
 * Similar to StepExecutionResult but for top-level entry execution in executeEntry.
 */
export type EntryExecutionResult = {
  result: StepResult<any, any, any, any>;
  stepResults: Record<string, StepResult<any, any, any, any>>;
  mutableContext: MutableContext;
  requestContext: Record<string, any>;
};

// =============================================================================
// Execution Engine Hook Types
// =============================================================================

/**
 * Parameters for the step execution start hook
 */
export type StepExecutionStartParams = {
  workflowId: string;
  runId: string;
  step: Step<any, any, any>;
  inputData: any;
  pubsub: PubSub;
  executionContext: ExecutionContext;
  stepCallId: string;
  stepInfo: Record<string, any>;
};

/**
 * Parameters for executing a regular (non-workflow) step
 */
export type RegularStepExecutionParams = {
  step: Step<any, any, any, any, any, any>;
  stepResults: Record<string, StepResult<any, any, any, any>>;
  executionContext: ExecutionContext;
  resume?: {
    steps: string[];
    resumePayload: any;
    label?: string;
    forEachIndex?: number;
  };
  restart?: RestartExecutionParams;
  timeTravel?: TimeTravelExecutionParams;
  prevOutput: any;
  inputData: any;
  pubsub: PubSub;
  abortController: AbortController;
  requestContext: RequestContext;
  writableStream?: WritableStream<ChunkType>;
  startedAt: number;
  resumeDataToUse?: any;
  stepSpan?: AnySpan;
  validationError?: Error;
  stepCallId: string;
  serializedStepGraph: SerializedStepFlowEntry[];
  resourceId?: string;
  disableScorers?: boolean;
} & Partial<ObservabilityContext>;

/**
 * Result from step execution core logic
 */
export type StepExecutionCoreResult = {
  status: 'success' | 'failed' | 'suspended' | 'bailed';
  output?: any;
  error?: string;
  suspendPayload?: any;
  suspendOutput?: any;
  endedAt?: number;
  suspendedAt?: number;
};

/**
 * Parameters for executing sleep duration (platform-specific)
 */
export type SleepDurationParams = {
  duration: number;
  sleepId: string;
};

/**
 * Parameters for executing sleep until date (platform-specific)
 */
export type SleepUntilDateParams = {
  date: Date;
  sleepUntilId: string;
};

/**
 * Parameters for evaluating a condition (platform-specific wrapping)
 */
export type ConditionEvalParams<TEngineType = DefaultEngineType> = {
  conditionFn: ConditionFunction<any, any, any, any, any, TEngineType>;
  index: number;
  workflowId: string;
  runId: string;
  context: ExecuteFunctionParams<any, any, any, any, any, TEngineType>;
  evalSpan?: AnySpan;
};

/**
 * Parameters for persistence wrapping
 */
export type PersistenceWrapParams = {
  workflowId: string;
  runId: string;
  executionPath: number[];
  persistFn: () => Promise<void>;
};

/**
 * Parameters for wrapping a durable operation (for dynamic sleep/sleepUntil functions)
 */
export type DurableOperationWrapParams<T> = {
  operationId: string;
  operationFn: () => Promise<T>;
};

/**
 * Base type for formatted workflow results returned by fmtReturnValue.
 */
export type FormattedWorkflowResult = {
  status: WorkflowStepStatus | 'tripwire';
  steps: Record<string, StepResult<any, any, any, any>>;
  input: StepResult<any, any, any, any> | undefined;
  result?: any;
  error?: SerializedError;
  suspended?: string[][];
  suspendPayload?: any;
  /** Tripwire data when status is 'tripwire' */
  tripwire?: StepTripwireInfo;
  /** The sequence of step IDs executed in this run */
  stepExecutionPath?: string[];
};
