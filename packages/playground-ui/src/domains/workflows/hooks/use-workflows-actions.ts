import { StreamVNextChunkType } from '@mastra/client-js';
import { RequestContext } from '@mastra/core/request-context';
import { WorkflowStreamResult as CoreWorkflowStreamResult } from '@mastra/core/workflows';
import { useMutation } from '@tanstack/react-query';
import { useState, useRef, useEffect } from 'react';
import { mapWorkflowStreamChunkToWatchResult, useMastraClient } from '@mastra/react';
import type { ReadableStreamDefaultReader } from 'stream/web';
import { toast } from '@/lib/toast';

export const useExecuteWorkflow = () => {
  const client = useMastraClient();
  const createWorkflowRun = useMutation({
    mutationFn: async ({ workflowId, prevRunId }: { workflowId: string; prevRunId?: string }) => {
      try {
        const workflow = client.getWorkflow(workflowId);
        const { runId: newRunId } = await workflow.createRun({ runId: prevRunId });
        return { runId: newRunId };
      } catch (error) {
        console.error('Error creating workflow run:', error);
        throw error;
      }
    },
  });

  const startWorkflowRun = useMutation({
    mutationFn: async ({
      workflowId,
      runId,
      input,
      requestContext: playgroundRequestContext,
    }: {
      workflowId: string;
      runId: string;
      input: Record<string, unknown>;
      requestContext: Record<string, unknown>;
    }) => {
      try {
        const requestContext = new RequestContext();
        Object.entries(playgroundRequestContext).forEach(([key, value]) => {
          requestContext.set(key, value);
        });

        const workflow = client.getWorkflow(workflowId);

        await workflow.start({ runId, inputData: input || {}, requestContext });
      } catch (error) {
        console.error('Error starting workflow run:', error);
        throw error;
      }
    },
  });

  const startAsyncWorkflowRun = useMutation({
    mutationFn: async ({
      workflowId,
      runId,
      input,
      requestContext: playgroundRequestContext,
    }: {
      workflowId: string;
      runId?: string;
      input: Record<string, unknown>;
      requestContext: Record<string, unknown>;
    }) => {
      try {
        const requestContext = new RequestContext();
        Object.entries(playgroundRequestContext).forEach(([key, value]) => {
          requestContext.set(key, value);
        });
        const workflow = client.getWorkflow(workflowId);
        const result = await workflow.startAsync({ runId, inputData: input || {}, requestContext });
        return result;
      } catch (error) {
        console.error('Error starting workflow run:', error);
        throw error;
      }
    },
  });

  return {
    startWorkflowRun,
    createWorkflowRun,
    startAsyncWorkflowRun,
  };
};

type WorkflowStreamResult = CoreWorkflowStreamResult<any, any, any, any>;

export const useStreamWorkflow = () => {
  const client = useMastraClient();
  const [streamResult, setStreamResult] = useState<WorkflowStreamResult>({} as WorkflowStreamResult);
  const [isStreaming, setIsStreaming] = useState(false);
  const readerRef = useRef<ReadableStreamDefaultReader<StreamVNextChunkType> | null>(null);
  const observerRef = useRef<ReadableStreamDefaultReader<StreamVNextChunkType> | null>(null);
  const resumeStreamRef = useRef<ReadableStreamDefaultReader<StreamVNextChunkType> | null>(null);
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
    };
  }, []);

  const handleStreamError = (err: unknown, defaultMessage: string, setIsStreaming?: (isStreaming: boolean) => void) => {
    // Expected error during cleanup - safe to ignore
    if (err instanceof TypeError) {
      return;
    }
    const errorMessage = err instanceof Error ? err.message : defaultMessage;
    toast.error(errorMessage);
    setIsStreaming?.(false);
  };

  const handleWorkflowFinish = (value: StreamVNextChunkType) => {
    if (value.type === 'workflow-finish') {
      const streamStatus = value.payload?.workflowStatus;
      const metadata = value.payload?.metadata;
      if (streamStatus === 'failed') {
        throw new Error(metadata?.errorMessage || 'Workflow execution failed');
      }
    }
  };

  const streamWorkflow = useMutation({
    mutationFn: async ({
      workflowId,
      runId,
      inputData,
      requestContext: playgroundRequestContext,
    }: {
      workflowId: string;
      runId: string;
      inputData: Record<string, unknown>;
      requestContext: Record<string, unknown>;
    }) => {
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
      const stream = await workflow.streamVNext({ runId, inputData, requestContext, closeOnSuspend: true });

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
  });

  const observeWorkflowStream = useMutation({
    mutationFn: async ({
      workflowId,
      runId,
      storeRunResult,
    }: {
      workflowId: string;
      runId: string;
      storeRunResult: WorkflowStreamResult | null;
    }) => {
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
      const stream = await workflow.observeStreamVNext({ runId });

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
  });

  const resumeWorkflowStream = useMutation({
    mutationFn: async ({
      workflowId,
      runId,
      step,
      resumeData,
      requestContext: playgroundRequestContext,
    }: {
      workflowId: string;
      step: string | string[];
      runId: string;
      resumeData: Record<string, unknown>;
      requestContext: Record<string, unknown>;
    }) => {
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
      const stream = await workflow.resumeStreamVNext({ runId, step, resumeData, requestContext });

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
  });

  const closeStreamsAndReset = () => {
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
  };

  return {
    streamWorkflow,
    streamResult,
    isStreaming,
    observeWorkflowStream,
    closeStreamsAndReset,
    resumeWorkflowStream,
  };
};

export const useCancelWorkflowRun = () => {
  const client = useMastraClient();
  const cancelWorkflowRun = useMutation({
    mutationFn: async ({ workflowId, runId }: { workflowId: string; runId: string }) => {
      try {
        const response = await client.getWorkflow(workflowId).cancelRun(runId);
        return response;
      } catch (error) {
        console.error('Error canceling workflow run:', error);
        throw error;
      }
    },
  });

  return cancelWorkflowRun;
};
