import { X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { isChildPlaceholder, isScopeGroup, lazyGraph } from '../lib/graphShape';
import { bodyLinkEdges, bodyLinkRefs, knowledgePageRefIndex } from '../lib/pageRefs';
import { childCountLabel } from '../lib/pageTree';
import { mentionPopupPlacement } from '../lib/popupPlacement';

import type {
  KnowledgePageActivityPayload,
  KnowledgeNotePayload,
  KnowledgePageEdge,
  KnowledgePagePayload,
  KnowledgePinPayload,
  KnowledgeScopeGrantPayload,
} from '../pageTypes';
import { KnowledgeNoteItem, KnowledgePageDetail } from './KnowledgePageDetail';
import { KnowledgePageGraph } from './KnowledgePageGraph';
import { KNOWLEDGE_TREE_ROOT, KnowledgePageTree } from './KnowledgePageTree';

import { EmptyState } from '@/ds/components/EmptyState';
import { Txt } from '@/ds/components/Txt';
import { useIsMobile } from '@/hooks/use-is-mobile';

/** `tree` is only a choice below `lg`; wider screens always show the tree beside the graph or the page. */
export type KnowledgeExplorerView = 'tree' | 'graph' | 'page';

/** The bounded page graph a host loads. Without `useTreeLevels`, its pages also feed the tree. */
export interface KnowledgeExplorerGraph {
  pages: KnowledgePagePayload[];
  edges: KnowledgePageEdge[];
  pinnedIds: string[];
  /** Access grants between scopes; hosts whose server doesn't send them leave this out. */
  grants?: KnowledgeScopeGrantPayload[];
  truncated: boolean;
}

export interface KnowledgeExplorerPageDetail {
  page: KnowledgePagePayload;
  notes: KnowledgeNotePayload[];
  /** Cursor for the page's next notes. */
  notesNextCursor?: string;
  pin?: KnowledgePinPayload | null;
  /** Ancestors and referenced pages, which may sit outside the loaded graph. */
  ancestors: KnowledgePagePayload[];
  related: KnowledgePagePayload[];
  /** Notes on other pages that mention this one. */
  mentionedBy?: KnowledgeNotePayload[];
}

/** One level of the tree: a parent's child scopes then its child pages, paged. */
export interface KnowledgeExplorerTreeLevel {
  pages: KnowledgePagePayload[];
  nextCursor?: string;
}

export interface KnowledgeExplorerActivity {
  events: KnowledgePageActivityPayload[];
}

export interface KnowledgeExplorerQueryState<T> {
  data?: T;
  isPending: boolean;
  isError: boolean;
  error: Error | null;
}

/** One request for a tree level: `parentId: null` for the root scopes. */
export interface KnowledgeExplorerTreeRequest {
  parentId: string | null;
  cursor?: string;
}

/**
 * Host data hooks. Each host binds them to its own routes (Studio to the Mastra client, Factory to its
 * project-scoped routes), so the explorer never knows a URL or an id outside the page ids it shows.
 * Pass the same functions every render: they are called as hooks.
 */
export interface KnowledgeExplorerSource {
  /** One page; `noteCursor` fetches a later page of its notes. Disabled when `pageId` is null. */
  usePage: (pageId: string | null, noteCursor?: string) => KnowledgeExplorerQueryState<KnowledgeExplorerPageDetail>;
  useSearch: (query: string) => { data?: { results: Array<{ page: KnowledgePagePayload }> } };
  /** Tree levels, one result per request in order (e.g. `useQueries`). Enables the lazily loaded tree and child pages. */
  useTreeLevels?: (
    requests: KnowledgeExplorerTreeRequest[],
  ) => Array<KnowledgeExplorerQueryState<KnowledgeExplorerTreeLevel>>;
  /** A page's recent activity, newest first. */
  useActivity?: (pageId: string) => KnowledgeExplorerQueryState<KnowledgeExplorerActivity>;
}

export interface KnowledgePageExplorerProps {
  graph: KnowledgeExplorerGraph;
  source: KnowledgeExplorerSource;
  selectedPageId: string | null;
  /** `null` clears the selection: a click on empty graph canvas. */
  onSelect: (pageId: string | null) => void;
  view: KnowledgeExplorerView;
  onViewChange: (view: KnowledgeExplorerView) => void;
}

const MIN_SEARCH_LENGTH = 2;
/** Links of the selected page drawn at most in each direction; the rest are counted. */
export const FOCUS_LINK_CAP = 20;

function edgeKey(edge: KnowledgePageEdge) {
  return `${edge.kind}\u0000${edge.source}\u0000${edge.target}`;
}

/**
 * The links to draw, and per page how many of its links (into it, out of it) go undrawn. With all links
 * on, every link between drawn pages shows. Otherwise only the selected page's, up to
 * {@link FOCUS_LINK_CAP} each way; with nothing selected, none.
 */
function visibleLinks(
  known: KnowledgePageEdge[],
  drawn: ReadonlyMap<string, KnowledgePagePayload>,
  selectedId: string | null,
  all: boolean,
): { edges: KnowledgePageEdge[]; hidden: Map<string, { in: number; out: number }>; more: { in: number; out: number } } {
  const unique = new Map<string, KnowledgePageEdge>();
  for (const edge of known)
    if (edge.source !== edge.target && !unique.has(edgeKey(edge))) unique.set(edgeKey(edge), edge);
  // One link per pair and direction for counting, whether a note or a body makes it.
  const pairs = new Map<string, KnowledgePageEdge>();
  for (const edge of unique.values()) pairs.set(`${edge.source}\u0000${edge.target}`, edge);
  const shown = new Set<string>();
  const more = { in: 0, out: 0 };
  if (all) {
    for (const [key, edge] of unique) if (drawn.has(edge.source) && drawn.has(edge.target)) shown.add(key);
  } else if (selectedId) {
    let ins = 0;
    let outs = 0;
    for (const [key, edge] of unique) {
      if (!drawn.has(edge.source) || !drawn.has(edge.target)) continue;
      const side = edge.source === selectedId ? 'out' : edge.target === selectedId ? 'in' : null;
      if (!side) continue;
      const count = side === 'out' ? outs : ins;
      if (count >= FOCUS_LINK_CAP) {
        more[side]++;
        continue;
      }
      shown.add(key);
      if (side === 'out') outs++;
      else ins++;
    }
  }
  const drawnPairs = new Set(
    [...shown].map(key => {
      const edge = unique.get(key) as KnowledgePageEdge;
      return `${edge.source}\u0000${edge.target}`;
    }),
  );
  const hidden = new Map<string, { in: number; out: number }>();
  const bump = (id: string, side: 'in' | 'out') => {
    if (!drawn.has(id)) return;
    const counts = hidden.get(id) ?? { in: 0, out: 0 };
    counts[side]++;
    hidden.set(id, counts);
  };
  for (const [pair, edge] of pairs) {
    if (drawnPairs.has(pair)) continue;
    bump(edge.source, 'out');
    bump(edge.target, 'in');
  }
  return { edges: [...unique.values()].filter(edge => shown.has(edgeKey(edge))), hidden, more };
}
const noTreeLevels = () => [];
const noActivity = (): KnowledgeExplorerQueryState<KnowledgeExplorerActivity> => ({
  isPending: false,
  isError: false,
  error: null,
});

function isNotFound(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'status' in error && error.status === 404;
}

function withPages(
  base: ReadonlyMap<string, KnowledgePagePayload>,
  pages: KnowledgePagePayload[],
): ReadonlyMap<string, KnowledgePagePayload> {
  if (pages.length === 0) return base;
  const merged = new Map(base);
  for (const page of pages) merged.set(page.id, page);
  return merged;
}

/** `pages` narrowed to `scopeId` and everything below it, following parent links among the given pages. */
function withinScope(pages: KnowledgePagePayload[], scopeId: string | null): KnowledgePagePayload[] {
  if (!scopeId) return pages;
  const byId = new Map(pages.map(page => [page.id, page]));
  const inside = new Map<string, boolean>([[scopeId, true]]);
  const isInside = (page: KnowledgePagePayload): boolean => {
    const known = inside.get(page.id);
    if (known !== undefined) return known;
    const parent = page.parentId ? byId.get(page.parentId) : undefined;
    inside.set(page.id, false);
    const result = !!parent && parent.id !== page.id && isInside(parent);
    inside.set(page.id, result);
    return result;
  };
  return pages.filter(isInside);
}

function MoreButton({ onClick, label = 'Load more' }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      className="self-start text-caption text-muted-foreground hover:text-foreground"
      onClick={onClick}
    >
      {label}
    </button>
  );
}

