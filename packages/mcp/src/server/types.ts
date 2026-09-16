import type { MCPServerConfig as CoreMCPServerConfig } from '@mastra/core/mcp';
import type { RequestContext } from '@mastra/core/request-context';
import type { StandardSchemaWithJSON } from '@mastra/core/schema';
import type { MCPServerContext } from '@mastra/core/tools';
import type { McpUiResourceMeta } from '@modelcontextprotocol/ext-apps';
import type {
  CacheHint,
  InputRequiredResult,
  Prompt,
  PromptMessage,
  Resource,
  ResourceTemplateType,
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
 * Protocol context handed to resource and prompt callbacks: the same object tools
 * receive as `context.mcp.extra` (cancellation signal, request id, `_meta`, auth).
 */
export type MCPRequestHandlerExtra = MCPServerContext;

/**
 * Request-scoped context handed to resource and prompt callbacks.
 *
 * `extra` carries the protocol facilities of the current request and
 * `requestContext` the trusted application context (`authInfo`, mapped `user`).
 * `suspend`, `resumeData` and `suspendPayload` are the same continuation vocabulary
 * tools use: calling `suspend(payload)` ends the request as `input_required`; the
 * continuation re-enters with the client's answer in `resumeData` and the payload it
 * suspended with in `suspendPayload`.
 */
export interface MCPServerRequest<TSuspend = unknown, TResume = unknown> {
  extra: MCPRequestHandlerExtra;
  requestContext: RequestContext;
  suspend: (payload: TSuspend) => Promise<void>;
  resumeData?: TResume;
  suspendPayload?: TSuspend;
}

/** Content for an MCP resource, either text or binary (base64-encoded). */
export type MCPServerResourceContent = { text?: string } | { blob?: string };

export type MCPServerResourceContentCallback = (
  params: { uri: string } & MCPServerRequest,
) => Promise<MCPServerResourceContent | MCPServerResourceContent[] | void>;

/** Configuration for MCP server resource handling. */
export type MCPServerResources = {
  listResources: (params: { extra: MCPRequestHandlerExtra; requestContext: RequestContext }) => Promise<Resource[]>;
  getResourceContent: MCPServerResourceContentCallback;
  resourceTemplates?: (params: {
    extra: MCPRequestHandlerExtra;
    requestContext: RequestContext;
  }) => Promise<ResourceTemplateType[]>;
  /**
   * Shape of the answer a suspended `getResourceContent` expects. Required for
   * `suspend` to be usable; it must describe a flat object of primitives because it
   * becomes the form the client fills in.
   */
  resumeSchema?: StandardSchemaWithJSON;
};

export type MCPServerPromptMessagesCallback = (
  params: { name: string; args?: Record<string, unknown> } & MCPServerRequest,
) => Promise<PromptMessage[] | void>;

/** Configuration for MCP server prompt handling. */
export type MCPServerPrompts = {
  listPrompts: (params: { extra: MCPRequestHandlerExtra; requestContext: RequestContext }) => Promise<Prompt[]>;
  getPromptMessages?: MCPServerPromptMessagesCallback;
  /** Shape of the answer a suspended `getPromptMessages` expects; see `MCPServerResources.resumeSchema`. */
  resumeSchema?: StandardSchemaWithJSON;
};

/**
 * Integrity protection for continuation state. `requestState` round-trips through
 * the client on every `input_required` round: the server signs it with `key` so a
 * tampered, expired or foreign envelope is rejected before any handler runs.
 *
 * Every instance that may answer a continuation must share the same key (set it from
 * the environment in multi-instance and serverless deployments). Without a key the
 * server generates one per process and continuations only succeed on that process.
 */
export interface MCPServerRequestStateOptions {
  /** HMAC key, at least 32 bytes. */
  key?: string | Uint8Array;
  /** How long a suspended round stays answerable. Defaults to 600 seconds. */
  ttlSeconds?: number;
}

/** Request-security options accepted by `startHTTP`. */
export interface MCPServerHTTPRequestOptions {
  enableDnsRebindingProtection?: boolean;
  allowedHosts?: string[];
  allowedOrigins?: string[];
}

export type MCPAuthInfoToUserMapper = NonNullable<CoreMCPServerConfig['mapAuthInfoToUser']>;

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
