import type { StorageCreateAgentInput, StorageUpdateAgentInput } from '@mastra/core/storage';

import { HTTPException } from '../http-exception';
import {
  storedAgentIdPathParams,
  statusQuerySchema,
  listStoredAgentsQuerySchema,
  createStoredAgentBodySchema,
  updateStoredAgentBodySchema,
  listStoredAgentsResponseSchema,
  getStoredAgentResponseSchema,
  createStoredAgentResponseSchema,
  updateStoredAgentResponseSchema,
  deleteStoredAgentResponseSchema,
  previewInstructionsBodySchema,
  previewInstructionsResponseSchema,
} from '../schemas/stored-agents';
import { createRoute } from '../server-adapter/routes/route-builder';
import { toSlug } from '../utils';

import { handleError } from './error';
import { handleAutoVersioning } from './version-helpers';
import type { VersionedStoreInterface } from './version-helpers';

const AGENT_SNAPSHOT_CONFIG_FIELDS = [
  'name',
  'description',
  'instructions',
  'model',
  'tools',
  'defaultOptions',
  'workflows',
  'agents',
  'integrationTools',
  'inputProcessors',
  'outputProcessors',
  'memory',
  'scorers',
  'requestContextSchema',
  'mcpClients',
  'skills',
  'workspace',
] as const;

// ============================================================================
// Route Definitions
// ============================================================================

/**
 * GET /stored/agents - List all stored agents
 */
export const LIST_STORED_AGENTS_ROUTE = createRoute({
  method: 'GET',
  path: '/stored/agents',
  responseType: 'json',
  queryParamSchema: listStoredAgentsQuerySchema,
  responseSchema: listStoredAgentsResponseSchema,
  summary: 'List stored agents',
  description: 'Returns a paginated list of all agents stored in the database',
  tags: ['Stored Agents'],
  requiresAuth: true,
  handler: async ({ mastra, page, perPage, orderBy, status, authorId, metadata }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const agentsStore = await storage.getStore('agents');
      if (!agentsStore) {
        throw new HTTPException(500, { message: 'Agents storage domain is not available' });
      }

      const result = await agentsStore.listResolved({
        page,
        perPage,
        orderBy,
        status,
        authorId,
        metadata,
      });

      return result;
    } catch (error) {
      return handleError(error, 'Error listing stored agents');
    }
  },
});

/**
 * GET /stored/agents/:storedAgentId - Get a stored agent by ID
 */
export const GET_STORED_AGENT_ROUTE = createRoute({
  method: 'GET',
  path: '/stored/agents/:storedAgentId',
  responseType: 'json',
  pathParamSchema: storedAgentIdPathParams,
  queryParamSchema: statusQuerySchema,
  responseSchema: getStoredAgentResponseSchema,
  summary: 'Get stored agent by ID',
  description:
    'Returns a specific agent from storage by its unique identifier. Use ?status=draft to resolve with the latest (draft) version, or ?status=published (default) for the active published version.',
  tags: ['Stored Agents'],
  requiresAuth: true,
  handler: async ({ mastra, storedAgentId, status }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const agentsStore = await storage.getStore('agents');
      if (!agentsStore) {
        throw new HTTPException(500, { message: 'Agents storage domain is not available' });
      }

      const agent = await agentsStore.getByIdResolved(storedAgentId, { status });

      if (!agent) {
        throw new HTTPException(404, { message: `Stored agent with id ${storedAgentId} not found` });
      }

      return agent;
    } catch (error) {
      return handleError(error, 'Error getting stored agent');
    }
  },
});

/**
 * POST /stored/agents - Create a new stored agent
 */
