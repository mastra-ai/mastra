import {
  OpenInTracesButton,
  TokenUsageByAgentCardView,
  useDrilldown,
  useTokenUsageByAgentMetrics,
} from '@mastra/playground-ui';
import { EntityType } from '@/domains/observability/entity-type';
import { useLinkComponent } from '@/lib/framework';

export function TokenUsageByAgentCard() {
  const { data, isLoading, isError } = useTokenUsageByAgentMetrics();
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
