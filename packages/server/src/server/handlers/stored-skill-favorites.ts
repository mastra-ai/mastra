import { HTTPException } from '../http-exception';
import { favoriteToggleResponseSchema } from '../schemas/favorites';
import { storedSkillIdPathParams } from '../schemas/stored-skills';
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
  const skillStore = await storage.getStore('skills');
  if (!skillStore) {
    throw new HTTPException(500, { message: 'Skills storage domain is not available' });
  }
  const favoritesStore = await storage.getStore('favorites');
  if (!favoritesStore) {
    throw new HTTPException(500, { message: 'Favorites storage domain is not available' });
  }
  return { skillStore, favoritesStore };
}

/**
 * PUT /stored/skills/:storedSkillId/favorite
 */
export const FAVORITE_STORED_SKILL_ROUTE = createRoute({
  method: 'PUT',
  path: '/stored/skills/:storedSkillId/favorite',
  responseType: 'json',
  pathParamSchema: storedSkillIdPathParams,
  responseSchema: favoriteToggleResponseSchema,
  summary: 'Favorite a stored skill',
  description: 'Marks the stored skill as favorited by the calling user. Idempotent.',
  tags: ['Stored Skills'],
  requiresAuth: true,
  requiresPermission: 'stored-skills:read',
  handler: async ({ mastra, requestContext, storedSkillId }) => {
    try {
      await requireBuilderFeature(mastra, 'favorites');

      const callerId = getCallerAuthorId(requestContext);
      if (!callerId) {
        throw new HTTPException(401, { message: 'Authentication required' });
      }

      const { skillStore, favoritesStore } = await getFavoritesContext(mastra);

      const skill = await skillStore.getByIdResolved(storedSkillId);
      if (!skill) {
        throw new HTTPException(404, { message: `Stored skill with id ${storedSkillId} not found` });
      }
      assertStoredResourceScope(skill, await getStoredResourceScope(mastra, requestContext));

      // Throws 404 if the caller cannot read the skill (private + not owner/admin).
      assertReadAccess({ requestContext, resource: 'stored-skills', resourceId: storedSkillId, record: skill });

      const result = await favoritesStore.favorite({
        userId: callerId,
        entityType: 'skill',
        entityId: storedSkillId,
      });
      return result;
    } catch (error) {
      return handleError(error, 'Error favoriting stored skill');
    }
  },
});

/**
 * DELETE /stored/skills/:storedSkillId/favorite
 */
export const UNFAVORITE_STORED_SKILL_ROUTE = createRoute({
  method: 'DELETE',
  path: '/stored/skills/:storedSkillId/favorite',
  responseType: 'json',
  pathParamSchema: storedSkillIdPathParams,
  responseSchema: favoriteToggleResponseSchema,
  summary: 'Unfavorite a stored skill',
  description: 'Removes the caller’s favorite from the stored skill. Idempotent.',
  tags: ['Stored Skills'],
  requiresAuth: true,
  requiresPermission: 'stored-skills:read',
  handler: async ({ mastra, requestContext, storedSkillId }) => {
    try {
      await requireBuilderFeature(mastra, 'favorites');

      const callerId = getCallerAuthorId(requestContext);
      if (!callerId) {
        throw new HTTPException(401, { message: 'Authentication required' });
      }

      const { skillStore, favoritesStore } = await getFavoritesContext(mastra);

      const skill = await skillStore.getByIdResolved(storedSkillId);
      if (!skill) {
        throw new HTTPException(404, { message: `Stored skill with id ${storedSkillId} not found` });
      }
      assertStoredResourceScope(skill, await getStoredResourceScope(mastra, requestContext));

      assertReadAccess({ requestContext, resource: 'stored-skills', resourceId: storedSkillId, record: skill });

      const result = await favoritesStore.unfavorite({
        userId: callerId,
        entityType: 'skill',
        entityId: storedSkillId,
      });
      return result;
    } catch (error) {
      return handleError(error, 'Error unfavoriting stored skill');
    }
  },
});
