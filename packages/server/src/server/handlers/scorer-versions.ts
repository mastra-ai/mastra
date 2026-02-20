import { HTTPException } from '../http-exception';
import {
  scorerVersionPathParams,
  scorerVersionIdPathParams,
  listScorerVersionsQuerySchema,
  createScorerVersionBodySchema,
  compareScorerVersionsQuerySchema,
  listScorerVersionsResponseSchema,
  getScorerVersionResponseSchema,
  createScorerVersionResponseSchema,
  activateScorerVersionResponseSchema,
  restoreScorerVersionResponseSchema,
  deleteScorerVersionResponseSchema,
  compareScorerVersionsResponseSchema,
} from '../schemas/scorer-versions';
import { createRoute } from '../server-adapter/routes/route-builder';

import { handleError } from './error';
import {
  extractConfigFromVersion,
  calculateChangedFields,
  computeVersionDiffs,
  createVersionWithRetry,
  enforceRetentionLimit,
} from './version-helpers';
import type { VersionedStoreInterface } from './version-helpers';

const SNAPSHOT_CONFIG_FIELDS = [
  'name',
  'description',
  'type',
  'model',
  'instructions',
  'scoreRange',
  'presetConfig',
  'defaultSampling',
] as const;

/**
 * GET /stored/scorers/:scorerId/versions - List all versions for a scorer
 */
