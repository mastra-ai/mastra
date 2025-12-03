import type { Step, StepResult, WorkflowConfig } from '@mastra/core/workflows';
import type { z } from 'zod';

/**
 * Engine type identifier for Vercel workflows.
 */
export type VercelEngineType = {
  engineType: 'vercel';
};

/**
 * Configuration for VercelWorkflow.
 * Extends the base WorkflowConfig without executionEngine (we provide our own).
 */
export interface VercelWorkflowConfig<
  TWorkflowId extends string = string,
  TState extends z.ZodObject<any> = z.ZodObject<any>,
  TInput extends z.ZodType<any> = z.ZodType<any>,
  TOutput extends z.ZodType<any> = z.ZodType<any>,
  TSteps extends Step<string, any, any>[] = Step<string, any, any>[],
> extends Omit<WorkflowConfig<TWorkflowId, TState, TInput, TOutput, TSteps>, 'executionEngine'> {
  // Vercel-specific config options can be added here in the future
}

/**
 * Parameters for the mainWorkflow function.
 * All fields must be JSON-serializable for Vercel's durable execution.
 */
export interface MainWorkflowParams {
  workflowId: string;
  runId: string;
  resourceId?: string;
  input: unknown;
  initialState?: Record<string, any>;
  resume?: {
    steps: string[];
    stepResults: Record<string, StepResult<any, any, any, any>>;
    resumePayload: unknown;
    resumePath: number[];
    forEachIndex?: number;
    label?: string;
  };
  timeTravel?: {
    steps: string[];
    inputData?: unknown;
    resumeData?: unknown;
    stepResults?: Record<string, StepResult<any, any, any, any>>;
    nestedStepResults?: Record<string, Record<string, StepResult<any, any, any, any>>>;
    executionPath: number[];
    state?: Record<string, any>;
  };
  requestContext?: Record<string, any>;
  retryConfig?: { attempts?: number; delay?: number };
  validateInputs?: boolean;
  format?: 'legacy' | 'vnext';
  outputOptions?: { includeState?: boolean; includeResumeLabels?: boolean };
}
