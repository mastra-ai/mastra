import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button, buttonVariants } from '@mastra/playground-ui/components/Button';
import { MainSidebar } from '@mastra/playground-ui/components/MainSidebar';
import { Popover, PopoverContent, PopoverTrigger } from '@mastra/playground-ui/components/Popover';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { ArrowRight, Inbox, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';

import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';
import { useFactoryAttention } from '../../../../hooks/useFactoryAttention';
import { playAttentionSoundOnce } from '../services/attentionSound';
import { AttentionItemRow } from './AttentionItemRow';
import { useAttentionItemActions } from './useAttentionItemActions';

/** How deep the preview reaches before the inbox page takes over; the popover scrolls through it. */
export const ATTENTION_PREVIEW_LIMIT = 20;

function triggerLabel(openCount: number, unreadCount: number, approvalCount: number): string {
  const counts = [
    ...(unreadCount > 0 ? [`${unreadCount} unread`] : []),
    ...(approvalCount > 0 ? [`${approvalCount} waiting for approval`] : []),
    ...(openCount > 0 ? [`${openCount} open`] : []),
  ];
  return counts.length > 0 ? `Needs attention, ${counts.join(', ')}` : 'Needs attention';
}

export function SidebarAttention() {
  const { factoryId } = useParams<{ factoryId: string }>();
  const auth = useFactoryAuth();
  const attention = useFactoryAttention(factoryId, 'open', ATTENTION_PREVIEW_LIMIT, 'badge');
  const rowProps = useAttentionItemActions(factoryId);
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

  const inboxPath = `/factories/${factoryId}/attention`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <MainSidebar.NavLink asChild link={{ name: 'Needs attention', url: '#', icon: <Inbox /> }} isActive={open}>
        <PopoverTrigger
          id="attention-trigger"
          type="button"
          aria-label={triggerLabel(openCount, unreadCount, approvalCount)}
        >
          <span className="relative grid size-4 shrink-0 place-items-center" aria-hidden>
            <Inbox size={16} />
            {openCount > 0 ? <span className="bg-warning1 absolute -top-0.5 -right-0.5 size-1.5 rounded-full" /> : null}
          </span>
          <MainSidebar.NavLabel className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate">Needs attention</span>
            {badgeCount > 0 ? (
              <Badge variant="orange" size="sm">
                {badgeCount}
              </Badge>
            ) : null}
          </MainSidebar.NavLabel>
        </PopoverTrigger>
      </MainSidebar.NavLink>
      <PopoverContent
        side="right"
        align="end"
        sideOffset={8}
        aria-label="Needs attention"
        className="min-h-24 w-96 max-w-[calc(100vw-1.5rem)] overflow-hidden p-0"
      >
        <div className="border-border1 flex items-center justify-between gap-2 border-b py-1.5 pr-1.5 pl-3.5">
          {approvalCount > 0 ? (
            <span className="text-ui-xs text-icon3 flex min-w-0 items-center gap-2">
              <Badge variant="orange" size="sm">
                {approvalCount}
              </Badge>
              <span className="truncate">waiting for approval</span>
            </span>
          ) : (
            <span className="text-ui-xs text-icon3">Needs attention</span>
          )}
          <Link
            to={inboxPath}
            onClick={() => setOpen(false)}
            aria-label="View all attention"
            className={buttonVariants({ variant: 'ghost', size: 'xs', className: 'shrink-0' })}
          >
            View all
            <ArrowRight aria-hidden />
          </Link>
        </div>
        {attention.isPending ? (
          <div className="flex flex-col gap-2 px-3.5 py-2" role="status" aria-label="Loading attention items">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-4/5" />
          </div>
        ) : attention.isError ? (
          <div className="flex flex-col items-start gap-2.5 px-3.5 py-4">
            <span className="text-ui-sm text-icon4">Unable to load attention items.</span>
            <Button type="button" variant="ghost" size="sm" onClick={() => void attention.refetch()}>
              <RefreshCw aria-hidden />
              Try again
            </Button>
          </div>
        ) : items.length > 0 ? (
          <ScrollArea maxHeight="20rem" viewPortClassName="px-3.5 py-1.5">
            <ul className="divide-border1/50 divide-y">
              {items.map((item, index) => (
                <li
                  key={item.key}
                  className="animate-in fade-in slide-in-from-bottom-1"
                  style={{ animationDelay: `${index * 40}ms`, animationFillMode: 'backwards' }}
                >
                  <AttentionItemRow factoryId={factoryId} {...rowProps(item)} onOpen={() => setOpen(false)} />
                </li>
              ))}
            </ul>
          </ScrollArea>
        ) : approvalCount === 0 ? (
          <div className="text-ui-sm text-icon2 flex min-h-24 items-center justify-center px-3.5 text-center">
            {openCount > 0 ? 'Open the inbox to continue through older items.' : 'Nothing needs attention.'}
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
