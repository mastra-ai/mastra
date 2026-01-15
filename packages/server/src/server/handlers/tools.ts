import { isVercelTool } from '@mastra/core/tools';
import { zodToJsonSchema } from '@mastra/core/utils/zod-to-json';
import { stringify } from 'superjson';
import { HTTPException } from '../http-exception';
import {
  executeToolContextBodySchema,
  executeToolResponseSchema,
  listToolsResponseSchema,
  serializedToolSchema,
  toolIdPathParams,
  agentToolPathParams,
  executeToolBodySchema,
} from '../schemas/agents';
import { optionalRunIdSchema } from '../schemas/common';
import { createRoute } from '../server-adapter/routes/route-builder';

import { getAgentFromSystem } from './agents';
import { handleError } from './error';
import { validateBody } from './utils';
import { executeMCPTool } from './mcp-tool-provider';
import type { MCPIntegrationMetadata } from '@mastra/core/integrations';

// ============================================================================
// Route Definitions (new pattern - handlers defined inline with createRoute)
// ============================================================================

export const LIST_TOOLS_ROUTE = createRoute({
  method: 'GET',
  path: '/api/tools',
  responseType: 'json',
  responseSchema: listToolsResponseSchema,
  summary: 'List all tools',
  description: 'Returns a list of all available tools in the system, including tools from integrations',
  tags: ['Tools'],
  handler: async ({ mastra, tools }) => {
    try {
      const allTools = tools || mastra.listTools() || {};

      // Serialize code-defined tools
      const serializedTools = Object.entries(allTools).reduce(
        (acc, [id, _tool]) => {
          const tool = _tool;
          acc[id] = {
            ...tool,
            inputSchema: tool.inputSchema ? stringify(zodToJsonSchema(tool.inputSchema)) : undefined,
            outputSchema: tool.outputSchema ? stringify(zodToJsonSchema(tool.outputSchema)) : undefined,
            source: 'code',
          };
          return acc;
        },
        {} as Record<string, any>,
      );

      // Fetch cached tools from integrations
      const storage = mastra.getStorage();
      if (storage) {
        try {
          const integrationsStore = await storage.getStore('integrations');
          if (integrationsStore) {
            const cachedToolsResult = await integrationsStore.listCachedTools({});
            const cachedTools = cachedToolsResult.tools || [];

            // Fetch integrations to get their names
            const integrationIds = [...new Set(cachedTools.map((t: any) => t.integrationId))];
            const integrationsMap = new Map<string, string>();

            for (const integrationId of integrationIds) {
              try {
                const integration = await integrationsStore.getIntegrationById({ id: integrationId });
                if (integration) {
                  integrationsMap.set(integration.id, integration.name);
                }
              } catch {
                // Integration not found, skip
              }
            }

            // Add cached tools to serialized tools
            for (const cachedTool of cachedTools) {
              const toolId = `${cachedTool.provider}_${cachedTool.toolkitSlug}_${cachedTool.toolSlug}`;
              const integrationName = integrationsMap.get(cachedTool.integrationId) || cachedTool.provider;
              // Include toolkit name in tool name for clarity (e.g., "slack: Send Message")
              const displayName = cachedTool.toolkitSlug
                ? `${cachedTool.toolkitSlug}: ${cachedTool.name}`
                : cachedTool.name;

              serializedTools[toolId] = {
                id: toolId,
                name: displayName,
                description: cachedTool.description,
                inputSchema: cachedTool.inputSchema ? stringify(cachedTool.inputSchema) : undefined,
                outputSchema: cachedTool.outputSchema ? stringify(cachedTool.outputSchema) : undefined,
                source: integrationName,
                provider: cachedTool.provider,
                toolkit: cachedTool.toolkitSlug,
                toolSlug: cachedTool.toolSlug, // The tool slug for matching with available tools
                integrationId: cachedTool.integrationId,
                cachedToolId: cachedTool.id, // The database ID for the cached tool (needed for deletion)
              };
            }
          }
        } catch (error) {
          // Log error but don't fail the request
          console.error('Error fetching cached tools:', error);
        }
      }

      return serializedTools;
    } catch (error) {
      return handleError(error, 'Error getting tools');
    }
  },
});

