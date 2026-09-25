import {
  ArrowDownToLineIcon,
  ArrowUpFromLineIcon,
  CalendarClockIcon,
  CircleDollarSignIcon,
  TimerIcon,
} from 'lucide-react';
import type { TraceUsageSummary } from '../trace-list-columns';
import { getSpanDurationMs } from '../utils/span-utils';
import { TraceStatusValue } from './trace-status-value';
import type { TraceStatusValueStatus } from './trace-status-value';
import { DataPanel } from '@/ds/components/DataPanel';
import { Txt } from '@/ds/components/Txt/Txt';
import { AgentIcon, WorkflowIcon } from '@/ds/icons';
import type { LinkComponent } from '@/ds/types/link-component';
import { formatCompactNumber, formatCost } from '@/lib/cost';
import { formatDate, formatTimestampPrecise } from '@/utils/date-format';
import { formatDuration, formatDurationPrecise } from '@/utils/duration';

function formatEntityType(entityType: string): string {
  return entityType
    .split('_')
    .map(word => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ');
}

function computeTraceStatus(span: { error?: unknown; endedAt?: Date | string | null }): TraceStatusValueStatus {
  if (span.error != null) return 'error';
  if (span.endedAt == null) return 'running';
  return 'success';
}

/** Lightweight root-span fields available from `useTraceLightSpans`. */
type RootSpanSummary = {
  entityId?: string | null;
  entityName?: string | null;
  entityType?: string | null;
  startedAt: Date | string;
  endedAt?: Date | string | null;
  error?: unknown;
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
  const duration = formatDuration(getSpanDurationMs(startedAt, endedAt));
  const exactDuration = formatDurationPrecise(getSpanDurationMs(startedAt, endedAt));
  const startedAtTimestamp = formatDate(startedAt, 'time');
  const exactStartedAtTimestamp = formatTimestampPrecise(startedAt);

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
            tooltip={`See ${formattedEntityType.toLowerCase()}`}
          >
            {entityName}
          </DataPanel.Meta>
        ) : (
          <DataPanel.Meta icon={<EntityIcon />} tooltip={formattedEntityType}>
            {entityName}
          </DataPanel.Meta>
        ))}
      <DataPanel.Meta tooltip="Trace status">
        <TraceStatusValue status={computeTraceStatus(rootSpan)} />
      </DataPanel.Meta>
      {startedAtTimestamp && exactStartedAtTimestamp && (
        <DataPanel.Meta icon={<CalendarClockIcon />} tooltip={`Started at ${exactStartedAtTimestamp}`}>
          {startedAtTimestamp}
        </DataPanel.Meta>
      )}
      {duration && exactDuration && (
        <DataPanel.Meta icon={<TimerIcon />} tooltip={`Duration ${exactDuration}`}>
          <Txt as="span" variant="label" font="mono">
            {duration}
          </Txt>
        </DataPanel.Meta>
      )}
      {usage && (
        <>
          <DataPanel.Meta icon={<ArrowDownToLineIcon />} tooltip="Input tokens">
            {usage.inputTokens === undefined ? '—' : formatCompactNumber(usage.inputTokens)}
          </DataPanel.Meta>
          <DataPanel.Meta icon={<ArrowUpFromLineIcon />} tooltip="Output tokens">
            {usage.outputTokens === undefined ? '—' : formatCompactNumber(usage.outputTokens)}
          </DataPanel.Meta>
          <DataPanel.Meta icon={<CircleDollarSignIcon />} tooltip="Estimated cost">
            {usage.estimatedCost === undefined ? '—' : formatCost(usage.estimatedCost, usage.costUnit)}
          </DataPanel.Meta>
        </>
      )}
    </DataPanel.Metadata>
  );
}
