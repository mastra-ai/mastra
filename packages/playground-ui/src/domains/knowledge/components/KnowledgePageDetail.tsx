import { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import type { Components, ExtraProps } from 'react-markdown';

import { scopeTitle } from '../lib/pageAddress';
import { knowledgePageRefIndex, noteMentionTarget } from '../lib/pageRefs';
import type { KnowledgePageRefIndex } from '../lib/pageRefs';
import { KnowledgePagesByRef } from '../lib/pagesByRefContext';
import { parseRecordSegments } from '../lib/recordText';
import { KNOWLEDGE_REF_PROPERTY, remarkKnowledgeLinks } from '../lib/remarkKnowledgeLinks';
import type {
  KnowledgeActivityAction,
  KnowledgePageActivityPayload,
  KnowledgeNotePayload,
  KnowledgePagePayload,
  KnowledgePinPayload,
} from '../pageTypes';
import { KnowledgeSourceIcon } from './KnowledgeSourceIcon';
import { KnowledgeTooltip } from './KnowledgeTooltip';

import { Badge } from '@/ds/components/Badge';
import { Breadcrumb, Crumb } from '@/ds/components/Breadcrumb';
import { MarkdownRenderer } from '@/ds/components/MarkdownRenderer';
import { Metadata } from '@/ds/components/Metadata';
import { RelativeTimestamp } from '@/ds/components/RelativeTimestamp';
import { Txt } from '@/ds/components/Txt';
import { IconPin } from '@/ds/icons/central/IconPin';

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

/** Who wrote something, readably: an importer's run id reads as "Importer". */
function authorName(author: string): string {
  return author.startsWith('importer:') ? 'Importer' : author;
}

/** A small round mark with the author's initial, tinted per author so a page's writers tell apart. */
function AuthorMark({ author }: { author: string }) {
  const name = author.includes(':') ? author.slice(author.indexOf(':') + 1) : author;
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
 * The page's address: its home scope, then the keys from that scope down to it
 * (`org:acme#policies/refund`). Null when a page on the way has no key.
 */
function knowledgePagePath(page: KnowledgePagePayload, ancestors: KnowledgePagePayload[]): string | null {
  if (page.isScope) return page.address ?? null;
  const scope = ancestors.find(candidate => candidate.id === page.scopeId);
  if (!scope?.address) return null;
  const below = ancestors.slice(ancestors.indexOf(scope) + 1).filter(candidate => !candidate.isScope);
  const keys = [...below, page].map(candidate => candidate.key);
  if (keys.some(key => !key)) return null;
  return `${scope.address}#${keys.join('/')}`;
}

const BodyLinks = createContext<{
  index: KnowledgePageRefIndex;
  onPageClick: (page: KnowledgePagePayload) => void;
} | null>(null);

/**
 * A `[[ref]]` from a page body: the page's name as a link when a loaded page answers to the ref, the ref
 * itself in a quiet style when none does. Every other `<span>` the markdown makes passes through.
 */
function BodySpan({ node, ...props }: ComponentProps<'span'> & ExtraProps) {
  const links = useContext(BodyLinks);
  const ref = node?.properties[KNOWLEDGE_REF_PROPERTY];
  if (typeof ref !== 'string' || !links) return <span {...props} />;
  const target = links.index.resolve(ref);
  return target ? (
    <KnowledgeTooltip label={ref}>
      <button
        type="button"
        data-testid="knowledge-body-link"
        className="rounded bg-badge-blue-subtle px-1 text-left font-medium wrap-anywhere text-badge-blue-foreground hover:underline"
        onClick={() => links.onPageClick(target)}
      >
        {target.name}
      </button>
    </KnowledgeTooltip>
  ) : (
    <KnowledgeTooltip label="No loaded page has this address">
      <span
        data-testid="knowledge-body-link-unresolved"
        className="rounded border border-dashed border-border px-1 wrap-anywhere text-muted-foreground"
      >
        {ref}
      </span>
    </KnowledgeTooltip>
  );
}

const BODY_REMARK_PLUGINS = [remarkKnowledgeLinks];
const BODY_COMPONENTS: Components = { span: BodySpan };

export function KnowledgeDetailSection({
  label,
  count,
  children,
}: {
  label: string;
  count?: number;
  children: ReactNode;
}) {
  return (
    <section aria-label={label} className="flex flex-col gap-2">
      <Txt as="h3" variant="label" tone="ink" className="flex items-center gap-1.5">
        {label}
        {count ? (
          <Txt as="span" variant="label" tone="muted" className="tabular-nums">
            {count}
          </Txt>
        ) : null}
      </Txt>
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

type PageMap = ReadonlyMap<string, KnowledgePagePayload>;
const refIndexes = new WeakMap<PageMap, WeakMap<PageMap, KnowledgePageRefIndex>>();

/** One ref index per loaded-pages map (and pages fetched by ref), shared by every note drawn from it. */
function loadedRefIndex(pagesById: PageMap, byRef: PageMap): KnowledgePageRefIndex {
  let forPages = refIndexes.get(pagesById);
  if (!forPages) refIndexes.set(pagesById, (forPages = new WeakMap()));
  let index = forPages.get(byRef);
  if (!index) forPages.set(byRef, (index = knowledgePageRefIndex(pagesById.values(), byRef)));
  return index;
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
  const refIndex = loadedRefIndex(pagesById, useContext(KnowledgePagesByRef));
  // Only a page the server resolved the mention to is linked, however the ref is written.
  const mentionTarget = (ref: string) => noteMentionTarget(refIndex, pagesById, note.mentions, ref);
  const scopeLabel = (id: string) => {
    const scopePage = pagesById.get(id);
    return scopePage?.address ?? scopePage?.name ?? id;
  };
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
          <Txt as="span" variant="label" tone="ink">
            {authorName(note.provenance.author)}
          </Txt>
          <Txt as="span" variant="caption" tone="muted">
            <RelativeTimestamp value={note.updatedAt} />
          </Txt>
          {onPage ? (
            <Txt as="span" variant="caption" tone="muted">
              on <PageLink page={onPage} onPageClick={onPageClick} />
            </Txt>
          ) : null}
        </div>
        <p className="text-ui-md wrap-anywhere text-foreground">
          {parseRecordSegments(note.text).map((segment, index) => {
            if (segment.type === 'text') return <span key={index}>{segment.value}</span>;
            const target = mentionTarget(segment.value);
            return target ? (
              <KnowledgeTooltip key={index} label={segment.value}>
                <button
                  type="button"
                  data-testid="knowledge-note-link"
                  className="rounded bg-badge-blue-subtle px-1 text-left font-medium wrap-anywhere text-badge-blue-foreground hover:underline"
                  onClick={() => onPageClick(target)}
                >
                  {target.name}
                </button>
              </KnowledgeTooltip>
            ) : (
              <span key={index} className="font-medium wrap-anywhere">
                {segment.value}
              </span>
            );
          })}
        </p>
        {note.stampScopeIds.length > 0 ? (
          <div className="flex min-w-0 flex-wrap gap-1" aria-label="Stamped to">
            {note.stampScopeIds.map(id => (
              <Badge key={id} variant="neutral" size="xs" title={scopeLabel(id)}>
                <span className="truncate">{scopeLabel(id)}</span>
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
  compact = false,
}: {
  compact?: boolean;
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
  activity?: KnowledgePageActivityPayload[];
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

  const kind = page.isScope ? (page.displayLabel ?? 'Scope') : 'Page';
  // Core's `related` leaves out the page and its ancestors, so notes mentioning them resolve against these too.
  const notePages = useMemo(
    () => new Map([...pagesById, ...[...ancestors, page].map(entry => [entry.id, entry] as const)]),
    [pagesById, ancestors, page],
  );
  const pagesByRef = useContext(KnowledgePagesByRef);
  const refIndex = useMemo(
    () => knowledgePageRefIndex([...pagesById.values(), ...ancestors, page], pagesByRef),
    [pagesById, ancestors, page, pagesByRef],
  );
  const bodyLinks = useMemo(() => ({ index: refIndex, onPageClick }), [refIndex, onPageClick]);

  return (
    <article
      key={page.id}
      aria-label={page.name}
      className="@container flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain"
    >
      <header
        className={
          compact
            ? 'flex flex-col gap-3 border-b border-surface-rim px-4 pt-3 pb-4'
            : 'flex flex-col gap-3 border-b border-border bg-fill-subtle px-6 pt-5 pb-4'
        }
      >
        <Breadcrumb label="Breadcrumb" className="ml-[-.9em] min-w-0" listClassName="overflow-hidden">
          {ancestors.map(ancestor => (
            <Crumb key={ancestor.id} as="button" onClick={() => onPageClick(ancestor)}>
              {scopeTitle(ancestor)}
            </Crumb>
          ))}
          <Crumb as="span" isCurrent>
            {scopeTitle(page)}
          </Crumb>
        </Breadcrumb>
        <div className="flex flex-col gap-2">
          {compact ? null : (
            <div className="flex min-w-0 items-center gap-2">
              <KnowledgeSourceIcon page={page} className="size-icon-lg" />
              <KnowledgeTooltip label={(page.isScope ? page.address : path) ?? page.name}>
                <Txt as="h2" variant="title" className="min-w-0 break-words" data-testid="knowledge-page-title">
                  {scopeTitle(page)}
                </Txt>
              </KnowledgeTooltip>
              <Badge variant="neutral" size="sm" className="shrink-0 tabular-nums">
                v{page.version}
              </Badge>
            </div>
          )}
          {page.description ? (
            <Txt variant="body" tone="muted">
              {page.description}
            </Txt>
          ) : null}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Badge variant={page.isScope ? 'info' : 'neutral'} size="sm">
              {kind}
            </Badge>
            {pin ? (
              <Badge variant="warning" size="sm" icon={<IconPin size={10} aria-hidden />}>
                {pin.audience.length > 0 ? `Pinned for ${pin.audience.join(', ')}` : 'Pinned'}
              </Badge>
            ) : null}
            <Txt as="span" variant="caption" tone="muted" data-testid="knowledge-page-version">
              <Metadata>
                {page.isScope ? null : <Metadata.Item>In {scope ? scopeTitle(scope) : page.scopeId}</Metadata.Item>}
                {compact ? <Metadata.Item>v{page.version}</Metadata.Item> : null}
                <Metadata.Item>
                  Updated{' '}
                  <RelativeTimestamp value={page.updatedAt} label={`Updated by ${authorName(page.updatedBy.author)}`} />
                </Metadata.Item>
              </Metadata>
            </Txt>
          </div>
        </div>
      </header>

      <div className={`flex flex-col gap-8 ${compact ? 'p-4' : 'p-6'} @4xl:flex-row`}>
        <div className="flex min-w-0 flex-col gap-8 @4xl:flex-1">
          {page.body ? (
            <div data-testid="knowledge-page-body" className="max-w-3xl">
              <BodyLinks.Provider value={bodyLinks}>
                <MarkdownRenderer remarkPlugins={BODY_REMARK_PLUGINS} components={BODY_COMPONENTS}>
                  {page.body}
                </MarkdownRenderer>
              </BodyLinks.Provider>
            </div>
          ) : (
            <Txt variant="body" tone="muted">
              This {page.isScope ? 'scope' : 'page'} has no body yet.
            </Txt>
          )}

          {notes.length > 0 || notesMore ? (
            <KnowledgeDetailSection label="Notes" count={notesMore ? undefined : notes.length}>
              <ul className="flex flex-col gap-2">
                {notes.map(note => {
                  const highlighted = !!highlightMentionOf && note.mentions.includes(highlightMentionOf);
                  const takeRef = highlighted && !highlightRefSet;
                  if (takeRef) highlightRefSet = true;
                  return (
                    <KnowledgeNoteItem
                      key={note.id}
                      note={note}
                      pagesById={notePages}
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
              {notesMore}
            </KnowledgeDetailSection>
          ) : null}
        </div>

        <aside className="flex min-w-0 flex-col divide-y divide-border border-t border-border *:py-6 *:last:pb-0 @4xl:w-72 @4xl:shrink-0 @4xl:border-t-0 @4xl:border-l @4xl:pl-8 @4xl:*:first:pt-0">
          {childPages}

          {mentionedBy.length > 0 ? (
            <KnowledgeDetailSection label="Mentioned in" count={mentionedBy.length}>
              <ul className="flex flex-col gap-2">
                {mentionedBy.map(note => (
                  <KnowledgeNoteItem
                    key={note.id}
                    note={note}
                    pagesById={notePages}
                    onPageClick={onPageClick}
                    showPage
                    compact
                  />
                ))}
              </ul>
            </KnowledgeDetailSection>
          ) : null}

          {activity && activity.length > 0 ? (
            <KnowledgeDetailSection label="Activity">
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
                    <Txt as="span" variant="caption" tone="muted" className="min-w-0">
                      <Metadata singleLine>
                        <Metadata.Item className="min-w-0">
                          <KnowledgeTooltip label={event.provenance.author}>
                            <span className="truncate">{authorName(event.provenance.author)}</span>
                          </KnowledgeTooltip>
                        </Metadata.Item>
                        <Metadata.Item className="shrink-0">
                          <RelativeTimestamp value={event.createdAt} />
                        </Metadata.Item>
                      </Metadata>
                    </Txt>
                  </li>
                ))}
              </ol>
            </KnowledgeDetailSection>
          ) : null}
        </aside>
      </div>
    </article>
  );
}
