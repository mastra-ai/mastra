import { Code } from '@mastra/playground-ui/components/Code';
import { DataList } from '@mastra/playground-ui/components/DataList';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ChevronRight } from 'lucide-react';
import { useState } from 'react';

import { relativeTime } from '../../../../../lib/date/relativeTime';
import {
  auditActionLabel,
  auditActorLabel,
  auditCategory,
  auditMetadataPreview,
  auditVisibleMetadata,
} from '../../auditPresentation';
import type { AuditEvent } from '../../services/audit';
import { LoadMoreSentinel } from '../LoadMoreSentinel';

const AUDIT_COLUMNS = '7rem minmax(8rem,0.8fr) minmax(10rem,0.9fr) minmax(11rem,1.1fr) minmax(13rem,1.4fr) 1rem';

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
  const visibleMetadata = auditVisibleMetadata(event);
  const hasMetadata = Object.keys(visibleMetadata).length > 0;

  const cells = (
    <>
      <DataList.TextCell className="tabular-nums" title={event.occurredAt}>
        {relativeTime(event.occurredAt)}
      </DataList.TextCell>
      <DataList.TextCell className={cn(event.actorType === 'agent' && 'text-warning-fg')}>
        {auditActorLabel(event, actorName)}
      </DataList.TextCell>
      <DataList.NameCell>
        <span className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden="true"
            className={cn('size-1.5 shrink-0 rounded-full', category?.dotClass ?? 'bg-placeholder')}
          />
          <span className="truncate">{auditActionLabel(event.action)}</span>
        </span>
      </DataList.NameCell>
      <DataList.TextCell>{target?.name ?? target?.id}</DataList.TextCell>
      <DataList.TextCell>{auditMetadataPreview(event)}</DataList.TextCell>
      <DataList.Cell className="text-placeholder justify-end empty:before:content-none">
        {hasMetadata ? (
          <ChevronRight
            aria-hidden="true"
            className={cn(
              'size-3.5 transition-transform duration-150 ease-out motion-reduce:transition-none',
              expanded && 'rotate-90',
            )}
          />
        ) : null}
      </DataList.Cell>
    </>
  );

  return (
    <>
      {hasMetadata ? (
        <DataList.RowButton aria-expanded={expanded} onClick={onToggle} featured={expanded}>
          {cells}
        </DataList.RowButton>
      ) : (
        <DataList.RowStatic>{cells}</DataList.RowStatic>
      )}
      {expanded ? (
        <div className="col-span-full px-3 pb-2">
          <Code
            code={JSON.stringify(visibleMetadata, null, 2)}
            lang="json"
            className="text-meta text-muted-foreground m-0 px-2 py-1 font-sans break-all whitespace-pre-wrap"
          />
        </div>
      ) : null}
    </>
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
    <DataList columns={AUDIT_COLUMNS} aria-label="Audit events">
      <DataList.Top>
        <DataList.TopCell>When</DataList.TopCell>
        <DataList.TopCell>Actor</DataList.TopCell>
        <DataList.TopCell>Event</DataList.TopCell>
        <DataList.TopCell>Target</DataList.TopCell>
        <DataList.TopCell>Details</DataList.TopCell>
        <span />
      </DataList.Top>
      {events.map(event => (
        <AuditEventRow
          key={event.id}
          event={event}
          actorName={actorNames.get(event.actorId)}
          expanded={openedEventIds.has(event.id)}
          onToggle={() => toggleEvent(event.id)}
        />
      ))}
      <div className="col-span-full">
        <LoadMoreSentinel
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          onLoadMore={onLoadMore}
          label="Load older events"
        />
      </div>
    </DataList>
  );
}
