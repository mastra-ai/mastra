import type { z } from 'zod';
import type { ExecuteFunction, Step } from './step';

export type StepSuccess<P, R, T> = {
  status: 'success';
  output: T;
  payload: P;
  resumePayload?: R;
  startedAt: Date;
  endedAt: Date;
  suspendedAt?: Date;
  resumedAt?: Date;
};

export type StepFailure<P, R> = {
  status: 'failed';
  error: string | Error;
  payload: P;
  resumePayload?: R;
  startedAt: Date;
  endedAt: Date;
  suspendedAt?: Date;
  resumedAt?: Date;
};

export type StepSuspended<P> = {
  status: 'suspended';
  payload: P;
  startedAt: Date;
  suspendedAt: Date;
};

export type StepRunning<P, R> = {
  status: 'running';
  payload: P;
  resumePayload?: R;
  startedAt: Date;
  suspendedAt?: Date;
  resumedAt?: Date;
};

export type StepResult<P, R, T> = StepSuccess<P, R, T> | StepFailure<P, R> | StepSuspended<P> | StepRunning<P, R>;

export type StepsRecord<T extends readonly Step<any, any, any>[]> = {
  [K in T[number]['id']]: Extract<T[number], { id: K }>;
};

export type DynamicMapping<TPrevSchema extends z.ZodTypeAny, TSchemaOut extends z.ZodTypeAny> = {
  fn: ExecuteFunction<z.infer<TPrevSchema>, z.infer<TSchemaOut>, any, any>;
  schema: TSchemaOut;
};

export type PathsToStringProps<T> = T extends object
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

export type WatchEvent = {
  type: 'watch';
  payload: {
    currentStep?: {
      id: string;
      status: 'running' | 'success' | 'failed' | 'suspended';
      output?: Record<string, any>;
      resumePayload?: Record<string, any>;
      payload?: Record<string, any>;
      error?: string | Error;
    };
    workflowState: {
      status: 'running' | 'success' | 'failed' | 'suspended';
      steps: Record<
        string,
        {
          status: 'running' | 'success' | 'failed' | 'suspended';
          output?: Record<string, any>;
          payload?: Record<string, any>;
          resumePayload?: Record<string, any>;
          error?: string | Error;
          startedAt: Date;
          endedAt: Date;
          suspendedAt?: Date;
          resumedAt?: Date;
        }
      >;
      output?: Record<string, any>;
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
  value: Record<string, string>;
  context: { input?: Record<string, any> } & Record<string, StepResult<any, any, any>>;
  activePaths: Array<unknown>;
  suspendedPaths: Record<string, number[]>;
  timestamp: number;
}
