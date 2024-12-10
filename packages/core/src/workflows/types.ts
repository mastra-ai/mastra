import { Query } from 'sift';
import { z } from 'zod';

import { AssignAction } from 'xstate/actions';

import { BaseLogMessage, RegisteredLogger } from '../logger';

import { Step } from './step';

export type StepNode = { step: Step<any, any, any>; config: StepDef<any, any, any, any>[any] };

export type StepGraph = {
  initial: StepNode[];
  [key: string]: StepNode[];
};

export type RetryConfig = { attempts?: number; delay?: number };

export type VariableReference<TStep extends Step<any, any, any>> =
  TStep extends Step<any, any, any>
    ? {
        step: TStep;
        path: PathsToStringProps<ExtractSchemaType<ExtractSchemaFromStep<TStep, 'outputSchema'>>> | '' | '.';
      }
    : {
        step: 'trigger';
        path: string; // TODO: Add trigger schema types
      };

export interface BaseCondition<TStep extends Step<any, any, any>> {
  ref: TStep extends Step<any, any, any>
    ? {
        step: TStep;
        path: PathsToStringProps<ExtractSchemaType<ExtractSchemaFromStep<TStep, 'outputSchema'>>> | '' | '.';
      }
    : {
        step: 'trigger';
        path: string;
      };
  query: Query<any>;
}

export type StepDef<
  TStepId extends TSteps[number]['id'],
  TSteps extends Step<any, any, any>[],
  TSchemaIn extends z.ZodType<any>,
  TSchemaOut extends z.ZodType<any>,
> = Record<
  TStepId,
  {
    snapshotOnTimeout?: boolean;
    condition?: Condition<any>;
    conditionFn?: (args: { context: WorkflowContext }) => Promise<boolean>;
    data: TSchemaIn;
    handler: (args: { data: z.infer<TSchemaIn>; runId: string }) => Promise<z.infer<TSchemaOut>>;
  }
>;

export type StepCondition<TStep extends Step<any, any, any>> =
  | BaseCondition<TStep>
  | { and: StepCondition<TStep>[] }
  | { or: StepCondition<TStep>[] };

export interface StepTransitionCondition<TStep extends Step<any, any, any>> {
  condition: StepCondition<TStep>;
}

type Condition<TStep extends Step<any, any, any>> =
  | BaseCondition<TStep>
  | { and: Condition<TStep>[] }
  | { or: Condition<TStep>[] };

export interface StepConfig<TStep extends Step<any, any, any>, CondStep extends Step<any, any, any>> {
  snapshotOnTimeout?: boolean;
  condition?: Condition<CondStep>;
  conditionFn?: (args: { context: WorkflowContext }) => Promise<boolean>;
  variables?: StepInputType<TStep, 'inputSchema'> extends never
    ? Record<string, VariableReference<TStep>>
    : {
        [K in keyof StepInputType<TStep, 'inputSchema'>]?: VariableReference<CondStep>;
      };
}

type StepSuccess<T> = {
  status: 'success';
  payload: T;
};

type StepSuspended = {
  status: 'suspended';
};

type StepFailure = {
  status: 'failed';
  error: string;
};

type StepSkipped = {
  status: 'skipped';
  failedDependencyIds: string[];
};

export type StepResult<T> = StepSuccess<T> | StepFailure | StepSkipped | StepSuspended;

// Update WorkflowContext
export interface WorkflowContext<TTrigger = any> {
  stepResults: Record<string, StepResult<any>>;
  triggerData: TTrigger;
  attempts: Record<string, number>;
}

export interface WorkflowLogMessage extends BaseLogMessage {
  type: typeof RegisteredLogger.WORKFLOW;
  workflowName: string;
  stepId?: StepId;
  data?: unknown;
  runId?: string;
}

export type ValidationErrorType = 'circular_dependency' | 'no_terminal_path' | 'unreachable_step';

export interface ValidationError {
  type: ValidationErrorType;
  message: string;
  details: {
    stepId?: StepId;
    path?: StepId[];
  };
}

export interface WorkflowDefinition<
  TTrigger = any,
  TSteps extends Record<string, StepConfig<any, any>> = Record<string, StepConfig<any, any>>,
