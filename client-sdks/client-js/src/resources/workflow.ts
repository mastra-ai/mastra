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
} from '../types';

import { parseClientRequestContext, base64RequestContext, requestContextQueryString } from '../utils';
import { BaseResource } from './base';

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
    if (params?.perPage !== null && params?.perPage !== undefined) {
      if (params.perPage === false) {
        searchParams.set('perPage', 'false');
      } else if (typeof params.perPage === 'number' && params.perPage > 0 && Number.isInteger(params.perPage)) {
        searchParams.set('perPage', String(params.perPage));
      }
    }
    if (params?.page !== null && params?.page !== undefined && !isNaN(Number(params?.page))) {
      searchParams.set('page', String(params.page));
    }
    if (params?.resourceId) {
      searchParams.set('resourceId', params.resourceId);
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
  async createRun(params?: { runId?: string }): Promise<{
    runId: string;
    start: (params: {
      inputData: Record<string, any>;
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
      requestContext?: RequestContext | Record<string, any>;
    }) => Promise<ReadableStream>;
    startAsync: (params: {
      inputData: Record<string, any>;
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
    }) => Promise<ReadableStream>;
  }> {
    const searchParams = new URLSearchParams();

    if (!!params?.runId) {
      searchParams.set('runId', params.runId);
    }

    const res = await this.request<{ runId: string }>(
      `/api/workflows/${this.workflowId}/create-run?${searchParams.toString()}`,
      {
        method: 'POST',
      },
    );

    const runId = res.runId;

    return {
      runId,
      start: async (p: {
        inputData: Record<string, any>;
        requestContext?: RequestContext | Record<string, any>;
        tracingOptions?: TracingOptions;
      }) => {
        return this.start({
          runId,
          inputData: p.inputData,
          requestContext: p.requestContext,
          tracingOptions: p.tracingOptions,
        });
      },
      startAsync: async (p: {
        inputData: Record<string, any>;
        requestContext?: RequestContext | Record<string, any>;
        tracingOptions?: TracingOptions;
      }) => {
        return this.startAsync({
          runId,
          inputData: p.inputData,
          requestContext: p.requestContext,
          tracingOptions: p.tracingOptions,
        });
      },
      stream: async (p: { inputData: Record<string, any>; requestContext?: RequestContext | Record<string, any> }) => {
        return this.stream({ runId, inputData: p.inputData, requestContext: p.requestContext });
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
   * @param params - Object containing the runId, inputData and requestContext
   * @returns Promise containing success message
   */
  start(params: {
    runId: string;
    inputData: Record<string, any>;
    requestContext?: RequestContext | Record<string, any>;
    tracingOptions?: TracingOptions;
  }): Promise<{ message: string }> {
    const requestContext = parseClientRequestContext(params.requestContext);
    return this.request(`/api/workflows/${this.workflowId}/start?runId=${params.runId}`, {
      method: 'POST',
      body: { inputData: params?.inputData, requestContext, tracingOptions: params.tracingOptions },
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
   * @param params - Object containing the optional runId, inputData and requestContext
   * @returns Promise containing the workflow execution results
   */
  startAsync(params: {
    runId?: string;
    inputData: Record<string, any>;
    requestContext?: RequestContext | Record<string, any>;
    tracingOptions?: TracingOptions;
  }): Promise<WorkflowRunResult> {
    const searchParams = new URLSearchParams();

    if (!!params?.runId) {
      searchParams.set('runId', params.runId);
    }

    const requestContext = parseClientRequestContext(params.requestContext);

    return this.request(`/api/workflows/${this.workflowId}/start-async?${searchParams.toString()}`, {
      method: 'POST',
      body: { inputData: params.inputData, requestContext, tracingOptions: params.tracingOptions },
    });
  }

  /**
   * Starts a workflow run and returns a stream
   * @param params - Object containing the optional runId, inputData and requestContext
   * @returns Promise containing the workflow execution results
   */
  async stream(params: {
    runId?: string;
    inputData: Record<string, any>;
    requestContext?: RequestContext | Record<string, any>;
    tracingOptions?: TracingOptions;
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
        body: { inputData: params.inputData, requestContext, tracingOptions: params.tracingOptions },
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
   * @param params - Object containing the optional runId, inputData and requestContext
   * @returns Promise containing the workflow execution results
   */
  async streamVNext(params: {
    runId?: string;
    inputData?: Record<string, any>;
    requestContext?: RequestContext;
    closeOnSuspend?: boolean;
    tracingOptions?: TracingOptions;
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
          requestContext,
          closeOnSuspend: params.closeOnSuspend,
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
    return this.request(`/api/workflows/${this.workflowId}/resume-async?runId=${params.runId}`, {
      method: 'POST',
      body: {
        step: params.step,
        resumeData: params.resumeData,
        requestContext,
        tracingOptions: params.tracingOptions,
      },
    });
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
  }): Promise<ReadableStream> {
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
}
