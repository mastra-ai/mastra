/**
 * Represents the state of a mutation operation.
 * Mimics the essential return type of react-query's useMutation.
 */
export interface MutationState<TData, TError extends Error, TVariables> {
  /** Execute the mutation without waiting for the result */
  mutate: (variables: TVariables) => void;
  /** Execute the mutation and return a promise with the result */
  mutateAsync: (variables: TVariables) => Promise<TData>;
  /** Whether the mutation is currently executing */
  isPending: boolean;
  /** Whether the mutation completed successfully */
  isSuccess: boolean;
  /** Whether the mutation failed with an error */
  isError: boolean;
  /** The error if the mutation failed, null otherwise */
  error: TError | null;
  /** The data returned by the mutation if successful */
  data: TData | undefined;
  /** Reset the mutation state to initial values */
  reset: () => void;
}

/**
 * Parameters for creating a workflow run.
 */
export interface CreateWorkflowRunParams {
  /** The ID of the workflow to create a run for */
  workflowId: string;
  /** Optional previous run ID to continue from */
  prevRunId?: string;
}

/**
 * Result of creating a workflow run.
 */
export interface CreateWorkflowRunResult {
  /** The ID of the newly created run */
  runId: string;
}

/**
 * Parameters for starting a workflow run.
 */
export interface StartWorkflowRunParams {
  /** The ID of the workflow */
  workflowId: string;
  /** The ID of the run to start */
  runId: string;
  /** Input data for the workflow */
  input: Record<string, unknown>;
  /** Optional request context to pass to the workflow */
  requestContext?: Record<string, unknown>;
}

/**
 * Return type for the useExecuteWorkflow hook.
 */
export interface UseExecuteWorkflowReturn {
  /** Mutation for creating a workflow run */
  createWorkflowRun: MutationState<CreateWorkflowRunResult, Error, CreateWorkflowRunParams>;
  /** Mutation for starting a workflow run */
  startWorkflowRun: MutationState<void, Error, StartWorkflowRunParams>;
}
