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
  pregenerateAgentConfigBodySchema,
  pregenerateAgentConfigResponseSchema,
} from '../schemas/stored-agents';
import { createRoute } from '../server-adapter/routes/route-builder';

import { handleAutoVersioning } from './agent-versions';
import { handleError } from './error';

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
  handler: async ({ mastra, page, perPage, orderBy, authorId, metadata }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const agentsStore = await storage.getStore('agents');
      if (!agentsStore) {
        throw new HTTPException(500, { message: 'Agents storage domain is not available' });
      }

      const result = await agentsStore.listAgentsResolved({
        page,
        perPage,
        orderBy,
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
  responseSchema: getStoredAgentResponseSchema,
  summary: 'Get stored agent by ID',
  description: 'Returns a specific agent from storage by its unique identifier (resolved with active version config)',
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
      // Returns StorageResolvedAgentType (thin record + version config)
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
    inputProcessors,
    outputProcessors,
    memory,
    scorers,
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

      // Only include tools/integrationTools if they're actually arrays from the body (not {} from adapter)
      const toolsFromBody = Array.isArray(tools) ? tools : undefined;
      const integrationToolsFromBody = Array.isArray(integrationTools) ? integrationTools : undefined;

      // Create agent with flat StorageCreateAgentInput
      await agentsStore.createAgent({
        agent: {
          id,
          authorId,
          metadata,
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
        },
      });

      // Return the resolved agent (thin record + version config)
      const resolved = await agentsStore.getAgentByIdResolved({ id });
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
    inputProcessors,
    outputProcessors,
    memory,
    scorers,
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

      // Update the agent with both metadata-level and config-level fields
      // The storage layer handles separating these into agent-record updates vs new-version creation
      const updatedAgent = await agentsStore.updateAgent({
        id: storedAgentId,
        authorId,
        metadata,
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
      });

      // Build the snapshot config for auto-versioning comparison
      const configFields = {
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
      };

      // Filter out undefined values to get only the config fields that were provided
      const providedConfigFields = Object.fromEntries(Object.entries(configFields).filter(([_, v]) => v !== undefined));

      // Handle auto-versioning with retry logic for race conditions
      // This creates a version if there are meaningful config changes (does NOT update activeVersionId)
      await handleAutoVersioning(agentsStore, storedAgentId, existing, updatedAgent, providedConfigFields);

      // Clear the cached agent instance so the next request gets the updated config
      mastra.getEditor()?.clearStoredAgentCache(storedAgentId);

      // Return the resolved agent (thin record + version config)
      const resolved = await agentsStore.getAgentByIdResolved({ id: storedAgentId });
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
      const existing = await agentsStore.getAgentById({ id: storedAgentId });
      if (!existing) {
        throw new HTTPException(404, { message: `Stored agent with id ${storedAgentId} not found` });
      }

      await agentsStore.deleteAgent({ id: storedAgentId });

      // Clear the cached agent instance
      mastra.getEditor()?.clearStoredAgentCache(storedAgentId);

      return { success: true, message: `Agent ${storedAgentId} deleted successfully` };
    } catch (error) {
      return handleError(error, 'Error deleting stored agent');
    }
  },
});

/**
 * POST /stored/agents/pregenerate - Generate agent configuration using AI
 *
 * This endpoint makes two LLM calls:
 * 1. First call: Select appropriate capabilities (tools, workflows, agents, scorers) based on agent purpose
 * 2. Second call: Generate detailed instructions knowing which capabilities were selected
 *
 * This two-step approach ensures instructions can reference and explain the selected tools.
 */
