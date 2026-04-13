import { HTTPException } from '../http-exception';
import {
  storedPromptBlockIdPathParams,
  statusQuerySchema,
  listStoredPromptBlocksQuerySchema,
  createStoredPromptBlockBodySchema,
  updateStoredPromptBlockBodySchema,
  listStoredPromptBlocksResponseSchema,
  getStoredPromptBlockResponseSchema,
  createStoredPromptBlockResponseSchema,
  updateStoredPromptBlockResponseSchema,
  deleteStoredPromptBlockResponseSchema,
} from '../schemas/stored-prompt-blocks';
import { createRoute } from '../server-adapter/routes/route-builder';
import { toSlug } from '../utils';

import { handleError } from './error';
import { handleAutoVersioning } from './version-helpers';
import type { VersionedStoreInterface } from './version-helpers';

const PROMPT_BLOCK_SNAPSHOT_CONFIG_FIELDS = [
  'name',
  'description',
  'content',
  'rules',
  'requestContextSchema',
] as const;

/** Computes whether a prompt block has an unpublished draft version. */
function computeHasDraft(
  latestVersion: { id: string } | null | undefined,
  activeVersionId: string | null | undefined,
): boolean {
  return !!(latestVersion && (!activeVersionId || latestVersion.id !== activeVersionId));
}

// ============================================================================
// Route Definitions
// ============================================================================

/**
 * GET /stored/prompt-blocks - List all stored prompt blocks
 */
export const LIST_STORED_PROMPT_BLOCKS_ROUTE = createRoute({
  method: 'GET',
  path: '/stored/prompt-blocks',
  responseType: 'json',
  queryParamSchema: listStoredPromptBlocksQuerySchema,
  responseSchema: listStoredPromptBlocksResponseSchema,
  summary: 'List stored prompt blocks',
  description: 'Returns a paginated list of all prompt blocks stored in the database',
  tags: ['Stored Prompt Blocks'],
  requiresAuth: true,
  handler: async ({ mastra, page, perPage, orderBy, status, authorId, metadata }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const promptBlockStore = await storage.getStore('promptBlocks');
      if (!promptBlockStore) {
        throw new HTTPException(500, { message: 'Prompt blocks storage domain is not available' });
      }

      const result = await promptBlockStore.listResolved({
        page,
        perPage,
        orderBy,
        status,
        authorId,
        metadata,
      });

      // For each block, fetch the latest version to compute hasDraft.
      // resolvedVersionId from listResolved defaults to 'published' resolution,
      // so we need the actual latest version to detect unpublished drafts.
      const promptBlocks = await Promise.all(
        result.promptBlocks.map(async (block: (typeof result.promptBlocks)[number]) => {
          const latestVersion = await promptBlockStore.getLatestVersion(block.id);
          return { ...block, hasDraft: computeHasDraft(latestVersion, block.activeVersionId) };
        }),
      );

      return { ...result, promptBlocks };
    } catch (error) {
      return handleError(error, 'Error listing stored prompt blocks');
    }
  },
});

/**
 * GET /stored/prompt-blocks/:storedPromptBlockId - Get a stored prompt block by ID
 */
export const GET_STORED_PROMPT_BLOCK_ROUTE = createRoute({
  method: 'GET',
  path: '/stored/prompt-blocks/:storedPromptBlockId',
  responseType: 'json',
  pathParamSchema: storedPromptBlockIdPathParams,
  queryParamSchema: statusQuerySchema,
  responseSchema: getStoredPromptBlockResponseSchema,
  summary: 'Get stored prompt block by ID',
  description:
    'Returns a specific prompt block from storage by its unique identifier. Use ?status=draft to resolve with the latest (draft) version, or ?status=published (default) for the active published version.',
  tags: ['Stored Prompt Blocks'],
  requiresAuth: true,
  handler: async ({ mastra, storedPromptBlockId, status }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const promptBlockStore = await storage.getStore('promptBlocks');
      if (!promptBlockStore) {
        throw new HTTPException(500, { message: 'Prompt blocks storage domain is not available' });
      }

      const promptBlock = await promptBlockStore.getByIdResolved(storedPromptBlockId, { status });

      if (!promptBlock) {
        throw new HTTPException(404, { message: `Stored prompt block with id ${storedPromptBlockId} not found` });
      }

      const latestVersion = await promptBlockStore.getLatestVersion(storedPromptBlockId);

      return { ...promptBlock, hasDraft: computeHasDraft(latestVersion, promptBlock.activeVersionId) };
    } catch (error) {
      return handleError(error, 'Error getting stored prompt block');
    }
  },
});

/**
 * POST /stored/prompt-blocks - Create a new stored prompt block
 */
