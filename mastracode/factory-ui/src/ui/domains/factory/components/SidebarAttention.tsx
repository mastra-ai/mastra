import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button, buttonVariants } from '@mastra/playground-ui/components/Button';
import { MainSidebar } from '@mastra/playground-ui/components/MainSidebar';
import { Popover, PopoverContent, PopoverTrigger } from '@mastra/playground-ui/components/Popover';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Tab, TabContent, TabList, Tabs } from '@mastra/playground-ui/components/Tabs';
import { ArrowRight, Inbox, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';

import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';
import { ATTENTION_PREVIEW_LIMIT, useFactoryAttention } from '../../../../hooks/useFactoryAttention';
import { attentionCountsIn, latestUnreadOrNewestIn } from '../services/attention';
import type { FactoryAttentionGroup } from '../services/attention';
import { playAttentionSoundOnce } from '../services/attentionSound';
import { AttentionItemRow } from './AttentionItemRow';
import { useAttentionItemActions } from './useAttentionItemActions';

/** The inbox page's three sections as tabs; only the first one badges and rings. */
const TAB_ORDER = ['attention', 'queue', 'activity'] satisfies FactoryAttentionGroup[];
const TAB: Record<FactoryAttentionGroup, { label: string; empty: string }> = {
  attention: { label: 'Needs you', empty: 'Nothing needs you.' },
  queue: { label: 'Approvals', empty: 'No runs waiting for approval.' },
  activity: { label: 'Activity', empty: 'No new activity.' },
};

function triggerLabel(openCount: number, unreadCount: number): string {
  const counts = [
    ...(unreadCount > 0 ? [`${unreadCount} unread`] : []),
    ...(openCount > 0 ? [`${openCount} open`] : []),
  ];
  return counts.length > 0 ? `Needs attention, ${counts.join(', ')}` : 'Needs attention';
}

export function SidebarAttention() {
  const { factoryId } = useParams<{ factoryId: string }>();
  const auth = useFactoryAuth();
  const [group, setGroup] = useState<FactoryAttentionGroup>('attention');
  // The badge and the sound stay on the always-mounted query; the tab reads its own.
  const attention = useFactoryAttention(factoryId, 'open', ATTENTION_PREVIEW_LIMIT, 'attention');
  const preview = useFactoryAttention(factoryId, 'open', ATTENTION_PREVIEW_LIMIT, group);
  const rowProps = useAttentionItemActions(factoryId);
  const [open, setOpen] = useState(false);
  const items = preview.data?.items ?? [];
  const kinds = attention.data?.kinds;
  const { open: openCount, unread: unreadCount } = kinds
    ? attentionCountsIn(kinds, 'attention')
    : { open: 0, unread: 0 };
  const groupOpenCount = kinds ? attentionCountsIn(kinds, group).open : 0;
  const soundScope = auth.data?.user?.userId ?? 'local';
  const soundBaseline = useRef<
    { scope: string; key: string | null; occurredAt: number; unreadCount: number } | undefined
  >(undefined);

  useEffect(() => {
    if (!attention.data) return;
    const scope = `${soundScope}:${factoryId ?? 'none'}`;
    const latest = latestUnreadOrNewestIn(attention.data.kinds, 'attention');
    const key = latest?.key ?? null;
    const occurredAt = latest ? Date.parse(latest.at) : 0;
    const previous = soundBaseline.current;
    soundBaseline.current = { scope, key, occurredAt, unreadCount };
    if (!previous || previous.scope !== scope || !latest?.unread) return;
    if (previous.key === key) return;
    if (
      occurredAt < previous.occurredAt ||
      (occurredAt === previous.occurredAt && unreadCount <= previous.unreadCount)
    ) {
      return;
    }
    void playAttentionSoundOnce(scope, latest.key);
  }, [attention.data, factoryId, soundScope, unreadCount]);

  if (!factoryId) return null;

  const inboxPath = `/factories/${factoryId}/attention`;
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setGroup('attention');
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <MainSidebar.NavLink asChild link={{ name: 'Needs attention', url: '#', icon: <Inbox /> }} isActive={open}>
        <PopoverTrigger id="attention-trigger" type="button" aria-label={triggerLabel(openCount, unreadCount)}>
          <span className="relative grid size-4 shrink-0 place-items-center" aria-hidden>
            <Inbox size={16} />
            {openCount > 0 ? <span className="bg-warning1 absolute -top-0.5 -right-0.5 size-1.5 rounded-full" /> : null}
          </span>
          <MainSidebar.NavLabel className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate">Needs attention</span>
            {unreadCount > 0 ? (
              <Badge variant="orange" size="sm">
                {unreadCount}
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
        <Tabs defaultTab="attention" value={group} onValueChange={setGroup}>
          <div className="border-border1 flex items-center justify-between gap-2 border-b p-1.5">
            <TabList variant="pill">
              {TAB_ORDER.map(tab => {
                const unread = kinds ? attentionCountsIn(kinds, tab).unread : 0;
                return (
                  <Tab key={tab} value={tab} className="text-ui-xs">
                    {TAB[tab].label} {unread > 0 ? <span className="text-icon3 tabular-nums">{unread}</span> : null}
                  </Tab>
                );
              })}
            </TabList>
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
          <TabContent value={group} className="py-0">
            {preview.isPending ? (
              <div className="flex flex-col gap-2 px-3.5 py-2" role="status" aria-label="Loading attention items">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-4/5" />
              </div>
            ) : preview.isError ? (
              <div className="flex flex-col items-start gap-2.5 px-3.5 py-4">
                <span className="text-ui-sm text-icon4">Unable to load attention items.</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => void preview.refetch()}>
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
            ) : (
              <div className="text-ui-sm text-icon2 flex min-h-24 items-center justify-center px-3.5 text-center">
                {groupOpenCount > 0 ? 'Open the inbox to continue through older items.' : TAB[group].empty}
              </div>
            )}
          </TabContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