export const GET_TOOL_BY_ID_ROUTE = createRoute({
  method: 'GET',
  path: '/api/tools/:toolId',
  responseType: 'json',
  pathParamSchema: toolIdPathParams,
  responseSchema: serializedToolSchema,
  summary: 'Get tool by ID',
  description: 'Returns details for a specific tool including its schema and configuration',
  tags: ['Tools'],
  handler: async ({ mastra, tools, toolId }) => {
    try {
      let tool: any;

      // Try explicit tools first, then fallback to mastra
      if (tools && Object.keys(tools).length > 0) {
        tool = Object.values(tools).find((t: any) => t.id === toolId);
      } else {
        tool = mastra.getToolById(toolId);
      }

      // If not found in code-defined tools, check cached integration tools
      if (!tool) {
        const storage = mastra.getStorage();
        if (storage) {
          const integrationsStore = await storage.getStore('integrations');
          if (integrationsStore) {
            // Parse toolId format: provider_toolkitSlug_toolSlug
            const parts = toolId.split('_');
            if (parts.length >= 3) {
              const provider = parts[0];
              const toolkitSlug = parts[1];
              const toolSlug = parts.slice(2).join('_'); // Handle tool slugs with underscores

              const cachedToolsResult = await integrationsStore.listCachedTools({
                provider: provider as any,
                toolkitSlug,
              });
              const cachedTool = cachedToolsResult.tools?.find((t: any) => t.toolSlug === toolSlug);

              if (cachedTool) {
                const displayName = cachedTool.toolkitSlug
                  ? `${cachedTool.toolkitSlug}: ${cachedTool.name}`
                  : cachedTool.name;

                return {
                  id: toolId,
                  name: displayName,
                  description: cachedTool.description,
                  inputSchema: cachedTool.inputSchema ? stringify(cachedTool.inputSchema) : undefined,
                  outputSchema: cachedTool.outputSchema ? stringify(cachedTool.outputSchema) : undefined,
                  source: cachedTool.provider,
                  provider: cachedTool.provider,
                  toolkit: cachedTool.toolkitSlug,
                  integrationId: cachedTool.integrationId,
                };
              }
            }
          }
        }
      }

      if (!tool) {
        throw new HTTPException(404, { message: 'Tool not found' });
      }

      const serializedTool = {
        ...tool,
        inputSchema: tool.inputSchema ? stringify(zodToJsonSchema(tool.inputSchema)) : undefined,
        outputSchema: tool.outputSchema ? stringify(zodToJsonSchema(tool.outputSchema)) : undefined,
      };

      return serializedTool;
    } catch (error) {
      return handleError(error, 'Error getting tool');
    }
  },
});

export const EXECUTE_TOOL_ROUTE = createRoute({
  method: 'POST',
  path: '/api/tools/:toolId/execute',
  responseType: 'json',
  pathParamSchema: toolIdPathParams,
  queryParamSchema: optionalRunIdSchema,
  bodySchema: executeToolContextBodySchema,
  responseSchema: executeToolResponseSchema,
  summary: 'Execute tool',
  description: 'Executes a specific tool with the provided input data',
  tags: ['Tools'],
  handler: async ({ mastra, runId, toolId, tools, requestContext, ...bodyParams }) => {
    try {
      if (!toolId) {
        throw new HTTPException(400, { message: 'Tool ID is required' });
      }

      let tool: any;

      // Try explicit tools first, then fallback to mastra
      if (tools && Object.keys(tools).length > 0) {
        tool = Object.values(tools).find((t: any) => t.id === toolId);
      } else {
        tool = mastra.getToolById(toolId);
      }

      // If not found in code-defined tools, check cached integration tools
      if (!tool) {
        const storage = mastra.getStorage();
        if (storage) {
          const integrationsStore = await storage.getStore('integrations');
          if (integrationsStore) {
            // Parse toolId format: provider_toolkitSlug_toolSlug
            const parts = toolId.split('_');
            if (parts.length >= 3) {
              const provider = parts[0];
              const toolkitSlug = parts[1];
              const toolSlug = parts.slice(2).join('_'); // Handle tool slugs with underscores

              const cachedToolsResult = await integrationsStore.listCachedTools({
                provider: provider as any,
                toolkitSlug,
              });
              const cachedTool = cachedToolsResult.tools?.find((t: any) => t.toolSlug === toolSlug);

              if (cachedTool) {
                const { data } = bodyParams;
                validateBody({ data });

                // Handle MCP/Smithery tools specially - need to get integration metadata for transport config
                // Smithery servers are MCP servers under the hood
                if (cachedTool.provider === 'mcp' || cachedTool.provider === 'smithery') {
                  // Get the integration to access metadata
                  const integration = await integrationsStore.getIntegrationById({ id: cachedTool.integrationId });
                  if (!integration) {
                    throw new HTTPException(404, { message: 'Integration not found for MCP tool' });
                  }

                  const mcpMetadata = integration.metadata as MCPIntegrationMetadata | undefined;
                  if (!mcpMetadata) {
                    throw new HTTPException(400, { message: 'MCP integration metadata not found' });
                  }

                  // Execute MCP tool with the appropriate transport config
                  const result = await executeMCPTool({
                    transport: mcpMetadata.transport || (mcpMetadata.url ? 'http' : 'stdio'),
                    // HTTP transport
                    url: mcpMetadata.url,
                    headers: mcpMetadata.headers,
                    // Stdio transport
                    command: mcpMetadata.command,
                    args: mcpMetadata.args,
                    env: mcpMetadata.env,
                    // Tool execution params
                    toolSlug: cachedTool.toolSlug,
                    input: (data || {}) as Record<string, unknown>,
                  });

                  if (!result.success) {
                    const errorDetails = result.error?.details
                      ? ` Details: ${typeof result.error.details === 'string' ? result.error.details : JSON.stringify(result.error.details)}`
                      : '';
                    throw new HTTPException(500, {
                      message: `${result.error?.message || 'MCP tool execution failed'}${errorDetails}`,
                    });
                  }

                  return result.output;
                }

                // Execute via provider API using executeTool from @mastra/core for non-MCP providers
                const { executeTool } = await import('@mastra/core/integrations');

                const result = await executeTool(
                  cachedTool.provider,
                  cachedTool.toolSlug,
                  (data || {}) as Record<string, unknown>,
                );

                if (!result.success) {
                  // Include error details from provider for better debugging
                  const errorDetails = result.error?.details
                    ? ` Details: ${typeof result.error.details === 'string' ? result.error.details : JSON.stringify(result.error.details)}`
                    : '';
                  throw new HTTPException(500, {
                    message: `${result.error?.message || 'Tool execution failed'}${errorDetails}`,
                  });
                }

                return result.output;
              }
            }
          }
        }
      }

      if (!tool) {
        throw new HTTPException(404, { message: 'Tool not found' });
      }

      if (!tool?.execute) {
        throw new HTTPException(400, { message: 'Tool is not executable' });
      }

      const { data } = bodyParams;

      validateBody({ data });

      if (isVercelTool(tool)) {
        const result = await (tool as any).execute(data);
        return result;
      }

      const result = await tool.execute(data!, {
        mastra,
        requestContext,
        // TODO: Pass proper tracing context when server API supports tracing
        tracingContext: { currentSpan: undefined },
        ...(runId
          ? {
              workflow: {
                runId,
                suspend: async () => {},
              },
            }
          : {}),
      });
      return result;
    } catch (error) {
      return handleError(error, 'Error executing tool');
    }
  },
});

