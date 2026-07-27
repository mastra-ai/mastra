import type { RequestContext } from '@mastra/core/request-context';
import type { WorkflowInfo } from '@mastra/core/workflows';
import type { ClientOptions, ListWorkflowRunsParams } from '../types';
import { parseClientRequestContext } from '../utils';
import { createRecordSeparatorJsonTransform } from '../utils/stream-transforms';
import { BaseResource } from './base';

export interface AgentBuilderActionRequest {
  /** Input data specific to the workflow type */
  inputData: any;
  /** Request context for the action execution */
  requestContext?: RequestContext;
}

export interface AgentBuilderActionResult {
  success: boolean;
  applied: boolean;
  branchName?: string;
  message: string;
  validationResults?: any;
  error?: string;
  errors?: string[];
  stepResults?: any;
}

/**
 * Agent Builder resource: operations related to agent-builder workflows via server endpoints.
 */
export class AgentBuilder extends BaseResource {
  constructor(
    options: ClientOptions,
    private actionId: string,
  ) {
    super(options);
  }

  // Helper function to transform workflow result to action result
  transformWorkflowResult(result: any): AgentBuilderActionResult {
    if (result.status === 'success') {
      return {
        success: result.result.success || false,
        applied: result.result.applied || false,
        branchName: result.result.branchName,
        message: result.result.message || 'Agent builder action completed',
        validationResults: result.result.validationResults,
        error: result.result.error,
        errors: result.result.errors,
        stepResults: result.result.stepResults,
      };
    } else if (result.status === 'failed') {
      return {
        success: false,
        applied: false,
        message: `Agent builder action failed: ${result.error.message}`,
        error: result.error.message,
      };
    } else {
      return {
        success: false,
        applied: false,
        message: 'Agent builder action was suspended',
        error: 'Workflow suspended - manual intervention required',
      };
    }
  }

  private createRecordParserTransform(): TransformStream<ArrayBuffer, { type: string; payload: any }> {
    return createRecordSeparatorJsonTransform();
  }

