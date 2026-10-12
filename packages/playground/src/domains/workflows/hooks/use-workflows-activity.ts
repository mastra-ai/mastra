import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import type { OverviewRange, PeriodWindow } from '@/domains/overview/overview-period';
import { fetchRunActivity } from '@/domains/overview/run-activity';

const WORKFLOW_RUN_METRIC = 'mastra_workflow_duration_ms';

export function useWorkflowsActivity({
  range,
  window,
  windowKey,
  enabled,
}: {
  range: OverviewRange;
  window: PeriodWindow;
  windowKey: string;
  enabled: boolean;
}) {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['overview', 'workflows-activity', range, windowKey],
    queryFn: () => fetchRunActivity(client, { metricName: WORKFLOW_RUN_METRIC, window, range }),
    enabled,
  });
}