export const LIST_SCORER_VERSIONS_ROUTE = createRoute({
  method: 'GET',
  path: '/stored/scorers/:scorerId/versions',
  requiresAuth: true,
  responseType: 'json',
  pathParamSchema: scorerVersionPathParams,
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

      const scorerStore = await storage.getStore('scorerDefinitions');
      if (!scorerStore) {
        throw new HTTPException(500, { message: 'Scorer definitions storage domain is not available' });
      }

      const scorer = await scorerStore.getById(scorerId);
      if (!scorer) {
        throw new HTTPException(404, { message: `Scorer with id ${scorerId} not found` });
      }

      const result = await scorerStore.listVersions({
        scorerDefinitionId: scorerId,
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
 * POST /stored/scorers/:scorerId/versions - Create a new version snapshot
 */
export const CREATE_SCORER_VERSION_ROUTE = createRoute({
  method: 'POST',
  path: '/stored/scorers/:scorerId/versions',
  requiresAuth: true,
  responseType: 'json',
  pathParamSchema: scorerVersionPathParams,
  bodySchema: createScorerVersionBodySchema,
  responseSchema: createScorerVersionResponseSchema,
  summary: 'Create scorer version',
  description: 'Creates a new version snapshot of the current scorer configuration',
  tags: ['Scorer Versions'],
  handler: async ({ mastra, scorerId, changeMessage }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const scorerStore = await storage.getStore('scorerDefinitions');
      if (!scorerStore) {
        throw new HTTPException(500, { message: 'Scorer definitions storage domain is not available' });
      }

      const scorer = await scorerStore.getById(scorerId);
      if (!scorer) {
        throw new HTTPException(404, { message: `Scorer with id ${scorerId} not found` });
      }

      let currentConfig: Record<string, unknown> = {};
      if (scorer.activeVersionId) {
        const activeVersion = await scorerStore.getVersion(scorer.activeVersionId);
        if (activeVersion) {
          currentConfig = extractConfigFromVersion(
            activeVersion as unknown as Record<string, unknown>,
            SNAPSHOT_CONFIG_FIELDS,
          );
        }
      }

      const latestVersion = await scorerStore.getLatestVersion(scorerId);

      // If no activeVersionId, fall back to latest version config
      if (!scorer.activeVersionId && latestVersion) {
        currentConfig = extractConfigFromVersion(
          latestVersion as unknown as Record<string, unknown>,
          SNAPSHOT_CONFIG_FIELDS,
        );
      }
      const previousConfig = latestVersion
        ? extractConfigFromVersion(latestVersion as unknown as Record<string, unknown>, SNAPSHOT_CONFIG_FIELDS)
        : null;

      const changedFields = calculateChangedFields(previousConfig, currentConfig);

      const { versionId } = await createVersionWithRetry(
        scorerStore as unknown as VersionedStoreInterface,
        scorerId,
        'scorerDefinitionId',
        currentConfig,
        changedFields,
        { changeMessage },
      );

      const version = await scorerStore.getVersion(versionId);
      if (!version) {
        throw new HTTPException(500, { message: 'Failed to retrieve created version' });
      }

      await enforceRetentionLimit(
        scorerStore as unknown as VersionedStoreInterface,
        scorerId,
        'scorerDefinitionId',
        scorer.activeVersionId,
      );

      return version;
    } catch (error) {
      return handleError(error, 'Error creating scorer version');
    }
  },
});

/**
 * GET /stored/scorers/:scorerId/versions/:versionId - Get a specific version
 */
export const GET_SCORER_VERSION_ROUTE = createRoute({
  method: 'GET',
  path: '/stored/scorers/:scorerId/versions/:versionId',
  requiresAuth: true,
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

      const scorerStore = await storage.getStore('scorerDefinitions');
      if (!scorerStore) {
        throw new HTTPException(500, { message: 'Scorer definitions storage domain is not available' });
      }

      const version = await scorerStore.getVersion(versionId);

      if (!version) {
        throw new HTTPException(404, { message: `Version with id ${versionId} not found` });
      }

      if (version.scorerDefinitionId !== scorerId) {
        throw new HTTPException(404, {
          message: `Version with id ${versionId} not found for scorer ${scorerId}`,
        });
      }

      return version;
    } catch (error) {
      return handleError(error, 'Error getting scorer version');
    }
  },
});

/**
 * POST /stored/scorers/:scorerId/versions/:versionId/activate - Set a version as active
 */
export const ACTIVATE_SCORER_VERSION_ROUTE = createRoute({
  method: 'POST',
  path: '/stored/scorers/:scorerId/versions/:versionId/activate',
  requiresAuth: true,
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

      const scorerStore = await storage.getStore('scorerDefinitions');
      if (!scorerStore) {
        throw new HTTPException(500, { message: 'Scorer definitions storage domain is not available' });
      }

      const scorer = await scorerStore.getById(scorerId);
      if (!scorer) {
        throw new HTTPException(404, { message: `Scorer with id ${scorerId} not found` });
      }

      const version = await scorerStore.getVersion(versionId);
      if (!version) {
        throw new HTTPException(404, { message: `Version with id ${versionId} not found` });
      }
      if (version.scorerDefinitionId !== scorerId) {
        throw new HTTPException(404, {
          message: `Version with id ${versionId} not found for scorer ${scorerId}`,
        });
      }

      await scorerStore.update({
        id: scorerId,
        activeVersionId: versionId,
        status: 'published',
      });

      // Clear the editor cache so subsequent requests see the new active version
      mastra.getEditor()?.scorer.clearCache(scorerId);

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
 * POST /stored/scorers/:scorerId/versions/:versionId/restore - Restore scorer to a version
 */
export const RESTORE_SCORER_VERSION_ROUTE = createRoute({
  method: 'POST',
  path: '/stored/scorers/:scorerId/versions/:versionId/restore',
  requiresAuth: true,
  responseType: 'json',
  pathParamSchema: scorerVersionIdPathParams,
  responseSchema: restoreScorerVersionResponseSchema,
  summary: 'Restore scorer version',
  description: 'Restores the scorer configuration from a version, creating a new version',
  tags: ['Scorer Versions'],
  handler: async ({ mastra, scorerId, versionId }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const scorerStore = await storage.getStore('scorerDefinitions');
      if (!scorerStore) {
        throw new HTTPException(500, { message: 'Scorer definitions storage domain is not available' });
      }

      const scorer = await scorerStore.getById(scorerId);
      if (!scorer) {
        throw new HTTPException(404, { message: `Scorer with id ${scorerId} not found` });
      }

      const versionToRestore = await scorerStore.getVersion(versionId);
      if (!versionToRestore) {
        throw new HTTPException(404, { message: `Version with id ${versionId} not found` });
      }
      if (versionToRestore.scorerDefinitionId !== scorerId) {
        throw new HTTPException(404, {
          message: `Version with id ${versionId} not found for scorer ${scorerId}`,
        });
      }

      const restoredConfig = extractConfigFromVersion(
        versionToRestore as unknown as Record<string, unknown>,
        SNAPSHOT_CONFIG_FIELDS,
      );

      await scorerStore.update({
        id: scorerId,
        ...restoredConfig,
      });

      const latestVersion = await scorerStore.getLatestVersion(scorerId);
      const previousConfig = latestVersion
        ? extractConfigFromVersion(latestVersion as unknown as Record<string, unknown>, SNAPSHOT_CONFIG_FIELDS)
        : null;

      const changedFields = calculateChangedFields(previousConfig, restoredConfig);

      const { versionId: newVersionId } = await createVersionWithRetry(
        scorerStore as unknown as VersionedStoreInterface,
        scorerId,
        'scorerDefinitionId',
        restoredConfig,
        changedFields,
        {
          changeMessage: `Restored from version ${versionToRestore.versionNumber}`,
        },
      );

      const newVersion = await scorerStore.getVersion(newVersionId);
      if (!newVersion) {
        throw new HTTPException(500, { message: 'Failed to retrieve created version' });
      }

      await enforceRetentionLimit(
        scorerStore as unknown as VersionedStoreInterface,
        scorerId,
        'scorerDefinitionId',
        scorer.activeVersionId,
      );

      // Clear the editor cache so subsequent requests see the updated config
      mastra.getEditor()?.scorer.clearCache(scorerId);

      return newVersion;
    } catch (error) {
      return handleError(error, 'Error restoring scorer version');
    }
  },
});

/**
 * DELETE /stored/scorers/:scorerId/versions/:versionId - Delete a version
 */
export const DELETE_SCORER_VERSION_ROUTE = createRoute({
  method: 'DELETE',
  path: '/stored/scorers/:scorerId/versions/:versionId',
  requiresAuth: true,
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

      const scorerStore = await storage.getStore('scorerDefinitions');
      if (!scorerStore) {
        throw new HTTPException(500, { message: 'Scorer definitions storage domain is not available' });
      }

      const scorer = await scorerStore.getById(scorerId);
      if (!scorer) {
        throw new HTTPException(404, { message: `Scorer with id ${scorerId} not found` });
      }

      const version = await scorerStore.getVersion(versionId);
      if (!version) {
        throw new HTTPException(404, { message: `Version with id ${versionId} not found` });
      }
      if (version.scorerDefinitionId !== scorerId) {
        throw new HTTPException(404, {
          message: `Version with id ${versionId} not found for scorer ${scorerId}`,
        });
      }

      if (scorer.activeVersionId === versionId) {
        throw new HTTPException(400, {
          message: 'Cannot delete the active version. Activate a different version first.',
        });
      }

      await scorerStore.deleteVersion(versionId);

      // Clear the editor cache so subsequent requests see the updated config
      mastra.getEditor()?.scorer.clearCache(scorerId);

      return {
        success: true,
        message: `Version ${version.versionNumber} deleted successfully`,
      };
    } catch (error) {
      return handleError(error, 'Error deleting scorer version');
    }
  },
});

