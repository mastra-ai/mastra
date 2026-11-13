import { Network } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { flushSync } from 'react-dom';

import { REST_BATCH, isChildPlaceholder, isRestCircle, isScopeGroup, lazyGraph } from '../lib/graphShape';
import { scopeTitle } from '../lib/pageAddress';
import { bodyLinkEdges, bodyLinkRefs, knowledgePageRefIndex } from '../lib/pageRefs';
import { KnowledgePagesByRef } from '../lib/pagesByRefContext';
import { childCountLabel } from '../lib/pageTree';
import { mentionPopupPlacement } from '../lib/popupPlacement';
import { useStableWhile } from '../lib/useStableWhile';

import type {
  KnowledgePageActivityPayload,
  KnowledgeNotePayload,
  KnowledgePageEdge,
  KnowledgePagePayload,
  KnowledgePinPayload,
  KnowledgeScopeGrantPayload,
} from '../pageTypes';
import { KnowledgeDetailSection, KnowledgeNoteItem, KnowledgePageDetail } from './KnowledgePageDetail';
import { KnowledgePageGraph } from './KnowledgePageGraph';
import { KNOWLEDGE_TREE_ROOT, KnowledgePageTree } from './KnowledgePageTree';
import { KnowledgeSourceIcon } from './KnowledgeSourceIcon';
import { KnowledgeTooltip } from './KnowledgeTooltip';

import { ActionRow } from '@/ds/components/ActionRow';
import { Button } from '@/ds/components/Button';
import { ButtonsGroup } from '@/ds/components/ButtonsGroup';
import { DataPanel } from '@/ds/components/DataPanel';
import { EmptyState } from '@/ds/components/EmptyState';
import { ScrollArea } from '@/ds/components/ScrollArea';
import { SearchInput } from '@/ds/components/SearchInput';
import { Skeleton, SkeletonText } from '@/ds/components/Skeleton';
import { Tab, TabList, Tabs } from '@/ds/components/Tabs';
import { Tree } from '@/ds/components/Tree';
import { Txt } from '@/ds/components/Txt';
import { IconArrowLeft } from '@/ds/icons/central/IconArrowLeft';
import { IconArrowRight } from '@/ds/icons/central/IconArrowRight';
import { IconChainLink1 } from '@/ds/icons/central/IconChainLink1';
import { IconCodeTree } from '@/ds/icons/central/IconCodeTree';
import { IconCrossMedium } from '@/ds/icons/central/IconCrossMedium';
import { IconFileText } from '@/ds/icons/central/IconFileText';
import { IconFolder1 } from '@/ds/icons/central/IconFolder1';
import { IconHashtag } from '@/ds/icons/central/IconHashtag';
import { IconSidebarLeftArrow } from '@/ds/icons/central/IconSidebarLeftArrow';
import { IconSidebarWideLeftArrow } from '@/ds/icons/central/IconSidebarWideLeftArrow';
import { IconSquareArrowTopRight } from '@/ds/icons/central/IconSquareArrowTopRight';
import { Icon } from '@/ds/icons/Icon';
import { menuItemButtonClass } from '@/ds/primitives/menu-item';
import { frameSurfaceStyle, overlaySurfaceStyle, raisedSurfaceStyle } from '@/ds/primitives/raised-surface';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { cn } from '@/lib/utils';

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

export interface KnowledgeExplorerPageLinks {
  edges: Array<{ fromPageId: string; toPageId: string; kind: 'body' | 'note'; count: number }>;
  pages: KnowledgePagePayload[];
  truncated: boolean;
}

/** One request for a tree level: `parentId: null` for the root scopes. */
export interface KnowledgeExplorerTreeRequest {
  parentId: string | null;
  cursor?: string;
}

/** Page ids are ULIDs; a bare `[[id]]` is askable, a bare `[[Name]]` is not. */
const PAGE_ID_SHAPE = /^[0-9A-Z]{26}$/;
const JUST_CREATED_MS = 60_000;
const isJustCreated = (page: KnowledgePagePayload) => Date.now() - Date.parse(page.createdAt) < JUST_CREATED_MS;

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
  /**
   * Pages a link reaches, by id or `[[ref]]` (`scope#path`), one result per entry in order (e.g.
   * `useQueries`). Lets the focused page draw links to pages the graph hasn't loaded; without it only
   * links to loaded pages are drawn. A key the host can't resolve should come back as an error.
   */
  useLinkedPages?: (keys: string[]) => Array<KnowledgeExplorerQueryState<KnowledgeExplorerPageDetail>>;
  /**
   * Exact links into and out of each page (by `[[ref]]` or note mention), counted over the whole store, for
   * the pages the graph draws. Without it, or when it errors (a server with no link index answers 501), the
   * graph counts only the links between pages it has loaded.
   */
  useLinkCounts?: (pageIds: string[]) => KnowledgeExplorerQueryState<Record<string, { in: number; out: number }>>;
  /** One page's links with the pages at their other ends; fetched for the page under the pointer. Null disables it. */
  usePageLinks?: (pageId: string | null) => KnowledgeExplorerQueryState<KnowledgeExplorerPageLinks>;
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
  toolbarEnd?: ReactNode;
  flush?: boolean;
}

