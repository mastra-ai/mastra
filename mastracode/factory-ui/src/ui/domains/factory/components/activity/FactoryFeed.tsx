import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { useCallback, useMemo, useState } from 'react';

import { useAuditEvents } from '../../../../../hooks/useAuditEvents';
import { useFactoryAttentionHistory } from '../../../../../hooks/useFactoryAttention';
import { useFactoryMembers } from '../../../../../hooks/useFactoryMembers';
import { useWorkItemsQuery } from '../../../../../hooks/useWorkItems';
import { SkeletonRows } from '../../../../ui/SkeletonRows';
import { auditEntries, collapseRuns, factoryActivity, factoryDeeds } from '../../activity';
import type { ActivityEntry } from '../../activity';
import { auditNamespacesForCategories } from '../../auditPresentation';
import type { AuditNamespace } from '../../auditPresentation';
import { itemBoard } from '../../boardStages';
import { NEEDS_YOU_KINDS } from '../../services/attention';
import type { FactoryMentionMember } from '../../services/members';
import { LoadMoreSentinel } from '../LoadMoreSentinel';
import { ActivityRail } from './ActivityRail';
import type { ActivityGrouping } from './useTimelineView';

/** The board snapshot arrives whole, so paging it only paces the DOM; the audit half is a real cursor pulled in step. */
const PAGE_SIZE = 60;
const AUDIT_PAGE_SIZE = 100;

function auditFilterKey(grouping: ActivityGrouping, categories: ReadonlySet<AuditNamespace>): string {
  return `activity:${grouping}:${[...categories].toSorted().join(',')}`;
}

function showsBoardMoves(categories: ReadonlySet<AuditNamespace>): boolean {
  return categories.size === 0 || categories.has('work_item');
}

/**
 * What the Factory did, newest first. Grouped, it reads stage moves from the board and
 * everything else from the audit trail; ungrouped, it reads the audit trail alone.
 */
export function FactoryFeed({
  factoryId,
  grouping,
  compact,
  categories,
  onClearCategories,
}: {
  factoryId: string;
  grouping: ActivityGrouping;
  compact: boolean;
  categories: ReadonlySet<AuditNamespace>;
  onClearCategories: () => void;
}) {
  const [shown, setShown] = useState(PAGE_SIZE);
  const itemsQuery = useWorkItemsQuery(factoryId);
  const auditQuery = useAuditEvents(
    factoryId,
    auditFilterKey(grouping, categories),
    auditNamespacesForCategories(categories),
    AUDIT_PAGE_SIZE,
  );
  const members = useFactoryMembers(factoryId);
  const openAttention = useFactoryAttentionHistory(factoryId, 'open', NEEDS_YOU_KINDS);

  const items = itemsQuery.data;
  const auditPages = auditQuery.data?.pages;

  const entries = useMemo<ActivityEntry[]>(() => {
    const cards = new Map((items ?? []).map(item => [item.id, { title: item.title, board: itemBoard(item) }]));
    const events = auditPages?.flatMap(page => page.events) ?? [];
    if (grouping === 'none') return auditEntries(events, cards);
    const moves = showsBoardMoves(categories) ? collapseRuns(factoryActivity(items ?? [])) : [];
    return [...moves, ...factoryDeeds(events, cards)].sort((left, right) => right.at - left.at);
  }, [items, auditPages, grouping, categories]);

  // The audit route names its own actors; the mention roster covers the rest.
  const roster = useMemo<FactoryMentionMember[]>(
    () => [...(members.data ?? []), ...(auditPages ?? []).flatMap(page => Object.values(page.actors))],
    [members.data, auditPages],
  );

  const cardsNeedingYou = new Set(
    (openAttention.data?.pages ?? []).flatMap(page =>
      page.items.flatMap(item => (item.workItemId === null ? [] : [item.workItemId])),
    ),
  );

  const showMore = useCallback(() => {
    setShown(count => count + PAGE_SIZE);
    if (auditQuery.hasNextPage && !auditQuery.isFetchingNextPage) void auditQuery.fetchNextPage();
  }, [auditQuery]);

  if (itemsQuery.isPending || auditQuery.isPending) {
    return <SkeletonRows label="Loading activity" rows={6} rowClassName="h-10 w-full" />;
  }

  if (itemsQuery.isError || auditQuery.isError) {
    return (
      <Notice variant="destructive">
        <span>Unable to load activity.</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            void itemsQuery.refetch();
            void auditQuery.refetch();
          }}
        >
          Try again
        </Button>
      </Notice>
    );
  }

  if (entries.length === 0 && categories.size > 0) {
    return (
      <EmptyState
        variant="fill"
        titleSlot="No events in these categories."
        actionSlot={
          <Button size="sm" onClick={onClearCategories}>
            Show all events
          </Button>
        }
      />
    );
  }

  if (entries.length === 0) return <EmptyState variant="fill" titleSlot="Nothing has happened yet." />;

  return (
    <div className="flex flex-col gap-6">
      <ActivityRail
        entries={entries.slice(0, shown)}
        members={roster}
        factoryProjectId={factoryId}
        needsYou={cardsNeedingYou}
        grouping={grouping}
        compact={compact}
      />
      <LoadMoreSentinel
        hasNextPage={entries.length > shown || auditQuery.hasNextPage}
        isFetchingNextPage={auditQuery.isFetchingNextPage}
        onLoadMore={showMore}
        label="Load more activity"
      />
    </div>
  );
}
