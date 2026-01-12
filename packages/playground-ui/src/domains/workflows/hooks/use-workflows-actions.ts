import { TimeTravelParams } from '@mastra/client-js';
import { WorkflowStreamResult as CoreWorkflowStreamResult } from '@mastra/core/workflows';
import { useMutation } from '@tanstack/react-query';
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  useMastraClient,
  mapWorkflowStreamChunkToWatchResult,
  StreamReaderManager,
  buildRequestContext,
  type StreamOperation,
} from '@mastra/react';

import { toast } from '@/lib/toast';
import { useTracingSettings } from '@/domains/observability/context/tracing-settings-context';

type WorkflowStreamResult = CoreWorkflowStreamResult<any, any, any, any>;

export const useExecuteWorkflow = () => {
  const client = useMastraClient();

  const createWorkflowRun = useMutation({
    mutationFn: async ({ workflowId, prevRunId }: { workflowId: string; prevRunId?: string }) => {
      const workflow = client.getWorkflow(workflowId);
      const { runId: newRunId } = await workflow.createRun({ runId: prevRunId });
      return { runId: newRunId };
    },
  });

  const startWorkflowRun = useMutation({
    mutationFn: async ({
      workflowId,
      runId,
      input,
      requestContext: contextData,
    }: {
      workflowId: string;
      runId: string;
      input: Record<string, unknown>;
      requestContext: Record<string, unknown>;
    }) => {
      const requestContext = buildRequestContext(contextData);
      const workflow = client.getWorkflow(workflowId);
      const run = await workflow.createRun({ runId });
      await run.start({ inputData: input || {}, requestContext });
    },
  });

  const startAsyncWorkflowRun = useMutation({
    mutationFn: async ({
      workflowId,
      runId,
      input,
      requestContext: contextData,
    }: {
      workflowId: string;
      runId?: string;
      input: Record<string, unknown>;
      requestContext: Record<string, unknown>;
    }) => {
      const requestContext = buildRequestContext(contextData);
      const workflow = client.getWorkflow(workflowId);
      const run = await workflow.createRun({ runId });
      return await run.startAsync({ inputData: input || {}, requestContext });
    },
  });

  return {
    startWorkflowRun,
    createWorkflowRun,
    startAsyncWorkflowRun,
  };
};