// ============================================================================
// Agent Tool Routes
// ============================================================================

export const GET_AGENT_TOOL_ROUTE = createRoute({
  method: 'GET',
  path: '/api/agents/:agentId/tools/:toolId',
  responseType: 'json',
  pathParamSchema: agentToolPathParams,
  responseSchema: serializedToolSchema,
  summary: 'Get agent tool',
  description: 'Returns details for a specific tool assigned to the agent',
  tags: ['Agents', 'Tools'],
  handler: async ({ mastra, agentId, toolId, requestContext }) => {
    try {
      if (!agentId) {
        throw new HTTPException(400, { message: 'Agent ID is required' });
      }

      const agent = await getAgentFromSystem({ mastra, agentId });

      const agentTools = await agent.listTools({ requestContext });

      const tool = Object.values(agentTools || {}).find((tool: any) => tool.id === toolId) as any;

      if (!tool) {
        throw new HTTPException(404, { message: 'Tool not found' });
      }

      const serializedTool = {
        ...tool,
        inputSchema: tool.inputSchema ? stringify(zodToJsonSchema(tool.inputSchema)) : undefined,
        outputSchema: tool.outputSchema ? stringify(zodToJsonSchema(tool.outputSchema)) : undefined,
      };

      return serializedTool;
    } catch (error) {
      return handleError(error, 'Error getting agent tool');
    }
  },
});

export const EXECUTE_AGENT_TOOL_ROUTE = createRoute({
  method: 'POST',
  path: '/api/agents/:agentId/tools/:toolId/execute',
  responseType: 'json',
  pathParamSchema: agentToolPathParams,
  bodySchema: executeToolBodySchema,
  responseSchema: executeToolResponseSchema,
  summary: 'Execute agent tool',
  description: 'Executes a specific tool assigned to the agent with the provided input data',
  tags: ['Agents', 'Tools'],
  handler: async ({ mastra, agentId, toolId, data, requestContext }) => {
    try {
      if (!agentId) {
        throw new HTTPException(400, { message: 'Agent ID is required' });
      }

      const agent = await getAgentFromSystem({ mastra, agentId });

      const agentTools = await agent.listTools({ requestContext });

      const tool = Object.values(agentTools || {}).find((tool: any) => tool.id === toolId) as any;

      if (!tool) {
        throw new HTTPException(404, { message: 'Tool not found' });
      }

      if (!tool?.execute) {
        throw new HTTPException(400, { message: 'Tool is not executable' });
      }

      const result = await tool.execute(data, {
        mastra,
        requestContext,
        // TODO: Pass proper tracing context when server API supports tracing
        tracingContext: { currentSpan: undefined },
      });

      return result;
    } catch (error) {
      return handleError(error, 'Error executing agent tool');
    }
  },
});