  /**
   * Creates a new agent builder action run and returns the runId.
   * This calls `/agent-builder/:actionId/create-run`.
   */
  async createRun(params?: { runId?: string }): Promise<{ runId: string }> {
    const searchParams = new URLSearchParams();

    if (!!params?.runId) {
      searchParams.set('runId', params.runId);
    }

    const url = `/agent-builder/${this.actionId}/create-run${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    return this.request(url, {
      method: 'POST',
    });
  }

  /**
   * Starts agent builder action asynchronously and waits for completion.
   * This calls `/agent-builder/:actionId/start-async`.
   */
  async startAsync(params: AgentBuilderActionRequest, runId?: string): Promise<AgentBuilderActionResult> {
    const searchParams = new URLSearchParams();
    if (runId) {
      searchParams.set('runId', runId);
    }

    const requestContext = parseClientRequestContext(params.requestContext);
    const { requestContext: _, ...actionParams } = params;

    const url = `/agent-builder/${this.actionId}/start-async${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    const result = await this.request(url, {
      method: 'POST',
      body: { ...actionParams, requestContext },
    });

    return this.transformWorkflowResult(result);
  }

  /**
   * Starts an existing agent builder action run.
   * This calls `/agent-builder/:actionId/start`.
   */
  async startActionRun(params: AgentBuilderActionRequest, runId: string): Promise<{ message: string }> {
    const searchParams = new URLSearchParams();
    searchParams.set('runId', runId);

    const requestContext = parseClientRequestContext(params.requestContext);
    const { requestContext: _, ...actionParams } = params;

    const url = `/agent-builder/${this.actionId}/start?${searchParams.toString()}`;
    return this.request(url, {
      method: 'POST',
      body: { ...actionParams, requestContext },
    });
  }

  /**
   * Resumes a suspended agent builder action step.
   * This calls `/agent-builder/:actionId/resume`.
   */
  async resume(
    params: {
      step?: string | string[];
      resumeData?: unknown;
      requestContext?: RequestContext;
    },
    runId: string,
  ): Promise<{ message: string }> {
    const searchParams = new URLSearchParams();
    searchParams.set('runId', runId);

    const requestContext = parseClientRequestContext(params.requestContext);
    const { requestContext: _, ...resumeParams } = params;

    const url = `/agent-builder/${this.actionId}/resume?${searchParams.toString()}`;
    return this.request(url, {
      method: 'POST',
      body: { ...resumeParams, requestContext },
    });
  }

  /**
   * Resumes a suspended agent builder action step asynchronously.
   * This calls `/agent-builder/:actionId/resume-async`.
   */
  async resumeAsync(
    params: {
      step?: string | string[];
      resumeData?: unknown;
      requestContext?: RequestContext;
    },
    runId: string,
  ): Promise<AgentBuilderActionResult> {
    const searchParams = new URLSearchParams();
    searchParams.set('runId', runId);

    const requestContext = parseClientRequestContext(params.requestContext);
    const { requestContext: _, ...resumeParams } = params;

    const url = `/agent-builder/${this.actionId}/resume-async?${searchParams.toString()}`;
    const result = await this.request(url, {
      method: 'POST',
      body: { ...resumeParams, requestContext },
    });

    return this.transformWorkflowResult(result);
  }

  /**
   * Streams agent builder action progress in real-time.
   * This calls `/agent-builder/:actionId/stream`.
   */
  async stream(
    params: AgentBuilderActionRequest,
    runId: string,
  ): Promise<globalThis.ReadableStream<{ type: string; payload: any }>> {
    if (!runId) {
      throw new Error('runId is required to stream an agent builder action');
    }

    const searchParams = new URLSearchParams();
    searchParams.set('runId', runId);

    const requestContext = parseClientRequestContext(params.requestContext);
    const { requestContext: _, ...actionParams } = params;

    const url = `/agent-builder/${this.actionId}/stream?${searchParams.toString()}`;
    const response: Response = await this.request(url, {
      method: 'POST',
      body: { ...actionParams, requestContext },
      stream: true,
    });

    if (!response.ok) {
      throw new Error(`Failed to stream agent builder action: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    return response.body.pipeThrough(this.createRecordParserTransform());
  }

  /**
   * Observes an existing agent builder action run stream.
   * Replays cached execution from the beginning, then continues with live stream.
   * This is the recommended method for recovery after page refresh/hot reload.
   * This calls `/agent-builder/:actionId/observe`
   */
  async observeStream(params: { runId: string }): Promise<globalThis.ReadableStream<{ type: string; payload: any }>> {
    const searchParams = new URLSearchParams();
    searchParams.set('runId', params.runId);

    const url = `/agent-builder/${this.actionId}/observe?${searchParams.toString()}`;
    const response: Response = await this.request(url, {
      method: 'POST',
      stream: true,
    });

    if (!response.ok) {
      throw new Error(`Failed to observe agent builder action stream: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    return response.body.pipeThrough(this.createRecordParserTransform());
  }

  /**
   * Observes an existing agent builder action run stream using legacy streaming API.
   * Replays cached execution from the beginning, then continues with live stream.
   * This calls `/agent-builder/:actionId/observe-stream-legacy`.
   */
  async observeStreamLegacy(params: {
    runId: string;
  }): Promise<globalThis.ReadableStream<{ type: string; payload: any }>> {
    const searchParams = new URLSearchParams();
    searchParams.set('runId', params.runId);

    const url = `/agent-builder/${this.actionId}/observe-stream-legacy?${searchParams.toString()}`;
    const response: Response = await this.request(url, {
      method: 'POST',
      stream: true,
    });

    if (!response.ok) {
      throw new Error(`Failed to observe agent builder action stream legacy: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    return response.body.pipeThrough(this.createRecordParserTransform());
  }

  /**
   * Resumes a suspended agent builder action and streams the results.
   * This calls `/agent-builder/:actionId/resume-stream`.
   */
  async resumeStream(params: {
    runId: string;
    step: string | string[];
    resumeData?: unknown;
    requestContext?: RequestContext;
  }): Promise<globalThis.ReadableStream<{ type: string; payload: any }>> {
    const searchParams = new URLSearchParams();
    searchParams.set('runId', params.runId);

    const requestContext = parseClientRequestContext(params.requestContext);
    const { runId: _, requestContext: __, ...resumeParams } = params;

    const url = `/agent-builder/${this.actionId}/resume-stream?${searchParams.toString()}`;
    const response: Response = await this.request(url, {
      method: 'POST',
      body: { ...resumeParams, requestContext },
      stream: true,
    });

    if (!response.ok) {
      throw new Error(`Failed to resume agent builder action stream: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    return response.body.pipeThrough(this.createRecordParserTransform());
  }

  /**
   * Gets a specific action run by its ID.
   * This calls `/agent-builder/:actionId/runs/:runId`.
   * @param runId - The ID of the action run to retrieve
   * @param options - Optional configuration
   * @param options.fields - Optional array of fields to return (e.g., ['result', 'steps']). Available fields: result, error, payload, steps, activeStepsPath, serializedStepGraph. Metadata fields (runId, workflowName, resourceId, createdAt, updatedAt) and status are always included.
   * @param options.withNestedWorkflows - Whether to include nested workflow data in steps. Defaults to true. Set to false for better performance when you don't need nested workflow details.
   * @returns Promise containing the action run details with metadata and processed execution state
   */
  async runById(
    runId: string,
    options?: {
      fields?: string[];
      withNestedWorkflows?: boolean;
    },
  ) {
    const searchParams = new URLSearchParams();

    if (options?.fields && options.fields.length > 0) {
      searchParams.set('fields', options.fields.join(','));
    }

    if (options?.withNestedWorkflows !== undefined) {
      searchParams.set('withNestedWorkflows', String(options.withNestedWorkflows));
    }

    const queryString = searchParams.size > 0 ? `?${searchParams.toString()}` : '';
    const url = `/agent-builder/${this.actionId}/runs/${runId}${queryString}`;
    return this.request(url, {
      method: 'GET',
    });
  }

  /**
   * Gets details about this agent builder action.
   * This calls `/agent-builder/:actionId`.
   */
  async details(): Promise<WorkflowInfo> {
    const result = await this.request<WorkflowInfo>(`/agent-builder/${this.actionId}`);
    return result;
  }

  /**
   * Gets all runs for this agent builder action.
   * This calls `/agent-builder/:actionId/runs`.
   */
  async runs(params?: ListWorkflowRunsParams) {
    const searchParams = new URLSearchParams();
    if (params?.fromDate) {
      searchParams.set('fromDate', params.fromDate.toISOString());
    }
    if (params?.toDate) {
      searchParams.set('toDate', params.toDate.toISOString());
    }
    if (params?.perPage !== undefined) {
      searchParams.set('perPage', String(params.perPage));
    }
    if (params?.page !== undefined) {
      searchParams.set('page', String(params.page));
    }
    // Legacy support: also send limit/offset if provided (for older servers)
    if (params?.limit !== null && params?.limit !== undefined) {
      if (params.limit === false) {
        searchParams.set('limit', 'false');
      } else if (typeof params.limit === 'number' && params.limit > 0 && Number.isInteger(params.limit)) {
        searchParams.set('limit', String(params.limit));
      }
    }
    if (params?.offset !== null && params?.offset !== undefined && !isNaN(Number(params?.offset))) {
      searchParams.set('offset', String(params.offset));
    }
    if (params?.resourceId) {
      searchParams.set('resourceId', params.resourceId);
    }

    const url = `/agent-builder/${this.actionId}/runs${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    return this.request(url, {
      method: 'GET',
    });
  }

  /**
   * Cancels an agent builder action run.
   * This calls `/agent-builder/:actionId/runs/:runId/cancel`.
   */
  async cancelRun(runId: string): Promise<{ message: string }> {
    const url = `/agent-builder/${this.actionId}/runs/${runId}/cancel`;
    return this.request(url, {
      method: 'POST',
    });
  }
}
