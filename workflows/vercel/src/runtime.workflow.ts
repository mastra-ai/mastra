/**
 * Vercel Workflow Runtime
 *
 * This file contains module-level functions with Vercel's "use workflow" and "use step" directives.
 * These are the ONLY places where these directives should appear.
 *
 * The functions are statically analyzable by Vercel's compiler at build time.
 */

import type { WorkflowResult, StepResult, TimeTravelExecutionParams } from '@mastra/core/workflows';
import { RequestContext } from '@mastra/core/di';
import { getMastra } from './singleton';
import { VercelExecutionEngine } from './execution-engine';
import type { VercelWorkflow } from './workflow';
import type { VercelRun } from './run';
import type { MainWorkflowParams } from './types';

/**
 * Execute a durable operation with Vercel's "use step" directive.
 *
 * This function retrieves the pending operation from the VercelRun instance
 * and executes it. The closure already has all the context it needs.
 *
 * @param operationId - The unique operation identifier
 * @param runId - The workflow run ID
 * @param workflowId - The workflow ID
 * @returns The operation result
 */
export async function runStep(operationId: string, runId: string, workflowId: string): Promise<unknown> {
  'use step';

  const mastra = getMastra();
  const workflow = mastra.getWorkflowById(workflowId) as VercelWorkflow;
  const run = workflow.runs.get(runId) as VercelRun | undefined;

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
