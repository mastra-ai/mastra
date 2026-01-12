import { useState, useCallback } from 'react';
import { useMastraClient } from '../mastra-client-context';
import { buildRequestContext } from './build-request-context';
import type { CreateRunParams, StartRunParams, StartAsyncRunParams, CancelRunParams } from './types';

export interface UseWorkflowRunOptions {
  workflowId: string;
  onError?: (error: Error, context: { operation: string }) => void;
}

export interface UseWorkflowRunReturn {
  createRun: (params?: CreateRunParams) => Promise<{ runId: string }>;
  startRun: (params: StartRunParams) => Promise<void>;
  startAsync: (params: StartAsyncRunParams) => Promise<unknown>;
  cancelRun: (params: CancelRunParams) => Promise<{ message: string }>;
  isPending: {
    createRun: boolean;
    startRun: boolean;
    startAsync: boolean;
    cancelRun: boolean;
  };
}

/**
 * Hook for managing workflow run lifecycle operations.
 * Provides unified API for creating, starting, and canceling workflow runs.
 */
export function useWorkflowRun({ workflowId, onError }: UseWorkflowRunOptions): UseWorkflowRunReturn {
  const client = useMastraClient();

  const [isPending, setIsPending] = useState({
    createRun: false,
    startRun: false,
    startAsync: false,
    cancelRun: false,
  });

  const createRun = useCallback(
    async (params?: CreateRunParams): Promise<{ runId: string }> => {
      setIsPending(prev => ({ ...prev, createRun: true }));
      try {
        const workflow = client.getWorkflow(workflowId);
        const { runId } = await workflow.createRun({ runId: params?.prevRunId });
        return { runId };
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        onError?.(err, { operation: 'createRun' });
        throw error;
      } finally {
        setIsPending(prev => ({ ...prev, createRun: false }));
      }
    },
    [client, workflowId, onError],
  );

  const startRun = useCallback(
    async ({ runId, input, requestContext: contextData }: StartRunParams): Promise<void> => {
      setIsPending(prev => ({ ...prev, startRun: true }));
      try {
        const requestContext = buildRequestContext(contextData);
        const workflow = client.getWorkflow(workflowId);
        const run = await workflow.createRun({ runId });
        await run.start({ inputData: input || {}, requestContext });
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        onError?.(err, { operation: 'startRun' });
        throw error;
      } finally {
        setIsPending(prev => ({ ...prev, startRun: false }));
      }
    },
    [client, workflowId, onError],
  );

  const startAsync = useCallback(
    async ({ runId, input, requestContext: contextData }: StartAsyncRunParams): Promise<unknown> => {
      setIsPending(prev => ({ ...prev, startAsync: true }));
      try {
        const requestContext = buildRequestContext(contextData);
        const workflow = client.getWorkflow(workflowId);
        const run = await workflow.createRun({ runId });
        const result = await run.startAsync({ inputData: input || {}, requestContext });
        return result;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        onError?.(err, { operation: 'startAsync' });
        throw error;
      } finally {
        setIsPending(prev => ({ ...prev, startAsync: false }));
      }
    },
    [client, workflowId, onError],
  );

  const cancelRun = useCallback(
    async ({ runId }: CancelRunParams): Promise<{ message: string }> => {
      setIsPending(prev => ({ ...prev, cancelRun: true }));
      try {
        const workflow = client.getWorkflow(workflowId);
        const run = await workflow.createRun({ runId });
        const response = await run.cancel();
        return response;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        onError?.(err, { operation: 'cancelRun' });
        throw error;
      } finally {
        setIsPending(prev => ({ ...prev, cancelRun: false }));
      }
    },
    [client, workflowId, onError],
  );

  return {
    createRun,
    startRun,
    startAsync,
    cancelRun,
    isPending,
  };
}
