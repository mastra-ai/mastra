import type { TextStreamPart } from '@internal/ai-sdk-v4';
import type { z } from 'zod';
import type { MastraScorers } from '../evals';
import type { Mastra } from '../mastra';
import type { TracingPolicy, TracingProperties } from '../observability';
import type { WorkflowStreamEvent } from '../stream/types';
import type { Tool, ToolExecutionContext } from '../tools';
import type { DynamicArgument } from '../types';
import type { ExecutionEngine } from './execution-engine';
import type { ConditionFunction, ExecuteFunction, LoopConditionFunction, Step } from './step';

export type { ChunkType, WorkflowStreamEvent } from '../stream/types';
export type { MastraWorkflowStream } from '../stream/MastraWorkflowStream';

export type WorkflowEngineType = string;

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

export type Emitter = {
  emit: (event: string, data: any) => Promise<void>;
  on: (event: string, callback: (data: any) => void) => void;
  off: (event: string, callback: (data: any) => void) => void;
  once: (event: string, callback: (data: any) => void) => void;
};

export type StepMetadata = Record<string, any>;

export type StepSuccess<P, R, S, T> = {
  status: 'success';
  output: T;
  payload: P;
  resumePayload?: R;
  suspendPayload?: S;
  suspendOutput?: T;
  startedAt: number;
  endedAt: number;
  suspendedAt?: number;
  resumedAt?: number;
  metadata?: StepMetadata;
};

