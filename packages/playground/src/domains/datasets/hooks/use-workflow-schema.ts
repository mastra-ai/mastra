import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

/**
 * Hook to fetch workflow input/output schema by workflow ID.
 * Returns { inputSchema, outputSchema } where each is Record<string, unknown> | null.
 */
export function useWorkflowSchema(workflowId: string | null) {
  const client = useMastraClient();

  return useQuery({
    // Stryker disable next-line StringLiteral: a private cache identity — no other
    // module reads, seeds or invalidates this key, so renaming it is unobservable.
    queryKey: ['workflow-schema', workflowId],
    queryFn: async () => {
      // Stryker disable next-line ConditionalExpression,StringLiteral,CallExpression: unreachable in
      // practice. `enabled: !!workflowId` already stops react-query from ever running
      // this queryFn without an id; the guard only narrows the type for TypeScript.
      if (!workflowId) throw new Error('No workflow selected');
      return client.getWorkflow(workflowId).getSchema();
    },
    enabled: !!workflowId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}
