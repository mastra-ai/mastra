import { HTTPException } from '../http-exception';
import {
  integrationIdPathParams,
  providerPathParams,
  cachedToolPathParams,
  listIntegrationsQuerySchema,
  listToolkitsQuerySchema,
  listToolsQuerySchema,
  createIntegrationBodySchema,
  updateIntegrationBodySchema,
  refreshIntegrationBodySchema,
  listIntegrationsResponseSchema,
  getIntegrationResponseSchema,
  createIntegrationResponseSchema,
  updateIntegrationResponseSchema,
  deleteIntegrationResponseSchema,
  listProvidersResponseSchema,
  listToolkitsResponseSchema,
  listToolsResponseSchema,
  refreshIntegrationResponseSchema,
  validateMCPBodySchema,
  validateMCPResponseSchema,
  deleteCachedToolResponseSchema,
  smitheryServerPathParams,
  smitheryServersQuerySchema,
  smitheryServersResponseSchema,
  smitheryServerDetailsResponseSchema,
  arcadeAuthorizeBodySchema,
  arcadeAuthorizeResponseSchema,
  arcadeAuthStatusQuerySchema,
  arcadeAuthStatusResponseSchema,
  composioAuthorizeBodySchema,
  composioAuthorizeResponseSchema,
  composioAuthStatusQuerySchema,
  composioAuthStatusResponseSchema,
} from '../schemas/integrations';
import { createRoute } from '../server-adapter/routes/route-builder';

import { handleError } from './error';

import type { IntegrationProvider } from '@mastra/core/storage';
import {
  getProvider,
  listProviders,
  SmitheryProvider,
  ArcadeProvider,
  ComposioProvider,
  type MCPIntegrationMetadata,
  type SmitheryIntegrationMetadata,
} from '@mastra/core/integrations';
import { createMCPProvider } from './mcp-tool-provider';

// ============================================================================
// Route Definitions
// ============================================================================

/**
 * GET /api/integrations - List all stored integrations
 */
export const LIST_INTEGRATIONS_ROUTE = createRoute({
  method: 'GET',
  path: '/api/integrations',
  responseType: 'json',
  queryParamSchema: listIntegrationsQuerySchema,
  responseSchema: listIntegrationsResponseSchema,
  summary: 'List integrations',
  description: 'Returns a paginated list of all configured integrations',
  tags: ['Integrations'],
  handler: async ({ mastra, page, perPage, orderBy, ownerId, provider, enabled }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const integrationsStore = await storage.getStore('integrations');
      if (!integrationsStore) {
        throw new HTTPException(500, { message: 'Integrations storage domain is not available' });
      }

      const result = await integrationsStore.listIntegrations({
        page,
        perPage,
        orderBy,
        ownerId,
        provider,
        enabled,
      });

      // Enrich integrations with actual tool counts and toolkit names from cached_tools
      const enrichedIntegrations = await Promise.all(
        result.integrations.map(async integration => {
          const cachedToolsResult = await integrationsStore.listCachedTools({
            integrationId: integration.id,
            perPage: false, // Get all tools to extract toolkit names
          });

          // Extract unique toolkit names
          const toolkitNames = [
            ...new Set(cachedToolsResult.tools.map((t: any) => t.toolkitSlug).filter(Boolean)),
          ] as string[];

          return {
            ...integration,
            toolCount: cachedToolsResult.total,
            toolkitNames, // e.g., ["hackernews", "github"]
          };
        }),
      );

      return {
        ...result,
        integrations: enrichedIntegrations,
      };
    } catch (error) {
      return handleError(error, 'Error listing integrations');
    }
  },
});

/**
 * GET /api/integrations/:integrationId - Get an integration by ID
 */
export const GET_INTEGRATION_ROUTE = createRoute({
  method: 'GET',
  path: '/api/integrations/:integrationId',
  responseType: 'json',
  pathParamSchema: integrationIdPathParams,
  responseSchema: getIntegrationResponseSchema,
  summary: 'Get integration by ID',
  description: 'Returns a specific integration from storage by its unique identifier',
  tags: ['Integrations'],
  handler: async ({ mastra, integrationId }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const integrationsStore = await storage.getStore('integrations');
      if (!integrationsStore) {
        throw new HTTPException(500, { message: 'Integrations storage domain is not available' });
      }

      const integration = await integrationsStore.getIntegrationById({ id: integrationId });

      if (!integration) {
        throw new HTTPException(404, { message: `Integration with id ${integrationId} not found` });
      }

      return integration;
    } catch (error) {
      return handleError(error, 'Error getting integration');
    }
  },
});

/**
 * POST /api/integrations - Create a new integration
 */
