import { ChevronRight, Pin } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

import { authorLabel } from '../lib/authorLabel';
import { parseRecordSegments } from '../lib/recordText';
import type {
  KnowledgeActivityAction,
  KnowledgeActivityPayload,
  KnowledgeNotePayload,
  KnowledgePagePayload,
  KnowledgePinPayload,
} from '../pageTypes';

import { Badge } from '@/ds/components/Badge';
import { MarkdownRenderer } from '@/ds/components/MarkdownRenderer';
import { Txt } from '@/ds/components/Txt';

const ACTIVITY_LABELS: Record<KnowledgeActivityAction, string> = {
  'scope-created': 'Scope created',
  'page-created': 'Page created',
  'page-updated': 'Page edited',
  'page-moved': 'Page moved',
  'page-merged': 'Page merged',
  'page-deleted': 'Page deleted',
  'note-added': 'Note added',
  'note-restamped': 'Note restamped',
  'note-removed': 'Note removed',
  'note-restored': 'Note restored',
  'pin-added': 'Pinned',
  'pin-removed': 'Unpinned',
};

function formatWhen(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

const RELATIVE_STEPS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['second', 60],
  ['minute', 60],
  ['hour', 24],
  ['day', 7],
  ['week', 4.35],
  ['month', 12],
  ['year', Infinity],
];

/** "3 minutes ago", with the exact time left to a tooltip. */
function formatAgo(iso: string, now = Date.now()): string {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return iso;
  let value = (time - now) / 1000;
  const format = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  for (const [unit, size] of RELATIVE_STEPS) {
    if (Math.abs(value) < size) return format.format(Math.round(value), unit);
    value /= size;
  }
  return formatWhen(iso);
}

function When({ iso }: { iso: string }) {
  return (
    <time dateTime={iso} title={formatWhen(iso)}>
      {formatAgo(iso)}
    </time>
  );
}

/** An author as readers know them; the raw actor stays in the tooltip when it was renamed. */
function Author({ author }: { author: string }) {
  const label = authorLabel(author);
  return <span title={label === author ? undefined : author}>{label}</span>;
}

/** A small round mark with the author's initial, tinted per author so a page's writers tell apart. */
function AuthorMark({ author }: { author: string }) {
  const label = authorLabel(author);
  const name = label !== author || !author.includes(':') ? label : author.slice(author.indexOf(':') + 1);
  let hash = 0;
  for (const char of author) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  const hues = ['--chart-blue', '--chart-purple', '--chart-green', '--chart-orange', '--chart-pink'];
  const hue = hues[Math.abs(hash) % hues.length];
  return (
    <span
      aria-hidden
      className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border"
      style={{ background: `color-mix(in oklab, var(${hue}) 28%, var(--card))` }}
    >
      <Txt as="span" variant="meta" tone="ink">
        {(name.trim()[0] ?? '?').toUpperCase()}
      </Txt>
    </span>
  );
}

/**
 * The page's path: its home scope by name, then the keys from that scope down
 * to it (`Acme / policies / refund`), with the full address
 * (`org:acme#policies/refund`) kept for the tooltip. Null when a page on the
 * way has no key.
 */
function knowledgePagePath(
  page: KnowledgePagePayload,
  ancestors: KnowledgePagePayload[],
): { label: string; address: string } | null {
  const scope = ancestors.find(candidate => candidate.id === page.scopeId);
  if (!scope?.address) return null;
  const below = ancestors.slice(ancestors.indexOf(scope) + 1).filter(candidate => !candidate.isScope);
  const keys = [...below, page].map(candidate => candidate.key);
  if (keys.some(key => !key)) return null;
  return { label: [scope.name, ...keys].join(' / '), address: `${scope.address}#${keys.join('/')}` };
}

/** A scope by name, with its raw address only in the tooltip. */
function ScopeName({ scope, fallback }: { scope: KnowledgePagePayload | undefined; fallback: string }) {
  return <span title={scope?.address ?? undefined}>{scope?.name ?? scope?.address ?? fallback}</span>;
}

