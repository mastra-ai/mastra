import type { Mastra } from '@mastra/core';
import type { ToolsInput } from '@mastra/core/agent';
import type { RequestContext } from '@mastra/core/request-context';
import type { ApiRoute } from '@mastra/core/server';
import type z from 'zod';
import type { InMemoryTaskStore } from '../../a2a/store';
import { A2A_ROUTES } from './a2a';
import { AGENT_BUILDER_ROUTES } from './agent-builder';
import { AGENTS_ROUTES } from './agents';
import { AUTH_ROUTES } from './auth';
import { LEGACY_ROUTES } from './legacy';
import { LOGS_ROUTES } from './logs';
import { MCP_ROUTES } from './mcp';
import { MEMORY_ROUTES } from './memory';
import { OBSERVABILITY_ROUTES } from './observability';
import { PROCESSORS_ROUTES } from './processors';
import { SCORES_ROUTES } from './scorers';
import { STORED_AGENTS_ROUTES } from './stored-agents';
import type { MastraStreamReturn } from './stream-types';
import { SYSTEM_ROUTES } from './system';
import { TOOLS_ROUTES } from './tools';
import { VECTORS_ROUTES } from './vectors';
import { WORKFLOWS_ROUTES } from './workflows';

/**
 * Server context fields that are available to route handlers.
 * These are injected by the server adapters (Express, Hono, etc.)
 * Fields other than `mastra` are optional to allow direct handler testing.
 */
export type ServerContext = {
  mastra: Mastra;
  requestContext: RequestContext;
  tools?: ToolsInput;
  taskStore?: InMemoryTaskStore;
  abortSignal: AbortSignal;
};

/**
 * Utility type to infer parameters from Zod schemas.
 * Merges path params, query params, and body params into a single type.
 */
export type InferParams<
  TPathSchema extends z.ZodTypeAny | undefined,
  TQuerySchema extends z.ZodTypeAny | undefined,
  TBodySchema extends z.ZodTypeAny | undefined,
> = (TPathSchema extends z.ZodTypeAny ? z.infer<TPathSchema> : {}) &
  (TQuerySchema extends z.ZodTypeAny ? z.infer<TQuerySchema> : {}) &
  (TBodySchema extends z.ZodTypeAny ? z.infer<TBodySchema> : {});

/**
 * All supported response types for server routes.
 * - 'json': Standard JSON response
 * - 'stream': Streaming response (SSE or raw stream)
 * - 'datastream-response': Pre-built Response object for data streams
 * - 'mcp-http': MCP Streamable HTTP transport (handled by adapter)
 * - 'mcp-sse': MCP SSE transport (handled by adapter)
 */
export type ResponseType = 'stream' | 'json' | 'datastream-response' | 'mcp-http' | 'mcp-sse';

export type ServerRouteHandler<
  TParams = Record<string, unknown>,
  TResponse = unknown,
  TResponseType extends ResponseType = 'json',
> = (
  params: TParams & ServerContext,
) => Promise<
  TResponseType extends 'stream'
    ? MastraStreamReturn
    : TResponseType extends 'datastream-response'
      ? Response
      : TResponse
>;

export type ServerRoute<
  TParams = Record<string, unknown>,
  TResponse = unknown,
  TResponseType extends ResponseType = 'json',
> = Omit<ApiRoute, 'handler' | 'createHandler'> & {
  responseType: TResponseType;
  streamFormat?: 'sse' | 'stream'; // Only used when responseType is 'stream', defaults to 'stream'
  handler: ServerRouteHandler<TParams, TResponse, TResponseType>;
  pathParamSchema?: z.ZodSchema;
  queryParamSchema?: z.ZodSchema;
  bodySchema?: z.ZodSchema;
  responseSchema?: z.ZodSchema;
  openapi?: any; // Auto-generated OpenAPI spec for this route
  maxBodySize?: number; // Optional route-specific body size limit in bytes
  deprecated?: boolean; // Flag for deprecated routes (used for route parity, skipped in tests)
  /**
   * Permission required to access this route (EE feature).
   * If set, the user must have this permission to access the route.
   * Uses the format: `resource:action` or `resource:action:resourceId`
   *
   * @example
   * requiresPermission: 'agents:read'
   * requiresPermission: 'workflows:execute'
   */
  requiresPermission?: string;
};

export const SERVER_ROUTES: ServerRoute<any, any, any>[] = [
  ...AGENTS_ROUTES,
  ...AUTH_ROUTES,
  ...WORKFLOWS_ROUTES,
  ...TOOLS_ROUTES,
  ...PROCESSORS_ROUTES,
  ...MEMORY_ROUTES,
  ...SCORES_ROUTES,
  ...OBSERVABILITY_ROUTES,
  ...LOGS_ROUTES,
  ...VECTORS_ROUTES,
  ...A2A_ROUTES,
  ...AGENT_BUILDER_ROUTES,
  ...LEGACY_ROUTES,
  ...MCP_ROUTES,
  ...STORED_AGENTS_ROUTES,
  ...SYSTEM_ROUTES,
];

// Export route builder and OpenAPI utilities
export { createRoute, pickParams, jsonQueryParam, wrapSchemaForQueryParams } from './route-builder';
export { generateOpenAPIDocument } from '../openapi-utils';