export const CREATE_INTEGRATION_ROUTE = createRoute({
  method: 'POST',
  path: '/api/integrations',
  responseType: 'json',
  bodySchema: createIntegrationBodySchema,
  responseSchema: createIntegrationResponseSchema,
  summary: 'Create integration',
  description: 'Creates a new integration and caches its tools',
  tags: ['Integrations'],
  handler: async ({ mastra, id, name, provider, enabled, selectedToolkits, selectedTools, metadata, ownerId }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const integrationsStore = await storage.getStore('integrations');
      if (!integrationsStore) {
        throw new HTTPException(500, { message: 'Integrations storage domain is not available' });
      }

      // Handle MCP and Smithery providers similarly (both use MCP connection)
      if (provider === 'mcp' || provider === 'smithery') {
        // MCP/Smithery requires either URL (http) or command (stdio) in metadata
        const mcpMetadata = metadata as MCPIntegrationMetadata | SmitheryIntegrationMetadata | undefined;
        if (!mcpMetadata) {
          throw new HTTPException(400, {
            message: `${provider === 'smithery' ? 'Smithery' : 'MCP'} provider requires metadata with transport configuration`,
          });
        }

        const isHttpTransport = mcpMetadata.transport === 'http' || (!mcpMetadata.transport && mcpMetadata.url);
        const isStdioTransport = mcpMetadata.transport === 'stdio' || (!mcpMetadata.transport && mcpMetadata.command);

        if (isHttpTransport && !mcpMetadata.url) {
          throw new HTTPException(400, {
            message: `${provider === 'smithery' ? 'Smithery' : 'MCP'} HTTP transport requires a URL in metadata`,
          });
        }
        if (isStdioTransport && !mcpMetadata.command) {
          throw new HTTPException(400, {
            message: `${provider === 'smithery' ? 'Smithery' : 'MCP'} Stdio transport requires a command in metadata`,
          });
        }
        if (!isHttpTransport && !isStdioTransport) {
          throw new HTTPException(400, {
            message: `${provider === 'smithery' ? 'Smithery' : 'MCP'} provider requires either URL (http) or command (stdio) in metadata`,
          });
        }

        // Create MCP provider instance based on transport type
        const mcpProvider = isHttpTransport
          ? createMCPProvider({
              transport: 'http',
              url: mcpMetadata.url,
              headers: mcpMetadata.headers,
            })
          : createMCPProvider({
              transport: 'stdio',
              command: mcpMetadata.command,
              args: mcpMetadata.args,
              env: mcpMetadata.env,
            });

        // Validate connection
        const validation = await mcpProvider.validateConnection();
        if (!validation.valid) {
          await mcpProvider.disconnect();
          throw new HTTPException(400, {
            message: `Failed to connect to MCP server: ${validation.error}`,
          });
        }

        // Create the integration
        const integration = await integrationsStore.createIntegration({
          integration: {
            id: id || crypto.randomUUID(),
            name,
            provider,
            enabled: enabled ?? true,
            selectedToolkits: ['mcp-server'], // MCP/Smithery uses a single virtual toolkit
            metadata,
            ownerId,
          },
        });

        // Fetch and cache tools from MCP server
        try {
          const toolsResponse = await mcpProvider.listTools({ limit: 1000 });

          // Filter by selectedTools if provided
          const toolsToCache = selectedTools
            ? toolsResponse.tools.filter(tool => selectedTools.includes(tool.slug))
            : toolsResponse.tools;

          const cachedTools = toolsToCache.map(tool => ({
            id: crypto.randomUUID(),
            integrationId: integration.id,
            provider: provider as IntegrationProvider, // Use actual provider (mcp or smithery)
            toolkitSlug: 'mcp-server',
            toolSlug: tool.slug,
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema || {},
            outputSchema: tool.outputSchema,
            rawDefinition: tool.metadata || {},
            createdAt: new Date(),
          }));

          if (cachedTools.length > 0) {
            await integrationsStore.cacheTools({ tools: cachedTools });
          }
        } catch (toolError) {
          console.error(`Error caching tools for ${provider} integration ${integration.id}:`, toolError);
        } finally {
          await mcpProvider.disconnect();
        }

        return integration;
      }

      // Get the provider (Composio/Arcade)
      const toolProvider = getProvider(provider);

      // Check provider connection status
      const status = await toolProvider.getStatus();
      if (!status.connected) {
        throw new HTTPException(400, {
          message: `Provider ${provider} is not connected. Please set the ${provider.toUpperCase()}_API_KEY environment variable.`,
        });
      }

      // Create the integration (note: selectedTools is used for filtering cached tools, not stored in integration)
      const integration = await integrationsStore.createIntegration({
        integration: {
          id: id || crypto.randomUUID(),
          name,
          provider,
          enabled: enabled ?? true,
          selectedToolkits,
          metadata,
          ownerId,
        },
      });

      // Fetch and cache tools from the provider
      try {
        // Fetch tools for each selected toolkit separately to ensure we know which toolkit each tool belongs to
        const allToolsToCache: Array<{
          id: string;
          integrationId: string;
          provider: IntegrationProvider;
          toolkitSlug: string;
          toolSlug: string;
          name: string;
          description: string;
          inputSchema: Record<string, unknown>;
          outputSchema: Record<string, unknown> | undefined;
          rawDefinition: Record<string, unknown>;
          createdAt: Date;
        }> = [];

        for (const toolkit of selectedToolkits) {
          const toolsResponse = await toolProvider.listTools({
            toolkitSlug: toolkit,
            limit: 1000,
          });

          // Filter out deselected tools if selectedTools is provided
          const toolsToCache = selectedTools
            ? toolsResponse.tools.filter(tool => selectedTools.includes(tool.slug))
            : toolsResponse.tools;

          // For Composio, fetch full tool details to get complete input schemas
          // The listTools API may not return full schemas
          const toolsWithFullDetails = await Promise.all(
            toolsToCache.map(async tool => {
              // If inputSchema is empty or minimal, fetch full details
              const hasFullSchema =
                tool.inputSchema &&
                typeof tool.inputSchema === 'object' &&
                'properties' in tool.inputSchema &&
                Object.keys((tool.inputSchema as any).properties || {}).length > 0;

              if (!hasFullSchema && provider === 'composio' && 'getTool' in toolProvider) {
                try {
                  const fullTool = await (toolProvider as any).getTool(tool.slug);
                  return { ...tool, ...fullTool, toolkit: tool.toolkit || toolkit };
                } catch (err) {
                  console.warn(`Failed to fetch full details for tool ${tool.slug}:`, err);
                  return tool;
                }
              }
              return tool;
            }),
          );

          // Convert to cached tool format - use the toolkit we fetched from as the toolkitSlug
          const cachedTools = toolsWithFullDetails.map(tool => ({
            id: crypto.randomUUID(),
            integrationId: integration.id,
            provider,
            toolkitSlug: tool.toolkit || toolkit, // Use the toolkit we queried as fallback
            toolSlug: tool.slug,
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema || {},
            outputSchema: tool.outputSchema,
            rawDefinition: tool.metadata || {},
            createdAt: new Date(),
          }));

          allToolsToCache.push(...cachedTools);
        }

        const cachedTools = allToolsToCache;

        // Batch insert cached tools
        if (cachedTools.length > 0) {
          await integrationsStore.cacheTools({ tools: cachedTools });
        }
      } catch (toolError) {
        // Log error but don't fail the integration creation
        console.error(`Error caching tools for integration ${integration.id}:`, toolError);
      }

      return integration;
    } catch (error) {
      return handleError(error, 'Error creating integration');
    }
  },
});

