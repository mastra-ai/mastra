import type { Query } from 'sift';
import type { z } from 'zod';

import type { IAction, IExecutionContext, MastraUnion } from '../action';
import type { BaseLogMessage, RegisteredLogger } from '../logger';
import type { Mastra } from '../mastra';
import type { Step } from './step';

export interface WorkflowOptions<TTriggerSchema extends z.ZodObject<any> = any> {
  name: string;
  triggerSchema?: TTriggerSchema;
  events?: Record<string, { schema: z.ZodObject<any> }>;
  retryConfig?: RetryConfig;
  mastra?: Mastra;
}

export interface StepExecutionContext<
  TSchemaIn extends z.ZodSchema | undefined = undefined,
  TContext extends WorkflowContext = WorkflowContext,
> extends IExecutionContext<TSchemaIn> {
  context: TSchemaIn extends z.ZodSchema ? z.infer<TSchemaIn> & TContext : TContext;
  suspend: (payload?: unknown) => Promise<void>;
  runId: string;
  mastra?: MastraUnion;
}

export interface StepAction<
  TId extends string,
  TSchemaIn extends z.ZodSchema | undefined,
  TSchemaOut extends z.ZodSchema | undefined,
  TContext extends StepExecutionContext<TSchemaIn>,
> extends IAction<TId, TSchemaIn, TSchemaOut, TContext> {
  mastra?: Mastra;
  payload?: TSchemaIn extends z.ZodSchema ? Partial<z.infer<TSchemaIn>> : unknown;
  retryConfig?: RetryConfig;
}

// For the simple key-value condition
interface SimpleConditionalType {
  [key: `${string}.${string}`]: string | Query<any>;
}

export type StepVariableType<
  TId extends string,
  TSchemaIn extends z.ZodSchema | undefined,
  TSchemaOut extends z.ZodSchema | undefined,
  TContext extends StepExecutionContext<TSchemaIn>,
> = StepAction<TId, TSchemaIn, TSchemaOut, TContext> | 'trigger' | { id: string };

export type StepNode = { step: StepAction<any, any, any, any>; config: StepDef<any, any, any, any>[any] };

export type StepGraph = {
  initial: StepNode[];
  [key: string]: StepNode[];
};

export type RetryConfig = { attempts?: number; delay?: number };

export type VariableReference<
  TStep extends StepVariableType<any, any, any, any>,
  TTriggerSchema extends z.ZodObject<any>,
> =
  TStep extends StepAction<any, any, any, any>
    ? {
        step: TStep;
        path: PathsToStringProps<ExtractSchemaType<ExtractSchemaFromStep<TStep, 'outputSchema'>>> | '' | '.';
      }
    : TStep extends 'trigger'
      ? {
          step: 'trigger';
          path: PathsToStringProps<ExtractSchemaType<TTriggerSchema>> | '.' | '';
        }
      : {
          step: { id: string };
          path: string;
        };

export interface BaseCondition<
  TStep extends StepVariableType<any, any, any, any>,
  TTriggerSchema extends z.ZodObject<any>,
> {
  ref: TStep extends StepAction<any, any, any, any>
    ? {
        step: TStep;
        path: PathsToStringProps<ExtractSchemaType<ExtractSchemaFromStep<TStep, 'outputSchema'>>> | '' | '.' | 'status';
      }
    : TStep extends 'trigger'
      ? {
          step: 'trigger';
          path: PathsToStringProps<ExtractSchemaType<TTriggerSchema>> | '.' | '';
        }
      : {
          step: { id: string };
          path: string;
        };
  query: Query<any>;
}

export type ActionContext<TSchemaIn extends z.ZodType<any>> = StepExecutionContext<z.infer<TSchemaIn>, WorkflowContext>;
export enum WhenConditionReturnValue {
  CONTINUE = 'continue',
  CONTINUE_FAILED = 'continue_failed',
  ABORT = 'abort',
}

export type StepDef<
  TStepId extends TSteps[number]['id'],
  TSteps extends StepAction<any, any, any, any>[],
  TSchemaIn extends z.ZodType<any>,
  TSchemaOut extends z.ZodType<any>,
> = Record<
  TStepId,
  {
    snapshotOnTimeout?: boolean;
    when?:
      | Condition<any, any>
      | ((args: { context: WorkflowContext; mastra?: Mastra }) => Promise<boolean | WhenConditionReturnValue>);
    data: TSchemaIn;
    handler: (args: ActionContext<TSchemaIn>) => Promise<z.infer<TSchemaOut>>;
  }
>;

export type StepCondition<
  TStep extends StepVariableType<any, any, any, any>,
  TTriggerSchema extends z.ZodObject<any>,
> =
  | BaseCondition<TStep, TTriggerSchema>
  | SimpleConditionalType
  | { and: StepCondition<TStep, TTriggerSchema>[] }
  | { or: StepCondition<TStep, TTriggerSchema>[] }
  | { not: StepCondition<TStep, TTriggerSchema> };

type Condition<TStep extends StepVariableType<any, any, any, any>, TTriggerSchema extends z.ZodObject<any>> =
  | BaseCondition<TStep, TTriggerSchema>
  | SimpleConditionalType
  | { and: Condition<TStep, TTriggerSchema>[] }
  | { or: Condition<TStep, TTriggerSchema>[] }
  | { not: Condition<TStep, TTriggerSchema> };

