import { MemoryCardView } from '@mastra/playground-ui/domains/metrics/components/memory-card-view';
import { useDrilldown } from '@mastra/playground-ui/domains/metrics/hooks/use-drilldown';
import { useTopActiveThreadsMetrics } from '@mastra/playground-ui/domains/metrics/hooks/use-top-active-threads-metrics';
import { useTopResourcesByThreadsMetrics } from '@mastra/playground-ui/domains/metrics/hooks/use-top-resources-by-threads-metrics';
import { useLinkComponent } from '@/lib/framework';

export function MemoryCard() {
  const threads = useTopActiveThreadsMetrics();
  const resources = useTopResourcesByThreadsMetrics();
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
