import { RequestContext } from '../../di';
import type { Mastra } from '../../mastra';
import { StepExecutor } from '../../workflows/evented/step-executor';
import { getStep } from '../../workflows/evented/workflow-event-processor/utils';
import type { StepResult } from '../../workflows/types';
import type { StepExecutionParams, StepExecutionStrategy } from '../types';

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

    const workflow = this.#mastra.getWorkflow(params.workflowId);
    const step = getStep(workflow, params.executionPath);

    if (!step) {
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
      step,
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
}
