import { HTTPException } from '../http-exception';
import {
  promptBlockVersionPathParams,
  promptBlockVersionIdPathParams,
  listPromptBlockVersionsQuerySchema,
  createPromptBlockVersionBodySchema,
  comparePromptBlockVersionsQuerySchema,
  listPromptBlockVersionsResponseSchema,
  getPromptBlockVersionResponseSchema,
  createPromptBlockVersionResponseSchema,
  activatePromptBlockVersionResponseSchema,
  restorePromptBlockVersionResponseSchema,
  deletePromptBlockVersionResponseSchema,
  comparePromptBlockVersionsResponseSchema,
} from '../schemas/prompt-block-versions';
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

const SNAPSHOT_CONFIG_FIELDS = ['name', 'description', 'content', 'rules'] as const;

/**
 * GET /stored/prompt-blocks/:promptBlockId/versions - List all versions for a prompt block
 */
export const LIST_PROMPT_BLOCK_VERSIONS_ROUTE = createRoute({
  method: 'GET',
  path: '/stored/prompt-blocks/:promptBlockId/versions',
  requiresAuth: true,
  responseType: 'json',
  pathParamSchema: promptBlockVersionPathParams,
  queryParamSchema: listPromptBlockVersionsQuerySchema,
  responseSchema: listPromptBlockVersionsResponseSchema,
  summary: 'List prompt block versions',
  description: 'Returns a paginated list of all versions for a stored prompt block',
  tags: ['Prompt Block Versions'],
  handler: async ({ mastra, promptBlockId, page, perPage, orderBy }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const promptBlockStore = await storage.getStore('promptBlocks');
      if (!promptBlockStore) {
        throw new HTTPException(500, { message: 'Prompt blocks storage domain is not available' });
      }

      const promptBlock = await promptBlockStore.getById(promptBlockId);
      if (!promptBlock) {
        throw new HTTPException(404, { message: `Prompt block with id ${promptBlockId} not found` });
      }

      const result = await promptBlockStore.listVersions({
        blockId: promptBlockId,
        page,
        perPage,
        orderBy,
      });

      return result;
    } catch (error) {
      return handleError(error, 'Error listing prompt block versions');
    }
  },
});

/**
 * POST /stored/prompt-blocks/:promptBlockId/versions - Create a new version snapshot
 */
export const CREATE_PROMPT_BLOCK_VERSION_ROUTE = createRoute({
  method: 'POST',
  path: '/stored/prompt-blocks/:promptBlockId/versions',
  requiresAuth: true,
  responseType: 'json',
  pathParamSchema: promptBlockVersionPathParams,
  bodySchema: createPromptBlockVersionBodySchema,
  responseSchema: createPromptBlockVersionResponseSchema,
  summary: 'Create prompt block version',
  description: 'Creates a new version snapshot of the current prompt block configuration',
  tags: ['Prompt Block Versions'],
  handler: async ({ mastra, promptBlockId, changeMessage }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const promptBlockStore = await storage.getStore('promptBlocks');
      if (!promptBlockStore) {
        throw new HTTPException(500, { message: 'Prompt blocks storage domain is not available' });
      }

      const promptBlock = await promptBlockStore.getById(promptBlockId);
      if (!promptBlock) {
        throw new HTTPException(404, { message: `Prompt block with id ${promptBlockId} not found` });
      }

      let currentConfig: Record<string, unknown> = {};
      if (promptBlock.activeVersionId) {
        const activeVersion = await promptBlockStore.getVersion(promptBlock.activeVersionId);
        if (activeVersion) {
          currentConfig = extractConfigFromVersion(
            activeVersion as unknown as Record<string, unknown>,
            SNAPSHOT_CONFIG_FIELDS,
          );
        }
      }

      const latestVersion = await promptBlockStore.getLatestVersion(promptBlockId);

      // If no activeVersionId, fall back to latest version config
      if (!promptBlock.activeVersionId && latestVersion) {
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
        promptBlockStore as unknown as VersionedStoreInterface,
        promptBlockId,
        'blockId',
        currentConfig,
        changedFields,
        { changeMessage },
      );

      const version = await promptBlockStore.getVersion(versionId);
      if (!version) {
        throw new HTTPException(500, { message: 'Failed to retrieve created version' });
      }

      await enforceRetentionLimit(
        promptBlockStore as unknown as VersionedStoreInterface,
        promptBlockId,
        'blockId',
        promptBlock.activeVersionId,
      );

      return version;
    } catch (error) {
      return handleError(error, 'Error creating prompt block version');
    }
  },
});

/**
 * GET /stored/prompt-blocks/:promptBlockId/versions/:versionId - Get a specific version
 */
