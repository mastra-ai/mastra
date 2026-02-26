import type { WritableStream } from 'node:stream/web';
import type { TextStreamPart } from '@internal/ai-sdk-v4';
import type { z } from 'zod';
import type { SerializedError } from '../error';
import type { MastraScorers } from '../evals';
import type { PubSub } from '../events/pubsub';
import type { IMastraLogger } from '../logger';
import type { Mastra } from '../mastra';
import type { AnySpan, ObservabilityContext, TracingOptions, TracingPolicy, TracingProperties } from '../observability';
import type { RequestContext } from '../request-context';
import type { OutputSchema } from '../stream';
import type { InferZodLikeSchema, SchemaWithValidation } from '../stream/base/schema';
import type { ChunkType, WorkflowStreamEvent } from '../stream/types';
import type { Tool, ToolExecutionContext } from '../tools';
import type { DynamicArgument } from '../types';
import type { ZodLikeSchema } from '../types/zod-compat';
import type { ExecutionEngine } from './execution-engine';
import type { ConditionFunction, ExecuteFunction, ExecuteFunctionParams, LoopConditionFunction, Step } from './step';

export type OutputWriter<TChunk = any> = (chunk: TChunk) => Promise<void>;

/**
 * Options for `Run.start()` beyond the generic `inputData`/`initialState`/`requestContext` fields.
 */
export type WorkflowRunStartOptions = {
  outputWriter?: OutputWriter;
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
};

export type TimeTravelExecutionParams = {
  executionPath: number[];
  inputData?: any;
  stepResults: Record<string, StepResult<any, any, any, any>>;
  nestedStepResults?: Record<string, Record<string, StepResult<any, any, any, any>>>;
  steps: string[];
  state?: Record<string, any>;
  resumeData?: any;
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

export type StepResult<P, R, S, T> =
  | StepSuccess<P, R, S, T>
  | StepFailure<P, R, S, T>
  | StepSuspended<P, S, T>
  | StepRunning<P, R, S, T>
  | StepWaiting<P, R, S, T>
  | StepPaused<P, R, S, T>;

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
  | StepPaused<P, R, S, T>;

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

export type ExtractSchemaType<T extends ZodLikeSchema> = T extends ZodLikeSchema<infer V> ? V : never;

export type ExtractSchemaFromStep<
  TStep extends Step<any, any, any, any, any, any, any>,
  TKey extends 'inputSchema' | 'outputSchema',
> = TStep[TKey];

export type VariableReference<
  TStep extends Step<string, any, any> = Step<string, any, any>,
  TVarPath extends PathsToStringProps<ExtractSchemaType<ExtractSchemaFromStep<TStep, 'outputSchema'>>> | '' | '.' =
    | PathsToStringProps<ExtractSchemaType<ExtractSchemaFromStep<TStep, 'outputSchema'>>>
    | ''
    | '.',
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
  | 'paused';

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
  // Optional detailed fields (can be excluded for performance)
  activeStepsPath?: Record<string, number[]>;
  serializedStepGraph?: SerializedStepFlowEntry[];
  // Step Information (processed) - optional when using field filtering
  steps?: Record<
    string,
    {
      status: WorkflowRunStatus;
      output?: Record<string, any>;
      payload?: Record<string, any>;
      resumePayload?: Record<string, any>;
      error?: SerializedError;
      startedAt: number;
      endedAt: number;
      suspendedAt?: number;
      resumedAt?: number;
    }
  >;
  result?: Record<string, any>;
  payload?: Record<string, any>;
  error?: SerializedError;
}

/**
 * Valid field names for filtering WorkflowState responses.
 * Use with getWorkflowRunById to reduce payload size.
 * Note: Metadata fields (runId, workflowName, resourceId, createdAt, updatedAt) and status are always included.
 */
export type WorkflowStateField = 'result' | 'error' | 'payload' | 'steps' | 'activeStepsPath' | 'serializedStepGraph';

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
  resumeLabels: Record<
    string,
    {
      stepId: string;
      foreachIndex?: number;
    }
  >;
  waitingPaths: Record<string, number[]>;
  timestamp: number;
  /** Tripwire data when status is 'tripwire' */
  tripwire?: StepTripwireInfo;
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
}

export interface WorkflowOptions {
  tracingPolicy?: TracingPolicy;
  validateInputs?: boolean;
  shouldPersistSnapshot?: (params: {
    stepResults: Record<string, StepResult<any, any, any, any>>;
    workflowStatus: WorkflowRunStatus;
  }) => boolean;

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
  stepGraph: SerializedStepFlowEntry[];
  inputSchema: string | undefined;
  outputSchema: string | undefined;
  stateSchema: string | undefined;
  requestContextSchema: string | undefined;
  options?: WorkflowOptions;
  stepCount?: number;
  /** Whether this workflow is a processor workflow (auto-generated from agent processors) */
  isProcessorWorkflow?: boolean;
};

