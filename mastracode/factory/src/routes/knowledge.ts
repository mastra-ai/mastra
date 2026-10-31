/**
 * Read-only Mastra `apiRoutes` behind Factory's Knowledge page: the schema-4 page tree, a page with its
 * notes, the bounded page graph, search and activity, all through the same core page readers Studio uses,
 * plus a change stream (`/events`, SSE) naming the pages and scopes each committed write touched.
 * Every endpoint is a GET; this module never writes Knowledge.
 *
 * Scoping is fail-closed and server-side. The caller must be signed in to an org that owns the `:id`
 * project, and reads are limited to what the Knowledge's own declarations give the principals
 * `org:<orgId>` and `project:<projectId>`: the scopes a run in that project holds at org and project
 * level. Session (`resource:`/`thread:`) scopes are not principals here, so no member browses another
 * member's session pages. The host must declare `project:$projectId` (as its session runs need); without
 * it reads fail with 500 `knowledge_misconfigured`.
 */

import type { Knowledge, KnowledgeChangeEvent } from '@mastra/core/knowledge';
import {
  KnowledgeDeclarationError,
  listKnowledgeTreeChildren,
  readKnowledgePage,
  readKnowledgePageActivity,
  readKnowledgePageGraph,
  readKnowledgeScopeGrants,
  searchKnowledgeExplorerPages,
} from '@mastra/core/knowledge';
import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { KnowledgeReadScope, KnowledgeStorage } from '@mastra/core/storage';
import type { Context } from 'hono';
import { streamSSE } from 'hono/streaming';

