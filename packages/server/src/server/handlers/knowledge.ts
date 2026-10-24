import type { Mastra } from '@mastra/core/mastra';
import {
  knowledgeSearchHit,
  readKnowledgeActivity,
  readKnowledgeGraph,
  readKnowledgeNode,
  searchKnowledgeNodes,
} from '@mastra/core/knowledge';
import { canonicalizeKnowledgeScope } from '@mastra/core/storage';
import type { KnowledgeScope, KnowledgeStorage } from '@mastra/core/storage';
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
 * The viewer chooses the scope. That is intended for a developer tool that already trusts its operator with the
 * instance; hosts that need per-user scoping (Factory) serve their own routes and do not mount these.
 */

async function resolveStore(
  mastra: Mastra,
  knowledgeKey: string | undefined,
  scope: string[],
): Promise<{ store: KnowledgeStorage; view: KnowledgeScope }> {
  const instance = knowledgeKey ? mastra.listKnowledge()[knowledgeKey] : undefined;
  if (!instance) throw new HTTPException(404, { message: `Knowledge ${knowledgeKey ?? ''} not found` });
  let view: KnowledgeScope;
  try {
    view = canonicalizeKnowledgeScope(scope);
  } catch (error) {
    throw new HTTPException(400, { message: error instanceof Error ? error.message : 'Invalid scope' });
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
  handler: async ({ mastra }) => {
    try {
      return {
        instances: Object.entries(mastra.listKnowledge()).map(([key, instance]) => ({ key, id: instance.id })),
      };
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
  handler: async ({ mastra, knowledgeKey, scope }) => {
    try {
      const { store, view } = await resolveStore(mastra, knowledgeKey, scope);
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
  handler: async ({ mastra, knowledgeKey, nodeId, scope }) => {
    try {
      const { store, view } = await resolveStore(mastra, knowledgeKey, scope);
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
  handler: async ({ mastra, knowledgeKey, scope, q }) => {
    try {
      const { store, view } = await resolveStore(mastra, knowledgeKey, scope);
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
  handler: async ({ mastra, knowledgeKey, scope, cursor, limit }) => {
    try {
      const { store, view } = await resolveStore(mastra, knowledgeKey, scope);
      return { ...(await readKnowledgeActivity(store, view, { cursor, limit })) };
    } catch (error) {
      return handleError(error, 'Error reading Knowledge activity');
    }
  },
});