/** The next page of a page's notes, then a button for the one after. */
function MoreNotes({
  source,
  pageId,
  cursor,
  pagesById,
  onPageClick,
}: {
  source: KnowledgeExplorerSource;
  pageId: string;
  cursor: string;
  pagesById: ReadonlyMap<string, KnowledgePagePayload>;
  onPageClick: (page: KnowledgePagePayload) => void;
}) {
  const chunk = source.usePage(pageId, cursor);
  const [showNext, setShowNext] = useState(false);
  const known = useMemo(() => withPages(pagesById, chunk.data?.related ?? []), [chunk.data, pagesById]);
  if (chunk.isPending) return <p className="text-caption text-muted-foreground">Loading notes…</p>;
  if (!chunk.data) return null;
  const next = chunk.data.notesNextCursor;
  return (
    <>
      <ul className="flex flex-col gap-3">
        {chunk.data.notes.map(note => (
          <KnowledgeNoteItem key={note.id} note={note} pagesById={known} onPageClick={onPageClick} />
        ))}
      </ul>
      {next ? (
        showNext ? (
          <MoreNotes source={source} pageId={pageId} cursor={next} pagesById={pagesById} onPageClick={onPageClick} />
        ) : (
          <MoreButton label="Load more notes" onClick={() => setShowNext(true)} />
        )
      ) : null}
    </>
  );
}

