import { getErrorFromUnknown } from '@mastra/core/error';
import type { TracingOptions } from '@mastra/core/observability';
import type { RequestContext } from '@mastra/core/request-context';
import type {
  ClientOptions,
  GetWorkflowResponse,
  ListWorkflowRunsResponse,
  ListWorkflowRunsParams,
  WorkflowRunResult,
  GetWorkflowRunByIdResponse,
  GetWorkflowRunExecutionResultResponse,
  StreamVNextChunkType,
  TimeTravelParams,
} from '../types';

import { parseClientRequestContext, base64RequestContext, requestContextQueryString } from '../utils';
import { BaseResource } from './base';

/**
 * Deserializes the error property in a workflow result back to an Error instance.
 * Server sends SerializedError (plain object), client converts to Error for instanceof checks.
 */
function deserializeWorkflowError<T extends WorkflowRunResult>(result: T): T {
  if (result.status === 'failed' && result.error) {
    result.error = getErrorFromUnknown(result.error, {
      fallbackMessage: 'Unknown workflow error',
      supportSerialization: false,
    });
  }
  return result;
}

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
   * Cancels a specific workflow run by its ID
   * @param runId - The ID of the workflow run to cancel
   * @returns Promise containing a success message
   */
  cancelRun(runId: string): Promise<{ message: string }> {
    return this.request(`/api/workflows/${this.workflowId}/runs/${runId}/cancel`, {
      method: 'POST',
    });
  }

  /**
   * Creates a new workflow run
   * @param params - Optional object containing the optional runId
   * @returns Promise containing the runId of the created run with methods to control execution
   */
  async createRun(params?: { runId?: string; resourceId?: string; disableScorers?: boolean }): Promise<{
    runId: string;
    start: (params: {
      inputData: Record<string, any>;
      initialState?: Record<string, any>;
      requestContext?: RequestContext | Record<string, any>;
      tracingOptions?: TracingOptions;
    }) => Promise<{ message: string }>;
    resume: (params: {
      step?: string | string[];
      resumeData?: Record<string, any>;
      requestContext?: RequestContext | Record<string, any>;
      tracingOptions?: TracingOptions;
    }) => Promise<{ message: string }>;
    stream: (params: {
      inputData: Record<string, any>;
      initialState?: Record<string, any>;
      requestContext?: RequestContext | Record<string, any>;
    }) => Promise<ReadableStream>;
    startAsync: (params: {
      inputData: Record<string, any>;
      initialState?: Record<string, any>;
      requestContext?: RequestContext | Record<string, any>;
      tracingOptions?: TracingOptions;
    }) => Promise<WorkflowRunResult>;
    resumeAsync: (params: {
      step?: string | string[];
      resumeData?: Record<string, any>;
      requestContext?: RequestContext | Record<string, any>;
      tracingOptions?: TracingOptions;
    }) => Promise<WorkflowRunResult>;
    resumeStreamVNext: (params: {
      step?: string | string[];
      resumeData?: Record<string, any>;
      requestContext?: RequestContext | Record<string, any>;
    }) => Promise<ReadableStream<StreamVNextChunkType>>;
  }> {
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

    const runId = res.runId;

    return {
      runId,
      start: async (p: {
        inputData: Record<string, any>;
        initialState?: Record<string, any>;
        requestContext?: RequestContext | Record<string, any>;
        tracingOptions?: TracingOptions;
      }) => {
        return this.start({
          runId,
          inputData: p.inputData,
          initialState: p.initialState,
          requestContext: p.requestContext,
          tracingOptions: p.tracingOptions,
        });
      },
      startAsync: async (p: {
        inputData: Record<string, any>;
        initialState?: Record<string, any>;
        requestContext?: RequestContext | Record<string, any>;
        tracingOptions?: TracingOptions;
      }) => {
        return this.startAsync({
          runId,
          inputData: p.inputData,
          initialState: p.initialState,
          requestContext: p.requestContext,
          tracingOptions: p.tracingOptions,
          resourceId: params?.resourceId,
        });
      },
      stream: async (p: {
        inputData: Record<string, any>;
        initialState?: Record<string, any>;
        requestContext?: RequestContext | Record<string, any>;
      }) => {
        return this.stream({
          runId,
          inputData: p.inputData,
          initialState: p.initialState,
          requestContext: p.requestContext,
          resourceId: params?.resourceId,
        });
      },
      resume: async (p: {
        step?: string | string[];
        resumeData?: Record<string, any>;
        requestContext?: RequestContext | Record<string, any>;
        tracingOptions?: TracingOptions;
      }) => {
        return this.resume({
          runId,
          step: p.step,
          resumeData: p.resumeData,
          requestContext: p.requestContext,
          tracingOptions: p.tracingOptions,
        });
      },
      resumeAsync: async (p: {
        step?: string | string[];
        resumeData?: Record<string, any>;
        requestContext?: RequestContext | Record<string, any>;
        tracingOptions?: TracingOptions;
      }) => {
        return this.resumeAsync({
          runId,
          step: p.step,
          resumeData: p.resumeData,
          requestContext: p.requestContext,
          tracingOptions: p.tracingOptions,
        });
      },
      resumeStreamVNext: async (p: {
        step?: string | string[];
        resumeData?: Record<string, any>;
        requestContext?: RequestContext | Record<string, any>;
      }) => {
        return this.resumeStreamVNext({
          runId,
          step: p.step,
          resumeData: p.resumeData,
          requestContext: p.requestContext,
        });
      },
    };
  }

  /**
   * Starts a workflow run synchronously without waiting for the workflow to complete
   * @param params - Object containing the runId, inputData, initialState and requestContext
   * @returns Promise containing success message
   */
  start(params: {
    runId: string;
    inputData: Record<string, any>;
    initialState?: Record<string, any>;
    requestContext?: RequestContext | Record<string, any>;
    tracingOptions?: TracingOptions;
  }): Promise<{ message: string }> {
    const requestContext = parseClientRequestContext(params.requestContext);
    return this.request(`/api/workflows/${this.workflowId}/start?runId=${params.runId}`, {
      method: 'POST',
      body: {
        inputData: params?.inputData,
        initialState: params?.initialState,
        requestContext,
        tracingOptions: params.tracingOptions,
      },
    });
  }

  /**
   * Resumes a suspended workflow step synchronously without waiting for the workflow to complete
   * @param params - Object containing the runId, step, resumeData and requestContext
   * @returns Promise containing success message
   */
  resume({
    step,
    runId,
    resumeData,
    tracingOptions,
    ...rest
  }: {
    step?: string | string[];
    runId: string;
    resumeData?: Record<string, any>;
    requestContext?: RequestContext | Record<string, any>;
    tracingOptions?: TracingOptions;
  }): Promise<{ message: string }> {
    const requestContext = parseClientRequestContext(rest.requestContext);
    return this.request(`/api/workflows/${this.workflowId}/resume?runId=${runId}`, {
      method: 'POST',
      body: {
        step,
        resumeData,
        requestContext,
        tracingOptions,
      },
    });
  }

  /**
   * Starts a workflow run asynchronously and returns a promise that resolves when the workflow is complete
   * @param params - Object containing the optional runId, inputData, initialState and requestContext
   * @returns Promise containing the workflow execution results
   */
  startAsync(params: {
    runId?: string;
    inputData: Record<string, any>;
    initialState?: Record<string, any>;
    requestContext?: RequestContext | Record<string, any>;
    tracingOptions?: TracingOptions;
    resourceId?: string;
  }): Promise<WorkflowRunResult> {
    const searchParams = new URLSearchParams();

    if (!!params?.runId) {
      searchParams.set('runId', params.runId);
    }

    const requestContext = parseClientRequestContext(params.requestContext);

    return this.request<WorkflowRunResult>(`/api/workflows/${this.workflowId}/start-async?${searchParams.toString()}`, {
      method: 'POST',
      body: {
        inputData: params.inputData,
        initialState: params.initialState,
        requestContext,
        tracingOptions: params.tracingOptions,
        resourceId: params.resourceId,
      },
    }).then(deserializeWorkflowError);
  }

  /**
   * Starts a workflow run and returns a stream
   * @param params - Object containing the optional runId, inputData, initialState and requestContext
   * @returns Promise containing the workflow execution results
   */
  async stream(params: {
    runId?: string;
    inputData: Record<string, any>;
    initialState?: Record<string, any>;
    requestContext?: RequestContext | Record<string, any>;
    tracingOptions?: TracingOptions;
    resourceId?: string;
  }) {
    const searchParams = new URLSearchParams();

    if (!!params?.runId) {
      searchParams.set('runId', params.runId);
    }

    const requestContext = parseClientRequestContext(params.requestContext);
    const response: Response = await this.request(
      `/api/workflows/${this.workflowId}/stream?${searchParams.toString()}`,
      {
        method: 'POST',
        body: {
          inputData: params.inputData,
          initialState: params.initialState,
          requestContext,
          tracingOptions: params.tracingOptions,
          resourceId: params.resourceId,
        },
        stream: true,
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to stream workflow: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    //using undefined instead of empty string to avoid parsing errors
    let failedChunk: string | undefined = undefined;

    // Create a transform stream that processes the response body
    const transformStream = new TransformStream<ArrayBuffer, { type: string; payload: any }>({
      start() {},
      async transform(chunk, controller) {
        try {
          // Decode binary data to text
          const decoded = new TextDecoder().decode(chunk);

          // Split by record separator
          const chunks = decoded.split(RECORD_SEPARATOR);

          // Process each chunk
          for (const chunk of chunks) {
            if (chunk) {
              const newChunk: string = failedChunk ? failedChunk + chunk : chunk;
              try {
                const parsedChunk = JSON.parse(newChunk);
                controller.enqueue(parsedChunk);
                failedChunk = undefined;
              } catch {
                failedChunk = newChunk;
              }
            }
          }
        } catch {
          // Silently ignore processing errors
        }
      },
    });

    // Pipe the response body through the transform stream
    return response.body.pipeThrough(transformStream);
  }

  /**
   * Observes workflow stream for a workflow run
   * @param params - Object containing the runId
   * @returns Promise containing the workflow execution results
   */
  async observeStream(params: { runId: string }) {
    const searchParams = new URLSearchParams();
    searchParams.set('runId', params.runId);
    const response: Response = await this.request(
      `/api/workflows/${this.workflowId}/observe-stream?${searchParams.toString()}`,
      {
        method: 'POST',
        stream: true,
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to observe workflow stream: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    //using undefined instead of empty string to avoid parsing errors
    let failedChunk: string | undefined = undefined;

    // Create a transform stream that processes the response body
    const transformStream = new TransformStream<ArrayBuffer, { type: string; payload: any }>({
      start() {},
      async transform(chunk, controller) {
        try {
          // Decode binary data to text
          const decoded = new TextDecoder().decode(chunk);

          // Split by record separator
          const chunks = decoded.split(RECORD_SEPARATOR);

          // Process each chunk
          for (const chunk of chunks) {
            if (chunk) {
              const newChunk: string = failedChunk ? failedChunk + chunk : chunk;
              try {
                const parsedChunk = JSON.parse(newChunk);
                controller.enqueue(parsedChunk);
                failedChunk = undefined;
              } catch {
                failedChunk = newChunk;
              }
            }
          }
        } catch {
          // Silently ignore processing errors
        }
      },
    });

    // Pipe the response body through the transform stream
    return response.body.pipeThrough(transformStream);
  }

  /**
   * Starts a workflow run and returns a stream
   * @param params - Object containing the optional runId, inputData, initialState and requestContext
   * @returns Promise containing the workflow execution results
   */
  async streamVNext(params: {
    runId?: string;
    inputData?: Record<string, any>;
    initialState?: Record<string, any>;
    requestContext?: RequestContext;
    closeOnSuspend?: boolean;
    tracingOptions?: TracingOptions;
    resourceId?: string;
  }) {
    const searchParams = new URLSearchParams();

    if (!!params?.runId) {
      searchParams.set('runId', params.runId);
    }

    const requestContext = parseClientRequestContext(params.requestContext);
    const response: Response = await this.request(
      `/api/workflows/${this.workflowId}/streamVNext?${searchParams.toString()}`,
      {
        method: 'POST',
        body: {
          inputData: params.inputData,
          initialState: params.initialState,
          requestContext,
          closeOnSuspend: params.closeOnSuspend,
          tracingOptions: params.tracingOptions,
          resourceId: params.resourceId,
        },
        stream: true,
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to stream vNext workflow: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    //using undefined instead of empty string to avoid parsing errors
    let failedChunk: string | undefined = undefined;

    // Create a transform stream that processes the response body
    const transformStream = new TransformStream<ArrayBuffer, StreamVNextChunkType>({
      start() {},
      async transform(chunk, controller) {
        try {
          // Decode binary data to text
          const decoded = new TextDecoder().decode(chunk);

          // Split by record separator
          const chunks = decoded.split(RECORD_SEPARATOR);

          // Process each chunk
          for (const chunk of chunks) {
            if (chunk) {
              const newChunk: string = failedChunk ? failedChunk + chunk : chunk;
              try {
                const parsedChunk = JSON.parse(newChunk);
                controller.enqueue(parsedChunk);
                failedChunk = undefined;
              } catch {
                failedChunk = newChunk;
              }
            }
          }
        } catch {
          // Silently ignore processing errors
        }
      },
    });

    // Pipe the response body through the transform stream
    return response.body.pipeThrough(transformStream);
  }

  /**
   * Observes workflow vNext stream for a workflow run
   * @param params - Object containing the runId
   * @returns Promise containing the workflow execution results
   */
  async observeStreamVNext(params: { runId: string }) {
    const searchParams = new URLSearchParams();
    searchParams.set('runId', params.runId);

    const response: Response = await this.request(
      `/api/workflows/${this.workflowId}/observe-streamVNext?${searchParams.toString()}`,
      {
        method: 'POST',
        stream: true,
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to observe stream vNext workflow: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    //using undefined instead of empty string to avoid parsing errors
    let failedChunk: string | undefined = undefined;

    // Create a transform stream that processes the response body
    const transformStream = new TransformStream<ArrayBuffer, StreamVNextChunkType>({
      start() {},
      async transform(chunk, controller) {
        try {
          // Decode binary data to text
          const decoded = new TextDecoder().decode(chunk);

          // Split by record separator
          const chunks = decoded.split(RECORD_SEPARATOR);

          // Process each chunk
          for (const chunk of chunks) {
            if (chunk) {
              const newChunk: string = failedChunk ? failedChunk + chunk : chunk;
              try {
                const parsedChunk = JSON.parse(newChunk);
                controller.enqueue(parsedChunk);
                failedChunk = undefined;
              } catch {
                failedChunk = newChunk;
              }
            }
          }
        } catch {
          // Silently ignore processing errors
        }
      },
    });

    // Pipe the response body through the transform stream
    return response.body.pipeThrough(transformStream);
  }

  /**
   * Resumes a suspended workflow step asynchronously and returns a promise that resolves when the workflow is complete
   * @param params - Object containing the runId, step, resumeData and requestContext
   * @returns Promise containing the workflow resume results
   */
  resumeAsync(params: {
    runId: string;
    step?: string | string[];
    resumeData?: Record<string, any>;
    requestContext?: RequestContext | Record<string, any>;
    tracingOptions?: TracingOptions;
  }): Promise<WorkflowRunResult> {
    const requestContext = parseClientRequestContext(params.requestContext);
    return this.request<WorkflowRunResult>(`/api/workflows/${this.workflowId}/resume-async?runId=${params.runId}`, {
      method: 'POST',
      body: {
        step: params.step,
        resumeData: params.resumeData,
        requestContext,
        tracingOptions: params.tracingOptions,
      },
    }).then(deserializeWorkflowError);
  }

  /**
   * Resumes a suspended workflow step that uses streamVNext asynchronously and returns a promise that resolves when the workflow is complete
   * @param params - Object containing the runId, step, resumeData and requestContext
   * @returns Promise containing the workflow resume results
   */
  async resumeStreamVNext(params: {
    runId: string;
    step?: string | string[];
    resumeData?: Record<string, any>;
    requestContext?: RequestContext | Record<string, any>;
    tracingOptions?: TracingOptions;
  }) {
    const searchParams = new URLSearchParams();
    searchParams.set('runId', params.runId);
    const requestContext = parseClientRequestContext(params.requestContext);
    const response: Response = await this.request(
      `/api/workflows/${this.workflowId}/resume-stream?${searchParams.toString()}`,
      {
        method: 'POST',
        body: {
          step: params.step,
          resumeData: params.resumeData,
          requestContext,
          tracingOptions: params.tracingOptions,
        },
        stream: true,
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to stream vNext workflow: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    //using undefined instead of empty string to avoid parsing errors
    let failedChunk: string | undefined = undefined;

    // Create a transform stream that processes the response body
    const transformStream = new TransformStream<ArrayBuffer, StreamVNextChunkType>({
      start() {},
      async transform(chunk, controller) {
        try {
          // Decode binary data to text
          const decoded = new TextDecoder().decode(chunk);

          // Split by record separator
          const chunks = decoded.split(RECORD_SEPARATOR);

          // Process each chunk
          for (const chunk of chunks) {
            if (chunk) {
              const newChunk: string = failedChunk ? failedChunk + chunk : chunk;
              try {
                const parsedChunk = JSON.parse(newChunk);
                controller.enqueue(parsedChunk);
                failedChunk = undefined;
              } catch {
                failedChunk = newChunk;
              }
            }
          }
        } catch {
          // Silently ignore processing errors
        }
      },
    });

    // Pipe the response body through the transform stream
    return response.body.pipeThrough(transformStream);
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

  /**
   * Restarts an active workflow run synchronously without waiting for the workflow to complete
   * @param params - Object containing the runId and requestContext
   * @returns Promise containing success message
   */
  restart(params: {
    runId: string;
    requestContext?: RequestContext | Record<string, any>;
    tracingOptions?: TracingOptions;
  }): Promise<{ message: string }> {
    const requestContext = parseClientRequestContext(params.requestContext);
    return this.request(`/api/workflows/${this.workflowId}/restart?runId=${params.runId}`, {
      method: 'POST',
      body: {
        requestContext,
        tracingOptions: params.tracingOptions,
      },
    });
  }

  /**
   * Restarts an active workflow run asynchronously
   * @param params - Object containing the runId and requestContext
   * @returns Promise containing the workflow restart results
   */
  restartAsync(params: {
    runId: string;
    requestContext?: RequestContext | Record<string, any>;
    tracingOptions?: TracingOptions;
  }): Promise<WorkflowRunResult> {
    const requestContext = parseClientRequestContext(params.requestContext);
    return this.request<WorkflowRunResult>(`/api/workflows/${this.workflowId}/restart-async?runId=${params.runId}`, {
      method: 'POST',
      body: {
        requestContext,
        tracingOptions: params.tracingOptions,
      },
    }).then(deserializeWorkflowError);
  }

  /**
   * Restart all active workflow runs synchronously without waiting for the workflow to complete
   * @returns Promise containing success message
   */
  restartAllActiveWorkflowRuns(): Promise<{ message: string }> {
    return this.request(`/api/workflows/${this.workflowId}/restart-all-active-workflow-runs`, {
      method: 'POST',
    });
  }

  /**
   * Restart all active workflow runs asynchronously
   * @returns Promise containing success message
   */
  restartAllActiveWorkflowRunsAsync(): Promise<{ message: string }> {
    return this.request(`/api/workflows/${this.workflowId}/restart-all-active-workflow-runs-async`, {
      method: 'POST',
    });
  }

  /**
   * Time travels a workflow run synchronously without waiting for the workflow to complete
   * @param params - Object containing the runId, step, inputData, resumeData, initialState, context, nestedStepsContext, requestContext and tracingOptions
   * @returns Promise containing success message
   */
  timeTravel({
    runId,
    requestContext: paramsRequestContext,
    ...params
  }: TimeTravelParams): Promise<{ message: string }> {
    const requestContext = parseClientRequestContext(paramsRequestContext);
    return this.request(`/api/workflows/${this.workflowId}/time-travel?runId=${runId}`, {
      method: 'POST',
      body: {
        ...params,
        requestContext,
      },
    });
  }

  /**
   * Time travels a workflow run asynchronously
   * @param params - Object containing the runId, step, inputData, resumeData, initialState, context, nestedStepsContext, requestContext and tracingOptions
   * @returns Promise containing the workflow time travel results
   */
  timeTravelAsync({
    runId,
    requestContext: paramsRequestContext,
    ...params
  }: TimeTravelParams): Promise<WorkflowRunResult> {
    const requestContext = parseClientRequestContext(paramsRequestContext);
    return this.request<WorkflowRunResult>(`/api/workflows/${this.workflowId}/time-travel-async?runId=${runId}`, {
      method: 'POST',
      body: {
        ...params,
        requestContext,
      },
    }).then(deserializeWorkflowError);
  }

  /**
   * Time travels a workflow run and returns a stream
   * @param params - Object containing the runId, step, inputData, resumeData, initialState, context, nestedStepsContext, requestContext and tracingOptions
   * @returns Promise containing the workflow execution results
   */
  async timeTravelStream({ runId, requestContext: paramsRequestContext, ...params }: TimeTravelParams) {
    const requestContext = parseClientRequestContext(paramsRequestContext);
    const response: Response = await this.request(
      `/api/workflows/${this.workflowId}/time-travel-stream?runId=${runId}`,
      {
        method: 'POST',
        body: {
          ...params,
          requestContext,
        },
        stream: true,
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to time travel workflow: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    //using undefined instead of empty string to avoid parsing errors
    let failedChunk: string | undefined = undefined;

    // Create a transform stream that processes the response body
    const transformStream = new TransformStream<ArrayBuffer, StreamVNextChunkType>({
      start() {},
      async transform(chunk, controller) {
        try {
          // Decode binary data to text
          const decoded = new TextDecoder().decode(chunk);

          // Split by record separator
          const chunks = decoded.split(RECORD_SEPARATOR);

          // Process each chunk
          for (const chunk of chunks) {
            if (chunk) {
              const newChunk: string = failedChunk ? failedChunk + chunk : chunk;
              try {
                const parsedChunk = JSON.parse(newChunk);
                controller.enqueue(parsedChunk);
                failedChunk = undefined;
              } catch {
                failedChunk = newChunk;
              }
            }
          }
        } catch {
          // Silently ignore processing errors
        }
      },
    });

    // Pipe the response body through the transform stream
    return response.body.pipeThrough(transformStream);
  }
}
