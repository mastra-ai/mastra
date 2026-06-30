import { EntityType } from '@mastra/core/observability';
import { OpenInTracesButton } from '@mastra/playground-ui/domains/metrics/components/card-action-buttons';
import { ModelUsageCostCardView } from '@mastra/playground-ui/domains/metrics/components/model-usage-cost-card-view';
import { useDrilldown } from '@mastra/playground-ui/domains/metrics/hooks/use-drilldown';
import { useModelUsageCostMetrics } from '@mastra/playground-ui/domains/metrics/hooks/use-model-usage-cost-metrics';
import { useLinkComponent } from '@/lib/framework';

export function ModelUsageCostCard() {
  const { data, isLoading, isError } = useModelUsageCostMetrics();
  const { getTracesHref } = useDrilldown();
  const { Link } = useLinkComponent();

  return (
    <ModelUsageCostCardView
      rows={data}
      isLoading={isLoading}
      isError={isError}
      LinkComponent={Link}
      // Model-specific filtering on traces is not yet available — row
      // drilldowns land on the agent-scoped traces list for now.
      getRowHref={() => getTracesHref({ rootEntityType: EntityType.AGENT })}
      actions={<OpenInTracesButton href={getTracesHref({ rootEntityType: EntityType.AGENT })} LinkComponent={Link} />}
    />
  );
}
