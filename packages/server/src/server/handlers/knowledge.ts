import * as coreKnowledge from '@mastra/core/knowledge';
import type { Knowledge, KnowledgeChangeEvent } from '@mastra/core/knowledge';
import type { Mastra } from '@mastra/core/mastra';
import type { RequestContext } from '@mastra/core/request-context';
import type { KnowledgeReadScope, KnowledgeStorage } from '@mastra/core/storage';
import { MASTRA_KNOWLEDGE_PRINCIPALS_KEY } from '../constants';
import { MastraFGAPermissions } from '../fga-permissions';
import { HTTPException } from '../http-exception';
import {
  knowledgeActivityQuerySchema,
  knowledgeActivityResponseSchema,
  knowledgeEventsResponseSchema,
  knowledgeGraphQuerySchema,
  knowledgeGraphResponseSchema,
  knowledgePagePathParams,
  knowledgePageQuerySchema,
  knowledgePageResponseSchema,
  knowledgePathParams,
  knowledgeSearchQuerySchema,
  knowledgeSearchResponseSchema,
  knowledgeTreeQuerySchema,
  knowledgeTreeResponseSchema,
  listKnowledgeResponseSchema,
} from '../schemas/knowledge';
import { createRoute } from '../server-adapter/routes/route-builder';

import { handleError } from './error';
import { getHandlerFGAProvider } from './utils';

/**
 * Read-only browsing of Knowledge instances registered on Mastra, for Studio. Nothing here writes.
 *
 * What a caller reads depends on whether the app has auth configured (`server.auth` or `studio.auth`):
 * - No auth: probably a local or test project, so the routes read as the instance owner (`'all'`).
 * - Auth: reads are narrowed to what the signed-in caller can read. The app maps the user to Knowledge
 *   principals by setting MASTRA_KNOWLEDGE_PRINCIPALS_KEY in `auth.authorize` (a `string[]`, or `'all'`
 *   for an admin); the instance turns them into a read scope with `readScopeFor`. A caller with no
 *   mapping is refused with 403.
 *
 * On top of that the path derives `knowledge:read` (`GET /knowledge/...`), and with FGA configured each
 * instance is filtered and gated by `knowledge:read` on that instance. The routes are opt-in
 * (KNOWLEDGE_ROUTES); hosts with their own scoping (Factory) do not mount them.
 */

function hasAuth(mastra: Mastra): boolean {
  return Boolean(mastra.getServer?.()?.auth || (mastra as any).getStudio?.()?.auth);
}

async function callerReadScope(
  mastra: Mastra,
  requestContext: RequestContext | undefined,
  instance: Knowledge,
): Promise<KnowledgeReadScope> {
  if (!hasAuth(mastra)) return 'all';

  const principals = requestContext?.get(MASTRA_KNOWLEDGE_PRINCIPALS_KEY);
  if (principals === undefined || principals === null) {
    throw new HTTPException(403, {
      message: `Knowledge access is not mapped for this caller. Set request context key "${MASTRA_KNOWLEDGE_PRINCIPALS_KEY}" in auth.authorize.`,
    });
  }
  if (principals === 'all') return 'all';
  // The value comes from the app's own authorize code, so a bad one is a host misconfiguration, not a denial.
  if (!Array.isArray(principals) || principals.some(principal => typeof principal !== 'string')) {
    throw new HTTPException(500, {
      message: `Request context key "${MASTRA_KNOWLEDGE_PRINCIPALS_KEY}" must be a string array or 'all'.`,
    });
  }
  try {
    return await instance.readScopeFor(principals);
  } catch (error) {
    // A principal that matches no declared scope type: the app's mapping disagrees with its declarations.
    if (error instanceof Error && error.name === 'KnowledgeDeclarationError') {
      throw new HTTPException(500, { message: error.message, cause: error });
    }
    throw error;
  }
}

