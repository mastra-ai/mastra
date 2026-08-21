import { Button } from '@mastra/playground-ui/components/Button';
import { Code } from '@mastra/playground-ui/components/Code';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { relativeTime } from '../../../../../lib/date/relativeTime';
import { auditActionLabel, auditActorLabel, auditCategory, auditMetadataPreview } from '../../auditPresentation';
import type { AuditEvent } from '../../services/audit';

const AUDIT_GRID_CLASS =
  'grid-cols-[4.5rem_minmax(0,1fr)_1rem] lg:grid-cols-[7rem_minmax(8rem,0.8fr)_minmax(10rem,0.9fr)_minmax(11rem,1.1fr)_minmax(13rem,1.4fr)_1rem]';

const CELL_CLASS = 'min-w-0 truncate text-ui-sm';

function AuditCell({ children, className, title }: { children: ReactNode; className?: string; title?: string }) {
  return (
    <span className={cn(CELL_CLASS, className)} title={title}>
      {children || '—'}
    </span>
  );
}

function AuditEventRow({
  event,
  actorName,
  expanded,
  onToggle,
}: {
  event: AuditEvent;
  actorName: string | undefined;
  expanded: boolean;
  onToggle: () => void;
}) {
  const category = auditCategory(event.action);
  const target = event.targets[0];
  const hasMetadata = Object.keys(event.metadata).length > 0;
  const actor = auditActorLabel(event, actorName);
  const targetLabel = target?.name ?? target?.id;
  const detail = auditMetadataPreview(event);
  const mobileSummary = [actor, targetLabel, detail].filter(Boolean).join(' · ');
  const cells = (
    <>
      <AuditCell className="text-ui-xs text-neutral2 self-start tabular-nums lg:self-auto" title={event.occurredAt}>
        {relativeTime(event.occurredAt)}
      </AuditCell>
      <AuditCell className={cn('hidden lg:block', event.actorType === 'agent' ? 'text-accent6' : 'text-neutral3')}>
        {actor}
      </AuditCell>
      <AuditCell className="text-neutral5">
        <span className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden="true"
            className={cn('size-1.5 shrink-0 rounded-full', category?.dotClass ?? 'bg-neutral2')}
          />
          <span className="truncate">{auditActionLabel(event.action)}</span>
        </span>
      </AuditCell>
      <AuditCell className="text-neutral4 hidden lg:block">{targetLabel}</AuditCell>
      <AuditCell className="text-ui-xs text-neutral2 hidden lg:block">{detail}</AuditCell>
      <span className="text-neutral2 flex justify-end">
        {hasMetadata ? (
          <span
            aria-hidden="true"
            className={cn(
              'flex transition-transform duration-150 ease-out motion-reduce:transition-none',
              expanded && 'rotate-90',
            )}
          >
            <ChevronRight className="size-3.5" />
          </span>
        ) : null}
      </span>
      <span className="text-ui-xs text-neutral2 col-start-2 col-end-3 row-start-2 min-w-0 truncate lg:hidden">
        {mobileSummary}
      </span>
    </>
  );

  return (
    <li
      className={cn(
        'rounded-md transition-colors even:bg-neutral6/5 hover:bg-neutral6/10',
        expanded && 'bg-neutral6/10 even:bg-neutral6/10',
      )}
    >
      {hasMetadata ? (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={onToggle}
          className={cn(
            'grid w-full cursor-pointer items-start gap-x-3 gap-y-0.5 rounded-md px-3 py-2 text-left outline-none focus-visible:bg-neutral6/10 lg:items-center lg:gap-4',
            AUDIT_GRID_CLASS,
          )}
        >
          {cells}
        </button>
      ) : (
        <div className={cn('grid items-start gap-x-3 gap-y-0.5 px-3 py-2 lg:items-center lg:gap-4', AUDIT_GRID_CLASS)}>
          {cells}
        </div>
      )}

      {expanded ? (
        <Code
          code={JSON.stringify(event.metadata, null, 2)}
          lang="json"
          className="text-ui-xs text-neutral4 m-0 mx-3 mb-3 px-2 py-1 font-sans break-all whitespace-pre-wrap"
        />
      ) : null}
    </li>
  );
}

function InfiniteScrollTrigger({
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
}) {
  const trigger = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = trigger.current;
    if (!node || !hasNextPage || isFetchingNextPage || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      entries => {
        if (!entries[0]?.isIntersecting) return;
        observer.disconnect();
        onLoadMore();
      },
      { rootMargin: '0px 0px 320px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, onLoadMore]);

  if (!hasNextPage) return null;

  return (
    <div ref={trigger} className="flex h-12 items-center justify-center" aria-live="polite">
      {isFetchingNextPage ? (
        <Spinner size="sm" aria-label="Loading older events" />
      ) : (
        <Button variant="ghost" size="xs" onClick={onLoadMore}>
          Load older events
        </Button>
      )}
    </div>
  );
}

export function AuditLogList({
  events,
  actorNames,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: {
  events: AuditEvent[];
  actorNames: ReadonlyMap<string, string>;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
}) {
  const [openedEventIds, setOpenedEventIds] = useState(() => new Set<string>());
  const toggleEvent = (eventId: string) => {
    setOpenedEventIds(current => {
      const next = new Set(current);
      if (!next.delete(eventId)) next.add(eventId);
      return next;
    });
  };

  return (
    <div className="min-w-0 lg:min-w-[57rem] lg:pr-1">
      <div
        className={cn(
          'sticky top-(--page-sticky-top) z-20 hidden items-center gap-4 rounded-lg bg-surface4 px-3 py-2 text-ui-sm font-semibold tracking-tight text-neutral2 lg:grid',
          AUDIT_GRID_CLASS,
        )}
      >
        <span>When</span>
        <span>Actor</span>
        <span>Event</span>
        <span>Target</span>
        <span>Details</span>
        <span />
      </div>
      <ul className="m-0 flex list-none flex-col p-0 pt-1" aria-label="Audit events">
        {events.map(event => (
          <AuditEventRow
            key={event.id}
            event={event}
            actorName={actorNames.get(event.actorId)}
            expanded={openedEventIds.has(event.id)}
            onToggle={() => toggleEvent(event.id)}
          />
        ))}
      </ul>
      <InfiniteScrollTrigger
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        onLoadMore={onLoadMore}
      />
    </div>
  );
}
