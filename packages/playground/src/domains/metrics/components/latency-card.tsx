import { EntityType } from '@mastra/core/observability';
import { LatencyCardView, useDrilldown, useLatencyMetrics } from '@mastra/playground-ui';
import type { LatencyTab } from '@mastra/playground-ui';
import { useNavigate } from 'react-router';
import { OpenInTracesButton } from './card-action-buttons';

const TAB_TO_ROOT_ENTITY: Record<LatencyTab, EntityType> = {
  agents: EntityType.AGENT,
  workflows: EntityType.WORKFLOW_RUN,
  tools: EntityType.TOOL,
};

export function LatencyCard() {
  const { data, isLoading, isError } = useLatencyMetrics();
  const { getTracesHref, getBucketTracesHref } = useDrilldown();
  const navigate = useNavigate();

  return (
    <LatencyCardView
      data={data}
      isLoading={isLoading}
      isError={isError}
      onPointClick={(tab, point) => {
        const tsMs = new Date(String(point.rawTimestamp)).getTime();
        if (Number.isFinite(tsMs)) {
          void navigate(getBucketTracesHref({ rootEntityType: TAB_TO_ROOT_ENTITY[tab] }, tsMs, '1h'));
        }
      }}
      actions={(tab: LatencyTab) => (
        <OpenInTracesButton href={getTracesHref({ rootEntityType: TAB_TO_ROOT_ENTITY[tab] })} />
      )}
    />
  );
}
