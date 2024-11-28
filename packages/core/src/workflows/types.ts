import { z } from 'zod';
import { Query } from 'sift';
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
        path: HasOutputSchema<TSteps, TStepId> extends true
          ?
              | PathsToStringProps<
                  ExtractSchemaType<
                    ExtractSchemaFromStep<TSteps, TStepId, 'outputSchema'>
                  >
                >
              | ''
              | '.'
          : string;
      }
  : never;

export interface BaseCondition<
  TStepId extends TSteps[number]['id'] | 'trigger',
  TSteps extends Step<any, any, any>[],
> {
  ref: TStepId extends 'trigger'
    ? {
        stepId: 'trigger';
        path: string;
      }
    : {
        stepId: TStepId;
        path: HasOutputSchema<TSteps, TStepId> extends true
          ?
              | PathsToStringProps<
                  ExtractSchemaType<
                    ExtractSchemaFromStep<TSteps, TStepId, 'outputSchema'>
                  >
                >
              | ''
              | '.'
          : string;
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
    transitions?: Partial<Record<TStepId, StepTransition<TStepId, TSteps>>>;
    handler: (data: z.infer<TSchemaIn>) => Promise<z.infer<TSchemaOut>>;
  }
>;

export type StepCondition<
  TStepId extends TSteps[number]['id'] | 'trigger',
  TSteps extends Step<any, any, any>[],
> =
  | BaseCondition<TStepId, TSteps>
  | { and: StepCondition<TStepId | 'trigger', TSteps>[] }
  | { or: StepCondition<TStepId | 'trigger', TSteps>[] };

export interface StepTransition<
  TStepId extends TSteps[number]['id'] | 'trigger',
  TSteps extends Step<any, any, any>[],
> {
  condition?: StepCondition<TStepId | 'trigger', TSteps>;
}

export interface StepDefinition<
  TStepId extends TSteps[number]['id'],
  TSteps extends Step<any, any, any>[],
> {
  variables?: StepInputType<TSteps, TStepId, 'inputSchema'> extends never
    ? Record<
        string,
        VariableReference<TSteps[number]['id'] | 'trigger', TSteps>
      >
    : {
        [K in keyof StepInputType<
          TSteps,
          TStepId,
          'inputSchema'
        > as K]?: VariableReference<TSteps[number]['id'] | 'trigger', TSteps>;
      };
  transitions?: Partial<
    Record<
      TSteps[number]['id'],
      StepTransition<TSteps[number]['id'] | 'trigger', TSteps>
    >
  >;
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
  step: StepConfig<any, any, any, any>[any];
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

// Type helpers

// Branded type for StepId
declare const StepIdBrand: unique symbol;
export type StepId = string & { readonly [StepIdBrand]: typeof StepIdBrand };

// Helper type to check if a step has an output schema
type HasOutputSchema<
  TSteps extends Step<any, any, any>[],
  TStepId extends TSteps[number]['id'],
> =
  ExtractSchemaFromStep<TSteps, TStepId, 'outputSchema'> extends z.ZodType<any>
    ? true
    : false;

export type ExtractSchemaFromStep<
  TSteps extends Step<any, any, any>[],
  Id extends TSteps[number]['id'],
  TKey extends 'inputSchema' | 'outputSchema',
> = Extract<TSteps[number], { id: Id }>[TKey];

// Helper type to extract result type from a step handler
export type StepResult<T> = T extends (data: any) => Promise<infer R>
  ? R
  : never;

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
export type ExtractSchemaType<T extends z.ZodSchema> =
  T extends z.ZodSchema<infer V> ? V : never;

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
  ? PathsToStringProps<
      ExtractSchemaType<ExtractSchemaFromStep<TSteps, TStepId, 'outputSchema'>>
    >
  : never;
