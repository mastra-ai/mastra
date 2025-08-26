import type { RuntimeContext } from '@mastra/core/runtime-context';
import type {
  ClientOptions,
  GetWorkflowResponse,
  GetWorkflowRunsResponse,
  GetWorkflowRunsParams,
  WorkflowRunResult,
  WorkflowWatchResult,
  GetWorkflowRunByIdResponse,
  GetWorkflowRunExecutionResultResponse,
} from '../types';

import { parseClientRuntimeContext } from '../utils';
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
   * Creates an async generator that processes a readable stream and yields workflow records
   * separated by the Record Separator character (\x1E)
   *
   * @param stream - The readable stream to process
   * @returns An async generator that yields parsed records
   */
  private async *streamProcessor(stream: ReadableStream): AsyncGenerator<WorkflowWatchResult, void, unknown> {
    const reader = stream.getReader();

    // Track if we've finished reading from the stream
    let doneReading = false;
    // Buffer to accumulate partial chunks
    let buffer = '';

    try {
      while (!doneReading) {
        // Read the next chunk from the stream
        const { done, value } = await reader.read();
        doneReading = done;

        // Skip processing if we're done and there's no value
        if (done && !value) continue;

        try {
          // Decode binary data to text
          const decoded = value ? new TextDecoder().decode(value) : '';

          // Split the combined buffer and new data by record separator
          const chunks = (buffer + decoded).split(RECORD_SEPARATOR);

          // The last chunk might be incomplete, so save it for the next iteration
          buffer = chunks.pop() || '';

          // Process complete chunks
          for (const chunk of chunks) {
            if (chunk) {
              // Only process non-empty chunks
              if (typeof chunk === 'string') {
                try {
                  const parsedChunk = JSON.parse(chunk);
                  yield parsedChunk;
                } catch {
                  // Silently ignore parsing errors to maintain stream processing
                  // This allows the stream to continue even if one record is malformed
                }
              }
            }
          }
        } catch {
          // Silently ignore parsing errors to maintain stream processing
          // This allows the stream to continue even if one record is malformed
        }
      }

      // Process any remaining data in the buffer after stream is done
      if (buffer) {
        try {
          yield JSON.parse(buffer);
        } catch {
          // Ignore parsing error for final chunk
        }
      }
    } finally {
      // Always ensure we clean up the reader
      reader.cancel().catch(() => {
        // Ignore cancel errors
      });
    }
  }

  /**
   * Retrieves details about the workflow
   * @returns Promise containing workflow details including steps and graphs
   */
  details(): Promise<GetWorkflowResponse> {
    return this.request(`/api/workflows/${this.workflowId}`);
  }

  /**
   * Retrieves all runs for a workflow
   * @param params - Parameters for filtering runs
   * @returns Promise containing workflow runs array
   */
  runs(params?: GetWorkflowRunsParams): Promise<GetWorkflowRunsResponse> {
    const searchParams = new URLSearchParams();
    if (params?.fromDate) {
      searchParams.set('fromDate', params.fromDate.toISOString());
    }
    if (params?.toDate) {
      searchParams.set('toDate', params.toDate.toISOString());
    }
    if (params?.limit !== null && params?.limit !== undefined && !isNaN(Number(params?.limit))) {
      searchParams.set('limit', String(params.limit));
    }
    if (params?.offset !== null && params?.offset !== undefined && !isNaN(Number(params?.offset))) {
      searchParams.set('offset', String(params.offset));
    }
    if (params?.resourceId) {
      searchParams.set('resourceId', params.resourceId);
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
   * @returns Promise containing the workflow run details
   */
  runById(runId: string): Promise<GetWorkflowRunByIdResponse> {
    return this.request(`/api/workflows/${this.workflowId}/runs/${runId}`);
  }

  /**
   * Retrieves the execution result for a specific workflow run by its ID
   * @param runId - The ID of the workflow run to retrieve the execution result for
   * @returns Promise containing the workflow run execution result
   */
  runExecutionResult(runId: string): Promise<GetWorkflowRunExecutionResultResponse> {
    return this.request(`/api/workflows/${this.workflowId}/runs/${runId}/execution-result`);
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
   * Sends an event to a specific workflow run by its ID
   * @param params - Object containing the runId, event and data
   * @returns Promise containing a success message
   */
  sendRunEvent(params: { runId: string; event: string; data: unknown }): Promise<{ message: string }> {
    return this.request(`/api/workflows/${this.workflowId}/runs/${params.runId}/send-event`, {
      method: 'POST',
      body: { event: params.event, data: params.data },
    });
  }

  /**
   * Creates a new workflow run
   * @param params - Optional object containing the optional runId
   * @returns Promise containing the runId of the created run
   */
  createRun(params?: { runId?: string }): Promise<{ runId: string }> {
    const searchParams = new URLSearchParams();

    if (!!params?.runId) {
      searchParams.set('runId', params.runId);
    }

    return this.request(`/api/workflows/${this.workflowId}/create-run?${searchParams.toString()}`, {
      method: 'POST',
    });
  }

  /**
   * Creates a new workflow run (alias for createRun)
   * @param params - Optional object containing the optional runId
   * @returns Promise containing the runId of the created run
   */
  createRunAsync(params?: { runId?: string }): Promise<{ runId: string }> {
    return this.createRun(params);
  }

  /**
   * Starts a workflow run synchronously without waiting for the workflow to complete
   * @param params - Object containing the runId, inputData and runtimeContext
   * @returns Promise containing success message
   */
  start(params: {
    runId: string;
    inputData: Record<string, any>;
    runtimeContext?: RuntimeContext | Record<string, any>;
  }): Promise<{ message: string }> {
    const runtimeContext = parseClientRuntimeContext(params.runtimeContext);
    return this.request(`/api/workflows/${this.workflowId}/start?runId=${params.runId}`, {
      method: 'POST',
      body: { inputData: params?.inputData, runtimeContext },
    });
  }

  /**
   * Resumes a suspended workflow step synchronously without waiting for the workflow to complete
   * @param params - Object containing the runId, step, resumeData and runtimeContext
   * @returns Promise containing success message
   */
  resume({
    step,
    runId,
    resumeData,
    ...rest
  }: {
    step: string | string[];
    runId: string;
    resumeData?: Record<string, any>;
    runtimeContext?: RuntimeContext | Record<string, any>;
  }): Promise<{ message: string }> {
    const runtimeContext = parseClientRuntimeContext(rest.runtimeContext);
    return this.request(`/api/workflows/${this.workflowId}/resume?runId=${runId}`, {
      method: 'POST',
      stream: true,
      body: {
        step,
        resumeData,
        runtimeContext,
      },
    });
  }

  /**
   * Starts a workflow run asynchronously and returns a promise that resolves when the workflow is complete
   * @param params - Object containing the optional runId, inputData and runtimeContext
   * @returns Promise containing the workflow execution results
   */
  startAsync(params: {
    runId?: string;
    inputData: Record<string, any>;
    runtimeContext?: RuntimeContext | Record<string, any>;
  }): Promise<WorkflowRunResult> {
    const searchParams = new URLSearchParams();

    if (!!params?.runId) {
      searchParams.set('runId', params.runId);
    }

    const runtimeContext = parseClientRuntimeContext(params.runtimeContext);

    return this.request(`/api/workflows/${this.workflowId}/start-async?${searchParams.toString()}`, {
      method: 'POST',
      body: { inputData: params.inputData, runtimeContext },
    });
  }

  /**
   * Starts a workflow run and returns a stream
   * @param params - Object containing the optional runId, inputData and runtimeContext
   * @returns Promise containing the workflow execution results
   */
  async stream(params: { runId?: string; inputData: Record<string, any>; runtimeContext?: RuntimeContext }) {
    const searchParams = new URLSearchParams();

    if (!!params?.runId) {
      searchParams.set('runId', params.runId);
    }

    const runtimeContext = parseClientRuntimeContext(params.runtimeContext);
    const response: Response = await this.request(
      `/api/workflows/${this.workflowId}/stream?${searchParams.toString()}`,
      {
        method: 'POST',
        body: { inputData: params.inputData, runtimeContext },
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
   * Resumes a suspended workflow step asynchronously and returns a promise that resolves when the workflow is complete
   * @param params - Object containing the runId, step, resumeData and runtimeContext
   * @returns Promise containing the workflow resume results
   */
  resumeAsync(params: {
    runId: string;
    step: string | string[];
    resumeData?: Record<string, any>;
    runtimeContext?: RuntimeContext | Record<string, any>;
  }): Promise<WorkflowRunResult> {
    const runtimeContext = parseClientRuntimeContext(params.runtimeContext);
    return this.request(`/api/workflows/${this.workflowId}/resume-async?runId=${params.runId}`, {
      method: 'POST',
      body: {
        step: params.step,
        resumeData: params.resumeData,
        runtimeContext,
      },
    });
  }

  /**
   * Watches workflow transitions in real-time
   * @param runId - Optional run ID to filter the watch stream
   * @returns AsyncGenerator that yields parsed records from the workflow watch stream
   */
  async watch({ runId }: { runId?: string }, onRecord: (record: WorkflowWatchResult) => void) {
    const response: Response = await this.request(`/api/workflows/${this.workflowId}/watch?runId=${runId}`, {
      stream: true,
    });

    if (!response.ok) {
      throw new Error(`Failed to watch workflow: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    for await (const record of this.streamProcessor(response.body)) {
      if (typeof record === 'string') {
        onRecord(JSON.parse(record));
      } else {
        onRecord(record);
      }
    }
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