async function accessibleInstances(
  mastra: Mastra,
  requestContext: RequestContext | undefined,
  entries: Array<{ id: string; key: string }>,
): Promise<Set<string>> {
  const fgaProvider = getHandlerFGAProvider(mastra, requestContext);
  const user = requestContext?.get('user');
  if (!fgaProvider || !user || typeof user !== 'object' || entries.length === 0) {
    return new Set(entries.map(entry => entry.key));
  }
  const accessible: Array<{ id: string; key: string }> = await fgaProvider.filterAccessible(
    user,
    entries,
    'knowledge',
    MastraFGAPermissions.KNOWLEDGE_READ,
  );
  return new Set(accessible.map(entry => entry.key));
}

type KnowledgePageReaders = Pick<
  typeof coreKnowledge,
  | 'listKnowledgeTreeChildren'
  | 'readKnowledgePage'
  | 'readKnowledgePageActivity'
  | 'readKnowledgePageGraph'
  | 'searchKnowledgeExplorerPages'
>;

// The page readers first ship in @mastra/core 1.81.0, above this package's peer floor. A named import
// of an export an older core lacks fails at ESM link time and takes the whole server down, so they are
// read off the namespace (as in schedules-workflows-shim.ts) and the routes answer 501 without them.
const pageReaders: Partial<KnowledgePageReaders> = coreKnowledge;

function requirePageReaders(): KnowledgePageReaders {
  const {
    listKnowledgeTreeChildren,
    readKnowledgePage,
    readKnowledgePageActivity,
    readKnowledgePageGraph,
    searchKnowledgeExplorerPages,
  } = pageReaders;
  if (
    !listKnowledgeTreeChildren ||
    !readKnowledgePage ||
    !readKnowledgePageActivity ||
    !readKnowledgePageGraph ||
    !searchKnowledgeExplorerPages
  ) {
    throw new HTTPException(501, { message: 'Knowledge browsing needs @mastra/core 1.81.0 or later.' });
  }
  return {
    listKnowledgeTreeChildren,
    readKnowledgePage,
    readKnowledgePageActivity,
    readKnowledgePageGraph,
    searchKnowledgeExplorerPages,
  };
}

/**
 * The declared grants between the graph's scopes, each with its principal's display label. Grants are
 * newer than the page readers, so a core without them sends none and the graph still loads.
 */
async function graphGrants(
  instance: Knowledge,
  store: KnowledgeStorage,
  pages: readonly coreKnowledge.KnowledgePage[],
  read: KnowledgeReadScope,
): Promise<Array<coreKnowledge.KnowledgeGraphScopeGrant & { principalLabel?: string }> | undefined> {
  const readGrants = (coreKnowledge as Partial<typeof coreKnowledge>).readKnowledgeScopeGrants;
  const scopeGrants = (instance as Partial<Knowledge>).scopeGrants?.bind(instance);
  if (!readGrants || !scopeGrants) return undefined;
  const grants = await readGrants(store, { pages, read, grantsFor: scopeGrants });
  return grants.map(grant => {
    const principalLabel = instance.scopeLabel?.(grant.principal);
    return principalLabel ? { ...grant, principalLabel } : grant;
  });
}

async function resolveStore(
  mastra: Mastra,
  requestContext: RequestContext | undefined,
  knowledgeKey: string | undefined,
): Promise<{ instance: Knowledge; store: KnowledgeStorage; read: KnowledgeReadScope; readers: KnowledgePageReaders }> {
  const instance = knowledgeKey ? mastra.listKnowledge()[knowledgeKey] : undefined;
  if (!knowledgeKey || !instance)
    throw new HTTPException(404, { message: `Knowledge ${knowledgeKey ?? ''} not found` });

  // An instance the caller may not read looks the same as one that does not exist.
  const fgaProvider = getHandlerFGAProvider(mastra, requestContext);
  const user = requestContext?.get('user');
  if (fgaProvider && user && typeof user === 'object') {
    const allowed = await fgaProvider.check(user, {
      resource: { type: 'knowledge', id: instance.id },
      permission: MastraFGAPermissions.KNOWLEDGE_READ,
    });
    if (!allowed) throw new HTTPException(404, { message: `Knowledge ${knowledgeKey} not found` });
  }
  const readers = requirePageReaders();
  const read = await callerReadScope(mastra, requestContext, instance);
  return { instance, store: await instance.getStorage(), read, readers };
}