export const CREATE_STORED_PROMPT_BLOCK_ROUTE = createRoute({
  method: 'POST',
  path: '/stored/prompt-blocks',
  responseType: 'json',
  bodySchema: createStoredPromptBlockBodySchema,
  responseSchema: createStoredPromptBlockResponseSchema,
  summary: 'Create stored prompt block',
  description: 'Creates a new prompt block in storage with the provided configuration',
  tags: ['Stored Prompt Blocks'],
  requiresAuth: true,
  handler: async ({
    mastra,
    id: providedId,
    authorId,
    metadata,
    name,
    description,
    content,
    rules,
    requestContextSchema,
  }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const promptBlockStore = await storage.getStore('promptBlocks');
      if (!promptBlockStore) {
        throw new HTTPException(500, { message: 'Prompt blocks storage domain is not available' });
      }

      // Derive ID from name if not explicitly provided
      const id = providedId || toSlug(name);

      if (!id) {
        throw new HTTPException(400, {
          message: 'Could not derive prompt block ID from name. Please provide an explicit id.',
        });
      }

      // Check if prompt block with this ID already exists
      const existing = await promptBlockStore.getById(id);
      if (existing) {
        throw new HTTPException(409, { message: `Prompt block with id ${id} already exists` });
      }

      await promptBlockStore.create({
        promptBlock: {
          id,
          authorId,
          metadata,
          name,
          description,
          content,
          rules,
          requestContextSchema,
        },
      });

      // Return the resolved prompt block (thin record + version config)
      // Use draft status since newly created entities start as drafts
      const resolved = await promptBlockStore.getByIdResolved(id, { status: 'draft' });
      if (!resolved) {
        throw new HTTPException(500, { message: 'Failed to resolve created prompt block' });
      }

      const latestVersion = await promptBlockStore.getLatestVersion(id);
      const hasDraft = !!(
        latestVersion &&
        (!resolved.activeVersionId || latestVersion.id !== resolved.activeVersionId)
      );

      return { ...resolved, hasDraft };
    } catch (error) {
      return handleError(error, 'Error creating stored prompt block');
    }
  },
});

/**
 * PATCH /stored/prompt-blocks/:storedPromptBlockId - Update a stored prompt block
 */
export const UPDATE_STORED_PROMPT_BLOCK_ROUTE = createRoute({
  method: 'PATCH',
  path: '/stored/prompt-blocks/:storedPromptBlockId',
  responseType: 'json',
  pathParamSchema: storedPromptBlockIdPathParams,
  bodySchema: updateStoredPromptBlockBodySchema,
  responseSchema: updateStoredPromptBlockResponseSchema,
  summary: 'Update stored prompt block',
  description: 'Updates an existing prompt block in storage with the provided fields',
  tags: ['Stored Prompt Blocks'],
  requiresAuth: true,
  handler: async ({
    mastra,
    storedPromptBlockId,
    // Metadata-level fields
    authorId,
    metadata,
    // Config fields (snapshot-level)
    name,
    description,
    content,
    rules,
    requestContextSchema,
  }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const promptBlockStore = await storage.getStore('promptBlocks');
      if (!promptBlockStore) {
        throw new HTTPException(500, { message: 'Prompt blocks storage domain is not available' });
      }

      // Check if prompt block exists
      const existing = await promptBlockStore.getById(storedPromptBlockId);
      if (!existing) {
        throw new HTTPException(404, { message: `Stored prompt block with id ${storedPromptBlockId} not found` });
      }

      // Update the prompt block with both metadata-level and config-level fields
      const updatedPromptBlock = await promptBlockStore.update({
        id: storedPromptBlockId,
        authorId,
        metadata,
        name,
        description,
        content,
        rules,
        requestContextSchema,
      });

      // Build the snapshot config for auto-versioning comparison
      const configFields = { name, description, content, rules, requestContextSchema };

      // Filter out undefined values to get only the config fields that were provided
      const providedConfigFields = Object.fromEntries(Object.entries(configFields).filter(([_, v]) => v !== undefined));

      // Handle auto-versioning with retry logic for race conditions
      // This creates a new version if there are meaningful config changes.
      // It does NOT update activeVersionId — the version stays as a draft until explicitly published.
      await handleAutoVersioning(
        promptBlockStore as unknown as VersionedStoreInterface,
        storedPromptBlockId,
        'blockId',
        PROMPT_BLOCK_SNAPSHOT_CONFIG_FIELDS,
        existing,
        updatedPromptBlock,
        providedConfigFields,
      );

      // Return the resolved prompt block with the latest (draft) version so the UI sees its edits
      const resolved = await promptBlockStore.getByIdResolved(storedPromptBlockId, { status: 'draft' });
      if (!resolved) {
        throw new HTTPException(500, { message: 'Failed to resolve updated prompt block' });
      }

      const latestVersion = await promptBlockStore.getLatestVersion(storedPromptBlockId);
      const hasDraft = !!(
        latestVersion &&
        (!resolved.activeVersionId || latestVersion.id !== resolved.activeVersionId)
      );

      return { ...resolved, hasDraft };
    } catch (error) {
      return handleError(error, 'Error updating stored prompt block');
    }
  },
});

/**
 * DELETE /stored/prompt-blocks/:storedPromptBlockId - Delete a stored prompt block
 */
export const DELETE_STORED_PROMPT_BLOCK_ROUTE = createRoute({
  method: 'DELETE',
  path: '/stored/prompt-blocks/:storedPromptBlockId',
  responseType: 'json',
  pathParamSchema: storedPromptBlockIdPathParams,
  responseSchema: deleteStoredPromptBlockResponseSchema,
  summary: 'Delete stored prompt block',
  description: 'Deletes a prompt block from storage by its unique identifier',
  tags: ['Stored Prompt Blocks'],
  requiresAuth: true,
  handler: async ({ mastra, storedPromptBlockId }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const promptBlockStore = await storage.getStore('promptBlocks');
      if (!promptBlockStore) {
        throw new HTTPException(500, { message: 'Prompt blocks storage domain is not available' });
      }

      // Check if prompt block exists
      const existing = await promptBlockStore.getById(storedPromptBlockId);
      if (!existing) {
        throw new HTTPException(404, { message: `Stored prompt block with id ${storedPromptBlockId} not found` });
      }

      await promptBlockStore.delete(storedPromptBlockId);

      return {
        success: true,
        message: `Prompt block ${storedPromptBlockId} deleted successfully`,
      };
    } catch (error) {
      return handleError(error, 'Error deleting stored prompt block');
    }
  },
});