/**
 * PATCH /api/integrations/:integrationId - Update an integration
 */
export const UPDATE_INTEGRATION_ROUTE = createRoute({
  method: 'PATCH',
  path: '/api/integrations/:integrationId',
  responseType: 'json',
  pathParamSchema: integrationIdPathParams,
  bodySchema: updateIntegrationBodySchema,
  responseSchema: updateIntegrationResponseSchema,
  summary: 'Update integration',
  description: 'Updates an existing integration configuration',
  tags: ['Integrations'],
  handler: async ({
    mastra,
    integrationId,
    name,
    provider,
    enabled,
    selectedToolkits,
    selectedTools,
    metadata,
    ownerId,
  }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const integrationsStore = await storage.getStore('integrations');
      if (!integrationsStore) {
        throw new HTTPException(500, { message: 'Integrations storage domain is not available' });
      }

      // Check if integration exists
      const existing = await integrationsStore.getIntegrationById({ id: integrationId });
      if (!existing) {
        throw new HTTPException(404, { message: `Integration with id ${integrationId} not found` });
      }

      // Update the integration
      const updatedIntegration = await integrationsStore.updateIntegration({
        id: integrationId,
        name,
        enabled,
        selectedToolkits,
        metadata,
        ownerId,
      });

      // If toolkits or tools selection changed, refresh the cached tools
      if (selectedToolkits || selectedTools) {
        try {
          // Handle MCP provider differently
          if (updatedIntegration.provider === 'mcp' || updatedIntegration.provider === 'smithery') {
            // Use existing metadata since the update request doesn't include connection info
            const mcpMetadata = existing.metadata as MCPIntegrationMetadata | undefined;
            if (!mcpMetadata) {
              console.error('MCP integration missing metadata:', { integrationId, existing });
              throw new Error('MCP integration is missing metadata');
            }
            const isHttpTransport = mcpMetadata.transport === 'http' || (!mcpMetadata.transport && mcpMetadata.url);
            const isStdioTransport =
              mcpMetadata.transport === 'stdio' || (!mcpMetadata.transport && mcpMetadata.command);

            console.log('MCP update - transport:', isHttpTransport ? 'http' : isStdioTransport ? 'stdio' : 'unknown');
            console.log('MCP update - metadata:', JSON.stringify(mcpMetadata, null, 2));

            if (!isHttpTransport && !isStdioTransport) {
              throw new Error('MCP integration is missing connection configuration');
            }

            const mcpConfig = isHttpTransport
              ? {
                  transport: 'http' as const,
                  url: mcpMetadata.url,
                  headers: mcpMetadata.headers,
                }
              : {
                  transport: 'stdio' as const,
                  command: mcpMetadata.command,
                  args: mcpMetadata.args,
                  env: mcpMetadata.env,
                };

            console.log('MCP update - creating provider with config:', JSON.stringify(mcpConfig, null, 2));
            const mcpProvider = createMCPProvider(mcpConfig);

            try {
              console.log('MCP update - selectedTools:', selectedTools);
              console.log('MCP update - connecting to MCP server...');

              const toolsResponse = await mcpProvider.listTools({ limit: 1000 });
              console.log('MCP update - got tools from server:', toolsResponse.tools.length);

              // Filter by selectedTools if provided
              const toolsToCache = selectedTools
                ? toolsResponse.tools.filter(tool => selectedTools.includes(tool.slug))
                : toolsResponse.tools;
              console.log('MCP update - tools to cache after filter:', toolsToCache.length);

              // Delete old cached tools AFTER successfully fetching new ones
              await integrationsStore.deleteCachedToolsByIntegration({ integrationId });
              console.log('MCP update - deleted old cached tools');

              const cachedTools = toolsToCache.map(tool => ({
                id: crypto.randomUUID(),
                integrationId: updatedIntegration.id,
                provider: 'mcp' as IntegrationProvider,
                toolkitSlug: 'mcp-server',
                toolSlug: tool.slug,
                name: tool.name,
                description: tool.description,
                inputSchema: tool.inputSchema || {},
                outputSchema: tool.outputSchema,
                rawDefinition: tool.metadata || {},
                createdAt: new Date(),
              }));

              if (cachedTools.length > 0) {
                await integrationsStore.cacheTools({ tools: cachedTools });
                console.log('MCP update - cached tools:', cachedTools.length);
              } else {
                console.log('MCP update - no tools to cache!');
              }
            } finally {
              await mcpProvider.disconnect();
            }
          } else {
            // Composio/Arcade providers
            const toolProvider = getProvider(updatedIntegration.provider);

            // Delete old cached tools
            await integrationsStore.deleteCachedToolsByIntegration({ integrationId });

            // Fetch and cache new tools - fetch each toolkit separately to preserve toolkit info
            const finalToolkits = selectedToolkits || existing.selectedToolkits;
            const allToolsToCache: Array<{
              id: string;
              integrationId: string;
              provider: IntegrationProvider;
              toolkitSlug: string;
              toolSlug: string;
              name: string;
              description: string;
              inputSchema: Record<string, unknown>;
              outputSchema: Record<string, unknown> | undefined;
              rawDefinition: Record<string, unknown>;
              createdAt: Date;
            }> = [];

            for (const toolkit of finalToolkits) {
              const toolsResponse = await toolProvider.listTools({
                toolkitSlug: toolkit,
                limit: 1000,
              });

              // Filter by selectedTools if provided, otherwise cache all tools from selected toolkits
              const toolsToCache = selectedTools
                ? toolsResponse.tools.filter(tool => selectedTools.includes(tool.slug))
                : toolsResponse.tools;

              // For Composio, fetch full tool details to get complete input schemas
              const toolsWithFullDetails = await Promise.all(
                toolsToCache.map(async tool => {
                  const hasFullSchema =
                    tool.inputSchema &&
                    typeof tool.inputSchema === 'object' &&
                    'properties' in tool.inputSchema &&
                    Object.keys((tool.inputSchema as any).properties || {}).length > 0;

                  if (!hasFullSchema && updatedIntegration.provider === 'composio' && 'getTool' in toolProvider) {
                    try {
                      const fullTool = await (toolProvider as any).getTool(tool.slug);
                      return { ...tool, ...fullTool, toolkit: tool.toolkit || toolkit };
                    } catch (err) {
                      console.warn(`Failed to fetch full details for tool ${tool.slug}:`, err);
                      return tool;
                    }
                  }
                  return tool;
                }),
              );

              const cachedTools = toolsWithFullDetails.map(tool => ({
                id: crypto.randomUUID(),
                integrationId: updatedIntegration.id,
                provider: updatedIntegration.provider,
                toolkitSlug: tool.toolkit || toolkit, // Use the toolkit we queried as fallback
                toolSlug: tool.slug,
                name: tool.name,
                description: tool.description,
                inputSchema: tool.inputSchema || {},
                outputSchema: tool.outputSchema,
                rawDefinition: tool.metadata || {},
                createdAt: new Date(),
              }));

              allToolsToCache.push(...cachedTools);
            }

            if (allToolsToCache.length > 0) {
              await integrationsStore.cacheTools({ tools: allToolsToCache });
            }
          }
        } catch (toolError) {
          console.error(`Error refreshing tools for integration ${integrationId}:`, toolError);
          // Re-throw so the user knows the update failed
          throw toolError;
        }
      }

      return updatedIntegration;
    } catch (error) {
      return handleError(error, 'Error updating integration');
    }
  },
});

