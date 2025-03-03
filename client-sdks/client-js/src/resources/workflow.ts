import type { GetWorkflowResponse, ClientOptions, GetWorkflowWatchResponse } from '../types';

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
  resume({
    stepId,
    runId,
    context,
  }: {
    stepId: string;
    runId: string;
    context: Record<string, any>;
  }): Promise<Record<string, any>> {
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
   * Creates an async generator that processes a readable stream and yields records
   * separated by the Record Separator character (\x1E)
   *
   * @param stream - The readable stream to process
   * @returns An async generator that yields parsed records
   */
  private async *streamProcessor(stream: ReadableStream): AsyncGenerator<GetWorkflowWatchResponse, void, unknown> {
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
              yield parsedRecord;
            } catch (e) {
              throw new Error(`Could not parse record: ${record}`);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Watches workflow transitions in real-time
   * @returns AsyncGenerator that yields parsed records from the workflow watch stream
   */
  async *watch() {
    const response: Response = await this.request(`/api/workflows/${this.workflowId}/watch`, {
      stream: true,
    });

    if (!response.ok) {
      throw new Error(`Failed to watch workflow: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    yield* this.streamProcessor(response.body);
  }
}
