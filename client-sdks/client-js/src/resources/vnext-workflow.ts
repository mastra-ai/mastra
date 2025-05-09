import { RuntimeContext } from '@mastra/core/runtime-context';
import type {
  ClientOptions,
  GetVNextWorkflowResponse,
  GetWorkflowRunsParams,
  GetWorkflowRunsResponse,
  VNextWorkflowRunResult,
  VNextWorkflowWatchResult,
} from '../types';

import { BaseResource } from './base';

const RECORD_SEPARATOR = '\x1E';

export class VNextWorkflow extends BaseResource {
  constructor(
    options: ClientOptions,
    private workflowId: string,
  ) {
    super(options);
  }

  /**
   * Creates an async generator that processes a readable stream and yields vNext workflow records
   * separated by the Record Separator character (\x1E)
   *
   * @param stream - The readable stream to process
   * @returns An async generator that yields parsed records
   */
  private async *streamProcessor(stream: ReadableStream): AsyncGenerator<VNextWorkflowWatchResult, void, unknown> {
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
   * Retrieves details about the vNext workflow
   * @returns Promise containing vNext workflow details including steps and graphs
   */
  details(): Promise<GetVNextWorkflowResponse> {
    return this.request(`/api/workflows/v-next/${this.workflowId}`);
  }

  /**
   * Retrieves all runs for a vNext workflow
   * @param params - Parameters for filtering runs
   * @returns Promise containing vNext workflow runs array
   */
  runs(params?: GetWorkflowRunsParams): Promise<GetWorkflowRunsResponse> {
    const searchParams = new URLSearchParams();
    if (params?.fromDate) {
      searchParams.set('fromDate', params.fromDate.toISOString());
    }
    if (params?.toDate) {
      searchParams.set('toDate', params.toDate.toISOString());
    }
    if (params?.limit) {
      searchParams.set('limit', String(params.limit));
    }
    if (params?.offset) {
      searchParams.set('offset', String(params.offset));
    }
    if (params?.resourceId) {
      searchParams.set('resourceId', params.resourceId);
    }

    if (searchParams.size) {
      return this.request(`/api/workflows/v-next/${this.workflowId}/runs?${searchParams}`);
    } else {
      return this.request(`/api/workflows/v-next/${this.workflowId}/runs`);
    }
  }

  /**
   * Creates a new vNext workflow run
   * @param params - Optional object containing the optional runId
   * @returns Promise containing the runId of the created run
   */
  createRun(params?: { runId?: string }): Promise<{ runId: string }> {
    const searchParams = new URLSearchParams();

    if (!!params?.runId) {
      searchParams.set('runId', params.runId);
    }

    return this.request(`/api/workflows/v-next/${this.workflowId}/create-run?${searchParams.toString()}`, {
      method: 'POST',
    });
  }

  /**
   * Starts a vNext workflow run synchronously without waiting for the workflow to complete
   * @param params - Object containing the runId, inputData and runtimeContext
   * @returns Promise containing success message
   */
  start(params: {
    runId: string;
    inputData: Record<string, any>;
    runtimeContext?: RuntimeContext;
  }): Promise<{ message: string }> {
    const runtimeContext = params.runtimeContext ? Object.fromEntries(params.runtimeContext.entries()) : undefined;
    return this.request(`/api/workflows/v-next/${this.workflowId}/start?runId=${params.runId}`, {
      method: 'POST',
      body: { inputData: params?.inputData, runtimeContext },
    });
  }

  /**
   * Resumes a suspended vNext workflow step synchronously without waiting for the vNext workflow to complete
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
    runtimeContext?: RuntimeContext;
  }): Promise<{ message: string }> {
    const runtimeContext = rest.runtimeContext ? Object.fromEntries(rest.runtimeContext.entries()) : undefined;
    return this.request(`/api/workflows/v-next/${this.workflowId}/resume?runId=${runId}`, {
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
   * Starts a vNext workflow run asynchronously and returns a promise that resolves when the vNext workflow is complete
   * @param params - Object containing the optional runId, inputData and runtimeContext
   * @returns Promise containing the vNext workflow execution results
   */
  startAsync(params: {
    runId?: string;
    inputData: Record<string, any>;
    runtimeContext?: RuntimeContext;
  }): Promise<VNextWorkflowRunResult> {
    const searchParams = new URLSearchParams();

    if (!!params?.runId) {
      searchParams.set('runId', params.runId);
    }

    const runtimeContext = params.runtimeContext ? Object.fromEntries(params.runtimeContext.entries()) : undefined;
    return this.request(`/api/workflows/v-next/${this.workflowId}/start-async?${searchParams.toString()}`, {
      method: 'POST',
      body: { inputData: params.inputData, runtimeContext },
    });
  }

  /**
   * Resumes a suspended vNext workflow step asynchronously and returns a promise that resolves when the vNext workflow is complete
   * @param params - Object containing the runId, step, resumeData and runtimeContext
   * @returns Promise containing the vNext workflow resume results
   */
  resumeAsync(params: {
    runId: string;
    step: string | string[];
    resumeData?: Record<string, any>;
    runtimeContext?: RuntimeContext;
  }): Promise<VNextWorkflowRunResult> {
    const runtimeContext = params.runtimeContext ? Object.fromEntries(params.runtimeContext.entries()) : undefined;
    return this.request(`/api/workflows/v-next/${this.workflowId}/resume-async?runId=${params.runId}`, {
      method: 'POST',
      body: {
        step: params.step,
        resumeData: params.resumeData,
        runtimeContext,
      },
    });
  }

  /**
   * Watches vNext workflow transitions in real-time
   * @param runId - Optional run ID to filter the watch stream
   * @returns AsyncGenerator that yields parsed records from the vNext workflow watch stream
   */
  async watch({ runId }: { runId?: string }, onRecord: (record: VNextWorkflowWatchResult) => void) {
    const response: Response = await this.request(`/api/workflows/v-next/${this.workflowId}/watch?runId=${runId}`, {
      stream: true,
    });

    if (!response.ok) {
      throw new Error(`Failed to watch vNext workflow: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    for await (const record of this.streamProcessor(response.body)) {
      onRecord(record);
    }
  }
}
