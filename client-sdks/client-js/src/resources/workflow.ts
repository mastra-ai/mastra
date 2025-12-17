import type { RequestContext } from '@mastra/core/request-context';
import type {
  ClientOptions,
  GetWorkflowResponse,
  ListWorkflowRunsResponse,
  ListWorkflowRunsParams,
  GetWorkflowRunByIdResponse,
  GetWorkflowRunExecutionResultResponse,
} from '../types';

import { parseClientRequestContext, base64RequestContext, requestContextQueryString } from '../utils';
import { BaseResource } from './base';
import { Run } from './run';

const RECORD_SEPARATOR = '\x1E';

export class Workflow extends BaseResource {
  constructor(
    options: ClientOptions,
    private workflowId: string,
  ) {
    super(options);
  }

  /**
   * Retrieves details about the workflow
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing workflow details including steps and graphs
   */
  details(requestContext?: RequestContext | Record<string, any>): Promise<GetWorkflowResponse> {
    return this.request(`/api/workflows/${this.workflowId}${requestContextQueryString(requestContext)}`);
  }

  /**
   * Retrieves all runs for a workflow
   * @param params - Parameters for filtering runs
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing workflow runs array
   */
  runs(
    params?: ListWorkflowRunsParams,
    requestContext?: RequestContext | Record<string, any>,
  ): Promise<ListWorkflowRunsResponse> {
    const requestContextParam = base64RequestContext(parseClientRequestContext(requestContext));

    const searchParams = new URLSearchParams();
    if (params?.fromDate) {
      searchParams.set('fromDate', params.fromDate.toISOString());
    }
    if (params?.toDate) {
      searchParams.set('toDate', params.toDate.toISOString());
    }
    if (params?.page !== undefined) {
      searchParams.set('page', String(params.page));
    }
    if (params?.perPage !== undefined) {
      searchParams.set('perPage', String(params.perPage));
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
    if (params?.status) {
      searchParams.set('status', params.status);
    }
    if (requestContextParam) {
      searchParams.set('requestContext', requestContextParam);
    }

    if (searchParams.size) {
      return this.request(`/api/workflows/${this.workflowId}/runs?${searchParams}`);
    } else {
      return this.request(`/api/workflows/${this.workflowId}/runs`);
    }
  }

  /**
   * Retrieves a specific workflow run by its ID
   * @param runId - The ID of the workflow run to retrieve
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing the workflow run details
   */
  runById(runId: string, requestContext?: RequestContext | Record<string, any>): Promise<GetWorkflowRunByIdResponse> {
    return this.request(`/api/workflows/${this.workflowId}/runs/${runId}${requestContextQueryString(requestContext)}`);
  }

  /**
   * Deletes a specific workflow run by its ID
   * @param runId - The ID of the workflow run to delete
   * @returns Promise containing a success message
   */
  deleteRunById(runId: string): Promise<{ message: string }> {
    return this.request(`/api/workflows/${this.workflowId}/runs/${runId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Retrieves the execution result for a specific workflow run by its ID
   * @param runId - The ID of the workflow run to retrieve the execution result for
   * @param requestContext - Optional request context to pass as query parameter
   * @returns Promise containing the workflow run execution result
   */
  runExecutionResult(
    runId: string,
    requestContext?: RequestContext | Record<string, any>,
  ): Promise<GetWorkflowRunExecutionResultResponse> {
    return this.request(
      `/api/workflows/${this.workflowId}/runs/${runId}/execution-result${requestContextQueryString(requestContext)}`,
    );
  }

  /**
   * Creates a new workflow run
   * @param params - Optional object containing the optional runId
   * @returns Promise containing the Run instance
   */
  async createRun(params?: { runId?: string; resourceId?: string; disableScorers?: boolean }) {
    const searchParams = new URLSearchParams();

    if (!!params?.runId) {
      searchParams.set('runId', params.runId);
    }

    const res = await this.request<{ runId: string }>(
      `/api/workflows/${this.workflowId}/create-run?${searchParams.toString()}`,
      {
        method: 'POST',
        body: {
          resourceId: params?.resourceId,
          disableScorers: params?.disableScorers,
        },
      },
    );

    const run = new Run(this.options, this.workflowId, res.runId);

    return run;
  }

  /**
   * Creates a new ReadableStream from an iterable or async iterable of objects,
   * serializing each as JSON and separating them with the record separator (\x1E).
   *
   * @param records - An iterable or async iterable of objects to stream
   * @returns A ReadableStream emitting the records as JSON strings separated by the record separator
   */
  static createRecordStream(records: Iterable<any> | AsyncIterable<any>): ReadableStream {
    const encoder = new TextEncoder();
    return new ReadableStream({
      async start(controller) {
        try {
          for await (const record of records as AsyncIterable<any>) {
            const json = JSON.stringify(record) + RECORD_SEPARATOR;
            controller.enqueue(encoder.encode(json));
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });
  }
}
