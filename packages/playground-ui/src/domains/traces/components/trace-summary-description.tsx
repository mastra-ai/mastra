import {
  ArrowDownToLineIcon,
  ArrowUpFromLineIcon,
  CalendarClockIcon,
  CircleDollarSignIcon,
  TimerIcon,
} from 'lucide-react';
import type { TraceUsageSummary } from '../trace-list-columns';
import {
  formatSpanDuration,
  formatSpanDurationExact,
  formatSpanTimestamp,
  formatSpanTimestampExact,
} from '../utils/span-utils';
import { formatCompact, formatCost } from '@/domains/metrics/components/metrics-utils';
import { DataPanel } from '@/ds/components/DataPanel';
import { AgentIcon, WorkflowIcon } from '@/ds/icons';
import type { LinkComponent } from '@/ds/types/link-component';

function formatEntityType(entityType: string): string {
  return entityType
    .split('_')
    .map(word => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ');
}

/** Lightweight root-span fields available from `useTraceLightSpans`. */
type RootSpanSummary = {
  entityId?: string | null;
  entityName?: string | null;
  entityType?: string | null;
  startedAt: Date | string;
  endedAt?: Date | string | null;
};

export interface TraceSummaryDescriptionProps {
  rootSpan: RootSpanSummary;
  usage?: TraceUsageSummary;
  /** When provided (with `LinkComponent`), the entity name links to the entity's page. */
  entityHref?: string;
  LinkComponent?: LinkComponent;
}

/** Compact trace metadata shown under the trace side-panel heading. */
export function TraceSummaryDescription({ rootSpan, usage, entityHref, LinkComponent }: TraceSummaryDescriptionProps) {
  const startedAt = rootSpan.startedAt ? new Date(rootSpan.startedAt) : null;
  const endedAt = rootSpan.endedAt ? new Date(rootSpan.endedAt) : null;
  const duration = formatSpanDuration(startedAt, endedAt);
  const exactDuration = formatSpanDurationExact(startedAt, endedAt);
  const startedAtTimestamp = formatSpanTimestamp(startedAt);
  const exactStartedAtTimestamp = formatSpanTimestampExact(startedAt);

  const entityName = rootSpan.entityName || rootSpan.entityId;
  const entityType = rootSpan.entityType;
  const formattedEntityType = entityType ? formatEntityType(entityType) : 'Entity';
  const EntityIcon = entityType?.includes('workflow') ? WorkflowIcon : AgentIcon;

  return (
    <DataPanel.Metadata>
      {entityName &&
        (entityHref ? (
          <DataPanel.Meta
            as={LinkComponent ?? 'a'}
            href={entityHref}
            icon={<EntityIcon />}
            tooltip={formattedEntityType}
          >
            {entityName}
          </DataPanel.Meta>
        ) : (
          <DataPanel.Meta icon={<EntityIcon />} tooltip={formattedEntityType}>
            {entityName}
          </DataPanel.Meta>
        ))}
      {startedAtTimestamp && exactStartedAtTimestamp && (
        <DataPanel.Meta icon={<CalendarClockIcon />} tooltip={`Started at ${exactStartedAtTimestamp}`}>
          {startedAtTimestamp}
        </DataPanel.Meta>
      )}
      {duration && exactDuration && (
        <DataPanel.Meta icon={<TimerIcon />} tooltip={`Duration ${exactDuration}`}>
          {duration}
        </DataPanel.Meta>
      )}
      {usage && (
        <>
          <DataPanel.Meta icon={<ArrowDownToLineIcon />} tooltip="Input tokens">
            {usage.inputTokens === undefined ? '—' : formatCompact(usage.inputTokens)}
          </DataPanel.Meta>
          <DataPanel.Meta icon={<ArrowUpFromLineIcon />} tooltip="Output tokens">
            {usage.outputTokens === undefined ? '—' : formatCompact(usage.outputTokens)}
          </DataPanel.Meta>
          <DataPanel.Meta icon={<CircleDollarSignIcon />} tooltip="Estimated cost">
            {usage.estimatedCost === undefined ? '—' : formatCost(usage.estimatedCost, usage.costUnit)}
          </DataPanel.Meta>
        </>
      )}
    </DataPanel.Metadata>
  );
}