export const CREATE_STORED_AGENT_ROUTE = createRoute({
  method: 'POST',
  path: '/stored/agents',
  responseType: 'json',
  bodySchema: createStoredAgentBodySchema,
  responseSchema: createStoredAgentResponseSchema,
  summary: 'Create stored agent',
  description: 'Creates a new agent in storage with the provided configuration',
  tags: ['Stored Agents'],
  requiresAuth: true,
  handler: async ({
    mastra,
    id: providedId,
    authorId,
    metadata,
    name,
    description,
    instructions,
    model,
    tools,
    defaultOptions,
    workflows,
    agents,
    integrationTools,
    mcpClients,
    inputProcessors,
    outputProcessors,
    memory,
    scorers,
    skills,
    workspace,
    requestContextSchema,
  }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const agentsStore = await storage.getStore('agents');
      if (!agentsStore) {
        throw new HTTPException(500, { message: 'Agents storage domain is not available' });
      }

      // Derive ID from name if not explicitly provided
      const id = providedId || toSlug(name);

      if (!id) {
        throw new HTTPException(400, {
          message: 'Could not derive agent ID from name. Please provide an explicit id.',
        });
      }

      // Check if agent with this ID already exists
      const existing = await agentsStore.getById(id);
      if (existing) {
        throw new HTTPException(409, { message: `Agent with id ${id} already exists` });
      }

      // Create agent with flat StorageCreateAgentInput
      // Cast needed because Zod's passthrough() output types don't exactly match the handwritten TS interfaces
      await agentsStore.create({
        agent: {
          id,
          authorId,
          metadata,
          name,
          description,
          instructions,
          model,
          tools,
          defaultOptions,
          workflows,
          agents,
          integrationTools,
          mcpClients,
          inputProcessors,
          outputProcessors,
          memory,
          scorers,
          skills,
          workspace,
          requestContextSchema,
        } as StorageCreateAgentInput,
      });

      // Return the resolved agent (thin record + version config)
      // Use draft status since newly created entities start as drafts
      const resolved = await agentsStore.getByIdResolved(id, { status: 'draft' });
      if (!resolved) {
        throw new HTTPException(500, { message: 'Failed to resolve created agent' });
      }

      return resolved;
    } catch (error) {
      return handleError(error, 'Error creating stored agent');
    }
  },
});

/**
 * PATCH /stored/agents/:storedAgentId - Update a stored agent
 */
export const UPDATE_STORED_AGENT_ROUTE = createRoute({
  method: 'PATCH',
  path: '/stored/agents/:storedAgentId',
  responseType: 'json',
  pathParamSchema: storedAgentIdPathParams,
  bodySchema: updateStoredAgentBodySchema,
  responseSchema: updateStoredAgentResponseSchema,
  summary: 'Update stored agent',
  description: 'Updates an existing agent in storage with the provided fields',
  tags: ['Stored Agents'],
  requiresAuth: true,
  handler: async ({
    mastra,
    storedAgentId,
    // Metadata-level fields
    authorId,
    metadata,
    // Config fields (snapshot-level)
    name,
    description,
    instructions,
    model,
    tools,
    defaultOptions,
    workflows,
    agents,
    integrationTools,
    mcpClients,
    inputProcessors,
    outputProcessors,
    memory,
    scorers,
    skills,
    workspace,
    requestContextSchema,
  }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const agentsStore = await storage.getStore('agents');
      if (!agentsStore) {
        throw new HTTPException(500, { message: 'Agents storage domain is not available' });
      }

      // Check if agent exists
      const existing = await agentsStore.getById(storedAgentId);
      if (!existing) {
        throw new HTTPException(404, { message: `Stored agent with id ${storedAgentId} not found` });
      }

      // Update the agent with both metadata-level and config-level fields
      // The storage layer handles separating these into agent-record updates vs new-version creation
      // Cast needed because Zod's passthrough() output types don't exactly match the handwritten TS interfaces
      const updatedAgent = await agentsStore.update({
        id: storedAgentId,
        authorId,
        metadata,
        name,
        description,
        instructions,
        model,
        tools,
        defaultOptions,
        workflows,
        agents,
        integrationTools,
        mcpClients,
        inputProcessors,
        outputProcessors,
        memory,
        scorers,
        skills,
        workspace,
        requestContextSchema,
      } as StorageUpdateAgentInput);

      // Build the snapshot config for auto-versioning comparison
      const configFields = {
        name,
        description,
        instructions,
        model,
        tools,
        defaultOptions,
        workflows,
        agents,
        integrationTools,
        mcpClients,
        inputProcessors,
        outputProcessors,
        memory,
        scorers,
        skills,
        workspace,
        requestContextSchema,
      };

      // Filter out undefined values to get only the config fields that were provided
      const providedConfigFields = Object.fromEntries(Object.entries(configFields).filter(([_, v]) => v !== undefined));

      // Handle auto-versioning with retry logic for race conditions
      // This creates a new version if there are meaningful config changes.
      // It does NOT update activeVersionId — the version stays as a draft until explicitly published.
      const autoVersionResult = await handleAutoVersioning(
        agentsStore as unknown as VersionedStoreInterface,
        storedAgentId,
        'agentId',
        AGENT_SNAPSHOT_CONFIG_FIELDS,
        existing,
        updatedAgent,
        providedConfigFields,
      );

      if (!autoVersionResult) {
        throw new Error('handleAutoVersioning returned undefined');
      }

      // Clear the cached agent instance so the next request gets the updated config
      const editor = mastra.getEditor();
      if (editor) {
        editor.agent.clearCache(storedAgentId);
      }

      // Return the resolved agent with the latest (draft) version so the UI sees its edits
      const resolved = await agentsStore.getByIdResolved(storedAgentId, { status: 'draft' });
      if (!resolved) {
        throw new HTTPException(500, { message: 'Failed to resolve updated agent' });
      }

      return resolved;
    } catch (error) {
      return handleError(error, 'Error updating stored agent');
    }
  },
});

