import { EntityType } from '@mastra/core/observability';
import { OpenInTracesButton } from '@mastra/playground-ui/domains/metrics/components/card-action-buttons';
import { TokenUsageByAgentCardView } from '@mastra/playground-ui/domains/metrics/components/token-usage-by-agent-card-view';
import { useDrilldown } from '@mastra/playground-ui/domains/metrics/hooks/use-drilldown';
import { useMetricsFilters } from '@mastra/playground-ui/domains/metrics/hooks/use-metrics-filters';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { useTokenUsageByAgentMetrics } from '@mastra/react/hooks';

export function TokenUsageByAgentCard() {
  const { data, isLoading, isError } = useTokenUsageByAgentMetrics(useMetricsFilters());
  const { getTracesHref } = useDrilldown();
  const { Link } = useLinkComponent();

  return (
    <TokenUsageByAgentCardView
      data={data}
      isLoading={isLoading}
      isError={isError}
      LinkComponent={Link}
      getRowHref={row => getTracesHref({ rootEntityType: EntityType.AGENT, entityName: row.name })}
      actions={<OpenInTracesButton href={getTracesHref({ rootEntityType: EntityType.AGENT })} LinkComponent={Link} />}
    />
  );
}