export const GET_PROMPT_BLOCK_VERSION_ROUTE = createRoute({
  method: 'GET',
  path: '/stored/prompt-blocks/:promptBlockId/versions/:versionId',
  requiresAuth: true,
  responseType: 'json',
  pathParamSchema: promptBlockVersionIdPathParams,
  responseSchema: getPromptBlockVersionResponseSchema,
  summary: 'Get prompt block version',
  description: 'Returns a specific version of a prompt block by its version ID',
  tags: ['Prompt Block Versions'],
  handler: async ({ mastra, promptBlockId, versionId }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const promptBlockStore = await storage.getStore('promptBlocks');
      if (!promptBlockStore) {
        throw new HTTPException(500, { message: 'Prompt blocks storage domain is not available' });
      }

      const version = await promptBlockStore.getVersion(versionId);

      if (!version) {
        throw new HTTPException(404, { message: `Version with id ${versionId} not found` });
      }

      if (version.blockId !== promptBlockId) {
        throw new HTTPException(404, {
          message: `Version with id ${versionId} not found for prompt block ${promptBlockId}`,
        });
      }

      return version;
    } catch (error) {
      return handleError(error, 'Error getting prompt block version');
    }
  },
});

/**
 * POST /stored/prompt-blocks/:promptBlockId/versions/:versionId/activate - Set a version as active
 */
export const ACTIVATE_PROMPT_BLOCK_VERSION_ROUTE = createRoute({
  method: 'POST',
  path: '/stored/prompt-blocks/:promptBlockId/versions/:versionId/activate',
  requiresAuth: true,
  responseType: 'json',
  pathParamSchema: promptBlockVersionIdPathParams,
  responseSchema: activatePromptBlockVersionResponseSchema,
  summary: 'Activate prompt block version',
  description: 'Sets a specific version as the active version for the prompt block',
  tags: ['Prompt Block Versions'],
  handler: async ({ mastra, promptBlockId, versionId }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const promptBlockStore = await storage.getStore('promptBlocks');
      if (!promptBlockStore) {
        throw new HTTPException(500, { message: 'Prompt blocks storage domain is not available' });
      }

      const promptBlock = await promptBlockStore.getById(promptBlockId);
      if (!promptBlock) {
        throw new HTTPException(404, { message: `Prompt block with id ${promptBlockId} not found` });
      }

      const version = await promptBlockStore.getVersion(versionId);
      if (!version) {
        throw new HTTPException(404, { message: `Version with id ${versionId} not found` });
      }
      if (version.blockId !== promptBlockId) {
        throw new HTTPException(404, {
          message: `Version with id ${versionId} not found for prompt block ${promptBlockId}`,
        });
      }

      await promptBlockStore.update({
        id: promptBlockId,
        activeVersionId: versionId,
        status: 'published',
      });

      // Clear the editor cache so subsequent requests see the new active version
      mastra.getEditor()?.prompt.clearCache(promptBlockId);

      return {
        success: true,
        message: `Version ${version.versionNumber} is now active`,
        activeVersionId: versionId,
      };
    } catch (error) {
      return handleError(error, 'Error activating prompt block version');
    }
  },
});

/**
 * POST /stored/prompt-blocks/:promptBlockId/versions/:versionId/restore - Restore prompt block to a version
 */
export const RESTORE_PROMPT_BLOCK_VERSION_ROUTE = createRoute({
  method: 'POST',
  path: '/stored/prompt-blocks/:promptBlockId/versions/:versionId/restore',
  requiresAuth: true,
  responseType: 'json',
  pathParamSchema: promptBlockVersionIdPathParams,
  responseSchema: restorePromptBlockVersionResponseSchema,
  summary: 'Restore prompt block version',
  description: 'Restores the prompt block configuration from a version, creating a new version',
  tags: ['Prompt Block Versions'],
  handler: async ({ mastra, promptBlockId, versionId }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const promptBlockStore = await storage.getStore('promptBlocks');
      if (!promptBlockStore) {
        throw new HTTPException(500, { message: 'Prompt blocks storage domain is not available' });
      }

      const promptBlock = await promptBlockStore.getById(promptBlockId);
      if (!promptBlock) {
        throw new HTTPException(404, { message: `Prompt block with id ${promptBlockId} not found` });
      }

      const versionToRestore = await promptBlockStore.getVersion(versionId);
      if (!versionToRestore) {
        throw new HTTPException(404, { message: `Version with id ${versionId} not found` });
      }
      if (versionToRestore.blockId !== promptBlockId) {
        throw new HTTPException(404, {
          message: `Version with id ${versionId} not found for prompt block ${promptBlockId}`,
        });
      }

      const restoredConfig = extractConfigFromVersion(
        versionToRestore as unknown as Record<string, unknown>,
        SNAPSHOT_CONFIG_FIELDS,
      );

      await promptBlockStore.update({
        id: promptBlockId,
        ...restoredConfig,
      });

      const latestVersion = await promptBlockStore.getLatestVersion(promptBlockId);
      const previousConfig = latestVersion
        ? extractConfigFromVersion(latestVersion as unknown as Record<string, unknown>, SNAPSHOT_CONFIG_FIELDS)
        : null;

      const changedFields = calculateChangedFields(previousConfig, restoredConfig);

      const { versionId: newVersionId } = await createVersionWithRetry(
        promptBlockStore as unknown as VersionedStoreInterface,
        promptBlockId,
        'blockId',
        restoredConfig,
        changedFields,
        {
          changeMessage: `Restored from version ${versionToRestore.versionNumber}`,
        },
      );

      const newVersion = await promptBlockStore.getVersion(newVersionId);
      if (!newVersion) {
        throw new HTTPException(500, { message: 'Failed to retrieve created version' });
      }

      await enforceRetentionLimit(
        promptBlockStore as unknown as VersionedStoreInterface,
        promptBlockId,
        'blockId',
        promptBlock.activeVersionId,
      );

      // Clear the editor cache so subsequent requests see the updated config
      mastra.getEditor()?.prompt.clearCache(promptBlockId);

      return newVersion;
    } catch (error) {
      return handleError(error, 'Error restoring prompt block version');
    }
  },
});

