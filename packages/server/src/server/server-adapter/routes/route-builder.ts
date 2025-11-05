import { generateRouteOpenAPI } from '../openapi-utils';
import type { ServerRoute, ServerRouteHandler } from './index';

interface RouteConfig<TParams = Record<string, unknown>, TResponse = unknown> {
  method: ServerRoute['method'];
  path: string;
  responseType: 'stream' | 'json';
  handler: ServerRouteHandler<TParams, TResponse>;
  pathParamSchema?: ServerRoute['pathParamSchema'];
  queryParamSchema?: ServerRoute['queryParamSchema'];
  bodySchema?: ServerRoute['bodySchema'];
  responseSchema?: ServerRoute['responseSchema'];
  summary?: string;
  description?: string;
  tags?: string[];
}

/**
 * Creates a server route with auto-generated OpenAPI specification
 *
 * @param config - Route configuration including schemas, handler, and metadata
 * @returns Complete ServerRoute with OpenAPI spec
 *
 * @example
 * ```typescript
 * const route = createRoute({
 *   method: 'GET',
 *   path: '/api/agents/:agentId',
 *   responseType: 'json',
 *   handler: getAgentHandler,
 *   responseSchema: agentSchema,
 *   summary: 'Get agent by ID',
 *   description: 'Returns details for a specific agent',
 *   tags: ['Agents'],
 * });
 * ```
 */
export function createRoute<TParams = Record<string, unknown>, TResponse = unknown>(
  config: RouteConfig<TParams, TResponse>,
): ServerRoute<TParams, TResponse> {
  const { summary, description, tags, ...baseRoute } = config;

  // Generate OpenAPI specification from the route config
  // Skip OpenAPI generation for 'ALL' method as it doesn't map to OpenAPI
  const openapi =
    config.method !== 'ALL'
      ? generateRouteOpenAPI({
          method: config.method as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
          path: config.path,
          summary,
          description,
          tags,
          pathParamSchema: config.pathParamSchema,
          queryParamSchema: config.queryParamSchema,
          bodySchema: config.bodySchema,
          responseSchema: config.responseSchema,
        })
      : undefined;

  return {
    ...baseRoute,
    openapi: openapi as any,
  };
}
