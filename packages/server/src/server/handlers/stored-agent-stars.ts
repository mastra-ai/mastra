import { HTTPException } from '../http-exception';
import { starToggleResponseSchema } from '../schemas/stars';
import { storedAgentIdPathParams } from '../schemas/stored-agents';
import { createRoute } from '../server-adapter/routes/route-builder';

import { assertReadAccess, getCallerAuthorId } from './authorship';
import { requireBuilderFeature } from './editor-builder';
import { handleError } from './error';

/**
 * Resolves the storage and stars domains, throwing 500 if unavailable.
 */
async function getStarsContext(mastra: Parameters<typeof requireBuilderFeature>[0]) {
  const storage = mastra.getStorage();
  if (!storage) {
    throw new HTTPException(500, { message: 'Storage is not configured' });
  }
  const agentStore = await storage.getStore('agents');
  if (!agentStore) {
    throw new HTTPException(500, { message: 'Agents storage domain is not available' });
  }
  const starsStore = await storage.getStore('stars');
  if (!starsStore) {
    throw new HTTPException(500, { message: 'Stars storage domain is not available' });
  }
  return { agentStore, starsStore };
}

/**
 * PUT /stored/agents/:storedAgentId/star
 */
export const STAR_STORED_AGENT_ROUTE = createRoute({
  method: 'PUT',
  path: '/stored/agents/:storedAgentId/star',
  responseType: 'json',
  pathParamSchema: storedAgentIdPathParams,
  responseSchema: starToggleResponseSchema,
  summary: 'Star a stored agent',
  description: 'Marks the stored agent as starred by the calling user. Idempotent.',
  tags: ['Stored Agents'],
  requiresAuth: true,
  requiresPermission: 'stored-agents:read',
  handler: async ({ mastra, requestContext, storedAgentId }) => {
    try {
      await requireBuilderFeature(mastra, 'stars');

      const callerId = getCallerAuthorId(requestContext);
      if (!callerId) {
        throw new HTTPException(401, { message: 'Authentication required' });
      }

      const { agentStore, starsStore } = await getStarsContext(mastra);

      const agent = await agentStore.getById(storedAgentId);
      if (!agent) {
        throw new HTTPException(404, { message: `Stored agent with id ${storedAgentId} not found` });
      }

      // Throws 404 if the caller cannot read the agent (private + not owner/admin).
      assertReadAccess({ requestContext, resource: 'agents', resourceId: storedAgentId, record: agent });

      const result = await starsStore.star({
        userId: callerId,
        entityType: 'agent',
        entityId: storedAgentId,
      });
      return result;
    } catch (error) {
      return handleError(error, 'Error starring stored agent');
    }
  },
});

/**
 * DELETE /stored/agents/:storedAgentId/star
 */
export const UNSTAR_STORED_AGENT_ROUTE = createRoute({
  method: 'DELETE',
  path: '/stored/agents/:storedAgentId/star',
  responseType: 'json',
  pathParamSchema: storedAgentIdPathParams,
  responseSchema: starToggleResponseSchema,
  summary: 'Unstar a stored agent',
  description: 'Removes the caller’s star from the stored agent. Idempotent.',
  tags: ['Stored Agents'],
  requiresAuth: true,
  requiresPermission: 'stored-agents:read',
  handler: async ({ mastra, requestContext, storedAgentId }) => {
    try {
      await requireBuilderFeature(mastra, 'stars');

      const callerId = getCallerAuthorId(requestContext);
      if (!callerId) {
        throw new HTTPException(401, { message: 'Authentication required' });
      }

      const { agentStore, starsStore } = await getStarsContext(mastra);

      const agent = await agentStore.getById(storedAgentId);
      if (!agent) {
        throw new HTTPException(404, { message: `Stored agent with id ${storedAgentId} not found` });
      }

      assertReadAccess({ requestContext, resource: 'agents', resourceId: storedAgentId, record: agent });

      const result = await starsStore.unstar({
        userId: callerId,
        entityType: 'agent',
        entityId: storedAgentId,
      });
      return result;
    } catch (error) {
      return handleError(error, 'Error unstarring stored agent');
    }
  },
});