/**
 * DELETE /api/integrations/:integrationId - Delete an integration
 */
export const DELETE_INTEGRATION_ROUTE = createRoute({
  method: 'DELETE',
  path: '/api/integrations/:integrationId',
  responseType: 'json',
  pathParamSchema: integrationIdPathParams,
  responseSchema: deleteIntegrationResponseSchema,
  summary: 'Delete integration',
  description: 'Deletes an integration and its cached tools',
  tags: ['Integrations'],
  handler: async ({ mastra, integrationId }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const integrationsStore = await storage.getStore('integrations');
      if (!integrationsStore) {
        throw new HTTPException(500, { message: 'Integrations storage domain is not available' });
      }

      // Check if integration exists
      const existing = await integrationsStore.getIntegrationById({ id: integrationId });
      if (!existing) {
        throw new HTTPException(404, { message: `Integration with id ${integrationId} not found` });
      }

      // Delete cached tools first
      await integrationsStore.deleteCachedToolsByIntegration({ integrationId });

      // Delete the integration
      await integrationsStore.deleteIntegration({ id: integrationId });

      return { success: true, message: `Integration ${integrationId} deleted successfully` };
    } catch (error) {
      return handleError(error, 'Error deleting integration');
    }
  },
});

/**
 * GET /api/integrations/providers - List all available providers
 */
export const GET_PROVIDERS_ROUTE = createRoute({
  method: 'GET',
  path: '/api/integrations/providers',
  responseType: 'json',
  responseSchema: listProvidersResponseSchema,
  summary: 'List integration providers',
  description: 'Returns all available integration providers with connection status',
  tags: ['Integrations'],
  handler: async () => {
    try {
      const providers = await listProviders();

      return { providers };
    } catch (error) {
      return handleError(error, 'Error listing providers');
    }
  },
});

