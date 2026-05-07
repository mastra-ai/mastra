import { EntityType } from '@mastra/core/observability';
import { ModelUsageCostCardView, useDrilldown, useModelUsageCostMetrics } from '@mastra/playground-ui';
import { OpenInTracesButton } from './card-action-buttons';
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
      actions={<OpenInTracesButton href={getTracesHref({ rootEntityType: EntityType.AGENT })} />}
    />
  );
}