/**
 * Adds each scope page's declared `displayLabel` with its address's `$params` filled in (`'$orgId policy'`
 * → `'acme policy'`), so the explorer can caption scopes. Scope declarations live in config, not
 * storage, so the readers can't supply it. Older cores without `scopeLabel` send no label.
 */
function withDisplayLabel<T extends { isScope: boolean; address?: string }>(
  instance: Knowledge,
  page: T,
): T & { displayLabel?: string } {
  if (!page.isScope || !page.address) return page;
  const displayLabel = instance.scopeLabel?.(page.address);
  return displayLabel ? { ...page, displayLabel } : page;
}

export const LIST_KNOWLEDGE_ROUTE = createRoute({
  method: 'GET',
  path: '/knowledge',
  responseType: 'json',
  responseSchema: listKnowledgeResponseSchema,
  summary: 'List Knowledge instances',
  description:
    "Returns the Knowledge instances registered on this Mastra instance, by application key. Without app auth the other Knowledge routes read the whole instance; with auth they read only what the caller's Knowledge principals (MASTRA_KNOWLEDGE_PRINCIPALS_KEY, set in auth.authorize) can read, and refuse an unmapped caller with 403.",
  tags: ['Knowledge'],
  requiresAuth: true,
  handler: async ({ mastra, requestContext }) => {
    try {
      const all = Object.entries(mastra.listKnowledge()).map(([key, instance]) => ({ key, id: instance.id }));
      const allowed = await accessibleInstances(mastra, requestContext, all);
      return { instances: all.filter(entry => allowed.has(entry.key)) };
    } catch (error) {
      return handleError(error, 'Error listing Knowledge instances');
    }
  },
});

export const GET_KNOWLEDGE_TREE_ROUTE = createRoute({
  method: 'GET',
  path: '/knowledge/:knowledgeKey/tree',
  responseType: 'json',
  pathParamSchema: knowledgePathParams,
  queryParamSchema: knowledgeTreeQuerySchema,
  responseSchema: knowledgeTreeResponseSchema,
  summary: 'List one level of the Knowledge page tree',
  description:
    'Without parentId, returns the root scopes. With parentId, returns its child scopes (first page only) then its child pages in order, paged with cursor.',
  tags: ['Knowledge'],
  requiresAuth: true,
  handler: async ({ mastra, requestContext, knowledgeKey, parentId, cursor, limit }) => {
    try {
      const { instance, store, read, readers } = await resolveStore(mastra, requestContext, knowledgeKey);
      const level = await readers.listKnowledgeTreeChildren(store, { parentId: parentId ?? null, read, cursor, limit });
      return { ...level, pages: level.pages.map(page => withDisplayLabel(instance, page)) };
    } catch (error) {
      return handleError(error, 'Error reading Knowledge tree');
    }
  },
});

export const GET_KNOWLEDGE_PAGE_ROUTE = createRoute({
  method: 'GET',
  path: '/knowledge/:knowledgeKey/pages/:pageId',
  responseType: 'json',
  pathParamSchema: knowledgePagePathParams,
  queryParamSchema: knowledgePageQuerySchema,
  responseSchema: knowledgePageResponseSchema,
  summary: 'Get a Knowledge page',
  description:
    'Returns one page with its ancestors, a page of its notes, its pin, the pages its notes reference and notes elsewhere that mention it; 404 when it does not exist',
  tags: ['Knowledge'],
  requiresAuth: true,
  handler: async ({ mastra, requestContext, knowledgeKey, pageId, noteCursor, noteLimit }) => {
    try {
      const { instance, store, read, readers } = await resolveStore(mastra, requestContext, knowledgeKey);
      const view = await readers.readKnowledgePage(store, { pageId, read, noteCursor, noteLimit });
      if (!view) throw new HTTPException(404, { message: 'Knowledge page not found' });
      const label = <T extends { isScope: boolean; declaration?: string }>(page: T) => withDisplayLabel(instance, page);
      return {
        ...view,
        page: label(view.page),
        ancestors: view.ancestors.map(label),
        related: view.related.map(label),
      };
    } catch (error) {
      return handleError(error, 'Error reading Knowledge page');
    }
  },
});

