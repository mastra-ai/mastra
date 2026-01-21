import { useMastraClient } from '../mastra-client-context';
import { useMutation } from '../lib/use-mutation';
import type { CreateWorkflowRunParams, CreateWorkflowRunResult } from './types';

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
export function useExecuteWorkflow() {
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

  return {
    createWorkflowRun,
  };
}
