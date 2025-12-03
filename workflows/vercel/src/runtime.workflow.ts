/**
 * Vercel Workflow Runtime
 *
 * This file contains module-level functions with Vercel's "use workflow" and "use step" directives.
 * These are the ONLY places where these directives should appear.
 *
 * Dynamic imports are used to avoid static analysis detecting Node.js modules.
 */

import type { StepResult, WorkflowResult, TimeTravelExecutionParams } from '@mastra/core/workflows';
import type { VercelWorkflow } from './workflow';
import type { MainWorkflowParams, SerializedStepContext, StepExecutionOutput } from './types';

/**
 * Execute a single step with Vercel durability.
 *
 * This function has the "use step" directive and is statically analyzable.
 * It receives only serializable arguments and looks up the actual step
 * via the registered Mastra singleton.
 *
 * @param workflowId - The workflow ID to look up
 * @param stepId - The step ID within the workflow
 * @param input - The input data for the step (must be serializable)
 * @param serializedContext - Serialized execution context
 * @returns The step execution output including any context mutations
 */
export async function runStep(
  workflowId: string,
  stepId: string,
  input: unknown,
  serializedContext: SerializedStepContext,
): Promise<StepExecutionOutput> {
  'use step';

  const { getMastra } = await import('./singleton');
  const { buildExecutionParams } = await import('./context');

  const mastra = getMastra();
  const workflow = mastra.getWorkflowById(workflowId);
  const step = workflow.steps[stepId];

  if (!step) {
    throw new Error(`Step "${stepId}" not found in workflow "${workflowId}"`);
  }

  // Create a no-op emitter for now (event publishing can be added later)
  const emitter = {
    emit: async (_event: string, _data: any) => {
      // TODO: Implement Vercel event publishing if supported
    },
  };

  const abortController = new AbortController();

  // Build execution params from serialized context
  const { execParams, getContextMutations, getSuspended, getBailed } = buildExecutionParams({
    input,
    serializedContext,
    mastra,
    step,
    emitter,
    abortController,
  });

  // Execute the step
  const output = await step.execute(execParams);

  // Return output along with any context mutations
  return {
    output,
    suspended: getSuspended(),
    bailed: getBailed(),
    contextMutations: getContextMutations(),
  };
}

/**
 * Main workflow entry point with Vercel durability.
 *
 * This function has the "use workflow" directive and orchestrates
 * the entire workflow execution using the VercelExecutionEngine.
 *
 * @param params - Workflow parameters (must be serializable)
 * @returns The workflow result
 */
export async function mainWorkflow(params: MainWorkflowParams): Promise<WorkflowResult<any, any, any, any>> {
  'use workflow';

  const { getMastra } = await import('./singleton');
  const { VercelExecutionEngine } = await import('./execution-engine');
  const { RequestContext } = await import('@mastra/core/di');

  const mastra = getMastra();
  const workflow = mastra.getWorkflowById(params.workflowId) as VercelWorkflow;

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
