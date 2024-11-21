import { z } from 'zod';
import { Query } from 'sift';
import { RegisteredLogger, BaseLogMessage } from '../logger';

// Branded type for StepId
declare const StepIdBrand: unique symbol;
export type StepId = string & { readonly [StepIdBrand]: typeof StepIdBrand };

// Helper type to extract result type from a step handler
export type StepResult<T> = T extends (data: any) => Promise<infer R>
  ? R
  : never;

export interface VariableReference<
  TStepId extends string = string,
  TPath extends string = string,
> {
  stepId: TStepId | 'trigger';
  path: TPath;
}

export interface BaseCondition<T = any> {
  ref: {
    stepId: string | 'trigger';
    path: string;
  };
  query: Query<T>;
}

export type StepCondition<T = any> =
  | BaseCondition<T>
  | { and: StepCondition<T>[] }
  | { or: StepCondition<T>[] };

export interface StepTransition<T = any> {
  condition?: StepCondition<T>;
}

export interface StepConfig<
  TInput = any,
  TOutput = any,
  TTransitions extends string = string,
> {
  id: StepId;
  handler: (data: TInput) => Promise<TOutput>;
  inputSchema?: z.ZodType<TInput>;
  requiredData: Record<string, VariableReference>;
  transitions?: Record<TTransitions, StepTransition> | null;
}

export interface StepDefinition<
  TSchema extends z.ZodType<any>,
  TOutput = any,
  TTransitions extends string = string,
> {
  action: (data: z.infer<TSchema>) => Promise<TOutput>;
  inputSchema?: TSchema;
  variables?: Partial<Record<keyof z.infer<TSchema>, VariableReference>>;
  payload?: Partial<z.infer<TSchema>>;
  transitions?: Record<TTransitions, StepTransition> | null;
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
  >,
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
  step: StepConfig;
  context: WorkflowContext;
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
