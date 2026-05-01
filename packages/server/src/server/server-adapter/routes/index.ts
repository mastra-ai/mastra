import type { Mastra } from '@mastra/core';
import type { ToolsInput } from '@mastra/core/agent';
import type { RequestContext } from '@mastra/core/request-context';
import type { ApiRoute, ValidationErrorHook } from '@mastra/core/server';
import type * as z from 'zod/v4';
import type { InMemoryTaskStore } from '../../a2a/store';
import type { OpenAPIRoute } from '../openapi-utils';
import { A2A_ROUTES } from './a2a';
import { AGENT_BUILDER_ROUTES } from './agent-builder';
import { AGENTS_ROUTES } from './agents';
import type { AgentRoutes } from './agents';
import { AUTH_ROUTES } from './auth';
import { BACKGROUND_TASK_ROUTES } from './background-tasks';
import { CHANNELS_ROUTES } from './channels';
import { CONVERSATIONS_ROUTES } from './conversations';
import { DATASETS_ROUTES } from './datasets';
import { LEGACY_ROUTES } from './legacy';
import { LOGS_ROUTES } from './logs';
import { MCP_ROUTES } from './mcp';
import { MEMORY_ROUTES } from './memory';
import { OBSERVABILITY_ROUTES } from './observability';
import { PROCESSOR_PROVIDER_ROUTES } from './processor-providers';
import { PROCESSORS_ROUTES } from './processors';
import { RESPONSES_ROUTES } from './responses';
import { SCORES_ROUTES } from './scorers';
import { STORED_AGENTS_ROUTES } from './stored-agents';
import type { StoredAgentRoutes } from './stored-agents';
import { STORED_MCP_CLIENTS_ROUTES } from './stored-mcp-clients';
import { STORED_PROMPT_BLOCKS_ROUTES } from './stored-prompt-blocks';
import { STORED_SCORERS_ROUTES } from './stored-scorers';
import { STORED_SKILLS_ROUTES } from './stored-skills';
import { STORED_WORKSPACES_ROUTES } from './stored-workspaces';
import type { MastraStreamReturn } from './stream-types';
import { SYSTEM_ROUTES } from './system';
import { TOOL_PROVIDER_ROUTES } from './tool-providers';
import { TOOLS_ROUTES } from './tools';
import { VECTORS_ROUTES } from './vectors';
import { WORKFLOWS_ROUTES } from './workflows';
import { WORKSPACE_ROUTES } from './workspace';

/**
 * Server context fields that are available to route handlers.
 * These are injected by the server adapters (Express, Hono, etc.)
 * Fields other than `mastra` are optional to allow direct handler testing.
 */