/** A page's children, a page at a time. */
function ChildPages({
  useTreeLevels,
  parentId,
  onPageClick,
}: {
  useTreeLevels: NonNullable<KnowledgeExplorerSource['useTreeLevels']>;
  parentId: string;
  onPageClick: (page: KnowledgePagePayload) => void;
}) {
  const [cursors, setCursors] = useState<string[]>([]);
  const requests = useMemo(() => [{ parentId }, ...cursors.map(cursor => ({ parentId, cursor }))], [parentId, cursors]);
  const levels = useTreeLevels(requests);
  const pages = levels.flatMap(level => level.data?.pages ?? []);
  const last = levels[levels.length - 1];
  if (levels[0]?.isPending) return <p className="text-caption text-muted-foreground">Loading pages…</p>;
  if (pages.length === 0) {
    return (
      <p className="text-body text-muted-foreground" data-testid="knowledge-no-child-pages">
        No pages under this one.
      </p>
    );
  }
  const next = last?.data?.nextCursor;
  return (
    <>
      <ul className="flex flex-col gap-1">
        {pages.map(child => (
          <li key={child.id} className="flex flex-col">
            <button
              type="button"
              className="text-left text-body font-medium text-info-indicator hover:underline"
              onClick={() => onPageClick(child)}
            >
              {child.name}
            </button>
            {child.description ? (
              <span className="truncate text-caption text-muted-foreground">{child.description}</span>
            ) : null}
          </li>
        ))}
      </ul>
      {next ? <MoreButton onClick={() => setCursors(current => [...current, next])} /> : null}
    </>
  );
}

interface MentionSelection {
  source: KnowledgePagePayload;
  target: KnowledgePagePayload;
  point: { x: number; y: number };
  pane: { width: number; height: number };
}

