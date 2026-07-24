import { AsyncLocalStorage } from 'node:async_hooks';
import { createRequire } from 'node:module';
import type { Stream } from 'node:stream';
import { MastraBase } from '@mastra/core/base';
import type { RequestContext } from '@mastra/core/di';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { createTool } from '@mastra/core/tools';
import type { NeedsApprovalFn, Tool } from '@mastra/core/tools';
import { toStandardSchema } from '@mastra/schema-compat';
import type { JSONSchema7, StandardSchemaWithJSON } from '@mastra/schema-compat';
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
  ClientCapabilities,
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
  ToolListChangedNotificationSchema,
  ElicitRequestSchema,
  ProgressNotificationSchema,
  ListRootsRequestSchema,
  LoggingMessageNotificationSchema,
  EmptyResultSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { asyncExitHook, gracefulExit } from 'exit-hook';
import { getMastraToolStrictMeta } from '../shared/mastra-tool-meta';
import { UnauthorizedError } from '../shared/oauth-types';
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
const DEFAULT_INSTRUCTIONS_MAX_LENGTH = 512;

/**
 * OAuth authorization state of an MCP server connection.
 *
 * - `needs-auth`: the server rejected the connection with a 401 and interactive
 *   authorization is required (see MCPClient.authenticate)
 * - `authorized`: the server accepted the configured authProvider's credentials
 *
 * Servers without an authProvider never carry an auth state.
 */
export type MCPServerAuthState = 'needs-auth' | 'authorized';

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

/**
 * Extract a human-readable error message from a failed CallToolResult's `content`.
 * Joins the text of all `text` content blocks, falling back to a generic message
 * when the server returned no text (e.g. only image/resource content).
 */
function extractToolErrorText(content: unknown): string {
  const fallback = 'MCP tool execution failed';
  if (!Array.isArray(content)) return fallback;
  const text = extractModelTextFromToolContent(content);
  return text || fallback;
}

/**
 * Extract LLM-facing text from a successful CallToolResult's `content` blocks.
 * Per MCP spec, `content` is the human/model-readable channel; `structuredContent`
 * is for client/UI consumption.
 */
function extractModelTextFromToolContent(content: unknown): string | undefined {
  if (!Array.isArray(content)) return undefined;
  const text = content
    .filter((part): part is { type: 'text'; text: string } => {
      return !!part && typeof part === 'object' && (part as { type?: unknown }).type === 'text';
    })
    .map(part => part.text)
    .join('\n')
    .trim();
  return text || undefined;
}

/**
 * Choose the value Mastra should return from MCP tool execute() for downstream
 * model context. When the server returned structuredContent, prefer the LLM-facing
 * text from `content` and only fall back to structuredContent when no text is available.
 */
