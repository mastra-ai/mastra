import type { z } from 'zod';
import type { NewStep } from './step';

export type StepSuccess<T> = {
  status: 'success';
  output: T;
};

export type StepFailure = {
  status: 'failed';
  error: string;
};

export type StepSuspended<T> = {
  status: 'suspended';
  payload: T;
};

export type StepResult<T> = StepSuccess<T> | StepFailure | StepSuspended<T>;

export type StepsRecord<T extends readonly NewStep<any, any, any>[]> = {
  [K in T[number]['id']]: Extract<T[number], { id: K }>;
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
  TStep extends NewStep<any, any, any>,
  TKey extends 'inputSchema' | 'outputSchema',
> = TStep[TKey];

export type VariableReference<
  TStep extends NewStep<string, any, any> = NewStep<string, any, any>,
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
      payload?: Record<string, any>;
    };
    workflowState: {
      status: 'running' | 'success' | 'failed' | 'suspended';
      steps: Record<
        string,
        {
          status: 'running' | 'success' | 'failed' | 'suspended';
          output?: Record<string, any>;
          payload?: Record<string, any>;
        }
      >;
      output?: Record<string, any>;
      payload?: Record<string, any>;
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