/**
 * GET /stored/scorers/:scorerId/versions/compare - Compare two versions
 */
export const COMPARE_SCORER_VERSIONS_ROUTE = createRoute({
  method: 'GET',
  path: '/stored/scorers/:scorerId/versions/compare',
  requiresAuth: true,
  responseType: 'json',
  pathParamSchema: scorerVersionPathParams,
  queryParamSchema: compareScorerVersionsQuerySchema,
  responseSchema: compareScorerVersionsResponseSchema,
  summary: 'Compare scorer versions',
  description: 'Compares two versions and returns the differences between them',
  tags: ['Scorer Versions'],
  handler: async ({ mastra, scorerId, from, to }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const scorerStore = await storage.getStore('scorerDefinitions');
      if (!scorerStore) {
        throw new HTTPException(500, { message: 'Scorer definitions storage domain is not available' });
      }

      const fromVersion = await scorerStore.getVersion(from);
      if (!fromVersion) {
        throw new HTTPException(404, { message: `Version with id ${from} not found` });
      }
      if (fromVersion.scorerDefinitionId !== scorerId) {
        throw new HTTPException(404, {
          message: `Version with id ${from} not found for scorer ${scorerId}`,
        });
      }

      const toVersion = await scorerStore.getVersion(to);
      if (!toVersion) {
        throw new HTTPException(404, { message: `Version with id ${to} not found` });
      }
      if (toVersion.scorerDefinitionId !== scorerId) {
        throw new HTTPException(404, {
          message: `Version with id ${to} not found for scorer ${scorerId}`,
        });
      }

      const fromConfig = extractConfigFromVersion(
        fromVersion as unknown as Record<string, unknown>,
        SNAPSHOT_CONFIG_FIELDS,
      );
      const toConfig = extractConfigFromVersion(
        toVersion as unknown as Record<string, unknown>,
        SNAPSHOT_CONFIG_FIELDS,
      );

      const diffs = computeVersionDiffs(fromConfig, toConfig);

      return {
        diffs,
        fromVersion,
        toVersion,
      };
    } catch (error) {
      return handleError(error, 'Error comparing scorer versions');
    }
  },
});