const MIN_SEARCH_LENGTH = 2;
/** Links of the selected page drawn at most in each direction; the rest are counted. */
export const FOCUS_LINK_CAP = 20;
/** Keys fetched per direction: a page reached by a note and by the body is two keys but one link, so this is twice the cap. */
const FOCUS_LINK_FETCH_CAP = FOCUS_LINK_CAP * 2;

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
    // The cap counts pages linked, not lines: a page reached by a note and by the body is one link.
    const admitted = new Set<string>();
    const over = new Set<string>();
    let ins = 0;
    let outs = 0;
    for (const [key, edge] of unique) {
      if (!drawn.has(edge.source) || !drawn.has(edge.target)) continue;
      const side = edge.source === selectedId ? 'out' : edge.target === selectedId ? 'in' : null;
      if (!side) continue;
      const pair = `${edge.source}\u0000${edge.target}`;
      if (!admitted.has(pair) && !over.has(pair)) {
        if ((side === 'out' ? outs : ins) >= FOCUS_LINK_CAP) {
          over.add(pair);
          more[side]++;
        } else {
          admitted.add(pair);
          if (side === 'out') outs++;
          else ins++;
        }
      }
      if (admitted.has(pair)) shown.add(key);
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
/** The round buttons floating over the graph: muted when off or idle, a solid fill when pressed. */
/** How many earlier focuses Back remembers. */
const FOCUS_HISTORY_CAP = 50;
function explorerTab(view: KnowledgeExplorerView, showPage: boolean): KnowledgeExplorerView {
  if (showPage) return 'page';
  if (view === 'tree') return 'tree';
  return 'graph';
}

const TREE_DRAWER_INSET = 296;
const TREE_TOGGLE_INSET = 44;

function treeInset(overlay: boolean, treeOpen: boolean): number {
  if (!overlay) return 0;
  return treeOpen ? TREE_DRAWER_INSET : TREE_TOGGLE_INSET;
}
const PAGE_DRAWER_INSET = 392;
type InsetStyle = CSSProperties & {
  '--knowledge-tree-inset': string;
  '--knowledge-tree-drawer-inset': string;
  '--knowledge-drawer-inset': string;
};
const noTreeLevels = () => [];
const noKeys: string[] = [];
const noLinkedPages = (): Array<KnowledgeExplorerQueryState<KnowledgeExplorerPageDetail>> => [];
const noLinkQuery = <T,>(): KnowledgeExplorerQueryState<T> => ({ isPending: false, isError: false, error: null });
/** Longest a pointer rests on a page before its links are fetched, so sweeping across the graph fetches none. */
const HOVER_FETCH_DELAY_MS = 150;

/** Per page, the links into and out of it that none of `shown` draws, given the exact totals. */
function undrawnLinks(
  exact: ReadonlyMap<string, { in: number; out: number }>,
  shown: readonly KnowledgePageEdge[],
): Map<string, { in: number; out: number }> {
  const drawn = new Map<string, { in: number; out: number }>();
  const pairs = new Set<string>();
  for (const edge of shown) {
    if (edge.kind === 'parent' || pairs.has(`${edge.source}\u0000${edge.target}`)) continue;
    pairs.add(`${edge.source}\u0000${edge.target}`);
    const out = drawn.get(edge.source) ?? { in: 0, out: 0 };
    out.out++;
    drawn.set(edge.source, out);
    const into = drawn.get(edge.target) ?? { in: 0, out: 0 };
    into.in++;
    drawn.set(edge.target, into);
  }
  const hidden = new Map<string, { in: number; out: number }>();
  for (const [id, total] of exact) {
    const seen = drawn.get(id) ?? { in: 0, out: 0 };
    hidden.set(id, { in: Math.max(0, total.in - seen.in), out: Math.max(0, total.out - seen.out) });
  }
  return hidden;
}
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

const SKELETON_ROW_WIDTHS = ['w-32', 'w-24', 'w-40', 'w-28', 'w-36', 'w-20'];

function TreeRowsSkeleton({ label, rows }: { label: string; rows: number }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col">
      {SKELETON_ROW_WIDTHS.slice(0, rows).map((width, index) => (
        <div
          key={width}
          className="flex h-8 items-center gap-2 px-1"
          style={{ paddingLeft: `${(index % 3) * 12 + 4}px` }}
        >
          <Skeleton className="size-3.5 shrink-0" />
          <SkeletonText className={width} />
        </div>
      ))}
    </div>
  );
}

function NotesSkeleton() {
  return (
    <div role="status" aria-label="Loading notes" className="flex flex-col gap-2">
      {[0, 1].map(index => (
        <div key={index} className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <SkeletonText className="w-24" />
          <SkeletonText className="w-full" />
          <SkeletonText className="w-2/3" />
        </div>
      ))}
    </div>
  );
}

function PageSkeleton({ compact }: { compact?: boolean }) {
  return (
    <div role="status" aria-label="Loading page" className="flex flex-col">
      <div
        className={`flex flex-col gap-2 border-b border-border ${compact ? 'px-4 pt-3 pb-4' : 'bg-fill-subtle px-6 pt-5 pb-4'}`}
      >
        <SkeletonText line="text-caption" className="w-28" />
        {compact ? null : <SkeletonText line="text-title" className="h-5 w-56" />}
        <SkeletonText className="w-72 max-w-full" />
        <SkeletonText line="text-caption" className="w-40" />
      </div>
      <div className={`flex flex-col gap-3 ${compact ? 'p-4' : 'p-6'}`}>
        <SkeletonText className="w-full max-w-3xl" />
        <SkeletonText className="w-5/6 max-w-2xl" />
        <SkeletonText className="w-2/3 max-w-xl" />
      </div>
    </div>
  );
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
  if (chunk.isPending) return <NotesSkeleton />;
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
  onOpen,
}: {
  useTreeLevels: NonNullable<KnowledgeExplorerSource['useTreeLevels']>;
  parentId: string;
  onOpen: (pageId: string) => void;
}) {
  const [cursors, setCursors] = useState<string[]>([]);
  const requests = useMemo(() => [{ parentId }, ...cursors.map(cursor => ({ parentId, cursor }))], [parentId, cursors]);
  const levels = useTreeLevels(requests);
  const pages = levels.flatMap(level => level.data?.pages ?? []);
  const last = levels[levels.length - 1];
  if (levels[0]?.isPending) {
    return (
      <KnowledgeDetailSection label="Pages">
        <TreeRowsSkeleton label="Loading pages" rows={3} />
      </KnowledgeDetailSection>
    );
  }
  const next = last?.data?.nextCursor;
  if (pages.length === 0 && !next) return null;
  return (
    <KnowledgeDetailSection label="Pages">
      <div className={`rounded-xl p-1 ${raisedSurfaceStyle}`}>
        <Tree className="rounded-lg bg-background p-1" onSelect={onOpen}>
          <ChildPageItems pages={pages} useTreeLevels={useTreeLevels} onOpen={onOpen} />
        </Tree>
      </div>
      {next ? <MoreButton onClick={() => setCursors(current => [...current, next])} /> : null}
    </KnowledgeDetailSection>
  );
}

