import type { Mastra } from '@mastra/core/mastra';
import type { RequestContext } from '@mastra/core/request-context';
import {
  knowledgeSearchHit,
  readKnowledgeActivity,
  readKnowledgeGraph,
  readKnowledgeNode,
  searchKnowledgeNodes,
} from '@mastra/core/knowledge';
import { canonicalizeKnowledgeScope } from '@mastra/core/storage';
import type { KnowledgeScope, KnowledgeStorage } from '@mastra/core/storage';
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
 * The viewer chooses the scope unless the app narrows it: server middleware may set the
 * `requestContext` key `knowledgeScope` to the tags a caller may hold, and a request for any tag outside
 * that set is a 403. With FGA configured, instances are filtered (and gated) by `knowledge:read`.
 * Without either, any caller who passes `knowledge:read` can view any scope, which suits a developer tool
 * whose operator already controls the instance. Hosts with their own scoping (Factory) do not mount these.
 */

/** The request-context key an app's server middleware sets to the scope tags the caller may view through. */
export const KNOWLEDGE_SCOPE_CONTEXT_KEY = 'knowledgeScope';

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

async function resolveStore(
  mastra: Mastra,
  requestContext: RequestContext | undefined,
  knowledgeKey: string | undefined,
  scope: string[],
): Promise<{ store: KnowledgeStorage; view: KnowledgeScope }> {
  const instance = knowledgeKey ? mastra.listKnowledge()[knowledgeKey] : undefined;
  // An instance the caller may not read looks the same as one that does not exist.
  if (
    !knowledgeKey ||
    !instance ||
    !(await isInstanceAccessible(mastra, requestContext, [{ id: instance.id, key: knowledgeKey }])).has(knowledgeKey)
  ) {
    throw new HTTPException(404, { message: `Knowledge ${knowledgeKey ?? ''} not found` });
  }
  let view: KnowledgeScope;
  try {
    view = canonicalizeKnowledgeScope(scope);
  } catch (error) {
    throw new HTTPException(400, { message: error instanceof Error ? error.message : 'Invalid scope' });
  }
  // When the app has set the tags this caller may hold, the requested view must stay inside them.
  const allowed = requestContext?.get(KNOWLEDGE_SCOPE_CONTEXT_KEY);
  if (allowed !== undefined) {
    const held = new Set(Array.isArray(allowed) ? (allowed as unknown[]).map(String) : []);
    if (!view.every(tag => held.has(tag))) {
      throw new HTTPException(403, { message: 'Requested scope is outside the scope this caller may view' });
    }
  }
  return { store: await instance.getStorage(), view };
}

export const LIST_KNOWLEDGE_ROUTE = createRoute({
  method: 'GET',
  path: '/knowledge',
  responseType: 'json',
  responseSchema: listKnowledgeResponseSchema,
  summary: 'List Knowledge instances',
  description: 'Returns the Knowledge instances registered on this Mastra instance, by application key',
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