/**
 * GET /api/integrations/:provider/toolkits - List toolkits from a provider
 */
export const LIST_PROVIDER_TOOLKITS_ROUTE = createRoute({
  method: 'GET',
  path: '/api/integrations/:provider/toolkits',
  responseType: 'json',
  pathParamSchema: providerPathParams,
  queryParamSchema: listToolkitsQuerySchema,
  responseSchema: listToolkitsResponseSchema,
  summary: 'List provider toolkits',
  description: 'Fetches available toolkits from the specified integration provider',
  tags: ['Integrations'],
  handler: async ({ provider, search, category, limit, cursor }) => {
    try {
      // Validate provider type
      if (provider !== 'composio' && provider !== 'arcade' && provider !== 'mcp' && provider !== 'smithery') {
        throw new HTTPException(400, {
          message: `Invalid provider: ${provider}. Must be 'composio', 'arcade', 'mcp', or 'smithery'.`,
        });
      }

      // Smithery - list servers as toolkits
      if (provider === 'smithery') {
        const smitheryProvider = new SmitheryProvider();
        const response = await smitheryProvider.listToolkits({
          search,
          category,
          limit,
          cursor,
        });
        return response;
      }

      // MCP doesn't have toolkits - return placeholder
      if (provider === 'mcp') {
        return {
          toolkits: [
            {
              slug: 'mcp-server',
              name: 'MCP Server Tools',
              description: 'Tools from the MCP server',
              toolCount: 0,
            },
          ],
          hasMore: false,
        };
      }

      const toolProvider = getProvider(provider);

      // Check provider connection status
      const status = await toolProvider.getStatus();
      if (!status.connected) {
        throw new HTTPException(400, {
          message: `Provider ${provider} is not connected. Please set the ${provider.toUpperCase()}_API_KEY environment variable.`,
        });
      }

      const response = await toolProvider.listToolkits({
        search,
        category,
        limit,
        cursor,
      });

      return response;
    } catch (error) {
      return handleError(error, `Error listing toolkits from provider ${provider}`);
    }
  },
});

/**
 * GET /api/integrations/:provider/tools - List tools from a provider
 */
export const LIST_PROVIDER_TOOLS_ROUTE = createRoute({
  method: 'GET',
  path: '/api/integrations/:provider/tools',
  responseType: 'json',
  pathParamSchema: providerPathParams,
  queryParamSchema: listToolsQuerySchema,
  responseSchema: listToolsResponseSchema,
  summary: 'List provider tools',
  description: 'Fetches available tools from the specified integration provider',
  tags: ['Integrations'],
  handler: async ({ provider, toolkitSlug, toolkitSlugs, search, limit, cursor, url, headers, command, args, env }) => {
    try {
      // Validate provider type
      if (provider !== 'composio' && provider !== 'arcade' && provider !== 'mcp' && provider !== 'smithery') {
        throw new HTTPException(400, {
          message: `Invalid provider: ${provider}. Must be 'composio', 'arcade', 'mcp', or 'smithery'.`,
        });
      }

      // Handle MCP and Smithery providers - both require URL (http) or command (stdio)
      // Smithery integrations use MCP under the hood with connection details from Smithery registry
      if (provider === 'mcp' || provider === 'smithery') {
        const isHttpTransport = !!url;
        const isStdioTransport = !!command;

        if (!isHttpTransport && !isStdioTransport) {
          throw new HTTPException(400, {
            message: 'MCP provider requires either URL (http) or command (stdio) parameter',
          });
        }

        let mcpProvider;

        if (isHttpTransport) {
          // Parse headers if provided as JSON string
          let parsedHeaders: Record<string, string> | undefined;
          if (headers) {
            try {
              parsedHeaders = JSON.parse(headers);
            } catch {
              throw new HTTPException(400, {
                message: 'Invalid headers format. Must be valid JSON.',
              });
            }
          }

          mcpProvider = createMCPProvider({
            transport: 'http',
            url,
            headers: parsedHeaders,
          });
        } else {
          // Parse args if provided as JSON string
          let parsedArgs: string[] | undefined;
          if (args) {
            try {
              parsedArgs = JSON.parse(args);
            } catch {
              throw new HTTPException(400, {
                message: 'Invalid args format. Must be valid JSON array.',
              });
            }
          }

          // Parse env if provided as JSON string
          let parsedEnv: Record<string, string> | undefined;
          if (env) {
            try {
              parsedEnv = JSON.parse(env);
            } catch {
              throw new HTTPException(400, {
                message: 'Invalid env format. Must be valid JSON object.',
              });
            }
          }

          mcpProvider = createMCPProvider({
            transport: 'stdio',
            command,
            args: parsedArgs,
            env: parsedEnv,
          });
        }

        try {
          const response = await mcpProvider.listTools({
            search,
            limit,
            cursor,
          });

          return response;
        } finally {
          // Clean up connection
          await mcpProvider.disconnect();
        }
      }

      const toolProvider = getProvider(provider);

      // Check provider connection status
      const status = await toolProvider.getStatus();
      if (!status.connected) {
        throw new HTTPException(400, {
          message: `Provider ${provider} is not connected. Please set the ${provider.toUpperCase()}_API_KEY environment variable.`,
        });
      }

      // Convert comma-separated toolkitSlugs to array
      const toolkitSlugsArray = toolkitSlugs ? toolkitSlugs.split(',').map(s => s.trim()) : undefined;

      const response = await toolProvider.listTools({
        toolkitSlug,
        toolkitSlugs: toolkitSlugsArray,
        search,
        limit,
        cursor,
      });

      return response;
    } catch (error) {
      return handleError(error, `Error listing tools from provider ${provider}`);
    }
  },
});