/**
 * DELETE /stored/agents/:storedAgentId - Delete a stored agent
 */
export const DELETE_STORED_AGENT_ROUTE = createRoute({
  method: 'DELETE',
  path: '/stored/agents/:storedAgentId',
  responseType: 'json',
  pathParamSchema: storedAgentIdPathParams,
  responseSchema: deleteStoredAgentResponseSchema,
  summary: 'Delete stored agent',
  description: 'Deletes an agent from storage by its unique identifier',
  tags: ['Stored Agents'],
  requiresAuth: true,
  handler: async ({ mastra, storedAgentId }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const agentsStore = await storage.getStore('agents');
      if (!agentsStore) {
        throw new HTTPException(500, { message: 'Agents storage domain is not available' });
      }

      // Check if agent exists
      const existing = await agentsStore.getById(storedAgentId);
      if (!existing) {
        throw new HTTPException(404, { message: `Stored agent with id ${storedAgentId} not found` });
      }

      await agentsStore.delete(storedAgentId);

      // Clear the cached agent instance
      mastra.getEditor()?.agent.clearCache(storedAgentId);

      return { success: true, message: `Agent ${storedAgentId} deleted successfully` };
    } catch (error) {
      return handleError(error, 'Error deleting stored agent');
    }
  },
});

/**
 * POST /stored/agents/preview-instructions - Preview resolved instructions
 */
export const PREVIEW_INSTRUCTIONS_ROUTE = createRoute({
  method: 'POST',
  path: '/stored/agents/preview-instructions',
  responseType: 'json',
  bodySchema: previewInstructionsBodySchema,
  responseSchema: previewInstructionsResponseSchema,
  summary: 'Preview resolved instructions',
  description:
    'Resolves an array of instruction blocks against a request context, evaluating rules, fetching prompt block references, and rendering template variables. Returns the final concatenated instruction string.',
  tags: ['Stored Agents'],
  requiresAuth: true,
  handler: async ({ mastra, blocks, context }) => {
    try {
      const editor = mastra.getEditor();
      if (!editor) {
        throw new HTTPException(500, { message: 'Editor is not configured' });
      }

      const result = await editor.prompt.preview(blocks, context ?? {});

      return { result };
    } catch (error) {
      return handleError(error, 'Error previewing instructions');
    }
  },
});
