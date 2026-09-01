import { Button } from '@mastra/playground-ui/components/Button';
import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import { Input } from '@mastra/playground-ui/components/Input';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Archive, Inbox, Mail } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { useSearchParams } from 'react-router';

import { useFactoryAttentionHistory, useMarkAllFactoryAttentionRead } from '../../hooks/useFactoryAttention';
import { dayHeading, groupByDay } from '../domains/factory/activity';
import { ApprovalQueue } from '../domains/factory/components/ApprovalQueue';
import { AttentionItemRow, KindIcon } from '../domains/factory/components/AttentionItemRow';
import { LoadMoreSentinel } from '../domains/factory/components/LoadMoreSentinel';
import { DayHeading, RailRow, RAIL_LIST } from '../domains/factory/components/Timeline';
import { useAttentionItemActions } from '../domains/factory/components/useAttentionItemActions';
import { DocumentFactoryPageShell } from '../domains/factory/components/FactoryPageShell';
import type { FactoryAttentionItem, FactoryAttentionView } from '../domains/factory/services/attention';
import { SkeletonRows } from '../ui/SkeletonRows';

const VIEWS: Array<{ value: FactoryAttentionView; label: string; icon: typeof Inbox }> = [
  { value: 'open', label: 'Open', icon: Inbox },
  { value: 'unread', label: 'Unread', icon: Mail },
  { value: 'archived', label: 'Archived', icon: Archive },
];

function attentionView(value: string | null): FactoryAttentionView {
  return value === 'unread' || value === 'archived' ? value : 'open';
}

/**
 * The inbox as a timeline: what landed, cut by day, each item hung off the mark
 * of what it is. Same rail as the Activity page — the two read as one surface,
 * and the silence between two days is as much of the story as the rows.
 */
function AttentionRail({
  factoryId,
  items,
  rowProps,
}: {
  factoryId: string;
  items: FactoryAttentionItem[];
  rowProps: (item: FactoryAttentionItem) => Omit<Parameters<typeof AttentionItemRow>[0], 'factoryId'>;
}) {
  const nowMs = Date.now();
  const dated = items.map(item => ({ item, at: Date.parse(item.occurredAt) }));

  return (
    <div className="flex flex-col gap-8">
      {groupByDay(dated).map(day => (
        <section key={day.dayMs} className="flex flex-col gap-5">
          <DayHeading>{dayHeading(day.dayMs, nowMs)}</DayHeading>
          <ul className={RAIL_LIST}>
            {day.items.map((entry, index) => (
              <RailRow
                key={entry.item.key}
                mark={<KindIcon kind={entry.item.kind} />}
                connected={index < day.items.length - 1}
              >
                <AttentionItemRow factoryId={factoryId} {...rowProps(entry.item)} />
              </RailRow>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function AttentionPage() {
  return <DocumentFactoryPageShell>{factory => <AttentionContent factoryId={factory.id} />}</DocumentFactoryPageShell>;
}

export function AttentionContent({ factoryId }: { factoryId: string }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const view = attentionView(searchParams.get('view'));
  const normalizedSearch = useDeferredValue(search.trim());
  const attention = useFactoryAttentionHistory(factoryId, view, normalizedSearch);
  const rowProps = useAttentionItemActions(factoryId);
  const markAllRead = useMarkAllFactoryAttentionRead(factoryId);
  const pages = attention.data?.pages ?? [];
  const summary = pages[0];
  const items = pages.flatMap(page => page.items);
  const primary = items.filter(item => item.kind !== 'activity');
  const activity = items.filter(item => item.kind === 'activity');
  const activityUnread = view === 'archived' ? 0 : (summary?.activityUnreadCount ?? 0);
  const unreadCount = (summary?.unreadCount ?? 0) + (summary?.activityUnreadCount ?? 0);
  const showApprovalQueue = view === 'open' && !normalizedSearch && (summary?.approvalCount ?? 0) > 0;

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-6 pb-16" aria-labelledby="attention-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 id="attention-heading" className="text-ui-lg text-icon6 m-0 font-semibold">
            Needs attention
          </h1>
          <p className="text-ui-sm text-icon3 mt-1 mb-0">Mentions, failures, and work waiting on you.</p>
        </div>
        {!normalizedSearch && view !== 'archived' && unreadCount > 0 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={markAllRead.isPending}
            onClick={() => markAllRead.mutate()}
          >
            {markAllRead.isPending ? 'Marking…' : 'Mark all open as read'}
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ButtonsGroup spacing="close" role="group" aria-label="Attention filter">
          {VIEWS.map(option => {
            const Icon = option.icon;
            return (
              <Button
                key={option.value}
                type="button"
                variant={view === option.value ? 'primary' : 'outline'}
                size="sm"
                aria-pressed={view === option.value}
                onClick={() => setSearchParams(option.value === 'open' ? {} : { view: option.value })}
              >
                <Icon aria-hidden />
                {option.label}
              </Button>
            );
          })}
        </ButtonsGroup>
        <Input
          aria-label="Search attention items"
          placeholder="Search"
          value={search}
          onChange={event => setSearch(event.target.value)}
          className="w-64"
        />
      </div>

      {attention.isPending ? (
        <SkeletonRows label="Loading attention items" rows={5} rowClassName="h-20 w-full" />
      ) : attention.isError ? (
        <Notice variant="destructive">
          <span>Unable to load attention items.</span>
          <Button type="button" variant="ghost" size="sm" onClick={() => void attention.refetch()}>
            Try again
          </Button>
        </Notice>
      ) : items.length === 0 && !showApprovalQueue ? (
        <div className="text-ui-sm text-icon2 flex min-h-40 items-center justify-center text-center">
          {attention.hasNextPage
            ? 'Loading older items…'
            : search
              ? 'No attention items match your search.'
              : `No ${view} attention items.`}
        </div>
      ) : (
        <>
          {showApprovalQueue ? <ApprovalQueue factoryId={factoryId} total={summary?.approvalCount ?? 0} /> : null}

          {primary.length > 0 ? <AttentionRail factoryId={factoryId} items={primary} rowProps={rowProps} /> : null}

          {activity.length > 0 ? (
            <section aria-labelledby="attention-activity-heading" className="flex flex-col gap-4">
              <span className="flex items-center gap-2">
                <h2 id="attention-activity-heading" className="text-ui-sm text-icon3 m-0 font-medium">
                  Activity
                </h2>
                {activityUnread > 0 ? (
                  <span className="bg-surface4 text-ui-xs text-icon3 min-w-5 rounded-full px-1.5 py-0.5 text-center leading-none font-medium tabular-nums">
                    {activityUnread}
                  </span>
                ) : null}
              </span>
              <AttentionRail factoryId={factoryId} items={activity} rowProps={rowProps} />
            </section>
          ) : null}
        </>
      )}

      <LoadMoreSentinel
        hasNextPage={attention.hasNextPage}
        isFetchingNextPage={attention.isFetchingNextPage}
        onLoadMore={() => void attention.fetchNextPage()}
        label="Load more attention items"
      />
    </section>
  );
}
