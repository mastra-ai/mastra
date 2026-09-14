import type { MCPRequestContextV2, MCPToolOutcomeV2 } from '@mastra/core/mcp';
import type { RequestContext } from '@mastra/core/request-context';
import type { McpUiResourceMeta } from '@modelcontextprotocol/ext-apps';
import type {
  AuthInfo,
  CacheHint,
  InputRequiredResult,
  Prompt,
  PromptMessage,
  Resource,
  ResourceTemplateType,
  ServerContext,
} from '@modelcontextprotocol/server';

/** The only protocol revision `@mastra/mcp` serves. */
export const MCP_PROTOCOL_VERSION = '2026-07-28' as const;

/** Operations whose results can advertise cache hints. */
export type MCPServerCacheableMethod =
  | 'tools/list'
  | 'prompts/list'
  | 'resources/list'
  | 'resources/templates/list'
  | 'resources/read'
  | 'server/discover';

/** Cache hints (`ttlMs` / `cacheScope`) advertised on cacheable results, keyed by operation. */
export type MCPServerCacheHints = Partial<Record<MCPServerCacheableMethod, CacheHint>>;

/**
 * Request-scoped context handed to resource and prompt callbacks.
 *
 * `request` carries the protocol facilities of the current round (cancellation,
 * metadata, per-request logging and progress, input responses and echoed state);
 * `requestContext` carries the trusted application context (`authInfo`, mapped `user`).
 */
export interface MCPServerRequest {
  request: MCPRequestContextV2;
  requestContext: RequestContext;
}

/** A native continuation returned by a resource or prompt callback. */
export type MCPInputRequired = Extract<MCPToolOutcomeV2<never>, { kind: 'input_required' }>;

/** Content for an MCP resource, either text or binary (base64-encoded). */
export type MCPServerResourceContent = { text?: string } | { blob?: string };

export type MCPServerResourceContentCallback = (
  params: { uri: string } & MCPServerRequest,
) => Promise<MCPServerResourceContent | MCPServerResourceContent[] | MCPInputRequired>;

/** Configuration for MCP server resource handling. */
export type MCPServerResources = {
  listResources: (params: MCPServerRequest) => Promise<Resource[]>;
  getResourceContent: MCPServerResourceContentCallback;
  resourceTemplates?: (params: MCPServerRequest) => Promise<ResourceTemplateType[]>;
};

export type MCPServerPromptMessagesCallback = (
  params: { name: string; args?: Record<string, unknown> } & MCPServerRequest,
) => Promise<PromptMessage[] | MCPInputRequired>;

/** Configuration for MCP server prompt handling. */
export type MCPServerPrompts = {
  listPrompts: (params: MCPServerRequest) => Promise<Prompt[]>;
  getPromptMessages?: MCPServerPromptMessagesCallback;
};

/**
 * Maps transport authentication into the application user used by Mastra FGA.
 * Runs on every request and every continuation round; nothing is cached across rounds.
 */
export type MCPAuthInfoToUserMapperV2<TUser = unknown> = (args: {
  authInfo: AuthInfo;
  requestContext: RequestContext;
}) => TUser | null | undefined | Promise<TUser | null | undefined>;

/**
 * Integrity hook for echoed `requestState`. Runs inside the SDK before any handler
 * sees the request; a rejection answers the round with `-32602`. Build one with
 * `createRequestStateCodec` from `@modelcontextprotocol/server` and pass its `verify`.
 */
export type MCPRequestStateVerifier = (state: string, ctx: ServerContext) => unknown | Promise<unknown>;

/** Request-security options accepted by `startHTTP`. */
export interface MCPServerHTTPRequestOptions {
  enableDnsRebindingProtection?: boolean;
  allowedHosts?: string[];
  allowedOrigins?: string[];
}

export type { Prompt, PromptMessage, Resource, ResourceTemplateType as ResourceTemplate, InputRequiredResult };

/** Configuration for a single MCP App resource served under the `ui://` scheme. */
export interface AppResource {
  name: string;
  description?: string;
  html?: string;
  htmlPath?: string;
  meta?: McpUiResourceMeta;
}

/** Map of `ui://` URIs to their app resource configurations. */
export type AppResources = Record<string, AppResource>;
