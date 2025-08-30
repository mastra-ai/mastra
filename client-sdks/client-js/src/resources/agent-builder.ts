import type { RuntimeContext } from '@mastra/core/runtime-context';
import type { WorkflowInfo } from '@mastra/core/workflows';
import type { ClientOptions } from '../types';
import { parseClientRuntimeContext } from '../utils';
import { BaseResource } from './base';

const RECORD_SEPARATOR = '\x1E';

export interface AgentBuilderActionRequest {
  /** Input data specific to the workflow type */
  inputData: any;
  /** Runtime context for the action execution */
  runtimeContext?: RuntimeContext;
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

  /**
   * Creates a new agent builder action run and returns the runId.
   * This calls `/api/agent-builder/:actionId/create-run`.
   */
  async createRun(params: AgentBuilderActionRequest, runId?: string): Promise<{ runId: string }> {
    const searchParams = new URLSearchParams();
    if (runId) {
      searchParams.set('runId', runId);
    }

    const runtimeContext = parseClientRuntimeContext(params.runtimeContext);
    const { runtimeContext: _, ...actionParams } = params;

    const url = `/api/agent-builder/${this.actionId}/create-run${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    return this.request(url, {
      method: 'POST',
      body: { ...actionParams, runtimeContext },
    });
  }

  /**
   * Starts agent builder action asynchronously and waits for completion.
   * This calls `/api/agent-builder/:actionId/start-async`.
   */
  async startAsync(params: AgentBuilderActionRequest, runId?: string): Promise<AgentBuilderActionResult> {
    const searchParams = new URLSearchParams();
    if (runId) {
      searchParams.set('runId', runId);
    }

    const runtimeContext = parseClientRuntimeContext(params.runtimeContext);
    const { runtimeContext: _, ...actionParams } = params;

    const url = `/api/agent-builder/${this.actionId}/start-async${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    const result = await this.request(url, {
      method: 'POST',
      body: { ...actionParams, runtimeContext },
    });

    return this.transformWorkflowResult(result);
  }

  /**
   * Starts an existing agent builder action run.
   * This calls `/api/agent-builder/:actionId/start`.
   */
  async startActionRun(params: AgentBuilderActionRequest, runId: string): Promise<{ message: string }> {
    const searchParams = new URLSearchParams();
    searchParams.set('runId', runId);

    const runtimeContext = parseClientRuntimeContext(params.runtimeContext);
    const { runtimeContext: _, ...actionParams } = params;

    const url = `/api/agent-builder/${this.actionId}/start?${searchParams.toString()}`;
    return this.request(url, {
      method: 'POST',
      body: { ...actionParams, runtimeContext },
    });
  }

  /**
   * Resumes a suspended agent builder action step.
   * This calls `/api/agent-builder/:actionId/resume`.
   */
  async resume(
    params: {
      step: string | string[];
      resumeData?: unknown;
      runtimeContext?: RuntimeContext;
    },
    runId: string,
  ): Promise<{ message: string }> {
    const searchParams = new URLSearchParams();
    searchParams.set('runId', runId);

    const runtimeContext = parseClientRuntimeContext(params.runtimeContext);
    const { runtimeContext: _, ...resumeParams } = params;

    const url = `/api/agent-builder/${this.actionId}/resume?${searchParams.toString()}`;
    return this.request(url, {
      method: 'POST',
      body: { ...resumeParams, runtimeContext },
    });
  }

  /**
   * Resumes a suspended agent builder action step asynchronously.
   * This calls `/api/agent-builder/:actionId/resume-async`.
   */
  async resumeAsync(
    params: {
      step: string | string[];
      resumeData?: unknown;
      runtimeContext?: RuntimeContext;
    },
    runId: string,
  ): Promise<AgentBuilderActionResult> {
    const searchParams = new URLSearchParams();
    searchParams.set('runId', runId);

    const runtimeContext = parseClientRuntimeContext(params.runtimeContext);
    const { runtimeContext: _, ...resumeParams } = params;

    const url = `/api/agent-builder/${this.actionId}/resume-async?${searchParams.toString()}`;
    const result = await this.request(url, {
      method: 'POST',
      body: { ...resumeParams, runtimeContext },
    });

    return this.transformWorkflowResult(result);
  }

  /**
   * Creates an async generator that processes a readable stream and yields action records
   * separated by the Record Separator character (\x1E)
   *
   * @param stream - The readable stream to process
   * @returns An async generator that yields parsed records
   */
  private async *streamProcessor(
    stream: ReadableStream,
  ): AsyncGenerator<{ type: string; payload: any }, void, unknown> {
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
   * Streams agent builder action progress in real-time.
   * This calls `/api/agent-builder/:actionId/stream`.
   */
  async stream(params: AgentBuilderActionRequest, runId?: string) {
    const searchParams = new URLSearchParams();
    if (runId) {
      searchParams.set('runId', runId);
    }

    const runtimeContext = parseClientRuntimeContext(params.runtimeContext);
    const { runtimeContext: _, ...actionParams } = params;

    const url = `/api/agent-builder/${this.actionId}/stream${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    const response: Response = await this.request(url, {
      method: 'POST',
      body: { ...actionParams, runtimeContext },
      stream: true,
    });

    if (!response.ok) {
      throw new Error(`Failed to stream agent builder action: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    let failedChunk: string | undefined = undefined;

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
   * Streams agent builder action progress in real-time using VNext streaming.
   * This calls `/api/agent-builder/:actionId/streamVNext`.
   */
  async streamVNext(params: AgentBuilderActionRequest, runId?: string) {
    const searchParams = new URLSearchParams();
    if (runId) {
      searchParams.set('runId', runId);
    }

    const runtimeContext = parseClientRuntimeContext(params.runtimeContext);
    const { runtimeContext: _, ...actionParams } = params;

    const url = `/api/agent-builder/${this.actionId}/streamVNext${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    const response: Response = await this.request(url, {
      method: 'POST',
      body: { ...actionParams, runtimeContext },
      stream: true,
    });

    if (!response.ok) {
      throw new Error(`Failed to stream agent builder action VNext: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    let failedChunk: string | undefined = undefined;

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
   * Watches an existing agent builder action run by runId.
   * This is used for hot reload recovery - it loads the existing run state
   * and streams any remaining progress.
   * This calls `/api/agent-builder/:actionId/watch`.
   */
  async watch({ runId }: { runId: string }, onRecord: (record: { type: string; payload: any }) => void) {
    const url = `/api/agent-builder/${this.actionId}/watch?runId=${runId}`;
    const response: Response = await this.request(url, {
      method: 'GET',
      stream: true,
    });

    if (!response.ok) {
      throw new Error(`Failed to watch agent builder action: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    // Use the exact same stream processing as workflows
    for await (const record of this.streamProcessor(response.body)) {
      if (typeof record === 'string') {
        onRecord(JSON.parse(record));
      } else {
        onRecord(record);
      }
    }
  }

  /**
   * Gets a specific action run by its ID.
   * This calls `/api/agent-builder/:actionId/runs/:runId`.
   */
  async runById(runId: string) {
    const url = `/api/agent-builder/${this.actionId}/runs/${runId}`;
    return this.request(url, {
      method: 'GET',
    });
  }

  /**
   * Gets details about this agent builder action.
   * This calls `/api/agent-builder/:actionId`.
   */
  async details(): Promise<WorkflowInfo> {
    const result = await this.request<WorkflowInfo>(`/api/agent-builder/${this.actionId}`);
    return result;
  }

  /**
   * Gets all runs for this agent builder action.
   * This calls `/api/agent-builder/:actionId/runs`.
   */
  async runs(params?: { fromDate?: Date; toDate?: Date; limit?: number; offset?: number; resourceId?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.fromDate) {
      searchParams.set('fromDate', params.fromDate.toISOString());
    }
    if (params?.toDate) {
      searchParams.set('toDate', params.toDate.toISOString());
    }
    if (params?.limit !== undefined) {
      searchParams.set('limit', String(params.limit));
    }
    if (params?.offset !== undefined) {
      searchParams.set('offset', String(params.offset));
    }
    if (params?.resourceId) {
      searchParams.set('resourceId', params.resourceId);
    }

    const url = `/api/agent-builder/${this.actionId}/runs${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    return this.request(url, {
      method: 'GET',
    });
  }

  /**
   * Gets the execution result of an agent builder action run.
   * This calls `/api/agent-builder/:actionId/runs/:runId/execution-result`.
   */
  async runExecutionResult(runId: string) {
    const url = `/api/agent-builder/${this.actionId}/runs/${runId}/execution-result`;
    return this.request(url, {
      method: 'GET',
    });
  }

  /**
   * Cancels an agent builder action run.
   * This calls `/api/agent-builder/:actionId/runs/:runId/cancel`.
   */
  async cancelRun(runId: string): Promise<{ message: string }> {
    const url = `/api/agent-builder/${this.actionId}/runs/${runId}/cancel`;
    return this.request(url, {
      method: 'POST',
    });
  }

  /**
   * Sends an event to an agent builder action run.
   * This calls `/api/agent-builder/:actionId/runs/:runId/send-event`.
   */
  async sendRunEvent(params: { runId: string; event: string; data: unknown }): Promise<{ message: string }> {
    const url = `/api/agent-builder/${this.actionId}/runs/${params.runId}/send-event`;
    return this.request(url, {
      method: 'POST',
      body: { event: params.event, data: params.data },
    });
  }
}