/**
 * POST /api/integrations/:integrationId/refresh - Refresh cached tools
 */
export const REFRESH_INTEGRATION_TOOLS_ROUTE = createRoute({
  method: 'POST',
  path: '/api/integrations/:integrationId/refresh',
  responseType: 'json',
  pathParamSchema: integrationIdPathParams,
  bodySchema: refreshIntegrationBodySchema,
  responseSchema: refreshIntegrationResponseSchema,
  summary: 'Refresh integration tools',
  description: 'Re-fetches and updates cached tools from the provider',
  tags: ['Integrations'],
  handler: async ({ mastra, integrationId }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const integrationsStore = await storage.getStore('integrations');
      if (!integrationsStore) {
        throw new HTTPException(500, { message: 'Integrations storage domain is not available' });
      }

      // Get the integration
      const integration = await integrationsStore.getIntegrationById({ id: integrationId });
      if (!integration) {
        throw new HTTPException(404, { message: `Integration with id ${integrationId} not found` });
      }

      // Get existing cached tools - we'll only refresh tools that are currently cached
      // (preserving the user's tool selection from previous add/remove operations)
      const existingCachedTools = await integrationsStore.listCachedTools({ integrationId });
      const existingToolSlugs = new Set(existingCachedTools.tools.map(t => t.toolSlug));

      // Delete old cached tools
      await integrationsStore.deleteCachedToolsByIntegration({ integrationId });

      // Handle MCP provider differently
      if (integration.provider === 'mcp' || integration.provider === 'smithery') {
        const mcpMetadata = integration.metadata as MCPIntegrationMetadata | undefined;
        if (!mcpMetadata) {
          throw new HTTPException(400, {
            message: 'MCP integration is missing metadata',
          });
        }

        // Determine transport type
        const isHttpTransport = mcpMetadata.transport === 'http' || (!mcpMetadata.transport && mcpMetadata.url);
        const isStdioTransport = mcpMetadata.transport === 'stdio' || (!mcpMetadata.transport && mcpMetadata.command);

        if (!isHttpTransport && !isStdioTransport) {
          throw new HTTPException(400, {
            message: 'MCP integration is missing connection configuration (url or command)',
          });
        }

        const mcpProvider = isHttpTransport
          ? createMCPProvider({
              transport: 'http',
              url: mcpMetadata.url,
              headers: mcpMetadata.headers,
            })
          : createMCPProvider({
              transport: 'stdio',
              command: mcpMetadata.command,
              args: mcpMetadata.args,
              env: mcpMetadata.env,
            });

        try {
          const toolsResponse = await mcpProvider.listTools({ limit: 1000 });

          // Only cache tools that were previously cached (preserves user's tool selection)
          const toolsToCache =
            existingToolSlugs.size > 0
              ? toolsResponse.tools.filter(tool => existingToolSlugs.has(tool.slug))
              : toolsResponse.tools;

          const cachedTools = toolsToCache.map(tool => ({
            id: crypto.randomUUID(),
            integrationId: integration.id,
            provider: 'mcp' as IntegrationProvider,
            toolkitSlug: 'mcp-server',
            toolSlug: tool.slug,
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema || {},
            outputSchema: tool.outputSchema,
            rawDefinition: tool.metadata || {},
            createdAt: new Date(),
          }));

          if (cachedTools.length > 0) {
            await integrationsStore.cacheTools({ tools: cachedTools });
          }

          return {
            success: true,
            message: `Refreshed ${cachedTools.length} tools for MCP integration ${integrationId}`,
            toolsUpdated: cachedTools.length,
          };
        } finally {
          await mcpProvider.disconnect();
        }
      }

      // Get the provider (Composio/Arcade)
      const toolProvider = getProvider(integration.provider);

      // Check provider connection status
      const status = await toolProvider.getStatus();
      if (!status.connected) {
        throw new HTTPException(400, {
          message: `Provider ${integration.provider} is not connected. Please set the ${integration.provider.toUpperCase()}_API_KEY environment variable.`,
        });
      }

      // Fetch and cache new tools - fetch each toolkit separately to preserve toolkit info
      const allToolsToCache: Array<{
        id: string;
        integrationId: string;
        provider: IntegrationProvider;
        toolkitSlug: string;
        toolSlug: string;
        name: string;
        description: string;
        inputSchema: Record<string, unknown>;
        outputSchema: Record<string, unknown> | undefined;
        rawDefinition: Record<string, unknown>;
        createdAt: Date;
      }> = [];

      for (const toolkit of integration.selectedToolkits) {
        const toolsResponse = await toolProvider.listTools({
          toolkitSlug: toolkit,
          limit: 1000,
        });

        // Only cache tools that were previously cached (preserves user's tool selection)
        const toolsToCache =
          existingToolSlugs.size > 0
            ? toolsResponse.tools.filter(tool => existingToolSlugs.has(tool.slug))
            : toolsResponse.tools;

        // For Composio, fetch full tool details to get complete input schemas
        const toolsWithFullDetails = await Promise.all(
          toolsToCache.map(async tool => {
            const hasFullSchema =
              tool.inputSchema &&
              typeof tool.inputSchema === 'object' &&
              'properties' in tool.inputSchema &&
              Object.keys((tool.inputSchema as any).properties || {}).length > 0;

            if (!hasFullSchema && integration.provider === 'composio' && 'getTool' in toolProvider) {
              try {
                const fullTool = await (toolProvider as any).getTool(tool.slug);
                return { ...tool, ...fullTool, toolkit: tool.toolkit || toolkit };
              } catch (err) {
                console.warn(`Failed to fetch full details for tool ${tool.slug}:`, err);
                return tool;
              }
            }
            return tool;
          }),
        );

        const cachedTools = toolsWithFullDetails.map(tool => ({
          id: crypto.randomUUID(),
          integrationId: integration.id,
          provider: integration.provider,
          toolkitSlug: tool.toolkit || toolkit, // Use the toolkit we queried as fallback
          toolSlug: tool.slug,
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema || {},
          outputSchema: tool.outputSchema,
          rawDefinition: tool.metadata || {},
          createdAt: new Date(),
        }));

        allToolsToCache.push(...cachedTools);
      }

      if (allToolsToCache.length > 0) {
        await integrationsStore.cacheTools({ tools: allToolsToCache });
      }

      const cachedTools = allToolsToCache;

      return {
        success: true,
        message: `Refreshed ${cachedTools.length} tools for integration ${integrationId}`,
        toolsUpdated: cachedTools.length,
      };
    } catch (error) {
      return handleError(error, 'Error refreshing integration tools');
    }
  },
});

