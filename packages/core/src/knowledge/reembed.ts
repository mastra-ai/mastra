import type { KnowledgePage, KnowledgeStorage } from '../storage/domains/knowledge';
import { KNOWLEDGE_MAX_PAGE_CHUNKS } from './semantic';
import type { KnowledgeSemanticIndex } from './semantic';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;
const NOTE_PAGE = 100;

/** @experimental */
export interface KnowledgeReembedOptions {
  /** Only this scope's pages and the notes on them, e.g. `org:acme`. Default: the whole store. */
  scope?: string;
  /** Pages handled in this call, 1 to 500. A page's notes go with it; in a whole-store run, each scope whose page notes are embedded also counts as one. Default 50. */
  limit?: number;
  /** `nextCursor` from the previous call. Omit to start. */
  cursor?: string;
}

/** @experimental */
export interface KnowledgeReembedResult {
  /** What this call embedded. */
  embedded: { pages: number; notes: number };
  /** Pages and notes whose embed still failed after Knowledge's own retries (other than rate limiting); the rest of the batch went on. A later run retries them. */
  failed: Array<{ kind: 'page' | 'note'; id: string; error: string }>;
  /** Pages longer than the chunk cap: embedded up to it, the rest is found by keyword search only. */
  overChunkCap: Array<{ pageId: string; chunks: number }>;
  /** The embedder kept rate limiting, so the call stopped early. Wait before passing `nextCursor`, which resumes where it stopped, mid-page if need be. `embedded` and `failed` still count what this call got done. */
  rateLimited?: true;
  /** Pass it to the next call to go on. Absent when everything has been handled. */
  nextCursor?: string;
}

/**
 * Where a run is: `pages` lists ordinary pages from cursor `c`, `skip` of them already handled;
 * `scopes` walks the scope tree depth first for notes on scope pages, one child per listing:
 * `path` holds, for each scope on the way down, its parent `p` and the listing cursor `c` to its
 * next child. The cursor grows with the depth of the tree, not the number of scopes.
 */
type ScopePath = Array<{ p: string | null; c?: string }>;

/**
 * Progress inside the page (or scope page) the position points at, kept when a 429 stops a call
 * part way through it: `bc` body chunks already stored, `body` once the whole page is embedded, then
 * notes from listing cursor `nc` with `ns` of that listing already handled.
 */
type Progress = { body: boolean; bc?: number; nc?: string; ns: number };

type Position = (
  | { scope?: string; phase: 'scope-notes' }
  | { scope?: string; phase: 'pages'; c?: string; skip: number }
  | { scope?: undefined; phase: 'scopes'; path: ScopePath }
) & { item?: Progress };

function encode(position: Position): string {
  return Buffer.from(JSON.stringify({ v: 2, ...position })).toString('base64url');
}

function decode(cursor: string, scope: string | undefined): Position {
  let position: (Position & { v?: number }) | undefined;
  try {
    position = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    position = undefined;
  }
  if (!position || position.v !== 2 || !['scope-notes', 'pages', 'scopes'].includes(position.phase)) {
    throw new Error('Knowledge reembed: the cursor is not one reembed() returned.');
  }
  if (position.scope !== scope) {
    throw new Error('Knowledge reembed: the cursor was returned for a different scope.');
  }
  return position;
}

