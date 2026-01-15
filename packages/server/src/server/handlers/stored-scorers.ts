import { HTTPException } from '../http-exception';
import {
  storedScorerIdPathParams,
  listStoredScorersQuerySchema,
  createStoredScorerBodySchema,
  updateStoredScorerBodySchema,
  listStoredScorersResponseSchema,
  getStoredScorerResponseSchema,
  createStoredScorerResponseSchema,
  updateStoredScorerResponseSchema,
  deleteStoredScorerResponseSchema,
} from '../schemas/stored-scorers';
import { createRoute } from '../server-adapter/routes/route-builder';

import { handleError } from './error';
import { handleScorerAutoVersioning } from './scorer-versions';

// ============================================================================
// Route Definitions
// ============================================================================

/**
 * GET /api/stored/scorers - List all stored scorers
 */
export const LIST_STORED_SCORERS_ROUTE = createRoute({
  method: 'GET',
  path: '/api/stored/scorers',
  responseType: 'json',
  queryParamSchema: listStoredScorersQuerySchema,
  responseSchema: listStoredScorersResponseSchema,
  summary: 'List stored scorers',
  description: 'Returns a paginated list of all scorers stored in the database',
  tags: ['Stored Scorers'],
  handler: async ({ mastra, page, perPage, orderBy, ownerId, metadata }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const scorersStore = await storage.getStore('storedScorers');
      if (!scorersStore) {
        throw new HTTPException(500, { message: 'Stored scorers storage domain is not available' });
      }

      const result = await scorersStore.listScorers({
        page,
        perPage,
        orderBy,
        ownerId,
        metadata,
      });

      return result;
    } catch (error) {
      return handleError(error, 'Error listing stored scorers');
    }
  },
});

/**
 * GET /api/stored/scorers/:scorerId - Get a stored scorer by ID
 */
export const GET_STORED_SCORER_ROUTE = createRoute({
  method: 'GET',
  path: '/api/stored/scorers/:scorerId',
  responseType: 'json',
  pathParamSchema: storedScorerIdPathParams,
  responseSchema: getStoredScorerResponseSchema,
  summary: 'Get stored scorer by ID',
  description: 'Returns a specific scorer from storage by its unique identifier',
  tags: ['Stored Scorers'],
  handler: async ({ mastra, scorerId }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const scorersStore = await storage.getStore('storedScorers');
      if (!scorersStore) {
        throw new HTTPException(500, { message: 'Stored scorers storage domain is not available' });
      }

      // Use getScorerByIdResolved to automatically resolve from active version
      const scorer = await scorersStore.getScorerByIdResolved({ id: scorerId });

      if (!scorer) {
        throw new HTTPException(404, { message: `Stored scorer with id ${scorerId} not found` });
      }

      return scorer;
    } catch (error) {
      return handleError(error, 'Error getting stored scorer');
    }
  },
});

/**
 * POST /api/stored/scorers - Create a new stored scorer
 */
export const CREATE_STORED_SCORER_ROUTE = createRoute({
  method: 'POST',
  path: '/api/stored/scorers',
  responseType: 'json',
  bodySchema: createStoredScorerBodySchema,
  responseSchema: createStoredScorerResponseSchema,
  summary: 'Create stored scorer',
  description: 'Creates a new scorer in storage with the provided configuration',
  tags: ['Stored Scorers'],
  handler: async ({ mastra, id, name, description, model, prompt, scoreRange, metadata, ownerId }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const scorersStore = await storage.getStore('storedScorers');
      if (!scorersStore) {
        throw new HTTPException(500, { message: 'Stored scorers storage domain is not available' });
      }

      // Check if scorer with this ID already exists
      const existing = await scorersStore.getScorerById({ id });
      if (existing) {
        throw new HTTPException(409, { message: `Scorer with id ${id} already exists` });
      }

      const scorer = await scorersStore.createScorer({
        scorer: {
          id,
          name,
          description,
          model,
          prompt,
          scoreRange,
          metadata,
          ownerId,
        },
      });

      return scorer;
    } catch (error) {
      return handleError(error, 'Error creating stored scorer');
    }
  },
});

/**
 * PATCH /api/stored/scorers/:scorerId - Update a stored scorer
 */
export const UPDATE_STORED_SCORER_ROUTE = createRoute({
  method: 'PATCH',
  path: '/api/stored/scorers/:scorerId',
  responseType: 'json',
  pathParamSchema: storedScorerIdPathParams,
  bodySchema: updateStoredScorerBodySchema,
  responseSchema: updateStoredScorerResponseSchema,
  summary: 'Update stored scorer',
  description: 'Updates an existing scorer in storage with the provided fields',
  tags: ['Stored Scorers'],
  handler: async ({ mastra, scorerId, name, description, model, prompt, scoreRange, metadata, ownerId }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const scorersStore = await storage.getStore('storedScorers');
      if (!scorersStore) {
        throw new HTTPException(500, { message: 'Stored scorers storage domain is not available' });
      }

      // Check if scorer exists
      const existing = await scorersStore.getScorerById({ id: scorerId });
      if (!existing) {
        throw new HTTPException(404, { message: `Stored scorer with id ${scorerId} not found` });
      }

      const updatedScorer = await scorersStore.updateScorer({
        id: scorerId,
        name,
        description,
        model,
        prompt,
        scoreRange,
        metadata,
        ownerId,
      });

      // Handle auto-versioning with retry logic for race conditions
      // This creates a version if there are meaningful changes and updates activeVersionId
      const { scorer } = await handleScorerAutoVersioning(scorersStore, scorerId, existing, updatedScorer);

      return scorer;
    } catch (error) {
      return handleError(error, 'Error updating stored scorer');
    }
  },
});

/**
 * DELETE /api/stored/scorers/:scorerId - Delete a stored scorer
 */
export const DELETE_STORED_SCORER_ROUTE = createRoute({
  method: 'DELETE',
  path: '/api/stored/scorers/:scorerId',
  responseType: 'json',
  pathParamSchema: storedScorerIdPathParams,
  responseSchema: deleteStoredScorerResponseSchema,
  summary: 'Delete stored scorer',
  description: 'Deletes a scorer from storage by its unique identifier',
  tags: ['Stored Scorers'],
  handler: async ({ mastra, scorerId }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const scorersStore = await storage.getStore('storedScorers');
      if (!scorersStore) {
        throw new HTTPException(500, { message: 'Stored scorers storage domain is not available' });
      }

      // Check if scorer exists
      const existing = await scorersStore.getScorerById({ id: scorerId });
      if (!existing) {
        throw new HTTPException(404, { message: `Stored scorer with id ${scorerId} not found` });
      }

      await scorersStore.deleteScorer({ id: scorerId });

      return { success: true, message: `Scorer ${scorerId} deleted successfully` };
    } catch (error) {
      return handleError(error, 'Error deleting stored scorer');
    }
  },
});
