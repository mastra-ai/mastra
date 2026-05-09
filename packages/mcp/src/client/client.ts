import { AsyncLocalStorage } from 'node:async_hooks';
import { createRequire } from 'node:module';
import type { Stream } from 'node:stream';
import { MastraBase } from '@mastra/core/base';
import type { RequestContext } from '@mastra/core/di';
import { createTool } from '@mastra/core/tools';
import type { Tool } from '@mastra/core/tools';

import type { JSONSchema7 } from '@mastra/schema-compat';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { getDefaultEnvironment, StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { DEFAULT_REQUEST_TIMEOUT_MSEC } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type {
  EmptyResult,
  GetPromptResult,
  ListPromptsResult,
  ListResourcesResult,
  ListResourceTemplatesResult,
  LoggingLevel,
  ReadResourceResult,
} from '@modelcontextprotocol/sdk/types.js';
import {
  CallToolResultSchema,
  ListResourcesResultSchema,
  ReadResourceResultSchema,
  ResourceListChangedNotificationSchema,
  ResourceUpdatedNotificationSchema,
  ListResourceTemplatesResultSchema,
  ListPromptsResultSchema,
  GetPromptResultSchema,
  PromptListChangedNotificationSchema,
  ElicitRequestSchema,
  ProgressNotificationSchema,
  ListRootsRequestSchema,
  LoggingMessageNotificationSchema,
  EmptyResultSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { asyncExitHook, gracefulExit } from 'exit-hook';
import { getMastraToolStrictMeta } from '../shared/mastra-tool-meta';
import { ElicitationClientActions } from './actions/elicitation';
import { ProgressClientActions } from './actions/progress';
import { PromptClientActions } from './actions/prompt';
import { ResourceClientActions } from './actions/resource';
import { isReconnectableMCPError } from './error-utils';
import type {
  FetchLike,
  LogHandler,
  ElicitationHandler,
  ProgressHandler,
  MastraMCPServerDefinition,
  InternalMastraMCPClientOptions,
  Root,
  RequireToolApproval,
} from './types';

// Re-export types for convenience
export type {
  LoggingLevel,
  LogMessage,
  LogHandler,
  ElicitationHandler,
  ProgressHandler,
  MastraFetchLike,
  MastraMCPServerDefinition,
  InternalMastraMCPClientOptions,
  Root,
  RequireToolApproval,
  RequireToolApprovalFn,
  RequireToolApprovalContext,
} from './types';

const DEFAULT_SERVER_CONNECT_TIMEOUT_MSEC = 3000;
const require = createRequire(import.meta.url);

// Per MCP spec, only fallback to SSE for these status codes
const SSE_FALLBACK_STATUS_CODES = [400, 404, 405];
const DATADOG_TRACER_TEST_SYMBOL = Symbol.for('mastra.mcp.dd-trace-test-tracer');

type DatadogScopeLike = {
  activate<T>(span: unknown, callback: () => T): T;
};

type DatadogTracerLike = {
  scope?: () => DatadogScopeLike;
  default?: {
    scope?: () => DatadogScopeLike;
  };
};

function shouldDetachPersistentTransportRequest(init?: RequestInit): boolean {
  return (init?.method ?? 'GET').toUpperCase() === 'GET';
}

function getDatadogScope(): DatadogScopeLike | null {
  const testTracer = (globalThis as Record<PropertyKey, unknown>)[DATADOG_TRACER_TEST_SYMBOL] as
    | DatadogTracerLike
    | undefined;
  const tracer = testTracer ?? loadDatadogTracer();

  if (typeof tracer?.scope === 'function') {
    return tracer.scope();
  }

  if (typeof tracer?.default?.scope === 'function') {
    return tracer.default.scope();
  }

  return null;
}

function loadDatadogTracer(): DatadogTracerLike | null {
  if (!isDatadogTracerLikelyLoaded()) {
    return null;
  }

  try {
    return require('dd-trace') as DatadogTracerLike;
  } catch {
    return null;
  }
}

function isDatadogTracerLikelyLoaded(): boolean {
  if ((globalThis as Record<PropertyKey, unknown>)[DATADOG_TRACER_TEST_SYMBOL]) {
    return true;
  }

  if (process.execArgv.some(arg => arg.includes('dd-trace'))) {
    return true;
  }

  if (process.env.NODE_OPTIONS?.includes('dd-trace')) {
    return true;
  }

  try {
    const resolvedPath = require.resolve('dd-trace');
    return Boolean(require.cache[resolvedPath]);
  } catch {
    return false;
  }
}

function runOutsideDatadogTraceScope<T>(callback: () => T): T {
  const scope = getDatadogScope();
  if (!scope) {
    return callback();
  }

  return scope.activate(null, callback);
}

/**
 * Convert an MCP LoggingLevel to a logger method name that exists in our logger
 */
function convertLogLevelToLoggerMethod(level: LoggingLevel): 'debug' | 'info' | 'warn' | 'error' {
  switch (level) {
    case 'debug':
      return 'debug';
    case 'info':
    case 'notice':
      return 'info';
    case 'warning':
      return 'warn';
    case 'error':
    case 'critical':
    case 'alert':
    case 'emergency':
      return 'error';
    default:
      // For any other levels, default to info
      return 'info';
  }
}

/**
 * Internal MCP client implementation for connecting to a single MCP server.
 *
 * This class handles the low-level connection, transport management, and protocol
 * communication with an MCP server. Most users should use MCPClient instead.
 *
 * @internal
 */
export class InternalMastraMCPClient extends MastraBase {
  name: string;
  private client: Client;
  private readonly timeout: number;
  private logHandler?: LogHandler;
  private enableServerLogs?: boolean;
  private enableProgressTracking?: boolean;
  private serverConfig: MastraMCPServerDefinition;
  private transport?: Transport;
  private operationContextStore = new AsyncLocalStorage<RequestContext | null>();
  private exitHookUnsubscribe?: () => void;
  private sigTermHandler?: () => void;
  private sigHupHandler?: () => void;
  private _roots: Root[];
  private readonly requireToolApproval: RequireToolApproval | undefined;

  /** Provides access to resource operations (list, read, subscribe, etc.) */
  public readonly resources: ResourceClientActions;
  /** Provides access to prompt operations (list, get, notifications) */
  public readonly prompts: PromptClientActions;
  /** Provides access to elicitation operations (request handling) */
  public readonly elicitation: ElicitationClientActions;
  /** Provides access to progress operations (notifications) */
  public readonly progress: ProgressClientActions;

  /**
   * @internal
   */
  constructor({
    name,
    version = '1.0.0',
    server,
    capabilities = {},
    timeout = DEFAULT_REQUEST_TIMEOUT_MSEC,
  }: InternalMastraMCPClientOptions) {
    super({ name: 'MastraMCPClient' });
    this.name = name;
    this.timeout = timeout;
    this.logHandler = server.logger;
    this.enableServerLogs = server.enableServerLogs ?? true;
    this.serverConfig = server;
    this.enableProgressTracking = !!server.enableProgressTracking;
    this.requireToolApproval = server.requireToolApproval;

    // Initialize roots from server config
    this._roots = server.roots ?? [];

    // Build client capabilities, automatically enabling roots if configured
    const hasRoots = this._roots.length > 0 || !!capabilities.roots;
    const clientCapabilities = {
      ...capabilities,
      // Merge elicitation capabilities instead of overwriting
      elicitation: {
        ...(capabilities.elicitation ?? {}),
      },
      // Auto-enable roots capability if roots are provided
      ...(hasRoots ? { roots: { listChanged: true, ...(capabilities.roots ?? {}) } } : {}),
      // Advertise MCP Apps extension support so servers know we can render UI resources
      extensions: {
        ...(capabilities.extensions ?? {}),
        'io.modelcontextprotocol/ui': {},
      },
    };

    this.client = new Client(
      {
        name,
        version,
      },
      {
        capabilities: clientCapabilities,
        ...(server.jsonSchemaValidator ? { jsonSchemaValidator: server.jsonSchemaValidator } : {}),
      },
    );

    // Set up log message capturing
    this.setupLogging();

    // Set up roots/list request handler if roots capability is enabled
    if (hasRoots) {
      this.setupRootsHandler();
    }

    this.resources = new ResourceClientActions({ client: this, logger: this.logger });
    this.prompts = new PromptClientActions({ client: this, logger: this.logger });
    this.elicitation = new ElicitationClientActions({ client: this, logger: this.logger });
    this.progress = new ProgressClientActions({ client: this, logger: this.logger });
  }

  /**
   * Log a message at the specified level
   * @param level Log level
   * @param message Log message
   * @param details Optional additional details
   */
  private log(level: LoggingLevel, message: string, details?: Record<string, any>): void {
    // Convert MCP logging level to our logger method
    const loggerMethod = convertLogLevelToLoggerMethod(level);

    const msg = `[${this.name}] ${message}`;

    // Log to internal logger
    this.logger[loggerMethod](msg, details);

    // Send to registered handler if available
    if (this.logHandler) {
      this.logHandler({
        level,
        message: msg,
        timestamp: new Date(),
        serverName: this.name,
        details,
        requestContext: this.operationContextStore.getStore() ?? null,
      });
    }
  }

  private setupLogging(): void {
    if (this.enableServerLogs) {
      this.client.setNotificationHandler(LoggingMessageNotificationSchema, (notification: any) => {
        const { level, ...params } = notification.params;
        this.log(level as LoggingLevel, '[MCP SERVER LOG]', params);
      });
    }
  }

  /**
   * Set up handler for roots/list requests from the server.
   *
   * Per MCP spec (https://modelcontextprotocol.io/specification/2025-11-25/client/roots):
   * When a server sends a roots/list request, the client responds with the configured roots.
   */
  private setupRootsHandler(): void {
    this.log('debug', 'Setting up roots/list request handler');
    this.client.setRequestHandler(ListRootsRequestSchema, async () => {
      this.log('debug', `Responding to roots/list request with ${this._roots.length} roots`);
      return { roots: this._roots };
    });
  }

  /**
   * Get the currently configured roots.
   *
   * @returns Array of configured filesystem roots
   */
  get roots(): Root[] {
    return [...this._roots];
  }

  /**
   * Update the list of filesystem roots and notify the server.
   *
   * Per MCP spec, when roots change, the client sends a `notifications/roots/list_changed`
   * notification to inform the server that it should re-fetch the roots list.
   *
   * @param roots - New list of filesystem roots
   *
   * @example
   * ```typescript
   * await client.setRoots([
   *   { uri: 'file:///home/user/projects', name: 'Projects' },
   *   { uri: 'file:///tmp', name: 'Temp' }
   * ]);
   * ```
   */
  async setRoots(roots: Root[]): Promise<void> {
    this.log('debug', `Updating roots to ${roots.length} entries`);
    this._roots = [...roots];
    await this.sendRootsListChanged();
  }

  /**
   * Send a roots/list_changed notification to the server.
   *
   * Per MCP spec, clients that support `listChanged` MUST send this notification
   * when the list of roots changes. The server will then call roots/list to get
   * the updated list.
   */
  async sendRootsListChanged(): Promise<void> {
    if (!this.transport) {
      this.log('debug', 'Cannot send roots/list_changed: not connected');
      return;
    }
    this.log('debug', 'Sending notifications/roots/list_changed');
    await this.client.notification({ method: 'notifications/roots/list_changed' });
  }

  private async connectStdio(command: string) {
    this.log('debug', `Using Stdio transport for command: ${command}`);
    try {
      this.transport = new StdioClientTransport({
        command,
        args: this.serverConfig.args,
        env: { ...getDefaultEnvironment(), ...(this.serverConfig.env || {}) },
        stderr: this.serverConfig.stderr,
        cwd: this.serverConfig.cwd,
      });
      await this.client.connect(this.transport, { timeout: this.serverConfig.timeout ?? this.timeout });
      this.log('debug', `Successfully connected to MCP server via Stdio`);
    } catch (e) {
      this.log('error', e instanceof Error ? e.stack || e.message : JSON.stringify(e));
      throw e;
    }
  }

  private async connectHttp(url: URL) {
    const { requestInit, eventSourceInit, authProvider, connectTimeout, fetch: userFetch } = this.serverConfig;

    // Wrap fetch so request-scoped metadata still flows through normal MCP POSTs, while
    // the long-lived Streamable HTTP event stream does not inherit the active Datadog span.
    const fetch: FetchLike = (requestUrl: string | URL, init?: RequestInit) => {
      const requestContext = this.operationContextStore.getStore() ?? null;
      const executeFetch = () =>
        userFetch ? userFetch(requestUrl, init, requestContext) : globalThis.fetch(requestUrl, init);

      return shouldDetachPersistentTransportRequest(init) ? runOutsideDatadogTraceScope(executeFetch) : executeFetch();
    };

    this.log('debug', `Attempting to connect to URL: ${url}`);

    // Assume /sse means sse.
    let shouldTrySSE = url.pathname.endsWith(`/sse`);

    if (!shouldTrySSE) {
      try {
        // Try Streamable HTTP transport first
        this.log('debug', 'Trying Streamable HTTP transport...');
        const streamableTransport = new StreamableHTTPClientTransport(url, {
          requestInit,
          reconnectionOptions: this.serverConfig.reconnectionOptions,
          authProvider: authProvider,
          fetch,
        });
        await this.client.connect(streamableTransport, {
          timeout: connectTimeout ?? DEFAULT_SERVER_CONNECT_TIMEOUT_MSEC,
        });
        this.transport = streamableTransport;
        this.log('debug', 'Successfully connected using Streamable HTTP transport.');
      } catch (error: any) {
        this.log('debug', `Streamable HTTP transport failed: ${error}`);

        // @modelcontextprotocol/sdk 1.24.0+ throws StreamableHTTPError with 'code' property
        // Older @modelcontextprotocol/sdk: fallback to SSE (legacy behavior)
        const status = error?.code;
        if (status !== undefined && !SSE_FALLBACK_STATUS_CODES.includes(status)) {
          throw error;
        }
        shouldTrySSE = true;
      }
    }

    if (shouldTrySSE) {
      this.log('debug', 'Falling back to deprecated HTTP+SSE transport...');
      try {
        // Fallback to SSE transport
        // If fetch is provided, ensure it's also in eventSourceInit for the EventSource connection
        // The top-level fetch is used for POST requests, but eventSourceInit.fetch is needed for the SSE stream
        const sseEventSourceInit = { ...eventSourceInit, fetch };

        const sseTransport = new SSEClientTransport(url, {
          requestInit,
          eventSourceInit: sseEventSourceInit,
          authProvider,
          fetch,
        });
        await this.client.connect(sseTransport, { timeout: this.serverConfig.timeout ?? this.timeout });
        this.transport = sseTransport;
        this.log('debug', 'Successfully connected using deprecated HTTP+SSE transport.');
      } catch (sseError) {
        this.log(
          'error',
          `Failed to connect with SSE transport after failing to connect to Streamable HTTP transport first. SSE error: ${sseError}`,
        );
        throw new Error('Could not connect to server with any available HTTP transport');
      }
    }
  }

  private isConnected: Promise<boolean> | null = null;

  /**
   * Connects to the MCP server using the configured transport.
   *
   * Automatically detects transport type based on configuration (stdio vs HTTP).
   * Safe to call multiple times - returns existing connection if already connected.
   *
   * @returns Promise resolving to true when connected
   * @throws {MastraError} If connection fails
   *
   * @internal
   */
  async connect() {
    if (this.isConnected) {
      return this.isConnected;
    }

    this.isConnected = new Promise<boolean>(async (resolve, reject) => {
      try {
        const { command, url } = this.serverConfig;

        if (command) {
          await this.connectStdio(command);
        } else if (url) {
          await this.connectHttp(url);
        } else {
          throw new Error('Server configuration must include either a command or a url.');
        }

        resolve(true);

        // Set up disconnect handler to reset state.
        const originalOnClose = this.client.onclose;
        this.client.onclose = () => {
          this.log('debug', `MCP server connection closed`);
          this.isConnected = null;
          if (typeof originalOnClose === 'function') {
            originalOnClose();
          }
        };
      } catch (e) {
        this.isConnected = null;
        reject(e);
      }
    });

    // Only register exit hooks if not already registered
    if (!this.exitHookUnsubscribe) {
      this.exitHookUnsubscribe = asyncExitHook(
        async () => {
          this.log('debug', `Disconnecting MCP server during exit`);
          await this.disconnect();
        },
        { wait: 5000 },
      );
    }

    if (!this.sigTermHandler) {
      this.sigTermHandler = () => gracefulExit();
      process.on('SIGTERM', this.sigTermHandler);
    }

    if (!this.sigHupHandler) {
      this.sigHupHandler = () => gracefulExit();
      process.on('SIGHUP', this.sigHupHandler);
    }

    this.log('debug', `Successfully connected to MCP server`);
    return this.isConnected;
  }

  /**
   * Gets the current session ID if using Streamable HTTP transport.
   *
   * Returns undefined if not connected or not using Streamable HTTP transport.
   *
   * @returns Session ID string or undefined
   *
   * @internal
   */
  get sessionId(): string | undefined {
    if (this.transport instanceof StreamableHTTPClientTransport) {
      return this.transport.sessionId;
    }
    return undefined;
  }

  /**
   * Gets the stderr stream of the child process, if using stdio transport with `stderr: 'pipe'`.
   *
   * Returns null if not connected, not using stdio transport, or stderr is not piped.
   *
   * @internal
   */
  get stderr(): Stream | null {
    if (this.transport instanceof StdioClientTransport) {
      return this.transport.stderr;
    }
    return null;
  }

  async disconnect() {
    if (!this.transport) {
      this.log('debug', 'Disconnect called but no transport was connected.');
      return;
    }
    this.log('debug', `Disconnecting from MCP server`);
    try {
      await this.transport.close();
      this.log('debug', 'Successfully disconnected from MCP server');
    } catch (e) {
      this.log('error', 'Error during MCP server disconnect', {
        error: e instanceof Error ? e.stack : JSON.stringify(e, null, 2),
      });
      throw e;
    } finally {
      this.transport = undefined;
      this.isConnected = null;

      // Clean up exit hooks to prevent memory leaks
      if (this.exitHookUnsubscribe) {
        this.exitHookUnsubscribe();
        this.exitHookUnsubscribe = undefined;
      }
      if (this.sigTermHandler) {
        process.off('SIGTERM', this.sigTermHandler);
        this.sigTermHandler = undefined;
      }
      if (this.sigHupHandler) {
        process.off('SIGHUP', this.sigHupHandler);
        this.sigHupHandler = undefined;
      }
    }
  }

  /**
   * Forces a reconnection to the MCP server by disconnecting and reconnecting.
   *
   * This is useful when the session becomes invalid (e.g., after server restart)
   * and the client needs to establish a fresh connection.
   *
   * @returns Promise resolving when reconnection is complete
   * @throws {Error} If reconnection fails
   *
   * @internal
   */
  async forceReconnect(): Promise<void> {
    this.log('debug', 'Forcing reconnection to MCP server...');

    // Disconnect current connection (ignore errors as connection may already be broken)
    try {
      if (this.transport) {
        await this.transport.close();
      }
    } catch (e) {
      this.log('debug', 'Error during force disconnect (ignored)', {
        error: e instanceof Error ? e.message : String(e),
      });
    }

    // Reset connection state
    this.transport = undefined;
    this.isConnected = null;

    // Reconnect
    await this.connect();
    this.log('debug', 'Successfully reconnected to MCP server');
  }

  async listResources(): Promise<ListResourcesResult> {
    this.log('debug', `Requesting resources from MCP server`);
    return await this.client.request({ method: 'resources/list' }, ListResourcesResultSchema, {
      timeout: this.timeout,
    });
  }

  async readResource(uri: string): Promise<ReadResourceResult> {
    this.log('debug', `Reading resource from MCP server: ${uri}`);
    return await this.client.request({ method: 'resources/read', params: { uri } }, ReadResourceResultSchema, {
      timeout: this.timeout,
    });
  }

  async subscribeResource(uri: string): Promise<EmptyResult> {
    this.log('debug', `Subscribing to resource on MCP server: ${uri}`);
    return await this.client.request({ method: 'resources/subscribe', params: { uri } }, EmptyResultSchema, {
      timeout: this.timeout,
    });
  }

  async unsubscribeResource(uri: string): Promise<EmptyResult> {
    this.log('debug', `Unsubscribing from resource on MCP server: ${uri}`);
    return await this.client.request({ method: 'resources/unsubscribe', params: { uri } }, EmptyResultSchema, {
      timeout: this.timeout,
    });
  }

  async listResourceTemplates(): Promise<ListResourceTemplatesResult> {
    this.log('debug', `Requesting resource templates from MCP server`);
    return await this.client.request({ method: 'resources/templates/list' }, ListResourceTemplatesResultSchema, {
      timeout: this.timeout,
    });
  }

  /**
   * Fetch the list of available prompts from the MCP server.
   */
  async listPrompts(): Promise<ListPromptsResult> {
    this.log('debug', `Requesting prompts from MCP server`);
    return await this.client.request({ method: 'prompts/list' }, ListPromptsResultSchema, {
      timeout: this.timeout,
    });
  }

  /**
   * Get a prompt and its dynamic messages from the server.
   * @param name The prompt name
   * @param args Arguments for the prompt
   */
  async getPrompt({ name, args }: { name: string; args?: Record<string, any> }): Promise<GetPromptResult> {
    this.log('debug', `Requesting prompt from MCP server: ${name}`);
    return await this.client.request(
      { method: 'prompts/get', params: { name, arguments: args } },
      GetPromptResultSchema,
      { timeout: this.timeout },
    );
  }

  /**
   * Register a handler to be called when the prompt list changes on the server.
   * Use this to refresh cached prompt lists in the client/UI if needed.
   */
  setPromptListChangedNotificationHandler(handler: () => void): void {
    this.log('debug', 'Setting prompt list changed notification handler');
    this.client.setNotificationHandler(PromptListChangedNotificationSchema, () => {
      handler();
    });
  }

  setResourceUpdatedNotificationHandler(handler: (params: any) => void): void {
    this.log('debug', 'Setting resource updated notification handler');
    this.client.setNotificationHandler(ResourceUpdatedNotificationSchema, (notification: any) => {
      handler(notification.params);
    });
  }

  setResourceListChangedNotificationHandler(handler: () => void): void {
    this.log('debug', 'Setting resource list changed notification handler');
    this.client.setNotificationHandler(ResourceListChangedNotificationSchema, () => {
      handler();
    });
  }

  setElicitationRequestHandler(handler: ElicitationHandler): void {
    this.log('debug', 'Setting elicitation request handler');
    this.client.setRequestHandler(ElicitRequestSchema, async request => {
      this.log('debug', `Received elicitation request: ${request.params.message}`);
      return handler(request.params);
    });
  }

  setProgressNotificationHandler(handler: ProgressHandler): void {
    this.log('debug', 'Setting progress notification handler');
    this.client.setNotificationHandler(ProgressNotificationSchema, notification => {
      handler(notification.params);
    });
  }

  private async convertInputSchema(
    inputSchema: Awaited<ReturnType<Client['listTools']>>['tools'][0]['inputSchema'],
  ): Promise<JSONSchema7> {
    return ('jsonSchema' in inputSchema ? inputSchema.jsonSchema : inputSchema) as JSONSchema7;
  }

  async tools(): Promise<Record<string, Tool<any, any, any, any>>> {
    this.log('debug', `Requesting tools from MCP server`);
    const { tools } = await this.client.listTools({}, { timeout: this.timeout });
    const toolsRes: Record<string, Tool<any, any, any, any>> = {};
    for (const tool of tools) {
      this.log('debug', `Processing tool: ${tool.name}`);
      try {
        // Resolve requireToolApproval for this tool
        let requireApproval: boolean | undefined;
        let needsApprovalFn: ((args: any, ctx: any) => boolean | Promise<boolean>) | undefined;

        if (typeof this.requireToolApproval === 'function') {
          // Wrap the server-level function to match the per-tool needsApprovalFn signature.
          // Note: ctx may be undefined when called via network/index.ts (which only passes args).
          // We default ctx to {} so the spread doesn't fail and approval fn receives partial context.
          const serverApprovalFn = this.requireToolApproval;
          const toolName = tool.name;
          requireApproval = true; // Signal that approval check is needed
          needsApprovalFn = (args: Record<string, unknown>, ctx: Record<string, unknown> = {}) => {
            return serverApprovalFn({ toolName, args, ...ctx });
          };
        } else if (this.requireToolApproval === true) {
          requireApproval = true;
        }
        // When requireToolApproval is false/undefined, requireApproval stays undefined
        // and createTool defaults it to false

        const rawMeta = (tool as { _meta?: Record<string, unknown> })._meta;
        // Stamp serverId into _meta.ui so consumers can resolve app resources
        // back to the originating MCP server without scanning all servers.
        const toolMeta = rawMeta ? this.stampServerIdInMeta(rawMeta) : undefined;
        const mastraTool = createTool({
          id: `${this.name}_${tool.name}`,
          description: tool.description || '',
          inputSchema: await this.convertInputSchema(tool.inputSchema),
          strict: getMastraToolStrictMeta(toolMeta),
          // Preserve the full _meta from the remote MCP server (including ui.resourceUri
          // for MCP Apps) so downstream consumers (e.g. Studio) can detect app tools.
          ...(toolMeta ? { mcp: { _meta: toolMeta } } : {}),
          // Don't pass outputSchema to createTool — the MCP SDK's Client.callTool()
          // already validates structuredContent against the tool's outputSchema using AJV.
          // Passing it here causes Zod to strip unrecognized keys from the CallToolResult
          // envelope, returning {} for tools without structuredContent.
          requireApproval,
          mcpMetadata: {
            serverName: this.name,
            serverVersion: this.client.getServerVersion()?.version,
          },
          execute: async (
            input: any,
            context?: {
              requestContext?: RequestContext | null;
              runId?: string;
              abortSignal?: AbortSignal;
              _meta?: Record<string, unknown>;
            },
          ) => {
            const operationContext = context?.requestContext ?? null;

            return this.operationContextStore.run(operationContext, async () => {
              const executeToolCall = async () => {
                this.log('debug', `Executing tool: ${tool.name}`, { toolArgs: input, runId: context?.runId });
                const userMeta = context?._meta;
                // progressMeta spreads last so Mastra-managed progressToken takes precedence over any user-supplied one
                const progressMeta = this.enableProgressTracking
                  ? { progressToken: context?.runId || crypto.randomUUID() }
                  : undefined;
                const combinedMeta = userMeta || progressMeta ? { ...userMeta, ...progressMeta } : undefined;

                const res = await this.client.callTool(
                  {
                    name: tool.name,
                    arguments: input,
                    ...(combinedMeta ? { _meta: combinedMeta } : {}),
                  },
                  CallToolResultSchema,
                  {
                    timeout: this.timeout,
                    signal: context?.abortSignal,
                  },
                );

                this.log('debug', `Tool executed successfully: ${tool.name}`);

                // When a tool has an outputSchema, return the structuredContent directly
                // so that output validation works correctly
                if (res.structuredContent !== undefined) {
                  return res.structuredContent;
                }

                return res;
              };

              try {
                return await executeToolCall();
              } catch (e) {
                // Check if this is a session-related error that requires reconnection
                if (isReconnectableMCPError(e)) {
                  this.log('debug', `Session error detected for tool ${tool.name}, attempting reconnection...`, {
                    error: e instanceof Error ? e.message : String(e),
                  });

                  try {
                    // Force reconnection
                    await this.forceReconnect();

                    // Retry the tool call with fresh connection
                    this.log('debug', `Retrying tool ${tool.name} after reconnection...`);
                    return await executeToolCall();
                  } catch (reconnectError) {
                    this.log('error', `Reconnection or retry failed for tool ${tool.name}`, {
                      originalError: e instanceof Error ? e.message : String(e),
                      reconnectError: reconnectError instanceof Error ? reconnectError.stack : String(reconnectError),
                      toolArgs: input,
                    });
                    // Throw the original error if reconnection/retry fails
                    throw e;
                  }
                }

                // For non-session errors, log and rethrow
                this.log('error', `Error calling tool: ${tool.name}`, {
                  error: e instanceof Error ? e.stack : JSON.stringify(e, null, 2),
                  toolArgs: input,
                });
                throw e;
              }
            });
          },
        });

        // Set needsApprovalFn directly on the tool instance (same pattern as tool-builder).
        // This is accessed via (tool as any).needsApprovalFn in tool-call-step.ts.
        if (needsApprovalFn) {
          (mastraTool as any).needsApprovalFn = needsApprovalFn;
        }

        if (tool.name) {
          toolsRes[tool.name] = mastraTool;
        }
      } catch (toolCreationError: unknown) {
        // Catch errors during tool creation itself (e.g., if createTool has issues)
        this.log('error', `Failed to create Mastra tool wrapper for MCP tool: ${tool.name}`, {
          error: toolCreationError instanceof Error ? toolCreationError.stack : String(toolCreationError),
          mcpToolDefinition: tool,
        });
      }
    }

    return toolsRes;
  }

  private stampServerIdInMeta(meta: Record<string, unknown>): Record<string, unknown> {
    const ui = meta.ui as Record<string, unknown> | undefined;
    if (!ui?.resourceUri) return meta;
    return {
      ...meta,
      ui: { ...ui, serverId: this.name },
    };
  }
}
