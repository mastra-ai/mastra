import type { StorageThreadType } from '@mastra/core/memory';
import { WORKFLOW_AGENT_INVOCATION_SCOPE } from '@mastra/core/workflows';
import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

import { useMergedRequestContext } from '@/domains/request-context';

function dateMs(value: Date | string | undefined | null): number | undefined {
  if (value == null) return undefined;
  const n = new Date(value).getTime();
  return Number.isFinite(n) ? n : undefined;
}

/** Earliest activity first (run timeline order). */
function sortWorkflowRunThreads(threads: StorageThreadType[]): StorageThreadType[] {
  return [...threads].sort((a, b) => {
    const ta = dateMs(a.createdAt) ?? dateMs(a.updatedAt) ?? 0;
    const tb = dateMs(b.createdAt) ?? dateMs(b.updatedAt) ?? 0;
    if (ta !== tb) return ta - tb;
    return String(a.id).localeCompare(String(b.id));
  });
}

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
) {
  const client = useMastraClient();
  const requestContext = useMergedRequestContext();

  return useQuery({
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
      return sortWorkflowRunThreads(threads);
    },
    enabled: Boolean(workflowId && runId),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}
