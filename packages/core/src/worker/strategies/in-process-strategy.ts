import { RequestContext } from '../../di';
import type { Mastra } from '../../mastra';
import { StepExecutor } from '../../workflows/evented/step-executor';
import { getNestedWorkflow, getStepEntry } from '../../workflows/evented/workflow-event-processor/utils';
import type { StepResult } from '../../workflows/types';
import type { Workflow } from '../../workflows/workflow';
import type { StepExecutionParams, StepExecutionParentWorkflow, StepExecutionStrategy } from '../types';

/**
 * Executes workflow steps in the same process by delegating to StepExecutor.
 * This is the default strategy used when the worker runs co-located with the server.
 */
export class InProcessStrategy implements StepExecutionStrategy {
  #mastra?: Mastra;

  constructor({ mastra }: { mastra?: Mastra } = {}) {
    this.#mastra = mastra;
  }

  __registerMastra(mastra: Mastra): void {
    this.#mastra = mastra;
  }

  async executeStep(params: StepExecutionParams): Promise<StepResult<any, any, any, any>> {
    if (!this.#mastra) {
      throw new Error('InProcessStrategy requires Mastra instance. Call __registerMastra() first.');
    }

    const workflow = this.#resolveWorkflow(params);
    const entry = workflow ? getStepEntry(workflow, params.executionPath) : null;

    if (!entry) {
      throw new Error(
        `InProcessStrategy: could not resolve step "${params.stepId}" at executionPath [${params.executionPath.join(',')}] in workflow "${params.workflowId}"`,
      );
    }

    const rc = new RequestContext<unknown>(Object.entries(params.requestContext ?? {}));

    let abortController: AbortController | undefined;
    if (params.abortSignal) {
      abortController = new AbortController();
      if (params.abortSignal.aborted) {
        abortController.abort(params.abortSignal.reason);
      } else {
        params.abortSignal.addEventListener(
          'abort',
          () => {
            abortController!.abort(params.abortSignal!.reason);
          },
          { once: true },
        );
      }
    }

    const executor = new StepExecutor({ mastra: this.#mastra });

    return executor.execute({
      workflowId: params.workflowId,
      entry,
      runId: params.runId,
      stepResults: params.stepResults as Record<string, StepResult<any, any, any, any>>,
      state: params.state,
      requestContext: rc,
      input: params.input,
      resumeData: params.resumeData,
      retryCount: params.retryCount,
      foreachIdx: params.foreachIdx,
      validateInputs: params.validateInputs,
      abortController,
      format: params.format,
      perStep: params.perStep,
    });
  }

  /**
   * Resolves the workflow in the same order the dispatching
   * `WorkflowEventProcessor` does: internal registrations first, then descent
   * from the parent chain for nested workflows (which may be registered
   * nowhere), then the public registry. Public lookups go through
   * `getWorkflowById` because events carry the workflow's `id` property
   * (e.g. "scheduled-workflow"), not the config key ("scheduledWorkflow").
   */
  #resolveWorkflow(params: StepExecutionParams): Workflow | null {
    const mastra = this.#mastra!;
    if (mastra.__hasInternalWorkflow(params.workflowId, params.runId)) {
      return mastra.__getInternalWorkflow(params.workflowId, params.runId) as Workflow;
    }
    if (params.parentWorkflow) {
      return resolveNestedWorkflow(mastra, params.workflowId, params.parentWorkflow);
    }
    return mastra.getWorkflowById(params.workflowId) as Workflow;
  }
}

/**
 * Descends from `parentWorkflow` and returns the nested workflow only when it,
 * and every workflow passed on the way, has the id the request names. The
 * parent chain addresses workflows by position, so a worker and server running
 * different builds could otherwise land on a different workflow and run it.
 */
function resolveNestedWorkflow(
  mastra: Mastra,
  workflowId: string,
  parentWorkflow: StepExecutionParentWorkflow,
): Workflow | null {
  if (
    parentWorkflow.parentWorkflow &&
    !resolveNestedWorkflow(mastra, parentWorkflow.workflowId, parentWorkflow.parentWorkflow)
  ) {
    return null;
  }
  const workflow = getNestedWorkflow(mastra, parentWorkflow);
  return workflow?.id === workflowId ? workflow : null;
}
