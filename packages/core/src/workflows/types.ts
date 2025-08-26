import type { TextStreamPart } from 'ai';
import type { z } from 'zod';
import type { ExecuteFunction, Step } from './step';
import type { SerializedStepFlowEntry } from './workflow';

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

type SerializedStep = {
  id: string;
  description: string;
  inputSchema: string | undefined;
  outputSchema: string | undefined;
  resumeSchema: string | undefined;
  suspendSchema: string | undefined;
};

export type WorkflowInfo = {
  steps: Record<string, SerializedStep>;
  allSteps: Record<string, SerializedStep>;
  name: string | undefined;
  description: string | undefined;
  stepGraph: SerializedStepFlowEntry[];
  inputSchema: string | undefined;
  outputSchema: string | undefined;
};
