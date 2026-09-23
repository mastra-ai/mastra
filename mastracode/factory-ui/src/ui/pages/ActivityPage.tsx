import { Button } from '@mastra/playground-ui/components/Button';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { PageHeader } from '@mastra/playground-ui/components/PageHeader';
import { useCallback, useMemo, useState } from 'react';

import { useAuditEvents } from '../../hooks/useAuditEvents';
import { useFactoryMembers } from '../../hooks/useFactoryMembers';
import { useWorkItemsQuery } from '../../hooks/useWorkItems';
import { collapseRuns, factoryActivity, factoryDeeds } from '../domains/factory/activity';
import type { ActivityEntry } from '../domains/factory/activity';
import { itemBoard } from '../domains/factory/boardStages';
import { ActivityRail } from '../domains/factory/components/ActivityRail';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { useSidebarHeaderSlots } from '../domains/chat/components/useSidebarHeaderSlots';
import { useActiveFactory } from '../domains/workspaces/components/FactoryLayout';
import { LoadMoreSentinel } from '../domains/factory/components/LoadMoreSentinel';
import type { FactoryMentionMember } from '../domains/factory/services/members';
import { SkeletonRows } from '../ui/SkeletonRows';

/** The board snapshot arrives whole, so paging it only paces the DOM; the audit half is a real cursor pulled in step. */
const PAGE_SIZE = 60;
const AUDIT_PAGE_SIZE = 100;

export function ActivityPage() {
  const factory = useActiveFactory();
  const slots = useSidebarHeaderSlots();
  return (
    <PageLayout
      {...slots}
      variant="narrow"
      header={
        <PageHeader>
          <PageHeader.Title>Activity</PageHeader.Title>
          <PageHeader.Description>Everything the Factory did, newest first.</PageHeader.Description>
        </PageHeader>
      }
    >
      <ActivityContent factoryId={factory.id} />
    </PageLayout>
  );
}

export function ActivityContent({ factoryId }: { factoryId: string }) {
  const [shown, setShown] = useState(PAGE_SIZE);
  const itemsQuery = useWorkItemsQuery(factoryId);
  const auditQuery = useAuditEvents(factoryId, 'activity', undefined, AUDIT_PAGE_SIZE);
  const members = useFactoryMembers(factoryId);

  const items = itemsQuery.data;
  const auditPages = auditQuery.data?.pages;

  const entries = useMemo<ActivityEntry[]>(() => {
    const cards = new Map((items ?? []).map(item => [item.id, { title: item.title, board: itemBoard(item) }]));
    const moves = collapseRuns(factoryActivity(items ?? []));
    const deeds = factoryDeeds(auditPages?.flatMap(page => page.events) ?? [], cards);
    return [...moves, ...deeds].sort((left, right) => right.at - left.at);
  }, [items, auditPages]);

  // The audit route names its own actors; the mention roster covers the rest.
  const roster = useMemo<FactoryMentionMember[]>(
    () => [...(members.data ?? []), ...(auditPages ?? []).flatMap(page => Object.values(page.actors))],
    [members.data, auditPages],
  );

  const showMore = useCallback(() => {
    setShown(count => count + PAGE_SIZE);
    if (auditQuery.hasNextPage && !auditQuery.isFetchingNextPage) void auditQuery.fetchNextPage();
  }, [auditQuery]);

  return (
    <div className="flex flex-col gap-6 pt-6 pb-16">
      {itemsQuery.isPending || auditQuery.isPending ? (
        <SkeletonRows label="Loading activity" rows={6} rowClassName="h-10 w-full" />
      ) : itemsQuery.isError || auditQuery.isError ? (
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
      ) : entries.length === 0 ? (
        <EmptyState variant="fill" titleSlot="Nothing has happened yet." />
      ) : (
        <>
          <ActivityRail entries={entries.slice(0, shown)} members={roster} factoryProjectId={factoryId} />
          <LoadMoreSentinel
            hasNextPage={entries.length > shown || auditQuery.hasNextPage}
            isFetchingNextPage={auditQuery.isFetchingNextPage}
            onLoadMore={showMore}
            label="Load more activity"
          />
        </>
      )}
    </div>
  );
}
