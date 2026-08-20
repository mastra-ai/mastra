import type { AuditNamespace } from '@mastra/factory/storage/domains/audit/actions';
import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ScrollText } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useAuditPortalLink, useAuditWindow } from '../../hooks/useAuditEvents';
import { useWorkItemsQuery } from '../../hooks/useWorkItems';
import { formatDuration } from '../../lib/date';
import { SkeletonRows } from '../ui/SkeletonRows';
import {
  AUDIT_NAMESPACES,
  NAMESPACE_LABELS,
  namespaceOf,
  targetItemId,
  type TimeSlice,
} from '../domains/factory/audit-log';
import { AuditEventRow } from '../domains/factory/components/AuditEventRow';
import { AuditStrip } from '../domains/factory/components/AuditStrip';
import { Chip, ChipRow } from '../domains/factory/components/Chips';
import { FactoryPageShell } from '../domains/factory/components/FactoryPageShell';
import type { AuditEvent } from '../domains/factory/services/audit';

type ActorKey = 'all' | AuditEvent['actorType'];

const DAY = 86_400_000;
const AUDIT_SPAN = 7 * DAY;
/** Past this the list stops being a list; the strip is how you get to the rest. */
const LIST_CAP = 260;

const ACTOR_FILTERS: { key: ActorKey; label: string }[] = [
  { key: 'all', label: 'Everyone' },
  { key: 'agent', label: 'Agents' },
  { key: 'human', label: 'People' },
];

function clock(at: number): string {
  return new Date(at).toLocaleTimeString(undefined, { hour12: false, hour: '2-digit', minute: '2-digit' });
}

