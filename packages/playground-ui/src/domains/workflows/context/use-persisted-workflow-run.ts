import type { GetWorkflowRunByIdResponse } from '@mastra/client-js';
import { useWorkflowRun } from '@mastra/react/hooks/workflows';
import { useMemo } from 'react';

import { getRunTimestamp, isWorkflowRunFinished } from '../utils';

const RUN_POLL_INTERVAL_MS = 5000;

const pollUntilRunFinished: NonNullable<
  NonNullable<Parameters<typeof useWorkflowRun>[0]['queryOptions']>['refetchInterval']
> = query => (isWorkflowRunFinished(query.state.data?.status) ? false : RUN_POLL_INTERVAL_MS);

function withRunTimestamp(run: GetWorkflowRunByIdResponse) {
  return { ...run, timestamp: getRunTimestamp(run.updatedAt) ?? getRunTimestamp(run.createdAt) };
}

export function usePersistedWorkflowRun(workflowId: string, runId: string, { poll }: { poll: boolean }) {
  const { data, isLoading } = useWorkflowRun({
    workflowId,
    runId,
    queryOptions: {
      enabled: Boolean(workflowId && runId),
      refetchInterval: poll ? pollUntilRunFinished : undefined,
    },
  });
  const persistedRun = useMemo(() => data && withRunTimestamp(data), [data]);
  return { persistedRun, isLoading };
}