/** What a clicked mention line stands for: the notes on one page that mention the other. */
function MentionPopup({
  source,
  mention,
  pagesById,
  onOpen,
  onClose,
}: {
  source: KnowledgeExplorerSource;
  mention: MentionSelection;
  pagesById: ReadonlyMap<string, KnowledgePagePayload>;
  onOpen: (pageId: string) => void;
  onClose: () => void;
}) {
  const detail = source.usePage(mention.source.id);
  const notes = (detail.data?.notes ?? []).filter(note => note.mentions.includes(mention.target.id));
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div
      role="dialog"
      aria-label={`${mention.source.name} mentions ${mention.target.name}`}
      data-testid="knowledge-mention-popup"
      className="absolute z-20 flex w-80 max-w-[calc(100%-1rem)] flex-col gap-2 overflow-hidden rounded-lg border border-border bg-card p-3 shadow-overlay"
      style={mentionPopupPlacement(mention)}
    >
      <div className="flex items-start gap-2">
        <Txt as="h3" variant="card-title" className="min-w-0 flex-1">
          <button type="button" className="hover:underline" onClick={() => onOpen(mention.source.id)}>
            {mention.source.name}
          </button>
          <Txt as="span" variant="card-title" tone="muted">
            {' '}
            mentions{' '}
          </Txt>
          <button type="button" className="hover:underline" onClick={() => onOpen(mention.target.id)}>
            {mention.target.name}
          </button>
        </Txt>
        <button
          type="button"
          aria-label="Close"
          className="rounded p-0.5 text-muted-foreground hover:bg-fill hover:text-foreground"
          onClick={onClose}
        >
          <X size={14} aria-hidden />
        </button>
      </div>
      <div className="min-h-0 overflow-y-auto">
        {detail.isPending ? (
          <Txt variant="caption" tone="muted">
            Loading notes…
          </Txt>
        ) : notes.length === 0 ? (
          <Txt variant="caption" tone="muted">
            The notes that make this mention aren't in the first page of notes. Open {mention.source.name} to read them
            all.
          </Txt>
        ) : (
          <ul className="flex flex-col gap-2">
            {notes.map(note => (
              <KnowledgeNoteItem
                key={note.id}
                note={note}
                pagesById={withPages(pagesById, detail.data?.related ?? [])}
                onPageClick={page => onOpen(page.id)}
                compact
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function SelectedPage({
  source,
  pageId,
  pagesById,
  onSelect,
  highlightMentionOf,
}: {
  source: KnowledgeExplorerSource;
  pageId: string;
  pagesById: ReadonlyMap<string, KnowledgePagePayload>;
  onSelect: (pageId: string) => void;
  highlightMentionOf?: string;
}) {
  const detail = source.usePage(pageId);
  const activity = (source.useActivity ?? noActivity)(pageId);
  const [moreNotes, setMoreNotes] = useState<{ pageId: string } | null>(null);
  const known = useMemo(
    () => (detail.data ? withPages(pagesById, [...detail.data.ancestors, ...detail.data.related]) : pagesById),
    [detail.data, pagesById],
  );

  if (detail.isPending) return <p className="text-ui-md p-4 text-muted-foreground">Loading page…</p>;
  if (detail.isError || !detail.data) {
    const notFound = isNotFound(detail.error);
    return (
      <EmptyState
        tone="error"
        variant="fill"
        titleSlot={notFound ? 'Page not found' : 'Failed to load the page'}
        descriptionSlot={notFound ? 'It may have been deleted or merged.' : (detail.error?.message ?? '')}
      />
    );
  }
  const onPageClick = (page: KnowledgePagePayload) => onSelect(page.id);
  const next = detail.data.notesNextCursor;
  return (
    <KnowledgePageDetail
      page={detail.data.page}
      notes={detail.data.notes}
      pin={detail.data.pin ?? undefined}
      pagesById={known}
      onPageClick={onPageClick}
      highlightMentionOf={highlightMentionOf}
      ancestors={detail.data.ancestors}
      mentionedBy={detail.data.mentionedBy}
      activity={activity.data?.events}
      childPages={
        source.useTreeLevels ? (
          <ChildPages key={pageId} useTreeLevels={source.useTreeLevels} parentId={pageId} onPageClick={onPageClick} />
        ) : undefined
      }
      notesMore={
        next ? (
          moreNotes?.pageId === pageId ? (
            <MoreNotes source={source} pageId={pageId} cursor={next} pagesById={known} onPageClick={onPageClick} />
          ) : (
            <MoreButton label="Load more notes" onClick={() => setMoreNotes({ pageId })} />
          )
        ) : undefined
      }
    />
  );
}

function SearchBox({ source, onSelect }: { source: KnowledgeExplorerSource; onSelect: (pageId: string) => void }) {
  const [query, setQuery] = useState('');
  const search = source.useSearch(query);
  const results = query.trim().length >= MIN_SEARCH_LENGTH ? (search.data?.results ?? []) : [];
  const seen = new Set<string>();
  const pages = results
    .map(hit => hit.page)
    .filter(page => (seen.has(page.id) ? false : (seen.add(page.id), true)))
    .slice(0, 10);
  return (
    <div className="relative min-w-60 flex-1">
      <input
        aria-label="Search knowledge"
        placeholder="Search pages and notes"
        className="text-ui-md h-8 w-full rounded border border-border bg-card px-2"
        value={query}
        onChange={event => setQuery(event.target.value)}
      />
      {pages.length > 0 ? (
        <ul
          role="listbox"
          aria-label="Search results"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded border border-border bg-card shadow-raised"
        >
          {pages.map(page => (
            <li key={page.id} role="option" aria-selected={false}>
              <button
                type="button"
                className="text-ui-md w-full px-2 py-1.5 text-left hover:bg-muted"
                onClick={() => {
                  onSelect(page.id);
                  setQuery('');
                }}
              >
                {page.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * The tree loaded a level at a time through `useTreeLevels`: the root scopes, then each level as it is
 * opened, plus the path to the selected page. Unloaded pages keep a chevron until opened.
 */
function useLazyTree(
  source: KnowledgeExplorerSource,
  graph: KnowledgeExplorerGraph,
  selected: KnowledgeExplorerPageDetail | undefined,
  // Pages focused in the graph: their first level of children loads too, so the graph can draw them.
  graphOpened: readonly string[],
) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const [more, setMore] = useState<ReadonlyMap<string, string[]>>(() => new Map());
  const requests = useMemo(() => {
    const list: KnowledgeExplorerTreeRequest[] = [{ parentId: null }];
    for (const id of expanded) {
      list.push({ parentId: id });
      for (const cursor of more.get(id) ?? []) list.push({ parentId: id, cursor });
    }
    for (const id of graphOpened) if (!expanded.has(id)) list.push({ parentId: id });
    return list;
  }, [expanded, more, graphOpened]);
  const levels = (source.useTreeLevels ?? noTreeLevels)(requests);

  const { pages, loaded, nextCursor } = useMemo(() => {
    const byId = new Map<string, KnowledgePagePayload>();
    const loadedIds = new Set<string>();
    const next = new Map<string, string>();
    levels.forEach((level, index) => {
      const request = requests[index];
      if (!request || !level.data) return;
      const key = request.parentId ?? KNOWLEDGE_TREE_ROOT;
      loadedIds.add(key);
      for (const page of level.data.pages) byId.set(page.id, page);
      if (level.data.nextCursor) next.set(key, level.data.nextCursor);
      else next.delete(key);
    });
    // The selected page and its path, so the tree can open down to a page outside the loaded levels.
    for (const page of [...(selected?.ancestors ?? []), ...(selected ? [selected.page] : [])]) {
      if (!byId.has(page.id)) byId.set(page.id, page);
    }
    return { pages: [...byId.values()], loaded: loadedIds, nextCursor: next };
  }, [levels, requests, selected]);

  // With the whole graph loaded, its structure is complete: only pages with children get a chevron.
  const graphParents = useMemo(
    () => (graph.truncated ? null : new Set(graph.pages.map(page => page.parentId).filter(id => id !== null))),
    [graph],
  );
  // A counted page has children exactly when its count says so; otherwise guess from the graph.
  const mayHaveChildren = useCallback(
    (page: KnowledgePagePayload) =>
      !loaded.has(page.id) &&
      (page.childCountCapped ||
        (page.childCount !== undefined ? page.childCount > 0 : graphParents ? graphParents.has(page.id) : true)),
    [loaded, graphParents],
  );
  const loadMore = useMemo(() => {
    const map = new Map<string, () => void>();
    for (const [parentId, cursor] of nextCursor) {
      map.set(parentId, () =>
        setMore(current => new Map(current).set(parentId, [...(current.get(parentId) ?? []), cursor])),
      );
    }
    return map;
  }, [nextCursor]);
  const onExpandedChange = useCallback((ids: ReadonlySet<string>) => setExpanded(new Set(ids)), []);

  return {
    pages,
    loaded,
    mayHaveChildren,
    loadMore,
    onExpandedChange,
    rootsPending: levels[0]?.isPending ?? false,
  };
}

/**
 * Search, the page tree, and either the page graph or the selected page, kept in sync on one selection.
 * Wide screens show the tree beside the graph or the page; below `lg` one toggle picks tree, graph or page.
 * A first click on a page in the graph selects it; clicking it again opens it as a page. A search result
 * opens it as a page straight away. Selecting in the tree keeps the current view, so the graph frames the
 * page instead.
 */
export function KnowledgePageExplorer({
  graph,
  source,
  selectedPageId,
  onSelect,
  view,
  onViewChange,
}: KnowledgePageExplorerProps) {
  const selected = source.usePage(selectedPageId);
  const lazyMode = !!source.useTreeLevels;
  // Parents whose next level the graph loads: the focus and its parent (or the root scopes), plus any
  // page whose stand-in dots the pointer rested on.
  const [graphOpened, setGraphOpened] = useState<readonly string[]>([]);
  const [previewed, setPreviewed] = useState<readonly string[]>([]);
  const [openGroups, setOpenGroups] = useState<ReadonlySet<string>>(() => new Set());
  const [allLinks, setAllLinks] = useState(false);
  const lazy = useLazyTree(source, graph, selected.data, graphOpened);
  // With tree levels the graph loads like the tree: the focus (or the root scopes) and what sits around
  // it, never the whole instance. Without them it draws the host's bounded graph as it is.
  const drawnGraph = useMemo(
    () =>
      lazyMode
        ? lazyGraph({
            // The host's bounded graph fills in pages a level's first chunk didn't reach; tree levels win.
            pages: [...new Map([...graph.pages, ...lazy.pages].map(page => [page.id, page])).values()],
            loadedParents: lazy.loaded,
            rootKey: KNOWLEDGE_TREE_ROOT,
            focusId: selectedPageId,
            openGroups,
          })
        : { pages: graph.pages, hiddenChildren: new Map<string, { hidden: number; drawn: number }>(), wanted: [] },
    [lazyMode, lazy.pages, lazy.loaded, selectedPageId, openGroups, graph.pages],
  );
  useEffect(() => {
    if (!lazyMode || view === 'page') return;
    const next = [...new Set([...drawnGraph.wanted, ...previewed])];
    setGraphOpened(current =>
      current.length === next.length && current.every((id, index) => id === next[index]) ? current : next,
    );
  }, [lazyMode, view, drawnGraph.wanted, previewed]);

  // The selected page's own links, from its notes' mentions, notes elsewhere that mention it, and
  // `[[links]]` in its body. Pages they reach that the graph doesn't hold join it, as dots.
  const focusLinks = useMemo(() => {
    const detail = selected.data;
    if (!detail || detail.page.id !== selectedPageId) return { edges: [], pages: [] };
    const known = new Map([...lazy.pages, ...detail.ancestors, ...detail.related].map(page => [page.id, page]));
    const index = knowledgePageRefIndex(known.values());
    const id = detail.page.id;
    const edges: KnowledgePageEdge[] = [
      ...detail.notes.flatMap(note => note.mentions.map(target => ({ source: id, target, kind: 'mention' as const }))),
      ...(detail.mentionedBy ?? []).map(note => ({ source: note.pageId, target: id, kind: 'mention' as const })),
      ...bodyLinkRefs(detail.page.body ?? '').flatMap(ref => {
        const target = index.resolve(ref);
        return target ? [{ source: id, target: target.id, kind: 'link' as const }] : [];
      }),
    ].filter(edge => edge.source !== edge.target);
    const ends = new Set(edges.flatMap(edge => [edge.source, edge.target]));
    return { edges, pages: [...ends].flatMap(end => known.get(end) ?? []) };
  }, [selected.data, selectedPageId, lazy.pages]);

  const drawn = useMemo(() => {
    const ids = new Set(drawnGraph.pages.map(page => page.id));
    const extra = focusLinks.pages.filter(page => !ids.has(page.id));
    return { ...drawnGraph, pages: extra.length ? [...drawnGraph.pages, ...extra] : drawnGraph.pages };
  }, [drawnGraph, focusLinks.pages]);
  const pagesById = useMemo(() => new Map(drawn.pages.map(page => [page.id, page])), [drawn.pages]);
  const previewParent = (parentId: string) =>
    // The last few only, so hovering around the graph never keeps an unbounded set of levels loading.
    setPreviewed(current => (current.includes(parentId) ? current : [...current, parentId].slice(-8)));
  // A scope picked in the tree narrows the tree and the graph to that scope and what sits under it.
  const [focusScopeId, setFocusScopeId] = useState<string | null>(null);
  // Every link the explorer knows of: mentions the host's graph found, `[[links]]` in loaded bodies,
  // and the selected page's own. Only the selected page's are drawn (capped) unless all links are on.
  const knownLinks = useMemo(
    () => [...graph.edges.filter(edge => edge.kind === 'mention'), ...bodyLinkEdges(drawn.pages), ...focusLinks.edges],
    [graph.edges, drawn.pages, focusLinks.edges],
  );
  const linkView = useMemo(
    () => visibleLinks(knownLinks, pagesById, selectedPageId, allLinks),
    [knownLinks, pagesById, selectedPageId, allLinks],
  );
  const linkEdges = linkView.edges;
  // A clicked mention line shows the notes that make the mention; opening the page from there marks them.
  const [mention, setMention] = useState<MentionSelection | null>(null);
  const [marked, setMarked] = useState<{ source: string; target: string } | null>(null);
  const closeMention = useCallback(() => setMention(null), []);
  // Below lg the graph shares its slot with the tree. Mount it only when it is showing: a graph mounted
  // into a hidden 0×0 pane has nothing to fit and was left unfitted when the toggle revealed it.
  const narrow = useIsMobile(1024);
  const graphShown = !narrow || view === 'graph';
  const highlightMentionOf = marked && marked.source === selectedPageId ? marked.target : undefined;
  const showPage = view === 'page' && !!selectedPageId;
  const openPage = (pageId: string) => {
    onSelect(pageId);
    onViewChange('page');
  };
  // From the tree: in the graph, a first click frames the page there and a second click on the same
  // page opens it, like clicking a node. Elsewhere it opens. A lazily loaded graph loads around whatever
  // is focused; a host's fixed graph that lacks the page has nothing to frame, so it opens as a page.
  const selectFromTree = (page: KnowledgePagePayload) => {
    if (page.isScope) setFocusScopeId(page.id);
    if (view === 'graph' && (lazyMode || pagesById.has(page.id)) && page.id !== selectedPageId) onSelect(page.id);
    else openPage(page.id);
  };
  // Pages reached from outside the tree (search, links, mentions) clear a focus they fall outside of.
  const openAnywhere = (pageId: string) => {
    if (focusScopeId && !withinScope([...lazy.pages, ...drawn.pages], focusScopeId).some(page => page.id === pageId)) {
      setFocusScopeId(null);
    }
    openPage(pageId);
  };
  const focusScope = focusScopeId
    ? (lazy.pages.find(page => page.id === focusScopeId) ?? pagesById.get(focusScopeId))
    : undefined;
  const treePages = withinScope(source.useTreeLevels ? lazy.pages : graph.pages, focusScope ? focusScopeId : null);
  const graphPages = useMemo(
    () => withinScope(drawn.pages, focusScope ? focusScopeId : null),
    [drawn.pages, focusScope, focusScopeId],
  );
  const focusedInGraph = view === 'graph' && selectedPageId ? pagesById.get(selectedPageId) : undefined;
  const children = focusedInGraph ? drawn.hiddenChildren.get(focusedInGraph.id) : undefined;
  const views: Array<{ value: KnowledgeExplorerView; label: string; narrowOnly?: boolean }> = [
    { value: 'tree', label: 'Tree', narrowOnly: true },
    { value: 'graph', label: 'Graph' },
    { value: 'page', label: 'Page' },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <SearchBox source={source} onSelect={openAnywhere} />
        {!showPage ? (
          <button
            type="button"
            aria-pressed={allLinks}
            data-testid="knowledge-graph-all-links"
            title="Draw every link between the pages in the graph, not only the selected page's"
            className="text-ui-md rounded border border-border px-3 py-1 aria-pressed:bg-muted"
            onClick={() => setAllLinks(current => !current)}
          >
            All links
          </button>
        ) : null}
        <div role="group" aria-label="View" className="flex rounded border border-border">
          {views.map(option => (
            <button
              key={option.value}
              type="button"
              aria-pressed={
                option.value === 'page'
                  ? showPage
                  : option.value === 'graph'
                    ? !showPage && view !== 'tree'
                    : view === 'tree'
              }
              disabled={option.value === 'page' && !selectedPageId}
              className={`text-ui-md px-3 py-1 disabled:opacity-50 aria-pressed:bg-muted ${option.narrowOnly ? 'lg:hidden' : ''}`}
              onClick={() => onViewChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      {!lazyMode && graph.truncated && !showPage ? (
        <p className="text-ui-sm text-muted-foreground">
          The graph shows the first {graph.pages.length} pages. Open the tree or search to reach the rest.
        </p>
      ) : null}
      {!showPage && (linkView.more.in > 0 || linkView.more.out > 0) ? (
        <p className="text-ui-sm text-muted-foreground" data-testid="knowledge-graph-more-links">
          +{linkView.more.in + linkView.more.out} more links of this page not drawn ({linkView.more.in} in,{' '}
          {linkView.more.out} out).
        </p>
      ) : null}
      {focusedInGraph && children && (children.hidden > 0 || focusedInGraph.childCountCapped) ? (
        <p className="text-ui-sm text-muted-foreground" data-testid="knowledge-graph-more-children">
          {focusedInGraph.childCountCapped
            ? `${childCountLabel(focusedInGraph)} pages under ${focusedInGraph.name}, ${children.drawn} drawn.`
            : `+${children.hidden} more ${children.hidden === 1 ? 'page' : 'pages'} under ${focusedInGraph.name} not drawn.`}{' '}
          Open the tree to see them all.
        </p>
      ) : null}
      {selectedPageId && !showPage && isNotFound(selected.error) ? (
        <p role="alert" className="text-ui-sm text-destructive-foreground">
          Page not found. The linked page may have been deleted or merged.
        </p>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        <aside
          className={`min-h-0 w-full flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card lg:flex lg:w-72 lg:flex-none lg:shrink-0 ${view === 'tree' ? 'flex' : 'hidden'}`}
        >
          {focusScope ? (
            <div
              className="flex items-center gap-2 border-b border-border bg-fill-subtle px-3 py-2"
              data-testid="knowledge-scope-focus"
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <Txt as="span" variant="eyebrow" tone="muted" className="uppercase">
                  {focusScope.displayLabel ?? 'Scope'}
                </Txt>
                <Txt as="span" variant="label" tone="ink" className="truncate">
                  {focusScope.address ?? focusScope.name}
                </Txt>
              </div>
              <button
                type="button"
                className="text-ui-sm shrink-0 rounded px-2 py-1 text-muted-foreground hover:bg-fill hover:text-foreground"
                onClick={() => setFocusScopeId(null)}
              >
                All scopes
              </button>
            </div>
          ) : null}
          <div className="min-h-0 flex-1 overflow-auto">
            {source.useTreeLevels && lazy.rootsPending ? (
              <p className="px-3 py-2 text-body text-muted-foreground">Loading pages…</p>
            ) : (
              <KnowledgePageTree
                key={focusScope ? focusScope.id : 'all'}
                pages={treePages}
                pinnedIds={graph.pinnedIds}
                selectedPageId={selectedPageId}
                onSelect={selectFromTree}
                initiallyExpanded={focusScope ? [focusScope.id] : undefined}
                {...(source.useTreeLevels
                  ? {
                      mayHaveChildren: lazy.mayHaveChildren,
                      onExpandedChange: lazy.onExpandedChange,
                      loadMore: lazy.loadMore,
                    }
                  : {})}
              />
            )}
          </div>
        </aside>
        {showPage ? (
          <section
            aria-label="Selected page"
            className="min-h-0 min-w-0 flex-1 overflow-auto rounded-lg border border-border bg-card"
          >
            <SelectedPage
              source={source}
              pageId={selectedPageId}
              pagesById={pagesById}
              onSelect={openAnywhere}
              highlightMentionOf={highlightMentionOf}
            />
          </section>
        ) : (
          <div
            className={`relative min-h-0 min-w-0 flex-1 overflow-hidden rounded-lg border border-border bg-background lg:block lg:h-full ${view === 'graph' ? 'block' : 'hidden'}`}
            data-testid="knowledge-graph-container"
          >
            {graphShown ? (
              <KnowledgePageGraph
                pages={graphPages}
                edges={linkEdges}
                pinnedIds={graph.pinnedIds}
                grants={graph.grants}
                selectedPageId={selectedPageId}
                hiddenLinks={linkView.hidden}
                onPreview={page => {
                  if (isChildPlaceholder(page) && page.parentId) previewParent(page.parentId);
                }}
                onSelect={page => {
                  // A stand-in loads its parent's children; a scope group opens into its scopes.
                  if (isChildPlaceholder(page)) return page.parentId ? previewParent(page.parentId) : undefined;
                  if (isScopeGroup(page)) return setOpenGroups(current => new Set(current).add(page.id));
                  onSelect(page.id);
                  // Hosts resolve a `?page=` with no view to the page view, so say graph outright.
                  if (view !== 'graph') onViewChange('graph');
                }}
                onOpen={page => openPage(page.id)}
                onClearSelection={() => {
                  setMention(null);
                  if (selectedPageId) onSelect(null);
                }}
                onMentionSelect={setMention}
              />
            ) : null}
            {mention && graphShown ? (
              <MentionPopup
                source={source}
                mention={mention}
                pagesById={pagesById}
                onClose={closeMention}
                onOpen={pageId => {
                  setMarked(
                    pageId === mention.source.id ? { source: mention.source.id, target: mention.target.id } : null,
                  );
                  setMention(null);
                  openAnywhere(pageId);
                }}
              />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