export const GET_KNOWLEDGE_GRAPH_ROUTE = createRoute({
  method: 'GET',
  path: '/knowledge/:knowledgeKey/graph',
  responseType: 'json',
  pathParamSchema: knowledgePathParams,
  queryParamSchema: knowledgeGraphQuerySchema,
  responseSchema: knowledgeGraphResponseSchema,
  summary: 'Get a bounded Knowledge page graph',
  description:
    'Returns pages under rootId (or every root scope) breadth-first with parent and mention edges, bounded; truncated is true when a limit stopped it. grants lists the declared access grants onto the scopes shown, from principal scopes the caller can read. 404 when rootId does not exist.',
  tags: ['Knowledge'],
  requiresAuth: true,
  handler: async ({ mastra, requestContext, knowledgeKey, rootId, maxPages }) => {
    try {
      const { instance, store, read, readers } = await resolveStore(mastra, requestContext, knowledgeKey);
      const graph = await readers.readKnowledgePageGraph(store, {
        read,
        rootId: rootId ?? null,
        ...(maxPages ? { limits: { maxPages } } : {}),
      });
      if (!graph) throw new HTTPException(404, { message: 'Knowledge page not found' });
      const grants = await graphGrants(instance, store, graph.pages, read);
      return {
        ...graph,
        pages: graph.pages.map(page => withDisplayLabel(instance, page)),
        ...(grants ? { grants } : {}),
      };
    } catch (error) {
      return handleError(error, 'Error reading Knowledge graph');
    }
  },
});

export const SEARCH_KNOWLEDGE_ROUTE = createRoute({
  method: 'GET',
  path: '/knowledge/:knowledgeKey/search',
  responseType: 'json',
  pathParamSchema: knowledgePathParams,
  queryParamSchema: knowledgeSearchQuerySchema,
  responseSchema: knowledgeSearchResponseSchema,
  summary: 'Search Knowledge pages and notes',
  description: 'Returns pages whose name, synopsis or body, and notes whose text, match the query',
  tags: ['Knowledge'],
  requiresAuth: true,
  handler: async ({ mastra, requestContext, knowledgeKey, q, scopeId, limit }) => {
    try {
      const { instance, store, read, readers } = await resolveStore(mastra, requestContext, knowledgeKey);
      const results = await readers.searchKnowledgeExplorerPages(store, {
        query: q,
        read,
        ...(scopeId?.length ? { scopeIds: scopeId } : {}),
        limit,
      });
      return { results: results.map(hit => ({ ...hit, page: withDisplayLabel(instance, hit.page) })) };
    } catch (error) {
      return handleError(error, 'Error searching Knowledge');
    }
  },
});

export const GET_KNOWLEDGE_ACTIVITY_ROUTE = createRoute({
  method: 'GET',
  path: '/knowledge/:knowledgeKey/activity',
  responseType: 'json',
  pathParamSchema: knowledgePathParams,
  queryParamSchema: knowledgeActivityQuerySchema,
  responseSchema: knowledgeActivityResponseSchema,
  summary: 'List recent Knowledge activity',
  description: 'Returns a newest-first page of activity, optionally for one scope or one page',
  tags: ['Knowledge'],
  requiresAuth: true,
  handler: async ({ mastra, requestContext, knowledgeKey, scopeId, pageId, cursor, limit }) => {
    try {
      const { store, read, readers } = await resolveStore(mastra, requestContext, knowledgeKey);
      return { ...(await readers.readKnowledgePageActivity(store, { read, scopeId, pageId, cursor, limit })) };
    } catch (error) {
      return handleError(error, 'Error reading Knowledge activity');
    }
  },
});

