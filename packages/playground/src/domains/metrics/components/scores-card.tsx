import { EntityType } from '@mastra/core/observability';
import { ScoresCardView, useDrilldown, useScoresMetrics } from '@mastra/playground-ui';
import { OpenInTracesButton } from './card-action-buttons';

export function ScoresCard() {
  const { data, isLoading, isError } = useScoresMetrics();
  const { getTracesHref } = useDrilldown();

  return (
    <ScoresCardView
      data={data}
      isLoading={isLoading}
      isError={isError}
      getSummaryRowHref={row => getTracesHref({ rootEntityType: EntityType.SCORER, entityName: row.scorer })}
      actions={<OpenInTracesButton href={getTracesHref({ rootEntityType: EntityType.SCORER })} />}
    />
  );
}