export type StepFailure<P, R, S, T> = {
  status: 'failed';
  error: string | Error;
  payload: P;
  resumePayload?: R;
  suspendPayload?: S;
  suspendOutput?: T;
  startedAt: number;
  endedAt: number;
  suspendedAt?: number;
  resumedAt?: number;
  metadata?: StepMetadata;
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

export type StepResult<P, R, S, T> =
  | StepSuccess<P, R, S, T>
  | StepFailure<P, R, S, T>
  | StepSuspended<P, S, T>
  | StepRunning<P, R, S, T>
  | StepWaiting<P, R, S, T>;

export type TimeTravelContext<P, R, S, T> = Record<
  string,
  {
    status: WorkflowRunStatus;
    payload: P;
    output: T;
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

export type StepsRecord<T extends readonly Step<any, any, any>[]> = {
  [K in T[number]['id']]: Extract<T[number], { id: K }>;
};

export type DynamicMapping<TPrevSchema extends z.ZodTypeAny, TSchemaOut extends z.ZodTypeAny> = {
  fn: ExecuteFunction<any, z.infer<TPrevSchema>, z.infer<TSchemaOut>, any, any, any>;
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

export type ExtractSchemaType<T extends z.ZodType<any>> = T extends z.ZodObject<infer V> ? V : never;

export type ExtractSchemaFromStep<
  TStep extends Step<any, any, any>,
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
  | { value: any; schema: z.ZodTypeAny };

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
  | 'suspended'
  | 'waiting'
  | 'pending'
  | 'canceled'
  | 'bailed';

// Type to get the inferred type at a specific path in a Zod schema
export type ZodPathType<T extends z.ZodTypeAny, P extends string> =
  T extends z.ZodObject<infer Shape>
    ? P extends `${infer Key}.${infer Rest}`
      ? Key extends keyof Shape
        ? Shape[Key] extends z.ZodTypeAny
          ? ZodPathType<Shape[Key], Rest>
          : never
        : never
      : P extends keyof Shape
        ? Shape[P]
        : never
    : never;

export interface WorkflowState {
  status: WorkflowRunStatus;
  activeStepsPath: Record<string, number[]>;
  serializedStepGraph: SerializedStepFlowEntry[];
  steps: Record<
    string,
    {
      status: WorkflowRunStatus;
      output?: Record<string, any>;
      payload?: Record<string, any>;
      resumePayload?: Record<string, any>;
      error?: string | Error;
      startedAt: number;
      endedAt: number;
      suspendedAt?: number;
      resumedAt?: number;
    }
  >;
  result?: Record<string, any>;
  payload?: Record<string, any>;
  error?: string | Error;
}

export interface WorkflowRunState {
  // Core state info
  runId: string;
  status: WorkflowRunStatus;
  result?: Record<string, any>;
  error?: string | Error;
  requestContext?: Record<string, any>;
  value: Record<string, string>;
  context: { input?: Record<string, any> } & Record<string, StepResult<any, any, any, any>>;
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
}

export interface WorkflowOptions {
  tracingPolicy?: TracingPolicy;
  validateInputs?: boolean;
  shouldPersistSnapshot?: (params: {
    stepResults: Record<string, StepResult<any, any, any, any>>;
    workflowStatus: WorkflowRunStatus;
  }) => boolean;
}

export type WorkflowInfo = {
  steps: Record<string, SerializedStep>;
  allSteps: Record<string, SerializedStep>;
  name: string | undefined;
  description: string | undefined;
  stepGraph: SerializedStepFlowEntry[];
  inputSchema: string | undefined;
  outputSchema: string | undefined;
  options?: WorkflowOptions;
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
      conditions: ConditionFunction<any, any, any, any, TEngineType>[];
      serializedConditions: { id: string; fn: string }[];
    }
  | {
      type: 'loop';
      step: Step;
      condition: LoopConditionFunction<any, any, any, any, TEngineType>;
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
  'id' | 'description'
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

export type StepParams<
  TStepId extends string,
  TState extends z.ZodObject<any>,
  TStepInput extends z.ZodType<any>,
  TStepOutput extends z.ZodType<any>,
  TResumeSchema extends z.ZodType<any>,
  TSuspendSchema extends z.ZodType<any>,
> = {
  id: TStepId;
  description?: string;
  inputSchema: TStepInput;
  outputSchema: TStepOutput;
  resumeSchema?: TResumeSchema;
  suspendSchema?: TSuspendSchema;
  stateSchema?: TState;
  retries?: number;
  scorers?: DynamicArgument<MastraScorers>;
  execute: ExecuteFunction<
    z.infer<TState>,
    z.infer<TStepInput>,
    z.infer<TStepOutput>,
    z.infer<TResumeSchema>,
    z.infer<TSuspendSchema>,
    DefaultEngineType
  >;
};

export type ToolStep<
  TSchemaIn extends z.ZodType<any>,
  TSuspendSchema extends z.ZodType<any>,
  TResumeSchema extends z.ZodType<any>,
  TSchemaOut extends z.ZodType<any>,
  TContext extends ToolExecutionContext<TSuspendSchema, TResumeSchema>,
> = Tool<TSchemaIn, TSchemaOut, TSuspendSchema, TResumeSchema, TContext> & {
  inputSchema: TSchemaIn;
  outputSchema: TSchemaOut;
  execute: (input: z.infer<TSchemaIn>, context?: TContext) => Promise<any>;
};

export type WorkflowResult<
  TState extends z.ZodObject<any>,
  TInput extends z.ZodType<any>,
  TOutput extends z.ZodType<any>,
  TSteps extends Step<string, any, any>[],
> =
  | ({
      status: 'success';
      state?: z.infer<TState>;
      resumeLabels?: Record<string, { stepId: string; forEachIndex?: number }>;
      result: z.infer<TOutput>;
      input: z.infer<TInput>;
      steps: {
        [K in keyof StepsRecord<TSteps>]: StepsRecord<TSteps>[K]['outputSchema'] extends undefined
          ? StepResult<unknown, unknown, unknown, unknown>
          : StepResult<
              z.infer<NonNullable<StepsRecord<TSteps>[K]['inputSchema']>>,
              z.infer<NonNullable<StepsRecord<TSteps>[K]['resumeSchema']>>,
              z.infer<NonNullable<StepsRecord<TSteps>[K]['suspendSchema']>>,
              z.infer<NonNullable<StepsRecord<TSteps>[K]['outputSchema']>>
            >;
      };
    } & TracingProperties)
  | ({
      status: 'failed';
      input: z.infer<TInput>;
      state?: z.infer<TState>;
      resumeLabels?: Record<string, { stepId: string; forEachIndex?: number }>;
      steps: {
        [K in keyof StepsRecord<TSteps>]: StepsRecord<TSteps>[K]['outputSchema'] extends undefined
          ? StepResult<unknown, unknown, unknown, unknown>
          : StepResult<
              z.infer<NonNullable<StepsRecord<TSteps>[K]['inputSchema']>>,
              z.infer<NonNullable<StepsRecord<TSteps>[K]['resumeSchema']>>,
              z.infer<NonNullable<StepsRecord<TSteps>[K]['suspendSchema']>>,
              z.infer<NonNullable<StepsRecord<TSteps>[K]['outputSchema']>>
            >;
      };
      error: Error;
    } & TracingProperties)
  | ({
      status: 'suspended';
      input: z.infer<TInput>;
      state?: z.infer<TState>;
      resumeLabels?: Record<string, { stepId: string; forEachIndex?: number }>;
      steps: {
        [K in keyof StepsRecord<TSteps>]: StepsRecord<TSteps>[K]['outputSchema'] extends undefined
          ? StepResult<unknown, unknown, unknown, unknown>
          : StepResult<
              z.infer<NonNullable<StepsRecord<TSteps>[K]['inputSchema']>>,
              z.infer<NonNullable<StepsRecord<TSteps>[K]['resumeSchema']>>,
              z.infer<NonNullable<StepsRecord<TSteps>[K]['suspendSchema']>>,
              z.infer<NonNullable<StepsRecord<TSteps>[K]['outputSchema']>>
            >;
      };
      suspendPayload: any;
      suspended: [string[], ...string[][]];
    } & TracingProperties);

export type WorkflowStreamResult<
  TState extends z.ZodObject<any>,
  TInput extends z.ZodType<any>,
  TOutput extends z.ZodType<any>,
  TSteps extends Step<string, any, any>[],
> =
  | WorkflowResult<TState, TInput, TOutput, TSteps>
  | {
      status: 'running' | 'waiting' | 'pending' | 'canceled';
      input: z.infer<TInput>;
      steps: {
        [K in keyof StepsRecord<TSteps>]: StepsRecord<TSteps>[K]['outputSchema'] extends undefined
          ? StepResult<unknown, unknown, unknown, unknown>
          : StepResult<
              z.infer<NonNullable<StepsRecord<TSteps>[K]['inputSchema']>>,
              z.infer<NonNullable<StepsRecord<TSteps>[K]['resumeSchema']>>,
              z.infer<NonNullable<StepsRecord<TSteps>[K]['suspendSchema']>>,
              z.infer<NonNullable<StepsRecord<TSteps>[K]['outputSchema']>>
            >;
      };
    };

export type WorkflowConfig<
  TWorkflowId extends string = string,
  TState extends z.ZodObject<any> = z.ZodObject<any>,
  TInput extends z.ZodType<any> = z.ZodType<any>,
  TOutput extends z.ZodType<any> = z.ZodType<any>,
  TSteps extends Step<string, any, any, any, any, any>[] = Step<string, any, any, any, any, any>[],
> = {
  mastra?: Mastra;
  id: TWorkflowId;
  description?: string | undefined;
  inputSchema: TInput;
  outputSchema: TOutput;
  stateSchema?: TState;
  executionEngine?: ExecutionEngine;
  steps?: TSteps;
  retryConfig?: {
    attempts?: number;
    delay?: number;
  };
  options?: WorkflowOptions;
};

/**
 * Utility type to ensure that TStepState is a subset of TState.
 * This means that all properties in TStepState must exist in TState with compatible types.
 */
export type SubsetOf<TStepState extends z.ZodObject<any>, TState extends z.ZodObject<any>> =
  TStepState extends z.ZodObject<infer TStepShape>
    ? TState extends z.ZodObject<infer TStateShape>
      ? keyof TStepShape extends keyof TStateShape
        ? {
            [K in keyof TStepShape]: TStepShape[K] extends TStateShape[K] ? TStepShape[K] : never;
          } extends TStepShape
          ? TStepState
          : never
        : never
      : never
    : never;