const KEEPALIVE_MS = 25_000;
/**
 * The read scope is resolved when the stream opens. Ending it after this long makes the client reconnect,
 * which resolves the caller's read scope again, so a revoked grant stops receiving changes.
 */
const STREAM_MAX_AGE_MS = 5 * 60_000;

/**
 * What a viewer may learn about one change: the ids in it they can read, or nothing when they can read
 * none. A page they can read now, or the scope it is (or was, before a move or merge) in, counts; a
 * deleted page is matched by its scope.
 */
async function visibleChange(store: KnowledgeStorage, read: KnowledgeReadScope, event: KnowledgeChangeEvent) {
  const readable = async (id: string | undefined) =>
    id !== undefined && (read === 'all' || (await store.getPage({ id, read })) !== null);
  const scopeId = 'scopeId' in event ? event.scopeId : undefined;
  const fromScopeId = 'fromScopeId' in event ? event.fromScopeId : undefined;
  const [page, scope, fromScope] = await Promise.all([
    readable(event.pageId),
    readable(scopeId),
    readable(fromScopeId),
  ]);
  if (!page && !scope && !fromScope) return null;
  return {
    kind: event.kind,
    op: event.op,
    ...(page ? { pageId: event.pageId } : {}),
    ...(scope ? { scopeId } : {}),
    at: event.at.toISOString(),
  };
}

export const STREAM_KNOWLEDGE_EVENTS_ROUTE = createRoute({
  method: 'GET',
  path: '/knowledge/:knowledgeKey/events',
  responseType: 'stream',
  streamFormat: 'sse',
  sseFlushOnConnect: true,
  pathParamSchema: knowledgePathParams,
  responseSchema: knowledgeEventsResponseSchema,
  summary: 'Stream Knowledge changes',
  description:
    'Server-Sent Events, one per committed write the caller can read: { kind, op, pageId?, scopeId?, at }. Ids the caller cannot read are left out, and changes they cannot read at all are not sent. Re-read what changed with the other Knowledge routes.',
  tags: ['Knowledge'],
  requiresAuth: true,
  handler: async ({ mastra, requestContext, knowledgeKey, abortSignal }) => {
    try {
      const { instance, store, read } = await resolveStore(mastra, requestContext, knowledgeKey);
      if (typeof instance.onChange !== 'function') {
        throw new HTTPException(501, { message: 'Knowledge change events need @mastra/core 1.81.0 or later.' });
      }
      const logger = mastra.getLogger();
      let stop = () => {};
      return new ReadableStream({
        start(controller) {
          let open = true;
          // Writes are filtered in order so a viewer never sees a later change before an earlier one.
          let queue = Promise.resolve();
          const unsubscribe = instance.onChange(event => {
            queue = queue.then(async () => {
              const change = await visibleChange(store, read, event).catch(error => {
                logger?.error('Error filtering a Knowledge change', { error });
                return null;
              });
              if (open && change) controller.enqueue(change);
            });
          });
          const keepalive = setInterval(() => open && controller.enqueue(': keepalive\n\n'), KEEPALIVE_MS);
          const expire = setTimeout(() => stop(), STREAM_MAX_AGE_MS);
          stop = () => {
            if (!open) return;
            open = false;
            clearInterval(keepalive);
            clearTimeout(expire);
            unsubscribe();
            try {
              controller.close();
            } catch {
              // Already closed
            }
          };
          if (abortSignal?.aborted) stop();
          else abortSignal?.addEventListener('abort', stop, { once: true });
        },
        cancel() {
          stop();
        },
      });
    } catch (error) {
      return handleError(error, 'Error streaming Knowledge changes');
    }
  },
});