function ChildPageItems({
  pages,
  useTreeLevels,
  onOpen,
}: {
  pages: KnowledgePagePayload[];
  useTreeLevels: NonNullable<KnowledgeExplorerSource['useTreeLevels']>;
  onOpen: (pageId: string) => void;
}) {
  return pages.map(child =>
    child.childCount !== 0 ? (
      <ChildPageFolder key={child.id} page={child} useTreeLevels={useTreeLevels} onOpen={onOpen} />
    ) : (
      <Tree.File key={child.id} id={child.id}>
        <Tree.Icon className="text-muted-foreground">
          <IconFileText />
        </Tree.Icon>
        <ChildPageLabel page={child} />
      </Tree.File>
    ),
  );
}

function ChildPageLabel({ page }: { page: KnowledgePagePayload }) {
  if (!page.description) return <Tree.Label>{page.name}</Tree.Label>;
  return (
    <KnowledgeTooltip label={page.description}>
      <Tree.Label>{page.name}</Tree.Label>
    </KnowledgeTooltip>
  );
}

function ChildPageFolder({
  page,
  useTreeLevels,
  onOpen,
}: {
  page: KnowledgePagePayload;
  useTreeLevels: NonNullable<KnowledgeExplorerSource['useTreeLevels']>;
  onOpen: (pageId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Tree.Folder id={page.id} open={open} onOpenChange={setOpen}>
      <Tree.FolderTrigger
        actions={
          <Button
            variant="ghost"
            size="icon-sm"
            tooltip={`Open ${page.name}`}
            aria-label={`Open ${page.name}`}
            onClick={() => onOpen(page.id)}
          >
            <IconArrowRight />
          </Button>
        }
      >
        <Tree.Icon className="text-muted-foreground">
          <IconFolder1 />
        </Tree.Icon>
        <ChildPageLabel page={page} />
        {page.childCount ? (
          <Txt as="span" variant="caption" tone="muted" className="ml-auto pl-2 tabular-nums">
            {page.childCount}
          </Txt>
        ) : null}
      </Tree.FolderTrigger>
      <Tree.FolderContent>
        {open ? <ChildPageLevel parentId={page.id} useTreeLevels={useTreeLevels} onOpen={onOpen} /> : null}
      </Tree.FolderContent>
    </Tree.Folder>
  );
}

function ChildPageLevel({
  parentId,
  useTreeLevels,
  onOpen,
}: {
  parentId: string;
  useTreeLevels: NonNullable<KnowledgeExplorerSource['useTreeLevels']>;
  onOpen: (pageId: string) => void;
}) {
  const [cursors, setCursors] = useState<string[]>([]);
  const levels = useTreeLevels([{ parentId }, ...cursors.map(cursor => ({ parentId, cursor }))]);
  const pages = levels.flatMap(level => level.data?.pages ?? []);
  const next = levels[levels.length - 1]?.data?.nextCursor;
  if (levels[0]?.isPending) {
    return (
      <li role="none" className="pl-6">
        <TreeRowsSkeleton label="Loading pages" rows={2} />
      </li>
    );
  }
  if (levels[0]?.isError) return <ChildPageLevelNote>Couldn’t load the pages under this one.</ChildPageLevelNote>;
  if (pages.length === 0 && !next) return <ChildPageLevelNote>No pages under this one.</ChildPageLevelNote>;
  return (
    <>
      <ChildPageItems pages={pages} useTreeLevels={useTreeLevels} onOpen={onOpen} />
      {next ? (
        <li role="none" className="pl-9">
          <MoreButton onClick={() => setCursors(current => [...current, next])} />
        </li>
      ) : null}
    </>
  );
}

function ChildPageLevelNote({ children }: { children: ReactNode }) {
  return (
    <li role="none" className="flex h-8 items-center pl-9 text-caption text-muted-foreground">
      {children}
    </li>
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
          <IconCrossMedium size={14} aria-hidden />
        </button>
      </div>
      <div className="min-h-0 overflow-y-auto">
        {detail.isPending ? (
          <NotesSkeleton />
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
                pagesById={withPages(
                  pagesById,
                  detail.data ? [...detail.data.related, ...detail.data.ancestors, detail.data.page] : [],
                )}
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
  compact,
}: {
  source: KnowledgeExplorerSource;
  pageId: string;
  pagesById: ReadonlyMap<string, KnowledgePagePayload>;
  onSelect: (pageId: string) => void;
  highlightMentionOf?: string;
  compact?: boolean;
}) {
  const detail = source.usePage(pageId);
  const activity = (source.useActivity ?? noActivity)(pageId);
  const [moreNotes, setMoreNotes] = useState<{ pageId: string } | null>(null);
  const known = useMemo(
    () => (detail.data ? withPages(pagesById, [...detail.data.ancestors, ...detail.data.related]) : pagesById),
    [detail.data, pagesById],
  );

  if (detail.isPending) return <PageSkeleton compact={compact} />;
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
      compact={compact}
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
          <ChildPages key={pageId} useTreeLevels={source.useTreeLevels} parentId={pageId} onOpen={onSelect} />
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
    <div className="relative w-64 min-w-0">
      <SearchInput
        label="Search knowledge"
        placeholder="Search pages and notes"
        size="sm"
        value={query}
        onValueChange={setQuery}
      />
      {pages.length > 0 ? (
        <div className={`absolute z-20 mt-1 w-full overflow-hidden rounded-xl ${overlaySurfaceStyle}`}>
          <ScrollArea maxHeight="18rem">
            <ul role="listbox" aria-label="Search results" className="p-1">
              {pages.map(page => (
                <li key={page.id} role="option" aria-selected={false}>
                  <button
                    type="button"
                    className={cn(menuItemButtonClass, 'whitespace-normal')}
                    onClick={() => {
                      onSelect(page.id);
                      setQuery('');
                    }}
                  >
                    <div className="line-clamp-2">{page.name}</div>
                  </button>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </div>
      ) : null}
    </div>
  );
}

type LevelResult = {
  pages: KnowledgePagePayload[];
  loaded: ReadonlySet<string>;
  failed: ReadonlySet<string>;
  nextCursor: ReadonlyMap<string, string>;
};

// Compares pages by identity, so a host must not mutate a page payload in place: a new page is a new object.
function sameLevels(a: LevelResult, b: LevelResult) {
  const sameSet = (x: ReadonlySet<string>, y: ReadonlySet<string>) =>
    x.size === y.size && [...x].every(id => y.has(id));
  return (
    a.pages.length === b.pages.length &&
    a.pages.every((page, index) => page === b.pages[index]) &&
    sameSet(a.loaded, b.loaded) &&
    sameSet(a.failed, b.failed) &&
    a.nextCursor.size === b.nextCursor.size &&
    [...a.nextCursor].every(([id, cursor]) => b.nextCursor.get(id) === cursor)
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

  const built = useMemo(() => {
    const failedIds = new Set<string>();
    const byId = new Map<string, KnowledgePagePayload>();
    const loadedIds = new Set<string>();
    const next = new Map<string, string>();
    levels.forEach((level, index) => {
      const request = requests[index];
      if (!request) return;
      const key = request.parentId ?? KNOWLEDGE_TREE_ROOT;
      if (level.isError) failedIds.add(key);
      if (!level.data) return;
      loadedIds.add(key);
      for (const page of level.data.pages) byId.set(page.id, page);
      if (level.data.nextCursor) next.set(key, level.data.nextCursor);
      else next.delete(key);
    });
    // The selected page and its path, so the tree can open down to a page outside the loaded levels.
    for (const page of [...(selected?.ancestors ?? []), ...(selected ? [selected.page] : [])]) {
      if (!byId.has(page.id)) byId.set(page.id, page);
    }
    return { pages: [...byId.values()], loaded: loadedIds, failed: failedIds, nextCursor: next };
  }, [levels, requests, selected]);
  // `levels` is a new array every render, so what is built from it is too: keep the previous result while
  // its pages are the same objects, or every render (a hover's, say) would lay the whole graph out again.
  const { pages, loaded, failed, nextCursor } = useStableWhile(built, sameLevels);

  // With the whole graph loaded, its structure is complete: only pages with children get a chevron.
  const graphParents = useMemo(
    () => (graph.truncated ? null : new Set(graph.pages.map(page => page.parentId).filter(id => id !== null))),
    [graph],
  );
  // A counted page has children exactly when its count says so. An uncounted one is guessed from the graph,
  // except a page created a moment ago, which has no children yet and shows no arrow while its level is counted.
  const mayHaveChildren = useCallback(
    (page: KnowledgePagePayload) =>
      !loaded.has(page.id) &&
      (page.childCountCapped ||
        (page.childCount !== undefined
          ? page.childCount > 0
          : !isJustCreated(page) && (graphParents ? graphParents.has(page.id) : true))),
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
    failed,
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
  view: requestedView,
  onViewChange,
  toolbarEnd,
  flush = false,
}: KnowledgePageExplorerProps) {
  const narrow = useIsMobile(1024);
  const view = !narrow && requestedView === 'tree' ? 'graph' : requestedView;
  const selected = source.usePage(selectedPageId);
  const lazyMode = !!source.useTreeLevels;
  // Parents whose next level the graph loads: the focus and its parent (or the root scopes), plus any
  // page whose stand-in dots the pointer rested on.
  const [graphOpened, setGraphOpened] = useState<readonly string[]>([]);
  const [previewed, setPreviewed] = useState<readonly string[]>([]);
  const [openGroups, setOpenGroups] = useState<ReadonlySet<string>>(() => new Set());
  // Children drawn past the cap, per parent, as its "+N more" circle is clicked.
  const [revealed, setRevealed] = useState<ReadonlyMap<string, number>>(() => new Map());
  const [allLinks, setAllLinks] = useState(false);
  const [dotCounts, setDotCounts] = useState(true);
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
            revealed,
          })
        : {
            pages: graph.pages,
            hiddenChildren: new Map<string, { hidden: number; drawn: number }>(),
            wanted: [],
            hub: null,
          },
    [lazyMode, lazy.pages, lazy.loaded, selectedPageId, openGroups, revealed, graph.pages],
  );
  // The pages the focus needs are in (or failed to load): only then does the graph move to the new focus.
  const graphSettled = !lazyMode || drawnGraph.wanted.every(id => lazy.loaded.has(id) || lazy.failed.has(id));
  useEffect(() => {
    if (!lazyMode || view === 'page') return;
    const next = [...new Set([...drawnGraph.wanted, ...previewed])];
    setGraphOpened(current =>
      current.length === next.length && current.every((id, index) => id === next[index]) ? current : next,
    );
  }, [lazyMode, view, drawnGraph.wanted, previewed]);

  // The selected page's own links: its notes' mentions and `[[links]]` in its body going out, notes
  // elsewhere that mention it coming in. Each end is a page id or a ref; the ends the explorer holds
  // resolve at once, the rest are fetched (up to twice FOCUS_LINK_CAP keys each way, outranking sibling dots).
  const focusLinkList = (source.usePageLinks ?? noLinkQuery)(view === 'graph' ? selectedPageId : null).data;
  const linkEnds = useMemo(() => {
    const detail = selected.data;
    if (!detail || detail.page.id !== selectedPageId) return null;
    const known = new Map([...lazy.pages, ...detail.ancestors, ...detail.related].map(page => [page.id, page]));
    const index = knowledgePageRefIndex(known.values());
    const own = detail.page.id;
    const mentions = detail.notes.flatMap(note => note.mentions).filter(key => key && key !== own);
    const refs = bodyLinkRefs(detail.page.body ?? '')
      .map(ref => ref.trim())
      .filter(key => key && key !== own);
    const out = [...mentions, ...refs];
    // The page route resolves ids and `scope#path` refs, never a bare name: a `[[Name]]` the explorer does not hold
    // is not fetched (the link index supplies its edge), so it does not 404.
    const mentioned = new Set(mentions);
    const unaskable = new Set(
      refs.filter(ref => !ref.includes(':') && !PAGE_ID_SHAPE.test(ref) && !mentioned.has(ref)),
    );
    // Notes that mention this page, and (when the host lists links) bodies that link to it: a note edge is a
    // mention, a body edge a link, so a page that both links and mentions draws each once.
    const listed = (focusLinkList?.edges ?? []).filter(edge => edge.toPageId === own);
    const noteInto = [
      ...new Set([
        ...(detail.mentionedBy ?? []).map(note => note.pageId),
        ...listed.filter(edge => edge.kind === 'note').map(edge => edge.fromPageId),
      ]),
    ].filter(id => id !== own);
    const bodyInto = [...new Set(listed.filter(edge => edge.kind === 'body').map(edge => edge.fromPageId))].filter(
      id => id !== own,
    );
    const into = [...new Set([...noteInto, ...bodyInto])];
    const lookup = (key: string) => known.get(key) ?? index.resolve(key);
    const missing = (keys: string[]) => [...new Set(keys.filter(key => !lookup(key) && !unaskable.has(key)))];
    const resolvedCount = (keys: string[]) => new Set(keys.flatMap(key => lookup(key)?.id ?? [])).size;
    const room = (keys: string[]) => Math.max(0, FOCUS_LINK_FETCH_CAP - resolvedCount(keys));
    const wantOut = missing(out);
    const wantIn = missing(into);
    return {
      detail,
      known,
      mentions,
      refs,
      into,
      noteInto,
      bodyInto,
      lookup,
      fetchKeys: [...wantOut.slice(0, room(out)), ...wantIn.slice(0, room(into))],
      unfetched: {
        out: Math.max(0, wantOut.length - room(out)),
        in: Math.max(0, wantIn.length - room(into)),
      },
    };
  }, [selected.data, selectedPageId, lazy.pages, focusLinkList]);
  const fetchKeys = linkEnds?.fetchKeys ?? noKeys;
  const fetchedStates = (source.useLinkedPages ?? noLinkedPages)(fetchKeys);
  const fetchedSignature = fetchKeys
    .map((key, index) => `${key}=${fetchedStates[index]?.data?.page?.id ?? ''}`)
    .join('|');
  const fetchedPages = useMemo(() => {
    const byKey = new Map<string, KnowledgePagePayload>();
    fetchKeys.forEach((key, index) => {
      const page = fetchedStates[index]?.data?.page;
      if (page) byKey.set(key, page);
    });
    return byKey;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- states are new arrays each render; the signature names which pages arrived
  }, [fetchedSignature]);
  const focusLinks = useMemo(() => {
    if (!linkEnds) return { edges: [], pages: [], unfetched: { in: 0, out: 0 } };
    const { detail, lookup, mentions, refs, noteInto, bodyInto } = linkEnds;
    const resolve = (key: string) => lookup(key) ?? fetchedPages.get(key);
    const own = detail.page.id;
    const edges: KnowledgePageEdge[] = [];
    const pages = new Map<string, KnowledgePagePayload>();
    const reach = (key: string, kind: 'mention' | 'link', side: 'out' | 'in') => {
      const target = resolve(key);
      if (!target || target.id === own) {
        // An unfetched id still draws its edge, counted as not shown until its page arrives.
        if (!target && kind === 'mention' && side === 'out') edges.push({ source: own, target: key, kind });
        if (!target && side === 'in') edges.push({ source: key, target: own, kind });
        return;
      }
      pages.set(target.id, target);
      edges.push(side === 'out' ? { source: own, target: target.id, kind } : { source: target.id, target: own, kind });
    };
    for (const key of mentions) reach(key, 'mention', 'out');
    for (const key of refs) reach(key, 'link', 'out');
    for (const key of noteInto) reach(key, 'mention', 'in');
    for (const key of bodyInto) reach(key, 'link', 'in');
    return {
      edges: edges.filter(edge => edge.source !== edge.target),
      pages: [...pages.values()],
      unfetched: linkEnds.unfetched,
    };
  }, [linkEnds, fetchedPages]);

  const focusLinkIds = useMemo(() => new Set(focusLinks.pages.map(page => page.id)), [focusLinks.pages]);
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
  const knownLinks = useMemo(() => {
    // A body link the loaded page shows and the link index lists is one line, not two.
    const seen = new Set<string>();
    return [
      ...graph.edges.filter(edge => edge.kind === 'mention'),
      ...bodyLinkEdges(drawn.pages),
      ...focusLinks.edges,
    ].filter(edge => {
      const key = `${edge.kind}:${edge.source}>${edge.target}`;
      return seen.has(key) ? false : (seen.add(key), true);
    });
  }, [graph.edges, drawn.pages, focusLinks.edges]);
  const linkView = useMemo(
    () => visibleLinks(knownLinks, pagesById, selectedPageId, allLinks),
    [knownLinks, pagesById, selectedPageId, allLinks],
  );
  const linkEdges = linkView.edges;
  // Exact counts for the pages the graph holds, in batches the host's route accepts; a failure (a
  // server with no link index) leaves the counts to what the loaded pages show.
  const countIds = useMemo(
    () =>
      drawn.pages
        .filter(page => !isChildPlaceholder(page) && !isRestCircle(page) && !isScopeGroup(page))
        .map(page => page.id)
        .sort(),
    [drawn.pages],
  );
  const counted = (source.useLinkCounts ?? noLinkQuery)(view === 'graph' ? countIds : []);
  const exactCounts = useMemo(() => (counted.data ? new Map(Object.entries(counted.data)) : undefined), [counted.data]);
  const hiddenLinks = useMemo(
    () => (exactCounts ? undrawnLinks(exactCounts, linkEdges) : linkView.hidden),
    [exactCounts, linkEdges, linkView.hidden],
  );
  // The page under the pointer: once it rests there its real links are fetched and drawn to whichever
  // ends are on screen; the rest are counted as not shown.
  // Only a pointer that rests re-renders the explorer: passing over pages sets and clears a timer.
  const [hoverFetchId, setHoverFetchId] = useState<string | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const setHoveredId = useCallback((id: string | null) => {
    clearTimeout(hoverTimer.current);
    if (id) hoverTimer.current = setTimeout(() => setHoverFetchId(id), HOVER_FETCH_DELAY_MS);
    else setHoverFetchId(null);
  }, []);
  useEffect(() => () => clearTimeout(hoverTimer.current), []);
  const hovered = (source.usePageLinks ?? noLinkQuery)(hoverFetchId);
  const hoverEdges = useMemo<KnowledgePageEdge[]>(
    () =>
      hoverFetchId && hovered.data
        ? hovered.data.edges.map(edge => ({
            source: edge.fromPageId,
            target: edge.toPageId,
            kind: edge.kind === 'body' ? ('link' as const) : ('mention' as const),
            count: edge.count,
          }))
        : [],
    [hoverFetchId, hovered.data],
  );

  // A clicked mention line shows the notes that make the mention; opening the page from there marks them.
  const [mention, setMention] = useState<MentionSelection | null>(null);
  const [marked, setMarked] = useState<{ source: string; target: string } | null>(null);
  const closeMention = useCallback(() => setMention(null), []);
  // Below lg the graph shares its slot with the tree. Mount it only when it is showing: a graph mounted
  // into a hidden 0×0 pane has nothing to fit and was left unfitted when the toggle revealed it.
  const graphShown = !narrow || view === 'graph';
  const overlay = !narrow;
  const [treeOpen, setTreeOpen] = useState(true);
  const [drawerLastId, setDrawerLastId] = useState<string>();
  const viewTabs = useRef<HTMLDivElement>(null);
  const showPagesButton = useRef<HTMLElement>(null);
  const hidePagesButton = useRef<HTMLElement>(null);
  const focusTabOnPageOpen = useRef(false);
  const highlightMentionOf = marked && marked.source === selectedPageId ? marked.target : undefined;
  const showPage = view === 'page' && !!selectedPageId;
  // The pages focused before this one, most recent last, so Back retraces a walk through the levels.
  const [history, setHistory] = useState<readonly string[]>([]);
  const lastSelected = useRef<string | null>(selectedPageId);
  const goingBackTo = useRef<string | null>(null);
  useEffect(() => {
    const previous = lastSelected.current;
    lastSelected.current = selectedPageId;
    const backTarget = goingBackTo.current;
    goingBackTo.current = null;
    // Arriving where Back pointed isn't a new step; any other selection is, even if Back's was ignored.
    if (backTarget && backTarget === selectedPageId) return;
    if (!previous || !selectedPageId || previous === selectedPageId) return;
    setHistory(current => [...current.filter(id => id !== selectedPageId), previous].slice(-FOCUS_HISTORY_CAP));
  }, [selectedPageId]);
  const backTo = history.length ? history[history.length - 1] : undefined;
  const goBack = () => {
    if (!backTo) return;
    goingBackTo.current = backTo;
    setHistory(current => current.slice(0, -1));
    onSelect(backTo);
  };
  const openPage = (pageId: string) => {
    onSelect(pageId);
    onViewChange('page');
  };
  const frameInGraph = (pageId: string) => {
    onSelect(pageId);
    if (requestedView !== 'graph') onViewChange('graph');
  };
  // From the tree: in the graph, a first click frames the page there and a second click on the same
  // page opens it, like clicking a node. Elsewhere it opens. A lazily loaded graph loads around whatever
  // is focused; a host's fixed graph that lacks the page has nothing to frame, so it opens as a page.
  const selectFromTree = (page: KnowledgePagePayload) => {
    if (page.isScope) setFocusScopeId(page.id);
    if (view === 'graph' && (lazyMode || pagesById.has(page.id)) && page.id !== selectedPageId) frameInGraph(page.id);
    else openPage(page.id);
  };
  // Pages reached from outside the tree (search, links, mentions) clear a focus they fall outside of.
  const leaveScopeFocusFor = (pageId: string) => {
    if (focusScopeId && !withinScope([...lazy.pages, ...drawn.pages], focusScopeId).some(page => page.id === pageId)) {
      setFocusScopeId(null);
    }
  };
  const openAnywhere = (pageId: string) => {
    leaveScopeFocusFor(pageId);
    openPage(pageId);
  };
  // From search: in the graph, a first pick frames the page there and a second pick of the focused page opens
  // it, like the tree. A fixed graph that lacks the page has nothing to frame, so it opens as a page.
  const selectFromSearch = (pageId: string) => {
    if (view === 'graph' && (lazyMode || pagesById.has(pageId)) && pageId !== selectedPageId) {
      leaveScopeFocusFor(pageId);
      frameInGraph(pageId);
    } else openAnywhere(pageId);
  };
  const focusScope = focusScopeId
    ? (lazy.pages.find(page => page.id === focusScopeId) ?? pagesById.get(focusScopeId))
    : undefined;
  const treePages = withinScope(source.useTreeLevels ? lazy.pages : graph.pages, focusScope ? focusScopeId : null);
  const graphPages = useMemo(
    () => withinScope(drawn.pages, focusScope ? focusScopeId : null),
    [drawn.pages, focusScope, focusScopeId],
  );
  // With nothing selected the graph still centres on its first root scope, so that scope's "more" note shows.
  const focusedInGraph = view === 'graph' ? pagesById.get(selectedPageId ?? drawn.hub ?? '') : undefined;
  const children = focusedInGraph ? drawn.hiddenChildren.get(focusedInGraph.id) : undefined;
  const views: Array<{ value: KnowledgeExplorerView; label: string; icon: ReactNode; narrowOnly?: boolean }> = [
    { value: 'tree', label: 'Tree', icon: <IconCodeTree />, narrowOnly: true },
    { value: 'graph', label: 'Graph', icon: <Network />, narrowOnly: false },
    { value: 'page', label: 'Page', icon: <IconFileText />, narrowOnly: false },
  ];

  const tabValue = explorerTab(view, showPage);
  const drawerOpen = overlay && !showPage && !!selectedPageId && !isNotFound(selected.error);
  const drawerPageId = drawerOpen && selectedPageId ? selectedPageId : undefined;
  if (drawerPageId && drawerPageId !== drawerLastId) setDrawerLastId(drawerPageId);
  const drawerShownId = drawerPageId ?? drawerLastId;
  const graphInsets = {
    left: treeInset(overlay, treeOpen),
    right: drawerPageId ? PAGE_DRAWER_INSET : 0,
  };
  const insetStyle: InsetStyle = {
    '--knowledge-tree-inset': `${graphInsets.left}px`,
    '--knowledge-tree-drawer-inset': `${overlay && treeOpen ? TREE_DRAWER_INSET : 0}px`,
    '--knowledge-drawer-inset': `${graphInsets.right}px`,
  };
  const focusViewTab = () =>
    viewTabs.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus();
  const focusPageTabOnMount = (section: HTMLElement | null) => {
    if (!section || !focusTabOnPageOpen.current) return;
    focusTabOnPageOpen.current = false;
    focusViewTab();
  };
  const toggleTree = (open: boolean) => {
    flushSync(() => setTreeOpen(open));
    (open ? hidePagesButton : showPagesButton).current?.focus();
  };

  const treeClosed = overlay && !treeOpen;
  const treeHeader = overlay ? (
    <DataPanel.Header>
      <DataPanel.Heading>Pages</DataPanel.Heading>
      <DataPanel.HeaderActions>
        <Button
          variant="ghost"
          size="icon-sm"
          tooltip="Hide pages"
          aria-label="Hide pages"
          ref={hidePagesButton}
          onClick={() => toggleTree(false)}
        >
          <IconSidebarWideLeftArrow />
        </Button>
      </DataPanel.HeaderActions>
    </DataPanel.Header>
  ) : null;
  const treeBody = (
    <>
      {focusScope ? (
        <div
          className="flex items-center gap-2 border-b border-surface-rim bg-fill-subtle px-3 py-2"
          data-testid="knowledge-scope-focus"
        >
          <div className="flex min-w-0 flex-1 flex-col">
            <Txt as="span" variant="eyebrow" tone="muted" className="uppercase">
              {focusScope.displayLabel ?? 'Scope'}
            </Txt>
            <span className="flex min-w-0 items-center gap-1.5">
              <KnowledgeSourceIcon page={focusScope} className="size-3.5" />
              <KnowledgeTooltip label={focusScope.address ?? focusScope.name}>
                <Txt as="span" variant="label" tone="ink" className="truncate">
                  {scopeTitle(focusScope)}
                </Txt>
              </KnowledgeTooltip>
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setFocusScopeId(null)}>
            All scopes
          </Button>
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-auto">
        {source.useTreeLevels && lazy.rootsPending ? (
          <div className="p-2">
            <TreeRowsSkeleton label="Loading pages" rows={6} />
          </div>
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
    </>
  );
  const drawerPage = drawerShownId
    ? (pagesById.get(drawerShownId) ?? lazy.pages.find(page => page.id === drawerShownId))
    : undefined;

  return (
    <KnowledgePagesByRef.Provider value={fetchedPages}>
      <div className={`flex min-h-0 flex-1 flex-col ${flush ? '' : 'gap-2'}`}>
        <ActionRow className={flush ? 'shrink-0 border-b border-surface-rim px-3 py-2' : undefined}>
          <ActionRow.Start>
            <Tabs<KnowledgeExplorerView>
              ref={viewTabs}
              value={tabValue}
              defaultTab={tabValue}
              onValueChange={next => onViewChange(next)}
              aria-label="View"
            >
              <TabList variant="pill-ghost" size="sm">
                {views.map(option => (
                  <Tab
                    key={option.value}
                    value={option.value}
                    disabled={option.value === 'page' && !selectedPageId}
                    className={option.narrowOnly ? 'lg:hidden' : undefined}
                  >
                    <Icon size="xs">{option.icon}</Icon>
                    <Txt variant="caption" className="text-inherit">
                      {option.label}
                    </Txt>
                  </Tab>
                ))}
              </TabList>
            </Tabs>
            <SearchBox source={source} onSelect={selectFromSearch} />
          </ActionRow.Start>
          {toolbarEnd ? <ActionRow.End>{toolbarEnd}</ActionRow.End> : null}
        </ActionRow>
        {!lazyMode && graph.truncated && !showPage ? (
          <Txt variant="caption" tone="muted" className={flush ? 'px-3 pt-2' : undefined}>
            The graph shows the first {graph.pages.length} pages. Open the tree or search to reach the rest.
          </Txt>
        ) : null}
        {selectedPageId && !showPage && isNotFound(selected.error) ? (
          <Txt role="alert" variant="caption" className={`text-destructive-foreground ${flush ? 'px-3 pt-2' : ''}`}>
            Page not found. The linked page may have been deleted or merged.
          </Txt>
        ) : null}
        <div style={insetStyle} className="relative flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
          {overlay ? (
            <div
              inert={treeClosed}
              aria-hidden={treeClosed || undefined}
              data-state={treeClosed ? 'closed' : 'open'}
              className={`absolute inset-y-2 left-2 z-10 flex w-72 transition duration-slow ease-out-custom motion-reduce:transition-none ${treeClosed ? 'pointer-events-none -translate-x-4 opacity-0' : 'translate-x-0 opacity-100'}`}
            >
              <DataPanel variant="inline" title="Pages" className="shadow-overlay">
                {treeHeader}
                {treeBody}
              </DataPanel>
            </div>
          ) : (
            <aside
              aria-label="Pages"
              className={`min-h-0 w-full flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card lg:w-72 lg:flex-none lg:shrink-0 ${view === 'tree' ? 'flex' : 'hidden'}`}
            >
              {treeBody}
            </aside>
          )}
          {overlay ? (
            <Button
              tooltip="Show pages"
              aria-label="Show pages"
              size="icon-sm"
              inert={!treeClosed}
              aria-hidden={!treeClosed || undefined}
              className={`absolute top-3 left-3 z-10 shadow-overlay transition-opacity duration-slow ease-out-custom motion-reduce:transition-none ${treeClosed ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
              ref={showPagesButton}
              onClick={() => toggleTree(true)}
            >
              <IconSidebarLeftArrow />
            </Button>
          ) : null}
          {showPage ? (
            <section
              ref={focusPageTabOnMount}
              aria-label="Selected page"
              className={`flex min-h-0 min-w-0 flex-1 flex-col ${overlay ? `bg-background p-2 pl-[calc(var(--knowledge-tree-inset)+0.5rem)] transition-[padding] duration-slow ease-out-custom motion-reduce:transition-none ${flush ? '' : 'rounded-xl border border-border'}` : 'overflow-hidden rounded-lg border border-border bg-card'}`}
            >
              <div
                className={
                  overlay
                    ? `flex min-h-0 flex-1 flex-col overflow-hidden rounded-studio-frame ${frameSurfaceStyle}`
                    : 'contents'
                }
              >
                <SelectedPage
                  source={source}
                  pageId={selectedPageId}
                  pagesById={pagesById}
                  onSelect={openAnywhere}
                  highlightMentionOf={highlightMentionOf}
                />
              </div>
            </section>
          ) : (
            <div
              className={`relative min-h-0 min-w-0 flex-1 overflow-hidden bg-background lg:block lg:h-full ${flush ? '' : 'rounded-xl border border-border'} ${view === 'graph' ? 'block' : 'hidden'}`}
              data-testid="knowledge-graph-container"
            >
              {graphShown ? (
                <div className="absolute top-3 right-3 z-10 -translate-x-(--knowledge-drawer-inset) transition-transform duration-slow ease-out-custom motion-reduce:transition-none">
                  <ButtonsGroup
                    orientation="vertical"
                    size="sm"
                    aria-label="Graph options"
                    className="rounded-xl shadow-overlay"
                  >
                    <Button
                      data-testid="knowledge-graph-back"
                      aria-label="Back"
                      tooltip={backTo ? 'Back to the previous page' : 'Nothing to go back to yet'}
                      tooltipPosition="left"
                      size="icon-sm"
                      disabled={!backTo}
                      onClick={goBack}
                    >
                      <IconArrowLeft />
                    </Button>
                    <Button
                      aria-label="All links"
                      aria-pressed={allLinks}
                      data-testid="knowledge-graph-all-links"
                      tooltip={allLinks ? 'Show only the selected page’s links' : 'Show every link between pages'}
                      tooltipPosition="left"
                      size="icon-sm"
                      className={allLinks ? '[--control-icon:var(--foreground)]' : undefined}
                      onClick={() => setAllLinks(current => !current)}
                    >
                      <IconChainLink1 />
                    </Button>
                    <Button
                      aria-label="Link counts"
                      aria-pressed={dotCounts}
                      data-testid="knowledge-graph-dot-counts"
                      tooltip={dotCounts ? 'Hide link counts' : 'Show link counts on each dot'}
                      tooltipPosition="left"
                      size="icon-sm"
                      className={dotCounts ? '[--control-icon:var(--foreground)]' : undefined}
                      onClick={() => setDotCounts(current => !current)}
                    >
                      <IconHashtag />
                    </Button>
                  </ButtonsGroup>
                </div>
              ) : null}
              {graphShown ? (
                <KnowledgePageGraph
                  pages={graphPages}
                  edges={linkEdges}
                  pinnedIds={graph.pinnedIds}
                  grants={graph.grants}
                  selectedPageId={selectedPageId}
                  centerId={drawn.hub}
                  hiddenLinks={hiddenLinks}
                  knownLinks={knownLinks}
                  fetchedLinks={hoverEdges}
                  exactLinkCounts={exactCounts}
                  onHover={setHoveredId}
                  nearIds={focusLinkIds}
                  settled={graphSettled}
                  insets={graphInsets}
                  collapsibleLegend={overlay}
                  showCounts={dotCounts}
                  onPreview={page => {
                    if (isChildPlaceholder(page) && page.parentId) previewParent(page.parentId);
                  }}
                  onSelect={page => {
                    // A stand-in loads its parent's children; a scope group opens into its scopes.
                    if (isChildPlaceholder(page)) return page.parentId ? previewParent(page.parentId) : undefined;
                    if (isRestCircle(page)) {
                      const parentId = page.parentId;
                      if (!parentId) return undefined;
                      setRevealed(current => new Map(current).set(parentId, (current.get(parentId) ?? 0) + REST_BATCH));
                      // Past the children loaded so far, fetch the next chunk too.
                      return lazy.loadMore.get(parentId)?.();
                    }
                    if (isScopeGroup(page)) return setOpenGroups(current => new Set(current).add(page.id));
                    // Hosts resolve a `?page=` with no view to the page view, so say graph outright.
                    frameInGraph(page.id);
                  }}
                  onOpen={page => openPage(page.id)}
                  onClearSelection={() => {
                    setMention(null);
                    if (selectedPageId) onSelect(null);
                  }}
                  onMentionSelect={setMention}
                />
              ) : null}
              {overlay ? (
                <div
                  inert={!drawerPageId}
                  aria-hidden={!drawerPageId || undefined}
                  data-state={drawerPageId ? 'open' : 'closed'}
                  onTransitionEnd={event => {
                    if (!drawerPageId && event.target === event.currentTarget) setDrawerLastId(undefined);
                  }}
                  className={`absolute inset-y-2 right-2 z-10 flex w-96 transition duration-slow ease-out-custom motion-reduce:transition-none ${drawerPageId ? 'translate-x-0 opacity-100' : 'pointer-events-none translate-x-4 opacity-0'}`}
                >
                  {drawerShownId ? (
                    <DataPanel variant="inline" title="Page details" className="shadow-overlay">
                      <DataPanel.Header>
                        <DataPanel.Heading className="min-w-0 flex-1 shrink">
                          <span className="truncate">{drawerPage?.name ?? 'Page'}</span>
                        </DataPanel.Heading>
                        <DataPanel.HeaderActions>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            tooltip="Open page"
                            aria-label="Open page"
                            onClick={() => {
                              focusTabOnPageOpen.current = true;
                              openPage(drawerShownId);
                            }}
                          >
                            <IconSquareArrowTopRight />
                          </Button>
                          <DataPanel.CloseButton
                            icon="x"
                            label="Close page details"
                            tooltip="Close"
                            onClick={() => {
                              focusViewTab();
                              onSelect(null);
                            }}
                          />
                        </DataPanel.HeaderActions>
                      </DataPanel.Header>
                      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                        <SelectedPage
                          source={source}
                          pageId={drawerShownId}
                          pagesById={pagesById}
                          onSelect={selectFromSearch}
                          highlightMentionOf={highlightMentionOf}
                          compact
                        />
                      </div>
                    </DataPanel>
                  ) : null}
                </div>
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
    </KnowledgePagesByRef.Provider>
  );
}
