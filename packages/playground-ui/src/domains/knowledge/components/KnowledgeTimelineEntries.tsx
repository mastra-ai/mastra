import { useMemo, useState } from 'react';

import { KnowledgeDetailSection } from './KnowledgePageDetail';
import type {
  KnowledgeExplorerSource,
  KnowledgeExplorerTimelineEntry,
  KnowledgeExplorerTimelineRequest,
} from './KnowledgePageExplorer';

import { Badge } from '@/ds/components/Badge';
import { Button } from '@/ds/components/Button';
import { Input } from '@/ds/components/Input';
import { SearchInput } from '@/ds/components/SearchInput';
import { SkeletonText } from '@/ds/components/Skeleton';
import { Txt } from '@/ds/components/Txt';

type Filters = Omit<KnowledgeExplorerTimelineRequest, 'cursor'>;

/** A `datetime-local` value is local time without a zone; the server wants an ISO time with one. */
function isoFromLocal(value: string): string | undefined {
  if (!value) return undefined;
  const time = new Date(value);
  return Number.isNaN(time.getTime()) ? undefined : time.toISOString();
}

const timeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function EntryItem({ entry, onOpenThread }: { entry: KnowledgeExplorerTimelineEntry; onOpenThread?: () => void }) {
  const author = entry.author?.name ?? entry.author?.sourceId ?? entry.writtenBy;
  return (
    <li className="flex flex-col gap-1 border-b border-border pb-3 last:border-b-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Txt as="span" variant="body-sm" tone="ink">
          {author}
        </Txt>
        <Txt as="span" variant="caption" tone="muted" className="tabular-nums">
          <time dateTime={entry.occurredAt}>{timeFormat.format(new Date(entry.occurredAt))}</time>
        </Txt>
        {entry.editedAt && !entry.deletedAt ? (
          <Txt as="span" variant="caption" tone="muted">
            (edited)
          </Txt>
        ) : null}
        {entry.threadExternalId ? (
          <Badge variant="neutral" size="sm">
            Reply
          </Badge>
        ) : null}
      </div>
      {entry.deletedAt ? (
        <Txt variant="body-sm" tone="muted" className="italic">
          Deleted
        </Txt>
      ) : (
        <Txt variant="body-sm" className="wrap-anywhere whitespace-pre-wrap">
          {entry.body}
        </Txt>
      )}
      {onOpenThread ? (
        <Button variant="ghost" size="sm" className="self-start" onClick={onOpenThread}>
          Open thread
        </Button>
      ) : null}
    </li>
  );
}

/**
 * A timeline page's entries: newest first, paged older with a cursor, narrowed to a date range or one
 * thread, or searched by keyword. Data comes from the host's `useTimeline`, one result per request.
 */
export function KnowledgeTimelineEntries({
  pageId,
  useTimeline,
}: {
  pageId: string;
  useTimeline: NonNullable<KnowledgeExplorerSource['useTimeline']>;
}) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [ascending, setAscending] = useState(false);
  const [thread, setThread] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [cursors, setCursors] = useState<string[]>([]);

  const filters = useMemo<Filters>(() => {
    // A thread reads oldest first, like a conversation.
    const next: Filters = { order: thread || ascending ? 'asc' : 'desc' };
    const since = isoFromLocal(from);
    const until = isoFromLocal(to);
    if (since) next.since = since;
    if (until) next.until = until;
    if (thread) next.thread = thread;
    if (query) next.q = query;
    return next;
  }, [from, to, ascending, thread, query]);
  const requests = useMemo(() => [filters, ...cursors.map(cursor => ({ ...filters, cursor }))], [filters, cursors]);
  const results = useTimeline(pageId, requests);
  // Polling can move the boundary of any loaded page. Reanchor the following request before
  // displaying it, then rebuild later pages from that response rather than keeping stale cursors.
  for (let index = 0; index < cursors.length; index++) {
    const previous = results[index]?.data;
    if (!previous) break;
    if (previous.nextCursor !== cursors[index]) {
      setCursors(
        previous.nextCursor
          ? [...cursors.slice(0, index), previous.nextCursor, ...cursors.slice(index + 1)]
          : cursors.slice(0, index),
      );
      break;
    }
  }
  const entries = results.flatMap(result => result.data?.entries ?? []);
  const next = results[results.length - 1]?.data?.nextCursor;

  // Any filter change starts the list again from its first page.
  const refilter =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      setCursors([]);
      set(value);
    };

  return (
    <KnowledgeDetailSection label="Entries">
      <div className="flex flex-wrap items-end gap-2">
        <form
          className="min-w-48 flex-1"
          onSubmit={event => {
            event.preventDefault();
            refilter(setQuery)(draft.trim());
            if (draft.trim()) setThread(null);
          }}
        >
          <SearchInput
            label="Search entries"
            placeholder="Search entries"
            size="sm"
            value={draft}
            onValueChange={value => {
              setDraft(value);
              if (!value.trim() && query) refilter(setQuery)('');
            }}
          />
        </form>
        <label className="flex flex-col gap-1">
          <Txt as="span" variant="caption" tone="muted">
            From
          </Txt>
          <Input
            type="datetime-local"
            size="sm"
            aria-label="From"
            value={from}
            onChange={event => refilter(setFrom)(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <Txt as="span" variant="caption" tone="muted">
            To
          </Txt>
          <Input
            type="datetime-local"
            size="sm"
            aria-label="To"
            value={to}
            onChange={event => refilter(setTo)(event.target.value)}
          />
        </label>
        {thread ? null : (
          <Button variant="ghost" size="sm" onClick={() => refilter(setAscending)(!ascending)}>
            {ascending ? 'Newest first' : 'Oldest first'}
          </Button>
        )}
      </div>
      {thread ? (
        <div className="flex items-center gap-2">
          <Txt as="span" variant="caption" tone="muted">
            Thread {thread}
          </Txt>
          <Button variant="ghost" size="sm" onClick={() => refilter(setThread)(null)}>
            All entries
          </Button>
        </div>
      ) : null}
      {results[0]?.isPending ? (
        <div aria-label="Loading entries" className="flex flex-col gap-2">
          <SkeletonText className="w-3/4" />
          <SkeletonText className="w-1/2" />
          <SkeletonText className="w-2/3" />
        </div>
      ) : results[0]?.isError ? (
        <Txt variant="body-sm" tone="muted">
          {results[0].error?.message ?? 'Failed to load the entries'}
        </Txt>
      ) : entries.length === 0 ? (
        <Txt variant="body-sm" tone="muted">
          {query ? 'No entries match.' : 'No entries here yet.'}
        </Txt>
      ) : (
        <ol aria-label="Timeline entries" className="flex flex-col gap-3">
          {entries.map(entry => (
            <EntryItem
              key={entry.id}
              entry={entry}
              onOpenThread={
                thread || entry.deletedAt
                  ? undefined
                  : () => {
                      setQuery('');
                      setDraft('');
                      refilter(setThread)(entry.threadExternalId ?? entry.externalId);
                    }
              }
            />
          ))}
        </ol>
      )}
      {next ? (
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => setCursors(current => [...current, next])}
        >
          {filters.order === 'asc' ? 'Load newer entries' : 'Load older entries'}
        </Button>
      ) : null}
    </KnowledgeDetailSection>
  );
}
