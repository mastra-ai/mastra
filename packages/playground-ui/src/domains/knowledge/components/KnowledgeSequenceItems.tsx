import { useMemo, useState } from 'react';

import { KnowledgeDetailSection } from './KnowledgePageDetail';
import type {
  KnowledgeExplorerSequenceInfo,
  KnowledgeExplorerSequenceItem,
  KnowledgeExplorerSequenceRequest,
  KnowledgeExplorerSource,
} from './KnowledgePageExplorer';

import { Badge } from '@/ds/components/Badge';
import { Button } from '@/ds/components/Button';
import { Input } from '@/ds/components/Input';
import { SearchInput } from '@/ds/components/SearchInput';
import { SkeletonText } from '@/ds/components/Skeleton';
import { Txt } from '@/ds/components/Txt';

type Filters = Omit<KnowledgeExplorerSequenceRequest, 'cursor'>;
/** Every item, only untyped items, or one declared type. */
type TypeFilter = { kind: 'all' } | { kind: 'untyped' } | { kind: 'type'; type: string };

/** A `datetime-local` value is local time without a zone; the server wants an ISO time with one. */
function isoFromLocal(value: string): string | undefined {
  if (!value) return undefined;
  const time = new Date(value);
  return Number.isNaN(time.getTime()) ? undefined : time.toISOString();
}

const timeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** The schema that covers an item's properties: its declared type's, or the sequence's for an untyped one. */
function propertiesSchemaFor(info: KnowledgeExplorerSequenceInfo | undefined, type: string | null) {
  if (!info) return undefined;
  return type === null ? info.propertiesSchema : info.itemTypes?.[type]?.propertiesSchema;
}

/** Declared properties first, in schema order, then the rest as the item stores them. */
function orderedProperties(
  properties: Record<string, unknown>,
  declared: Record<string, { type: string }> | undefined,
): Array<[string, unknown, string | undefined]> {
  const declaredKeys = Object.keys(declared ?? {}).filter(key => key in properties);
  const rest = Object.keys(properties).filter(key => !declared || !(key in declared));
  return [...declaredKeys, ...rest].map(key => [key, properties[key], declared?.[key]?.type]);
}

function propertyText(value: unknown, type: string | undefined): string {
  if (type === 'date' && typeof value === 'string') {
    const time = new Date(value);
    if (!Number.isNaN(time.getTime())) return timeFormat.format(time);
  }
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.every(part => typeof part !== 'object' || part === null)) return value.join(', ');
  return JSON.stringify(value);
}

