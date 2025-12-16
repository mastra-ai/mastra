import { getErrorFromUnknown } from '@mastra/core/error';
import type { TracingOptions } from '@mastra/core/observability';
import type { RequestContext } from '@mastra/core/request-context';
import type { ClientOptions, WorkflowRunResult, StreamVNextChunkType, TimeTravelParams } from '../types';

import { parseClientRequestContext } from '../utils';
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

export class Run extends BaseResource {
  constructor(
    options: ClientOptions,
    private workflowId: string,
    public readonly runId: string,
  ) {
    super(options);
  }

  /**
   * Cancels a specific workflow run by its ID
   * @returns Promise containing a success message
   */
  cancelRun(): Promise<{ message: string }> {
    return this.request(`/api/workflows/${this.workflowId}/runs/${this.runId}/cancel`, {
      method: 'POST',
    });
  }

  /**
   * Starts a workflow run synchronously without waiting for the workflow to complete
   * @param params - Object containing the inputData, initialState and requestContext
   * @returns Promise containing success message
   */
  start(params: {
    inputData: Record<string, any>;
    initialState?: Record<string, any>;
    requestContext?: RequestContext | Record<string, any>;
    tracingOptions?: TracingOptions;
  }): Promise<{ message: string }> {
    const requestContext = parseClientRequestContext(params.requestContext);
    return this.request(`/api/workflows/${this.workflowId}/start?runId=${this.runId}`, {
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
   * @param params - Object containing the step, resumeData and requestContext
   * @returns Promise containing success message
   */
  resume({
    step,
    resumeData,
    tracingOptions,
    ...rest
  }: {
    step?: string | string[];
    resumeData?: Record<string, any>;
    requestContext?: RequestContext | Record<string, any>;
    tracingOptions?: TracingOptions;
  }): Promise<{ message: string }> {
    const requestContext = parseClientRequestContext(rest.requestContext);
    return this.request(`/api/workflows/${this.workflowId}/resume?runId=${this.runId}`, {
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
   * @param params - Object containing the inputData, initialState and requestContext
   * @returns Promise containing the workflow execution results
   */
  startAsync(params: {
    inputData: Record<string, any>;
    initialState?: Record<string, any>;
    requestContext?: RequestContext | Record<string, any>;
    tracingOptions?: TracingOptions;
    resourceId?: string;
  }): Promise<WorkflowRunResult> {
    const searchParams = new URLSearchParams();

    searchParams.set('runId', this.runId);

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
   * @param params - Object containing the inputData, initialState and requestContext
   * @returns Promise containing the workflow execution results
   */
  async stream(params: {
    inputData: Record<string, any>;
    initialState?: Record<string, any>;
    requestContext?: RequestContext | Record<string, any>;
    tracingOptions?: TracingOptions;
    resourceId?: string;
  }) {
    const searchParams = new URLSearchParams();

    searchParams.set('runId', this.runId);

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
   * @returns Promise containing the workflow execution results
   */
  async observeStream() {
    const searchParams = new URLSearchParams();
    searchParams.set('runId', this.runId);
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
   * @param params - Object containing the inputData, initialState and requestContext
   * @returns Promise containing the workflow execution results
   */
  async streamVNext(params: {
    inputData?: Record<string, any>;
    initialState?: Record<string, any>;
    requestContext?: RequestContext;
    closeOnSuspend?: boolean;
    tracingOptions?: TracingOptions;
    resourceId?: string;
  }) {
    const searchParams = new URLSearchParams();

    searchParams.set('runId', this.runId);

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
   * @returns Promise containing the workflow execution results
   */
  async observeStreamVNext() {
    const searchParams = new URLSearchParams();
    searchParams.set('runId', this.runId);

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
   * @param params - Object containing the step, resumeData and requestContext
   * @returns Promise containing the workflow resume results
   */
  resumeAsync(params: {
    step?: string | string[];
    resumeData?: Record<string, any>;
    requestContext?: RequestContext | Record<string, any>;
    tracingOptions?: TracingOptions;
  }): Promise<WorkflowRunResult> {
    const requestContext = parseClientRequestContext(params.requestContext);
    return this.request<WorkflowRunResult>(`/api/workflows/${this.workflowId}/resume-async?runId=${this.runId}`, {
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
   * @param params - Object containing the step, resumeData and requestContext
   * @returns Promise containing the workflow resume results
   */
  async resumeStreamVNext(params: {
    step?: string | string[];
    resumeData?: Record<string, any>;
    requestContext?: RequestContext | Record<string, any>;
    tracingOptions?: TracingOptions;
  }) {
    const searchParams = new URLSearchParams();
    searchParams.set('runId', this.runId);
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
   * Restarts an active workflow run synchronously without waiting for the workflow to complete
   * @param params - Object containing the requestContext
   * @returns Promise containing success message
   */
  restart(params: {
    requestContext?: RequestContext | Record<string, any>;
    tracingOptions?: TracingOptions;
  }): Promise<{ message: string }> {
    const requestContext = parseClientRequestContext(params.requestContext);
    return this.request(`/api/workflows/${this.workflowId}/restart?runId=${this.runId}`, {
      method: 'POST',
      body: {
        requestContext,
        tracingOptions: params.tracingOptions,
      },
    });
  }

  /**
   * Restarts an active workflow run asynchronously
   * @param params - optional object containing the requestContext
   * @returns Promise containing the workflow restart results
   */
  restartAsync(params?: {
    requestContext?: RequestContext | Record<string, any>;
    tracingOptions?: TracingOptions;
  }): Promise<WorkflowRunResult> {
    const requestContext = parseClientRequestContext(params?.requestContext);
    return this.request<WorkflowRunResult>(`/api/workflows/${this.workflowId}/restart-async?runId=${this.runId}`, {
      method: 'POST',
      body: {
        requestContext,
        tracingOptions: params?.tracingOptions,
      },
    }).then(deserializeWorkflowError);
  }

  /**
   * Time travels a workflow run synchronously without waiting for the workflow to complete
   * @param params - Object containing the step, inputData, resumeData, initialState, context, nestedStepsContext, requestContext and tracingOptions
   * @returns Promise containing success message
   */
  timeTravel({ requestContext: paramsRequestContext, ...params }: TimeTravelParams): Promise<{ message: string }> {
    const requestContext = parseClientRequestContext(paramsRequestContext);
    return this.request(`/api/workflows/${this.workflowId}/time-travel?runId=${this.runId}`, {
      method: 'POST',
      body: {
        ...params,
        requestContext,
      },
    });
  }

  /**
   * Time travels a workflow run asynchronously
   * @param params - Object containing the step, inputData, resumeData, initialState, context, nestedStepsContext, requestContext and tracingOptions
   * @returns Promise containing the workflow time travel results
   */
  timeTravelAsync({ requestContext: paramsRequestContext, ...params }: TimeTravelParams): Promise<WorkflowRunResult> {
    const requestContext = parseClientRequestContext(paramsRequestContext);
    return this.request<WorkflowRunResult>(`/api/workflows/${this.workflowId}/time-travel-async?runId=${this.runId}`, {
      method: 'POST',
      body: {
        ...params,
        requestContext,
      },
    }).then(deserializeWorkflowError);
  }

  /**
   * Time travels a workflow run and returns a stream
   * @param params - Object containing the step, inputData, resumeData, initialState, context, nestedStepsContext, requestContext and tracingOptions
   * @returns Promise containing the workflow execution results
   */
  async timeTravelStream({ requestContext: paramsRequestContext, ...params }: TimeTravelParams) {
    const requestContext = parseClientRequestContext(paramsRequestContext);
    const response: Response = await this.request(
      `/api/workflows/${this.workflowId}/time-travel-stream?runId=${this.runId}`,
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
