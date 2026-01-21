import { useState, useCallback, useRef } from 'react';
import { RequestContext } from '@mastra/core/request-context';
import { useMastraClient } from '../mastra-client-context';
import type {
  MutationState,
  CreateWorkflowRunParams,
  CreateWorkflowRunResult,
  StartWorkflowRunParams,
  UseExecuteWorkflowReturn,
} from './types';

/**
 * Internal helper hook that provides mutation-like functionality without react-query.
 * Tracks pending, success, and error states for async operations.
 */
function useMutation<TData, TError extends Error, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
): MutationState<TData, TError, TVariables> {
  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<TError | null>(null);
  const [data, setData] = useState<TData | undefined>(undefined);

  const mutationFnRef = useRef(mutationFn);
  mutationFnRef.current = mutationFn;

  const reset = useCallback(() => {
    setIsPending(false);
    setIsSuccess(false);
    setIsError(false);
    setError(null);
    setData(undefined);
  }, []);

  const mutateAsync = useCallback(async (variables: TVariables): Promise<TData> => {
    setIsPending(true);
    setIsSuccess(false);
    setIsError(false);
    setError(null);

    try {
      const result = await mutationFnRef.current(variables);
      setData(result);
      setIsSuccess(true);
      return result;
    } catch (err) {
      const typedError = err as TError;
      setError(typedError);
      setIsError(true);
      throw err;
    } finally {
      setIsPending(false);
    }
  }, []);

  const mutate = useCallback(
    (variables: TVariables) => {
      mutateAsync(variables).catch(() => {
        // Error is already captured in state
      });
    },
    [mutateAsync],
  );

  return {
    mutate,
    mutateAsync,
    isPending,
    isSuccess,
    isError,
    error,
    data,
    reset,
  };
}

/**
 * Hook for executing workflows.
 * Provides mutation functions for creating and starting workflow runs.
 *
 * @example
 * ```tsx
 * const { createWorkflowRun, startWorkflowRun } = useExecuteWorkflow();
 *
 * // Create a run
 * const { runId } = await createWorkflowRun.mutateAsync({
 *   workflowId: 'my-workflow'
 * });
 *
 * // Start the run
 * await startWorkflowRun.mutateAsync({
 *   workflowId: 'my-workflow',
 *   runId,
 *   input: { foo: 'bar' }
 * });
 * ```
 */
export function useExecuteWorkflow(): UseExecuteWorkflowReturn {
  const client = useMastraClient();

  const createWorkflowRun = useMutation<CreateWorkflowRunResult, Error, CreateWorkflowRunParams>(
    async ({ workflowId, prevRunId }) => {
      try {
        const workflow = client.getWorkflow(workflowId);
        const { runId: newRunId } = await workflow.createRun({ runId: prevRunId });
        return { runId: newRunId };
      } catch (error) {
        console.error('Error creating workflow run:', error);
        throw error;
      }
    },
  );

  const startWorkflowRun = useMutation<void, Error, StartWorkflowRunParams>(
    async ({ workflowId, runId, input, requestContext: playgroundRequestContext }) => {
      try {
        const requestContext = new RequestContext();
        if (playgroundRequestContext) {
          Object.entries(playgroundRequestContext).forEach(([key, value]) => {
            requestContext.set(key, value);
          });
        }

        const workflow = client.getWorkflow(workflowId);
        const run = await workflow.createRun({ runId });
        await run.start({ inputData: input || {}, requestContext });
      } catch (error) {
        console.error('Error starting workflow run:', error);
        throw error;
      }
    },
  );

  return {
    createWorkflowRun,
    startWorkflowRun,
  };
}