/** A 429 from the embedder, whether thrown directly or as the last try of a retry error. */
function isRateLimit(error: unknown): boolean {
  const e = error as { statusCode?: number; lastError?: { statusCode?: number } } | undefined;
  return e?.statusCode === 429 || e?.lastError?.statusCode === 429;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

class RateLimited extends Error {}

/**
 * Embeds existing pages and notes in batches, without changing them. Each call handles up to
 * `limit` pages with their notes and returns a cursor to go on from, so a run over a large store
 * can stop and resume. Vector ids are fixed per page chunk and note, so handling a page again
 * overwrites its vectors.
 * @internal
 */
export async function reembedKnowledge(
  storage: KnowledgeStorage,
  index: KnowledgeSemanticIndex,
  options: KnowledgeReembedOptions = {},
): Promise<KnowledgeReembedResult> {
  const limit = options.limit ?? DEFAULT_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new Error(`Knowledge reembed: limit must be an integer from 1 to ${MAX_LIMIT}.`);
  }
  let scopeId: string | undefined;
  if (options.scope !== undefined) {
    const [scope] = await storage.getScopesByAddress([options.scope]);
    if (!scope) throw new Error(`Knowledge reembed: no scope "${options.scope}".`);
    scopeId = scope.id;
  }
  const { item: resumeItem, ...start }: Position = options.cursor
    ? decode(options.cursor, options.scope)
    : options.scope
      ? { scope: options.scope, phase: 'scope-notes' }
      : { phase: 'pages', skip: 0 };
  let position: Position | undefined = start as Position;

  const result: KnowledgeReembedResult = { embedded: { pages: 0, notes: 0 }, failed: [], overChunkCap: [] };
  let handled = 0;
  // How far into the current page or scope page this call got, so a 429 resumes mid-way instead of
  // starting the page over: a page with more notes than one quota window would never finish.
  let item: Progress = resumeItem ?? { body: false, ns: 0 };

  /** Notes on one page, from where `item` says the last call stopped. */
  const notesOn = async (pageId: string) => {
    do {
      const page = await storage.listNotes({ pageId, read: 'all', cursor: item.nc, limit: NOTE_PAGE });
      for (const note of page.notes.slice(item.ns)) {
        try {
          await index.indexNote(note);
          result.embedded.notes++;
        } catch (error) {
          if (isRateLimit(error)) throw new RateLimited();
          result.failed.push({ kind: 'note', id: note.id, error: message(error) });
        }
        item = { ...item, ns: item.ns + 1 };
      }
      if (!page.nextCursor) break;
      item = { ...item, nc: page.nextCursor, ns: 0 };
    } while (true);
  };

  /** One ordinary page with its notes. */
  const handlePage = async (page: KnowledgePage) => {
    if (!item.body) {
      try {
        const chunks = await index.indexPage(page, item.bc ?? 0);
        result.embedded.pages++;
        if (chunks > KNOWLEDGE_MAX_PAGE_CHUNKS) result.overChunkCap.push({ pageId: page.id, chunks });
      } catch (error) {
        if (isRateLimit(error)) {
          const stored = (error as { knowledgeStoredChunks?: number }).knowledgeStoredChunks;
          if (stored) item = { ...item, bc: stored };
          throw new RateLimited();
        }
        result.failed.push({ kind: 'page', id: page.id, error: message(error) });
      }
      item = { ...item, body: true, bc: undefined };
    }
    await notesOn(page.id);
  };

  /** Notes on a scope page (scope pages themselves aren't embedded). */
  const handleScope = (scopePageId: string) => notesOn(scopePageId);

  const done = () => {
    item = { body: false, ns: 0 };
  };

  try {
    while (position && handled < limit) {
      if (position.phase === 'scope-notes') {
        await handleScope(scopeId!);
        done();
        position = { scope: options.scope, phase: 'pages', skip: 0 };
        continue;
      }
      if (position.phase === 'pages') {
        const listing = await storage.listPages({
          read: 'all',
          scopeId,
          cursor: position.c,
          limit: position.skip + (limit - handled),
        });
        const pages = listing.pages.slice(position.skip);
        for (const page of pages) {
          if (handled >= limit) break;
          await handlePage(page);
          done();
          handled++;
          position = { ...position, skip: position.skip + 1 };
        }
        if (position.skip >= listing.pages.length) {
          position = listing.nextCursor
            ? { ...position, c: listing.nextCursor, skip: 0 }
            : options.scope
              ? undefined
              : { phase: 'scopes', path: [{ p: null }] };
        }
        continue;
      }
      // Scope phase, whole-store runs only. Every listing counts toward the limit: one that finds a
      // child counts as that scope, an empty one counts on its own.
      const path: ScopePath = position.path;
      const { p, c } = path[path.length - 1]!;
      const listing = await storage.listChildScopes({ parentId: p, cursor: c, limit: 1 });
      const child = listing.pages[0];
      const rest: ScopePath = path.slice(0, -1);
      if (child) {
        await handleScope(child.id);
        done();
        const next: ScopePath = listing.nextCursor ? [{ p, c: listing.nextCursor }] : [];
        position = { phase: 'scopes', path: [...rest, ...next, { p: child.id }] };
      } else {
        position = rest.length ? { phase: 'scopes', path: rest } : undefined;
      }
      handled++;
    }
  } catch (error) {
    if (!(error instanceof RateLimited)) throw error;
    result.rateLimited = true;
    if (position && (item.body || item.bc || item.ns > 0 || item.nc)) position = { ...position, item };
  }

  if (position) result.nextCursor = encode(position);
  return result;
}
