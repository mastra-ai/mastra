import { WORKFLOW_AGENT_INVOCATION_SCOPE } from '@mastra/core/workflows';
import type { WorkflowStateStepResult } from '@mastra/core/workflows';
import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { sortWorkflowRunThreads } from '../workflow-run-conversations-sort';
import { useMergedRequestContext } from '@/domains/request-context';

/**
 * Lists memory threads produced by agent workflow steps (`createStep(agent)`) during a workflow run.
 *
 * **Metadata filter:** We intentionally match on `workflowRunId` + `scope` only. Thread metadata stores
 * `workflowId` as the workflow definition's `id` from `createWorkflow({ id })`, while Studio URLs use the
 * Mastra registry **key** (the property name in `new Mastra({ workflows: { myKey: wf } })`). Those often
 * differ, so filtering by route `workflowId` would drop valid threads.
 *
 * `workflowId` stays in the React Query cache key so each workflow page keeps separate entries.
 */
export function useWorkflowRunAgentConversations(
  workflowId: string | undefined,
  runId: string | undefined,
  /** Bumps the query cache when the run finishes so we refetch persisted threads */
  runStatus?: string | null,
  /** When present, step `startedAt` values sort transcripts in true run order (not title / DB clock ties). */
  runSteps?: Record<string, WorkflowStateStepResult>,
) {
  const client = useMastraClient();
  const requestContext = useMergedRequestContext();

  const query = useQuery({
    queryKey: ['workflow-run-agent-conversations', workflowId, runId, runStatus, requestContext],
    queryFn: async () => {
      if (!workflowId || !runId) {
        return [];
      }
      const { threads } = await client.listMemoryThreads({
        metadata: {
          workflowRunId: runId,
          scope: WORKFLOW_AGENT_INVOCATION_SCOPE,
        },
        requestContext,
      });
      return threads;
    },
    enabled: Boolean(workflowId && runId),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const data = useMemo(() => sortWorkflowRunThreads(query.data ?? [], runSteps), [query.data, runSteps]);

  return { ...query, data };
}
