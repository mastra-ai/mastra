import { StreamVNextChunkType, TimeTravelParams } from '@mastra/client-js';
import { RequestContext } from '@mastra/core/request-context';
import { WorkflowStreamResult as CoreWorkflowStreamResult } from '@mastra/core/workflows';
import { useState, useRef, useEffect, useCallback } from 'react';
import type { ReadableStreamDefaultReader } from 'stream/web';
import { useMastraClient } from '../mastra-client-context';
import { useMutation } from '../lib/use-mutation';
import { mapWorkflowStreamChunkToWatchResult } from '../lib/ai-sdk/utils/toUIMessage';
import type {
  UseStreamWorkflowParams,
  WorkflowStreamResult,
  StreamWorkflowParams,
  ObserveWorkflowStreamParams,
  ResumeWorkflowStreamParams,
  TimeTravelWorkflowStreamParams,
} from './types';

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
        } catch (error) {
          // Reader might already be released, ignore the error
        }
        readerRef.current = null;
      }
      if (observerRef.current) {
        try {
          observerRef.current.releaseLock();
        } catch (error) {
          // Reader might already be released, ignore the error
        }
        observerRef.current = null;
      }
      if (resumeStreamRef.current) {
        try {
          resumeStreamRef.current.releaseLock();
        } catch (error) {
          // Reader might already be released, ignore the error
        }
        resumeStreamRef.current = null;
      }
      if (timeTravelStreamRef.current) {
        try {
          timeTravelStreamRef.current.releaseLock();
        } catch (error) {
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

  const streamWorkflow = useMutation<void, Error, StreamWorkflowParams>(
    async ({ workflowId, runId, inputData, initialState, requestContext: playgroundRequestContext, perStep }) => {
      // Clean up any existing reader before starting new stream
      if (readerRef.current) {
        readerRef.current.releaseLock();
      }

      if (!isMountedRef.current) return;

      setIsStreaming(true);
      setStreamResult({ input: inputData } as WorkflowStreamResult);
      const requestContext = new RequestContext();
      Object.entries(playgroundRequestContext).forEach(([key, value]) => {
        requestContext.set(key as keyof RequestContext, value);
      });
      const workflow = client.getWorkflow(workflowId);
      const run = await workflow.createRun({ runId });
      const stream = await run.stream({
        inputData,
        initialState,
        requestContext,
        closeOnSuspend: true,
        tracingOptions,
        perStep: perStep ?? debugMode,
      });

      if (!stream) {
        return handleStreamError(new Error('No stream returned'), 'No stream returned', setIsStreaming);
      }

      // Get a reader from the ReadableStream and store it in ref
      const reader = stream.getReader();
      readerRef.current = reader;

      try {
        while (true) {
          if (!isMountedRef.current) break;

          const { done, value } = await reader.read();
          if (done) break;

          // Only update state if component is still mounted
          if (isMountedRef.current) {
            setStreamResult(prev => {
              const newResult = mapWorkflowStreamChunkToWatchResult(prev, value);
              return newResult;
            });

            if (value.type === 'workflow-step-start') {
              setIsStreaming(true);
            }

            if (value.type === 'workflow-step-suspended') {
              setIsStreaming(false);
            }

            if (value.type === 'workflow-finish') {
              handleWorkflowFinish(value);
            }
          }
        }
      } catch (err) {
        handleStreamError(err, 'Error streaming workflow');
      } finally {
        if (isMountedRef.current) {
          setIsStreaming(false);
        }
        if (readerRef.current) {
          readerRef.current.releaseLock();
          readerRef.current = null;
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

      // Get a reader from the ReadableStream and store it in ref
      const reader = stream.getReader();
      observerRef.current = reader;

      try {
        while (true) {
          if (!isMountedRef.current) break;

          const { done, value } = await reader.read();
          if (done) break;

          // Only update state if component is still mounted
          if (isMountedRef.current) {
            setStreamResult(prev => {
              const newResult = mapWorkflowStreamChunkToWatchResult(prev, value);
              return newResult;
            });

            if (value.type === 'workflow-step-start') {
              setIsStreaming(true);
            }

            if (value.type === 'workflow-step-suspended') {
              setIsStreaming(false);
            }

            if (value.type === 'workflow-finish') {
              handleWorkflowFinish(value);
            }
          }
        }
      } catch (err) {
        handleStreamError(err, 'Error observing workflow');
      } finally {
        if (isMountedRef.current) {
          setIsStreaming(false);
        }
        if (observerRef.current) {
          observerRef.current.releaseLock();
          observerRef.current = null;
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
      const requestContext = new RequestContext();
      Object.entries(playgroundRequestContext).forEach(([key, value]) => {
        requestContext.set(key as keyof RequestContext, value);
      });
      const run = await workflow.createRun({ runId });
      const stream = await run.resumeStream({
        step,
        resumeData,
        requestContext,
        tracingOptions,
        perStep: perStep ?? debugMode,
      });

      if (!stream) {
        return handleStreamError(new Error('No stream returned'), 'No stream returned', setIsStreaming);
      }

      // Get a reader from the ReadableStream and store it in ref
      const reader = stream.getReader();
      resumeStreamRef.current = reader;

      try {
        while (true) {
          if (!isMountedRef.current) break;

          const { done, value } = await reader.read();
          if (done) break;

          // Only update state if component is still mounted
          if (isMountedRef.current) {
            setStreamResult(prev => {
              const newResult = mapWorkflowStreamChunkToWatchResult(prev, value);
              return newResult;
            });

            if (value.type === 'workflow-step-start') {
              setIsStreaming(true);
            }

            if (value.type === 'workflow-step-suspended') {
              setIsStreaming(false);
            }

            if (value.type === 'workflow-finish') {
              handleWorkflowFinish(value);
            }
          }
        }
      } catch (err) {
        handleStreamError(err, 'Error resuming workflow stream');
      } finally {
        if (isMountedRef.current) {
          setIsStreaming(false);
        }
        if (resumeStreamRef.current) {
          resumeStreamRef.current.releaseLock();
          resumeStreamRef.current = null;
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
      const requestContext = new RequestContext();
      Object.entries(playgroundRequestContext).forEach(([key, value]) => {
        requestContext.set(key as keyof RequestContext, value);
      });
      const run = await workflow.createRun({ runId });
      const stream = await run.timeTravelStream({
        ...params,
        perStep: perStep ?? debugMode,
        requestContext,
        tracingOptions,
      });

      if (!stream) {
        return handleStreamError(new Error('No stream returned'), 'No stream returned', setIsStreaming);
      }

      // Get a reader from the ReadableStream and store it in ref
      const reader = stream.getReader();
      timeTravelStreamRef.current = reader;

      try {
        while (true) {
          if (!isMountedRef.current) break;

          const { done, value } = await reader.read();
          if (done) break;

          // Only update state if component is still mounted
          if (isMountedRef.current) {
            setStreamResult(prev => {
              const newResult = mapWorkflowStreamChunkToWatchResult(prev, value);
              return newResult;
            });

            if (value.type === 'workflow-step-start') {
              setIsStreaming(true);
            }

            if (value.type === 'workflow-step-suspended') {
              setIsStreaming(false);
            }

            if (value.type === 'workflow-finish') {
              handleWorkflowFinish(value);
            }
          }
        }
      } catch (err) {
        handleStreamError(err, 'Error time traveling workflow stream');
      } finally {
        if (isMountedRef.current) {
          setIsStreaming(false);
        }
        if (timeTravelStreamRef.current) {
          timeTravelStreamRef.current.releaseLock();
          timeTravelStreamRef.current = null;
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
      } catch (error) {
        // Reader might already be released, ignore the error
      }
      readerRef.current = null;
    }
    if (observerRef.current) {
      try {
        observerRef.current.releaseLock();
      } catch (error) {
        // Reader might already be released, ignore the error
      }
      observerRef.current = null;
    }
    if (resumeStreamRef.current) {
      try {
        resumeStreamRef.current.releaseLock();
      } catch (error) {
        // Reader might already be released, ignore the error
      }
      resumeStreamRef.current = null;
    }
    if (timeTravelStreamRef.current) {
      try {
        timeTravelStreamRef.current.releaseLock();
      } catch (error) {
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