function ItemRow({
  item,
  info,
  onShowNested,
  onOpenPage,
}: {
  item: KnowledgeExplorerSequenceItem;
  info?: KnowledgeExplorerSequenceInfo;
  onShowNested?: () => void;
  onOpenPage?: (pageId: string) => void;
}) {
  const author = item.author?.name ?? item.author?.sourceId;
  const typeLabel = item.type ? (info?.itemTypes?.[item.type]?.label ?? item.type) : null;
  const properties = item.properties
    ? orderedProperties(item.properties, propertiesSchemaFor(info, item.type)?.properties)
    : [];
  const pageId = item.pageId;
  return (
    <li className="flex flex-col gap-1 border-b border-border pb-3 last:border-b-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {typeLabel ? (
          <Badge variant="neutral" size="sm">
            {typeLabel}
          </Badge>
        ) : null}
        {author ? (
          <Txt as="span" variant="body-sm" tone="ink">
            {author}
          </Txt>
        ) : null}
        {item.occurredAt ? (
          <Txt as="span" variant="caption" tone="muted" className="tabular-nums">
            <time dateTime={item.occurredAt}>{timeFormat.format(new Date(item.occurredAt))}</time>
          </Txt>
        ) : null}
        {item.editedAt && !item.deletedAt ? (
          <Txt as="span" variant="caption" tone="muted">
            (edited)
          </Txt>
        ) : null}
        {item.externalParentId ? (
          <Badge variant="neutral" size="sm">
            Nested
          </Badge>
        ) : null}
      </div>
      {item.deletedAt ? (
        <Txt variant="body-sm" tone="muted" className="italic">
          Deleted
        </Txt>
      ) : (
        <>
          {item.title ? (
            pageId && onOpenPage ? (
              <Button variant="ghost" size="sm" className="self-start" onClick={() => onOpenPage(pageId)}>
                {item.title}
              </Button>
            ) : (
              <Txt as="strong" variant="body-sm" tone="ink" className="wrap-anywhere">
                {item.title}
              </Txt>
            )
          ) : null}
          {item.body ? (
            <Txt variant="body-sm" className="wrap-anywhere whitespace-pre-wrap">
              {item.body}
            </Txt>
          ) : null}
          {item.links.length ? (
            <ul aria-label="Links" className="flex flex-col gap-0.5">
              {item.links.map(link => (
                <li key={link.url}>
                  <a href={link.url} target="_blank" rel="noreferrer" className="wrap-anywhere underline">
                    <Txt as="span" variant="body-sm">
                      {link.title ?? link.url}
                    </Txt>
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
          {properties.length ? (
            <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5">
              {properties.map(([key, value, type]) => (
                <div key={key} className="contents">
                  <dt>
                    <Txt as="span" variant="caption" tone="muted">
                      {key}
                    </Txt>
                  </dt>
                  <dd className="wrap-anywhere">
                    <Txt as="span" variant="caption">
                      {propertyText(value, type)}
                    </Txt>
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </>
      )}
      {onShowNested ? (
        <Button variant="ghost" size="sm" className="self-start" onClick={onShowNested}>
          Show nested items
        </Button>
      ) : null}
    </li>
  );
}

/**
 * A sequence page's items in the sequence's order, paged with a cursor, narrowed to a date range
 * (timeline sequences), one item and the items nested under it, or an item type, or searched by
 * keyword. Data comes from the host's `useSequence`, one result per request.
 */
export function KnowledgeSequenceItems({
  pageId,
  info,
  useSequence,
  onOpenPage,
}: {
  pageId: string;
  /** How the sequence orders its items and the schemas it declares, from the page read. */
  info: KnowledgeExplorerSequenceInfo;
  useSequence: NonNullable<KnowledgeExplorerSource['useSequence']>;
  /** Opens a child page listed as an item. */
  onOpenPage?: (pageId: string) => void;
}) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [reversed, setReversed] = useState(false);
  const [parent, setParent] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>({ kind: 'all' });
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [cursors, setCursors] = useState<string[]>([]);
  const position = info.orderBy === 'position';

  const filters = useMemo<Filters>(() => {
    const next: Filters = {};
    // Nested items read oldest first, like a conversation; otherwise the sequence's own order unless reversed.
    if (parent) next.order = 'asc';
    else if (reversed) next.order = position ? 'desc' : 'asc';
    const since = position ? undefined : isoFromLocal(from);
    const until = position ? undefined : isoFromLocal(to);
    if (since) next.since = since;
    if (until) next.until = until;
    if (parent) next.parent = parent;
    if (typeFilter.kind === 'type') next.types = [typeFilter.type];
    if (typeFilter.kind === 'untyped') next.untyped = true;
    if (query) next.q = query;
    return next;
  }, [from, to, reversed, parent, typeFilter, query, position]);
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
  const declaredTypes = Object.entries(info.itemTypes ?? {});

  // Any filter change starts the list again from its first page.
  const refilter =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      setCursors([]);
      set(value);
    };

  const loadLabel = position ? 'Load more items' : filters.order === 'asc' ? 'Load newer items' : 'Load older items';
  const orderLabel = position ? (reversed ? 'First first' : 'Last first') : reversed ? 'Newest first' : 'Oldest first';

  return (
    <KnowledgeDetailSection label="Items">
      <div className="flex flex-wrap items-end gap-2">
        <form
          className="min-w-48 flex-1"
          onSubmit={event => {
            event.preventDefault();
            refilter(setQuery)(draft.trim());
            if (draft.trim()) setParent(null);
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
        {position ? null : (
          <>
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
          </>
        )}
        {parent ? null : (
          <Button variant="ghost" size="sm" onClick={() => refilter(setReversed)(!reversed)}>
            {orderLabel}
          </Button>
        )}
      </div>
      {declaredTypes.length ? (
        <div role="group" aria-label="Item type" className="flex flex-wrap gap-1">
          {[
            { key: 'all', label: 'All types', filter: { kind: 'all' } as TypeFilter },
            ...declaredTypes.map(([type, declared]) => ({
              key: `type:${type}`,
              label: declared.label ?? type,
              filter: { kind: 'type', type } as TypeFilter,
            })),
            { key: 'untyped', label: 'Untyped', filter: { kind: 'untyped' } as TypeFilter },
          ].map(option => {
            const active =
              option.filter.kind === typeFilter.kind &&
              (option.filter.kind !== 'type' || (typeFilter.kind === 'type' && option.filter.type === typeFilter.type));
            return (
              <Button
                key={option.key}
                variant={active ? 'default' : 'ghost'}
                size="sm"
                aria-pressed={active}
                onClick={() => refilter(setTypeFilter)(option.filter)}
              >
                {option.label}
              </Button>
            );
          })}
        </div>
      ) : null}
      {parent ? (
        <div className="flex items-center gap-2">
          <Txt as="span" variant="caption" tone="muted">
            Under {parent}
          </Txt>
          <Button variant="ghost" size="sm" onClick={() => refilter(setParent)(null)}>
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
            <ItemRow
              key={item.id}
              item={item}
              info={info}
              onOpenPage={onOpenPage}
              onShowNested={
                parent || item.deletedAt || position
                  ? undefined
                  : () => {
                      setQuery('');
                      setDraft('');
                      refilter(setParent)(item.externalParentId ?? item.externalId);
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
          {loadLabel}
        </Button>
      ) : null}
    </KnowledgeDetailSection>
  );
}
