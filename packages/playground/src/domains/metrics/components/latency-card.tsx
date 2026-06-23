import { EntityType } from '@mastra/core/observability';
import { LatencyCardView, OpenInTracesButton, useDrilldown, useLatencyMetrics } from '@mastra/playground-ui';
import type { LatencyTab } from '@mastra/playground-ui';
import { useNavigate } from 'react-router';
import { useLinkComponent } from '@/lib/framework';

const TAB_TO_ROOT_ENTITY: Record<LatencyTab, EntityType> = {
  agents: EntityType.AGENT,
  workflows: EntityType.WORKFLOW_RUN,
  tools: EntityType.TOOL,
};

export function LatencyCard() {
  const { data, isLoading, isError } = useLatencyMetrics();
  const { getTracesHref, getBucketTracesHref } = useDrilldown();
  const { Link } = useLinkComponent();
  const navigate = useNavigate();

  return (
    <LatencyCardView
      data={data}
      isLoading={isLoading}
      isError={isError}
      onPointClick={(tab, point) => {
        if (Number.isFinite(point.tsMs)) {
          void navigate(getBucketTracesHref({ rootEntityType: TAB_TO_ROOT_ENTITY[tab] }, point.tsMs, '1h'));
        }
      }}
      actions={(tab: LatencyTab) => (
        <OpenInTracesButton href={getTracesHref({ rootEntityType: TAB_TO_ROOT_ENTITY[tab] })} LinkComponent={Link} />
      )}
    />
  );
}
