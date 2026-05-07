import { HTTPException } from '../http-exception';
import {
  storedWorkspaceIdPathParams,
  listStoredWorkspacesQuerySchema,
  createStoredWorkspaceBodySchema,
  updateStoredWorkspaceBodySchema,
  listStoredWorkspacesResponseSchema,
  getStoredWorkspaceResponseSchema,
  createStoredWorkspaceResponseSchema,
  updateStoredWorkspaceResponseSchema,
  deleteStoredWorkspaceResponseSchema,
} from '../schemas/stored-workspaces';
import { createRoute } from '../server-adapter/routes/route-builder';
import { toSlug } from '../utils';

import { handleError } from './error';

// ============================================================================
// Route Definitions
// ============================================================================

/**
 * GET /stored/workspaces - List all stored workspaces
 */
export const LIST_STORED_WORKSPACES_ROUTE = createRoute({
  method: 'GET',
  path: '/stored/workspaces',
  responseType: 'json',
  queryParamSchema: listStoredWorkspacesQuerySchema,
  responseSchema: listStoredWorkspacesResponseSchema,
  summary: 'List stored workspaces',
  description: 'Returns a paginated list of all workspace configurations stored in the database',
  tags: ['Stored Workspaces'],
  requiresAuth: true,
  handler: async ({ mastra, page, perPage, orderBy, authorId, metadata }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const workspaceStore = await storage.getStore('workspaces');
      if (!workspaceStore) {
        throw new HTTPException(500, { message: 'Workspaces storage domain is not available' });
      }

      const result = await workspaceStore.listResolved({
        page,
        perPage,
        orderBy,
        authorId,
        metadata,
      });

      return result;
    } catch (error) {
      return handleError(error, 'Error listing stored workspaces');
    }
  },
});

/**
 * GET /stored/workspaces/:storedWorkspaceId - Get a stored workspace by ID
 */
export const GET_STORED_WORKSPACE_ROUTE = createRoute({
  method: 'GET',
  path: '/stored/workspaces/:storedWorkspaceId',
  responseType: 'json',
  pathParamSchema: storedWorkspaceIdPathParams,
  responseSchema: getStoredWorkspaceResponseSchema,
  summary: 'Get stored workspace by ID',
  description:
    'Returns a specific workspace from storage by its unique identifier (resolved with active version config)',
  tags: ['Stored Workspaces'],
  requiresAuth: true,
  handler: async ({ mastra, storedWorkspaceId }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const workspaceStore = await storage.getStore('workspaces');
      if (!workspaceStore) {
        throw new HTTPException(500, { message: 'Workspaces storage domain is not available' });
      }

      const workspace = await workspaceStore.getByIdResolved(storedWorkspaceId);

      if (!workspace) {
        throw new HTTPException(404, { message: `Stored workspace with id ${storedWorkspaceId} not found` });
      }

      return workspace;
    } catch (error) {
      return handleError(error, 'Error getting stored workspace');
    }
  },
});

/**
 * POST /stored/workspaces - Create a new stored workspace
 */
export const CREATE_STORED_WORKSPACE_ROUTE = createRoute({
  method: 'POST',
  path: '/stored/workspaces',
  responseType: 'json',
  bodySchema: createStoredWorkspaceBodySchema,
  responseSchema: createStoredWorkspaceResponseSchema,
  summary: 'Create stored workspace',
  description: 'Creates a new workspace configuration in storage with the provided settings',
  tags: ['Stored Workspaces'],
  requiresAuth: true,
  handler: async ({
    mastra,
    id: providedId,
    authorId,
    metadata,
    name,
    description,
    filesystem,
    sandbox,
    mounts,
    search,
    skills,
    tools,
    autoSync,
    operationTimeout,
  }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const workspaceStore = await storage.getStore('workspaces');
      if (!workspaceStore) {
        throw new HTTPException(500, { message: 'Workspaces storage domain is not available' });
      }

      // Derive ID from name if not explicitly provided
      const id = providedId || toSlug(name);

      if (!id) {
        throw new HTTPException(400, {
          message: 'Could not derive workspace ID from name. Please provide an explicit id.',
        });
      }

      // Check if workspace with this ID already exists
      const existing = await workspaceStore.getById(id);
      if (existing) {
        throw new HTTPException(409, { message: `Workspace with id ${id} already exists` });
      }

      await workspaceStore.create({
        workspace: {
          id,
          authorId,
          metadata,
          name,
          description,
          filesystem,
          sandbox,
          mounts,
          search,
          skills,
          tools,
          autoSync,
          operationTimeout,
        },
      });

      // Return the resolved workspace (thin record + version config)
      const resolved = await workspaceStore.getByIdResolved(id);
      if (!resolved) {
        throw new HTTPException(500, { message: 'Failed to resolve created workspace' });
      }

      return resolved;
    } catch (error) {
      return handleError(error, 'Error creating stored workspace');
    }
  },
});