function Section({ label, count, children }: { label: string; count?: number; children: ReactNode }) {
  return (
    <section aria-label={label} className="flex flex-col gap-3">
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <Txt as="h3" variant="eyebrow" tone="muted" className="uppercase">
          {label}
        </Txt>
        {count !== undefined ? (
          <Badge variant="neutral" size="xs">
            {count}
          </Badge>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function PageLink({
  page,
  onPageClick,
}: {
  page: KnowledgePagePayload;
  onPageClick: (page: KnowledgePagePayload) => void;
}) {
  return (
    <button
      type="button"
      className="text-left font-medium text-info-indicator hover:underline"
      onClick={() => onPageClick(page)}
    >
      {page.name}
    </button>
  );
}

/** One note: who wrote it and when, its text with `[[mentions]]` linked when the page is known, and the scopes it is stamped to. */
export function KnowledgeNoteItem({
  note,
  pagesById,
  onPageClick,
  highlighted,
  itemRef,
  showPage,
  compact,
}: {
  note: KnowledgeNotePayload;
  pagesById: ReadonlyMap<string, KnowledgePagePayload>;
  onPageClick: (page: KnowledgePagePayload) => void;
  highlighted?: boolean;
  itemRef?: (element: HTMLLIElement | null) => void;
  /** Name the page the note sits on, for notes listed away from it. */
  showPage?: boolean;
  /** A tighter layout for popups. */
  compact?: boolean;
}) {
  const mentioned = note.mentions.map(id => pagesById.get(id)).filter(candidate => candidate !== undefined);
  const onPage = showPage ? pagesById.get(note.pageId) : undefined;
  return (
    <li
      ref={itemRef}
      data-highlighted={highlighted || undefined}
      className={`flex gap-3 rounded-lg border border-border bg-card ${compact ? 'p-2' : 'p-3'}`}
      style={highlighted ? { borderColor: 'var(--chart-blue)', boxShadow: '0 0 0 1px var(--chart-blue)' } : undefined}
    >
      {compact ? null : <AuthorMark author={note.provenance.author} />}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <Txt as="span" variant="label" tone="ink" className="[overflow-wrap:anywhere]">
            <Author author={note.provenance.author} />
          </Txt>
          <Txt as="span" variant="caption" tone="muted">
            <When iso={note.updatedAt} />
          </Txt>
          {onPage ? (
            <Txt as="span" variant="caption" tone="muted">
              on <PageLink page={onPage} onPageClick={onPageClick} />
            </Txt>
          ) : null}
        </div>
        <p className="text-ui-md break-words text-foreground">
          {parseRecordSegments(note.text).map((segment, index) => {
            if (segment.type === 'text') return <span key={index}>{segment.value}</span>;
            const name = segment.value.trim().toLocaleLowerCase();
            const target = mentioned.find(candidate => candidate.name.trim().toLocaleLowerCase() === name);
            return target ? (
              <button
                key={index}
                type="button"
                className="rounded bg-badge-blue-subtle px-1 font-medium text-badge-blue-foreground hover:underline"
                onClick={() => onPageClick(target)}
              >
                {segment.value}
              </button>
            ) : (
              <span key={index} className="font-medium">
                {segment.value}
              </span>
            );
          })}
        </p>
        {note.stampScopeIds.length > 0 ? (
          <div className="flex flex-wrap gap-1" aria-label="Stamped to">
            {note.stampScopeIds.map(id => (
              <Badge key={id} variant="neutral" size="xs">
                <ScopeName scope={pagesById.get(id)} fallback={id} />
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
    </li>
  );
}

/**
 * The selected page as a page: where it sits, its body as markdown, its child
 * pages, its notes (each with the scopes it is stamped to and who wrote it),
 * the notes elsewhere that mention it, and its recent activity. Bodies are
 * agent-written, so they render through {@link MarkdownRenderer}, which escapes
 * raw HTML and drops unsafe link schemes.
 *
 * Paged lists take a `…More` slot the host fills with the next page's loader.
 */
export function KnowledgePageDetail({
  page,
  notes,
  pin,
  pagesById,
  onPageClick,
  highlightMentionOf,
  ancestors = [],
  mentionedBy = [],
  notesMore,
  childPages,
  activity,
}: {
  page: KnowledgePagePayload;
  notes: KnowledgeNotePayload[];
  pin?: KnowledgePinPayload;
  /** Loaded pages, for scope names and mention links. */
  pagesById: ReadonlyMap<string, KnowledgePagePayload>;
  onPageClick: (page: KnowledgePagePayload) => void;
  /** Marks the notes that mention this page, e.g. after a mention line in the graph was clicked. */
  highlightMentionOf?: string;
  /** Readable ancestors, root first: a breadcrumb and the page's path. */
  ancestors?: KnowledgePagePayload[];
  /** Notes on other pages that mention this one. */
  mentionedBy?: KnowledgeNotePayload[];
  /** Rendered after the notes: the host's loader for the next page of notes. */
  notesMore?: ReactNode;
  /** The page's children, when the host can list them. */
  childPages?: ReactNode;
  activity?: KnowledgeActivityPayload[];
}) {
  const firstHighlighted = useRef<HTMLLIElement | null>(null);
  useEffect(() => {
    firstHighlighted.current?.scrollIntoView?.({ block: 'nearest' });
  }, [highlightMentionOf, notes]);
  let highlightRefSet = false;
  const scope = page.isScope
    ? page
    : (ancestors.find(candidate => candidate.id === page.scopeId) ?? pagesById.get(page.scopeId));
  const path = knowledgePagePath(page, ancestors);
  const scopeNameAt = (address: string) =>
    [...pagesById.values()].find(candidate => candidate.isScope && candidate.address === address)?.name ?? address;

  const kind = page.isScope ? (page.displayLabel ?? 'Scope') : 'Page';

  return (
    <article aria-label={page.name} className="flex min-h-0 flex-col overflow-y-auto">
      <header className="flex flex-col gap-3 border-b border-border bg-fill-subtle px-6 pt-5 pb-4">
        {ancestors.length > 0 ? (
          <nav aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-1">
              {ancestors.map(ancestor => (
                <li key={ancestor.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    className="text-ui-sm rounded px-1 py-0.5 text-muted-foreground hover:bg-fill hover:text-foreground"
                    onClick={() => onPageClick(ancestor)}
                  >
                    {ancestor.name}
                  </button>
                  <ChevronRight size={12} className="text-muted-foreground" aria-hidden />
                </li>
              ))}
            </ol>
          </nav>
        ) : null}
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={page.isScope ? 'info' : 'neutral'} size="sm">
              {kind}
            </Badge>
            {page.isScope ? null : (
              <Txt as="span" variant="caption" tone="muted">
                in <ScopeName scope={scope} fallback={page.scopeId} />
              </Txt>
            )}
            {pin ? (
              <Badge variant="warning" size="sm" icon={<Pin size={10} aria-hidden />}>
                <span title={pin.audience.join(', ') || undefined}>
                  {pin.audience.length > 0 ? `Pinned for ${pin.audience.map(scopeNameAt).join(', ')}` : 'Pinned'}
                </span>
              </Badge>
            ) : null}
          </div>
          <Txt as="h2" variant="title" className="break-words">
            <span title={page.isScope && page.address ? page.address : undefined}>{page.name}</span>
          </Txt>
          {page.description ? (
            <Txt variant="body" tone="muted">
              {page.description}
            </Txt>
          ) : null}
        </div>
        <dl className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {path && !page.isScope ? (
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">Path</dt>
              <dd>
                <Txt as="span" variant="caption" tone="muted" font="mono" data-testid="knowledge-page-path">
                  <span title={path.address}>{path.label}</span>
                </Txt>
              </dd>
            </div>
          ) : null}
          <div className="flex items-center gap-1.5">
            <dt className="sr-only">Version</dt>
            <dd>
              <Txt
                as="span"
                variant="caption"
                tone="muted"
                className="[overflow-wrap:anywhere]"
                data-testid="knowledge-page-version"
              >
                Version {page.version} · updated <When iso={page.updatedAt} /> by{' '}
                <Author author={page.updatedBy.author} />
              </Txt>
            </dd>
          </div>
        </dl>
      </header>

      <div className="grid gap-8 p-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex min-w-0 flex-col gap-8">
          {page.body ? (
            <div data-testid="knowledge-page-body" className="max-w-3xl">
              <MarkdownRenderer>{page.body}</MarkdownRenderer>
            </div>
          ) : (
            <Txt variant="body" tone="muted" className="italic">
              This {page.isScope ? 'scope' : 'page'} has no body yet.
            </Txt>
          )}

          <Section label="Notes" count={notesMore ? undefined : notes.length}>
            {notes.length === 0 ? (
              <Txt variant="body" tone="muted">
                No notes on this page.
              </Txt>
            ) : (
              <ul className="flex flex-col gap-2">
                {notes.map(note => {
                  const highlighted = !!highlightMentionOf && note.mentions.includes(highlightMentionOf);
                  const takeRef = highlighted && !highlightRefSet;
                  if (takeRef) highlightRefSet = true;
                  return (
                    <KnowledgeNoteItem
                      key={note.id}
                      note={note}
                      pagesById={pagesById}
                      onPageClick={onPageClick}
                      highlighted={highlighted}
                      itemRef={
                        takeRef
                          ? element => {
                              firstHighlighted.current = element;
                            }
                          : undefined
                      }
                    />
                  );
                })}
              </ul>
            )}
            {notesMore}
          </Section>
        </div>

        <aside className="flex min-w-0 flex-col gap-8">
          {childPages ? <Section label="Pages">{childPages}</Section> : null}

          {mentionedBy.length > 0 ? (
            <Section label="Mentioned in" count={mentionedBy.length}>
              <ul className="flex flex-col gap-2">
                {mentionedBy.map(note => (
                  <KnowledgeNoteItem
                    key={note.id}
                    note={note}
                    pagesById={pagesById}
                    onPageClick={onPageClick}
                    showPage
                    compact
                  />
                ))}
              </ul>
            </Section>
          ) : null}

          {activity && activity.length > 0 ? (
            <Section label="Activity">
              <ol className="relative flex flex-col gap-3 border-l border-border pl-4">
                {activity.map(event => (
                  <li key={event.id} className="relative flex flex-col">
                    <span
                      aria-hidden
                      className="absolute top-1.5 -left-5 size-2 rounded-full border border-border bg-card"
                    />
                    <Txt as="span" variant="body-sm" tone="ink">
                      {ACTIVITY_LABELS[event.action] ?? event.action}
                    </Txt>
                    <Txt as="span" variant="caption" tone="muted" className="[overflow-wrap:anywhere]">
                      <Author author={event.provenance.author} /> · <When iso={event.createdAt} />
                    </Txt>
                  </li>
                ))}
              </ol>
            </Section>
          ) : null}
        </aside>
      </div>
    </article>
  );
}
