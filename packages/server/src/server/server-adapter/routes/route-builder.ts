import { z } from 'zod';
import type { ZodObject, ZodRawShape, ZodTypeAny } from 'zod';
import { generateRouteOpenAPI } from '../openapi-utils';
import type { InferParams, ResponseType, ServerRoute, ServerRouteHandler } from './index';

/**
 * Extracts parameters matching a Zod schema's shape from a params object.
 * Useful for separating schema-defined params from ServerContext in handlers.
 *
 * @example
 * ```typescript
 * const querySchema = z.object({ page: z.number(), name: z.string() });
 *
 * handler: async (params) => {
 *   const query = pickParams(querySchema, params);
 *   // query is typed as { page: number, name: string }
 * }
 * ```
 */
export function pickParams<T extends z.ZodRawShape, P extends Record<string, unknown>>(
  schema: z.ZodObject<T>,
  params: P,
): z.infer<z.ZodObject<T>> {
  const keys = Object.keys(schema.shape);
  const result = {} as z.infer<z.ZodObject<T>>;
  for (const key of keys) {
    if (key in params) {
      (result as any)[key] = params[key];
    }
  }
  return result;
}

/**
 * Wraps a Zod schema to accept either the expected type OR a JSON string.
 * Used for complex query parameters (arrays, objects) that are serialized as JSON in URLs.
 *
 * - If input is already the expected type, passes through to schema validation
 * - If input is a string, attempts JSON.parse then validates
 * - Provides clear error messages for JSON parse failures
 *
 * @example
 * ```typescript
 * const tagsSchema = jsonQueryParam(z.array(z.string()));
 * // Accepts: ["tag1", "tag2"] OR '["tag1", "tag2"]'
 *
 * const dateRangeSchema = jsonQueryParam(z.object({ gte: z.coerce.date() }));
 * // Accepts: { gte: "2024-01-01" } OR '{"gte": "2024-01-01"}'
 * ```
 */
export function jsonQueryParam<T extends ZodTypeAny>(schema: T): z.ZodType<z.infer<T>> {
  return z.union([
    schema, // Already the expected type (non-string input)
    z.string().transform((val, ctx) => {
      try {
        const parsed = JSON.parse(val);
        const result = schema.safeParse(parsed);
        if (!result.success) {
          for (const issue of result.error.issues) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: issue.message,
              path: issue.path,
            });
          }
          return z.NEVER;
        }
        return result.data;
      } catch (e) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Invalid JSON: ${e instanceof Error ? e.message : 'parse error'}`,
        });
        return z.NEVER;
      }
    }),
  ]) as z.ZodType<z.infer<T>>;
}

/**
 * Gets the type name from a Zod schema's internal definition.
 * Works across zod v3 and v4 by checking _def.typeName.
 */
function getZodTypeName(schema: ZodTypeAny): string | undefined {
  return (schema as any)?._def?.typeName;
}

/**
 * Checks if a Zod schema represents a complex type that needs JSON parsing from query strings.
 * Complex types: arrays, objects, records (these can't be represented as simple strings)
 * Simple types: strings, numbers, booleans, enums (can use z.coerce for conversion)
 *
 * Uses _def.typeName string comparison instead of instanceof to support both zod v3 and v4,
 * since instanceof checks fail across different zod versions in bundled code.
 */
function isComplexType(schema: ZodTypeAny): boolean {
  // Unwrap all optional/nullable layers to check the inner type
  // Note: .partial() can create nested optionals (e.g., ZodOptional<ZodOptional<ZodObject>>)
  let inner: ZodTypeAny = schema;
  let typeName = getZodTypeName(inner);

  while (typeName === 'ZodOptional' || typeName === 'ZodNullable') {
    // Access innerType directly from _def to avoid version-specific method differences
    inner = (inner as any)._def.innerType;
    typeName = getZodTypeName(inner);
  }

  // Complex types that need JSON parsing
  return typeName === 'ZodArray' || typeName === 'ZodRecord' || typeName === 'ZodObject';
}

/**
 * Wraps a Zod object schema for HTTP query parameter handling.
 * Automatically detects complex fields (arrays, objects, records) and wraps them
 * with jsonQueryParam() to accept JSON strings from query parameters.
 *
 * Simple fields (strings, numbers, booleans, enums) are left unchanged and should
 * use z.coerce for string-to-type conversion.
 *
 * @example
 * ```typescript
 * // Base schema (for internal/storage use)
 * const tracesFilterSchema = z.object({
 *   tags: z.array(z.string()).optional(),
 *   startedAt: dateRangeSchema.optional(),
 *   perPage: z.coerce.number().optional(),
 * });
 *
 * // HTTP schema (accepts JSON strings for complex fields)
 * const httpTracesFilterSchema = wrapSchemaForQueryParams(tracesFilterSchema);
 *
 * // Now accepts:
 * // ?tags=["tag1","tag2"]&startedAt={"gte":"2024-01-01"}&perPage=10
 * ```
 */
export function wrapSchemaForQueryParams<T extends ZodRawShape>(schema: ZodObject<T>): ZodObject<ZodRawShape> {
  const newShape: ZodRawShape = {};

  for (const [key, fieldSchema] of Object.entries(schema.shape)) {
    if (isComplexType(fieldSchema as ZodTypeAny)) {
      // Wrap complex types to accept JSON strings
      newShape[key] = jsonQueryParam(fieldSchema as ZodTypeAny);
    } else {
      // Keep simple types as-is
      newShape[key] = fieldSchema as ZodTypeAny;
    }
  }

  return z.object(newShape);
}

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
  /**
   * Permission required to access this route (EE feature).
   * If set, the user must have this permission to access the route.
   * Uses the format: `resource:action` or `resource:action:resourceId`
   */
  requiresPermission?: string;
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
  const { summary, description, tags, deprecated, requiresPermission, ...baseRoute } = config;

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
    requiresPermission,
  };
}
