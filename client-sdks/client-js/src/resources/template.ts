import { BaseResource } from './base';
import type { ClientOptions, TemplateInstallationRequest, TemplateInstallationResult } from '../types';
import type { RuntimeContext } from '@mastra/core/runtime-context';
import { parseClientRuntimeContext } from '../utils';

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
}
