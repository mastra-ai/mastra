import type { z } from 'zod';
import type { RouteSchemas, ServerRoute, ServerRoutes } from '../server-adapter/routes';

// Use a permissive base type to avoid contravariance issues with handler params
type AnyServerRoute = ServerRoute<any, any, any, any>;

/**
 * Extract the RouteSchemas phantom type from a route via its 4th generic parameter.
 */
type ExtractSchemas<R> = R extends ServerRoute<any, any, any, infer S> ? S : RouteSchemas;

/**
 * Infer the path parameter types from a route's pathParamSchema.
 *
 * @example
 * ```typescript
 * type Params = InferPathParams<RouteMap['GET /agents/:agentId']>;
 * // => { agentId: string }
 * ```
 */
export type InferPathParams<R extends AnyServerRoute> =
  ExtractSchemas<R> extends RouteSchemas<infer TPath, any, any, any>
    ? TPath extends z.ZodTypeAny
      ? z.infer<TPath>
      : never
    : never;

/**
 * Infer the query parameter types from a route's queryParamSchema.
 *
 * @example
 * ```typescript
 * type Query = InferQueryParams<RouteMap['GET /agents']>;
 * // => { partial?: string }
 * ```
 */
export type InferQueryParams<R extends AnyServerRoute> =
  ExtractSchemas<R> extends RouteSchemas<any, infer TQuery, any, any>
    ? TQuery extends z.ZodTypeAny
      ? z.infer<TQuery>
      : never
    : never;

/**
 * Infer the request body types from a route's bodySchema.
 *
 * @example
 * ```typescript
 * type Body = InferBody<RouteMap['POST /agents/:agentId/generate']>;
 * // => { messages: CoreMessage[], ... }
 * ```
 */
export type InferBody<R extends AnyServerRoute> =
  ExtractSchemas<R> extends RouteSchemas<any, any, infer TBody, any>
    ? TBody extends z.ZodTypeAny
      ? z.infer<TBody>
      : never
    : never;

/**
 * Infer the response types from a route's responseSchema.
 *
 * @example
 * ```typescript
 * type Response = InferResponse<RouteMap['GET /agents/:agentId']>;
 * // => { name: string, tools: ..., ... }
 * ```
 */
export type InferResponse<R extends AnyServerRoute> =
  ExtractSchemas<R> extends RouteSchemas<any, any, any, infer TResp>
    ? TResp extends z.ZodTypeAny
      ? z.infer<TResp>
      : never
    : never;

/**
 * A map of all routes keyed by "METHOD /path".
 *
 * @example
 * ```typescript
 * type ListAgentsRoute = RouteMap['GET /agents'];
 * type GenerateRoute = RouteMap['POST /agents/:agentId/generate'];
 * ```
 */
export type RouteMap = {
  [R in ServerRoutes[number] as `${R['method']} ${R['path']}`]: R;
};

/**
 * Get a route's type by its method and path string.
 *
 * @example
 * ```typescript
 * type Route = RouteContract<'GET /agents/:agentId'>;
 * type Body = InferBody<RouteContract<'POST /agents/:agentId/generate'>>;
 * ```
 */
export type RouteContract<K extends keyof RouteMap> = RouteMap[K];
