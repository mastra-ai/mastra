import { MemoryCardView } from '@mastra/playground-ui/domains/metrics/components/memory-card-view';
import { useDrilldown } from '@mastra/playground-ui/domains/metrics/hooks/use-drilldown';
import { useMetricsFilters } from '@mastra/playground-ui/domains/metrics/hooks/use-metrics-filters';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { useTopActiveThreadsMetrics, useTopResourcesByThreadsMetrics } from '@mastra/react/hooks/metrics';

export function MemoryCard() {
  const threads = useTopActiveThreadsMetrics(useMetricsFilters());
  const resources = useTopResourcesByThreadsMetrics(useMetricsFilters());
  const { getTracesHref } = useDrilldown();
  const { Link } = useLinkComponent();

  return (
    <MemoryCardView
      threads={{ data: threads.data, isLoading: threads.isLoading, isError: threads.isError }}
      resources={{ data: resources.data, isLoading: resources.isLoading, isError: resources.isError }}
      LinkComponent={Link}
      getThreadRowHref={row =>
        getTracesHref({
          threadId: row.threadId,
          ...(row.resourceId ? { resourceId: row.resourceId } : {}),
        })
      }
      getResourceRowHref={row => getTracesHref({ resourceId: row.resourceId })}
    />
  );
}
