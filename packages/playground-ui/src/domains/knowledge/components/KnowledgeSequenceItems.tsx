import { useMemo, useState } from 'react';

import { KnowledgeDetailSection } from './KnowledgePageDetail';
import type {
  KnowledgeExplorerSource,
  KnowledgeExplorerSequenceItem,
  KnowledgeExplorerSequenceRequest,
} from './KnowledgePageExplorer';

import { Badge } from '@/ds/components/Badge';
import { Button } from '@/ds/components/Button';
import { Input } from '@/ds/components/Input';
import { SearchInput } from '@/ds/components/SearchInput';
import { SkeletonText } from '@/ds/components/Skeleton';
import { Txt } from '@/ds/components/Txt';

type Filters = Omit<KnowledgeExplorerSequenceRequest, 'cursor'>;

/** A `datetime-local` value is local time without a zone; the server wants an ISO time with one. */
function isoFromLocal(value: string): string | undefined {
  if (!value) return undefined;
  const time = new Date(value);
  return Number.isNaN(time.getTime()) ? undefined : time.toISOString();
}

const timeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function ItemItem({ item, onOpenThread }: { item: KnowledgeExplorerSequenceItem; onOpenThread?: () => void }) {
  const author = item.author?.name ?? item.author?.sourceId ?? item.writtenBy;
  return (
    <li className="flex flex-col gap-1 border-b border-border pb-3 last:border-b-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Txt as="span" variant="body-sm" tone="ink">
          {author}
        </Txt>
        <Txt as="span" variant="caption" tone="muted" className="tabular-nums">
          <time dateTime={item.occurredAt}>{timeFormat.format(new Date(item.occurredAt))}</time>
        </Txt>
        {item.editedAt && !item.deletedAt ? (
          <Txt as="span" variant="caption" tone="muted">
            (edited)
          </Txt>
        ) : null}
        {item.externalParentId ? (
          <Badge variant="neutral" size="sm">
            Reply
          </Badge>
        ) : null}
      </div>
      {item.deletedAt ? (
        <Txt variant="body-sm" tone="muted" className="italic">
          Deleted
        </Txt>
      ) : (
        <Txt variant="body-sm" className="wrap-anywhere whitespace-pre-wrap">
          {item.body}
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
 * A sequence page's items: newest first, paged older with a cursor, narrowed to a date range or one
 * thread, or searched by keyword. Data comes from the host's `useSequence`, one result per request.
 */
export function KnowledgeSequenceItems({
  pageId,
  useSequence,
}: {
  pageId: string;
  useSequence: NonNullable<KnowledgeExplorerSource['useSequence']>;
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
  const results = useSequence(pageId, requests);
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
  const items = results.flatMap(result => result.data?.items ?? []);
  const next = results[results.length - 1]?.data?.nextCursor;

  // Any filter change starts the list again from its first page.
  const refilter =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      setCursors([]);
      set(value);
    };

  return (
    <KnowledgeDetailSection label="Items">
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
            label="Search items"
            placeholder="Search items"
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
            All items
          </Button>
        </div>
      ) : null}
      {results[0]?.isPending ? (
        <div aria-label="Loading items" className="flex flex-col gap-2">
          <SkeletonText className="w-3/4" />
          <SkeletonText className="w-1/2" />
          <SkeletonText className="w-2/3" />
        </div>
      ) : results[0]?.isError ? (
        <Txt variant="body-sm" tone="muted">
          {results[0].error?.message ?? 'Failed to load the items'}
        </Txt>
      ) : items.length === 0 ? (
        <Txt variant="body-sm" tone="muted">
          {query ? 'No items match.' : 'No items here yet.'}
        </Txt>
      ) : (
        <ol aria-label="Sequence items" className="flex flex-col gap-3">
          {items.map(item => (
            <ItemItem
              key={item.id}
              item={item}
              onOpenThread={
                thread || item.deletedAt
                  ? undefined
                  : () => {
                      setQuery('');
                      setDraft('');
                      refilter(setThread)(item.externalParentId ?? item.externalId);
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
          {filters.order === 'asc' ? 'Load newer items' : 'Load older items'}
        </Button>
      ) : null}
    </KnowledgeDetailSection>
  );
}