export const PREGENERATE_AGENT_CONFIG_ROUTE = createRoute({
  method: 'POST',
  path: '/stored/agents/pregenerate',
  responseType: 'json',
  bodySchema: pregenerateAgentConfigBodySchema,
  responseSchema: pregenerateAgentConfigResponseSchema,
  summary: 'Pregenerate agent configuration',
  description: 'Uses AI to suggest agent configuration based on name, description, and available resources',
  tags: ['Stored Agents'],
  requiresAuth: true,
  handler: async ({
    mastra,
    name,
    description,
    model,
    availableTools,
    availableWorkflows,
    availableAgents,
    availableScorers,
  }) => {
    try {
      // Import Agent dynamically to avoid circular dependency issues
      const { Agent } = await import('@mastra/core/agent');
      const { z } = await import('zod');

      // Build the model string in the format "provider/modelName"
      const modelString = `${model.provider}/${model.name}`;

      // Helper to create and configure an ephemeral agent
      const createEphemeralAgent = (id: string, agentName: string, instructions: string) => {
        const agent = new Agent({
          id,
          name: agentName,
          instructions,
          model: modelString,
        });
        if (mastra) {
          agent.__registerMastra(mastra);
        }
        return agent;
      };

      // Build context about available resources
      const resourceContext: string[] = [];

      if (availableTools && availableTools.length > 0) {
        resourceContext.push(
          `Available Tools:\n${availableTools.map(t => `- ${t.id}: ${t.name}${t.description ? ` - ${t.description}` : ''}`).join('\n')}`,
        );
      }

      if (availableWorkflows && availableWorkflows.length > 0) {
        resourceContext.push(
          `Available Workflows:\n${availableWorkflows.map(w => `- ${w.id}: ${w.name}${w.description ? ` - ${w.description}` : ''}`).join('\n')}`,
        );
      }

      if (availableAgents && availableAgents.length > 0) {
        resourceContext.push(
          `Available Sub-Agents:\n${availableAgents.map(a => `- ${a.id}: ${a.name}${a.description ? ` - ${a.description}` : ''}`).join('\n')}`,
        );
      }

      if (availableScorers && availableScorers.length > 0) {
        resourceContext.push(
          `Available Scorers:\n${availableScorers.map(s => `- ${s.id}: ${s.name}${s.description ? ` - ${s.description}` : ''}`).join('\n')}`,
        );
      }

      // ========================================================================
      // STEP 1: Select appropriate capabilities
      // ========================================================================
      const capabilitiesSchema = z.object({
        tools: z
          .array(z.string())
          .nullable()
          .describe('Array of tool IDs that would be useful for this agent, or null if none'),
        workflows: z
          .array(z.string())
          .nullable()
          .describe('Array of workflow IDs that would be useful for this agent, or null if none'),
        agents: z
          .array(z.string())
          .nullable()
          .describe('Array of sub-agent IDs that would be useful for this agent, or null if none'),
        memory: z.string().nullable().describe('Memory configuration suggestion, or null if not needed'),
        scorers: z.array(z.string()).nullable().describe('Array of scorer IDs for quality evaluation, or null if none'),
      });

      const capabilitiesSystemPrompt = `You are an expert AI agent configuration assistant. Your task is to select the most appropriate capabilities for a new AI agent based on its name and description.

Guidelines:
1. Only select tools/workflows/agents/scorers from the available lists - do not invent new ones
2. Only select capabilities that are clearly relevant to the agent's purpose
3. Be conservative - quality over quantity
4. For memory, suggest it if the agent needs to maintain conversation context
5. For scorers, only suggest them if quality evaluation is relevant

${resourceContext.length > 0 ? '\n' + resourceContext.join('\n\n') : '\nNo additional resources are available.'}`;

      const capabilitiesUserPrompt = `Select appropriate capabilities for an AI agent with:
- Name: ${name}
- Description: ${description}

Choose only the capabilities that directly support this agent's purpose.`;

      const capabilitiesAgent = createEphemeralAgent(
        'pregenerate-capabilities-agent',
        'Capabilities Selector',
        capabilitiesSystemPrompt,
      );

      const capabilitiesResult = await capabilitiesAgent.generate(capabilitiesUserPrompt, {
        structuredOutput: {
          schema: capabilitiesSchema,
        },
      });

      const selectedCapabilities = capabilitiesResult.object;

      // ========================================================================
      // STEP 2: Generate instructions with knowledge of selected capabilities
      // ========================================================================

      // Build context about the selected capabilities for instructions generation
      const selectedContext: string[] = [];

      if (selectedCapabilities.tools && selectedCapabilities.tools.length > 0) {
        const selectedToolDetails = availableTools
          ?.filter(t => selectedCapabilities.tools!.includes(t.id))
          .map(t => `- **${t.name}** (${t.id}): ${t.description || 'No description'}`)
          .join('\n');
        if (selectedToolDetails) {
          selectedContext.push(`Selected Tools:\n${selectedToolDetails}`);
        }
      }

      if (selectedCapabilities.workflows && selectedCapabilities.workflows.length > 0) {
        const selectedWorkflowDetails = availableWorkflows
          ?.filter(w => selectedCapabilities.workflows!.includes(w.id))
          .map(w => `- **${w.name}** (${w.id}): ${w.description || 'No description'}`)
          .join('\n');
        if (selectedWorkflowDetails) {
          selectedContext.push(`Selected Workflows:\n${selectedWorkflowDetails}`);
        }
      }

      if (selectedCapabilities.agents && selectedCapabilities.agents.length > 0) {
        const selectedAgentDetails = availableAgents
          ?.filter(a => selectedCapabilities.agents!.includes(a.id))
          .map(a => `- **${a.name}** (${a.id}): ${a.description || 'No description'}`)
          .join('\n');
        if (selectedAgentDetails) {
          selectedContext.push(`Selected Sub-Agents:\n${selectedAgentDetails}`);
        }
      }

      const instructionsSchema = z.object({
        instructions: z.string().describe('Comprehensive system instructions for the agent'),
      });

      const instructionsSystemPrompt = `You are an expert AI agent configuration assistant. Your task is to write comprehensive system instructions for an AI agent.

The agent has access to the following capabilities:
${selectedContext.length > 0 ? selectedContext.join('\n\n') : 'No tools, workflows, or sub-agents selected.'}
${selectedCapabilities.memory ? `\nMemory: ${selectedCapabilities.memory}` : ''}

IMPORTANT - Instructions Format:
- Write the instructions in well-formatted Markdown
- Use headings (## Section) to organize different aspects
- Use bullet points for lists of behaviors or rules
- Include blank lines between sections for readability
- Structure clearly with sections like: Role, Capabilities, Guidelines, Tone, etc.
- IMPORTANT: Reference the specific tools/workflows available and explain when/how to use each one
- If tools are available, include a section explaining each tool's purpose and when to use it`;

      const instructionsUserPrompt = `Write comprehensive system instructions for an AI agent with:
- Name: ${name}
- Description: ${description}

The instructions should:
1. Define the agent's role and persona
2. Explain its capabilities and how to use the available tools/workflows
3. Provide guidelines for behavior and responses
4. Set the appropriate tone and communication style`;

      const instructionsAgent = createEphemeralAgent(
        'pregenerate-instructions-agent',
        'Instructions Generator',
        instructionsSystemPrompt,
      );

      const instructionsResult = await instructionsAgent.generate(instructionsUserPrompt, {
        structuredOutput: {
          schema: instructionsSchema,
        },
      });

      // Combine results from both steps
      return {
        instructions: instructionsResult.object.instructions,
        tools: selectedCapabilities.tools,
        workflows: selectedCapabilities.workflows,
        agents: selectedCapabilities.agents,
        memory: selectedCapabilities.memory,
        scorers: selectedCapabilities.scorers,
      };
    } catch (error) {
      return handleError(error, 'Error pregenerating agent configuration');
    }
  },
});
