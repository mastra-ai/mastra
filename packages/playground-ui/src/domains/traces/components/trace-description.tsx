import { format } from 'date-fns';

import { formatSpanDuration, formatSpanDurationExact } from '../utils/span-utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { AgentIcon } from '@/ds/icons/AgentIcon';
import { WorkflowIcon } from '@/ds/icons/WorkflowIcon';
import type { LinkComponent } from '@/ds/types/link-component';
import { cn } from '@/lib/utils';

/** Root-span fields the description reads. Same shape as the light span list gives. */
type RootSpanSummary = {
  entityId?: string | null;
  entityName?: string | null;
  entityType?: string | null;
  startedAt: Date | string;
  endedAt?: Date | string | null;
};

type Entity = { label: string; icon: typeof AgentIcon; href?: string };

/**
 * What the root entity is, and where — if anywhere — the reader can go see it.
 * Only entities with a page of their own get a link; a scorer or an ingestion run has none.
 */
function describeEntity(entityType: string, entityId: string): Entity | undefined {
  const encoded = encodeURIComponent(entityId);

  switch (entityType.toLowerCase()) {
    case 'agent':
      return { label: 'Agent', icon: AgentIcon, href: `/agents/${encoded}` };
    case 'workflow':
    case 'workflow_run':
      return { label: 'Workflow', icon: WorkflowIcon, href: `/workflows/${encoded}/graph` };
    case 'scorer':
      return { label: 'Scorer', icon: AgentIcon };
    default:
      return undefined;
  }
}

export interface TraceDescriptionProps {
  rootSpan: RootSpanSummary;
  LinkComponent?: LinkComponent;
  className?: string;
}

/**
 * One line under the trace title: how long it took, when it started, and which entity ran.
 * It replaces the old metadata tab — the reader gets the trace's identity without a detour.
 */
export function TraceDescription({ rootSpan, LinkComponent, className }: TraceDescriptionProps) {
  const startedAt = rootSpan.startedAt ? new Date(rootSpan.startedAt) : null;
  const endedAt = rootSpan.endedAt ? new Date(rootSpan.endedAt) : null;

  const duration = formatSpanDuration(startedAt, endedAt);
  const exactDuration = formatSpanDurationExact(startedAt, endedAt);
  const startedLabel = startedAt ? format(startedAt, 'MMM d, h:mm a') : undefined;

  const entityName = rootSpan.entityName || rootSpan.entityId;
  const entity =
    rootSpan.entityType && rootSpan.entityId ? describeEntity(rootSpan.entityType, rootSpan.entityId) : undefined;
  const EntityIcon = entity?.icon;
  const href = entity?.href;

  return (
    <div
      data-testid="trace-description"
      className={cn('flex min-w-0 items-center gap-1.5 text-ui-xs text-neutral3', className)}
    >
      {duration && (
        <span title={exactDuration} className="shrink-0">
          {duration}
        </span>
      )}
      {duration && startedLabel && (
        <span aria-hidden className="text-ui-md leading-none">
          ·
        </span>
      )}
      {startedLabel && <span className="shrink-0">{startedLabel}</span>}

      {entityName && (
        <>
          <span aria-hidden className="text-ui-md leading-none">
            ·
          </span>
          <span className="flex min-w-0 items-center gap-1.5">
            {EntityIcon && entity && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span aria-label={entity.label}>
                    <EntityIcon className="size-3 shrink-0" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>{entity.label}</TooltipContent>
              </Tooltip>
            )}
            {LinkComponent && href ? (
              <LinkComponent
                href={href}
                aria-label={`Open ${entityName}`}
                className="hover:text-neutral6 min-w-0 truncate underline-offset-2 hover:underline"
              >
                {entityName}
              </LinkComponent>
            ) : (
              <span className="min-w-0 truncate">{entityName}</span>
            )}
          </span>
        </>
      )}
    </div>
  );
}
