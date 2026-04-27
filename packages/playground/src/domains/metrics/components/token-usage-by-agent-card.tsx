import { EntityType } from '@mastra/core/observability';
import { TokenUsageByAgentCardView, useDrilldown, useTokenUsageByAgentMetrics } from '@mastra/playground-ui';
import { OpenInTracesButton } from './card-action-buttons';

export function TokenUsageByAgentCard() {
  const { data, isLoading, isError } = useTokenUsageByAgentMetrics();
  const { getTracesHref } = useDrilldown();

  return (
    <TokenUsageByAgentCardView
      data={data}
      isLoading={isLoading}
      isError={isError}
      getRowHref={row => getTracesHref({ rootEntityType: EntityType.AGENT, entityName: row.name })}
      actions={<OpenInTracesButton href={getTracesHref({ rootEntityType: EntityType.AGENT })} />}
    />
  );
}