function dayOf(at: number): string {
  return new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Two identical clock times is what a seven-day window reads as without its days. */
function stamp(at: number, withDay: boolean): string {
  return withDay ? `${dayOf(at)} ${clock(at)}` : clock(at);
}

/**
 * The Factory audit log: an append-only, org-scoped record of who did what, when.
 * Backed by the local `audit_events` table; "Open in WorkOS" opens the enterprise
 * viewer when WorkOS is configured.
 */
export function AuditPage() {
  return <FactoryPageShell>{project => <AuditContent factoryProjectId={project.id} />}</FactoryPageShell>;
}

function AuditContent({ factoryProjectId }: { factoryProjectId: string | undefined }) {
  const [actor, setActor] = useState<ActorKey>('all');
  const [namespaces, setNamespaces] = useState<ReadonlySet<AuditNamespace>>(new Set());
  const [slice, setSlice] = useState<TimeSlice | null>(null);
  const [opened, setOpened] = useState<string | null>(null);

  const windowQuery = useAuditWindow(factoryProjectId, AUDIT_SPAN);
  const portalQuery = useAuditPortalLink(true);
  const itemsQuery = useWorkItemsQuery(factoryProjectId);
  const titles = useMemo(() => new Map((itemsQuery.data ?? []).map(item => [item.id, item.title])), [itemsQuery.data]);

  if (windowQuery.isError) {
    const message = windowQuery.error instanceof Error ? windowQuery.error.message : 'Unable to load audit events.';
    return <Notice variant="destructive">{message}</Notice>;
  }

  const trail = windowQuery.data;
  const shown: ReadonlySet<AuditNamespace> = namespaces.size === 0 ? new Set(AUDIT_NAMESPACES) : namespaces;
  const covered = trail ? { from: trail.coveredFrom, to: trail.to } : null;
  const picked = slice ?? covered;
  const rows = (trail?.events ?? []).filter(event => {
    const namespace = namespaceOf(event.action);
    const at = Date.parse(event.occurredAt);
    return (
      (namespace === undefined || shown.has(namespace)) &&
      (actor === 'all' || actor === event.actorType) &&
      (!picked || (at >= picked.from && at <= picked.to))
    );
  });
  const filtered = actor !== 'all' || namespaces.size > 0 || slice !== null;
  const spansDays = picked ? dayOf(picked.from) !== dayOf(picked.to) : false;

  const clearFilters = () => {
    setActor('all');
    setNamespaces(new Set());
    setSlice(null);
  };

  const toggle = (namespace: AuditNamespace) => {
    const next = new Set(namespaces);
    if (!next.delete(namespace)) next.add(namespace);
    setNamespaces(next);
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-4" aria-label="Audit history">
      <h1 className="sr-only">Audit log</h1>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <ChipRow label="Actor filter">
          {ACTOR_FILTERS.map(entry => (
            <Chip key={entry.key} active={actor === entry.key} onClick={() => setActor(entry.key)}>
              {entry.label}
            </Chip>
          ))}
        </ChipRow>
        <span aria-hidden="true" className="bg-border1 h-4 w-px" />
        <ChipRow label="Audit filter">
          {AUDIT_NAMESPACES.map(namespace => (
            <Chip key={namespace} active={namespaces.has(namespace)} onClick={() => toggle(namespace)}>
              {NAMESPACE_LABELS[namespace]}
            </Chip>
          ))}
        </ChipRow>
        {filtered ? (
          <Chip active={false} onClick={clearFilters} className="text-icon5">
            All 7 days
          </Chip>
        ) : null}
        {portalQuery.data ? (
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={() => {
              // Portal links are one-time use: open, then fetch a fresh one.
              globalThis.open(portalQuery.data!, '_blank', 'noopener,noreferrer');
              void portalQuery.refetch();
            }}
          >
            Open in WorkOS
          </Button>
        ) : null}
      </div>

      {trail && covered && trail.events.length > 0 ? (
        <AuditStrip
          events={trail.events}
          from={covered.from}
          to={covered.to}
          slice={slice ?? covered}
          onSlice={setSlice}
          shown={shown}
        />
      ) : null}

      {picked ? (
        <div className="text-ui-xs text-icon2 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="font-mono tabular-nums">
            {stamp(picked.from, spansDays)} → {stamp(picked.to, spansDays)}
          </span>
          <span className="font-mono tabular-nums">{formatDuration(picked.to - picked.from)}</span>
          <span className="text-icon3 ml-auto font-mono tabular-nums">{rows.length} events</span>
        </div>
      ) : null}

      {trail && trail.coveredFrom > trail.from ? (
        <Txt as="p" variant="ui-xs" className="text-icon2 m-0">
          Seven days runs past what one read can hold — this window starts at {dayOf(trail.coveredFrom)}{' '}
          {clock(trail.coveredFrom)}.
        </Txt>
      ) : null}

      {windowQuery.isPending ? (
        <div className="min-h-0 flex-1">
          <SkeletonRows label="Loading audit events" rows={12} rowClassName="h-7 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          className="min-h-0 flex-1"
          as="h2"
          iconSlot={<ScrollText className="text-icon3 size-5" aria-hidden />}
          titleSlot={filtered ? 'Nothing happened in this slice' : 'No audit events yet'}
          descriptionSlot={
            filtered
              ? 'Nothing recorded matches these filters.'
              : 'Board changes, runs, and git actions will appear here.'
          }
          actionSlot={
            filtered ? (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Show all events
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          <ul className="border-border1 m-0 flex list-none flex-col border-t p-0 pr-1" aria-label="Audit events">
            {rows.slice(0, LIST_CAP).map(event => {
              const at = Date.parse(event.occurredAt);
              return (
                <AuditEventRow
                  key={event.id}
                  event={event}
                  actor={trail?.actors[event.actorId]}
                  stamp={stamp(at, spansDays)}
                  title={titles.get(targetItemId(event) ?? '')}
                  expanded={opened === event.id}
                  onToggle={() => setOpened(current => (current === event.id ? null : event.id))}
                />
              );
            })}
          </ul>
          {rows.length > LIST_CAP ? (
            <Txt as="p" variant="ui-xs" className="text-icon2 m-0 px-2 py-2.5">
              {rows.length - LIST_CAP} older events in this slice are not drawn — narrow the strip or a filter to reach
              them.
            </Txt>
          ) : null}
        </ScrollArea>
      )}
    </section>
  );
}
