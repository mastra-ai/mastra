import { HTTPException } from '../http-exception';
import {
  toolProviderIdPathParams,
  toolSlugPathParams,
  listToolProviderToolsQuerySchema,
  listToolProvidersResponseSchema,
  listToolProviderToolkitsResponseSchema,
  listToolProviderToolsResponseSchema,
  getToolProviderToolSchemaResponseSchema,
} from '../schemas/tool-providers';
import { createRoute } from '../server-adapter/routes/route-builder';

import { handleError } from './error';

// ============================================================================
// Route Definitions
// ============================================================================

/**
 * GET /tool-providers - List all registered tool providers
 */
export const LIST_TOOL_PROVIDERS_ROUTE = createRoute({
  method: 'GET',
  path: '/tool-providers',
  responseType: 'json',
  responseSchema: listToolProvidersResponseSchema,
  summary: 'List tool providers',
  description: 'Returns a list of all registered tool providers with their info',
  tags: ['Tool Providers'],
  requiresAuth: true,
  handler: async ({ mastra }) => {
    try {
      const editor = mastra.getEditor();

      if (!editor) {
        throw new HTTPException(500, { message: 'Editor is not configured' });
      }

      const providers = editor.getToolProviders();

      return { providers: Object.values(providers).map(provider => provider.info) };
    } catch (error) {
      return handleError(error, 'Error listing tool providers');
    }
  },
});

/**
 * GET /tool-providers/:providerId/toolkits - List toolkits for a tool provider
 */
export const LIST_TOOL_PROVIDER_TOOLKITS_ROUTE = createRoute({
  method: 'GET',
  path: '/tool-providers/:providerId/toolkits',
  responseType: 'json',
  pathParamSchema: toolProviderIdPathParams,
  responseSchema: listToolProviderToolkitsResponseSchema,
  summary: 'List tool provider toolkits',
  description: 'Returns the toolkits available from a specific tool provider',
  tags: ['Tool Providers'],
  requiresAuth: true,
  handler: async ({ mastra, providerId }) => {
    try {
      const editor = mastra.getEditor();

      if (!editor) {
        throw new HTTPException(500, { message: 'Editor is not configured' });
      }

      const provider = editor.getToolProvider(providerId);

      if (!provider) {
        throw new HTTPException(404, { message: `Tool provider with id ${providerId} not found` });
      }

      if (!provider.listToolkits) {
        return { data: [] };
      }

      return await provider.listToolkits();
    } catch (error) {
      return handleError(error, 'Error listing tool provider toolkits');
    }
  },
});

/**
 * GET /tool-providers/:providerId/tools - List tools for a tool provider
 */
export const LIST_TOOL_PROVIDER_TOOLS_ROUTE = createRoute({
  method: 'GET',
  path: '/tool-providers/:providerId/tools',
  responseType: 'json',
  pathParamSchema: toolProviderIdPathParams,
  queryParamSchema: listToolProviderToolsQuerySchema,
  responseSchema: listToolProviderToolsResponseSchema,
  summary: 'List tool provider tools',
  description: 'Returns the tools available from a specific tool provider, with optional filtering',
  tags: ['Tool Providers'],
  requiresAuth: true,
  handler: async ({ mastra, providerId, toolkit, search, page, perPage }) => {
    try {
      const editor = mastra.getEditor();

      if (!editor) {
        throw new HTTPException(500, { message: 'Editor is not configured' });
      }

      const provider = editor.getToolProvider(providerId);

      if (!provider) {
        throw new HTTPException(404, { message: `Tool provider with id ${providerId} not found` });
      }

      const options: Record<string, unknown> = {};
      if (toolkit !== undefined) options.toolkit = toolkit;
      if (search !== undefined) options.search = search;
      if (page !== undefined) options.page = page;
      if (perPage !== undefined) options.perPage = perPage;

      return await provider.listTools(Object.keys(options).length > 0 ? options : undefined);
    } catch (error) {
      return handleError(error, 'Error listing tool provider tools');
    }
  },
});

/**
 * GET /tool-providers/:providerId/tools/:toolSlug/schema - Get tool schema
 */
export const GET_TOOL_PROVIDER_TOOL_SCHEMA_ROUTE = createRoute({
  method: 'GET',
  path: '/tool-providers/:providerId/tools/:toolSlug/schema',
  responseType: 'json',
  pathParamSchema: toolSlugPathParams,
  responseSchema: getToolProviderToolSchemaResponseSchema,
  summary: 'Get tool provider tool schema',
  description: 'Returns the schema for a specific tool from a tool provider',
  tags: ['Tool Providers'],
  requiresAuth: true,
  handler: async ({ mastra, providerId, toolSlug }) => {
    try {
      const editor = mastra.getEditor();

      if (!editor) {
        throw new HTTPException(500, { message: 'Editor is not configured' });
      }

      const provider = editor.getToolProvider(providerId);

      if (!provider) {
        throw new HTTPException(404, { message: `Tool provider with id ${providerId} not found` });
      }

      if (!provider.getToolSchema) {
        throw new HTTPException(404, { message: `Tool provider ${providerId} does not support getToolSchema` });
      }

      const schema = await provider.getToolSchema(toolSlug);

      if (!schema) {
        throw new HTTPException(404, { message: `Schema for tool ${toolSlug} not found in provider ${providerId}` });
      }

      return schema;
    } catch (error) {
      return handleError(error, 'Error getting tool provider tool schema');
    }
  },
});
