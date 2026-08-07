import type { StreamVNextChunkType } from '@mastra/client-js';
import type { RefObject } from 'react';
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

type StreamReaderRef = RefObject<ReadableStreamDefaultReader<StreamVNextChunkType> | null>;

type ConsumeStreamResult = {
  /** A terminal chunk (finish or suspend) arrived, so the stream is not expected to continue. */
  finished: boolean;
  /** Number of chunks consumed for this run, used as the replay offset when reconnecting. */
  received: number;
  error?: unknown;
};

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY_MS = 500;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Hook for streaming workflow execution with support for observing, resuming, and time-travel.
 *
 * @example
 * ```tsx
 * const {
 *   streamWorkflow,
 *   streamResult,
 *   isStreaming,
 *   observeWorkflowStream,
 *   closeStreamsAndReset,
 *   resumeWorkflowStream,
 *   timeTravelWorkflowStream,
 * } = useStreamWorkflow({
 *   debugMode: true,
 *   tracingOptions: { enabled: true },
 *   onError: (error, defaultMessage) => console.error(defaultMessage, error),
 * });
 *
 * // Start streaming a workflow
 * await streamWorkflow.mutateAsync({
 *   workflowId: 'my-workflow',
 *   runId: 'run-123',
 *   inputData: { key: 'value' },
 *   requestContext: {},
 * });
 * ```
 */
