import { Query } from 'sift';
import { z } from 'zod';

import { IAction, IExecutionContext } from '../action';
import { BaseLogMessage, RegisteredLogger } from '../logger';

export interface StepExecutionContext<
  TSchemaIn extends z.ZodSchema | undefined = undefined,
  TContext extends WorkflowContext = WorkflowContext,
> extends IExecutionContext<TSchemaIn, TContext> {
  runId: string;
}

export interface StepAction<
  TId extends string,
  TSchemaIn extends z.ZodSchema | undefined,
  TSchemaOut extends z.ZodSchema | undefined,
  TContext extends StepExecutionContext<TSchemaIn>,
> extends IAction<TId, TSchemaIn, TSchemaOut, TContext> {
  retryConfig?: RetryConfig;
}

export type StepNode = { step: IAction<any, any, any, any>; config: StepDef<any, any, any, any>[any] };

export type StepGraph = {
  initial: StepNode[];
  [key: string]: StepNode[];
};

export type RetryConfig = { attempts?: number; delay?: number };

export type VariableReference<TStep extends IAction<any, any, any, any> | 'trigger'> =
  TStep extends IAction<any, any, any, any>
    ? {
        step: TStep;
        path: PathsToStringProps<ExtractSchemaType<ExtractSchemaFromStep<TStep, 'outputSchema'>>> | '' | '.';
      }
    : {
        step: 'trigger';
        path: string; // TODO: Add trigger schema types
      };

export interface BaseCondition<TStep extends IAction<any, any, any, any> | 'trigger'> {
  ref: TStep extends IAction<any, any, any, any>
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

export type ActionContext<TSchemaIn extends z.ZodType<any>> = IExecutionContext<z.infer<TSchemaIn>, WorkflowContext>;

export type StepDef<
  TStepId extends TSteps[number]['id'],
  TSteps extends IAction<any, any, any, any>[],
  TSchemaIn extends z.ZodType<any>,
  TSchemaOut extends z.ZodType<any>,
> = Record<
  TStepId,
  {
    snapshotOnTimeout?: boolean;
    when?: Condition<any> | ((args: { context: WorkflowContext }) => Promise<boolean>);
    data: TSchemaIn;
    handler: (args: ActionContext<TSchemaIn>) => Promise<z.infer<TSchemaOut>>;
  }
>;

export type StepCondition<TStep extends IAction<any, any, any, any> | 'trigger'> =
  | BaseCondition<TStep>
  | { and: StepCondition<TStep>[] }
  | { or: StepCondition<TStep>[] };

type Condition<TStep extends IAction<any, any, any, any> | 'trigger'> =
  | BaseCondition<TStep>
  | { and: Condition<TStep>[] }
  | { or: Condition<TStep>[] };

export interface StepConfig<
  TStep extends IAction<any, any, any, any>,
  CondStep extends IAction<any, any, any, any> | 'trigger',
  VarStep extends IAction<any, any, any, any> | 'trigger',
> {
  snapshotOnTimeout?: boolean;
  when?: Condition<CondStep> | ((args: { context: WorkflowContext }) => Promise<boolean>);
  variables?: StepInputType<TStep, 'inputSchema'> extends never
    ? Record<string, VariableReference<VarStep>>
    : {
        [K in keyof StepInputType<TStep, 'inputSchema'>]?: VariableReference<VarStep>;
      };
}

type StepSuccess<T> = {
  status: 'success';
  payload: T;
};

type StepSuspended = {
  status: 'suspended';
};
type StepWaiting = {
  status: 'waiting';
};

type StepFailure = {
  status: 'failed';
  error: string;
};

export type StepResult<T> = StepSuccess<T> | StepFailure | StepSuspended | StepWaiting;

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

export type WorkflowEvent =
  | { type: 'CONDITIONS_MET'; stepId: string }
  | { type: 'CONDITION_FAILED'; stepId: string; error: string }
  | { type: 'SUSPENDED'; stepId: string }
  | { type: 'WAITING'; stepId: string }
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

export type SubscriberFunctionOutput = {
  stepId: StepId;
  result: unknown;
};

export type DependencyCheckOutput =
  | { type: 'CONDITIONS_MET' }
  | { type: 'CONDITION_FAILED'; error: string }
  | { type: 'SUSPENDED' }
  | { type: 'WAITING' };

export type WorkflowActors = {
  resolverFunction: {
    input: ResolverFunctionInput;
    output: ResolverFunctionOutput;
  };
  conditionCheck: {
    input: { context: WorkflowContext; stepId: string };
    output: DependencyCheckOutput;
  };
  spawnSubscriberFunction: {
    input: { context: WorkflowContext; stepId: string };
    output: SubscriberFunctionOutput;
  };
};

export type WorkflowActionParams = {
  stepId: string;
};

export type WorkflowActions = {
  type: 'updateStepResult' | 'setStepError' | 'notifyStepCompletion' | 'decrementAttemptCount';
  params: WorkflowActionParams;
};

export type WorkflowState = {
  [key: string]: {
    initial: 'pending';
    states: {
      pending: {
        invoke: {
          src: 'conditionCheck';
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
    };
  };
};

// Type helpers

// Branded type for StepId
declare const StepIdBrand: unique symbol;
export type StepId = string & { readonly [StepIdBrand]: typeof StepIdBrand };

export type ExtractSchemaFromStep<
  TStep extends IAction<any, any, any, any>,
  TKey extends 'inputSchema' | 'outputSchema',
> = TStep[TKey];

// Helper type to extract result type from a step handler
export type ExtractStepResult<T> = T extends (data: any) => Promise<infer R> ? R : never;

export type StepInputType<TStep extends IAction<any, any, any, any>, TKey extends 'inputSchema' | 'outputSchema'> =
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