export type DefaultEngineType = {};

export type StepFlowEntry<TEngineType = DefaultEngineType> =
  | { type: 'step'; step: Step }
  | { type: 'sleep'; id: string; duration?: number; fn?: ExecuteFunction<any, any, any, any, any, TEngineType> }
  | { type: 'sleepUntil'; id: string; date?: Date; fn?: ExecuteFunction<any, any, any, any, any, TEngineType> }
  | {
      type: 'parallel';
      steps: { type: 'step'; step: Step }[];
    }
  | {
      type: 'conditional';
      steps: { type: 'step'; step: Step }[];
      conditions: ConditionFunction<any, any, any, any, any, TEngineType>[];
      serializedConditions: { id: string; fn: string }[];
    }
  | {
      type: 'loop';
      step: Step;
      condition: LoopConditionFunction<any, any, any, any, any, TEngineType>;
      serializedCondition: { id: string; fn: string };
      loopType: 'dowhile' | 'dountil';
    }
  | {
      type: 'foreach';
      step: Step;
      opts: {
        concurrency: number;
      };
    };

export type SerializedStep<TEngineType = DefaultEngineType> = Pick<
  Step<any, any, any, any, any, any, TEngineType>,
  'id' | 'description' | 'metadata'
> & {
  component?: string;
  serializedStepFlow?: SerializedStepFlowEntry[];
  mapConfig?: string;
  canSuspend?: boolean;
};

export type SerializedStepFlowEntry =
  | {
      type: 'step';
      step: SerializedStep;
    }
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
      steps: {
        type: 'step';
        step: SerializedStep;
      }[];
    }
  | {
      type: 'conditional';
      steps: {
        type: 'step';
        step: SerializedStep;
      }[];
      serializedConditions: { id: string; fn: string }[];
    }
  | {
      type: 'loop';
      step: SerializedStep;
      serializedCondition: { id: string; fn: string };
      loopType: 'dowhile' | 'dountil';
    }
  | {
      type: 'foreach';
      step: SerializedStep;
      opts: {
        concurrency: number;
      };
    };

export type StepWithComponent = Step<string, any, any, any, any, any> & {
  component?: string;
  steps?: Record<string, StepWithComponent>;
};

/**
 * StepParams with schema-based inference for better type errors.
 * Generic parameters are the SCHEMAS, and we infer value types from them.
 * Uses z.infer for proper TypeScript contextual typing of the execute function.
 */
export type StepParams<
  TStepId extends string,
  TStateSchema extends z.ZodTypeAny | undefined,
  TInputSchema extends z.ZodTypeAny,
  TOutputSchema extends z.ZodTypeAny,
  TResumeSchema extends z.ZodTypeAny | undefined = undefined,
  TSuspendSchema extends z.ZodTypeAny | undefined = undefined,
  TRequestContextSchema extends z.ZodTypeAny | undefined = undefined,
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
    TStateSchema extends z.ZodTypeAny ? z.infer<TStateSchema> : unknown,
    z.infer<TInputSchema>,
    z.infer<TOutputSchema>,
    TResumeSchema extends z.ZodTypeAny ? z.infer<TResumeSchema> : unknown,
    TSuspendSchema extends z.ZodTypeAny ? z.infer<TSuspendSchema> : unknown,
    DefaultEngineType,
    TRequestContextSchema extends z.ZodTypeAny ? z.infer<TRequestContextSchema> : unknown
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
  inputSchema: SchemaWithValidation<TSchemaIn>;
  outputSchema: SchemaWithValidation<TSchemaOut>;
  execute: (input: TSchemaIn, context?: TContext) => Promise<any>;
};

