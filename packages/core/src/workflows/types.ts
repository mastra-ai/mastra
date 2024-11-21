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

// Improved variable reference with better typing
export interface VariableReference<
  TStepId extends string = string,
  TPath extends string = string
> {
  stepId: TStepId | 'trigger';
  path: TPath;
}

// Base condition with generic type parameter
export interface BaseCondition<T = any> {
  ref: {
    stepId: string | 'trigger';
    path: string;
  };
  query: Query<T>;
}

// Recursive type for conditions with better typing
export type StepCondition<T = any> =
  | BaseCondition<T>
  | { and: StepCondition<T>[] }
  | { or: StepCondition<T>[] };

// Improved step transition with optional condition
export interface StepTransition<T = any> {
  condition?: StepCondition<T>;
}

// Step configuration with better generic typing
export interface StepConfig<
  TInput = any,
  TOutput = any,
  TTransitions extends string = string
> {
  id: StepId;
  handler: (data: TInput) => Promise<TOutput>;
  inputSchema?: z.ZodType<TInput>;
  requiredData: Record<string, VariableReference>;
  transitions?: Record<TTransitions, StepTransition> | null;
}

// Step definition with improved typing for schema inference
export interface StepDefinition<
  TSchema extends z.ZodType<any>,
  TOutput = any,
  TTransitions extends string = string
> {
  action: (data: z.infer<TSchema>) => Promise<TOutput>;
  inputSchema?: TSchema;
  variables?: Partial<Record<keyof z.infer<TSchema>, VariableReference>>;
  payload?: Partial<z.infer<TSchema>>;
  transitions?: Record<TTransitions, StepTransition> | null;
}

// Workflow context with generic type parameters
export interface WorkflowContext<TTrigger = any, TStepResults = any> {
  error: Error | null;
  stepResults: Record<string, TStepResults>;
  triggerData: TTrigger;
}

// Workflow log message with improved typing
export interface WorkflowLogMessage extends BaseLogMessage {
  type: typeof RegisteredLogger.WORKFLOW;
  workflowName: string;
  stepId?: StepId;
  data?: unknown;
}

// Validation error with literal types
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

// Define actor types for the state machine
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

// Define action types
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