import type { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { RouteDependencies } from './route.js';
import { Route } from './route.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Ids and cursors are opaque, but bounded so an unbounded query string never reaches storage. */
const ID_LIMIT = 256;
const SEARCH_QUERY_LIMIT = 128;
const MAX_PAGE_LIMIT = 100;
const MAX_GRAPH_PAGES = 500;
/** Comment frames only: proxies drop an idle stream. */
const EVENTS_KEEPALIVE_MS = 25_000;
/**
 * The read scope is resolved when the stream opens. Closing it after this long makes the browser reconnect,
 * which re-checks membership and the read scope, so a revoked member stops hearing about changes.
 */
const EVENTS_MAX_AGE_MS = 5 * 60_000;

export interface KnowledgeRoutesDeps extends RouteDependencies {
  /** Factory projects domain: validates that the `:id` project belongs to the caller's org. */
  projects: FactoryProjectsStorage;
  /** Lazy handle to the host-registered Knowledge runtime; endpoints 503 when absent. */
  knowledge: (key: string) => Promise<Knowledge | undefined>;
  /** Host-selected Knowledge key. Requests cannot override it. */
  defaultKnowledgeKey?: string;
}

interface ResolvedView {
  knowledge: Knowledge;
  store: KnowledgeStorage;
  read: KnowledgeReadScope;
}

function boundedId(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= ID_LIMIT ? trimmed : undefined;
}

function boundedLimit(value: string | undefined, max: number): number | undefined | null {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= max ? parsed : null;
}

/**
 * The ids of a change this caller may see, or null when they may see none of it. Events carry ids only, so
 * readability is checked against the store now: a page moved out of reach is withheld, but the scope it
 * left still tells the caller to refresh.
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

type LabelablePage = { isScope: boolean; address?: string };

/**
 * Adds a scope page's declared `displayLabel` with the address's `$params` filled in (`'$orgId policy'`
 * → `'acme policy'`); declarations live in config, not storage.
 */
function withDisplayLabel<T extends LabelablePage>(knowledge: Knowledge, page: T): T & { displayLabel?: string } {
  if (!page.isScope || !page.address) return page;
  const displayLabel = knowledge.scopeLabel(page.address);
  return displayLabel ? { ...page, displayLabel } : page;
}

function loose(c: unknown): Context {
  return c as Context;
}

export class KnowledgeRoutes extends Route<KnowledgeRoutesDeps> {
  /** Tenant, org-owned project, Knowledge runtime and the caller's read scope: the one seam every route shares. */
  async #resolveView(c: Context): Promise<ResolvedView | { response: Response }> {
    await this.deps.auth.ensureUser(c);
    const tenant = this.deps.auth.tenant(c);
    if (!tenant) return { response: c.json({ error: 'unauthorized' }, 401) };
    if (!tenant.orgId) {
      return {
        response: c.json({ error: 'organization_required', message: 'Knowledge requires an organization.' }, 403),
      };
    }

    const projectId = c.req.param('id');
    if (!projectId || !UUID_RE.test(projectId)) return { response: c.json({ error: 'Project not found' }, 404) };
    await this.deps.projects.ensureReady();
    const project = await this.deps.projects.get({ orgId: tenant.orgId, id: projectId });
    if (!project) return { response: c.json({ error: 'Project not found' }, 404) };

    let knowledge: Knowledge | undefined;
    let store: KnowledgeStorage | undefined;
    try {
      knowledge = await this.deps.knowledge(this.deps.defaultKnowledgeKey ?? 'default');
      store = knowledge ? await knowledge.getStorage() : undefined;
    } catch {
      store = undefined;
    }
    if (!knowledge || !store) {
      return {
        response: c.json(
          { error: 'knowledge_unavailable', message: 'The configured Knowledge runtime is unavailable.' },
          503,
        ),
      };
    }
    try {
      return { knowledge, store, read: await knowledge.readScopeFor([`org:${tenant.orgId}`, `project:${projectId}`]) };
    } catch (error) {
      // The host's Knowledge does not declare the scopes a Factory run holds (`org:` and `project:`): a
      // deployment misconfiguration, which its session runs hit too. Never fall back to a guessed scope.
      if (error instanceof KnowledgeDeclarationError) {
        return { response: c.json({ error: 'knowledge_misconfigured', message: error.message }, 500) };
      }
      throw error;
    }
  }

  routes(): ApiRoute[] {
    const badRequest = (c: Context, message: string) => c.json({ error: 'bad_request', message }, 400);
    return [
      registerApiRoute('/web/factory/projects/:id/knowledge/tree', {
        method: 'GET',
        requiresAuth: false,
        handler: async raw => {
          const c = loose(raw);
          const view = await this.#resolveView(c);
          if ('response' in view) return view.response;
          const parentId = boundedId(c.req.query('parentId'));
          const cursor = boundedId(c.req.query('cursor'));
          const limit = boundedLimit(c.req.query('limit'), MAX_PAGE_LIMIT);
          if (limit === null) return badRequest(c, `limit must be an integer from 1 to ${MAX_PAGE_LIMIT}.`);
          const level = await listKnowledgeTreeChildren(view.store, {
            parentId: parentId ?? null,
            read: view.read,
            cursor,
            limit,
          });
          return c.json({ ...level, pages: level.pages.map(page => withDisplayLabel(view.knowledge, page)) });
        },
      }),
      registerApiRoute('/web/factory/projects/:id/knowledge/pages/:pageId', {
        method: 'GET',
        requiresAuth: false,
        handler: async raw => {
          const c = loose(raw);
          const view = await this.#resolveView(c);
          if ('response' in view) return view.response;
          const pageId = boundedId(c.req.param('pageId'));
          if (!pageId) return c.json({ error: 'page_not_found' }, 404);
          const noteLimit = boundedLimit(c.req.query('noteLimit'), MAX_PAGE_LIMIT);
          if (noteLimit === null) return badRequest(c, `noteLimit must be an integer from 1 to ${MAX_PAGE_LIMIT}.`);
          const page = await readKnowledgePage(view.store, {
            pageId,
            read: view.read,
            noteCursor: boundedId(c.req.query('noteCursor')),
            noteLimit,
          });
          if (!page) return c.json({ error: 'page_not_found' }, 404);
          const label = <T extends LabelablePage>(entry: T) => withDisplayLabel(view.knowledge, entry);
          return c.json({
            ...page,
            page: label(page.page),
            ancestors: page.ancestors.map(label),
            related: page.related.map(label),
          });
        },
      }),
      registerApiRoute('/web/factory/projects/:id/knowledge/graph', {
        method: 'GET',
        requiresAuth: false,
        handler: async raw => {
          const c = loose(raw);
          const view = await this.#resolveView(c);
          if ('response' in view) return view.response;
          const maxPages = boundedLimit(c.req.query('maxPages'), MAX_GRAPH_PAGES);
          if (maxPages === null) return badRequest(c, `maxPages must be an integer from 1 to ${MAX_GRAPH_PAGES}.`);
          const graph = await readKnowledgePageGraph(view.store, {
            read: view.read,
            rootId: boundedId(c.req.query('rootId')) ?? null,
            ...(maxPages ? { limits: { maxPages } } : {}),
          });
          if (!graph) return c.json({ error: 'page_not_found' }, 404);
          // Declared grants between the scopes shown, limited to principal scopes this caller can read.
          const grants = await readKnowledgeScopeGrants(view.store, {
            pages: graph.pages,
            read: view.read,
            grantsFor: scope => view.knowledge.scopeGrants(scope),
          });
          return c.json({
            ...graph,
            pages: graph.pages.map(page => withDisplayLabel(view.knowledge, page)),
            grants: grants.map(grant => {
              const principalLabel = view.knowledge.scopeLabel(grant.principal);
              return principalLabel ? { ...grant, principalLabel } : grant;
            }),
          });
        },
      }),
      registerApiRoute('/web/factory/projects/:id/knowledge/search', {
        method: 'GET',
        requiresAuth: false,
        handler: async raw => {
          const c = loose(raw);
          const view = await this.#resolveView(c);
          if ('response' in view) return view.response;
          const query = (c.req.query('q') ?? '').trim();
          if (!query) return c.json({ results: [] });
          if (query.length > SEARCH_QUERY_LIMIT) {
            return badRequest(c, `q must be at most ${SEARCH_QUERY_LIMIT} characters.`);
          }
          const limit = boundedLimit(c.req.query('limit'), MAX_PAGE_LIMIT);
          if (limit === null) return badRequest(c, `limit must be an integer from 1 to ${MAX_PAGE_LIMIT}.`);
          const scopeIds = c.req.queries('scopeId')?.flatMap(id => boundedId(id) ?? []);
          const results = await searchKnowledgeExplorerPages(view.store, {
            query,
            read: view.read,
            ...(scopeIds?.length ? { scopeIds } : {}),
            limit,
          });
          return c.json({
            results: results.map(hit => ({ ...hit, page: withDisplayLabel(view.knowledge, hit.page) })),
          });
        },
      }),
      registerApiRoute('/web/factory/projects/:id/knowledge/events', {
        method: 'GET',
        requiresAuth: false,
        handler: async raw => {
          const c = loose(raw);
          const view = await this.#resolveView(c);
          if ('response' in view) return view.response;
          const { knowledge, store, read } = view;
          return streamSSE(c, async stream => {
            const closed = new Promise<void>(resolve => stream.onAbort(resolve));
            // Filtering reads the store, so changes are queued to keep them in commit order.
            let queue = Promise.resolve();
            const unsubscribe = knowledge.onChange(event => {
              queue = queue.then(async () => {
                if (stream.aborted) return;
                const change = await visibleChange(store, read, event).catch(() => null);
                if (!change || stream.aborted) return;
                try {
                  await stream.writeSSE({ event: 'change', data: JSON.stringify(change) });
                } catch {
                  // The tab went away mid-write; abort cleans up.
                }
              });
            });
            const keepalive = setInterval(() => {
              if (!stream.aborted) void stream.write(': ping\n\n');
            }, EVENTS_KEEPALIVE_MS);
            let expire: ReturnType<typeof setTimeout> | undefined;
            try {
              await stream.write(': connected\n\n');
              // `streamSSE` closes the stream the moment this callback returns.
              await Promise.race([
                closed,
                new Promise<void>(resolve => (expire = setTimeout(resolve, EVENTS_MAX_AGE_MS))),
              ]);
            } finally {
              clearTimeout(expire);
              clearInterval(keepalive);
              unsubscribe();
            }
          });
        },
      }),
      registerApiRoute('/web/factory/projects/:id/knowledge/activity', {
        method: 'GET',
        requiresAuth: false,
        handler: async raw => {
          const c = loose(raw);
          const view = await this.#resolveView(c);
          if ('response' in view) return view.response;
          const limit = boundedLimit(c.req.query('limit'), MAX_PAGE_LIMIT);
          if (limit === null) return badRequest(c, `limit must be an integer from 1 to ${MAX_PAGE_LIMIT}.`);
          return c.json(
            await readKnowledgePageActivity(view.store, {
              read: view.read,
              scopeId: boundedId(c.req.query('scopeId')),
              pageId: boundedId(c.req.query('pageId')),
              cursor: boundedId(c.req.query('cursor')),
              limit,
            }),
          );
        },
      }),
    ];
  }
}
