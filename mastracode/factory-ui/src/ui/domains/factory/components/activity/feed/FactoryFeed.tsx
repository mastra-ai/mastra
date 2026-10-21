import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { useState } from 'react';

import { useAuditEvents } from '../../../../../../hooks/useAuditEvents';
import { useWorkItemsQuery } from '../../../../../../hooks/useWorkItems';
import { SkeletonRows } from '../../../../../ui/SkeletonRows';
import { activityCards, auditEntries, boardAndTrailEntries, newestFirstUpToTrailCursor } from '../../../activity';
import type { ActivityGrouping } from '../../../activity';
import { auditNamespacesForCategories } from '../../../auditPresentation';
import type { AuditNamespace } from '../../../auditPresentation';
import { LoadMoreSentinel } from '../../LoadMoreSentinel';
import { ActivityRail } from '../rail/ActivityRail';
import { useCardsNeedingYou } from './useCardsNeedingYou';
import { useFeedRoster } from './useFeedRoster';

/** The board snapshot arrives whole, so paging it only paces the DOM; the audit half is a real cursor pulled in step. */
const PAGE_SIZE = 60;
const AUDIT_PAGE_SIZE = 100;

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
  const auditQuery = useAuditEvents(factoryId, auditNamespacesForCategories(categories), AUDIT_PAGE_SIZE);
  const auditPages = auditQuery.data?.pages ?? [];
  const roster = useFeedRoster(factoryId, auditPages);
  const cardsNeedingYou = useCardsNeedingYou(factoryId);

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

  const events = auditPages.flatMap(page => page.events);
  const showsBoardMoves = categories.size === 0 || categories.has('work_item');
  const loadedEntries =
    grouping === 'none'
      ? auditEntries(events, activityCards(itemsQuery.data))
      : boardAndTrailEntries(itemsQuery.data, events, showsBoardMoves);
  const entries = newestFirstUpToTrailCursor(loadedEntries, events, auditQuery.hasNextPage);
  const nothingToShow = entries.length === 0 && !auditQuery.hasNextPage;

  if (nothingToShow && categories.size > 0) {
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

  if (nothingToShow) return <EmptyState variant="fill" titleSlot="Nothing has happened yet." />;

  const showMore = () => {
    setShown(count => count + PAGE_SIZE);
    if (auditQuery.hasNextPage && !auditQuery.isFetchingNextPage) void auditQuery.fetchNextPage();
  };

  return (
    <div className="flex flex-col gap-6">
      <ActivityRail
        entries={entries.slice(0, shown)}
        roster={roster}
        factoryProjectId={factoryId}
        cardsNeedingYou={cardsNeedingYou}
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
