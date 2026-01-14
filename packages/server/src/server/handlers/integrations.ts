import { HTTPException } from '../http-exception';
import {
  integrationIdPathParams,
  providerPathParams,
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
} from '../schemas/integrations';
import { createRoute } from '../server-adapter/routes/route-builder';

import { handleError } from './error';

import type { StorageCachedToolInput } from '@mastra/core/storage';

import { getProvider, listProviders } from '@mastra/core/integrations';

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

      return result;
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

      // Get the provider
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
        // Fetch all tools for the selected toolkits
        const toolsResponse = await toolProvider.listTools({
          toolkitSlugs: selectedToolkits,
          limit: 1000, // Fetch a large number to get all tools
        });

        // Filter out deselected tools if selectedTools is provided
        const toolsToCache = selectedTools
          ? toolsResponse.tools.filter(tool => selectedTools.includes(tool.slug))
          : toolsResponse.tools;

        // Convert to cached tool format
        const cachedTools = toolsToCache.map(tool => ({
          id: crypto.randomUUID(),
          integrationId: integration.id,
          provider,
          toolkitSlug: tool.toolkit || '',
          toolSlug: tool.slug,
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema || {},
          outputSchema: tool.outputSchema,
          rawDefinition: tool.metadata || {},
          createdAt: new Date(),
        }));

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

      // If toolkits changed, refresh the cached tools
      if (selectedToolkits || selectedTools) {
        try {
          const toolProvider = getProvider(updatedIntegration.provider);

          // Delete old cached tools
          await integrationsStore.deleteCachedToolsByIntegration({ integrationId });

          // Fetch and cache new tools
          const finalToolkits = selectedToolkits || existing.selectedToolkits;
          const toolsResponse = await toolProvider.listTools({
            toolkitSlugs: finalToolkits,
            limit: 1000,
          });

          // Filter by selectedTools if provided, otherwise cache all tools from selected toolkits
          const toolsToCache = selectedTools
            ? toolsResponse.tools.filter(tool => selectedTools.includes(tool.slug))
            : toolsResponse.tools;

          const cachedTools = toolsToCache.map(tool => ({
            id: crypto.randomUUID(),
            integrationId: updatedIntegration.id,
            provider: updatedIntegration.provider,
            toolkitSlug: tool.toolkit || '',
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
          console.error(`Error refreshing tools for integration ${integrationId}:`, toolError);
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
      if (provider !== 'composio' && provider !== 'arcade') {
        throw new HTTPException(400, {
          message: `Invalid provider: ${provider}. Must be 'composio' or 'arcade'.`,
        });
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
  handler: async ({ provider, toolkitSlug, toolkitSlugs, search, limit, cursor }) => {
    try {
      // Validate provider type
      if (provider !== 'composio' && provider !== 'arcade') {
        throw new HTTPException(400, {
          message: `Invalid provider: ${provider}. Must be 'composio' or 'arcade'.`,
        });
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

      // Get the provider
      const toolProvider = getProvider(integration.provider);

      // Check provider connection status
      const status = await toolProvider.getStatus();
      if (!status.connected) {
        throw new HTTPException(400, {
          message: `Provider ${integration.provider} is not connected. Please set the ${integration.provider.toUpperCase()}_API_KEY environment variable.`,
        });
      }

      // Get existing cached tools to determine which ones to re-cache
      const existingCachedTools = await integrationsStore.listCachedTools({ integrationId });
      const existingToolSlugs = new Set(existingCachedTools.tools.map(t => t.toolSlug));

      // Delete old cached tools
      await integrationsStore.deleteCachedToolsByIntegration({ integrationId });

      // Fetch and cache new tools
      const toolsResponse = await toolProvider.listTools({
        toolkitSlugs: integration.selectedToolkits,
        limit: 1000,
      });

      // Only cache tools that were previously cached (respects original selectedTools filtering)
      const toolsToCache =
        existingToolSlugs.size > 0
          ? toolsResponse.tools.filter(tool => existingToolSlugs.has(tool.slug))
          : toolsResponse.tools;

      const cachedTools = toolsToCache.map(tool => ({
        id: crypto.randomUUID(),
        integrationId: integration.id,
        provider: integration.provider,
        toolkitSlug: tool.toolkit || '',
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
        message: `Refreshed ${cachedTools.length} tools for integration ${integrationId}`,
        toolsUpdated: cachedTools.length,
      };
    } catch (error) {
      return handleError(error, 'Error refreshing integration tools');
    }
  },
});