/**
 * DELETE /stored/prompt-blocks/:promptBlockId/versions/:versionId - Delete a version
 */
export const DELETE_PROMPT_BLOCK_VERSION_ROUTE = createRoute({
  method: 'DELETE',
  path: '/stored/prompt-blocks/:promptBlockId/versions/:versionId',
  requiresAuth: true,
  responseType: 'json',
  pathParamSchema: promptBlockVersionIdPathParams,
  responseSchema: deletePromptBlockVersionResponseSchema,
  summary: 'Delete prompt block version',
  description: 'Deletes a specific version (cannot delete the active version)',
  tags: ['Prompt Block Versions'],
  handler: async ({ mastra, promptBlockId, versionId }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const promptBlockStore = await storage.getStore('promptBlocks');
      if (!promptBlockStore) {
        throw new HTTPException(500, { message: 'Prompt blocks storage domain is not available' });
      }

      const promptBlock = await promptBlockStore.getById(promptBlockId);
      if (!promptBlock) {
        throw new HTTPException(404, { message: `Prompt block with id ${promptBlockId} not found` });
      }

      const version = await promptBlockStore.getVersion(versionId);
      if (!version) {
        throw new HTTPException(404, { message: `Version with id ${versionId} not found` });
      }
      if (version.blockId !== promptBlockId) {
        throw new HTTPException(404, {
          message: `Version with id ${versionId} not found for prompt block ${promptBlockId}`,
        });
      }

      if (promptBlock.activeVersionId === versionId) {
        throw new HTTPException(400, {
          message: 'Cannot delete the active version. Activate a different version first.',
        });
      }

      await promptBlockStore.deleteVersion(versionId);

      // Clear the editor cache so subsequent requests see the updated config
      mastra.getEditor()?.prompt.clearCache(promptBlockId);

      return {
        success: true,
        message: `Version ${version.versionNumber} deleted successfully`,
      };
    } catch (error) {
      return handleError(error, 'Error deleting prompt block version');
    }
  },
});

/**
 * GET /stored/prompt-blocks/:promptBlockId/versions/compare - Compare two versions
 */
export const COMPARE_PROMPT_BLOCK_VERSIONS_ROUTE = createRoute({
  method: 'GET',
  path: '/stored/prompt-blocks/:promptBlockId/versions/compare',
  requiresAuth: true,
  responseType: 'json',
  pathParamSchema: promptBlockVersionPathParams,
  queryParamSchema: comparePromptBlockVersionsQuerySchema,
  responseSchema: comparePromptBlockVersionsResponseSchema,
  summary: 'Compare prompt block versions',
  description: 'Compares two versions and returns the differences between them',
  tags: ['Prompt Block Versions'],
  handler: async ({ mastra, promptBlockId, from, to }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const promptBlockStore = await storage.getStore('promptBlocks');
      if (!promptBlockStore) {
        throw new HTTPException(500, { message: 'Prompt blocks storage domain is not available' });
      }

      const fromVersion = await promptBlockStore.getVersion(from);
      if (!fromVersion) {
        throw new HTTPException(404, { message: `Version with id ${from} not found` });
      }
      if (fromVersion.blockId !== promptBlockId) {
        throw new HTTPException(404, {
          message: `Version with id ${from} not found for prompt block ${promptBlockId}`,
        });
      }

      const toVersion = await promptBlockStore.getVersion(to);
      if (!toVersion) {
        throw new HTTPException(404, { message: `Version with id ${to} not found` });
      }
      if (toVersion.blockId !== promptBlockId) {
        throw new HTTPException(404, {
          message: `Version with id ${to} not found for prompt block ${promptBlockId}`,
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
      return handleError(error, 'Error comparing prompt block versions');
    }
  },
});
