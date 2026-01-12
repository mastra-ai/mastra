import { useState, useRef, useEffect, useCallback, type Dispatch, type SetStateAction } from 'react';
import { useMastraClient } from '../mastra-client-context';
import { buildRequestContext } from './build-request-context';
import { processWorkflowStream } from './process-stream';
import { StreamReaderManager } from './stream-reader-manager';
import type {
  WorkflowStreamResult,
  StreamOperation,
  StreamParams,
  ObserveParams,
  ResumeParams,
  TimeTravelStreamParams,
} from './types';

export interface UseWorkflowActionsOptions {
  workflowId: string;
  initialStreamResult?: WorkflowStreamResult;
  onError?: (error: Error, context: { operation: StreamOperation }) => void;
}

export interface UseWorkflowActionsReturn {
  streamResult: WorkflowStreamResult;
  isStreaming: boolean;
  stream: (params: StreamParams) => Promise<void>;
  observe: (params: ObserveParams) => Promise<void>;
  resume: (params: ResumeParams) => Promise<void>;
  timeTravel: (params: TimeTravelStreamParams) => Promise<void>;
  reset: () => void;
  setStreamResult: Dispatch<SetStateAction<WorkflowStreamResult>>;
}

/**
 * Hook for managing workflow streaming operations.
 * Provides unified API for streaming, observing, resuming, and time-traveling workflows.
 */
export function useWorkflowActions({
  workflowId,
  initialStreamResult = {} as WorkflowStreamResult,
  onError,
}: UseWorkflowActionsOptions): UseWorkflowActionsReturn {
  const client = useMastraClient();
  const [streamResult, setStreamResult] = useState<WorkflowStreamResult>(initialStreamResult);
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

  const stream = useCallback(
    async ({
      runId,
      inputData,
      initialState,
      requestContext: contextData,
      tracingOptions,
      perStep,
      closeOnSuspend = true,
    }: StreamParams): Promise<void> => {
      readerManagerRef.current.release('stream');
      if (!isMounted()) return;

      setIsStreaming(true);
      setStreamResult({ input: inputData } as WorkflowStreamResult);

      const requestContext = buildRequestContext(contextData);
      const workflow = client.getWorkflow(workflowId);
      const run = await workflow.createRun({ runId });

      const readableStream = await run.stream({
        inputData,
        initialState,
        requestContext,
        tracingOptions,
        perStep,
        closeOnSuspend,
      });

      if (!readableStream) {
        onError?.(new Error('No stream returned'), { operation: 'stream' });
        setIsStreaming(false);
        return;
      }

      const { reader } = await processWorkflowStream({
        stream: readableStream,
        onChunk: setStreamResult,
        onStreamingChange: setIsStreaming,
        onError,
        isMounted,
        operation: 'stream',
      });

      readerManagerRef.current.set('stream', reader);
    },
    [client, workflowId, onError, isMounted],
  );

  const observe = useCallback(
    async ({ runId, storeRunResult }: ObserveParams): Promise<void> => {
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
      const readableStream = await run.observeStream();

      if (!readableStream) {
        onError?.(new Error('No stream returned'), { operation: 'observe' });
        setIsStreaming(false);
        return;
      }

      const { reader } = await processWorkflowStream({
        stream: readableStream,
        onChunk: setStreamResult,
        onStreamingChange: setIsStreaming,
        onError,
        isMounted,
        operation: 'observe',
      });

      readerManagerRef.current.set('observe', reader);
    },
    [client, workflowId, onError, isMounted],
  );

  const resume = useCallback(
    async ({
      runId,
      step,
      resumeData,
      requestContext: contextData,
      tracingOptions,
      perStep,
    }: ResumeParams): Promise<void> => {
      readerManagerRef.current.release('resume');
      if (!isMounted()) return;

      setIsStreaming(true);

      const requestContext = buildRequestContext(contextData);
      const workflow = client.getWorkflow(workflowId);
      const run = await workflow.createRun({ runId });

      const readableStream = await run.resumeStream({
        step,
        resumeData,
        requestContext,
        tracingOptions,
        perStep,
      });

      if (!readableStream) {
        onError?.(new Error('No stream returned'), { operation: 'resume' });
        setIsStreaming(false);
        return;
      }

      const { reader } = await processWorkflowStream({
        stream: readableStream,
        onChunk: setStreamResult,
        onStreamingChange: setIsStreaming,
        onError,
        isMounted,
        operation: 'resume',
      });

      readerManagerRef.current.set('resume', reader);
    },
    [client, workflowId, onError, isMounted],
  );

  const timeTravel = useCallback(
    async ({ runId, requestContext: contextData, ...params }: TimeTravelStreamParams): Promise<void> => {
      readerManagerRef.current.release('timeTravel');
      if (!isMounted()) return;

      setIsStreaming(true);

      const requestContext = buildRequestContext(contextData);
      const workflow = client.getWorkflow(workflowId);
      const run = await workflow.createRun({ runId });

      const readableStream = await run.timeTravelStream({
        ...params,
        requestContext,
      });

      if (!readableStream) {
        onError?.(new Error('No stream returned'), { operation: 'timeTravel' });
        setIsStreaming(false);
        return;
      }

      const { reader } = await processWorkflowStream({
        stream: readableStream,
        onChunk: setStreamResult,
        onStreamingChange: setIsStreaming,
        onError,
        isMounted,
        operation: 'timeTravel',
      });

      readerManagerRef.current.set('timeTravel', reader);
    },
    [client, workflowId, onError, isMounted],
  );

  const reset = useCallback(() => {
    setIsStreaming(false);
    setStreamResult({} as WorkflowStreamResult);
    readerManagerRef.current.releaseAll();
  }, []);

  return {
    streamResult,
    isStreaming,
    stream,
    observe,
    resume,
    timeTravel,
    reset,
    setStreamResult,
  };
}