> {
  name: string;
  triggerSchema?: z.ZodType<TTrigger>;
  steps: TSteps;
}

export type WorkflowEvent =
  | { type: 'DEPENDENCIES_MET'; stepId: string }
  | { type: 'DEPENDENCIES_NOT_MET'; stepId: string }
  | { type: 'SUSPENDED'; stepId: string }
  | { type: 'SKIP_STEP'; stepId: string; failedDependencies: string[] }
  | { type: 'STEP_COMPLETED'; stepId: string }
  | { type: `xstate.error.actor.${string}`; error: Error }
  | { type: `xstate.done.actor.${string}`; output: ResolverFunctionOutput };

export type ResolverFunctionInput = {
  stepNode: StepNode;
  context: WorkflowContext;
};

export type ResolverFunctionOutput = {
  stepId: StepId;
  result: unknown;
};

export type DependencyCheckOutput =
  | { type: 'DEPENDENCIES_MET' }
  | { type: 'DEPENDENCIES_NOT_MET' }
  | { type: 'SKIP_STEP'; missingDeps: string[] }
  | { type: 'CONDITION_FAILED'; error: string }
  | { type: 'TIMED_OUT'; error: string }
  | { type: 'SUSPENDED'; missingDeps: string[] };

export type WorkflowActors = {
  resolverFunction: {
    input: ResolverFunctionInput;
    output: ResolverFunctionOutput;
  };
  dependencyCheck: {
    input: { context: WorkflowContext; stepId: string };
    output: DependencyCheckOutput;
  };
};

export type WorkflowActionParams = {
  stepId: string;
};

export type WorkflowActions = {
  type: 'checkDependencies' | 'updateStepResult' | 'setStepError' | 'notifyStepCompletion';
  params: WorkflowActionParams;
};

export type WorkflowState = {
  [key: string]: {
    initial: 'pending';
    states: {
      pending: {
        invoke: {
          src: 'dependencyCheck';
          input: ({ context }: { context: WorkflowContext }) => {
            context: WorkflowContext;
            stepId: string;
          };
          onDone: [
            {
              guard: (_: any, event: { output: DependencyCheckOutput }) => boolean;
              target: 'executing';
            },
            {
              guard: (_: any, event: { output: DependencyCheckOutput }) => boolean;
              target: 'waiting';
            },
            {
              guard: (_: any, event: { output: DependencyCheckOutput }) => boolean;
              target: 'skipped';
              actions: AssignAction<WorkflowContext, any, any, any, any>;
            },
          ];
        };
      };
      waiting: {
        after: {
          CHECK_INTERVAL: {
            target: 'pending';
          };
        };
      };
      executing: {
        invoke: {
          src: 'resolverFunction';
          input: ({ context }: { context: WorkflowContext }) => ResolverFunctionInput;
          onDone: {
            target: 'completed';
            actions: ['updateStepResult'];
          };
          onError: {
            target: 'failed';
            actions: ['setStepError'];
          };
        };
      };
      completed: {
        type: 'final';
        entry: ['notifyStepCompletion'];
      };
      failed: {
        type: 'final';
        entry: ['notifyStepCompletion'];
      };
      skipped: {
        type: 'final';
        entry: ['notifyStepCompletion'];
      };
    };
  };
};

// Type helpers

// Branded type for StepId
declare const StepIdBrand: unique symbol;
export type StepId = string & { readonly [StepIdBrand]: typeof StepIdBrand };

export type ExtractSchemaFromStep<
  TStep extends Step<any, any, any>,
  TKey extends 'inputSchema' | 'outputSchema',
> = TStep[TKey];

// Helper type to extract result type from a step handler
export type ExtractStepResult<T> = T extends (data: any) => Promise<infer R> ? R : never;

export type StepInputType<TStep extends Step<any, any, any>, TKey extends 'inputSchema' | 'outputSchema'> =
  ExtractSchemaFromStep<TStep, TKey> extends infer Schema
    ? Schema extends z.ZodType<any>
      ? z.infer<Schema>
      : never
    : never;

// Get the raw type from Zod schema
export type ExtractSchemaType<T extends z.ZodSchema> = T extends z.ZodSchema<infer V> ? V : never;

// Generate all possible paths through an object type
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
