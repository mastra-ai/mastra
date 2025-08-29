import { BaseResource } from './base';
import type { ClientOptions, TemplateInstallationRequest, TemplateInstallationResult } from '../types';
import type { RuntimeContext } from '@mastra/core/runtime-context';
import { parseClientRuntimeContext } from '../utils';
import type { WorkflowInfo } from '@mastra/core/workflows';

const RECORD_SEPARATOR = '\x1E';

/**
 * Templates resource: operations related to template management via server endpoints.
 */
export class Templates extends BaseResource {
  constructor(options: ClientOptions) {
    super(options);
  }

  // Helper function to transform workflow result to template installation result
  transformWorkflowResult(result: any): TemplateInstallationResult {
    if (result.status === 'success') {
      return {
        success: result.result.success || false,
        applied: result.result.applied || false,
        branchName: result.result.branchName,
        message: result.result.message || 'Template installation completed',
        validationResults: result.result.validationResults,
        error: result.result.error,
        errors: result.result.errors,
        stepResults: result.result.stepResults,
      };
    } else if (result.status === 'failed') {
      return {
        success: false,
        applied: false,
        message: `Template installation failed: ${result.error.message}`,
        error: result.error.message,
      };
    } else {
      return {
        success: false,
        applied: false,
        message: 'Template installation was suspended',
        error: 'Workflow suspended - manual intervention required',
      };
    }
  }

  /**
   * Creates a new template installation run and returns the runId.
   * This calls `/api/templates/:templateSlug/create-run`.
   */
  async createInstallRun(
    templateSlug: string,
    params: TemplateInstallationRequest & { runtimeContext?: RuntimeContext },
    runId?: string,
  ): Promise<{ runId: string }> {
    const searchParams = new URLSearchParams();
    if (runId) {
      searchParams.set('runId', runId);
    }

    const runtimeContext = parseClientRuntimeContext(params.runtimeContext);
    const { runtimeContext: _, ...templateParams } = params;

    const url = `/api/templates/${templateSlug}/create-run${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    return this.request(url, {
      method: 'POST',
      body: { ...templateParams, runtimeContext },
    });
  }

  /**
   * Starts template installation asynchronously and waits for completion.
   * This calls `/api/templates/:templateSlug/start-async`.
   */
  async installAsync(
    templateSlug: string,
    params: TemplateInstallationRequest & { runtimeContext?: RuntimeContext },
    runId?: string,
  ): Promise<TemplateInstallationResult> {
    const searchParams = new URLSearchParams();
    if (runId) {
      searchParams.set('runId', runId);
    }

    const runtimeContext = parseClientRuntimeContext(params.runtimeContext);
    const { runtimeContext: _, ...templateParams } = params;

    const url = `/api/templates/${templateSlug}/start-async${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    const result = await this.request(url, {
      method: 'POST',
      body: { ...templateParams, runtimeContext },
    });

    return this.transformWorkflowResult(result);
  }

  /**
   * Creates an async generator that processes a readable stream and yields template records
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
   * Streams template installation progress in real-time.
   * This calls `/api/templates/:templateSlug/stream`.
   */
  async streamInstall(
    templateSlug: string,
    params: TemplateInstallationRequest & { runtimeContext?: RuntimeContext },
    runId?: string,
  ) {
    const searchParams = new URLSearchParams();
    if (runId) {
      searchParams.set('runId', runId);
    }

    const runtimeContext = parseClientRuntimeContext(params.runtimeContext);
    const { runtimeContext: _, ...templateParams } = params;

    const url = `/api/templates/${templateSlug}/stream${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    const response: Response = await this.request(url, {
      method: 'POST',
      body: { ...templateParams, runtimeContext },
      stream: true,
    });

    if (!response.ok) {
      throw new Error(`Failed to stream template installation: ${response.statusText}`);
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
              } catch (error) {
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
   * Watches an existing template installation run by runId.
   * This is used for hot reload recovery - it loads the existing run state
   * and streams any remaining progress.
   * This calls `/api/templates/:templateSlug/watch`.
   */
  async watchInstall(
    { templateSlug, runId }: { templateSlug: string; runId: string },
    onRecord: (record: { type: string; payload: any }) => void,
  ) {
    const url = `/api/templates/${templateSlug}/watch?runId=${runId}`;
    const response: Response = await this.request(url, {
      method: 'GET',
      stream: true,
    });

    if (!response.ok) {
      throw new Error(`Failed to watch template installation: ${response.statusText}`);
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
   * Gets the current state of a template installation run by runId.
   * This calls `/api/templates/:templateSlug/runs/:runId`.
   */
  async getInstallRun(templateSlug: string, runId: string) {
    const url = `/api/templates/${templateSlug}/runs/${runId}`;
    return this.request(url, {
      method: 'GET',
    });
  }

  async getAgentBuilderWorkflow(): Promise<WorkflowInfo> {
    const result = await this.request<WorkflowInfo>('/api/templates/agent-builder-workflow');
    return result;
  }
}
