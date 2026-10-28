import {
  knowledgeSearchHit,
  readKnowledgeActivity,
  readKnowledgeGraph,
  readKnowledgeNode,
  searchKnowledgeNodes,
} from '@mastra/core/knowledge';
import type { Mastra } from '@mastra/core/mastra';
import type { RequestContext } from '@mastra/core/request-context';
import { canonicalizeKnowledgeScope } from '@mastra/core/storage';
import type { KnowledgeScope, KnowledgeStorage } from '@mastra/core/storage';
import { MASTRA_KNOWLEDGE_SCOPE_KEY } from '../constants';
import { MastraFGAPermissions } from '../fga-permissions';
import { HTTPException } from '../http-exception';
import {
  knowledgeActivityQuerySchema,
  knowledgeActivityResponseSchema,
  knowledgeGraphResponseSchema,
  knowledgeNodePathParams,
  knowledgeNodeResponseSchema,
  knowledgePathParams,
  knowledgeSearchQuerySchema,
  knowledgeScopesResponseSchema,
  knowledgeSearchResponseSchema,
  knowledgeViewQuerySchema,
  listKnowledgeResponseSchema,
} from '../schemas/knowledge';
import { createRoute } from '../server-adapter/routes/route-builder';

import { handleError } from './error';

/**
 * Read-only browsing of Knowledge instances registered on Mastra. Every route takes the `scope` tags the viewer
 * holds and returns only what those tags can see; nothing here writes. Permissions derive from the path
 * (`GET /knowledge/...` -> `knowledge:read`).
 *
 * The viewer chooses the scope unless the app narrows it: the app may set the
 * request-context key `mastra__knowledgeScope` (MASTRA_KNOWLEDGE_SCOPE_KEY) to the tags a caller may hold, and a request for any tag outside
 * that set is a 403. With FGA configured, instances are filtered (and gated) by `knowledge:read`.
 * With RBAC or FGA configured, a caller with no bound scope is refused (403). With neither, any caller who passes `knowledge:read` can view any scope, which suits a developer tool
 * whose operator already controls the instance. Hosts with their own scoping (Factory) do not mount these.
 */

let warnedUnbound = false;

function hasAccessControl(mastra: Mastra): boolean {
  const server = mastra.getServer?.();
  const studio = (mastra as any).getStudio?.();
  return Boolean(server?.rbac || server?.fga || studio?.rbac || studio?.fga);
}

