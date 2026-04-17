import type { z } from 'zod/v4';
import type { RouteSchemas, ServerRoute, ServerRoutes } from '../server-adapter/routes';

/**
 * Extract the RouteSchemas phantom type from a route via its 4th generic parameter.
 */
type ExtractSchemas<R> =
  R extends ServerRoute<infer _P, infer _Res, infer _RT, infer S, infer _M, infer _Path> ? S : RouteSchemas;

/**
 * Infer the path parameter types from a route's pathParamSchema.
 * Works on any route created via `createRoute()`, not just built-in routes.
 *
 * @example
 * ```typescript
 * type Params = InferPathParams<RouteMap['GET /agents/:agentId']>;
 * // => { agentId: string }
 * ```
 */
export type InferPathParams<R extends ServerRoute> =
  ExtractSchemas<R> extends RouteSchemas<infer TPath, infer _Q, infer _B, infer _R>
    ? TPath extends z.ZodTypeAny
      ? z.infer<TPath>
      : never
    : never;

/**
 * Infer the query parameter types from a route's queryParamSchema.
 * Works on any route created via `createRoute()`, not just built-in routes.
 *
 * @example
 * ```typescript
 * type Query = InferQueryParams<RouteMap['GET /agents']>;
 * // => { partial?: string }
 * ```
 */
export type InferQueryParams<R extends ServerRoute> =
  ExtractSchemas<R> extends RouteSchemas<infer _P, infer TQuery, infer _B, infer _R>
    ? TQuery extends z.ZodTypeAny
      ? z.infer<TQuery>
      : never
    : never;

/**
 * Infer the request body types from a route's bodySchema.
 * Works on any route created via `createRoute()`, not just built-in routes.
 *
 * @example
 * ```typescript
 * type Body = InferBody<RouteMap['POST /agents/:agentId/generate']>;
 * // => { messages: CoreMessage[], ... }
 * ```
 */
export type InferBody<R extends ServerRoute> =
  ExtractSchemas<R> extends RouteSchemas<infer _P, infer _Q, infer TBody, infer _R>
    ? TBody extends z.ZodTypeAny
      ? z.infer<TBody>
      : never
    : never;

/**
 * Infer the response types from a route's responseSchema.
 * Works on any route created via `createRoute()`, not just built-in routes.
 *
 * @example
 * ```typescript
 * type Response = InferResponse<RouteMap['GET /agents/:agentId']>;
 * // => { name: string, tools: ..., ... }
 * ```
 */
export type InferResponse<R extends ServerRoute> =
  ExtractSchemas<R> extends RouteSchemas<infer _P, infer _Q, infer _B, infer TResp>
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