export type ServerContext = {
  mastra: Mastra;
  requestContext: RequestContext;
  registeredTools?: ToolsInput;
  taskStore?: InMemoryTaskStore;
  abortSignal: AbortSignal;
  /** The route prefix configured for the server (e.g., '/api') */
  routePrefix?: string;
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

/**
 * Phantom type for preserving Zod schema types on routes.
 * Not present at runtime — used only for type-level inference via RouteMap.
 */
export interface RouteSchemas<
  TPathSchema = unknown,
  TQuerySchema = unknown,
  TBodySchema = unknown,
  TResponseSchema = unknown,
> {
  readonly pathParams: TPathSchema;
  readonly queryParams: TQuerySchema;
  readonly body: TBodySchema;
  readonly response: TResponseSchema;
}

export type ServerRoute<
  TParams = Record<string, unknown>,
  TResponse = unknown,
  TResponseType extends ResponseType = ResponseType,
  TSchemas extends RouteSchemas = RouteSchemas,
  TMethod extends string = string,
  TPath extends string = string,
> = Omit<ApiRoute, 'handler' | 'createHandler' | 'method' | 'path' | 'openapi'> & {
  method: TMethod;
  path: TPath;
  responseType: TResponseType;
  streamFormat?: 'sse' | 'stream'; // Only used when responseType is 'stream', defaults to 'stream'
  // Method signature is bivariant in params, allowing heterogeneous route arrays
  // while still preserving specific param types on individual routes.
  handler(params: TParams & ServerContext): ReturnType<ServerRouteHandler<TParams, TResponse, TResponseType>>;
  pathParamSchema?: z.ZodSchema;
  queryParamSchema?: z.ZodSchema;
  bodySchema?: z.ZodSchema;
  responseSchema?: z.ZodSchema;
  openapi?: OpenAPIRoute; // Auto-generated OpenAPI spec for this route
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
  onValidationError?: ValidationErrorHook;
  /** @internal Phantom type — not present at runtime. Used for type-level schema inference. */
  readonly __schemas?: TSchemas;
};

export const SERVER_ROUTES: readonly ServerRoute[] = [
  ...AGENTS_ROUTES,
  ...AUTH_ROUTES,
  ...WORKFLOWS_ROUTES,
  ...TOOLS_ROUTES,
  ...PROCESSORS_ROUTES,
  ...RESPONSES_ROUTES,
  ...CONVERSATIONS_ROUTES,
  ...MEMORY_ROUTES,
  ...SCORES_ROUTES,
  ...OBSERVABILITY_ROUTES,
  ...LOGS_ROUTES,
  ...VECTORS_ROUTES,
  ...A2A_ROUTES,
  ...AGENT_BUILDER_ROUTES,
  ...WORKSPACE_ROUTES,
  ...LEGACY_ROUTES,
  ...MCP_ROUTES,
  ...STORED_AGENTS_ROUTES,
  ...STORED_MCP_CLIENTS_ROUTES,
  ...STORED_PROMPT_BLOCKS_ROUTES,
  ...STORED_SCORERS_ROUTES,
  ...STORED_WORKSPACES_ROUTES,
  ...STORED_SKILLS_ROUTES,
  ...TOOL_PROVIDER_ROUTES,
  ...PROCESSOR_PROVIDER_ROUTES,
  ...SYSTEM_ROUTES,
  ...DATASETS_ROUTES,
  ...BACKGROUND_TASK_ROUTES,
  ...CHANNELS_ROUTES,
];

/**
 * Union type of all individual route arrays.
 * Built from the per-domain `as const` tuples to preserve each route's specific schema types.
 */
export type ServerRoutes = readonly [
  ...AgentRoutes,
  ...typeof AUTH_ROUTES,
  ...typeof WORKFLOWS_ROUTES,
  ...typeof TOOLS_ROUTES,
  ...typeof PROCESSORS_ROUTES,
  ...typeof RESPONSES_ROUTES,
  ...typeof CONVERSATIONS_ROUTES,
  ...typeof MEMORY_ROUTES,
  ...typeof SCORES_ROUTES,
  ...typeof OBSERVABILITY_ROUTES,
  ...typeof LOGS_ROUTES,
  ...typeof VECTORS_ROUTES,
  ...typeof A2A_ROUTES,
  ...typeof AGENT_BUILDER_ROUTES,
  ...typeof WORKSPACE_ROUTES,
  ...typeof LEGACY_ROUTES,
  ...typeof MCP_ROUTES,
  ...StoredAgentRoutes,
  ...typeof STORED_MCP_CLIENTS_ROUTES,
  ...typeof STORED_PROMPT_BLOCKS_ROUTES,
  ...typeof STORED_SCORERS_ROUTES,
  ...typeof STORED_WORKSPACES_ROUTES,
  ...typeof STORED_SKILLS_ROUTES,
  ...typeof TOOL_PROVIDER_ROUTES,
  ...typeof PROCESSOR_PROVIDER_ROUTES,
  ...typeof SYSTEM_ROUTES,
  ...typeof DATASETS_ROUTES,
  ...typeof CHANNELS_ROUTES,
];

// Export route builder and OpenAPI utilities
export { createRoute, createPublicRoute, pickParams, jsonQueryParam, wrapSchemaForQueryParams } from './route-builder';
export { generateOpenAPIDocument } from '../openapi-utils';

// Export permission utilities
export { derivePermission, extractResource, deriveAction, getEffectivePermission } from './permissions';
