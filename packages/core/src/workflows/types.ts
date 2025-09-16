import type { TextStreamPart } from 'ai';
import type { z } from 'zod';
import type { TracingPolicy, TracingProperties } from '../ai-tracing';
import type { Mastra } from '../mastra';
import type { ExecutionEngine } from './execution-engine';
import type { ExecuteFunction, Step } from './step';

export type { ChunkType } from '../stream/types';
export type { MastraWorkflowStream } from '../stream/MastraWorkflowStream';

export type Emitter = {
  emit: (event: string, data: any) => Promise<void>;
  on: (event: string, callback: (data: any) => void) => void;
  off: (event: string, callback: (data: any) => void) => void;
  once: (event: string, callback: (data: any) => void) => void;
};

export type StepSuccess<P, R, S, T> = {
  status: 'success';
  output: T;
  payload: P;
  resumePayload?: R;
  suspendPayload?: S;
  startedAt: number;
  endedAt: number;
  suspendedAt?: number;
  resumedAt?: number;
};

export type StepFailure<P, R, S> = {
  status: 'failed';
  error: string | Error;
  payload: P;
  resumePayload?: R;
  suspendPayload?: S;
  startedAt: number;
  endedAt: number;
  suspendedAt?: number;
  resumedAt?: number;
};

export type StepSuspended<P, S> = {
  status: 'suspended';
  payload: P;
  suspendPayload?: S;
  startedAt: number;
  suspendedAt: number;
};

export type StepRunning<P, R, S> = {
  status: 'running';
  payload: P;
  resumePayload?: R;
  suspendPayload?: S;
  startedAt: number;
  suspendedAt?: number;
  resumedAt?: number;
};

export type StepWaiting<P, R, S> = {
  status: 'waiting';
  payload: P;
  suspendPayload?: S;
  resumePayload?: R;
  startedAt: number;
};

export type StepResult<P, R, S, T> =
  | StepSuccess<P, R, S, T>
  | StepFailure<P, R, S>
  | StepSuspended<P, S>
  | StepRunning<P, R, S>
  | StepWaiting<P, R, S>;

export type WorkflowStepStatus = StepResult<any, any, any, any>['status'];

export type StepsRecord<T extends readonly Step<any, any, any>[]> = {
  [K in T[number]['id']]: Extract<T[number], { id: K }>;
};

export type DynamicMapping<TPrevSchema extends z.ZodTypeAny, TSchemaOut extends z.ZodTypeAny> = {
  fn: ExecuteFunction<z.infer<TPrevSchema>, z.infer<TSchemaOut>, any, any, any>;
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

export type WorkflowStreamEvent =
  | {
      type: 'workflow-start';
      payload: {
        workflowId: string;
      };
    }
  | {
      type: 'workflow-finish';
      payload: {};
    }
  | {
      type: 'workflow-canceled';
      payload: {};
    }
  | {
      type: 'workflow-step-start';
      id: string;
      payload: {
        id: string;
        stepCallId: string;
        status: WorkflowStepStatus;
        output?: Record<string, any>;
        payload?: Record<string, any>;
        resumePayload?: Record<string, any>;
        suspendPayload?: Record<string, any>;
      };
    }
  | {
      type: 'workflow-step-finish';
      payload: {
        id: string;
        metadata: Record<string, any>;
      };
    }
  | {
      type: 'workflow-step-suspended';
      payload: {
        id: string;
        status: WorkflowStepStatus;
        output?: Record<string, any>;
        payload?: Record<string, any>;
        resumePayload?: Record<string, any>;
        suspendPayload?: Record<string, any>;
      };
    }
  | {
      type: 'workflow-step-waiting';
      payload: {
        id: string;
        payload: Record<string, any>;
        startedAt: number;
        status: WorkflowStepStatus;
      };
    }
  | {
      type: 'workflow-step-result';
      payload: {
        id: string;
        stepCallId: string;
        status: WorkflowStepStatus;
        output?: Record<string, any>;
        payload?: Record<string, any>;
        resumePayload?: Record<string, any>;
        suspendPayload?: Record<string, any>;
      };
    };

export type WorkflowRunStatus = 'running' | 'success' | 'failed' | 'suspended' | 'waiting' | 'pending' | 'canceled';

export type WatchEvent = {
  type: 'watch';
  payload: {
    currentStep?: {
      id: string;
      status: WorkflowRunStatus;
      output?: Record<string, any>;
      resumePayload?: Record<string, any>;
      payload?: Record<string, any>;
      error?: string | Error;
    };
    workflowState: {
      status: WorkflowRunStatus;
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
    };
  };
  eventTimestamp: Date;
};

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

export interface WorkflowRunState {
  // Core state info
  runId: string;
  status: WorkflowRunStatus;
  result?: Record<string, any>;
  error?: string | Error;
  runtimeContext?: Record<string, any>;
  value: Record<string, string>;
  context: { input?: Record<string, any> } & Record<string, StepResult<any, any, any, any>>;
  serializedStepGraph: SerializedStepFlowEntry[];
  activePaths: Array<unknown>;
  suspendedPaths: Record<string, number[]>;
  waitingPaths: Record<string, number[]>;
  timestamp: number;
}

export interface WorkflowOptions {
  tracingPolicy?: TracingPolicy;
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
  | { type: 'sleep'; id: string; duration?: number; fn?: ExecuteFunction<any, any, any, any, TEngineType> }
  | { type: 'sleepUntil'; id: string; date?: Date; fn?: ExecuteFunction<any, any, any, any, TEngineType> }
  | { type: 'waitForEvent'; event: string; step: Step; timeout?: number }
  | {
      type: 'parallel';
      steps: StepFlowEntry[];
    }
  | {
      type: 'conditional';
      steps: StepFlowEntry[];
      conditions: ExecuteFunction<any, any, any, any, TEngineType>[];
      serializedConditions: { id: string; fn: string }[];
    }
  | {
      type: 'loop';
      step: Step;
      condition: ExecuteFunction<any, any, any, any, TEngineType>;
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
  Step<any, any, any, any, any, TEngineType>,
  'id' | 'description'
> & {
  component?: string;
  serializedStepFlow?: SerializedStepFlowEntry[];
  mapConfig?: string;
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
      type: 'waitForEvent';
      event: string;
      step: SerializedStep;
      timeout?: number;
    }
  | {
      type: 'parallel';
      steps: SerializedStepFlowEntry[];
    }
  | {
      type: 'conditional';
      steps: SerializedStepFlowEntry[];
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

export type WorkflowResult<TOutput extends z.ZodType<any>, TSteps extends Step<string, any, any>[]> =
  | ({
      status: 'success';
      result: z.infer<TOutput>;
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
      suspended: [string[], ...string[][]];
    } & TracingProperties);

export type WorkflowConfig<
  TWorkflowId extends string = string,
  TInput extends z.ZodType<any> = z.ZodType<any>,
  TOutput extends z.ZodType<any> = z.ZodType<any>,
  TSteps extends Step<string, any, any, any, any, any>[] = Step<string, any, any, any, any, any>[],
> = {
  mastra?: Mastra;
  id: TWorkflowId;
  description?: string | undefined;
  inputSchema: TInput;
  outputSchema: TOutput;
  executionEngine?: ExecutionEngine;
  steps?: TSteps;
  retryConfig?: {
    attempts?: number;
    delay?: number;
  };
  options?: WorkflowOptions;
};