async function isInstanceAccessible(
  mastra: Mastra,
  requestContext: RequestContext | undefined,
  entries: Array<{ id: string; key: string }>,
): Promise<Set<string>> {
  const fgaProvider = (mastra as any).getServer?.()?.fga;
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

async function resolveInstance(
  mastra: Mastra,
  requestContext: RequestContext | undefined,
  knowledgeKey: string | undefined,
) {
  const instance = knowledgeKey ? mastra.listKnowledge()[knowledgeKey] : undefined;
  if (!knowledgeKey || !instance)
    throw new HTTPException(404, { message: `Knowledge ${knowledgeKey ?? ''} not found` });

  // An instance the caller may not read looks the same as one that does not exist.
  const fgaProvider = (mastra as any).getServer?.()?.fga;
  const user = requestContext?.get('user');
  if (fgaProvider && user && typeof user === 'object') {
    const allowed = await fgaProvider.check(user, {
      resource: { type: 'knowledge', id: instance.id },
      permission: MastraFGAPermissions.KNOWLEDGE_READ,
    });
    if (!allowed) throw new HTTPException(404, { message: `Knowledge ${knowledgeKey} not found` });
  }
  return instance;
}

/** The tags the caller may hold, or `undefined` when unbound and no access control is configured. */
function heldScope(mastra: Mastra, requestContext: RequestContext | undefined): Set<string> | undefined {
  // `!== undefined`, so an empty set fails closed instead of reading as unbound.
  const established = requestContext?.get(MASTRA_KNOWLEDGE_SCOPE_KEY);
  if (established !== undefined) {
    try {
      if (!Array.isArray(established)) throw new Error('Established Knowledge scope must be an array of tags');
      // An empty set is valid and permits nothing; the canonicalizer would reject it.
      return new Set(established.length === 0 ? [] : canonicalizeKnowledgeScope(established as string[]));
    } catch (error) {
      throw new HTTPException(400, { message: error instanceof Error ? error.message : 'Invalid established scope' });
    }
  }
  if (hasAccessControl(mastra)) {
    // An app that configured RBAC or FGA has said who may read what; an unbound scope would let any reader
    // name any tags, so refuse rather than trust the request.
    throw new HTTPException(403, {
      message: `Knowledge scope is not bound for this caller. Set request context key "${MASTRA_KNOWLEDGE_SCOPE_KEY}" in auth.authorize.`,
    });
  }
  if (requestContext?.get('user') && !warnedUnbound) {
    warnedUnbound = true;
    mastra
      .getLogger?.()
      ?.warn(
        `Knowledge routes trust the requested scope as sent. Bound it per caller by setting request context key "${MASTRA_KNOWLEDGE_SCOPE_KEY}" in server.auth.authorize (it runs after authentication; server.middleware does not).`,
      );
  }
  return undefined;
}

async function resolveStore(
  mastra: Mastra,
  requestContext: RequestContext | undefined,
  knowledgeKey: string | undefined,
  scope: string[],
): Promise<{ store: KnowledgeStorage; view: KnowledgeScope }> {
  const instance = await resolveInstance(mastra, requestContext, knowledgeKey);

  let view: KnowledgeScope;
  try {
    view = canonicalizeKnowledgeScope(scope);
  } catch (error) {
    throw new HTTPException(400, { message: error instanceof Error ? error.message : 'Invalid scope' });
  }

  const held = heldScope(mastra, requestContext);
  const outside = held ? view.filter(tag => !held.has(tag)) : [];
  if (outside.length > 0) {
    throw new HTTPException(403, { message: `Requested scope is outside the caller's scope: ${outside.join(', ')}` });
  }
  return { store: await instance.getStorage(), view };
}

export const LIST_KNOWLEDGE_ROUTE = createRoute({
  method: 'GET',
  path: '/knowledge',
  responseType: 'json',
  responseSchema: listKnowledgeResponseSchema,
  summary: 'List Knowledge instances',
  description:
    'Returns the Knowledge instances registered on this Mastra instance, by application key. The `scope` param on the other Knowledge routes is trusted as sent unless RBAC or FGA is configured, which refuses an unbound caller with 403. Bound it per caller by setting MASTRA_KNOWLEDGE_SCOPE_KEY in server.auth.authorize (it runs after authentication; server.middleware does not).',
  tags: ['Knowledge'],
  requiresAuth: true,
  handler: async ({ mastra, requestContext }) => {
    try {
      const all = Object.entries(mastra.listKnowledge()).map(([key, instance]) => ({ key, id: instance.id }));
      const allowed = await isInstanceAccessible(mastra, requestContext, all);
      return { instances: all.filter(entry => allowed.has(entry.key)) };
    } catch (error) {
      return handleError(error, 'Error listing Knowledge instances');
    }
  },
});

export const GET_KNOWLEDGE_GRAPH_ROUTE = createRoute({
  method: 'GET',
  path: '/knowledge/:knowledgeKey/graph',
  responseType: 'json',
  pathParamSchema: knowledgePathParams,
  queryParamSchema: knowledgeViewQuerySchema,
  responseSchema: knowledgeGraphResponseSchema,
  summary: 'Get a Knowledge graph window',
  description:
    'Returns the nodes, records and wikilink edges visible from the given scope tags, newest first and bounded',
  tags: ['Knowledge'],
  requiresAuth: true,
  handler: async ({ mastra, requestContext, knowledgeKey, scope }) => {
    try {
      const { store, view } = await resolveStore(mastra, requestContext, knowledgeKey, scope);
      return { ...(await readKnowledgeGraph(store, view)) };
    } catch (error) {
      return handleError(error, 'Error reading Knowledge graph');
    }
  },
});

export const GET_KNOWLEDGE_NODE_ROUTE = createRoute({
  method: 'GET',
  path: '/knowledge/:knowledgeKey/nodes/:nodeId',
  responseType: 'json',
  pathParamSchema: knowledgeNodePathParams,
  queryParamSchema: knowledgeViewQuerySchema,
  responseSchema: knowledgeNodeResponseSchema,
  summary: 'Get a Knowledge node',
  description: 'Returns one node and its records when it is visible from the given scope tags, otherwise 404',
  tags: ['Knowledge'],
  requiresAuth: true,
  handler: async ({ mastra, requestContext, knowledgeKey, nodeId, scope }) => {
    try {
      const { store, view } = await resolveStore(mastra, requestContext, knowledgeKey, scope);
      const payload = await readKnowledgeNode(store, view, nodeId);
      if (!payload) throw new HTTPException(404, { message: 'Knowledge node not found' });
      return { ...payload };
    } catch (error) {
      return handleError(error, 'Error reading Knowledge node');
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
  summary: 'Search Knowledge nodes by name',
  description: 'Returns nodes visible from the given scope tags whose name contains the query, exact matches first',
  tags: ['Knowledge'],
  requiresAuth: true,
  handler: async ({ mastra, requestContext, knowledgeKey, scope, q }) => {
    try {
      const { store, view } = await resolveStore(mastra, requestContext, knowledgeKey, scope);
      const { nodes, truncated } = await searchKnowledgeNodes(store, view, q);
      return { results: nodes.map(node => ({ ...knowledgeSearchHit(node) })), truncated };
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
  description: 'Returns a newest-first page of activity on nodes visible from the given scope tags',
  tags: ['Knowledge'],
  requiresAuth: true,
  handler: async ({ mastra, requestContext, knowledgeKey, scope, cursor, limit }) => {
    try {
      const { store, view } = await resolveStore(mastra, requestContext, knowledgeKey, scope);
      return { ...(await readKnowledgeActivity(store, view, { cursor, limit })) };
    } catch (error) {
      return handleError(error, 'Error reading Knowledge activity');
    }
  },
});

export const LIST_KNOWLEDGE_SCOPES_ROUTE = createRoute({
  method: 'GET',
  path: '/knowledge/:knowledgeKey/scopes',
  responseType: 'json',
  pathParamSchema: knowledgePathParams,
  responseSchema: knowledgeScopesResponseSchema,
  summary: 'List Knowledge scope tag sets',
  description:
    'Returns the distinct scope tag sets carried by live nodes and records, with counts. A caller with a bound scope sees only the sets inside it.',
  tags: ['Knowledge'],
  requiresAuth: true,
  handler: async ({ mastra, requestContext, knowledgeKey }) => {
    try {
      const instance = await resolveInstance(mastra, requestContext, knowledgeKey);
      const held = heldScope(mastra, requestContext);
      if (held?.size === 0) return { sets: [], truncated: false };
      const store = await instance.getStorage();
      return { ...(await store.listScopeSets(held ? { within: [...held] } : {})) };
    } catch (error) {
      return handleError(error, 'Error listing Knowledge scopes');
    }
  },
});
