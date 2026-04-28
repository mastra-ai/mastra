import { HTTPException } from '../http-exception';
import { starToggleResponseSchema } from '../schemas/stars';
import { storedSkillIdPathParams } from '../schemas/stored-skills';
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
  const skillStore = await storage.getStore('skills');
  if (!skillStore) {
    throw new HTTPException(500, { message: 'Skills storage domain is not available' });
  }
  const starsStore = await storage.getStore('stars');
  if (!starsStore) {
    throw new HTTPException(500, { message: 'Stars storage domain is not available' });
  }
  return { skillStore, starsStore };
}

/**
 * PUT /stored/skills/:storedSkillId/star
 */
export const STAR_STORED_SKILL_ROUTE = createRoute({
  method: 'PUT',
  path: '/stored/skills/:storedSkillId/star',
  responseType: 'json',
  pathParamSchema: storedSkillIdPathParams,
  responseSchema: starToggleResponseSchema,
  summary: 'Star a stored skill',
  description: 'Marks the stored skill as starred by the calling user. Idempotent.',
  tags: ['Stored Skills'],
  requiresAuth: true,
  requiresPermission: 'stored-skills:read',
  handler: async ({ mastra, requestContext, storedSkillId }) => {
    try {
      await requireBuilderFeature(mastra, 'stars');

      const callerId = getCallerAuthorId(requestContext);
      if (!callerId) {
        throw new HTTPException(401, { message: 'Authentication required' });
      }

      const { skillStore, starsStore } = await getStarsContext(mastra);

      const skill = await skillStore.getById(storedSkillId);
      if (!skill) {
        throw new HTTPException(404, { message: `Stored skill with id ${storedSkillId} not found` });
      }

      // Throws 404 if the caller cannot read the skill (private + not owner/admin).
      assertReadAccess({ requestContext, resource: 'skills', resourceId: storedSkillId, record: skill });

      const result = await starsStore.star({
        userId: callerId,
        entityType: 'skill',
        entityId: storedSkillId,
      });
      return result;
    } catch (error) {
      return handleError(error, 'Error starring stored skill');
    }
  },
});

/**
 * DELETE /stored/skills/:storedSkillId/star
 */
export const UNSTAR_STORED_SKILL_ROUTE = createRoute({
  method: 'DELETE',
  path: '/stored/skills/:storedSkillId/star',
  responseType: 'json',
  pathParamSchema: storedSkillIdPathParams,
  responseSchema: starToggleResponseSchema,
  summary: 'Unstar a stored skill',
  description: 'Removes the caller’s star from the stored skill. Idempotent.',
  tags: ['Stored Skills'],
  requiresAuth: true,
  requiresPermission: 'stored-skills:read',
  handler: async ({ mastra, requestContext, storedSkillId }) => {
    try {
      await requireBuilderFeature(mastra, 'stars');

      const callerId = getCallerAuthorId(requestContext);
      if (!callerId) {
        throw new HTTPException(401, { message: 'Authentication required' });
      }

      const { skillStore, starsStore } = await getStarsContext(mastra);

      const skill = await skillStore.getById(storedSkillId);
      if (!skill) {
        throw new HTTPException(404, { message: `Stored skill with id ${storedSkillId} not found` });
      }

      assertReadAccess({ requestContext, resource: 'skills', resourceId: storedSkillId, record: skill });

      const result = await starsStore.unstar({
        userId: callerId,
        entityType: 'skill',
        entityId: storedSkillId,
      });
      return result;
    } catch (error) {
      return handleError(error, 'Error unstarring stored skill');
    }
  },
});