export type WorkflowResult<TState, TInput, TOutput, TSteps extends Step<string, any, any, any, any, any>[]> =
  | ({
      status: 'success';
      state?: TState;
      resumeLabels?: Record<string, { stepId: string; forEachIndex?: number }>;
      result: TOutput;
      input: TInput;
      steps: {
        [K in keyof StepsRecord<TSteps>]: StepsRecord<TSteps>[K]['outputSchema'] extends undefined
          ? StepResult<unknown, unknown, unknown, unknown>
          : StepResult<
              InferZodLikeSchema<NonNullable<StepsRecord<TSteps>[K]['inputSchema']>>,
              InferZodLikeSchema<NonNullable<StepsRecord<TSteps>[K]['resumeSchema']>>,
              InferZodLikeSchema<NonNullable<StepsRecord<TSteps>[K]['suspendSchema']>>,
              InferZodLikeSchema<NonNullable<StepsRecord<TSteps>[K]['outputSchema']>>
            >;
      };
    } & TracingProperties)
  | ({
      status: 'failed';
      input: TInput;
      state?: TState;
      resumeLabels?: Record<string, { stepId: string; forEachIndex?: number }>;
      steps: {
        [K in keyof StepsRecord<TSteps>]: StepsRecord<TSteps>[K]['outputSchema'] extends undefined
          ? StepResult<unknown, unknown, unknown, unknown>
          : StepResult<
              InferZodLikeSchema<NonNullable<StepsRecord<TSteps>[K]['inputSchema']>>,
              InferZodLikeSchema<NonNullable<StepsRecord<TSteps>[K]['resumeSchema']>>,
              InferZodLikeSchema<NonNullable<StepsRecord<TSteps>[K]['suspendSchema']>>,
              InferZodLikeSchema<NonNullable<StepsRecord<TSteps>[K]['outputSchema']>>
            >;
      };
      error: Error;
    } & TracingProperties)
  | ({
      status: 'tripwire';
      input: TInput;
      state?: TState;
      resumeLabels?: Record<string, { stepId: string; forEachIndex?: number }>;
      steps: {
        [K in keyof StepsRecord<TSteps>]: StepsRecord<TSteps>[K]['outputSchema'] extends undefined
          ? StepResult<unknown, unknown, unknown, unknown>
          : StepResult<
              InferZodLikeSchema<NonNullable<StepsRecord<TSteps>[K]['inputSchema']>>,
              InferZodLikeSchema<NonNullable<StepsRecord<TSteps>[K]['resumeSchema']>>,
              InferZodLikeSchema<NonNullable<StepsRecord<TSteps>[K]['suspendSchema']>>,
              InferZodLikeSchema<NonNullable<StepsRecord<TSteps>[K]['outputSchema']>>
            >;
      };
      /** Tripwire data including reason, retry flag, metadata, and processor ID */
      tripwire: StepTripwireInfo;
    } & TracingProperties)
  | ({
      status: 'suspended';
      input: TInput;
      state?: TState;
      resumeLabels?: Record<string, { stepId: string; forEachIndex?: number }>;
      steps: {
        [K in keyof StepsRecord<TSteps>]: StepsRecord<TSteps>[K]['outputSchema'] extends undefined
          ? StepResult<unknown, unknown, unknown, unknown>
          : StepResult<
              InferZodLikeSchema<NonNullable<StepsRecord<TSteps>[K]['inputSchema']>>,
              InferZodLikeSchema<NonNullable<StepsRecord<TSteps>[K]['resumeSchema']>>,
              InferZodLikeSchema<NonNullable<StepsRecord<TSteps>[K]['suspendSchema']>>,
              InferZodLikeSchema<NonNullable<StepsRecord<TSteps>[K]['outputSchema']>>
            >;
      };
      suspendPayload: any;
      suspended: [string[], ...string[][]];
    } & TracingProperties)
  | ({
      status: 'paused';
      state?: TState;
      resumeLabels?: Record<string, { stepId: string; forEachIndex?: number }>;
      input: TInput;
      steps: {
        [K in keyof StepsRecord<TSteps>]: StepsRecord<TSteps>[K]['outputSchema'] extends undefined
          ? StepResult<unknown, unknown, unknown, unknown>
          : StepResult<
              InferZodLikeSchema<NonNullable<StepsRecord<TSteps>[K]['inputSchema']>>,
              InferZodLikeSchema<NonNullable<StepsRecord<TSteps>[K]['resumeSchema']>>,
              InferZodLikeSchema<NonNullable<StepsRecord<TSteps>[K]['suspendSchema']>>,
              InferZodLikeSchema<NonNullable<StepsRecord<TSteps>[K]['outputSchema']>>
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
              InferZodLikeSchema<NonNullable<StepsRecord<TSteps>[K]['inputSchema']>>,
              InferZodLikeSchema<NonNullable<StepsRecord<TSteps>[K]['resumeSchema']>>,
              InferZodLikeSchema<NonNullable<StepsRecord<TSteps>[K]['suspendSchema']>>,
              InferZodLikeSchema<NonNullable<StepsRecord<TSteps>[K]['outputSchema']>>
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
  inputSchema: SchemaWithValidation<TInput>;
  outputSchema: SchemaWithValidation<TOutput>;
  stateSchema?: SchemaWithValidation<TState>;
  /**
   * Optional schema for validating request context values.
   * When provided, the request context will be validated against this schema when the workflow starts.
   * If validation fails, a validation error is thrown.
   */
  requestContextSchema?: SchemaWithValidation<TRequestContext>;
  executionEngine?: ExecutionEngine;
  steps?: TSteps;
  retryConfig?: {
    attempts?: number;
    delay?: number;
  };
  options?: WorkflowOptions;
  /** Type of workflow - 'processor' for processor workflows, 'default' otherwise */
  type?: WorkflowType;
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
};
