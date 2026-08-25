import { Button, buttonVariants } from '@mastra/playground-ui/components/Button';
import { MainSidebar } from '@mastra/playground-ui/components/MainSidebar';
import { Popover, PopoverContent, PopoverTrigger } from '@mastra/playground-ui/components/Popover';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Bell, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';

import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';
import { useFactoryAttention, useFactoryAttentionReceiptAction } from '../../../../hooks/useFactoryAttention';
import { useFactoryDecisionAction } from '../../../../hooks/useFactoryDecisions';
import type { FactoryAttentionItem } from '../services/attention';
import { playAttentionSoundOnce } from '../services/attentionSound';
import { AttentionItemRow } from './AttentionItemRow';

function triggerLabel(openCount: number, unreadCount: number, approvalCount: number): string {
  const counts = [
    ...(unreadCount > 0 ? [`${unreadCount} unread`] : []),
    ...(approvalCount > 0 ? [`${approvalCount} waiting for approval`] : []),
    ...(openCount > 0 ? [`${openCount} open`] : []),
  ];
  return counts.length > 0 ? `Needs attention, ${counts.join(', ')}` : 'Needs attention';
}

function sameItem(a: Pick<FactoryAttentionItem, 'decisionId' | 'occurrence'> | undefined, b: FactoryAttentionItem) {
  return a?.decisionId === b.decisionId && a.occurrence === b.occurrence;
}

function showReceiptError(error: unknown, fallback: string): void {
  toast.error(error instanceof Error ? error.message : fallback);
}

export function SidebarAttention() {
  const { factoryId } = useParams<{ factoryId: string }>();
  const auth = useFactoryAuth();
  const attention = useFactoryAttention(factoryId, 'open', 5);
  const retryDecision = useFactoryDecisionAction(factoryId, 'retry');
  const readItem = useFactoryAttentionReceiptAction(factoryId, 'read');
  const archiveItem = useFactoryAttentionReceiptAction(factoryId, 'archive');
  const restoreItem = useFactoryAttentionReceiptAction(factoryId, 'restore');
  const [open, setOpen] = useState(false);
  const items = attention.data?.items ?? [];
  const openCount = attention.data?.openCount ?? 0;
  const unreadCount = attention.data?.unreadCount ?? 0;
  const approvalCount = attention.data?.approvalCount ?? 0;
  const badgeCount = attention.data?.badgeCount ?? 0;
  const soundScope = auth.data?.user?.userId ?? 'local';
  const soundBaseline = useRef<
    { scope: string; key: string | null; occurredAt: number; unreadCount: number } | undefined
  >(undefined);

  useEffect(() => {
    if (!attention.data) return;
    const scope = `${soundScope}:${factoryId ?? 'none'}`;
    const key = attention.data.latestOccurrenceKey;
    const occurredAt = Date.parse(attention.data.latestOccurrenceAt ?? '') || 0;
    const previous = soundBaseline.current;
    soundBaseline.current = { scope, key, occurredAt, unreadCount };
    if (!previous || previous.scope !== scope || !key || !attention.data.latestOccurrenceUnread) return;
    if (previous.key === key) return;
    if (
      occurredAt < previous.occurredAt ||
      (occurredAt === previous.occurredAt && unreadCount <= previous.unreadCount)
    ) {
      return;
    }
    void playAttentionSoundOnce(scope, key);
  }, [attention.data, factoryId, soundScope, unreadCount]);

  if (!factoryId) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <MainSidebar.NavLink asChild link={{ name: 'Needs attention', url: '#', icon: <Bell /> }} isActive={open}>
        <PopoverTrigger asChild>
          <button id="attention-trigger" type="button" aria-label={triggerLabel(openCount, unreadCount, approvalCount)}>
            <span className="relative grid size-4 shrink-0 place-items-center" aria-hidden>
              <Bell size={16} />
              {openCount > 0 ? (
                <span className="bg-warning1 absolute -top-0.5 -right-0.5 size-1.5 rounded-full" />
              ) : null}
            </span>
            <MainSidebar.NavLabel className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate">Needs attention</span>
              {badgeCount > 0 ? (
                <span className="bg-warning1/15 text-warning1 min-w-5 rounded-full px-1.5 py-0.5 text-center text-[0.625rem] leading-none font-medium tabular-nums">
                  {badgeCount}
                </span>
              ) : openCount > 0 ? (
                <span className="bg-warning1 size-1.5 rounded-full" aria-hidden />
              ) : null}
            </MainSidebar.NavLabel>
          </button>
        </PopoverTrigger>
      </MainSidebar.NavLink>
      <PopoverContent
        side="right"
        align="end"
        sideOffset={8}
        aria-label="Needs attention"
        className="min-h-24 w-96 max-w-[calc(100vw-1.5rem)] overflow-hidden p-0"
      >
        {attention.isPending ? (
          <div className="flex flex-col gap-2 px-3.5 py-3" role="status" aria-label="Loading attention items">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-4/5" />
          </div>
        ) : attention.isError ? (
          <div className="flex flex-col items-start gap-2.5 px-3.5 py-4">
            <span className="text-ui-sm text-icon4">Unable to load attention items.</span>
            <Button type="button" variant="ghost" size="sm" onClick={() => void attention.refetch()}>
              <RefreshCw aria-hidden />
              Try again
            </Button>
          </div>
        ) : items.length === 0 && approvalCount === 0 ? (
          <div className="text-ui-sm text-icon2 flex min-h-24 items-center justify-center px-3.5 text-center">
            {openCount > 0 ? 'Open the inbox to continue through older failures.' : 'Nothing needs attention.'}
          </div>
        ) : (
          <ScrollArea maxHeight="20rem" viewPortClassName="py-1">
            <ul>
              {approvalCount > 0 ? (
                <li className="border-border1 border-b">
                  <Link
                    to={`/factories/${factoryId}/rules?group=proposed`}
                    onClick={() => setOpen(false)}
                    className="hover:bg-surface3 flex items-center justify-between gap-3 px-3.5 py-3"
                  >
                    <span className="text-ui-sm text-icon5">{approvalCount} items waiting for approval</span>
                    <span className="text-ui-xs text-icon3 shrink-0">Open approvals</span>
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
                    onOpen={() => setOpen(false)}
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
          </ScrollArea>
        )}
        <div className="px-2 pb-2">
          <Link
            to={`/factories/${factoryId}/attention`}
            onClick={() => setOpen(false)}
            className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'w-full' })}
          >
            View all attention
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
