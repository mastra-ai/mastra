import { HTTPException } from '../http-exception';
import {
  storedAgentIdPathParams,
  listStoredAgentsQuerySchema,
  createStoredAgentBodySchema,
  updateStoredAgentBodySchema,
  listStoredAgentsResponseSchema,
  getStoredAgentResponseSchema,
  createStoredAgentResponseSchema,
  updateStoredAgentResponseSchema,
  deleteStoredAgentResponseSchema,
} from '../schemas/stored-agents';
import { createRoute } from '../server-adapter/routes/route-builder';

import { handleAutoVersioning } from './agent-versions';
import { handleError } from './error';

// ============================================================================
// Route Definitions
// ============================================================================

/**
 * GET /api/stored/agents - List all stored agents
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
  handler: async ({ mastra, page, perPage, orderBy, ownerId, metadata }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const agentsStore = await storage.getStore('agents');
      if (!agentsStore) {
        throw new HTTPException(500, { message: 'Agents storage domain is not available' });
      }

      const result = await agentsStore.listAgents({
        page,
        perPage,
        orderBy,
        ownerId,
        metadata,
      });

      return result;
    } catch (error) {
      return handleError(error, 'Error listing stored agents');
    }
  },
});

/**
 * GET /api/stored/agents/:storedAgentId - Get a stored agent by ID
 */
export const GET_STORED_AGENT_ROUTE = createRoute({
  method: 'GET',
  path: '/stored/agents/:storedAgentId',
  responseType: 'json',
  pathParamSchema: storedAgentIdPathParams,
  responseSchema: getStoredAgentResponseSchema,
  summary: 'Get stored agent by ID',
  description: 'Returns a specific agent from storage by its unique identifier',
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

      // Use getAgentByIdResolved to automatically resolve from active version
      const agent = await agentsStore.getAgentByIdResolved({ id: storedAgentId });

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
 * POST /api/stored/agents - Create a new stored agent
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
    id,
    name,
    description,
    instructions,
    model,
    tools,
    defaultOptions,
    workflows,
    agents,
    integrationTools,
    inputProcessors,
    outputProcessors,
    memory,
    scorers,
    metadata,
    ownerId,
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

      // Check if agent with this ID already exists
      const existing = await agentsStore.getAgentById({ id });
      if (existing) {
        throw new HTTPException(409, { message: `Agent with id ${id} already exists` });
      }

      // Only include tools if it's actually an array from the body (not {} from adapter)
      const toolsFromBody = Array.isArray(tools) ? tools : undefined;
      const integrationToolsFromBody = Array.isArray(integrationTools) ? integrationTools : undefined;

      const agent = await agentsStore.createAgent({
        agent: {
          id,
          name,
          description,
          instructions,
          model,
          tools: toolsFromBody,
          defaultOptions,
          workflows,
          agents,
          integrationTools: integrationToolsFromBody,
          inputProcessors,
          outputProcessors,
          memory,
          scorers,
          metadata,
          ownerId,
        },
      });

      return agent;
    } catch (error) {
      return handleError(error, 'Error creating stored agent');
    }
  },
});

/**
 * PATCH /api/stored/agents/:storedAgentId - Update a stored agent
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
    name,
    description,
    instructions,
    model,
    tools,
    defaultOptions,
    workflows,
    agents,
    integrationTools,
    inputProcessors,
    outputProcessors,
    memory,
    scorers,
    metadata,
    ownerId,
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
      const existing = await agentsStore.getAgentById({ id: storedAgentId });
      if (!existing) {
        throw new HTTPException(404, { message: `Stored agent with id ${storedAgentId} not found` });
      }

      // Only include tools/integrationTools if they're actually arrays from the body (not {} from adapter)
      const toolsFromBody = Array.isArray(tools) ? tools : undefined;
      const integrationToolsFromBody = Array.isArray(integrationTools) ? integrationTools : undefined;

      const updatedAgent = await agentsStore.updateAgent({
        id: storedAgentId,
        name,
        description,
        instructions,
        model,
        tools: toolsFromBody,
        defaultOptions,
        workflows,
        agents,
        integrationTools: integrationToolsFromBody,
        inputProcessors,
        outputProcessors,
        memory,
        scorers,
        metadata,
        ownerId,
      });

      // Handle auto-versioning with retry logic for race conditions
      // This creates a version if there are meaningful changes and updates activeVersionId
      const { agent } = await handleAutoVersioning(agentsStore, storedAgentId, existing, updatedAgent);

      // Clear the cached agent instance so the next request gets the updated config
      mastra.clearStoredAgentCache(storedAgentId);

      return agent;
    } catch (error) {
      return handleError(error, 'Error updating stored agent');
    }
  },
});

/**
 * DELETE /api/stored/agents/:storedAgentId - Delete a stored agent
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
      const existing = await agentsStore.getAgentById({ id: storedAgentId });
      if (!existing) {
        throw new HTTPException(404, { message: `Stored agent with id ${storedAgentId} not found` });
      }

      await agentsStore.deleteAgent({ id: storedAgentId });

      // Clear the cached agent instance
      mastra.clearStoredAgentCache(storedAgentId);

      return { success: true, message: `Agent ${storedAgentId} deleted successfully` };
    } catch (error) {
      return handleError(error, 'Error deleting stored agent');
    }
  },
});