/**
 * POST /api/integrations/mcp/validate - Validate MCP server connection
 *
 * Supports both HTTP and Stdio transports:
 * - HTTP: { transport: 'http', url: '...', headers?: {...} }
 * - Stdio: { transport: 'stdio', command: '...', args?: [...], env?: {...} }
 */
export const VALIDATE_MCP_ROUTE = createRoute({
  method: 'POST',
  path: '/api/integrations/mcp/validate',
  responseType: 'json',
  bodySchema: validateMCPBodySchema,
  responseSchema: validateMCPResponseSchema,
  summary: 'Validate MCP connection',
  description: 'Tests connection to an MCP server (HTTP or Stdio) and returns available tool count',
  tags: ['Integrations'],
  handler: async ({ transport, url, headers, command, args, env }) => {
    try {
      const mcpProvider = createMCPProvider(
        transport === 'http' ? { transport: 'http', url, headers } : { transport: 'stdio', command, args, env },
      );

      try {
        const validation = await mcpProvider.validateConnection();
        return validation;
      } finally {
        await mcpProvider.disconnect();
      }
    } catch (error) {
      return {
        valid: false,
        toolCount: 0,
        error: error instanceof Error ? error.message : 'Failed to connect to MCP server',
      };
    }
  },
});

/**
 * DELETE /api/integrations/:integrationId/tools/:toolId - Delete a single cached tool
 */
export const DELETE_CACHED_TOOL_ROUTE = createRoute({
  method: 'DELETE',
  path: '/api/integrations/:integrationId/tools/:toolId',
  responseType: 'json',
  pathParamSchema: cachedToolPathParams,
  responseSchema: deleteCachedToolResponseSchema,
  summary: 'Delete cached tool',
  description: 'Deletes a single cached tool from an integration without removing the integration itself',
  tags: ['Integrations'],
  handler: async ({ mastra, integrationId, toolId }) => {
    try {
      const storage = mastra.getStorage();

      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const integrationsStore = await storage.getStore('integrations');
      if (!integrationsStore) {
        throw new HTTPException(500, { message: 'Integrations storage domain is not available' });
      }

      // Check if integration exists
      const integration = await integrationsStore.getIntegrationById({ id: integrationId });
      if (!integration) {
        throw new HTTPException(404, { message: `Integration with id ${integrationId} not found` });
      }

      // Check if tool exists
      const tool = await integrationsStore.getCachedTool({ id: toolId });
      if (!tool) {
        throw new HTTPException(404, { message: `Cached tool with id ${toolId} not found` });
      }

      // Verify tool belongs to this integration
      if (tool.integrationId !== integrationId) {
        throw new HTTPException(400, {
          message: `Tool ${toolId} does not belong to integration ${integrationId}`,
        });
      }

      // Delete the cached tool
      await integrationsStore.deleteCachedTool({ id: toolId });

      return { success: true, message: `Tool ${toolId} deleted successfully` };
    } catch (error) {
      return handleError(error, 'Error deleting cached tool');
    }
  },
});

// ============================================================================
// Smithery Registry Routes
// ============================================================================

/**
 * GET /api/integrations/smithery/servers - Search Smithery registry for MCP servers
 */
export const LIST_SMITHERY_SERVERS_ROUTE = createRoute({
  method: 'GET',
  path: '/api/integrations/smithery/servers',
  responseType: 'json',
  queryParamSchema: smitheryServersQuerySchema,
  responseSchema: smitheryServersResponseSchema,
  summary: 'Search Smithery servers',
  description: 'Search the Smithery registry for MCP servers',
  tags: ['Integrations', 'Smithery'],
  handler: async ({ q, page, pageSize }) => {
    try {
      const smitheryProvider = new SmitheryProvider();
      const response = await smitheryProvider.searchServers({
        query: q,
        page,
        pageSize,
      });
      return response;
    } catch (error) {
      return handleError(error, 'Error searching Smithery servers');
    }
  },
});

