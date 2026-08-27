import { Button } from '@mastra/playground-ui/components/Button';
import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import { Input } from '@mastra/playground-ui/components/Input';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Archive, Inbox, Mail } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import {
  useFactoryAttentionHistory,
  useFactoryAttentionReceiptAction,
  useMarkAllFactoryAttentionRead,
} from '../../hooks/useFactoryAttention';
import { useFactoryDecisionAction } from '../../hooks/useFactoryDecisions';
import { AttentionItemRow } from '../domains/factory/components/AttentionItemRow';
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

function sameItem(a: Pick<FactoryAttentionItem, 'decisionId' | 'occurrence'> | undefined, b: FactoryAttentionItem) {
  return a?.decisionId === b.decisionId && a.occurrence === b.occurrence;
}

function showReceiptError(error: unknown, fallback: string): void {
  toast.error(error instanceof Error ? error.message : fallback);
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
  const retryDecision = useFactoryDecisionAction(factoryId, 'retry');
  const readItem = useFactoryAttentionReceiptAction(factoryId, 'read');
  const archiveItem = useFactoryAttentionReceiptAction(factoryId, 'archive');
  const restoreItem = useFactoryAttentionReceiptAction(factoryId, 'restore');
  const markAllRead = useMarkAllFactoryAttentionRead(factoryId);
  const pages = attention.data?.pages ?? [];
  const summary = pages[0];
  const items = pages.flatMap(page => page.items);
  const showApprovalQueue = view === 'open' && !normalizedSearch && (summary?.approvalCount ?? 0) > 0;

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-4 pb-12" aria-labelledby="attention-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 id="attention-heading" className="text-ui-lg text-icon6 m-0 font-semibold">
            Needs attention
          </h1>
          <p className="text-ui-sm text-icon3 mt-1 mb-0">Factory work that needs a decision or recovery.</p>
        </div>
        {!normalizedSearch && view !== 'archived' && summary && summary.unreadCount > 0 ? (
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
            ? 'Older failures remain. Load more to continue.'
            : search
              ? 'No attention items match your search.'
              : `No ${view} attention items.`}
        </div>
      ) : (
        <ul className="border-border1 divide-border1 divide-y overflow-hidden rounded-xl border">
          {showApprovalQueue && summary ? (
            <li>
              <Link
                to={`/factories/${factoryId}/rules?group=proposed`}
                className="hover:bg-surface3 flex items-center justify-between gap-4 px-4 py-3"
              >
                <span>
                  <span className="text-ui-sm text-icon6 block font-medium">
                    {summary.approvalCount} items waiting for approval
                  </span>
                  <span className="text-ui-xs text-icon3 mt-0.5 block">
                    Review the approval queue before Factory starts them.
                  </span>
                </span>
                <span className="text-ui-sm text-icon4 shrink-0">Open approvals</span>
              </Link>
            </li>
          ) : null}
          {items.map(item => (
            <li key={item.key}>
              <AttentionItemRow
                factoryId={factoryId}
                item={item}
                retrying={retryDecision.isPending && retryDecision.variables === item.decisionId}
                updatingReceipt={
                  (readItem.isPending && sameItem(readItem.variables, item)) ||
                  (archiveItem.isPending && sameItem(archiveItem.variables, item)) ||
                  (restoreItem.isPending && sameItem(restoreItem.variables, item))
                }
                onRetry={
                  item.canRetry
                    ? () =>
                        retryDecision.mutate(item.decisionId, {
                          onError: error =>
                            toast.error(error instanceof Error ? error.message : 'Unable to retry automation'),
                        })
                    : undefined
                }
                onRead={() =>
                  readItem.mutate(item, {
                    onError: error => showReceiptError(error, 'Unable to mark attention item as read'),
                  })
                }
                onArchive={() =>
                  archiveItem.mutate(item, {
                    onError: error => showReceiptError(error, 'Unable to archive attention item'),
                  })
                }
                onRestore={() =>
                  restoreItem.mutate(item, {
                    onError: error => showReceiptError(error, 'Unable to restore attention item'),
                  })
                }
              />
            </li>
          ))}
        </ul>
      )}

      {attention.hasNextPage ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-center"
          disabled={attention.isFetchingNextPage}
          onClick={() => void attention.fetchNextPage()}
        >
          {attention.isFetchingNextPage ? 'Loading…' : 'Load more'}
        </Button>
      ) : null}
    </section>
  );
}
