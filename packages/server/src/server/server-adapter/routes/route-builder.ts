import type { ValidationErrorHook } from '@mastra/core/server';
import type { ZodRawShape, ZodTypeAny } from 'zod/v4';
import { z, ZodObject, ZodOptional, ZodNullable, ZodArray, ZodRecord } from 'zod/v4';
import { generateRouteOpenAPI } from '../openapi-utils';
import type { InferParams, ResponseType, RouteSchemas, ServerRoute, ServerRouteHandler } from './index';

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
 * Checks if a Zod schema represents a complex type that needs JSON parsing from query strings.
 * Complex types: arrays, objects, records (these can't be represented as simple strings)
 * Simple types: strings, numbers, booleans, enums (can use z.coerce for conversion)
 */
function isComplexType(schema: ZodTypeAny): boolean {
  // Unwrap all optional/nullable layers to check the inner type
  // Note: .partial() can create nested optionals (e.g., ZodOptional<ZodOptional<ZodObject>>)
  let inner: ZodTypeAny = schema;

  while (inner instanceof ZodOptional || inner instanceof ZodNullable) {
    inner = inner.unwrap() as ZodTypeAny;
  }

  // Complex types that need JSON parsing
  return inner instanceof ZodArray || inner instanceof ZodRecord || inner instanceof ZodObject;
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
  const newShape: Record<string, ZodTypeAny> = {};

  // schema.shape is Readonly in Zod v4, so we need to create a mutable copy
  const shape = schema.shape as unknown as Record<string, ZodTypeAny>;
  for (const [key, fieldSchema] of Object.entries(shape)) {
    if (isComplexType(fieldSchema)) {
      // Wrap complex types to accept JSON strings
      newShape[key] = jsonQueryParam(fieldSchema);
    } else {
      // Keep simple types as-is
      newShape[key] = fieldSchema;
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
  TMethod extends string = string,
  TPath extends string = string,
> {
  method: TMethod;
  path: TPath;
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
  requiresAuth?: boolean; // Explicit auth requirement for this route
  /**
   * Permission required to access this route (EE feature).
   * If set, the user must have this permission to access the route.
   * Uses the format: `resource:action` or `resource:action:resourceId`
   */
  requiresPermission?: string;
  onValidationError?: ValidationErrorHook;
}

/**
 * Creates a server route with auto-generated OpenAPI specification and type-safe handler inference.
 *
 * ## Permission System
 *
 * Routes use a convention-based permission system. Permissions are automatically derived
 * from the route path and method using the format: `{resource}:{action}`
 *
 * - **resource**: First path segment (e.g., 'agents', 'workflows', 'memory')
 * - **action**: Derived from HTTP method:
 *   - GET → 'read'
 *   - POST → 'write' (or 'execute' for operation endpoints like /generate, /stream)
 *   - PUT/PATCH → 'write'
 *   - DELETE → 'delete'
 *
 * ### Examples:
 * - `GET /agents/:id` → `agents:read`
 * - `POST /agents/:id/generate` → `agents:execute`
 * - `DELETE /workflows/:id` → `workflows:delete`
 *
 * ### Overriding:
 * - Use `requiresPermission` to explicitly set a custom permission
 * - Use `createPublicRoute()` for routes that should bypass auth entirely
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
 * // Protected route (default) - permission auto-derived as 'agents:read'
 * export const getAgentRoute = createRoute({
 *   method: 'GET',
 *   path: '/agents/:agentId',
 *   responseType: 'json',
 *   pathParamSchema: z.object({ agentId: z.string() }),
 *   responseSchema: serializedAgentSchema,
 *   handler: async ({ agentId, mastra, requestContext }) => {
 *     return mastra.getAgentById(agentId);
 *   },
 *   summary: 'Get agent by ID',
 *   tags: ['Agents'],
 * });
 *
 * // Protected route with explicit permission override
 * export const adminRoute = createRoute({
 *   method: 'POST',
 *   path: '/agents/:agentId/admin-action',
 *   responseType: 'json',
 *   requiresPermission: 'agents:admin', // Override derived 'agents:write'
 *   handler: async (ctx) => { ... },
 * });
 * ```
 */
export function createRoute<
  TPathSchema extends z.ZodTypeAny | undefined = undefined,
  TQuerySchema extends z.ZodTypeAny | undefined = undefined,
  TBodySchema extends z.ZodTypeAny | undefined = undefined,
  TResponseSchema extends z.ZodTypeAny | undefined = undefined,
  TResponseType extends ResponseType = 'json',
  TMethod extends string = string,
  TPath extends string = string,
>(
  config: RouteConfig<TPathSchema, TQuerySchema, TBodySchema, TResponseSchema, TResponseType, TMethod, TPath>,
): ServerRoute<
  InferParams<TPathSchema, TQuerySchema, TBodySchema>,
  TResponseSchema extends z.ZodTypeAny ? z.infer<TResponseSchema> : unknown,
  TResponseType,
  RouteSchemas<TPathSchema, TQuerySchema, TBodySchema, TResponseSchema>,
  TMethod,
  TPath
> {
  const { summary, description, tags, deprecated, requiresAuth, requiresPermission, onValidationError, ...baseRoute } =
    config;

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
    openapi,
    deprecated,
    requiresAuth,
    requiresPermission,
    onValidationError,
  };
}

/**
 * Creates a public server route that bypasses authentication and authorization.
 *
 * Use this for routes that must be accessible without authentication, such as:
 * - Auth endpoints (login, logout, OAuth callbacks)
 * - Health checks
 * - Public API endpoints
 *
 * This is equivalent to calling `createRoute({ ...config, requiresAuth: false })`.
 *
 * @param config - Route configuration (same as createRoute, but requiresAuth is forced to false)
 * @returns Complete ServerRoute marked as public
 *
 * @example
 * ```typescript
 * // Public route - no authentication required
 * export const healthCheckRoute = createPublicRoute({
 *   method: 'GET',
 *   path: '/health',
 *   responseType: 'json',
 *   handler: async () => ({ status: 'ok' }),
 *   summary: 'Health check',
 *   tags: ['System'],
 * });
 *
 * // Auth callback - must be public for OAuth flow
 * export const ssoCallbackRoute = createPublicRoute({
 *   method: 'GET',
 *   path: '/auth/sso/callback',
 *   responseType: 'datastream-response',
 *   handler: async (ctx) => { ... },
 *   summary: 'Handle SSO callback',
 *   tags: ['Auth'],
 * });
 * ```
 */
export function createPublicRoute<
  TPathSchema extends z.ZodTypeAny | undefined = undefined,
  TQuerySchema extends z.ZodTypeAny | undefined = undefined,
  TBodySchema extends z.ZodTypeAny | undefined = undefined,
  TResponseSchema extends z.ZodTypeAny | undefined = undefined,
  TResponseType extends ResponseType = 'json',
  TMethod extends string = string,
  TPath extends string = string,
>(
  config: Omit<
    RouteConfig<TPathSchema, TQuerySchema, TBodySchema, TResponseSchema, TResponseType, TMethod, TPath>,
    'requiresAuth'
  >,
): ServerRoute<
  InferParams<TPathSchema, TQuerySchema, TBodySchema>,
  TResponseSchema extends z.ZodTypeAny ? z.infer<TResponseSchema> : unknown,
  TResponseType,
  RouteSchemas<TPathSchema, TQuerySchema, TBodySchema, TResponseSchema>,
  TMethod,
  TPath
> {
  return createRoute({
    ...config,
    requiresAuth: false,
  });
}
