import type { GetWorkflowResponse, ClientOptions } from '../types';

import { BaseResource } from './base';

export class Workflow extends BaseResource {
  constructor(
    options: ClientOptions,
    private workflowId: string,
  ) {
    super(options);
  }

  /**
   * Retrieves details about the workflow
   * @returns Promise containing workflow details including steps and graphs
   */
  details(): Promise<GetWorkflowResponse> {
    return this.request(`/api/workflows/${this.workflowId}`);
  }

  /**
   * Executes the workflow with the provided parameters
   * @param params - Parameters required for workflow execution
   * @returns Promise containing the workflow execution results
   */
  execute(params: Record<string, any>): Promise<Record<string, any>> {
    return this.request(`/api/workflows/${this.workflowId}/execute`, {
      method: 'POST',
      body: params,
    });
  }

  /**
   * Resumes a suspended workflow step
   * @param stepId - ID of the step to resume
   * @param runId - ID of the workflow run
   * @param context - Context to resume the workflow with
   * @returns Promise containing the workflow resume results
   */
  resume(stepId: string, runId: string, context: Record<string, any>): Promise<Record<string, any>> {
    return this.request(`/api/workflows/${this.workflowId}/resume`, {
      method: 'POST',
      body: {
        stepId,
        runId,
        context,
      },
    });
  }

  /**
   * Watches workflow transitions in real-time
   * @returns Promise containing the workflow watch stream
   */
  watch(): Promise<Response> {
    return this.request(`/api/workflows/${this.workflowId}/watch`, {
      stream: true,
    });
  }
}
