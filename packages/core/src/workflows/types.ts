import { Query } from 'sift';
import { z } from 'zod';

import { AssignAction } from 'xstate/actions';

import { RegisteredLogger, BaseLogMessage } from '../logger';

import { Step } from './step';

export type VariableReference<
  TStepId extends TSteps[number]['id'] | 'trigger',
  TSteps extends Step<any, any, any>[],
> = TStepId extends TSteps[number]['id'] | 'trigger'
  ? TStepId extends 'trigger'
    ? {
        stepId: 'trigger';
        path: string; // TODO: Add trigger schema types
      }
    : {
        stepId: TStepId;
        path: PathsToStringProps<ExtractSchemaType<ExtractSchemaFromStep<TSteps, TStepId, 'outputSchema'>>> | '' | '.';
      }
  : never;

export interface BaseCondition<TStepId extends TSteps[number]['id'] | 'trigger', TSteps extends Step<any, any, any>[]> {
  ref: TStepId extends 'trigger'
    ? {
        stepId: 'trigger';
        path: string;
      }
    : {
        stepId: TStepId;
        path: PathsToStringProps<ExtractSchemaType<ExtractSchemaFromStep<TSteps, TStepId, 'outputSchema'>>> | '' | '.';
      };
  query: Query<any>;
}

export type StepConfig<
  TStepId extends TSteps[number]['id'] | 'trigger',
  TSteps extends Step<any, any, any>[],
  TSchemaIn extends z.ZodType<any>,
  TSchemaOut extends z.ZodType<any>,
> = Record<
  TStepId,
  {
    data: TSchemaIn;
    dependsOn?: DependencyConfig<Extract<TStepId, TSteps[number]['id']>, TSteps>;
    handler: (args: { data: z.infer<TSchemaIn>; runId: string }) => Promise<z.infer<TSchemaOut>>;
  }
>;

export type StepCondition<TStepId extends TSteps[number]['id'] | 'trigger', TSteps extends Step<any, any, any>[]> =
  | BaseCondition<TStepId, TSteps>
  | { and: StepCondition<TStepId | 'trigger', TSteps>[] }
  | { or: StepCondition<TStepId | 'trigger', TSteps>[] };

export interface StepTransitionCondition<
  TStepId extends TSteps[number]['id'] | 'trigger',
  TSteps extends Step<any, any, any>[],
> {
  condition: BaseCondition<TStepId, TSteps>;
}

export type DependencyConfig<TStepId extends TSteps[number]['id'], TSteps extends Step<any, any, any>[]> = {
  steps:
    | Exclude<TSteps[number]['id'], TStepId>[]
    | {
        [K in Exclude<TSteps[number]['id'], TStepId>]?: StepTransitionCondition<K, TSteps>;
      };
  conditionFn?: (context: WorkflowContext) => Promise<boolean>;
};

export interface StepDefinition<TStepId extends TSteps[number]['id'], TSteps extends Step<any, any, any>[]> {
  dependsOn?: DependencyConfig<TStepId, TSteps>;
  variables?: StepInputType<TSteps, TStepId, 'inputSchema'> extends never
    ? Record<string, VariableReference<TSteps[number]['id'] | 'trigger', TSteps>>
    : {
        [K in keyof StepInputType<TSteps, TStepId, 'inputSchema'>]?: VariableReference<
          TSteps[number]['id'] | 'trigger',
          TSteps
        >;
      };
}

type StepSuccess<T> = {
  status: 'success';
  payload: T;
};

type StepFailure = {
  status: 'failed';
  error: string;
};

type StepSkipped = {
  status: 'skipped';
  failedDependencyIds: string[];
};

export type StepResult<T> = StepSuccess<T> | StepFailure | StepSkipped;

// Update WorkflowContext
export interface WorkflowContext<TTrigger = any> {
  stepResults: Record<string, StepResult<any>>;
  triggerData: TTrigger;
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
  TSteps extends Record<string, StepDefinition<any, any>> = Record<string, StepDefinition<any, any>>,
> {
  name: string;
  triggerSchema?: z.ZodType<TTrigger>;
  steps: TSteps;
}

export type WorkflowEvent =
  | { type: 'DEPENDENCIES_MET'; stepId: string }
  | { type: 'DEPENDENCIES_NOT_MET'; stepId: string }
  | { type: 'SKIP_STEP'; stepId: string; failedDependencies: string[] }
  | { type: 'STEP_COMPLETED'; stepId: string }
  | { type: `xstate.error.actor.${string}`; error: Error }
  | { type: `xstate.done.actor.${string}`; output: ResolverFunctionOutput };

export type ResolverFunctionInput = {
  step: StepConfig<any, any, any, any>[any];
  context: WorkflowContext;
  stepId: StepId;
};

export type ResolverFunctionOutput = {
  stepId: StepId;
  result: unknown;
};

export type DependencyCheckOutput =
  | { type: 'DEPENDENCIES_MET' }
  | { type: 'DEPENDENCIES_NOT_MET' }
  | { type: 'SKIP_STEP'; missingDeps: string[] }
  | { type: 'CONDITION_FAILED'; error: string };

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
  TSteps extends Step<any, any, any>[],
  Id extends TSteps[number]['id'],
  TKey extends 'inputSchema' | 'outputSchema',
> = Extract<TSteps[number], { id: Id }>[TKey];

// Helper type to extract result type from a step handler
export type ExtractStepResult<T> = T extends (data: any) => Promise<infer R> ? R : never;

export type StepInputType<
  TSteps extends Step<any, any, any>[],
  Id extends TSteps[number]['id'],
  TKey extends 'inputSchema' | 'outputSchema',
> =
  ExtractSchemaFromStep<TSteps, Id, TKey> extends infer Schema
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

export type ExtractSchemaPaths<
  TStepId extends TSteps[number]['id'],
  TSteps extends Step<any, any, any>[],
> = TStepId extends TSteps[number]['id']
  ? PathsToStringProps<ExtractSchemaType<ExtractSchemaFromStep<TSteps, TStepId, 'outputSchema'>>>
  : never;