function resolveModelFacingToolOutput(res: { structuredContent?: unknown; content?: unknown }): unknown {
  if (res.structuredContent === undefined) {
    return res;
  }

  const modelText = extractModelTextFromToolContent(res.content);
  if (modelText !== undefined) {
    return modelText;
  }

  return res.structuredContent;
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
    const req = createRequire(import.meta.url);
    return req('dd-trace') as DatadogTracerLike;
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
    const req = createRequire(import.meta.url);
    const resolvedPath = req.resolve('dd-trace');
    return Boolean(req.cache[resolvedPath]);
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
  private pendingAuthTransport?: StreamableHTTPClientTransport | SSEClientTransport;
  private _authState?: MCPServerAuthState;
  private operationContextStore = new AsyncLocalStorage<RequestContext | null>();
  private exitHookUnsubscribe?: () => void;
  private sigTermHandler?: () => void;
  private sigHupHandler?: () => void;
  private serverInstructions?: string;
  private _roots: Root[];
  private hasElicitationCapability: boolean;
  private readonly requireToolApproval: RequireToolApproval | undefined;
  private readonly onToolError: 'throw' | 'return';

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
    this.onToolError = server.onToolError ?? 'throw';

    // Initialize roots from server config
    this._roots = server.roots ?? [];
    this.hasElicitationCapability = capabilities.elicitation !== undefined;

    // Build client capabilities, automatically enabling roots if configured
    const hasRoots = this._roots.length > 0 || !!capabilities.roots;
    const clientCapabilities: ClientCapabilities = {
      ...capabilities,
      // Only advertise elicitation when explicitly configured or when a handler
      // registers it before connect(). `elicitation: {}` is legacy form support.
      ...(capabilities.elicitation !== undefined ? { elicitation: { ...capabilities.elicitation } } : {}),
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
      // Constructed outside the try so an UnauthorizedError can keep a handle on the
      // transport that started the authorization flow (finishAuth must run on it).
      const streamableTransport = new StreamableHTTPClientTransport(url, {
        requestInit,
        reconnectionOptions: this.serverConfig.reconnectionOptions,
        authProvider: authProvider,
        fetch,
      });
      try {
        // Try Streamable HTTP transport first
        this.log('debug', 'Trying Streamable HTTP transport...');
        await this.client.connect(streamableTransport, {
          timeout: connectTimeout ?? DEFAULT_SERVER_CONNECT_TIMEOUT_MSEC,
        });
        this.transport = streamableTransport;
        this.log('debug', 'Successfully connected using Streamable HTTP transport.');
      } catch (error: any) {
        this.log('debug', `Streamable HTTP transport failed: ${error}`);

        // A 401 means the flow continues on this transport via finishAuth, not on a
        // fallback: the SDK has already run discovery and redirected to authorization.
        // Guarded on authProvider so servers without one never carry an auth state.
        if (authProvider && error instanceof UnauthorizedError) {
          this.markNeedsAuth(streamableTransport);
          throw error;
        }

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
      // Fallback to SSE transport
      // The top-level fetch is used for POST requests, but eventSourceInit.fetch is needed for the SSE stream.
      // Only supply our span-detaching fetch when the caller hasn't provided one, so an explicit
      // eventSourceInit.fetch is preserved rather than overwritten.
      const sseEventSourceInit = { ...eventSourceInit, fetch: eventSourceInit?.fetch ?? fetch };

      const sseTransport = new SSEClientTransport(url, {
        requestInit,
        eventSourceInit: sseEventSourceInit,
        authProvider,
        fetch,
      });
      try {
        await this.client.connect(sseTransport, { timeout: this.serverConfig.timeout ?? this.timeout });
        this.transport = sseTransport;
        this.log('debug', 'Successfully connected using deprecated HTTP+SSE transport.');
      } catch (sseError) {
        if (authProvider && sseError instanceof UnauthorizedError) {
          this.markNeedsAuth(sseTransport);
          throw sseError;
        }
        this.log(
          'error',
          `Failed to connect with SSE transport after failing to connect to Streamable HTTP transport first. SSE error: ${sseError}`,
        );
        throw new Error('Could not connect to server with any available HTTP transport');
      }
    }

    // Reaching here means a transport connected; any earlier authorization requirement is satisfied.
    // Close, don't just drop, any transport left pending from an earlier 401 so its event stream
    // and session resources are released rather than abandoned.
    this.closePendingAuthTransport();
    if (authProvider) {
      this._authState = 'authorized';
    }
  }

  /**
   * Closes and clears any transport retained from an unfinished authorization
   * flow. Safe to call when nothing is pending. Centralizes the cleanup so
   * success, disconnect, and forceReconnect all release the same resource.
   */
  private closePendingAuthTransport(replacement?: StreamableHTTPClientTransport | SSEClientTransport): void {
    const pending = this.pendingAuthTransport;
    this.pendingAuthTransport = replacement;
    if (pending && pending !== replacement) {
      void pending.close().catch(() => {});
    }
  }

  /**
   * Records that the server rejected the connection with a 401 and keeps the
   * transport that started the authorization flow so finishAuth can complete it.
   */
  private markNeedsAuth(transport: StreamableHTTPClientTransport | SSEClientTransport): void {
    // A prior connect() may have left a pending transport that never completed
    // finishAuth. Close the superseded one before replacing it so its event
    // stream and session resources are released rather than abandoned.
    this.closePendingAuthTransport(transport);
    this._authState = 'needs-auth';
    this.log('debug', 'Server requires OAuth authorization before connecting.');
  }

  /**
   * OAuth authorization state of this server connection, when it has an authProvider.
   *
   * @internal
   */
  get authState(): MCPServerAuthState | undefined {
    return this._authState;
  }

  /**
   * Completes a pending OAuth authorization-code flow.
   *
   * Exchanges the authorization code captured at the redirect URI on the same
   * transport that started the flow, then leaves the client ready to connect().
   *
   * @param authorizationCode - The authorization code captured at the redirect URI
   * @throws {Error} If no authorization flow is pending for this server
   *
   * @internal
   */
  async finishAuth(authorizationCode: string): Promise<void> {
    const pending = this.pendingAuthTransport;
    if (!pending) {
      throw new Error('No OAuth authorization is pending for this server. Call connect() first.');
    }
    this.pendingAuthTransport = undefined;
    try {
      await pending.finishAuth(authorizationCode);
    } finally {
      // The pending transport only ran the token exchange; the next connect() builds a fresh one.
      void pending.close().catch(() => {});
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

        this.refreshServerInstructions();

        resolve(true);

        // Set up disconnect handler to reset state.
        const originalOnClose = this.client.onclose;
        this.client.onclose = () => {
          this.log('debug', `MCP server connection closed`);
          // Close the stale transport before any reconnect so its EventSource/session
          // can't keep retrying and leak server-side sessions (issue #16693). Clear
          // synchronously first so a concurrent connect() sees a clean slate.
          const staleTransport = this.transport;
          this.transport = undefined;
          this.isConnected = null;
          this.serverInstructions = undefined;
          if (staleTransport) {
            void staleTransport.close().catch(() => {});
          }
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

  get instructions(): string | undefined {
    return this.serverInstructions;
  }

  get forwardInstructions(): boolean {
    return this.serverConfig.forwardInstructions ?? false;
  }

  get instructionsMaxLength(): number {
    return this.serverConfig.instructionsMaxLength ?? DEFAULT_INSTRUCTIONS_MAX_LENGTH;
  }

  private refreshServerInstructions(): void {
    this.serverInstructions = this.client.getInstructions();
  }

  async disconnect() {
    // Release any transport left pending from an unfinished authorization flow,
    // even when there is no live transport to tear down.
    this.closePendingAuthTransport();
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
      this.serverInstructions = undefined;

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

    // Release any transport left pending from an unfinished authorization flow
    // before rebuilding the connection.
    this.closePendingAuthTransport();

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
    this.serverInstructions = undefined;

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

  /**
   * Register a handler to be called when the tool list changes on the server.
   * Use this to re-fetch tools via `tools()` when notified.
   */
  setToolListChangedNotificationHandler(handler: () => void): void {
    this.log('debug', 'Setting tool list changed notification handler');
    this.client.setNotificationHandler(ToolListChangedNotificationSchema, () => {
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
    if (!this.hasElicitationCapability) {
      try {
        this.client.registerCapabilities({ elicitation: { form: {} } });
        this.hasElicitationCapability = true;
      } catch (error) {
        throw new Error(
          'Cannot register an elicitation handler after connecting unless elicitation capability was configured before initialization.',
          { cause: error },
        );
      }
    }

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

  /**
   * Wraps the output schema with a validator that always succeeds. The MCP SDK validates
   * structuredContent via AJV; the JSON schema is surfaced here for documentation only.
   */
  private convertOutputSchema(
    outputSchema: Awaited<ReturnType<Client['listTools']>>['tools'][0]['outputSchema'],
  ): StandardSchemaWithJSON | undefined {
    if (!outputSchema) return outputSchema;
    const schema = ('jsonSchema' in outputSchema ? outputSchema.jsonSchema : outputSchema) as JSONSchema7;
    const standardSchema = toStandardSchema(schema)['~standard'];
    return {
      '~standard': {
        ...standardSchema,
        validate: value => ({ value }),
      },
    };
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
        let needsApprovalFn: NeedsApprovalFn | undefined;

        // Capture server-advertised annotations (title, readOnlyHint, destructiveHint, ...).
        // These are exposed on the tool's `mcp.annotations` field and forwarded to the
        // requireToolApproval callback so consumers can write annotation-driven policies.
        const annotations = tool.annotations;

        if (typeof this.requireToolApproval === 'function') {
          // Wrap the server-level function to match the per-tool needsApprovalFn signature.
          // Note: ctx may be undefined when called via network/index.ts (which only passes args).
          // We default ctx to {} so the spread doesn't fail and approval fn receives partial context.
          const serverApprovalFn = this.requireToolApproval;
          const toolName = tool.name;
          requireApproval = true; // Signal that approval check is needed
          needsApprovalFn = (args: Record<string, unknown>, ctx: Record<string, unknown> = {}) => {
            // Server-supplied annotations are placed AFTER the ctx spread so a
            // caller can't accidentally (or maliciously) override them by
            // injecting an `annotations` key into ctx — the value the
            // requireToolApproval policy sees always reflects what came back
            // from the MCP server's tools/list response.
            return serverApprovalFn({ toolName, args, ...ctx, annotations });
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
        const mcpToolProps =
          toolMeta || annotations
            ? {
                mcp: {
                  ...(toolMeta ? { _meta: toolMeta } : {}),
                  ...(annotations ? { annotations } : {}),
                },
              }
            : {};
        const mastraTool = createTool({
          id: `${this.name}_${tool.name}`,
          description: tool.description || '',
          inputSchema: await this.convertInputSchema(tool.inputSchema),
          outputSchema: this.convertOutputSchema(tool.outputSchema),
          strict: getMastraToolStrictMeta(toolMeta),
          // Preserve the full _meta from the remote MCP server (including ui.resourceUri
          // for MCP Apps) so downstream consumers (e.g. Studio) can detect app tools.
          // Also propagate MCP tool annotations so listTools() / listToolsets() consumers
          // can read them via `tool.mcp.annotations`.
          ...mcpToolProps,
          requireApproval,
          mcpMetadata: {
            serverName: this.name,
            serverVersion: this.client.getServerVersion()?.version,
            serverInstructions: this.serverInstructions,
            forwardInstructions: this.forwardInstructions,
            instructionsMaxLength: this.instructionsMaxLength,
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

                // Per the MCP spec, tool *execution* failures are reported in-band:
                // the server returns a normal CallToolResult with `isError: true` and
                // the failure details in `content`. Map that onto Mastra's failed-tool-call
                // path (unless the consumer opted into the legacy `'return'` behaviour) so
                // tool spans, stream chunks, scorers, and persisted message parts reflect the
                // failure, and the model sees the error text so it can self-correct.
                if (res.isError && this.onToolError === 'throw') {
                  const errorText = extractToolErrorText(res.content);
                  this.log('debug', `Tool reported an error: ${tool.name}`, { error: errorText });
                  throw new MastraError({
                    id: 'MCP_CLIENT_TOOL_EXECUTION_FAILED',
                    domain: ErrorDomain.MCP,
                    category: ErrorCategory.THIRD_PARTY,
                    text: errorText,
                    details: { toolName: tool.name, serverName: this.name },
                  });
                }

                this.log('debug', `Tool executed successfully: ${tool.name}`);

                return resolveModelFacingToolOutput(res);
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
        // The agent runtime reads it back via the typed `getNeedsApprovalFn` helper.
        if (needsApprovalFn) {
          mastraTool.needsApprovalFn = needsApprovalFn;
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
