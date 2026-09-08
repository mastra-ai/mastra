import {
  ArrowDownToLineIcon,
  ArrowUpFromLineIcon,
  CalendarClockIcon,
  CircleDollarSignIcon,
  ExternalLinkIcon,
  TimerIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { TraceUsageSummary } from '../trace-list-columns';
import {
  formatSpanDuration,
  formatSpanDurationExact,
  formatSpanTimestamp,
  formatSpanTimestampExact,
} from '../utils/span-utils';
import { formatCompact, formatCost } from '@/domains/metrics/components/metrics-utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { AgentIcon, WorkflowIcon } from '@/ds/icons';
import type { LinkComponent } from '@/ds/types/link-component';
import { cn } from '@/lib/utils';

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
  className?: string;
}

function SummaryItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className="flex shrink-0 cursor-help items-center gap-1 whitespace-nowrap"
          aria-label={label}
        >
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** Compact trace metadata shown under the trace side-panel heading. */
export function TraceSummaryDescription({
  rootSpan,
  usage,
  entityHref,
  LinkComponent,
  className,
}: TraceSummaryDescriptionProps) {
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
  const Link = LinkComponent ?? 'a';

  return (
    <div
      className={cn(
        'flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-ui-xs leading-ui-xs text-neutral3',
        className,
      )}
    >
      {entityName && (
        <Tooltip>
          <TooltipTrigger asChild>
            {entityHref ? (
              <Link
                href={entityHref}
                className="text-neutral4 hover:text-neutral5 flex shrink-0 items-center gap-1 whitespace-nowrap hover:underline"
              >
                <EntityIcon className="size-3.5 shrink-0" aria-hidden="true" />
                <span>{entityName}</span>
                <ExternalLinkIcon className="size-3 shrink-0" aria-hidden="true" />
              </Link>
            ) : (
              <span tabIndex={0} className="flex shrink-0 cursor-help items-center gap-1 whitespace-nowrap">
                <EntityIcon className="size-3.5 shrink-0" aria-hidden="true" />
                <span>{entityName}</span>
              </span>
            )}
          </TooltipTrigger>
          <TooltipContent>{formattedEntityType}</TooltipContent>
        </Tooltip>
      )}
      {startedAtTimestamp && exactStartedAtTimestamp && (
        <SummaryItem label={`Started at ${exactStartedAtTimestamp}`}>
          <CalendarClockIcon className="size-3.5 shrink-0" aria-hidden="true" />
          <span>{startedAtTimestamp}</span>
        </SummaryItem>
      )}
      {duration && exactDuration && (
        <SummaryItem label={`Duration ${exactDuration}`}>
          <TimerIcon className="size-3.5 shrink-0" aria-hidden="true" />
          <span>{duration}</span>
        </SummaryItem>
      )}
      {usage && (
        <>
          <SummaryItem label="Input tokens">
            <ArrowDownToLineIcon className="size-3.5 shrink-0" aria-hidden="true" />
            <span>{usage.inputTokens === undefined ? '—' : formatCompact(usage.inputTokens)}</span>
          </SummaryItem>
          <SummaryItem label="Output tokens">
            <ArrowUpFromLineIcon className="size-3.5 shrink-0" aria-hidden="true" />
            <span>{usage.outputTokens === undefined ? '—' : formatCompact(usage.outputTokens)}</span>
          </SummaryItem>
          <SummaryItem label="Estimated cost">
            <CircleDollarSignIcon className="size-3.5 shrink-0" aria-hidden="true" />
            <span>{usage.estimatedCost === undefined ? '—' : formatCost(usage.estimatedCost, usage.costUnit)}</span>
          </SummaryItem>
        </>
      )}
    </div>
  );
}