export interface StepConfig<
  TStep extends StepAction<any, any, any, any>,
  CondStep extends StepVariableType<any, any, any, any>,
  VarStep extends StepVariableType<any, any, any, any>,
  TTriggerSchema extends z.ZodObject<any>,
  TSteps extends Step<string, any, any, any>[] = Step<string, any, any, any>[],
> {
  snapshotOnTimeout?: boolean;
  when?:
    | Condition<CondStep, TTriggerSchema>
    | ((args: {
        context: WorkflowContext<TTriggerSchema, TSteps>;
        mastra?: Mastra;
      }) => Promise<boolean | WhenConditionReturnValue>);
  variables?: StepInputType<TStep, 'inputSchema'> extends never
    ? Record<string, VariableReference<VarStep, TTriggerSchema>>
    : {
        [K in keyof StepInputType<TStep, 'inputSchema'>]?: VariableReference<VarStep, TTriggerSchema>;
      };
}

type StepSuccess<T> = {
  status: 'success';
  output: T;
};

type StepSuspended = {
  status: 'suspended';
  suspendPayload?: any;
};
type StepWaiting = {
  status: 'waiting';
};

type StepFailure = {
  status: 'failed';
  error: string;
};

export type StepResult<T> = StepSuccess<T> | StepFailure | StepSuspended | StepWaiting;

// Define a type for mapping step IDs to their respective steps[]
export type StepsRecord<T extends readonly Step<any, any, z.ZodType<any> | undefined>[]> = {
  [K in T[number]['id']]: Extract<T[number], { id: K }>;
};

export interface WorkflowRunResult<
  T extends z.ZodType<any>,
  TSteps extends Step<string, any, z.ZodType<any> | undefined>[],
> {
  triggerData?: z.infer<T>;
  results: {
    [K in keyof StepsRecord<TSteps>]: StepsRecord<TSteps>[K]['outputSchema'] extends undefined
      ? StepResult<unknown>
      : StepResult<z.infer<NonNullable<StepsRecord<TSteps>[K]['outputSchema']>>>;
  };
  runId: string;
  activePaths: Map<string, { status: string; suspendPayload?: any }>;
}

// Update WorkflowContext
export interface WorkflowContext<
  TTrigger extends z.ZodObject<any> = any,
  TSteps extends Step<string, any, any, any>[] = Step<string, any, any, any>[],
> {
  mastra?: MastraUnion;
  steps: {
    [K in keyof StepsRecord<TSteps>]: StepsRecord<TSteps>[K]['outputSchema'] extends undefined
      ? StepResult<unknown>
      : StepResult<z.infer<NonNullable<StepsRecord<TSteps>[K]['outputSchema']>>>;
  };
  triggerData: z.infer<TTrigger>;
  attempts: Record<string, number>;
  getStepResult<T extends keyof StepsRecord<TSteps> | unknown>(
    stepId: T extends keyof StepsRecord<TSteps> ? T : string,
  ): T extends keyof StepsRecord<TSteps>
    ? StepsRecord<TSteps>[T]['outputSchema'] extends undefined
      ? unknown
      : z.infer<NonNullable<StepsRecord<TSteps>[T]['outputSchema']>>
    : T;
  getStepResult<T extends Step<any, any, any, any>>(
    stepId: T,
  ): T['outputSchema'] extends undefined ? unknown : z.infer<NonNullable<T['outputSchema']>>;
}

export interface WorkflowLogMessage extends BaseLogMessage {
  type: typeof RegisteredLogger.WORKFLOW;
  workflowName: string;
  stepId?: StepId;
  data?: unknown;
  runId?: string;
}

export type WorkflowEvent =
  | { type: 'RESET_TO_PENDING'; stepId: string }
  | { type: 'CONDITIONS_MET'; stepId: string }
  | { type: 'CONDITION_FAILED'; stepId: string; error: string }
  | { type: 'SUSPENDED'; stepId: string; suspendPayload?: any }
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
  | { type: 'CONDITIONS_SKIPPED' }
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
  TStep extends StepAction<any, any, any, any>,
  TKey extends 'inputSchema' | 'outputSchema',
> = TStep[TKey];

// Helper type to extract result type from a step handler
export type ExtractStepResult<T> = T extends (data: any) => Promise<infer R> ? R : never;

export type StepInputType<TStep extends StepAction<any, any, any, any>, TKey extends 'inputSchema' | 'outputSchema'> =
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

export interface WorkflowRunState {
  // Core state info
  value: Record<string, string>;
  context: {
    steps: Record<
      string,
      {
        status: 'success' | 'failed' | 'suspended' | 'waiting';
        payload?: any;
        error?: string;
      }
    >;
    triggerData: Record<string, any>;
    attempts: Record<string, number>;
  };

  activePaths: Array<{
    stepPath: string[];
    stepId: string;
    status: string;
  }>;

  // Metadata
  runId: string;
  timestamp: number;

  childStates?: Record<string, WorkflowRunState>;
  suspendedSteps?: Record<string, string>;
}

export type WorkflowResumeResult<TTriggerSchema extends z.ZodObject<any>> = {
  triggerData?: z.infer<TTriggerSchema>;
  results: Record<string, StepResult<any>>;
};
