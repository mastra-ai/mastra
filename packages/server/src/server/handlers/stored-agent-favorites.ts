import { SERVER_ERROR_CODES } from '../error-codes';
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
    throw new HTTPException(500, {
      message: 'Storage is not configured',
      code: SERVER_ERROR_CODES.STORAGE_NOT_CONFIGURED,
    });
  }
  const agentStore = await storage.getStore('agents');
  if (!agentStore) {
    throw new HTTPException(500, {
      message: 'Agents storage domain is not available',
      code: SERVER_ERROR_CODES.STORED_AGENT_STORAGE_DOMAIN_UNAVAILABLE,
    });
  }
  const favoritesStore = await storage.getStore('favorites');
  if (!favoritesStore) {
    throw new HTTPException(500, {
      message: 'Favorites storage domain is not available',
      code: SERVER_ERROR_CODES.FAVORITES_STORAGE_DOMAIN_UNAVAILABLE,
    });
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
  errors: [
    'AGENT_BUILDER_NOT_ENABLED',
    'FAVORITES_STORAGE_DOMAIN_UNAVAILABLE',
    'STORAGE_NOT_CONFIGURED',
    'STORED_AGENT_FAVORITE_FAILED',
    'STORED_AGENT_NOT_FOUND',
    'STORED_AGENT_STORAGE_DOMAIN_UNAVAILABLE',
    'STORED_RESOURCE_NOT_FOUND',
    'STORED_RESOURCE_SCOPE_REQUIRED',
  ],
  handler: async ({ mastra, requestContext, storedAgentId }) => {
    try {
      await requireBuilderFeature(mastra, 'favorites');

      const callerId = getCallerAuthorId(requestContext);
      if (!callerId) {
        throw new HTTPException(401, {
          message: 'Authentication required',
          code: SERVER_ERROR_CODES.AUTHENTICATION_REQUIRED,
        });
      }

      const { agentStore, favoritesStore } = await getFavoritesContext(mastra);

      const agent = await agentStore.getById(storedAgentId);
      if (!agent) {
        throw new HTTPException(404, {
          message: `Stored agent with id ${storedAgentId} not found`,
          code: SERVER_ERROR_CODES.STORED_AGENT_NOT_FOUND,
          metadata: { storedAgentId },
        });
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
      return handleError(error, {
        message: 'Error favoriting stored agent',
        code: SERVER_ERROR_CODES.STORED_AGENT_FAVORITE_FAILED,
      });
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
  errors: [
    'AGENT_BUILDER_NOT_ENABLED',
    'FAVORITES_STORAGE_DOMAIN_UNAVAILABLE',
    'STORAGE_NOT_CONFIGURED',
    'STORED_AGENT_NOT_FOUND',
    'STORED_AGENT_STORAGE_DOMAIN_UNAVAILABLE',
    'STORED_AGENT_UNFAVORITE_FAILED',
    'STORED_RESOURCE_NOT_FOUND',
    'STORED_RESOURCE_SCOPE_REQUIRED',
  ],
  handler: async ({ mastra, requestContext, storedAgentId }) => {
    try {
      await requireBuilderFeature(mastra, 'favorites');

      const callerId = getCallerAuthorId(requestContext);
      if (!callerId) {
        throw new HTTPException(401, {
          message: 'Authentication required',
          code: SERVER_ERROR_CODES.AUTHENTICATION_REQUIRED,
        });
      }

      const { agentStore, favoritesStore } = await getFavoritesContext(mastra);

      const agent = await agentStore.getById(storedAgentId);
      if (!agent) {
        throw new HTTPException(404, {
          message: `Stored agent with id ${storedAgentId} not found`,
          code: SERVER_ERROR_CODES.STORED_AGENT_NOT_FOUND,
          metadata: { storedAgentId },
        });
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
      return handleError(error, {
        message: 'Error unfavoriting stored agent',
        code: SERVER_ERROR_CODES.STORED_AGENT_UNFAVORITE_FAILED,
      });
    }
  },
});
