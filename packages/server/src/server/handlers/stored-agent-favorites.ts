import { HTTPException } from '../http-exception';
import { favoriteToggleResponseSchema } from '../schemas/favorites';
import { storedAgentIdPathParams } from '../schemas/stored-agents';
import { createRoute } from '../server-adapter/routes/route-builder';
import { assertStoredResourceScope, getStoredResourceScope } from '../utils';

import { assertReadAccess, getCallerAuthorId } from './authorship';
import { requireBuilderFeature } from './editor-builder';
import { handleError } from './error';

/**
 * Resolves the storage and favorites domains, throwing 500 if unavailable.
 */
async function getFavoritesContext(mastra: Parameters<typeof requireBuilderFeature>[0]) {
  const storage = mastra.getStorage();
  if (!storage) {
    throw new HTTPException(500, { message: 'Storage is not configured' });
  }
  const agentStore = await storage.getStore('agents');
  if (!agentStore) {
    throw new HTTPException(500, { message: 'Agents storage domain is not available' });
  }
  const favoritesStore = await storage.getStore('favorites');
  if (!favoritesStore) {
    throw new HTTPException(500, { message: 'Favorites storage domain is not available' });
  }
  return { agentStore, favoritesStore };
}

/**
 * PUT /stored/agents/:storedAgentId/favorite
 */
export const FAVORITE_STORED_AGENT_ROUTE = createRoute({
  method: 'PUT',
  path: '/stored/agents/:storedAgentId/favorite',
  responseType: 'json',
  pathParamSchema: storedAgentIdPathParams,
  responseSchema: favoriteToggleResponseSchema,
  summary: 'Favorite a stored agent',
  description: 'Marks the stored agent as favorited by the calling user. Idempotent.',
  tags: ['Stored Agents'],
  requiresAuth: true,
  requiresPermission: 'stored-agents:read',
  handler: async ({ mastra, requestContext, storedAgentId }) => {
    try {
      await requireBuilderFeature(mastra, 'favorites');

      const callerId = getCallerAuthorId(requestContext);
      if (!callerId) {
        throw new HTTPException(401, { message: 'Authentication required' });
      }

      const { agentStore, favoritesStore } = await getFavoritesContext(mastra);

      const agent = await agentStore.getById(storedAgentId);
      if (!agent) {
        throw new HTTPException(404, { message: `Stored agent with id ${storedAgentId} not found` });
      }
      assertStoredResourceScope(agent, await getStoredResourceScope(mastra, requestContext));

      // Throws 404 if the caller cannot read the agent (private + not owner/admin).
      assertReadAccess({ requestContext, resource: 'stored-agents', resourceId: storedAgentId, record: agent });

      const result = await favoritesStore.favorite({
        userId: callerId,
        entityType: 'agent',
        entityId: storedAgentId,
      });
      return result;
    } catch (error) {
      return handleError(error, 'Error favoriting stored agent');
    }
  },
});

/**
 * DELETE /stored/agents/:storedAgentId/favorite
 */
export const UNFAVORITE_STORED_AGENT_ROUTE = createRoute({
  method: 'DELETE',
  path: '/stored/agents/:storedAgentId/favorite',
  responseType: 'json',
  pathParamSchema: storedAgentIdPathParams,
  responseSchema: favoriteToggleResponseSchema,
  summary: 'Unfavorite a stored agent',
  description: 'Removes the caller’s favorite from the stored agent. Idempotent.',
  tags: ['Stored Agents'],
  requiresAuth: true,
  requiresPermission: 'stored-agents:read',
  handler: async ({ mastra, requestContext, storedAgentId }) => {
    try {
      await requireBuilderFeature(mastra, 'favorites');

      const callerId = getCallerAuthorId(requestContext);
      if (!callerId) {
        throw new HTTPException(401, { message: 'Authentication required' });
      }

      const { agentStore, favoritesStore } = await getFavoritesContext(mastra);

      const agent = await agentStore.getById(storedAgentId);
      if (!agent) {
        throw new HTTPException(404, { message: `Stored agent with id ${storedAgentId} not found` });
      }
      assertStoredResourceScope(agent, await getStoredResourceScope(mastra, requestContext));

      assertReadAccess({ requestContext, resource: 'stored-agents', resourceId: storedAgentId, record: agent });

      const result = await favoritesStore.unfavorite({
        userId: callerId,
        entityType: 'agent',
        entityId: storedAgentId,
      });
      return result;
    } catch (error) {
      return handleError(error, 'Error unfavoriting stored agent');
    }
  },
});
