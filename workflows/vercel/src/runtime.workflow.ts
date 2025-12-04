/**
 * Vercel Workflow Runtime Implementations
 *
 * This file contains the IMPLEMENTATION of workflow runtime functions WITHOUT directives.
 * Users must create wrapper functions in their project WITH the directives.
 *
 * @example
 * ```typescript
 * // In your project: src/workflow-runtime.ts
 * import { runStepImpl, mainWorkflowImpl } from '@mastra/vercel';
 *
 * export async function runStep(...args: Parameters<typeof runStepImpl>) {
 *   'use step';
 *   return runStepImpl(...args);
 * }
 *
 * export async function mainWorkflow(...args: Parameters<typeof mainWorkflowImpl>) {
 *   'use workflow';
 *   return mainWorkflowImpl(...args);
 * }
 * ```
 */

import type { WorkflowResult, StepResult, TimeTravelExecutionParams } from '@mastra/core/workflows';
import type { MainWorkflowParams } from './types';

// =============================================================================
// Runtime Registration
// =============================================================================

type RuntimeFunctions = {
  runStep: (operationId: string, runId: string, workflowId: string) => Promise<unknown>;
  mainWorkflow: (params: MainWorkflowParams) => Promise<WorkflowResult<any, any, any, any>>;
};

let _runtime: RuntimeFunctions | null = null;

/**
 * Register the workflow runtime functions.
 * These should be the user's wrapped versions WITH the Vercel directives.
 *
 * @example
 * ```typescript
 * import { registerRuntime } from '@mastra/vercel';
 * import { runStep, mainWorkflow } from './workflow-runtime';
 *
 * registerRuntime({ runStep, mainWorkflow });
 * ```
 */
export function registerRuntime(runtime: RuntimeFunctions): void {
  _runtime = runtime;
}

/**
 * Get the registered runtime functions.
 * @internal
 */
export function getRuntime(): RuntimeFunctions {
  if (!_runtime) {
    throw new Error(
      'Vercel workflow runtime not registered. ' +
        'You must create wrapper functions with "use step" and "use workflow" directives ' +
        'in your project and register them with registerRuntime(). ' +
        'See: https://mastra.ai/docs/vercel-workflows',
    );
  }
  return _runtime;
}

// =============================================================================
// Implementation Functions (NO directives - users wrap these)
// =============================================================================

/**
 * Implementation of the step execution logic.
 * Users must wrap this in a function with 'use step' directive.
 *
 * @param operationId - The unique operation identifier
 * @param runId - The workflow run ID
 * @param workflowId - The workflow ID
 * @returns The operation result
 */
export async function runStepImpl(operationId: string, runId: string, workflowId: string): Promise<unknown> {
  // Dynamic imports to keep this file clean of Node.js module imports
  const { getMastra } = await import('./singleton');

  const mastra = getMastra();
  const workflow = mastra.getWorkflowById(workflowId) as import('./workflow').VercelWorkflow;
  const run = workflow.runs.get(runId) as import('./run').VercelRun | undefined;

  if (!run) {
    throw new Error(`No run found for runId ${runId} in workflow ${workflowId}`);
  }

  const operationFn = run.pendingOperations.get(operationId);

  if (!operationFn) {
    throw new Error(`No pending operation for ${operationId} in run ${runId}`);
  }

  return await operationFn();
}

/**
 * Implementation of the main workflow execution logic.
 * Users must wrap this in a function with 'use workflow' directive.
 *
 * @param params - Workflow parameters (must be serializable)
 * @returns The workflow result
 */
export async function mainWorkflowImpl(params: MainWorkflowParams): Promise<WorkflowResult<any, any, any, any>> {
  // Dynamic imports to keep this file clean of Node.js module imports
  const { getMastra } = await import('./singleton');
  const { VercelExecutionEngine } = await import('./execution-engine');
  const { RequestContext } = await import('@mastra/core/di');

  const mastra = getMastra();
  const workflow = mastra.getWorkflowById(params.workflowId) as import('./workflow').VercelWorkflow;

  // Create emitter for workflow events
  const emitter = {
    emit: async (_event: string, _data: any) => {
      // TODO: Implement Vercel event publishing if supported
    },
    on: () => {},
    off: () => {},
    once: () => {},
  };

  // Create the execution engine
  const engine = new VercelExecutionEngine(mastra, {
    validateInputs: params.validateInputs ?? true,
    shouldPersistSnapshot: () => true,
  });

  // Set the run context so wrapDurableOperation can access it
  engine.setRunContext(params.runId, params.workflowId);

  // Reconstruct RequestContext from serialized form
  const requestContext = new RequestContext(Object.entries(params.requestContext ?? {}));

  // Build resume params if resuming
  let resume:
    | {
        steps: string[];
        stepResults: Record<string, StepResult<any, any, any, any>>;
        resumePayload: unknown;
        resumePath: number[];
        forEachIndex?: number;
        label?: string;
      }
    | undefined;

  if (params.resume) {
    resume = {
      steps: params.resume.steps,
      stepResults: params.resume.stepResults,
      resumePayload: params.resume.resumePayload,
      resumePath: params.resume.resumePath,
      forEachIndex: params.resume.forEachIndex,
      label: params.resume.label,
    };
  }

  // Build time travel params if provided
  let timeTravel: TimeTravelExecutionParams | undefined;
  if (params.timeTravel) {
    timeTravel = {
      steps: params.timeTravel.steps,
      inputData: params.timeTravel.inputData,
      resumeData: params.timeTravel.resumeData,
      stepResults: params.timeTravel.stepResults ?? {},
      nestedStepResults: params.timeTravel.nestedStepResults,
      executionPath: params.timeTravel.executionPath,
      state: params.timeTravel.state,
    };
  }

  // Execute the workflow
  const result = await engine.execute<Record<string, any>, unknown, WorkflowResult<any, any, any, any>>({
    workflowId: params.workflowId,
    runId: params.runId,
    resourceId: params.resourceId,
    graph: workflow.getExecutionGraph(),
    serializedStepGraph: workflow.getSerializedStepGraph(),
    input: params.input,
    initialState: params.initialState,
    resume,
    timeTravel,
    requestContext,
    emitter,
    retryConfig: params.retryConfig,
    abortController: new AbortController(),
    format: params.format,
    outputOptions: params.outputOptions,
  });

  return result;
}
