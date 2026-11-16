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
  /** Pages handled in this call, 1 to 500. A page's notes go with it. Default 50. */
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
  /** The embedder kept rate limiting, so the call stopped early. Wait before passing `nextCursor`, which retries from that page. */
  rateLimited?: true;
  /** Pass it to the next call to go on. Absent when everything has been handled. */
  nextCursor?: string;
}

/**
 * Where a run is: `pages` lists ordinary pages from cursor `c`, `skip` of them already handled;
 * `scopes` walks the scope tree for notes on scope pages: `stack` holds parents still to list
 * (the top one is listed from `c`), `found` the children of the top one seen so far.
 */
type Position =
  | { scope?: string; phase: 'scope-notes' }
  | { scope?: string; phase: 'pages'; c?: string; skip: number }
  | { scope?: undefined; phase: 'scopes'; stack: Array<string | null>; found: string[]; c?: string; skip: number };

function encode(position: Position): string {
  return Buffer.from(JSON.stringify({ v: 1, ...position })).toString('base64url');
}

function decode(cursor: string, scope: string | undefined): Position {
  let position: (Position & { v?: number }) | undefined;
  try {
    position = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    position = undefined;
  }
  if (!position || position.v !== 1 || !['scope-notes', 'pages', 'scopes'].includes(position.phase)) {
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
  let position: Position | undefined = options.cursor
    ? decode(options.cursor, options.scope)
    : options.scope
      ? { scope: options.scope, phase: 'scope-notes' }
      : { phase: 'pages', skip: 0 };

  const result: KnowledgeReembedResult = { embedded: { pages: 0, notes: 0 }, failed: [], overChunkCap: [] };
  let handled = 0;

  /** Notes on one page; throws RateLimited, leaving nothing counted, so the page is redone whole. */
  const notesOn = async (pageId: string) => {
    let embedded = 0;
    const failed: KnowledgeReembedResult['failed'] = [];
    let cursor: string | undefined;
    do {
      const page = await storage.listNotes({ pageId, read: 'all', cursor, limit: NOTE_PAGE });
      for (const note of page.notes) {
        try {
          await index.indexNote(note);
          embedded++;
        } catch (error) {
          if (isRateLimit(error)) throw new RateLimited();
          failed.push({ kind: 'note', id: note.id, error: message(error) });
        }
      }
      cursor = page.nextCursor;
    } while (cursor);
    return { embedded, failed };
  };

  /** One ordinary page with its notes, counted only once all of it is done. */
  const handlePage = async (page: KnowledgePage) => {
    let chunks: number | undefined;
    let pageFailure: KnowledgeReembedResult['failed'][number] | undefined;
    try {
      chunks = await index.indexPage(page);
    } catch (error) {
      if (isRateLimit(error)) throw new RateLimited();
      pageFailure = { kind: 'page', id: page.id, error: message(error) };
    }
    const notes = await notesOn(page.id);
    if (pageFailure) result.failed.push(pageFailure);
    else result.embedded.pages++;
    if (chunks !== undefined && chunks > KNOWLEDGE_MAX_PAGE_CHUNKS)
      result.overChunkCap.push({ pageId: page.id, chunks });
    result.embedded.notes += notes.embedded;
    result.failed.push(...notes.failed);
  };

  /** Notes on a scope page (scope pages themselves aren't embedded). */
  const handleScope = async (scopePageId: string) => {
    const notes = await notesOn(scopePageId);
    result.embedded.notes += notes.embedded;
    result.failed.push(...notes.failed);
  };

  try {
    while (position && handled < limit) {
      if (position.phase === 'scope-notes') {
        await handleScope(scopeId!);
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
          handled++;
          position = { ...position, skip: position.skip + 1 };
        }
        if (position.skip >= listing.pages.length) {
          position = listing.nextCursor
            ? { ...position, c: listing.nextCursor, skip: 0 }
            : options.scope
              ? undefined
              : { phase: 'scopes', stack: [null], found: [], skip: 0 };
        }
        continue;
      }
      // Scope phase: whole-store runs only.
      const parentId = position.stack[position.stack.length - 1]!;
      const listing = await storage.listChildScopes({
        parentId,
        cursor: position.c,
        limit: position.skip + (limit - handled),
      });
      for (const scope of listing.pages.slice(position.skip)) {
        if (handled >= limit) break;
        await handleScope(scope.id);
        handled++;
        position = { ...position, skip: position.skip + 1, found: [...position.found, scope.id] };
      }
      if (position.skip >= listing.pages.length) {
        if (listing.nextCursor) {
          position = { ...position, c: listing.nextCursor, skip: 0 };
        } else {
          const stack: Array<string | null> = [...position.stack.slice(0, -1), ...position.found];
          position = stack.length ? { phase: 'scopes', stack, found: [], skip: 0 } : undefined;
        }
      }
    }
  } catch (error) {
    if (!(error instanceof RateLimited)) throw error;
    result.rateLimited = true;
  }

  if (position) result.nextCursor = encode(position);
  return result;
}
