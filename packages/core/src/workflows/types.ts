import { z } from 'zod';
import { Query } from 'sift';
import { RegisteredLogger, BaseLogMessage } from '../logger';
import { Step } from './step';

// Branded type for StepId
declare const StepIdBrand: unique symbol;
export type StepId = string & { readonly [StepIdBrand]: typeof StepIdBrand };

// Helper type to extract result type from a step handler
export type StepResult<T> = T extends (data: any) => Promise<infer R>
  ? R
  : never;

export interface VariableReference<
  TStepId extends string,
  TPath extends string
> {
  stepId: TStepId | 'trigger';
  path: TPath;
}

export interface BaseCondition<TStepId extends string> {
  ref: {
    stepId: TStepId | 'trigger';
    path: string;
  };
  query: Query<any>;
}

export type StepConfig<
  TStepId extends string,
  TSchemaIn extends z.ZodType<any>,
  TSchemaOut extends z.ZodType<any>
> = Record<
  TStepId,
  {
    data: TSchemaIn;
    transitions?: Partial<Record<TStepId, StepTransition<TStepId>>>;
    handler: (data: z.infer<TSchemaIn>) => Promise<z.infer<TSchemaOut>>;
  }
>;

export type StepCondition<TStepId extends string> =
  | BaseCondition<TStepId>
  | { and: StepCondition<TStepId>[] }
  | { or: StepCondition<TStepId>[] };

export interface StepTransition<TStepId extends string> {
  condition?: StepCondition<TStepId>;
}

export type StepInputType<
  Steps extends Step<any, any, any>[],
  Id extends Steps[number]['id']
> = Extract<Steps[number], { id: Id }>['inputSchema'] extends infer Schema
  ? Schema extends z.ZodType<any>
    ? z.infer<Schema>
    : never
  : never;

export interface StepDefinition<
  TStepId extends string,
  TSteps extends Step<any, any, any>[]
> {
  variables?: StepInputType<TSteps, TStepId> extends never
    ? Record<string, VariableReference<TSteps[number]['id'], string>>
    : {
        [K in keyof StepInputType<TSteps, TStepId> as K]?: VariableReference<
          TSteps[number]['id'],
          string
        >;
      };
  transitions?: Partial<Record<TSteps[number]['id'], StepTransition<TStepId>>>;
}

export interface WorkflowContext<TTrigger = any, TStepResults = any> {
  error: Error | null;
  stepResults: Record<string, TStepResults>;
  triggerData: TTrigger;
}

export interface WorkflowLogMessage extends BaseLogMessage {
  type: typeof RegisteredLogger.WORKFLOW;
  workflowName: string;
  stepId?: StepId;
  data?: unknown;
}

export type ValidationErrorType =
  | 'circular_dependency'
  | 'no_terminal_path'
  | 'unreachable_step';

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
  TSteps extends Record<string, StepDefinition<any, any>> = Record<
    string,
    StepDefinition<any, any>
  >
> {
  name: string;
  triggerSchema?: z.ZodType<TTrigger>;
  steps: TSteps;
}

export type WorkflowEvent =
  | { type: `TRANSITION_${string}`; output?: unknown }
  | { type: 'NO_MATCHING_CONDITIONS' }
  | { type: `xstate.error.actor.${string}`; error: Error }
  | { type: `xstate.done.actor.${string}`; output: ResolverFunctionOutput };

export type ResolverFunctionInput = {
  step: StepConfig<any, any, any>[any];
  context: WorkflowContext;
  stepId: StepId;
};

export type ResolverFunctionOutput = {
  stepId: StepId;
  result: unknown;
};

export type WorkflowActors = {
  resolverFunction: {
    input: ResolverFunctionInput;
    output: ResolverFunctionOutput;
  };
};

export type WorkflowActions = {
  type: 'updateStepResult' | 'setError' | 'initializeTriggerData';
  params?: unknown;
};

export type WorkflowState = {
  [key: string]: {
    invoke?: {
      src: 'resolverFunction';
      input: ({
        context,
      }: {
        context: WorkflowContext;
      }) => ResolverFunctionInput;
      onDone: {
        actions: ['updateStepResult'];
        target?: string;
      };
      onError: {
        target: 'failure';
        actions: ['setError'];
      };
    };
    on: {
      NO_MATCHING_CONDITIONS: {
        target: 'failure';
        actions: any;
      };
      [key: `TRANSITION_${string}`]: {
        target: string;
        guard: ({ context }: { context: WorkflowContext }) => boolean;
      };
    };
  };
};
