import type { GetWorkflowResponse, ClientOptions, WorkflowRunResult } from '../types';

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
  execute(params: Record<string, any>): Promise<WorkflowRunResult> {
    return this.request(`/api/workflows/${this.workflowId}/execute`, {
      method: 'POST',
      body: params,
    });
  }

  /**
   * Creates a new workflow run
   * @returns Promise containing the generated run ID
   */
  createRun(params?: { runId?: string }): Promise<{ runId: string }> {
    const searchParams = new URLSearchParams();

    if (!!params?.runId) {
      searchParams.set('runId', params.runId);
    }

    return this.request(`/api/workflows/${this.workflowId}/createRun?${searchParams.toString()}`, {
      method: 'POST',
    });
  }

  /**
   * Starts a workflow run synchronously without waiting for the workflow to complete
   * @param params - Object containing the runId and triggerData
   * @returns Promise containing success message
   */
  start(params: { runId: string; triggerData: Record<string, any> }): Promise<{ message: string }> {
    return this.request(`/api/workflows/${this.workflowId}/start?runId=${params.runId}`, {
      method: 'POST',
      body: params?.triggerData,
    });
  }

  /**
   * Resumes a suspended workflow step synchronously without waiting for the workflow to complete
   * @param stepId - ID of the step to resume
   * @param runId - ID of the workflow run
   * @param context - Context to resume the workflow with
   * @returns Promise containing the workflow resume results
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
    return this.request(`/api/workflows/${this.workflowId}/resume?runId=${runId}`, {
      method: 'POST',
      body: {
        stepId,
        context,
      },
    });
  }

  /**
   * Starts a workflow run asynchronously and returns a promise that resolves when the workflow is complete
   * @param params - Object containing the runId and triggerData
   * @returns Promise containing the workflow execution results
   */
  startAsync(params: { runId: string; triggerData: Record<string, any> }): Promise<WorkflowRunResult> {
    return this.request(`/api/workflows/${this.workflowId}/startAsync?runId=${params.runId}`, {
      method: 'POST',
      body: params?.triggerData,
    });
  }

  /**
   * Resumes a suspended workflow step asynchronously and returns a promise that resolves when the workflow is complete
   * @param params - Object containing the runId, stepId, and context
   * @returns Promise containing the workflow resume results
   */
  resumeAsync(params: { runId: string; stepId: string; context: Record<string, any> }): Promise<WorkflowRunResult> {
    return this.request(`/api/workflows/${this.workflowId}/resumeAsync?runId=${params.runId}`, {
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
  private async *streamProcessor(stream: ReadableStream): AsyncGenerator<WorkflowRunResult, void, unknown> {
    const reader = stream.getReader();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          // Process any remaining data in buffer before finishing
          if (buffer.trim().length > 0) {
            try {
              const record = JSON.parse(buffer);
              yield record;
            } catch (e) {
              console.warn('Could not parse final buffer content:', buffer);
            }
          }
          break;
        }

        // Decode and add to buffer
        buffer += new TextDecoder().decode(value);

        // Split the buffer into records
        const records = buffer.split('\x1E');

        // Keep the last (potentially incomplete) chunk in the buffer
        buffer = records.pop() || '';

        // Process each complete record
        for (const record of records) {
          if (record.trim().length > 0) {
            try {
              // Assuming the records are JSON strings
              const parsedRecord = JSON.parse(record);

              //Check to see if all steps are completed and cancel reader
              const isWorkflowCompleted = parsedRecord?.activePaths?.every(
                (path: any) =>
                  path.status === 'completed' ||
                  path.status === 'suspended' ||
                  path.status === 'failed' ||
                  path.status === 'skipped',
              );
              if (isWorkflowCompleted) {
                reader.cancel();
              }
              yield parsedRecord;
            } catch (e) {
              throw new Error(`Could not parse record: ${record}`);
            }
          }
        }
      }
    } finally {
      reader.cancel();
    }
  }

  /**
   * Watches workflow transitions in real-time
   * @param runId - Optional run ID to filter the watch stream
   * @returns AsyncGenerator that yields parsed records from the workflow watch stream
   */
  async watch({ runId }: { runId?: string }, onRecord: (record: WorkflowRunResult) => void) {
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
      onRecord(record);
    }
  }
}
