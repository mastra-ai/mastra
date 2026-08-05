import { EntityType } from '@mastra/core/observability';
import {
  OpenErrorsInLogsButton,
  OpenInTracesButton,
} from '@mastra/playground-ui/domains/metrics/components/card-action-buttons';
import { TracesVolumeCardView } from '@mastra/playground-ui/domains/metrics/components/traces-volume-card-view';
import type { VolumeTab } from '@mastra/playground-ui/domains/metrics/components/traces-volume-card-view';
import { useDrilldown } from '@mastra/playground-ui/domains/metrics/hooks/use-drilldown';
import { useTraceVolumeMetrics } from '@mastra/playground-ui/domains/metrics/hooks/use-trace-volume-metrics';
import { useLinkComponent } from '@/lib/framework';

const TAB_TO_ROOT_ENTITY: Record<VolumeTab, EntityType> = {
  agents: EntityType.AGENT,
  workflows: EntityType.WORKFLOW_RUN,
  tools: EntityType.TOOL,
};

export function TracesVolumeCard() {
  const { data, isLoading, isError } = useTraceVolumeMetrics();
  const { getTracesHref, getLogsHref } = useDrilldown();
  const { Link } = useLinkComponent();

  return (
    <TracesVolumeCardView
      data={data}
      isLoading={isLoading}
      isError={isError}
      LinkComponent={Link}
      getRowHref={(tab, row) => getTracesHref({ rootEntityType: TAB_TO_ROOT_ENTITY[tab], entityName: row.name })}
      getErrorSegmentHref={(tab, row) =>
        row.errors > 0
          ? getLogsHref({ rootEntityType: TAB_TO_ROOT_ENTITY[tab], entityName: row.name, status: 'error' })
          : undefined
      }
      actions={(tab: VolumeTab) => (
        <>
          <OpenInTracesButton href={getTracesHref({ rootEntityType: TAB_TO_ROOT_ENTITY[tab] })} LinkComponent={Link} />
          <OpenErrorsInLogsButton
            href={getLogsHref({ rootEntityType: TAB_TO_ROOT_ENTITY[tab], status: 'error' })}
            LinkComponent={Link}
          />
        </>
      )}
    />
  );
}
