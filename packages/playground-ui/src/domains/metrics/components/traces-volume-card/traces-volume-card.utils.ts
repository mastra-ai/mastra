import { EntityType } from '@mastra/core/observability';
import type { TraceVolumeData, VolumeRow } from '@mastra/react/hooks/metrics';
import type { DrilldownScope } from '../../drilldown';

export type VolumeTab = 'agents' | 'workflows' | 'tools';

const TAB_TO_ROOT_ENTITY = {
  agents: EntityType.AGENT,
  workflows: EntityType.WORKFLOW_RUN,
  tools: EntityType.TOOL,
} satisfies Record<VolumeTab, DrilldownScope['rootEntityType']>;

export function isVolumeTab(value: string): value is VolumeTab {
  return value === 'agents' || value === 'workflows' || value === 'tools';
}

export function volumeTracesScope(tab: VolumeTab): DrilldownScope {
  return { rootEntityType: TAB_TO_ROOT_ENTITY[tab] };
}

export function volumeErrorsScope(tab: VolumeTab): DrilldownScope {
  return { rootEntityType: TAB_TO_ROOT_ENTITY[tab], status: 'error' };
}

export function volumeRowScope(tab: VolumeTab, row: VolumeRow): DrilldownScope {
  return { rootEntityType: TAB_TO_ROOT_ENTITY[tab], entityName: row.name };
}

export function volumeErrorSegmentScope(tab: VolumeTab, row: VolumeRow): DrilldownScope {
  return { rootEntityType: TAB_TO_ROOT_ENTITY[tab], entityName: row.name, status: 'error' };
}

export function totalVolume(data: TraceVolumeData): number {
  return [...data.agentData, ...data.workflowData, ...data.toolData].reduce(
    (sum, row) => sum + row.completed + row.errors,
    0,
  );
}
