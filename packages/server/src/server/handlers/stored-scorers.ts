import slugify from '@sindresorhus/slugify';

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

// ============================================================================
// Route Definitions
// ============================================================================

/**
 * GET /stored/scorers - List all stored scorer definitions
 */
export const LIST_STORED_SCORERS_ROUTE = createRoute({
  method: 'GET',
  path: '/stored/scorers',
  responseType: 'json',
  queryParamSchema: listStoredScorersQuerySchema,
  responseSchema: listStoredScorersResponseSchema,
  summary: 'List stored scorer definitions',
  description: 'Returns a paginated list of all scorer definitions stored in the database',
  tags: ['Stored Scorers'],
  requiresAuth: true,
  handler: async ({ mastra, page, perPage, orderBy, authorId, metadata }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const scorerStore = await storage.getStore('scorerDefinitions');
      if (!scorerStore) {
        throw new HTTPException(500, { message: 'Scorer definitions storage domain is not available' });
      }

      const result = await scorerStore.listResolved({
        page,
        perPage,
        orderBy,
        authorId,
        metadata,
      });

      return result;
    } catch (error) {
      return handleError(error, 'Error listing stored scorer definitions');
    }
  },
});

/**
 * GET /stored/scorers/:storedScorerId - Get a stored scorer definition by ID
 */
export const GET_STORED_SCORER_ROUTE = createRoute({
  method: 'GET',
  path: '/stored/scorers/:storedScorerId',
  responseType: 'json',
  pathParamSchema: storedScorerIdPathParams,
  responseSchema: getStoredScorerResponseSchema,
  summary: 'Get stored scorer definition by ID',
  description:
    'Returns a specific scorer definition from storage by its unique identifier (resolved with active version config)',
  tags: ['Stored Scorers'],
  requiresAuth: true,
  handler: async ({ mastra, storedScorerId }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const scorerStore = await storage.getStore('scorerDefinitions');
      if (!scorerStore) {
        throw new HTTPException(500, { message: 'Scorer definitions storage domain is not available' });
      }

      const scorer = await scorerStore.getByIdResolved(storedScorerId);

      if (!scorer) {
        throw new HTTPException(404, { message: `Stored scorer definition with id ${storedScorerId} not found` });
      }

      return scorer;
    } catch (error) {
      return handleError(error, 'Error getting stored scorer definition');
    }
  },
});

/**
 * POST /stored/scorers - Create a new stored scorer definition
 */
export const CREATE_STORED_SCORER_ROUTE = createRoute({
  method: 'POST',
  path: '/stored/scorers',
  responseType: 'json',
  bodySchema: createStoredScorerBodySchema,
  responseSchema: createStoredScorerResponseSchema,
  summary: 'Create stored scorer definition',
  description: 'Creates a new scorer definition in storage with the provided configuration',
  tags: ['Stored Scorers'],
  requiresAuth: true,
  handler: async ({
    mastra,
    id: providedId,
    authorId,
    metadata,
    name,
    description,
    type,
    model,
    instructions,
    scoreRange,
    presetConfig,
    defaultSampling,
  }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const scorerStore = await storage.getStore('scorerDefinitions');
      if (!scorerStore) {
        throw new HTTPException(500, { message: 'Scorer definitions storage domain is not available' });
      }

      // Derive ID from name if not explicitly provided
      const id = providedId || slugify(name);

      if (!id) {
        throw new HTTPException(400, {
          message: 'Could not derive scorer definition ID from name. Please provide an explicit id.',
        });
      }

      // Check if scorer definition with this ID already exists
      const existing = await scorerStore.getById(id);
      if (existing) {
        throw new HTTPException(409, { message: `Scorer definition with id ${id} already exists` });
      }

      await scorerStore.create({
        scorerDefinition: {
          id,
          authorId,
          metadata,
          name,
          description,
          type,
          model,
          instructions,
          scoreRange,
          presetConfig,
          defaultSampling,
        },
      });

      // Return the resolved scorer definition (thin record + version config)
      const resolved = await scorerStore.getByIdResolved(id);
      if (!resolved) {
        throw new HTTPException(500, { message: 'Failed to resolve created scorer definition' });
      }

      return resolved;
    } catch (error) {
      return handleError(error, 'Error creating stored scorer definition');
    }
  },
});

/**
 * PATCH /stored/scorers/:storedScorerId - Update a stored scorer definition
 */
export const UPDATE_STORED_SCORER_ROUTE = createRoute({
  method: 'PATCH',
  path: '/stored/scorers/:storedScorerId',
  responseType: 'json',
  pathParamSchema: storedScorerIdPathParams,
  bodySchema: updateStoredScorerBodySchema,
  responseSchema: updateStoredScorerResponseSchema,
  summary: 'Update stored scorer definition',
  description: 'Updates an existing scorer definition in storage with the provided fields',
  tags: ['Stored Scorers'],
  requiresAuth: true,
  handler: async ({
    mastra,
    storedScorerId,
    // Metadata-level fields
    authorId,
    metadata,
    // Config fields (snapshot-level)
    name,
    description,
    type,
    model,
    instructions,
    scoreRange,
    presetConfig,
    defaultSampling,
  }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const scorerStore = await storage.getStore('scorerDefinitions');
      if (!scorerStore) {
        throw new HTTPException(500, { message: 'Scorer definitions storage domain is not available' });
      }

      // Check if scorer definition exists
      const existing = await scorerStore.getById(storedScorerId);
      if (!existing) {
        throw new HTTPException(404, { message: `Stored scorer definition with id ${storedScorerId} not found` });
      }

      // Update the scorer definition with both metadata-level and config-level fields
      // The storage layer handles separating these into record updates vs new-version creation
      await scorerStore.update({
        id: storedScorerId,
        authorId,
        metadata,
        name,
        description,
        type,
        model,
        instructions,
        scoreRange,
        presetConfig,
        defaultSampling,
      });

      // Return the resolved scorer definition with the updated config
      const resolved = await scorerStore.getByIdResolved(storedScorerId);
      if (!resolved) {
        throw new HTTPException(500, { message: 'Failed to resolve updated scorer definition' });
      }

      return resolved;
    } catch (error) {
      return handleError(error, 'Error updating stored scorer definition');
    }
  },
});

/**
 * DELETE /stored/scorers/:storedScorerId - Delete a stored scorer definition
 */
export const DELETE_STORED_SCORER_ROUTE = createRoute({
  method: 'DELETE',
  path: '/stored/scorers/:storedScorerId',
  responseType: 'json',
  pathParamSchema: storedScorerIdPathParams,
  responseSchema: deleteStoredScorerResponseSchema,
  summary: 'Delete stored scorer definition',
  description: 'Deletes a scorer definition from storage by its unique identifier',
  tags: ['Stored Scorers'],
  requiresAuth: true,
  handler: async ({ mastra, storedScorerId }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const scorerStore = await storage.getStore('scorerDefinitions');
      if (!scorerStore) {
        throw new HTTPException(500, { message: 'Scorer definitions storage domain is not available' });
      }

      // Check if scorer definition exists
      const existing = await scorerStore.getById(storedScorerId);
      if (!existing) {
        throw new HTTPException(404, { message: `Stored scorer definition with id ${storedScorerId} not found` });
      }

      await scorerStore.delete(storedScorerId);

      return { success: true, message: `Scorer definition ${storedScorerId} deleted successfully` };
    } catch (error) {
      return handleError(error, 'Error deleting stored scorer definition');
    }
  },
});
