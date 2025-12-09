import type z from 'zod';
import { generateRouteOpenAPI } from '../openapi-utils';
import type { InferParams, ResponseType, ServerRoute, ServerRouteHandler } from './index';

interface RouteConfig<
  TPathSchema extends z.ZodTypeAny | undefined = undefined,
  TQuerySchema extends z.ZodTypeAny | undefined = undefined,
  TBodySchema extends z.ZodTypeAny | undefined = undefined,
  TResponseSchema extends z.ZodTypeAny | undefined = undefined,
  TResponseType extends ResponseType = 'json',
> {
  method: ServerRoute['method'];
  path: string;
  responseType: TResponseType;
  streamFormat?: 'sse' | 'stream'; // Only used when responseType is 'stream'
  handler: ServerRouteHandler<
    InferParams<TPathSchema, TQuerySchema, TBodySchema>,
    TResponseSchema extends z.ZodTypeAny ? z.infer<TResponseSchema> : unknown,
    TResponseType
  >;
  pathParamSchema?: TPathSchema;
  queryParamSchema?: TQuerySchema;
  bodySchema?: TBodySchema;
  responseSchema?: TResponseSchema;
  summary?: string;
  description?: string;
  tags?: string[];
  deprecated?: boolean;
  maxBodySize?: number;
}

/**
 * Creates a server route with auto-generated OpenAPI specification and type-safe handler inference.
 *
 * The handler parameters are automatically inferred from the provided schemas:
 * - pathParamSchema: Infers path parameter types (e.g., :agentId)
 * - queryParamSchema: Infers query parameter types
 * - bodySchema: Infers request body types
 * - Runtime context (mastra, requestContext, tools, taskStore) is always available
 *
 * @param config - Route configuration including schemas, handler, and metadata
 * @returns Complete ServerRoute with OpenAPI spec
 *
 * @example
 * ```typescript
 * export const getAgentRoute = createRoute({
 *   method: 'GET',
 *   path: '/api/agents/:agentId',
 *   responseType: 'json',
 *   pathParamSchema: z.object({ agentId: z.string() }),
 *   responseSchema: serializedAgentSchema,
 *   handler: async ({ agentId, mastra, requestContext }) => {
 *     // agentId is typed as string
 *     // mastra, requestContext, tools, taskStore are always available
 *     return mastra.getAgentById(agentId);
 *   },
 *   summary: 'Get agent by ID',
 *   description: 'Returns details for a specific agent',
 *   tags: ['Agents'],
 * });
 * ```
 */
export function createRoute<
  TPathSchema extends z.ZodTypeAny | undefined = undefined,
  TQuerySchema extends z.ZodTypeAny | undefined = undefined,
  TBodySchema extends z.ZodTypeAny | undefined = undefined,
  TResponseSchema extends z.ZodTypeAny | undefined = undefined,
  TResponseType extends ResponseType = 'json',
>(
  config: RouteConfig<TPathSchema, TQuerySchema, TBodySchema, TResponseSchema, TResponseType>,
): ServerRoute<
  InferParams<TPathSchema, TQuerySchema, TBodySchema>,
  TResponseSchema extends z.ZodTypeAny ? z.infer<TResponseSchema> : unknown,
  TResponseType
> {
  const { summary, description, tags, deprecated, ...baseRoute } = config;

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
          deprecated,
        })
      : undefined;

  return {
    ...baseRoute,
    openapi: openapi as any,
    deprecated,
  };
}
