import { EntityType } from '@mastra/core/observability';
import {
  ModelUsageCostCardView,
  OpenInTracesButton,
  useDrilldown,
  useModelUsageCostMetrics,
} from '@mastra/playground-ui';
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
