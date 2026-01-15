import { HTTPException } from '../http-exception';
import {
  storedScorerIdPathParams,
  scorerVersionIdPathParams,
  listStoredScorersQuerySchema,
  listScorerVersionsQuerySchema,
  createStoredScorerBodySchema,
  updateStoredScorerBodySchema,
  createScorerVersionBodySchema,
  listStoredScorersResponseSchema,
  getStoredScorerResponseSchema,
  createStoredScorerResponseSchema,
  updateStoredScorerResponseSchema,
  deleteStoredScorerResponseSchema,
  listScorerVersionsResponseSchema,
  getScorerVersionResponseSchema,
  createScorerVersionResponseSchema,
  activateScorerVersionResponseSchema,
  restoreScorerVersionResponseSchema,
  deleteScorerVersionResponseSchema,
} from '../schemas/stored-scorers';
import { createRoute } from '../server-adapter/routes/route-builder';

import { handleError } from './error';
import { handleScorerAutoVersioning, calculateChangedFields, createVersionWithRetry } from './scorer-versions';

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

// ============================================================================
// Version Routes
// ============================================================================

/**
 * GET /api/stored/scorers/:scorerId/versions - List all versions for a scorer
 */
export const LIST_SCORER_VERSIONS_ROUTE = createRoute({
  method: 'GET',
  path: '/api/stored/scorers/:scorerId/versions',
  responseType: 'json',
  pathParamSchema: storedScorerIdPathParams,
  queryParamSchema: listScorerVersionsQuerySchema,
  responseSchema: listScorerVersionsResponseSchema,
  summary: 'List scorer versions',
  description: 'Returns a paginated list of all versions for a stored scorer',
  tags: ['Scorer Versions'],
  handler: async ({ mastra, scorerId, page, perPage, orderBy }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const scorersStore = await storage.getStore('storedScorers');
      if (!scorersStore) {
        throw new HTTPException(500, { message: 'Stored scorers storage domain is not available' });
      }

      // Verify scorer exists
      const scorer = await scorersStore.getScorerById({ id: scorerId });
      if (!scorer) {
        throw new HTTPException(404, { message: `Scorer with id ${scorerId} not found` });
      }

      const result = await scorersStore.listScorerVersions({
        scorerId,
        page,
        perPage,
        orderBy,
      });

      return result;
    } catch (error) {
      return handleError(error, 'Error listing scorer versions');
    }
  },
});

/**
 * POST /api/stored/scorers/:scorerId/versions - Create a new version snapshot
 */
export const CREATE_SCORER_VERSION_ROUTE = createRoute({
  method: 'POST',
  path: '/api/stored/scorers/:scorerId/versions',
  responseType: 'json',
  pathParamSchema: storedScorerIdPathParams,
  bodySchema: createScorerVersionBodySchema,
  responseSchema: createScorerVersionResponseSchema,
  summary: 'Create scorer version',
  description: 'Creates a new version snapshot of the current scorer configuration',
  tags: ['Scorer Versions'],
  handler: async ({ mastra, scorerId, name, changeMessage }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const scorersStore = await storage.getStore('storedScorers');
      if (!scorersStore) {
        throw new HTTPException(500, { message: 'Stored scorers storage domain is not available' });
      }

      // Get the current scorer configuration
      const scorer = await scorersStore.getScorerById({ id: scorerId });
      if (!scorer) {
        throw new HTTPException(404, { message: `Scorer with id ${scorerId} not found` });
      }

      // Get the latest version to calculate changed fields
      const latestVersion = await scorersStore.getLatestScorerVersion(scorerId);
      const changedFields = calculateChangedFields(
        latestVersion?.snapshot as Record<string, unknown> | undefined,
        scorer as unknown as Record<string, unknown>,
      );

      // Create the new version with retry logic to handle race conditions
      const { versionId } = await createVersionWithRetry(
        scorersStore,
        scorerId,
        scorer,
        changedFields.length > 0 ? changedFields : [],
        { name, changeMessage },
      );

      // Get the created version to return
      const version = await scorersStore.getScorerVersion(versionId);
      if (!version) {
        throw new HTTPException(500, { message: 'Failed to retrieve created version' });
      }

      return version;
    } catch (error) {
      return handleError(error, 'Error creating scorer version');
    }
  },
});

