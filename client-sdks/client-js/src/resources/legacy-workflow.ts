import type {
  ClientOptions,
  LegacyWorkflowRunResult,
  GetLegacyWorkflowRunsResponse,
  GetWorkflowRunsParams,
  GetLegacyWorkflowResponse,
} from '../types';

import { BaseResource } from './base';

const RECORD_SEPARATOR = '\x1E';

export class LegacyWorkflow extends BaseResource {
  constructor(
    options: ClientOptions,
    private workflowId: string,
  ) {
    super(options);
  }

  /**
   * Retrieves details about the legacy workflow
   * @returns Promise containing legacy workflow details including steps and graphs
   */
  details(): Promise<GetLegacyWorkflowResponse> {
    return this.request(`/api/workflows/legacy/${this.workflowId}`);
  }

  /**
   * Retrieves all runs for a legacy workflow
   * @param params - Parameters for filtering runs
   * @returns Promise containing legacy workflow runs array
   */
  runs(params?: GetWorkflowRunsParams): Promise<GetLegacyWorkflowRunsResponse> {
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
      return this.request(`/api/workflows/legacy/${this.workflowId}/runs?${searchParams}`);
    } else {
      return this.request(`/api/workflows/legacy/${this.workflowId}/runs`);
    }
  }

  /**
   * Creates a new legacy workflow run
   * @returns Promise containing the generated run ID
   */
  createRun(params?: { runId?: string }): Promise<{ runId: string }> {
    const searchParams = new URLSearchParams();

    if (!!params?.runId) {
      searchParams.set('runId', params.runId);
    }

    return this.request(`/api/workflows/legacy/${this.workflowId}/create-run?${searchParams.toString()}`, {
      method: 'POST',
    });
  }

  /**
   * Starts a legacy workflow run synchronously without waiting for the workflow to complete
   * @param params - Object containing the runId and triggerData
   * @returns Promise containing success message
   */
  start(params: { runId: string; triggerData: Record<string, any> }): Promise<{ message: string }> {
    return this.request(`/api/workflows/legacy/${this.workflowId}/start?runId=${params.runId}`, {
      method: 'POST',
      body: params?.triggerData,
    });
  }

  /**
   * Resumes a suspended legacy workflow step synchronously without waiting for the workflow to complete
   * @param stepId - ID of the step to resume
   * @param runId - ID of the legacy workflow run
   * @param context - Context to resume the legacy workflow with
   * @returns Promise containing the legacy workflow resume results
   */
  resume({
    stepId,
    runId,
    context,
  }: {
    stepId: string;
    runId: string;
    context: Record<string, any>;
  }): Promise<{ message: string }> {
    return this.request(`/api/workflows/legacy/${this.workflowId}/resume?runId=${runId}`, {
      method: 'POST',
      body: {
        stepId,
        context,
      },
    });
  }

  /**
   * Starts a workflow run asynchronously and returns a promise that resolves when the workflow is complete
   * @param params - Object containing the optional runId and triggerData
   * @returns Promise containing the workflow execution results
   */
  startAsync(params: { runId?: string; triggerData: Record<string, any> }): Promise<LegacyWorkflowRunResult> {
    const searchParams = new URLSearchParams();

    if (!!params?.runId) {
      searchParams.set('runId', params.runId);
    }

    return this.request(`/api/workflows/legacy/${this.workflowId}/start-async?${searchParams.toString()}`, {
      method: 'POST',
      body: params?.triggerData,
    });
  }

  /**
   * Resumes a suspended legacy workflow step asynchronously and returns a promise that resolves when the workflow is complete
   * @param params - Object containing the runId, stepId, and context
   * @returns Promise containing the workflow resume results
   */
  resumeAsync(params: {
    runId: string;
    stepId: string;
    context: Record<string, any>;
  }): Promise<LegacyWorkflowRunResult> {
    return this.request(`/api/workflows/legacy/${this.workflowId}/resume-async?runId=${params.runId}`, {
      method: 'POST',
      body: {
        stepId: params.stepId,
        context: params.context,
      },
    });
  }

  /**
   * Creates an async generator that processes a readable stream and yields records
   * separated by the Record Separator character (\x1E)
   *
   * @param stream - The readable stream to process
   * @returns An async generator that yields parsed records
   */
  private async *streamProcessor(stream: ReadableStream): AsyncGenerator<LegacyWorkflowRunResult, void, unknown> {
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
   * Watches legacy workflow transitions in real-time
   * @param runId - Optional run ID to filter the watch stream
   * @returns AsyncGenerator that yields parsed records from the legacy workflow watch stream
   */
  async watch({ runId }: { runId?: string }, onRecord: (record: LegacyWorkflowRunResult) => void) {
    const response: Response = await this.request(`/api/workflows/legacy/${this.workflowId}/watch?runId=${runId}`, {
      stream: true,
    });

    if (!response.ok) {
      throw new Error(`Failed to watch legacy workflow: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    for await (const record of this.streamProcessor(response.body)) {
      onRecord(record);
    }
  }
}
