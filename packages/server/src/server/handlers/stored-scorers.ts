import { HTTPException } from '../http-exception';
import {
  storedScorerIdPathParams,
  statusQuerySchema,
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
import { toSlug } from '../utils';

import { handleError } from './error';
import { handleAutoVersioning } from './version-helpers';
import type { VersionedStoreInterface } from './version-helpers';

const SCORER_SNAPSHOT_CONFIG_FIELDS = [
  'name',
  'description',
  'type',
  'model',
  'instructions',
  'scoreRange',
  'presetConfig',
  'defaultSampling',
] as const;

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
  handler: async ({ mastra, page, perPage, orderBy, status, authorId, metadata }) => {
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
        status,
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
  queryParamSchema: statusQuerySchema,
  responseSchema: getStoredScorerResponseSchema,
  summary: 'Get stored scorer definition by ID',
  description:
    'Returns a specific scorer definition from storage by its unique identifier. Use ?status=draft to resolve with the latest (draft) version, or ?status=published (default) for the active published version.',
  tags: ['Stored Scorers'],
  requiresAuth: true,
  handler: async ({ mastra, storedScorerId, status }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const scorerStore = await storage.getStore('scorerDefinitions');
      if (!scorerStore) {
        throw new HTTPException(500, { message: 'Scorer definitions storage domain is not available' });
      }

      const scorer = await scorerStore.getByIdResolved(storedScorerId, { status });

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
      const id = providedId || toSlug(name);

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
      // Use draft status since newly created entities start as drafts
      const resolved = await scorerStore.getByIdResolved(id, { status: 'draft' });
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
      const updatedScorer = await scorerStore.update({
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

      // Build the snapshot config for auto-versioning comparison
      const configFields = {
        name,
        description,
        type,
        model,
        instructions,
        scoreRange,
        presetConfig,
        defaultSampling,
      };

      // Filter out undefined values to get only the config fields that were provided
      const providedConfigFields = Object.fromEntries(Object.entries(configFields).filter(([_, v]) => v !== undefined));

      // Handle auto-versioning with retry logic for race conditions
      // This creates a new version if there are meaningful config changes.
      // It does NOT update activeVersionId — the version stays as a draft until explicitly published.
      await handleAutoVersioning(
        scorerStore as unknown as VersionedStoreInterface,
        storedScorerId,
        'scorerDefinitionId',
        SCORER_SNAPSHOT_CONFIG_FIELDS,
        existing,
        updatedScorer,
        providedConfigFields,
      );

      // Clear the cached scorer instance so the next request gets the updated config
      const editor = mastra.getEditor();
      if (editor) {
        editor.scorer.clearCache(storedScorerId);
      }

      // Return the resolved scorer definition with the latest (draft) version so the UI sees its edits
      const resolved = await scorerStore.getByIdResolved(storedScorerId, { status: 'draft' });
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

      // Clear the cached scorer instance
      mastra.getEditor()?.scorer.clearCache(storedScorerId);

      return { success: true, message: `Scorer definition ${storedScorerId} deleted successfully` };
    } catch (error) {
      return handleError(error, 'Error deleting stored scorer definition');
    }
  },
});
