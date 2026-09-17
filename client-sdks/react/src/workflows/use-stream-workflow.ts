import type { StreamVNextChunkType } from '@mastra/client-js';
import { useState, useRef, useEffect, useCallback } from 'react';
import { mapWorkflowStreamChunkToWatchResult } from '../lib/mastra-db';
import { useMutation } from '../lib/use-mutation';
import { useMastraClient } from '../mastra-client-context';
import type {
  UseStreamWorkflowParams,
  WorkflowStreamResult,
  StreamWorkflowParams,
  ObserveWorkflowStreamParams,
  ResumeWorkflowStreamParams,
  TimeTravelWorkflowStreamParams,
} from './types';

type StreamOperation = {
  controller: AbortController;
  reader?: ReadableStreamDefaultReader<StreamVNextChunkType>;
};

export function useStreamWorkflow({ debugMode, tracingOptions, onError }: UseStreamWorkflowParams) {
  const client = useMastraClient();
  const [streamResult, setStreamResult] = useState<WorkflowStreamResult>();
  const [isStreaming, setIsStreaming] = useState(false);
  const activeStream = useRef<StreamOperation | undefined>(undefined);
  const isMountedRef = useRef(true);

  const closeActiveStream = useCallback(() => {
    const operation = activeStream.current;
    activeStream.current = undefined;
    if (!operation) return;
    operation.controller.abort();
    // An already errored transport may reject cancellation during disposal.
    void operation.reader?.cancel().catch(() => undefined);
    operation.reader?.releaseLock();
    operation.reader = undefined;
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      closeActiveStream();
    };
  }, [closeActiveStream]);

  async function consumeStream(
    openStream: (signal: AbortSignal) => Promise<ReadableStream<StreamVNextChunkType> | undefined>,
    defaultMessage: string,
  ) {
    if (!isMountedRef.current) return;
    closeActiveStream();
    const operation: StreamOperation = { controller: new AbortController() };
    activeStream.current = operation;
    const { signal } = operation.controller;
    setIsStreaming(true);

    try {
      const stream = await openStream(signal);
      if (signal.aborted) {
        await stream?.cancel();
        return;
      }
      if (!stream) {
        onError?.(new Error('No stream returned'), 'No stream returned');
        return;
      }
      const reader = stream.getReader();
      operation.reader = reader;

      while (!signal.aborted) {
        const { done, value } = await reader.read();
        if (done || signal.aborted) break;
        setStreamResult(previous => mapWorkflowStreamChunkToWatchResult(previous, value));
        if (value.type === 'workflow-step-start') setIsStreaming(true);
        if (value.type === 'workflow-step-suspended') setIsStreaming(false);
        if (value.type === 'workflow-finish' && value.payload.workflowStatus === 'failed') {
          throw new Error(value.payload.metadata?.errorMessage || 'Workflow execution failed');
        }
      }
    } catch (error) {
      // Releasing an obsolete reader rejects its pending read; real transport TypeErrors must still surface.
      if (!signal.aborted) {
        if (!operation.reader) throw error;
        onError?.(error instanceof Error ? error : new Error(defaultMessage), defaultMessage);
      }
    } finally {
      operation.reader?.releaseLock();
      operation.reader = undefined;
      if (activeStream.current === operation) {
        activeStream.current = undefined;
        setIsStreaming(false);
      }
    }
  }

  const streamWorkflow = useMutation<void, Error, StreamWorkflowParams>(
    ({ workflowId, runId, inputData, initialState, requestContext, perStep }) => {
      setStreamResult({ status: 'pending', input: inputData, steps: {} });
      return consumeStream(async signal => {
        const run = await client.getWorkflow(workflowId).createRun({ runId });
        if (signal.aborted) return;
        return run.stream({
          inputData,
          initialState,
          requestContext,
          closeOnSuspend: true,
          tracingOptions,
          perStep: perStep ?? debugMode,
        });
      }, 'Error streaming workflow');
    },
  );

  const observeWorkflowStream = useMutation<void, Error, ObserveWorkflowStreamParams>(
    async ({ workflowId, runId, storeRunResult }) => {
      if (!isMountedRef.current) return;
      setStreamResult(storeRunResult ?? undefined);
      if (storeRunResult?.status === 'suspended') {
        closeActiveStream();
        setIsStreaming(false);
        return;
      }
      await consumeStream(async signal => {
        const run = await client.getWorkflow(workflowId).createRun({ runId });
        if (signal.aborted) return;
        return run.observeStream();
      }, 'Error observing workflow');
    },
  );

  const resumeWorkflowStream = useMutation<void, Error, ResumeWorkflowStreamParams>(
    ({ workflowId, runId, step, resumeData, requestContext, perStep }) =>
      consumeStream(async signal => {
        const run = await client.getWorkflow(workflowId).createRun({ runId });
        if (signal.aborted) return;
        return run.resumeStream({ step, resumeData, requestContext, tracingOptions, perStep: perStep ?? debugMode });
      }, 'Error resuming workflow stream'),
  );

  const timeTravelWorkflowStream = useMutation<void, Error, TimeTravelWorkflowStreamParams>(
    ({ workflowId, requestContext, runId, perStep, ...params }) =>
      consumeStream(async signal => {
        const run = await client.getWorkflow(workflowId).createRun({ runId });
        if (signal.aborted) return;
        return run.timeTravelStream({
          ...params,
          perStep: perStep ?? debugMode,
          requestContext,
          tracingOptions,
        });
      }, 'Error time traveling workflow stream'),
  );

  const closeStreamsAndReset = useCallback(() => {
    closeActiveStream();
    setIsStreaming(false);
    setStreamResult(undefined);
  }, [closeActiveStream]);

  return {
    streamWorkflow,
    streamResult,
    isStreaming,
    observeWorkflowStream,
    closeStreamsAndReset,
    resumeWorkflowStream,
    timeTravelWorkflowStream,
  };
}