/**
 * GET /api/stored/scorers/:scorerId/versions/:versionId - Get a specific version
 */
export const GET_SCORER_VERSION_ROUTE = createRoute({
  method: 'GET',
  path: '/api/stored/scorers/:scorerId/versions/:versionId',
  responseType: 'json',
  pathParamSchema: scorerVersionIdPathParams,
  responseSchema: getScorerVersionResponseSchema,
  summary: 'Get scorer version',
  description: 'Returns a specific version of a scorer by its version ID',
  tags: ['Scorer Versions'],
  handler: async ({ mastra, scorerId, versionId }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const scorersStore = await storage.getStore('storedScorers');
      if (!scorersStore) {
        throw new HTTPException(500, { message: 'Stored scorers storage domain is not available' });
      }

      const version = await scorersStore.getScorerVersion(versionId);

      if (!version) {
        throw new HTTPException(404, { message: `Version with id ${versionId} not found` });
      }

      // Verify the version belongs to the specified scorer
      if (version.scorerId !== scorerId) {
        throw new HTTPException(404, { message: `Version with id ${versionId} not found for scorer ${scorerId}` });
      }

      return version;
    } catch (error) {
      return handleError(error, 'Error getting scorer version');
    }
  },
});

/**
 * POST /api/stored/scorers/:scorerId/versions/:versionId/activate - Set a version as active
 */
export const ACTIVATE_SCORER_VERSION_ROUTE = createRoute({
  method: 'POST',
  path: '/api/stored/scorers/:scorerId/versions/:versionId/activate',
  responseType: 'json',
  pathParamSchema: scorerVersionIdPathParams,
  responseSchema: activateScorerVersionResponseSchema,
  summary: 'Activate scorer version',
  description: 'Sets a specific version as the active version for the scorer',
  tags: ['Scorer Versions'],
  handler: async ({ mastra, scorerId, versionId }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const scorersStore = await storage.getStore('storedScorers');
      if (!scorersStore) {
        throw new HTTPException(500, { message: 'Stored scorers storage domain is not available' });
      }

      // Verify scorer exists
      const scorer = await scorersStore.getScorerById({ id: scorerId });
      if (!scorer) {
        throw new HTTPException(404, { message: `Scorer with id ${scorerId} not found` });
      }

      // Verify version exists and belongs to this scorer
      const version = await scorersStore.getScorerVersion(versionId);
      if (!version) {
        throw new HTTPException(404, { message: `Version with id ${versionId} not found` });
      }
      if (version.scorerId !== scorerId) {
        throw new HTTPException(404, { message: `Version with id ${versionId} not found for scorer ${scorerId}` });
      }

      // Update the scorer's activeVersionId
      await scorersStore.updateScorer({
        id: scorerId,
        activeVersionId: versionId,
      });

      return {
        success: true,
        message: `Version ${version.versionNumber} is now active`,
        activeVersionId: versionId,
      };
    } catch (error) {
      return handleError(error, 'Error activating scorer version');
    }
  },
});

/**
 * POST /api/stored/scorers/:scorerId/versions/:versionId/restore - Restore scorer to a version
 */
