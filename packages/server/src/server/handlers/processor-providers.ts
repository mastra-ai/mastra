import { zodToJsonSchema } from '@mastra/core/utils/zod-to-json';

import { SERVER_ERROR_CODES } from '../error-codes';
import { HTTPException } from '../http-exception';
import {
  processorProviderIdPathParams,
  getProcessorProvidersResponseSchema,
  getProcessorProviderResponseSchema,
} from '../schemas/processor-providers';
import { createRoute } from '../server-adapter/routes/route-builder';

import { handleError } from './error';

// ============================================================================
// Route Definitions
// ============================================================================

/**
 * GET /processor-providers - List all registered processor providers
 */
export const LIST_PROCESSOR_PROVIDERS_ROUTE = createRoute({
  method: 'GET',
  path: '/processor-providers',
  responseType: 'json',
  responseSchema: getProcessorProvidersResponseSchema,
  summary: 'List processor providers',
  description: 'Returns a list of all registered processor providers with their info and available phases',
  tags: ['Processor Providers'],
  requiresAuth: true,
  errors: ['EDITOR_NOT_CONFIGURED', 'PROCESSOR_PROVIDERS_LIST_FAILED'],
  handler: async ({ mastra }) => {
    try {
      const editor = mastra.getEditor();

      if (!editor) {
        throw new HTTPException(500, {
          message: 'Editor is not configured',
          code: SERVER_ERROR_CODES.EDITOR_NOT_CONFIGURED,
        });
      }

      const providers = editor.getProcessorProviders();

      return {
        providers: Object.values(providers).map(provider => ({
          ...provider.info,
          availablePhases: provider.availablePhases,
        })),
      };
    } catch (error) {
      return handleError(error, {
        message: 'Error listing processor providers',
        code: SERVER_ERROR_CODES.PROCESSOR_PROVIDERS_LIST_FAILED,
      });
    }
  },
});

/**
 * GET /processor-providers/:providerId - Get a specific processor provider with config schema
 */
export const GET_PROCESSOR_PROVIDER_ROUTE = createRoute({
  method: 'GET',
  path: '/processor-providers/:providerId',
  responseType: 'json',
  pathParamSchema: processorProviderIdPathParams,
  responseSchema: getProcessorProviderResponseSchema,
  summary: 'Get processor provider details',
  description: 'Returns details about a specific processor provider, including its configuration schema',
  tags: ['Processor Providers'],
  requiresAuth: true,
  errors: ['EDITOR_NOT_CONFIGURED', 'PROCESSOR_PROVIDER_GET_FAILED', 'PROCESSOR_PROVIDER_NOT_FOUND'],
  handler: async ({ mastra, providerId }) => {
    try {
      const editor = mastra.getEditor();

      if (!editor) {
        throw new HTTPException(500, {
          message: 'Editor is not configured',
          code: SERVER_ERROR_CODES.EDITOR_NOT_CONFIGURED,
        });
      }

      const provider = editor.getProcessorProvider(providerId);

      if (!provider) {
        throw new HTTPException(404, {
          message: `Processor provider with id ${providerId} not found`,
          code: SERVER_ERROR_CODES.PROCESSOR_PROVIDER_NOT_FOUND,
          metadata: { providerId },
        });
      }

      return {
        ...provider.info,
        availablePhases: provider.availablePhases,
        configSchema: zodToJsonSchema(provider.configSchema) as Record<string, unknown>,
      };
    } catch (error) {
      return handleError(error, {
        message: 'Error getting processor provider',
        code: SERVER_ERROR_CODES.PROCESSOR_PROVIDER_GET_FAILED,
      });
    }
  },
});
