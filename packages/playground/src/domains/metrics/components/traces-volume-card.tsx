import { EntityType } from '@mastra/core/observability';
import { TracesVolumeCardView, useDrilldown, useTraceVolumeMetrics } from '@mastra/playground-ui';
import type { VolumeTab } from '@mastra/playground-ui';
import { OpenErrorsInLogsButton, OpenInTracesButton } from './card-action-buttons';

const TAB_TO_ROOT_ENTITY: Record<VolumeTab, EntityType> = {
  agents: EntityType.AGENT,
  workflows: EntityType.WORKFLOW_RUN,
  tools: EntityType.TOOL,
};

export function TracesVolumeCard() {
  const { data, isLoading, isError } = useTraceVolumeMetrics();
  const { getTracesHref, getLogsHref } = useDrilldown();

  return (
    <TracesVolumeCardView
      data={data}
      isLoading={isLoading}
      isError={isError}
      getRowHref={(tab, row) => getTracesHref({ rootEntityType: TAB_TO_ROOT_ENTITY[tab], entityName: row.name })}
      getErrorSegmentHref={(tab, row) =>
        row.errors > 0
          ? getLogsHref({ rootEntityType: TAB_TO_ROOT_ENTITY[tab], entityName: row.name, status: 'error' })
          : undefined
      }
      actions={(tab: VolumeTab) => (
        <>
          <OpenInTracesButton href={getTracesHref({ rootEntityType: TAB_TO_ROOT_ENTITY[tab] })} />
          <OpenErrorsInLogsButton href={getLogsHref({ rootEntityType: TAB_TO_ROOT_ENTITY[tab], status: 'error' })} />
        </>
      )}
    />
  );
}