export const RESTORE_SCORER_VERSION_ROUTE = createRoute({
  method: 'POST',
  path: '/api/stored/scorers/:scorerId/versions/:versionId/restore',
  responseType: 'json',
  pathParamSchema: scorerVersionIdPathParams,
  responseSchema: restoreScorerVersionResponseSchema,
  summary: 'Restore scorer version',
  description: 'Restores the scorer configuration from a version snapshot, creating a new version',
  tags: ['Scorer Versions'],
  handler: async ({ mastra, scorerId, versionId }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const scorersStore = await storage.getStore('storedScorers');
      if (!scorersStore) {
        throw new HTTPException(500, { message: 'Stored scorers storage domain is not available' });
      }

      // Verify scorer exists
      const scorer = await scorersStore.getScorerById({ id: scorerId });
      if (!scorer) {
        throw new HTTPException(404, { message: `Scorer with id ${scorerId} not found` });
      }

      // Get the version to restore
      const versionToRestore = await scorersStore.getScorerVersion(versionId);
      if (!versionToRestore) {
        throw new HTTPException(404, { message: `Version with id ${versionId} not found` });
      }
      if (versionToRestore.scorerId !== scorerId) {
        throw new HTTPException(404, { message: `Version with id ${versionId} not found for scorer ${scorerId}` });
      }

      // Update the scorer with the snapshot from the version to restore
      // Exclude id, createdAt, updatedAt, and activeVersionId from the snapshot
      // (activeVersionId from old snapshot may reference a stale/deleted version)
      const {
        id: _id,
        createdAt: _createdAt,
        updatedAt: _updatedAt,
        activeVersionId: _activeVersionId,
        ...snapshotData
      } = versionToRestore.snapshot;
      await scorersStore.updateScorer({
        id: scorerId,
        ...snapshotData,
      });

      // Get the updated scorer
      const updatedScorer = await scorersStore.getScorerById({ id: scorerId });
      if (!updatedScorer) {
        throw new HTTPException(500, { message: 'Failed to retrieve updated scorer' });
      }

      // Get the latest version to calculate changed fields
      const latestVersion = await scorersStore.getLatestScorerVersion(scorerId);
      const changedFields = calculateChangedFields(
        latestVersion?.snapshot as Record<string, unknown> | undefined,
        updatedScorer as unknown as Record<string, unknown>,
      );

      // Create a new version with retry logic to handle race conditions
      const { versionId: newVersionId } = await createVersionWithRetry(
        scorersStore,
        scorerId,
        updatedScorer,
        changedFields,
        {
          changeMessage: `Restored from version ${versionToRestore.versionNumber}${versionToRestore.name ? ` (${versionToRestore.name})` : ''}`,
        },
      );

      // Update the scorer's activeVersionId to the new version
      await scorersStore.updateScorer({
        id: scorerId,
        activeVersionId: newVersionId,
      });

      // Get the created version to return
      const newVersion = await scorersStore.getScorerVersion(newVersionId);
      if (!newVersion) {
        throw new HTTPException(500, { message: 'Failed to retrieve created version' });
      }

      return newVersion;
    } catch (error) {
      return handleError(error, 'Error restoring scorer version');
    }
  },
});

/**
 * DELETE /api/stored/scorers/:scorerId/versions/:versionId - Delete a version
 */
export const DELETE_SCORER_VERSION_ROUTE = createRoute({
  method: 'DELETE',
  path: '/api/stored/scorers/:scorerId/versions/:versionId',
  responseType: 'json',
  pathParamSchema: scorerVersionIdPathParams,
  responseSchema: deleteScorerVersionResponseSchema,
  summary: 'Delete scorer version',
  description: 'Deletes a specific version (cannot delete the active version)',
  tags: ['Scorer Versions'],
  handler: async ({ mastra, scorerId, versionId }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const scorersStore = await storage.getStore('storedScorers');
      if (!scorersStore) {
        throw new HTTPException(500, { message: 'Stored scorers storage domain is not available' });
      }

      // Verify scorer exists
      const scorer = await scorersStore.getScorerById({ id: scorerId });
      if (!scorer) {
        throw new HTTPException(404, { message: `Scorer with id ${scorerId} not found` });
      }

      // Verify version exists and belongs to this scorer
      const version = await scorersStore.getScorerVersion(versionId);
      if (!version) {
        throw new HTTPException(404, { message: `Version with id ${versionId} not found` });
      }
      if (version.scorerId !== scorerId) {
        throw new HTTPException(404, { message: `Version with id ${versionId} not found for scorer ${scorerId}` });
      }

      // Check if this is the active version
      if (scorer.activeVersionId === versionId) {
        throw new HTTPException(400, {
          message: 'Cannot delete the active version. Activate a different version first.',
        });
      }

      await scorersStore.deleteScorerVersion(versionId);

      return {
        success: true,
        message: `Version ${version.versionNumber} deleted successfully`,
      };
    } catch (error) {
      return handleError(error, 'Error deleting scorer version');
    }
  },
});
