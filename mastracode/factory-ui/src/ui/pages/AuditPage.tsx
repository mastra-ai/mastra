import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { ScrollText } from 'lucide-react';
import { useState } from 'react';

import { useAuditEvents, useAuditPortalLink } from '../../hooks/useAuditEvents';
import { AuditLogList } from '../domains/factory/components/audit/AuditLogList';
import { AuditTimeline, eventInAuditRange } from '../domains/factory/components/audit/AuditTimeline';
import { DocumentFactoryPageShell } from '../domains/factory/components/FactoryPageShell';
import type { AuditNamespace, AuditTimeRange } from '../domains/factory/auditPresentation';
import { SkeletonRows } from '../ui/SkeletonRows';

const ACTION_GROUPS = [
  {
    key: 'work_item',
    actions: [
      'factory.work_item.created',
      'factory.work_item.updated',
      'factory.work_item.stage_moved',
      'factory.work_item.deleted',
      'factory.work_item.transition_rejected',
    ],
  },
  { key: 'run', actions: ['factory.run.started', 'factory.run.approved', 'factory.run.dismissed'] },
  { key: 'worktree', actions: ['factory.worktree.created', 'factory.worktree.deleted'] },
  { key: 'git', actions: ['factory.git.commit', 'factory.git.push', 'factory.git.pr_opened'] },
  { key: 'agent', actions: ['factory.agent.commit', 'factory.agent.push', 'factory.agent.pr_opened'] },
  { key: 'intake', actions: ['factory.intake.config_updated'] },
] as const satisfies ReadonlyArray<{ key: AuditNamespace; actions: readonly string[] }>;

function AuditEmptyTitle({ children }: { children: string }) {
  return (
    <span className="flex items-center gap-2">
      <ScrollText className="text-icon3 size-4" aria-hidden />
      {children}
    </span>
  );
}

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
  if (range) {
    return (
      <EmptyState
        className="min-h-48"
        as="h2"
        iconSlot={null}
        titleSlot={<AuditEmptyTitle>No events in this range</AuditEmptyTitle>}
        actionSlot={
          <Button variant="outline" size="sm" onClick={onClearRange}>
            Show full range
          </Button>
        }
      />
    );
  }

  if (hasCategoryFilter) {
    return (
      <EmptyState
        className="min-h-48"
        as="h2"
        iconSlot={null}
        titleSlot={<AuditEmptyTitle>No matching audit events</AuditEmptyTitle>}
        actionSlot={
          <Button variant="outline" size="sm" onClick={onClearCategories}>
            Show all events
          </Button>
        }
      />
    );
  }

  return (
    <EmptyState
      className="min-h-48"
      as="h2"
      iconSlot={null}
      titleSlot={<AuditEmptyTitle>No audit events yet</AuditEmptyTitle>}
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
  const actions: string[] = [];
  for (const entry of ACTION_GROUPS) {
    if (selectedCategories.has(entry.key)) actions.push(...entry.actions);
  }
  const filterKey = selectedCategories.size === 0 ? 'all' : [...selectedCategories].toSorted().join(',');
  const eventsQuery = useAuditEvents(factoryProjectId, filterKey, actions.length > 0 ? actions : undefined);
  const portalQuery = useAuditPortalLink(true);

  const toggleCategory = (category: AuditNamespace) => {
    setSelectedCategories(current => {
      const next = new Set(current);
      if (!next.delete(category)) next.add(category);
      return next;
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
    for (const actor of Object.values(page.actors)) actorNames.set(actor.id, actor.name);
  }
  const visibleEvents = selectedRange ? events.filter(event => eventInAuditRange(event, selectedRange)) : events;
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
              globalThis.open(portalUrl, '_blank', 'noopener,noreferrer');
              void portalQuery.refetch();
            }}
          >
            Open in WorkOS
          </Button>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <AuditTimeline
          events={events}
          range={selectedRange}
          selectedCategories={selectedCategories}
          onRangeChange={setSelectedRange}
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
            hasNextPage={!selectedRange && eventsQuery.hasNextPage}
            isFetchingNextPage={eventsQuery.isFetchingNextPage}
            onLoadMore={eventsQuery.fetchNextPage}
          />
        )}
      </div>
    </section>
  );
}
