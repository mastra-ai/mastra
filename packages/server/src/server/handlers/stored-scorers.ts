import { SERVER_ERROR_CODES } from '../error-codes';
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
import { assertStoredResourceScope, getStoredResourceScope, scopeStoredResourceMetadata, toSlug } from '../utils';

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
  errors: [
    'STORAGE_NOT_CONFIGURED',
    'STORED_RESOURCE_SCOPE_REQUIRED',
    'STORED_SCORERS_LIST_FAILED',
    'STORED_SCORER_STORAGE_DOMAIN_UNAVAILABLE',
  ],
  handler: async ({ mastra, page, perPage, orderBy, status, authorId, metadata, requestContext }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, {
          message: 'Storage is not configured',
          code: SERVER_ERROR_CODES.STORAGE_NOT_CONFIGURED,
        });
      }

      const scorerStore = await storage.getStore('scorerDefinitions');
      if (!scorerStore) {
        throw new HTTPException(500, {
          message: 'Scorer definitions storage domain is not available',
          code: SERVER_ERROR_CODES.STORED_SCORER_STORAGE_DOMAIN_UNAVAILABLE,
        });
      }

      const scope = await getStoredResourceScope(mastra, requestContext);
      const result = await scorerStore.listResolved({
        page,
        perPage,
        orderBy,
        status,
        authorId,
        metadata: scopeStoredResourceMetadata(metadata, scope),
      });

      return result;
    } catch (error) {
      return handleError(error, {
        message: 'Error listing stored scorer definitions',
        code: SERVER_ERROR_CODES.STORED_SCORERS_LIST_FAILED,
      });
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
  errors: [
    'STORAGE_NOT_CONFIGURED',
    'STORED_RESOURCE_NOT_FOUND',
    'STORED_RESOURCE_SCOPE_REQUIRED',
    'STORED_SCORER_GET_FAILED',
    'STORED_SCORER_NOT_FOUND',
    'STORED_SCORER_STORAGE_DOMAIN_UNAVAILABLE',
  ],
  handler: async ({ mastra, storedScorerId, status, requestContext }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, {
          message: 'Storage is not configured',
          code: SERVER_ERROR_CODES.STORAGE_NOT_CONFIGURED,
        });
      }

      const scorerStore = await storage.getStore('scorerDefinitions');
      if (!scorerStore) {
        throw new HTTPException(500, {
          message: 'Scorer definitions storage domain is not available',
          code: SERVER_ERROR_CODES.STORED_SCORER_STORAGE_DOMAIN_UNAVAILABLE,
        });
      }

      const scorer = await scorerStore.getByIdResolved(storedScorerId, { status });

      if (!scorer) {
        throw new HTTPException(404, {
          message: `Stored scorer definition with id ${storedScorerId} not found`,
          code: SERVER_ERROR_CODES.STORED_SCORER_NOT_FOUND,
          metadata: { storedScorerId },
        });
      }
      assertStoredResourceScope(scorer, await getStoredResourceScope(mastra, requestContext));

      return scorer;
    } catch (error) {
      return handleError(error, {
        message: 'Error getting stored scorer definition',
        code: SERVER_ERROR_CODES.STORED_SCORER_GET_FAILED,
      });
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
  errors: [
    'STORAGE_NOT_CONFIGURED',
    'STORED_RESOURCE_SCOPE_REQUIRED',
    'STORED_SCORER_ALREADY_EXISTS',
    'STORED_SCORER_CREATED_RESOLVE_FAILED',
    'STORED_SCORER_CREATE_FAILED',
    'STORED_SCORER_ID_DERIVATION_FAILED',
    'STORED_SCORER_STORAGE_DOMAIN_UNAVAILABLE',
  ],
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
    requestContext,
  }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, {
          message: 'Storage is not configured',
          code: SERVER_ERROR_CODES.STORAGE_NOT_CONFIGURED,
        });
      }

      const scorerStore = await storage.getStore('scorerDefinitions');
      if (!scorerStore) {
        throw new HTTPException(500, {
          message: 'Scorer definitions storage domain is not available',
          code: SERVER_ERROR_CODES.STORED_SCORER_STORAGE_DOMAIN_UNAVAILABLE,
        });
      }

      // Derive ID from name if not explicitly provided
      const id = providedId || toSlug(name);

      if (!id) {
        throw new HTTPException(400, {
          message: 'Could not derive scorer definition ID from name. Please provide an explicit id.',
          code: SERVER_ERROR_CODES.STORED_SCORER_ID_DERIVATION_FAILED,
        });
      }

      // Check if scorer definition with this ID already exists
      const existing = await scorerStore.getById(id);
      if (existing) {
        throw new HTTPException(409, {
          message: `Scorer definition with id ${id} already exists`,
          code: SERVER_ERROR_CODES.STORED_SCORER_ALREADY_EXISTS,
          metadata: { storedScorerId: id },
        });
      }

      await scorerStore.create({
        scorerDefinition: {
          id,
          authorId,
          metadata: scopeStoredResourceMetadata(metadata, await getStoredResourceScope(mastra, requestContext)),
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
        throw new HTTPException(500, {
          message: 'Failed to resolve created scorer definition',
          code: SERVER_ERROR_CODES.STORED_SCORER_CREATED_RESOLVE_FAILED,
        });
      }

      return resolved;
    } catch (error) {
      return handleError(error, {
        message: 'Error creating stored scorer definition',
        code: SERVER_ERROR_CODES.STORED_SCORER_CREATE_FAILED,
      });
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
  errors: [
    'STORAGE_NOT_CONFIGURED',
    'STORED_RESOURCE_NOT_FOUND',
    'STORED_RESOURCE_SCOPE_REQUIRED',
    'STORED_SCORER_NOT_FOUND',
    'STORED_SCORER_STORAGE_DOMAIN_UNAVAILABLE',
    'STORED_SCORER_UPDATED_RESOLVE_FAILED',
    'STORED_SCORER_UPDATE_FAILED',
  ],
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
    requestContext,
  }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, {
          message: 'Storage is not configured',
          code: SERVER_ERROR_CODES.STORAGE_NOT_CONFIGURED,
        });
      }

      const scorerStore = await storage.getStore('scorerDefinitions');
      if (!scorerStore) {
        throw new HTTPException(500, {
          message: 'Scorer definitions storage domain is not available',
          code: SERVER_ERROR_CODES.STORED_SCORER_STORAGE_DOMAIN_UNAVAILABLE,
        });
      }

      // Check if scorer definition exists
      const existing = await scorerStore.getById(storedScorerId);
      if (!existing) {
        throw new HTTPException(404, {
          message: `Stored scorer definition with id ${storedScorerId} not found`,
          code: SERVER_ERROR_CODES.STORED_SCORER_NOT_FOUND,
          metadata: { storedScorerId },
        });
      }
      const scope = await getStoredResourceScope(mastra, requestContext);
      assertStoredResourceScope(existing, scope);
      const scopedMetadata =
        metadata !== undefined
          ? scopeStoredResourceMetadata({ ...(existing.metadata ?? {}), ...metadata }, scope)
          : undefined;

      // Update the scorer definition with both metadata-level and config-level fields
      const updatedScorer = await scorerStore.update({
        id: storedScorerId,
        authorId,
        ...(scopedMetadata !== undefined ? { metadata: scopedMetadata } : {}),
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
        throw new HTTPException(500, {
          message: 'Failed to resolve updated scorer definition',
          code: SERVER_ERROR_CODES.STORED_SCORER_UPDATED_RESOLVE_FAILED,
        });
      }

      return resolved;
    } catch (error) {
      return handleError(error, {
        message: 'Error updating stored scorer definition',
        code: SERVER_ERROR_CODES.STORED_SCORER_UPDATE_FAILED,
      });
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
  errors: [
    'STORAGE_NOT_CONFIGURED',
    'STORED_RESOURCE_NOT_FOUND',
    'STORED_RESOURCE_SCOPE_REQUIRED',
    'STORED_SCORER_DELETE_FAILED',
    'STORED_SCORER_NOT_FOUND',
    'STORED_SCORER_STORAGE_DOMAIN_UNAVAILABLE',
  ],
  handler: async ({ mastra, storedScorerId, requestContext }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, {
          message: 'Storage is not configured',
          code: SERVER_ERROR_CODES.STORAGE_NOT_CONFIGURED,
        });
      }

      const scorerStore = await storage.getStore('scorerDefinitions');
      if (!scorerStore) {
        throw new HTTPException(500, {
          message: 'Scorer definitions storage domain is not available',
          code: SERVER_ERROR_CODES.STORED_SCORER_STORAGE_DOMAIN_UNAVAILABLE,
        });
      }

      // Check if scorer definition exists
      const existing = await scorerStore.getById(storedScorerId);
      if (!existing) {
        throw new HTTPException(404, {
          message: `Stored scorer definition with id ${storedScorerId} not found`,
          code: SERVER_ERROR_CODES.STORED_SCORER_NOT_FOUND,
          metadata: { storedScorerId },
        });
      }
      assertStoredResourceScope(existing, await getStoredResourceScope(mastra, requestContext));

      await scorerStore.delete(storedScorerId);

      // Clear the cached scorer instance
      mastra.getEditor()?.scorer.clearCache(storedScorerId);

      return { success: true, message: `Scorer definition ${storedScorerId} deleted successfully` };
    } catch (error) {
      return handleError(error, {
        message: 'Error deleting stored scorer definition',
        code: SERVER_ERROR_CODES.STORED_SCORER_DELETE_FAILED,
      });
    }
  },
});