export const useStreamWorkflow = ({ debugMode }: { debugMode: boolean }) => {
  const client = useMastraClient();
  const { settings } = useTracingSettings();
  const [streamResult, setStreamResult] = useState<WorkflowStreamResult>({} as WorkflowStreamResult);
  const [isStreaming, setIsStreaming] = useState(false);

  const isMountedRef = useRef(true);
  const readerManagerRef = useRef(new StreamReaderManager());

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      readerManagerRef.current.releaseAll();
    };
  }, []);

  const isMounted = useCallback(() => isMountedRef.current, []);

  const handleStreamError = (err: unknown) => {
    if (err instanceof TypeError) return; // Expected during cleanup
    const errorMessage = err instanceof Error ? err.message : 'Workflow error';
    toast.error(errorMessage);
  };

  const processStream = async (
    stream: { getReader(): { read(): Promise<{ done: boolean; value?: unknown }>; releaseLock(): void } },
    operation: StreamOperation,
  ) => {
    const reader = stream.getReader();
    readerManagerRef.current.set(operation, reader as any);

    try {
      while (true) {
        if (!isMounted()) break;
        const { done, value } = await reader.read();
        if (done || !value) break;

        const chunk = value as {
          type: string;
          payload?: { workflowStatus?: string; metadata?: { errorMessage?: string } };
        };

        if (isMounted()) {
          setStreamResult(prev => mapWorkflowStreamChunkToWatchResult(prev, chunk as any));

          if (chunk.type === 'workflow-step-start') setIsStreaming(true);
          if (chunk.type === 'workflow-step-suspended') setIsStreaming(false);
          if (chunk.type === 'workflow-finish') {
            const status = chunk.payload?.workflowStatus;
            setStreamResult(prev => ({ ...prev, status }) as WorkflowStreamResult);
            if (status === 'failed') {
              throw new Error(chunk.payload?.metadata?.errorMessage || 'Workflow execution failed');
            }
          }
        }
      }
    } catch (err) {
      handleStreamError(err);
    } finally {
      if (isMounted()) setIsStreaming(false);
      readerManagerRef.current.release(operation);
    }
  };

  const streamWorkflow = useMutation({
    mutationFn: async ({
      workflowId,
      runId,
      inputData,
      initialState,
      requestContext: contextData,
      perStep,
    }: {
      workflowId: string;
      runId: string;
      inputData: Record<string, unknown>;
      initialState?: Record<string, unknown>;
      requestContext: Record<string, unknown>;
      perStep?: boolean;
    }) => {
      readerManagerRef.current.release('stream');
      if (!isMounted()) return;

      setIsStreaming(true);
      setStreamResult({ input: inputData } as WorkflowStreamResult);

      const requestContext = buildRequestContext(contextData);
      const workflow = client.getWorkflow(workflowId);
      const run = await workflow.createRun({ runId });
      const stream = await run.stream({
        inputData,
        initialState,
        requestContext,
        tracingOptions: settings?.tracingOptions,
        perStep: perStep ?? debugMode,
        closeOnSuspend: true,
      });

      if (!stream) {
        toast.error('No stream returned');
        setIsStreaming(false);
        return;
      }

      await processStream(stream, 'stream');
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
      readerManagerRef.current.release('observe');
      if (!isMounted()) return;

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
        toast.error('No stream returned');
        setIsStreaming(false);
        return;
      }

      await processStream(stream, 'observe');
    },
  });

  const resumeWorkflowStream = useMutation({
    mutationFn: async ({
      workflowId,
      runId,
      step,
      resumeData,
      requestContext: contextData,
      perStep,
    }: {
      workflowId: string;
      runId: string;
      step: string | string[];
      resumeData: Record<string, unknown>;
      requestContext: Record<string, unknown>;
      perStep?: boolean;
    }) => {
      readerManagerRef.current.release('resume');
      if (!isMounted()) return;

      setIsStreaming(true);

      const requestContext = buildRequestContext(contextData);
      const workflow = client.getWorkflow(workflowId);
      const run = await workflow.createRun({ runId });
      const stream = await run.resumeStream({
        step,
        resumeData,
        requestContext,
        tracingOptions: settings?.tracingOptions,
        perStep: perStep ?? debugMode,
      });

      if (!stream) {
        toast.error('No stream returned');
        setIsStreaming(false);
        return;
      }

      await processStream(stream, 'resume');
    },
  });

  const timeTravelWorkflowStream = useMutation({
    mutationFn: async ({
      workflowId,
      runId,
      requestContext: contextData,
      perStep,
      ...params
    }: {
      workflowId: string;
      runId?: string;
      requestContext: Record<string, unknown>;
      perStep?: boolean;
    } & Omit<TimeTravelParams, 'requestContext'>) => {
      readerManagerRef.current.release('timeTravel');
      if (!isMounted()) return;

      setIsStreaming(true);

      const requestContext = buildRequestContext(contextData);
      const workflow = client.getWorkflow(workflowId);
      const run = await workflow.createRun({ runId });
      const stream = await run.timeTravelStream({
        ...params,
        requestContext,
        tracingOptions: settings?.tracingOptions,
        perStep: perStep ?? debugMode,
      });

      if (!stream) {
        toast.error('No stream returned');
        setIsStreaming(false);
        return;
      }

      await processStream(stream, 'timeTravel');
    },
  });

  const closeStreamsAndReset = useCallback(() => {
    setIsStreaming(false);
    setStreamResult({} as WorkflowStreamResult);
    readerManagerRef.current.releaseAll();
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
};

export const useCancelWorkflowRun = () => {
  const client = useMastraClient();

  const cancelWorkflowRun = useMutation({
    mutationFn: async ({ workflowId, runId }: { workflowId: string; runId: string }) => {
      const workflow = client.getWorkflow(workflowId);
      const run = await workflow.createRun({ runId });
      return await run.cancel();
    },
  });

  return cancelWorkflowRun;
};