/**
 * GET /api/integrations/smithery/servers/:qualifiedName - Get Smithery server details
 */
export const GET_SMITHERY_SERVER_ROUTE = createRoute({
  method: 'GET',
  path: '/api/integrations/smithery/servers/:qualifiedName',
  responseType: 'json',
  pathParamSchema: smitheryServerPathParams,
  responseSchema: smitheryServerDetailsResponseSchema,
  summary: 'Get Smithery server details',
  description: 'Get detailed information about a specific MCP server from Smithery, including connection details',
  tags: ['Integrations', 'Smithery'],
  handler: async ({ qualifiedName }) => {
    try {
      const smitheryProvider = new SmitheryProvider();

      // Get server info
      const server = await smitheryProvider.getServer(qualifiedName);

      // Get connection details
      let connection;
      try {
        connection = await smitheryProvider.getServerConnection(qualifiedName);
      } catch {
        // Connection info may not be available for all servers
        connection = undefined;
      }

      return {
        ...server,
        connection,
      };
    } catch (error) {
      return handleError(error, `Error getting Smithery server ${qualifiedName}`);
    }
  },
});

// ============================================================================
// Arcade Authorization Routes
// ============================================================================

/**
 * POST /api/integrations/arcade/authorize - Initiate authorization for an Arcade tool
 */
export const ARCADE_AUTHORIZE_ROUTE = createRoute({
  method: 'POST',
  path: '/api/integrations/arcade/authorize',
  responseType: 'json',
  bodySchema: arcadeAuthorizeBodySchema,
  responseSchema: arcadeAuthorizeResponseSchema,
  summary: 'Authorize Arcade toolkit',
  description: 'Initiate OAuth authorization for an Arcade toolkit that requires authentication',
  tags: ['Integrations', 'Arcade'],
  handler: async ({ toolkitSlug, userId }) => {
    try {
      const arcadeProvider = new ArcadeProvider();
      const response = await arcadeProvider.authorize(toolkitSlug, userId);
      return response;
    } catch (error) {
      return handleError(error, 'Error initiating Arcade authorization');
    }
  },
});

/**
 * GET /api/integrations/arcade/auth/status - Check authorization status
 */
export const ARCADE_AUTH_STATUS_ROUTE = createRoute({
  method: 'GET',
  path: '/api/integrations/arcade/auth/status',
  responseType: 'json',
  queryParamSchema: arcadeAuthStatusQuerySchema,
  responseSchema: arcadeAuthStatusResponseSchema,
  summary: 'Check Arcade auth status',
  description: 'Check the status of a pending Arcade authorization',
  tags: ['Integrations', 'Arcade'],
  handler: async ({ authorizationId }) => {
    try {
      // Check auth status via the Arcade API
      const url = `https://api.arcade.dev/v1/auth/status?id=${authorizationId}`;
      const apiKey = process.env.ARCADE_API_KEY;

      if (!apiKey) {
        throw new HTTPException(500, { message: 'ARCADE_API_KEY is not configured' });
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new HTTPException(response.status as 400 | 401 | 403 | 404 | 500, {
          message: `Arcade API error: ${response.statusText}`,
        });
      }

      const data = (await response.json()) as { status: string };

      const status: 'pending' | 'completed' | 'failed' =
        data.status === 'completed' ? 'completed' : data.status === 'failed' ? 'failed' : 'pending';

      return {
        status,
        completed: data.status === 'completed',
      };
    } catch (error) {
      return handleError(error, 'Error checking Arcade authorization status');
    }
  },
});

// ============================================================================
// Composio Authorization Routes
// ============================================================================

/**
 * POST /api/integrations/composio/authorize - Initiate authorization for a Composio toolkit
 */
export const COMPOSIO_AUTHORIZE_ROUTE = createRoute({
  method: 'POST',
  path: '/api/integrations/composio/authorize',
  responseType: 'json',
  bodySchema: composioAuthorizeBodySchema,
  responseSchema: composioAuthorizeResponseSchema,
  summary: 'Authorize Composio toolkit',
  description: 'Initiate OAuth authorization for a Composio toolkit that requires authentication',
  tags: ['Integrations', 'Composio'],
  handler: async ({ toolkitSlug, userId, callbackUrl }) => {
    try {
      const composioProvider = new ComposioProvider();
      const response = await composioProvider.authorize(toolkitSlug, userId, callbackUrl);
      return response;
    } catch (error) {
      return handleError(error, 'Error initiating Composio authorization');
    }
  },
});

/**
 * GET /api/integrations/composio/auth/status - Check authorization status
 */
export const COMPOSIO_AUTH_STATUS_ROUTE = createRoute({
  method: 'GET',
  path: '/api/integrations/composio/auth/status',
  responseType: 'json',
  queryParamSchema: composioAuthStatusQuerySchema,
  responseSchema: composioAuthStatusResponseSchema,
  summary: 'Check Composio auth status',
  description: 'Check the status of a pending Composio authorization',
  tags: ['Integrations', 'Composio'],
  handler: async ({ authorizationId }) => {
    try {
      const composioProvider = new ComposioProvider();
      const response = await composioProvider.checkAuthorizationStatus(authorizationId);
      return response;
    } catch (error) {
      return handleError(error, 'Error checking Composio authorization status');
    }
  },
});
