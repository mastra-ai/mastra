import type { GetWorkflowRunByIdResponse } from '@mastra/client-js';
import { useMemo } from 'react';

import { getRunTimestamp, isWorkflowRunFinished } from '../utils';
import { useWorkflowRun } from '@/hooks';

const RUN_POLL_INTERVAL_MS = 5000;

const pollUntilRunFinished: Parameters<typeof useWorkflowRun>[2] = query =>
  isWorkflowRunFinished(query.state.data?.status) ? false : RUN_POLL_INTERVAL_MS;

function withRunTimestamp(run: GetWorkflowRunByIdResponse) {
  return { ...run, timestamp: getRunTimestamp(run.updatedAt) ?? getRunTimestamp(run.createdAt) };
}

export function usePersistedWorkflowRun(workflowId: string, runId: string, { poll }: { poll: boolean }) {
  const { data, isLoading } = useWorkflowRun(workflowId, runId, poll ? pollUntilRunFinished : undefined);
  const persistedRun = useMemo(() => data && withRunTimestamp(data), [data]);
  return { persistedRun, isLoading };
}
