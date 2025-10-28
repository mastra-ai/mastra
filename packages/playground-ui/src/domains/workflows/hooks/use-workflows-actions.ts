import { StreamVNextChunkType, WorkflowWatchResult } from '@mastra/client-js';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { WorkflowStreamResult as CoreWorkflowStreamResult } from '@mastra/core/workflows';
import { useMutation } from '@tanstack/react-query';
import { useState, useRef, useEffect } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { mapWorkflowStreamChunkToWatchResult, useMastraClient } from '@mastra/react';
import type { ReadableStreamDefaultReader } from 'stream/web';
import { toast } from '@/lib/toast';

export type ExtendedWorkflowWatchResult = WorkflowWatchResult & {
  sanitizedOutput?: string | null;
  sanitizedError?: {
    message: string;
    stack?: string;
  } | null;
};

const sanitizeWorkflowWatchResult = (record: WorkflowWatchResult) => {
  const formattedResults = Object.entries(record.payload.workflowState.steps || {}).reduce(
    (acc, [key, value]) => {
      let output = value.status === 'success' ? value.output : undefined;
      if (output) {
        output = Object.entries(output).reduce(
          (_acc, [_key, _value]) => {
            const val = _value as { type: string; data: unknown };
            _acc[_key] = val.type?.toLowerCase() === 'buffer' ? { type: 'Buffer', data: `[...buffered data]` } : val;
            return _acc;
          },
          {} as Record<string, unknown>,
        );
      }
      acc[key] = { ...value, output };
      return acc;
    },
    {} as Record<string, unknown>,
  );
  const sanitizedRecord: ExtendedWorkflowWatchResult = {
    ...record,
    sanitizedOutput: record
      ? JSON.stringify(
          {
            ...record,
            payload: {
              ...record.payload,
              workflowState: { ...record.payload.workflowState, steps: formattedResults },
            },
          },
          null,
          2,
        ).slice(0, 50000) // Limit to 50KB
      : null,
  };

  return sanitizedRecord;
};

export const useExecuteWorkflow = () => {
  const client = useMastraClient();
  const createWorkflowRun = useMutation({
    mutationFn: async ({ workflowId, prevRunId }: { workflowId: string; prevRunId?: string }) => {
      try {
        const workflow = client.getWorkflow(workflowId);
        const { runId: newRunId } = await workflow.createRunAsync({ runId: prevRunId });
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
      runtimeContext: playgroundRuntimeContext,
    }: {
      workflowId: string;
      runId: string;
      input: Record<string, unknown>;
      runtimeContext: Record<string, unknown>;
    }) => {
      try {
        const runtimeContext = new RuntimeContext();
        Object.entries(playgroundRuntimeContext).forEach(([key, value]) => {
          runtimeContext.set(key, value);
        });

        const workflow = client.getWorkflow(workflowId);

        await workflow.start({ runId, inputData: input || {}, runtimeContext });
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
      runtimeContext: playgroundRuntimeContext,
    }: {
      workflowId: string;
      runId?: string;
      input: Record<string, unknown>;
      runtimeContext: Record<string, unknown>;
    }) => {
      try {
        const runtimeContext = new RuntimeContext();
        Object.entries(playgroundRuntimeContext).forEach(([key, value]) => {
          runtimeContext.set(key, value);
        });
        const workflow = client.getWorkflow(workflowId);
        const result = await workflow.startAsync({ runId, inputData: input || {}, runtimeContext });
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

  const streamWorkflow = useMutation({
    mutationFn: async ({
      workflowId,
      runId,
      inputData,
      runtimeContext: playgroundRuntimeContext,
    }: {
      workflowId: string;
      runId: string;
      inputData: Record<string, unknown>;
      runtimeContext: Record<string, unknown>;
    }) => {
      // Clean up any existing reader before starting new stream
      if (readerRef.current) {
        readerRef.current.releaseLock();
      }

      if (!isMountedRef.current) return;

      setIsStreaming(true);
      setStreamResult({ input: inputData } as WorkflowStreamResult);
      const runtimeContext = new RuntimeContext();
      Object.entries(playgroundRuntimeContext).forEach(([key, value]) => {
        runtimeContext.set(key as keyof RuntimeContext, value);
      });
      const workflow = client.getWorkflow(workflowId);
      const stream = await workflow.streamVNext({ runId, inputData, runtimeContext, closeOnSuspend: true });

      if (!stream) throw new Error('No stream returned');

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
              const streamStatus = value.payload.workflowStatus;
              const metadata = value.payload.metadata;
              if (streamStatus === 'failed' && metadata?.errorMessage) {
                throw new Error(metadata.errorMessage);
              }
            }
          }
        }
      } catch (error) {
        toast.error((error as Error)?.message ?? 'Error streaming workflow');
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
    onError: error => {
      toast.error(error.message ?? 'Error streaming workflow');
      setIsStreaming(false);
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

      if (!stream) throw new Error('No stream returned');

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
              const streamStatus = value.payload.workflowStatus;
              const metadata = value.payload.metadata;
              if (streamStatus === 'failed' && metadata?.errorMessage) {
                throw new Error(metadata.errorMessage);
              }
            }
          }
        }
      } catch (error) {
        toast.error((error as Error)?.message ?? 'Error streaming workflow');
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
    onError: error => {
      toast.error(error.message ?? 'Error observing workflow stream');
      setIsStreaming(false);
    },
  });

  const resumeWorkflowStream = useMutation({
    mutationFn: async ({
      workflowId,
      runId,
      step,
      resumeData,
      runtimeContext: playgroundRuntimeContext,
    }: {
      workflowId: string;
      step: string | string[];
      runId: string;
      resumeData: Record<string, unknown>;
      runtimeContext: Record<string, unknown>;
    }) => {
      // Clean up any existing reader before starting new stream
      if (resumeStreamRef.current) {
        resumeStreamRef.current.releaseLock();
      }

      if (!isMountedRef.current) return;

      setIsStreaming(true);
      const workflow = client.getWorkflow(workflowId);
      const runtimeContext = new RuntimeContext();
      Object.entries(playgroundRuntimeContext).forEach(([key, value]) => {
        runtimeContext.set(key as keyof RuntimeContext, value);
      });
      const stream = await workflow.resumeStreamVNext({ runId, step, resumeData, runtimeContext });

      if (!stream) throw new Error('No stream returned');

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
              const streamStatus = value.payload.workflowStatus;
              const metadata = value.payload.metadata;
              if (streamStatus === 'failed' && metadata?.errorMessage) {
                throw new Error(metadata.errorMessage);
              }
            }
          }
        }
      } catch (error) {
        toast.error((error as Error)?.message ?? 'Error resuming workflow stream');
        //silent error
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
    onError: error => {
      toast.error(error.message ?? 'Error resuming workflow stream');
      setIsStreaming(false);
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

export const useSendWorkflowRunEvent = (workflowId: string) => {
  const client = useMastraClient();
  const sendWorkflowRunEvent = useMutation({
    mutationFn: async ({ runId, event, data }: { runId: string; event: string; data: unknown }) => {
      try {
        const response = await client.getWorkflow(workflowId).sendRunEvent({ runId, event, data });
        return response;
      } catch (error) {
        console.error('Error sending workflow run event:', error);
        throw error;
      }
    },
  });

  return sendWorkflowRunEvent;
};