export function useStreamWorkflow({ debugMode, tracingOptions, onError }: UseStreamWorkflowParams) {
  const client = useMastraClient();
  const [streamResult, setStreamResult] = useState<WorkflowStreamResult>({} as WorkflowStreamResult);
  const [isStreaming, setIsStreaming] = useState(false);
  const readerRef = useRef<ReadableStreamDefaultReader<StreamVNextChunkType> | null>(null);
  const observerRef = useRef<ReadableStreamDefaultReader<StreamVNextChunkType> | null>(null);
  const resumeStreamRef = useRef<ReadableStreamDefaultReader<StreamVNextChunkType> | null>(null);
  const timeTravelStreamRef = useRef<ReadableStreamDefaultReader<StreamVNextChunkType> | null>(null);
  const isMountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (readerRef.current) {
        try {
          readerRef.current.releaseLock();
        } catch {
          // Reader might already be released, ignore the error
        }
        readerRef.current = null;
      }
      if (observerRef.current) {
        try {
          observerRef.current.releaseLock();
        } catch {
          // Reader might already be released, ignore the error
        }
        observerRef.current = null;
      }
      if (resumeStreamRef.current) {
        try {
          resumeStreamRef.current.releaseLock();
        } catch {
          // Reader might already be released, ignore the error
        }
        resumeStreamRef.current = null;
      }
      if (timeTravelStreamRef.current) {
        try {
          timeTravelStreamRef.current.releaseLock();
        } catch {
          // Reader might already be released, ignore the error
        }
        timeTravelStreamRef.current = null;
      }
    };
  }, []);

  const handleStreamError = useCallback(
    (err: unknown, defaultMessage: string, setStreamingState?: (isStreaming: boolean) => void) => {
      // Expected error during cleanup - safe to ignore
      if (err instanceof TypeError) {
        return;
      }
      const error = err instanceof Error ? err : new Error(defaultMessage);
      onError?.(error, defaultMessage);
      setStreamingState?.(false);
    },
    [onError],
  );

  const handleWorkflowFinish = useCallback((value: StreamVNextChunkType) => {
    if (value.type === 'workflow-finish') {
      const streamStatus = value.payload?.workflowStatus;
      const metadata = value.payload?.metadata;
      setStreamResult(prev => ({
        ...prev,
        status: streamStatus,
      }));
      if (streamStatus === 'failed') {
        throw new Error(metadata?.errorMessage || 'Workflow execution failed');
      }
      // Tripwire status is not an error - it's handled separately in the UI
      // Don't throw an error for tripwire status
    }
  }, []);

  const consumeStream = useCallback(
    async (
      stream: ReadableStream<StreamVNextChunkType>,
      readerRef: StreamReaderRef,
      received: number,
    ): Promise<ConsumeStreamResult> => {
      const reader = stream.getReader();
      readerRef.current = reader;
      let finished = false;

      try {
        while (true) {
          if (!isMountedRef.current) break;

          const { done, value } = await reader.read();
          if (done) break;
          received++;

          // Only update state if component is still mounted
          if (!isMountedRef.current) break;

          setStreamResult(prev => mapWorkflowStreamChunkToWatchResult(prev, value));

          if (value.type === 'workflow-step-start') {
            setIsStreaming(true);
          }

          if (value.type === 'workflow-step-suspended') {
            finished = true;
            setIsStreaming(false);
          }

          if (value.type === 'workflow-finish') {
            finished = true;
            handleWorkflowFinish(value);
          }
        }

        return { finished, received };
      } catch (error) {
        return { finished, received, error };
      } finally {
        if (readerRef.current === reader) {
          try {
            reader.releaseLock();
          } catch {
            // Reader might already be released, ignore the error
          }
          readerRef.current = null;
        }
      }
    },
    [handleWorkflowFinish],
  );

  /**
   * Consumes a workflow stream, reconnecting when it ends before the run reaches a terminal
   * chunk. Long-running steps can outlive the response — proxies close idle connections and
   * hosts cap request duration — and without reconnecting the UI would sit on the last step
   * it saw while the run finishes server-side. Reconnects replay from the chunk offset already
   * consumed, so no state is lost or applied twice.
   */
  const consumeStreamWithReconnect = useCallback(
    async ({
      workflowId,
      runId,
      stream,
      readerRef,
      errorMessage,
    }: {
      workflowId: string;
      runId: string;
      stream: ReadableStream<StreamVNextChunkType>;
      readerRef: StreamReaderRef;
      errorMessage: string;
    }) => {
      let currentStream: ReadableStream<StreamVNextChunkType> | undefined = stream;
      let received = 0;
      let lastError: unknown;

      for (let attempt = 0; attempt <= MAX_RECONNECT_ATTEMPTS; attempt++) {
        if (currentStream) {
          const result = await consumeStream(currentStream, readerRef, received);
          received = result.received;
          lastError = result.error;

          if (result.finished || !isMountedRef.current) {
            if (result.error) {
              handleStreamError(result.error, errorMessage);
            }
            return;
          }
        }

        if (attempt === MAX_RECONNECT_ATTEMPTS) break;

        await delay(RECONNECT_BASE_DELAY_MS * 2 ** attempt);
        if (!isMountedRef.current) return;

        try {
          const run = await client.getWorkflow(workflowId).createRun({ runId });
          currentStream = await run.observe({ offset: received });
        } catch (error) {
          lastError = error;
          currentStream = undefined;
        }
      }

      // Always surface a plain Error: a dropped fetch stream rejects with a TypeError, which
      // handleStreamError ignores as expected cleanup noise, and swallowing it here would leave
      // the UI streaming forever.
      handleStreamError(
        new Error('Workflow stream ended before the run completed', { cause: lastError }),
        errorMessage,
        setIsStreaming,
      );
    },
    [client, consumeStream, handleStreamError],
  );

  const streamWorkflow = useMutation<void, Error, StreamWorkflowParams>(
    async ({ workflowId, runId, inputData, initialState, requestContext: playgroundRequestContext, perStep }) => {
      // Clean up any existing reader before starting new stream
      if (readerRef.current) {
        readerRef.current.releaseLock();
      }

      if (!isMountedRef.current) return;

      setIsStreaming(true);
      setStreamResult({ input: inputData } as WorkflowStreamResult);
      const workflow = client.getWorkflow(workflowId);
      const run = await workflow.createRun({ runId });
      const stream = await run.stream({
        inputData,
        initialState,
        requestContext: playgroundRequestContext,
        closeOnSuspend: true,
        tracingOptions,
        perStep: perStep ?? debugMode,
      });

      if (!stream) {
        return handleStreamError(new Error('No stream returned'), 'No stream returned', setIsStreaming);
      }

      try {
        await consumeStreamWithReconnect({
          workflowId,
          runId,
          stream,
          readerRef,
          errorMessage: 'Error streaming workflow',
        });
      } finally {
        if (isMountedRef.current) {
          setIsStreaming(false);
        }
      }
    },
  );

  const observeWorkflowStream = useMutation<void, Error, ObserveWorkflowStreamParams>(
    async ({ workflowId, runId, storeRunResult }) => {
      // Clean up any existing reader before starting new stream
      if (observerRef.current) {
        observerRef.current.releaseLock();
      }

      if (!isMountedRef.current) return;

      setIsStreaming(true);

      setStreamResult((storeRunResult || {}) as WorkflowStreamResult);
      if (storeRunResult?.status === 'suspended') {
        setIsStreaming(false);
        return;
      }
      const workflow = client.getWorkflow(workflowId);
      const run = await workflow.createRun({ runId });
      const stream = await run.observeStream();

      if (!stream) {
        return handleStreamError(new Error('No stream returned'), 'No stream returned', setIsStreaming);
      }

      try {
        await consumeStreamWithReconnect({
          workflowId,
          runId,
          stream,
          readerRef: observerRef,
          errorMessage: 'Error observing workflow',
        });
      } finally {
        if (isMountedRef.current) {
          setIsStreaming(false);
        }
      }
    },
  );

  const resumeWorkflowStream = useMutation<void, Error, ResumeWorkflowStreamParams>(
    async ({ workflowId, runId, step, resumeData, requestContext: playgroundRequestContext, perStep }) => {
      // Clean up any existing reader before starting new stream
      if (resumeStreamRef.current) {
        resumeStreamRef.current.releaseLock();
      }

      if (!isMountedRef.current) return;

      setIsStreaming(true);
      const workflow = client.getWorkflow(workflowId);
      const run = await workflow.createRun({ runId });
      const stream = await run.resumeStream({
        step,
        resumeData,
        requestContext: playgroundRequestContext,
        tracingOptions,
        perStep: perStep ?? debugMode,
      });

      if (!stream) {
        return handleStreamError(new Error('No stream returned'), 'No stream returned', setIsStreaming);
      }

      try {
        await consumeStreamWithReconnect({
          workflowId,
          runId,
          stream,
          readerRef: resumeStreamRef,
          errorMessage: 'Error resuming workflow stream',
        });
      } finally {
        if (isMountedRef.current) {
          setIsStreaming(false);
        }
      }
    },
  );

  const timeTravelWorkflowStream = useMutation<void, Error, TimeTravelWorkflowStreamParams>(
    async ({ workflowId, requestContext: playgroundRequestContext, runId, perStep, ...params }) => {
      // Clean up any existing reader before starting new stream
      if (timeTravelStreamRef.current) {
        timeTravelStreamRef.current.releaseLock();
      }

      if (!isMountedRef.current) return;

      setIsStreaming(true);
      const workflow = client.getWorkflow(workflowId);
      const run = await workflow.createRun({ runId });
      const stream = await run.timeTravelStream({
        ...params,
        perStep: perStep ?? debugMode,
        requestContext: playgroundRequestContext,
        tracingOptions,
      });

      if (!stream) {
        return handleStreamError(new Error('No stream returned'), 'No stream returned', setIsStreaming);
      }

      try {
        await consumeStreamWithReconnect({
          workflowId,
          runId,
          stream,
          readerRef: timeTravelStreamRef,
          errorMessage: 'Error time traveling workflow stream',
        });
      } finally {
        if (isMountedRef.current) {
          setIsStreaming(false);
        }
      }
    },
  );

  const closeStreamsAndReset = useCallback(() => {
    setIsStreaming(false);
    setStreamResult({} as WorkflowStreamResult);
    if (readerRef.current) {
      try {
        readerRef.current.releaseLock();
      } catch {
        // Reader might already be released, ignore the error
      }
      readerRef.current = null;
    }
    if (observerRef.current) {
      try {
        observerRef.current.releaseLock();
      } catch {
        // Reader might already be released, ignore the error
      }
      observerRef.current = null;
    }
    if (resumeStreamRef.current) {
      try {
        resumeStreamRef.current.releaseLock();
      } catch {
        // Reader might already be released, ignore the error
      }
      resumeStreamRef.current = null;
    }
    if (timeTravelStreamRef.current) {
      try {
        timeTravelStreamRef.current.releaseLock();
      } catch {
        // Reader might already be released, ignore the error
      }
      timeTravelStreamRef.current = null;
    }
  }, []);

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
