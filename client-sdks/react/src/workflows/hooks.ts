import { useMastraClient } from '../mastra-client-context';
import { useMutation } from '../lib/use-mutation';
import type {
  CreateWorkflowRunParams,
  CreateWorkflowRunResult,
  CancelWorkflowRunParams,
  CancelWorkflowRunResult,
} from './types';

export { useStreamWorkflow } from './use-stream-workflow';

/**
 * Hook for creating workflow runs.
 * Returns a mutation for creating a new workflow run.
 *
 * @example
 * ```tsx
 * const createWorkflowRun = useCreateWorkflowRun();
 *
 * // Create a run
 * const { runId } = await createWorkflowRun.mutateAsync({
 *   workflowId: 'my-workflow'
 * });
 * ```
 */
export function useCreateWorkflowRun() {
  const client = useMastraClient();

  return useMutation<CreateWorkflowRunResult, Error, CreateWorkflowRunParams>(async ({ workflowId, prevRunId }) => {
    try {
      const workflow = client.getWorkflow(workflowId);
      const { runId: newRunId } = await workflow.createRun({ runId: prevRunId });
      return { runId: newRunId };
    } catch (error) {
      console.error('Error creating workflow run:', error);
      throw error;
    }
  });
}

/**
 * Hook for canceling workflow runs.
 * Returns a mutation for canceling a running workflow.
 *
 * @example
 * ```tsx
 * const cancelWorkflowRun = useCancelWorkflowRun();
 *
 * // Cancel a run
 * await cancelWorkflowRun.mutateAsync({
 *   workflowId: 'my-workflow',
 *   runId: 'run-123'
 * });
 * ```
 */
export function useCancelWorkflowRun() {
  const client = useMastraClient();

  return useMutation<CancelWorkflowRunResult, Error, CancelWorkflowRunParams>(async ({ workflowId, runId }) => {
    try {
      const workflow = client.getWorkflow(workflowId);
      const run = await workflow.createRun({ runId });
      return run.cancelRun();
    } catch (error) {
      console.error('Error canceling workflow run:', error);
      throw error;
    }
  });
}
