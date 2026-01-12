import type { StreamVNextChunkType } from '@mastra/client-js';
import { mapWorkflowStreamChunkToWatchResult } from '../lib/ai-sdk';
import type { StreamOperation, WorkflowStreamResult, WorkflowStreamReader } from './types';

export interface ProcessStreamOptions {
  stream: { getReader(): WorkflowStreamReader };
  onChunk: (updater: (prev: WorkflowStreamResult) => WorkflowStreamResult) => void;
  onStreamingChange: (isStreaming: boolean) => void;
  onError?: (error: Error, context: { operation: StreamOperation }) => void;
  isMounted: () => boolean;
  operation: StreamOperation;
}

export interface ProcessStreamResult {
  reader: WorkflowStreamReader;
}

/**
 * Processes a workflow stream, reading chunks and updating state.
 * This extracts the common stream reading logic used across all stream operations.
 */
export async function processWorkflowStream({
  stream,
  onChunk,
  onStreamingChange,
  onError,
  isMounted,
  operation,
}: ProcessStreamOptions): Promise<ProcessStreamResult> {
  const reader = stream.getReader();

  try {
    while (true) {
      if (!isMounted()) break;

      const { done, value } = await reader.read();
      if (done || !value) break;

      if (isMounted()) {
        onChunk(prev => mapWorkflowStreamChunkToWatchResult(prev, value));

        if (value.type === 'workflow-step-start') {
          onStreamingChange(true);
        }

        if (value.type === 'workflow-step-suspended') {
          onStreamingChange(false);
        }

        if (value.type === 'workflow-finish') {
          const status = value.payload?.workflowStatus;
          onChunk(prev => ({ ...prev, status }));

          if (status === 'failed') {
            const errorMessage = value.payload?.metadata?.errorMessage || 'Workflow execution failed';
            throw new Error(errorMessage);
          }
        }
      }
    }
  } catch (err) {
    // TypeError during cleanup is expected when component unmounts
    if (!(err instanceof TypeError)) {
      const error = err instanceof Error ? err : new Error(String(err));
      onError?.(error, { operation });
    }
  } finally {
    if (isMounted()) {
      onStreamingChange(false);
    }
    try {
      reader.releaseLock();
    } catch {
      // Already released
    }
  }

  return { reader };
}
