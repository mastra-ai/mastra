import { RegisteredLogger } from '@mastra/core';
import { BaseLogMessage } from '@mastra/core';
import { z } from 'zod';

declare const StepIdBrand: unique symbol;
export type StepId = string & { readonly [StepIdBrand]: typeof StepIdBrand };

export type DataPath = string;

export interface VariableReference {
  /** ID of the step that produced the data, or 'trigger' for initial data */
  stepId: string | 'trigger';
  /** Path to the specific data using dot notation */
  path: DataPath;
}

export interface StepConfig<TInput = any> {
  /** Unique identifier for the step */
  id: StepId;
  /** Handler function that processes the step's input and returns a result */
  handler: (data: TInput) => Promise<any>;
  /** Zod schema defining the expected input type */
  inputSchema?: z.ZodType<TInput>;
  /** Resolved payload with variables correctly substituted in */
  requiredData: Record<string, VariableReference>;
}

export interface StepDefinition<TSchema extends z.ZodType<any>> {
  /** Handler function that processes the step's input and returns a result */
  handler: (data: z.infer<TSchema>) => Promise<any>;
  /** Zod schema defining the expected input type */
  inputSchema?: TSchema;
  /** Mapping of input fields to variables from other steps */
  variables?: Partial<Record<keyof z.infer<TSchema>, VariableReference>>;
  /** Static values to be merged with variables */
  payload?: Partial<z.infer<TSchema>>;
}

/** Internal state maintained by the workflow engine */
export interface WorkflowContext {
  /** Error object if the workflow fails, otherwise null */
  error: Error | null;
  /** Results from each step */
  stepResults: Record<string, any>;
  /** Initial data passed to the workflow */
  triggerData: any;
}

export interface WorkflowLogMessage extends BaseLogMessage {
  type: typeof RegisteredLogger.WORKFLOW;
  workflowName: string;
  stepId?: StepId;
  data?: any;
}
