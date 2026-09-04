import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { ScrollText } from 'lucide-react';
import { useState } from 'react';

import { useAuditEvents, useAuditPortalLink } from '../../hooks/useAuditEvents';
import { AuditLogList } from '../domains/factory/components/audit/AuditLogList';
import { AuditCategoryFilter } from '../domains/factory/components/audit/AuditCategoryFilter';
import { AuditRangePicker } from '../domains/factory/components/audit/AuditRangePicker';
import { AuditTimeline } from '../domains/factory/components/audit/AuditTimeline';
import { DocumentFactoryPageShell } from '../domains/factory/components/FactoryPageShell';
import {
  AUDIT_CATEGORIES,
  auditActionsForCategories,
  auditEventBounds,
  auditRangeLabel,
  eventInAuditRange,
  type AuditNamespace,
  type AuditTimeRange,
} from '../domains/factory/auditPresentation';
import { SkeletonRows } from '../ui/SkeletonRows';

function AuditLogEmptyState({
  hasCategoryFilter,
  range,
  onClearCategories,
  onClearRange,
}: {
  hasCategoryFilter: boolean;
  range: AuditTimeRange | undefined;
  onClearCategories: () => void;
  onClearRange: () => void;
}) {
  const state = range
    ? {
        title: 'No events in this window',
        description: 'Widen the range or reset it to see everything that is loaded.',
        reset: { label: 'Show full range', onClick: onClearRange },
      }
    : hasCategoryFilter
      ? {
          title: 'No events in these categories',
          description: 'Nothing has been recorded yet for the categories you picked.',
          reset: { label: 'Show all events', onClick: onClearCategories },
        }
      : {
          title: 'No audit events yet',
          description: 'Work items, runs, worktrees and agent activity land here as they happen.',
          reset: undefined,
        };

  return (
    <EmptyState
      className="min-h-48"
      as="h2"
      iconSlot={<ScrollText className="text-icon3 size-5" aria-hidden />}
      titleSlot={state.title}
      descriptionSlot={state.description}
      actionSlot={
        state.reset ? (
          <Button variant="outline" size="sm" onClick={state.reset.onClick}>
            {state.reset.label}
          </Button>
        ) : undefined
      }
    />
  );
}

export function AuditPage() {
  return (
    <DocumentFactoryPageShell>{project => <AuditContent factoryProjectId={project.id} />}</DocumentFactoryPageShell>
  );
}

function AuditContent({ factoryProjectId }: { factoryProjectId: string | undefined }) {
  const [selectedCategories, setSelectedCategories] = useState(() => new Set<AuditNamespace>());
  const [selectedRange, setSelectedRange] = useState<AuditTimeRange>();
  const actions = auditActionsForCategories(selectedCategories);
  const filterKey = selectedCategories.size === 0 ? 'all' : [...selectedCategories].toSorted().join(',');
  const eventsQuery = useAuditEvents(factoryProjectId, filterKey, actions);
  // The axis spans everything loaded, not the current filter: categories are compared by
  // toggling them, and a scale that rescales under each toggle makes marks impossible to place.
  const historyQuery = useAuditEvents(factoryProjectId, 'all', undefined);
  const portalQuery = useAuditPortalLink(true);

  const toggleCategory = (category: AuditNamespace) => {
    setSelectedCategories(current => {
      const next = new Set(current);
      if (!next.delete(category)) next.add(category);
      return next.size === AUDIT_CATEGORIES.length ? new Set<AuditNamespace>() : next;
    });
    setSelectedRange(undefined);
  };
  const clearCategories = () => {
    setSelectedCategories(new Set());
    setSelectedRange(undefined);
  };

  if (eventsQuery.isError) {
    const message = eventsQuery.error instanceof Error ? eventsQuery.error.message : 'Unable to load audit events.';
    return <Notice variant="destructive">{message}</Notice>;
  }

  const pages = eventsQuery.data?.pages ?? [];
  const events = pages.flatMap(page => page.events);
  const actorNames = new Map<string, string>();
  for (const page of pages) {
    for (const [actorId, actor] of Object.entries(page.actors)) actorNames.set(actorId, actor.name);
  }
  const visibleEvents = selectedRange ? events.filter(event => eventInAuditRange(event, selectedRange)) : events;
  const history = historyQuery.data?.pages.flatMap(page => page.events) ?? [];
  const bounds = auditEventBounds([...events, ...history]);
  const portalUrl = portalQuery.data;

  return (
    <section className="flex min-w-0 flex-1 flex-col gap-3" aria-label="Audit history">
      <h1 className="sr-only">Audit log</h1>

      <div className="min-h-form-xs flex items-center justify-end">
        {portalUrl ? (
          <Button
            variant="outline"
            size="xs"
            onClick={() => {
              window.open(portalUrl, '_blank', 'noopener,noreferrer');
              void portalQuery.refetch();
            }}
          >
            Open in WorkOS
          </Button>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2">
        {bounds ? (
          <AuditRangePicker bounds={bounds} range={selectedRange} onRangeChange={setSelectedRange}>
            <AuditTimeline events={events} bounds={bounds} range={selectedRange} />
          </AuditRangePicker>
        ) : (
          <p className="text-ui-xs text-neutral2 flex h-28 items-center justify-center">Nothing recorded yet</p>
        )}
        <AuditCategoryFilter
          selectedCategories={selectedCategories}
          countLabel={
            events.length === 0
              ? undefined
              : selectedRange
                ? `${auditRangeLabel(selectedRange)} · ${visibleEvents.length} of ${events.length} loaded`
                : `${events.length} loaded`
          }
          onToggleCategory={toggleCategory}
          onClearCategories={clearCategories}
        />
        {eventsQuery.isPending ? (
          <div className="min-h-64">
            <SkeletonRows label="Loading audit events" rows={8} rowClassName="h-10 w-full rounded-md" />
          </div>
        ) : visibleEvents.length === 0 ? (
          <AuditLogEmptyState
            hasCategoryFilter={selectedCategories.size > 0}
            range={selectedRange}
            onClearCategories={clearCategories}
            onClearRange={() => setSelectedRange(undefined)}
          />
        ) : (
          <AuditLogList
            key={filterKey}
            events={visibleEvents}
            actorNames={actorNames}
            hasNextPage={eventsQuery.hasNextPage}
            autoLoad={!selectedRange}
            isFetchingNextPage={eventsQuery.isFetchingNextPage}
            onLoadMore={() => void eventsQuery.fetchNextPage()}
          />
        )}
      </div>
    </section>
  );
}