/**
 * PATCH /stored/workspaces/:storedWorkspaceId - Update a stored workspace
 */
export const UPDATE_STORED_WORKSPACE_ROUTE = createRoute({
  method: 'PATCH',
  path: '/stored/workspaces/:storedWorkspaceId',
  responseType: 'json',
  pathParamSchema: storedWorkspaceIdPathParams,
  bodySchema: updateStoredWorkspaceBodySchema,
  responseSchema: updateStoredWorkspaceResponseSchema,
  summary: 'Update stored workspace',
  description: 'Updates an existing workspace in storage with the provided fields',
  tags: ['Stored Workspaces'],
  requiresAuth: true,
  handler: async ({
    mastra,
    storedWorkspaceId,
    // Metadata-level fields
    authorId,
    metadata,
    // Config fields (snapshot-level)
    name,
    description,
    filesystem,
    sandbox,
    mounts,
    search,
    skills,
    tools,
    autoSync,
    operationTimeout,
  }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const workspaceStore = await storage.getStore('workspaces');
      if (!workspaceStore) {
        throw new HTTPException(500, { message: 'Workspaces storage domain is not available' });
      }

      // Check if workspace exists
      const existing = await workspaceStore.getById(storedWorkspaceId);
      if (!existing) {
        throw new HTTPException(404, { message: `Stored workspace with id ${storedWorkspaceId} not found` });
      }

      // Update the workspace with both metadata-level and config-level fields
      // The storage layer handles separating these into record updates vs new-version creation
      await workspaceStore.update({
        id: storedWorkspaceId,
        authorId,
        metadata,
        name,
        description,
        filesystem,
        sandbox,
        mounts,
        search,
        skills,
        tools,
        autoSync,
        operationTimeout,
      });

      // Return the resolved workspace with the updated config
      const resolved = await workspaceStore.getByIdResolved(storedWorkspaceId);
      if (!resolved) {
        throw new HTTPException(500, { message: 'Failed to resolve updated workspace' });
      }

      return resolved;
    } catch (error) {
      return handleError(error, 'Error updating stored workspace');
    }
  },
});

/**
 * DELETE /stored/workspaces/:storedWorkspaceId - Delete a stored workspace
 */
export const DELETE_STORED_WORKSPACE_ROUTE = createRoute({
  method: 'DELETE',
  path: '/stored/workspaces/:storedWorkspaceId',
  responseType: 'json',
  pathParamSchema: storedWorkspaceIdPathParams,
  responseSchema: deleteStoredWorkspaceResponseSchema,
  summary: 'Delete stored workspace',
  description: 'Deletes a workspace from storage by its unique identifier',
  tags: ['Stored Workspaces'],
  requiresAuth: true,
  handler: async ({ mastra, storedWorkspaceId }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const workspaceStore = await storage.getStore('workspaces');
      if (!workspaceStore) {
        throw new HTTPException(500, { message: 'Workspaces storage domain is not available' });
      }

      // Check if workspace exists
      const existing = await workspaceStore.getById(storedWorkspaceId);
      if (!existing) {
        throw new HTTPException(404, { message: `Stored workspace with id ${storedWorkspaceId} not found` });
      }

      await workspaceStore.delete(storedWorkspaceId);

      return {
        success: true,
        message: `Workspace ${storedWorkspaceId} deleted successfully`,
      };
    } catch (error) {
      return handleError(error, 'Error deleting stored workspace');
    }
  },
});
