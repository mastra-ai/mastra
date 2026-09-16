import { AsyncLocalStorage } from 'node:async_hooks';
import { createRequire } from 'node:module';
import type { Stream } from 'node:stream';
import { MastraBase } from '@mastra/core/base';
import type { RequestContext } from '@mastra/core/di';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { createTool, validateToolOutput } from '@mastra/core/tools';
import type { NeedsApprovalFn, Tool } from '@mastra/core/tools';
import { toStandardSchema } from '@mastra/schema-compat';
import type { JSONSchema7, StandardSchemaWithJSON } from '@mastra/schema-compat';
import {
  Client,
  LOG_LEVEL_META_KEY,
  StreamableHTTPClientTransport,
  DEFAULT_REQUEST_TIMEOUT_MSEC,
} from '@modelcontextprotocol/client';
import type {
  Transport,
  GetPromptResult,
  ListPromptsResult,
  ListResourcesResult,
  ListResourceTemplatesResult,
  LoggingLevel,
  McpSubscription,
  ReadResourceResult,
  ClientCapabilities,
  PriorDiscovery,
  SubscriptionFilter,
  VersionNegotiationMode,
} from '@modelcontextprotocol/client';
import { getDefaultEnvironment, StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { asyncExitHook, gracefulExit } from 'exit-hook';
import { getMastraToolStrictMeta } from '../shared/mastra-tool-meta';
import { UnauthorizedError } from '../shared/oauth-types';
import { ProgressClientActions } from './actions/progress';
import { PromptClientActions } from './actions/prompt';
import { ResourceClientActions } from './actions/resource';
import { isReconnectableMCPError } from './error-utils';
import { MCP_CLIENT_PROTOCOL_VERSION } from './types';
import type {
  FetchLike,
  LogHandler,
  ProgressHandler,
  MastraMCPServerDefinition,
  InternalMastraMCPClientOptions,
  MCPClientProtocolVersion,
  RequireToolApproval,
  SerializableMCPToolDefinition,
} from './types';
import { assertHostAllowed, fetchFollowingAllowedRedirects, wrapFetchWithHostPolicy } from './url-policy';

// Re-export types for convenience
export type {
  LoggingLevel,
  LogMessage,
  LogHandler,
  ProgressHandler,
  MastraFetchLike,
  MastraMCPServerDefinition,
  MCPClientCapabilities,
  MCPClientProtocolVersion,
  MCPInputRequest,
  MCPInputRequestHandler,
  InternalMastraMCPClientOptions,
  RequireToolApproval,
  RequireToolApprovalFn,
  RequireToolApprovalContext,
  SerializableMCPToolDefinition,
} from './types';

/** A single entry from the MCP `tools/list` response. */
type MCPToolListEntry = Awaited<ReturnType<Client['listTools']>>['tools'][0];

const DEFAULT_SERVER_CONNECT_TIMEOUT_MSEC = 3000;
const DEFAULT_INSTRUCTIONS_MAX_LENGTH = 512;
const DEFAULT_SERVER_LOG_LEVEL: LoggingLevel = 'info';

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

/**
 * 2026-07-28 Streamable HTTP has no standalone GET stream; the only long-lived request is
 * the `subscriptions/listen` POST, whose response stays open for the life of the
 * subscription and must not hold the caller's active Datadog span open with it.
 */
function shouldDetachPersistentTransportRequest(init?: RequestInit): boolean {
  if (typeof init?.body !== 'string' || !init.body.includes('subscriptions/listen')) return false;
  try {
    const message: unknown = JSON.parse(init.body);
    return typeof message === 'object' && message !== null && 'method' in message && message.method === 'subscriptions/listen';
  } catch {
    return false;
  }
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
 * Non-enumerable metadata attached to structured tool execute results so
 * `toModelOutput` can read MCP `content` without changing the execute return shape.
 *
 * When a tool has an `outputSchema` and the server returns `structuredContent`,
 * `execute()` returns that structured value directly. The rest of the
 * CallToolResult envelope is preserved on non-enumerable symbols:
 * - {@link MCP_CALL_TOOL_CONTENT} holds the MCP `content` blocks (model-facing text).
 * - {@link MCP_CALL_TOOL_META} holds the result-level `_meta` (e.g. `ui.resourceUri`
 *   used by MCP Apps hosts), with `ui.serverId` stamped by the client.
 *
 * Read them with {@link getMcpCallToolContent} and {@link getMcpCallToolMeta}.
 * Note: scalar or `null` structured results cannot carry properties, so these
 * channels are only available when `structuredContent` is an object or array.
 */
export const MCP_CALL_TOOL_CONTENT = Symbol.for('mastra.mcp.callToolContent');

/** Non-enumerable result-level `_meta` attached to structured tool execute results. */
export const MCP_CALL_TOOL_META = Symbol.for('mastra.mcp.callToolMeta');

function attachMcpCallToolContent(
  structuredContent: unknown,
  content: unknown,
  _meta?: Record<string, unknown>,
): unknown {
  if (structuredContent !== null && typeof structuredContent === 'object') {
    Object.defineProperty(structuredContent, MCP_CALL_TOOL_CONTENT, {
      value: content,
      enumerable: false,
      configurable: true,
    });
    if (_meta !== undefined) {
      Object.defineProperty(structuredContent, MCP_CALL_TOOL_META, {
        value: _meta,
        enumerable: false,
        configurable: true,
      });
    }
  }
  return structuredContent;
}

/**
 * Read the MCP `content` blocks preserved on a structured tool execute result.
 * Returns `undefined` for scalar results or results without a hidden content channel.
 */
export function getMcpCallToolContent(output: unknown): unknown {
  if (output === null || typeof output !== 'object') return undefined;
  return (output as Record<PropertyKey, unknown>)[MCP_CALL_TOOL_CONTENT];
}

/**
 * Read the result-level `_meta` preserved on a structured tool execute result
 * (e.g. `_meta.ui.resourceUri` for MCP Apps detection). Returns `undefined` for
 * scalar results or results whose CallToolResult had no `_meta`.
 */
export function getMcpCallToolMeta(output: unknown): Record<string, unknown> | undefined {
  if (output === null || typeof output !== 'object') return undefined;
  return (output as Record<PropertyKey, unknown>)[MCP_CALL_TOOL_META] as Record<string, unknown> | undefined;
}

function createStructuredToolToModelOutput(): (output: unknown) =>
  | { type: 'text'; value: string }
  | { type: 'json'; value: unknown } {
  return output => {
    const modelText = extractModelTextFromToolContent(getMcpCallToolContent(output));
    if (modelText !== undefined) {
      return { type: 'text', value: modelText };
    }
    return { type: 'json', value: output };
  };
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
      return 'info';
  }
}

/** Maps the per-server `protocolVersion` option onto the SDK negotiation mode. */
function negotiationMode(protocolVersion: MCPClientProtocolVersion | undefined): VersionNegotiationMode {
  if (protocolVersion === undefined) return 'auto';
  return protocolVersion === 'legacy' ? 'legacy' : { pin: protocolVersion };
}

/**
 * Internal MCP client implementation for connecting to a single MCP server.
 *
 * Probes the server with `server/discover` unless `protocolVersion` pins a
 * revision, then speaks whichever revision was negotiated. On 2026-07-28 there is
 * no session, embedded input requests are answered through the configured
 * `inputRequests` handler, and change notifications arrive on `subscriptions/listen`
 * streams opened with {@link listen}. Those two facilities fail on a legacy
 * negotiation; everything else works on either revision.
 *
 * @internal
 */
export class InternalMastraMCPClient extends MastraBase {
  name: string;
  private client: Client;
  private readonly timeout: number;
  private logHandler?: LogHandler;
  private readonly serverLogLevel?: LoggingLevel;
  private enableProgressTracking: boolean;
  private serverConfig: MastraMCPServerDefinition;
  private transport?: Transport;
  private pendingAuthTransport?: StreamableHTTPClientTransport;
  private clientBaseOnClose?: () => void;
  private clientConnectionOnClose?: () => void;
  private _authState?: MCPServerAuthState;
  private operationContextStore = new AsyncLocalStorage<RequestContext | null>();
  private exitHookUnsubscribe?: () => void;
  private sigTermHandler?: () => void;
  private sigHupHandler?: () => void;
  private serverInstructions?: string;
  /** The verdict of the last successful probe, reused so reconnects skip it. */
  private priorDiscovery?: PriorDiscovery;
  private readonly requireToolApproval: RequireToolApproval | undefined;
  private readonly onToolError: 'throw' | 'return';

  /** Provides access to resource operations (list, read, notifications) */
  public readonly resources: ResourceClientActions;
  /** Provides access to prompt operations (list, get, notifications) */
  public readonly prompts: PromptClientActions;
  /** Provides access to progress operations (notifications) */
  public readonly progress: ProgressClientActions;

  /**
   * @internal
   */
  constructor({ name, version = '1.0.0', server, timeout = DEFAULT_REQUEST_TIMEOUT_MSEC }: InternalMastraMCPClientOptions) {
    super({ name: 'MastraMCPClient' });
    this.name = name;
    this.timeout = timeout;
    this.logHandler = server.logger;
    this.serverLogLevel =
      (server.enableServerLogs ?? true) ? (server.serverLogLevel ?? DEFAULT_SERVER_LOG_LEVEL) : undefined;
    this.serverConfig = server;
    this.enableProgressTracking = !!server.enableProgressTracking;
    this.requireToolApproval = server.requireToolApproval;
    this.onToolError = server.onToolError ?? 'throw';

    const configured = server.capabilities ?? {};
    if (configured.elicitation !== undefined && !server.inputRequests) {
      throw new Error(
        `MCP server '${name}' advertises the elicitation capability without an inputRequests handler. Configure inputRequests or remove capabilities.elicitation.`,
      );
    }
    const clientCapabilities: ClientCapabilities = {
      ...(server.inputRequests ? { elicitation: configured.elicitation ?? { form: {} } } : {}),
      // Advertise MCP Apps extension support so servers know we can render UI resources
      extensions: {
        ...(configured.extensions ?? {}),
        'io.modelcontextprotocol/ui': {},
      },
    };

    this.client = new Client(
      { name, version },
      {
        capabilities: clientCapabilities,
        ...(server.jsonSchemaValidator ? { jsonSchemaValidator: server.jsonSchemaValidator } : {}),
        versionNegotiation: { mode: negotiationMode(server.protocolVersion) },
      },
    );

    if (server.inputRequests) {
      const handler = server.inputRequests;
      this.client.setRequestHandler('elicitation/create', async (request, ctx) => {
        this.log('debug', `Answering input request '${String(ctx.mcpReq.id)}'`);
        return handler({ key: String(ctx.mcpReq.id), params: request.params, signal: ctx.mcpReq.signal });
      });
    }

    if (this.serverLogLevel) {
      this.client.setNotificationHandler('notifications/message', notification => {
        const { level, ...params } = notification.params;
        this.log(level, '[MCP SERVER LOG]', params);
      });
    }

    this.resources = new ResourceClientActions({ client: this, logger: this.logger });
    this.prompts = new PromptClientActions({ client: this, logger: this.logger });
    this.progress = new ProgressClientActions({ client: this, logger: this.logger });
  }

  /**
   * Log a message at the specified level
   */
  private log(level: LoggingLevel, message: string, details?: Record<string, any>): void {
    const loggerMethod = convertLogLevelToLoggerMethod(level);
    const msg = `[${this.name}] ${message}`;

    this.logger[loggerMethod](msg, details);

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

  /**
   * Request metadata every outgoing request carries: the per-request log-level
   * opt-in (when enabled) merged under caller-supplied keys.
   */
  private requestMeta(meta?: Record<string, unknown>): Record<string, unknown> | undefined {
    const merged = {
      ...(this.serverLogLevel ? { [LOG_LEVEL_META_KEY]: this.serverLogLevel } : {}),
      ...meta,
    };
    return Object.keys(merged).length > 0 ? merged : undefined;
  }

  private buildStdioEnv(): Record<string, string> {
    const configured = this.serverConfig.env || {};
    if (this.serverConfig.inheritDefaultEnv === false) {
      // The SDK's StdioClientTransport unconditionally spreads getDefaultEnvironment()
      // under the env we pass it, so an empty base alone cannot suppress the curated
      // defaults. Explicitly override each curated key with undefined — Node's spawn
      // drops env entries whose value is undefined — so only configured entries reach
      // the subprocess.
      const suppressed: Record<string, string | undefined> = {};
      for (const key of Object.keys(getDefaultEnvironment())) {
        suppressed[key] = undefined;
      }
      return { ...suppressed, ...configured } as Record<string, string>;
    }
    return { ...getDefaultEnvironment(), ...configured };
  }

  private async connectStdio(command: string) {
    this.log('debug', `Using Stdio transport for command: ${command}`);
    try {
      this.transport = new StdioClientTransport({
        command,
        args: this.serverConfig.args,
        env: this.buildStdioEnv(),
        stderr: this.serverConfig.stderr,
        cwd: this.serverConfig.cwd,
      });
      await this.client.connect(this.transport, {
        timeout: this.serverConfig.timeout ?? this.timeout,
        prior: this.priorDiscovery,
      });
      this.log('debug', `Successfully connected to MCP server via Stdio`);
    } catch (e) {
      this.log('error', e instanceof Error ? e.stack || e.message : JSON.stringify(e));
      throw e;
    }
  }

  private async connectHttp(url: URL) {
    const { requestInit, authProvider, connectTimeout, fetch: userFetch, allowedHosts } = this.serverConfig;

    // Fail fast with a clear error before any transport is constructed.
    if (allowedHosts !== undefined) {
      assertHostAllowed(url, allowedHosts);
    }

    // Wrap fetch so request-scoped metadata still flows through normal MCP POSTs, while
    // long-lived streams do not inherit the active Datadog span. When allowedHosts is
    // set, the same wrapper enforces the host policy: on the default path via manual
    // redirect following (hops blocked before being sent), and on the custom-fetch path
    // via a pre-request check plus post-hoc response validation.
    const policyUserFetch =
      userFetch && allowedHosts !== undefined ? wrapFetchWithHostPolicy(userFetch, allowedHosts) : undefined;
    const fetch: FetchLike = (requestUrl: string | URL, init?: RequestInit) => {
      const requestContext = this.operationContextStore.getStore() ?? null;
      const executeFetch = (): Promise<Response> => {
        if (allowedHosts === undefined) {
          return userFetch ? userFetch(requestUrl, init, requestContext) : globalThis.fetch(requestUrl, init);
        }
        if (policyUserFetch) {
          return policyUserFetch(requestUrl, init, requestContext);
        }
        return fetchFollowingAllowedRedirects(
          (u: string | URL, i?: RequestInit) => globalThis.fetch(u, i),
          requestUrl,
          init,
          allowedHosts,
        );
      };

      return shouldDetachPersistentTransportRequest(init) ? runOutsideDatadogTraceScope(executeFetch) : executeFetch();
    };

    this.log('debug', `Connecting to URL: ${url}`);

    // Constructed outside the try so an UnauthorizedError can keep a handle on the
    // transport that started the authorization flow (finishAuth must run on it).
    const transport = new StreamableHTTPClientTransport(url, { requestInit, authProvider, fetch });
    try {
      await this.client.connect(transport, {
        timeout: connectTimeout ?? DEFAULT_SERVER_CONNECT_TIMEOUT_MSEC,
        prior: this.priorDiscovery,
      });
      this.transport = transport;
      this.log('debug', 'Successfully connected using Streamable HTTP transport.');
      // Close any transport left pending from an earlier 401: authorization is satisfied.
      this.closePendingAuthTransport();
      if (authProvider) {
        this._authState = 'authorized';
      }
    } catch (error) {
      this.log('debug', `Streamable HTTP transport failed: ${error}`);
      // A 401 means the flow continues on this transport via finishAuth: the SDK has
      // already run discovery and redirected to authorization. Guarded on authProvider
      // so servers without one never carry an auth state.
      if (authProvider && error instanceof UnauthorizedError) {
        this.markNeedsAuth(transport);
      }
      throw error;
    }
  }

  /**
   * Detaches whatever transport is still attached to the underlying SDK Client.
   *
   * The SDK assigns its internal `_transport` before `transport.start()` and never
   * clears it when `start()` throws, so a stale transport can remain attached and
   * make every subsequent `client.connect()` throw "Already connected to a
   * transport". Mastra's own `this.transport` is only assigned after a successful
   * connect, so disconnect/forceReconnect never see the stale one.
   */
  private async detachStaleClientTransport(): Promise<void> {
    const stale = this.client.transport;
    if (!stale) {
      return;
    }
    if (stale === this.pendingAuthTransport) {
      // Keep the transport alive: finishAuth must complete the OAuth flow on it.
      // Just sever its link to the SDK client so the next connect isn't rejected.
      this.severClientTransportLink(stale);
      return;
    }
    this.log('debug', 'Closing stale SDK client transport before connect attempt');
    try {
      await stale.close();
    } catch (e) {
      this.log('debug', 'Error closing stale SDK client transport (ignored)', {
        error: e instanceof Error ? e.message : String(e),
      });
    }
    this.severClientTransportLink(stale);
  }

  /**
   * Severs the mutual references between the SDK client and a stale transport
   * without closing it, so a later close() of the stale transport cannot reach
   * into the SDK client and clear the state of a newer live connection.
   */
  private severClientTransportLink(stale: Transport): void {
    stale.onclose = undefined;
    stale.onerror = undefined;
    stale.onmessage = undefined;
    if (this.client.transport === stale) {
      (this.client as unknown as { _transport?: Transport })._transport = undefined;
    }
  }

  /**
   * Closes and clears any transport retained from an unfinished authorization
   * flow. Safe to call when nothing is pending.
   */
  private closePendingAuthTransport(replacement?: StreamableHTTPClientTransport): void {
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
  private markNeedsAuth(transport: StreamableHTTPClientTransport): void {
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
  private reconnectPromise: Promise<void> | null = null;
  private lifecycleGeneration = 0;

  /**
   * Connects to the MCP server using the configured transport.
   *
   * Safe to call multiple times - returns existing connection if already connected.
   *
   * @internal
   */
  async connect() {
    if (this.isConnected) {
      return this.isConnected;
    }

    this.isConnected = new Promise<boolean>(async (resolve, reject) => {
      try {
        await this.detachStaleClientTransport();

        const { command, url } = this.serverConfig;

        if (command) {
          await this.connectStdio(command);
        } else if (url) {
          await this.connectHttp(url);
        } else {
          throw new Error('Server configuration must include either a command or a url.');
        }

        this.serverInstructions = this.client.getInstructions();
        this.rememberNegotiation();

        resolve(true);

        // Scope the reset to this connection so an older handler retained across
        // reconnects cannot clear the state of a replacement connection.
        const connectedTransport = this.transport;
        const connectionPromise = this.isConnected;
        if (this.client.onclose !== this.clientConnectionOnClose) {
          this.clientBaseOnClose = this.client.onclose;
        }
        const connectionOnClose = () => {
          if (this.transport === connectedTransport) {
            this.log('debug', `MCP server connection closed`);
            const staleTransport = this.transport;
            this.transport = undefined;
            if (this.isConnected === connectionPromise) {
              this.isConnected = null;
            }
            this.serverInstructions = undefined;
            if (staleTransport) {
              this.severClientTransportLink(staleTransport);
              void staleTransport.close().catch(() => {});
            }
          }
          this.clientBaseOnClose?.();
        };
        this.clientConnectionOnClose = connectionOnClose;
        this.client.onclose = connectionOnClose;
      } catch (e) {
        this.isConnected = null;
        // A failed connect invalidates the cached verdict so a legacy verdict cannot stick.
        this.priorDiscovery = undefined;
        reject(e);
      }
    });

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

    return this.isConnected;
  }

  /**
   * Gets the stderr stream of the child process, if using stdio transport with `stderr: 'pipe'`.
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

  /** The protocol revision negotiated with the server; `undefined` until connected. */
  get negotiatedProtocolVersion(): string | undefined {
    return this.client.getNegotiatedProtocolVersion();
  }

  private rememberNegotiation(): void {
    if (this.serverConfig.protocolVersion !== undefined) return;
    const discover = this.client.getDiscoverResult();
    this.priorDiscovery =
      this.client.getProtocolEra() === 'modern' && discover ? { kind: 'modern', discover } : { kind: 'legacy' };
    this.log('debug', `Negotiated protocol revision ${this.negotiatedProtocolVersion}`);
  }

  /** Fails a call that only the 2026-07-28 revision supports when the server negotiated an older one. */
  private assertCurrentRevision(feature: string): void {
    const negotiated = this.negotiatedProtocolVersion;
    if (negotiated !== undefined && negotiated !== MCP_CLIENT_PROTOCOL_VERSION) {
      throw new Error(
        `${feature} needs MCP ${MCP_CLIENT_PROTOCOL_VERSION}, but server '${this.name}' negotiated ${negotiated}`,
      );
    }
  }

  get forwardInstructions(): boolean {
    return this.serverConfig.forwardInstructions ?? false;
  }

  get instructionsMaxLength(): number {
    return this.serverConfig.instructionsMaxLength ?? DEFAULT_INSTRUCTIONS_MAX_LENGTH;
  }

  async disconnect() {
    // Invalidate tool calls that started before this explicit teardown. Their
    // recovery path must not establish a replacement connection afterwards.
    this.lifecycleGeneration++;

    const reconnectPromise = this.reconnectPromise;
    if (reconnectPromise) {
      await reconnectPromise.catch(() => {});
    }

    this.closePendingAuthTransport();
    if (!this.transport) {
      await this.detachStaleClientTransport();
      this.log('debug', 'Disconnect called but no transport was connected.');
      return;
    }
    this.log('debug', `Disconnecting from MCP server`);
    const disconnectedTransport = this.transport;
    try {
      await disconnectedTransport.close();
      this.log('debug', 'Successfully disconnected from MCP server');
    } catch (e) {
      this.log('error', 'Error during MCP server disconnect', {
        error: e instanceof Error ? e.stack : JSON.stringify(e, null, 2),
      });
      throw e;
    } finally {
      this.severClientTransportLink(disconnectedTransport);
      this.transport = undefined;
      this.isConnected = null;
      this.serverInstructions = undefined;

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
   * @internal
   */
  async forceReconnect(): Promise<void> {
    if (this.reconnectPromise) {
      this.log('debug', 'Reconnection already in progress; waiting for it to complete');
      return await this.reconnectPromise;
    }

    const reconnectPromise = (async () => {
      this.log('debug', 'Forcing reconnection to MCP server...');

      this.closePendingAuthTransport();

      const disconnectedTransport = this.transport;
      try {
        if (disconnectedTransport) {
          await disconnectedTransport.close();
        }
      } catch (e) {
        this.log('debug', 'Error during force disconnect (ignored)', {
          error: e instanceof Error ? e.message : String(e),
        });
      } finally {
        if (disconnectedTransport) {
          this.severClientTransportLink(disconnectedTransport);
        }
      }

      // Reset connection state only when it still belongs to the transport that
      // this reconnect attempt disconnected.
      if (!disconnectedTransport || this.transport === disconnectedTransport) {
        this.transport = undefined;
        this.isConnected = null;
        this.serverInstructions = undefined;
      }

      await this.connect();
      this.log('debug', 'Successfully reconnected to MCP server');
    })();
    this.reconnectPromise = reconnectPromise;

    try {
      await reconnectPromise;
    } finally {
      if (this.reconnectPromise === reconnectPromise) {
        this.reconnectPromise = null;
      }
    }
  }

  private async reconnectAfterTransportFailure(failedTransport: Transport | undefined, lifecycleGeneration: number) {
    while (true) {
      if (this.lifecycleGeneration !== lifecycleGeneration) {
        throw new Error('MCP client was disconnected while recovering the failed transport');
      }

      const reconnectPromise = this.reconnectPromise;
      if (reconnectPromise) {
        await reconnectPromise;
        continue;
      }

      if (failedTransport && this.transport && this.transport !== failedTransport) {
        this.log('debug', 'Connection was already replaced after the failed operation; skipping reconnect');
        return;
      }

      await this.forceReconnect();

      if (this.lifecycleGeneration !== lifecycleGeneration) {
        throw new Error('MCP client was disconnected while recovering the failed transport');
      }
      return;
    }
  }

  async listResources(): Promise<ListResourcesResult> {
    this.log('debug', `Requesting resources from MCP server`);
    return await this.client.listResources({ _meta: this.requestMeta() }, { timeout: this.timeout });
  }

  async readResource(uri: string): Promise<ReadResourceResult> {
    this.log('debug', `Reading resource from MCP server: ${uri}`);
    return await this.client.readResource({ uri, _meta: this.requestMeta() }, { timeout: this.timeout });
  }

  async listResourceTemplates(): Promise<ListResourceTemplatesResult> {
    this.log('debug', `Requesting resource templates from MCP server`);
    return await this.client.listResourceTemplates({ _meta: this.requestMeta() }, { timeout: this.timeout });
  }

  /**
   * Fetch the list of available prompts from the MCP server.
   */
  async listPrompts(): Promise<ListPromptsResult> {
    this.log('debug', `Requesting prompts from MCP server`);
    return await this.client.listPrompts({ _meta: this.requestMeta() }, { timeout: this.timeout });
  }

  /**
   * Get a prompt and its dynamic messages from the server.
   */
  async getPrompt({ name, args }: { name: string; args?: Record<string, any> }): Promise<GetPromptResult> {
    this.log('debug', `Requesting prompt from MCP server: ${name}`);
    return await this.client.getPrompt(
      { name, arguments: args, _meta: this.requestMeta() },
      { timeout: this.timeout },
    );
  }

  /**
   * Opens a `subscriptions/listen` stream. Change notifications delivered on the
   * stream dispatch to the handlers registered via the `on*` methods below.
   */
  async listen(filter: SubscriptionFilter): Promise<McpSubscription> {
    this.assertCurrentRevision('subscriptions/listen');
    this.log('debug', 'Opening subscriptions/listen stream', { filter });
    return await this.client.listen(filter, { timeout: this.timeout });
  }

  setPromptListChangedNotificationHandler(handler: () => void): void {
    this.client.setNotificationHandler('notifications/prompts/list_changed', () => {
      handler();
    });
  }

  setToolListChangedNotificationHandler(handler: () => void): void {
    this.client.setNotificationHandler('notifications/tools/list_changed', () => {
      handler();
    });
  }

  setResourceUpdatedNotificationHandler(handler: (params: { uri: string }) => void): void {
    this.client.setNotificationHandler('notifications/resources/updated', notification => {
      handler(notification.params);
    });
  }

  setResourceListChangedNotificationHandler(handler: () => void): void {
    this.client.setNotificationHandler('notifications/resources/list_changed', () => {
      handler();
    });
  }

  setProgressNotificationHandler(handler: ProgressHandler): void {
    this.client.setNotificationHandler('notifications/progress', notification => {
      handler(notification.params);
    });
  }

  private convertInputSchema(inputSchema: MCPToolListEntry['inputSchema']): JSONSchema7 {
    return ('jsonSchema' in inputSchema ? inputSchema.jsonSchema : inputSchema) as JSONSchema7;
  }

  /**
   * Wraps the output schema with a validator that always succeeds. The tool's execute wrapper
   * returns the full CallToolResult envelope when there is no structuredContent (and for
   * in-band errors with `onToolError: 'return'`), which would never match the advertised
   * outputSchema — so enforcement happens inside the execute wrapper, scoped to the
   * structuredContent path (see buildToolFromListEntry). The JSON schema is surfaced here
   * for documentation.
   */
  private convertOutputSchema(outputSchema: MCPToolListEntry['outputSchema']): StandardSchemaWithJSON | undefined {
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

  /**
   * Returns the server's tool catalog as plain, serializable definitions.
   */
  async toolDefinitions(): Promise<Record<string, SerializableMCPToolDefinition>> {
    this.log('debug', `Requesting tool definitions from MCP server`);
    const { tools } = await this.client.listTools({ _meta: this.requestMeta() }, { timeout: this.timeout });

    const definitions: Record<string, SerializableMCPToolDefinition> = {};
    for (const tool of tools) {
      if (!tool.name) continue;
      definitions[tool.name] = this.toSerializableDefinition(tool);
    }
    return definitions;
  }

  private toSerializableDefinition(tool: MCPToolListEntry): SerializableMCPToolDefinition {
    const annotations = tool.annotations;
    const rawMeta = (tool as { _meta?: Record<string, unknown> })._meta;

    return {
      name: tool.name,
      ...(tool.description ? { description: tool.description } : {}),
      inputSchema: tool.inputSchema,
      ...(tool.outputSchema ? { outputSchema: tool.outputSchema } : {}),
      ...(annotations ? { annotations } : {}),
      ...(rawMeta ? { _meta: rawMeta } : {}),
      server: {
        name: this.name,
        ...(this.client.getServerVersion()?.version ? { version: this.client.getServerVersion()!.version } : {}),
        ...(this.serverInstructions ? { instructions: this.serverInstructions } : {}),
      },
    };
  }

  /**
   * Rebuilds an executable Mastra tool from a cached {@link SerializableMCPToolDefinition}.
   * The client connects lazily on the first execution.
   */
  toolFromDefinition({ definition }: { definition: SerializableMCPToolDefinition }): Tool<any, any, any, any> {
    const tool = {
      name: definition.name,
      description: definition.description,
      inputSchema: definition.inputSchema,
      outputSchema: definition.outputSchema,
      annotations: definition.annotations,
      _meta: definition._meta,
    } as MCPToolListEntry;

    const built = this.buildToolFromListEntry(tool, {
      version: definition.server.version,
      instructions: definition.server.instructions,
      connectFirst: true,
    });

    if (!built) {
      throw new MastraError({
        id: 'MCP_CLIENT_TOOL_HYDRATION_FAILED',
        domain: ErrorDomain.MCP,
        category: ErrorCategory.USER,
        text: `Failed to rebuild MCP tool "${definition.name}" from its cached definition`,
        details: { toolName: definition.name, serverName: this.name },
      });
    }

    return built;
  }

  async tools(): Promise<Record<string, Tool<any, any, any, any>>> {
    this.log('debug', `Requesting tools from MCP server`);
    const { tools } = await this.client.listTools({ _meta: this.requestMeta() }, { timeout: this.timeout });
    const toolsRes: Record<string, Tool<any, any, any, any>> = {};
    for (const tool of tools) {
      const mastraTool = this.buildToolFromListEntry(tool, {
        version: this.client.getServerVersion()?.version,
        instructions: this.serverInstructions,
      });

      if (mastraTool && tool.name) {
        toolsRes[tool.name] = mastraTool;
      }
    }

    return toolsRes;
  }

  /**
   * Single conversion path shared by live discovery and cached hydration, so hydrated
   * tools behave identically to discovered ones.
   */
  private buildToolFromListEntry(
    tool: MCPToolListEntry,
    serverMeta: { version?: string; instructions?: string; connectFirst?: boolean },
  ): Tool<any, any, any, any> | undefined {
    try {
      let requireApproval: boolean | undefined;
      let needsApprovalFn: NeedsApprovalFn | undefined;

      // Server-advertised annotations are exposed on `mcp.annotations` and forwarded to
      // the requireToolApproval callback so consumers can write annotation-driven policies.
      const annotations = tool.annotations;

      if (typeof this.requireToolApproval === 'function') {
        const serverApprovalFn = this.requireToolApproval;
        const toolName = tool.name;
        requireApproval = true;
        needsApprovalFn = (args: Record<string, unknown>, ctx: Record<string, unknown> = {}) => {
          // Server-supplied annotations are placed AFTER the ctx spread so a caller
          // cannot override them by injecting an `annotations` key into ctx.
          return serverApprovalFn({ toolName, args, ...ctx, annotations });
        };
      } else if (this.requireToolApproval === true) {
        requireApproval = true;
      }

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
      // Real validator for structuredContent. Kept separate from the Tool's outputSchema
      // (whose validator is a no-op — see convertOutputSchema) because only the
      // structuredContent success path should be validated, not envelope returns.
      const rawOutputSchema = tool.outputSchema
        ? (('jsonSchema' in tool.outputSchema ? tool.outputSchema.jsonSchema : tool.outputSchema) as JSONSchema7)
        : undefined;
      const outputValidator = rawOutputSchema ? toStandardSchema(rawOutputSchema) : undefined;
      const mastraTool = createTool({
        id: `${this.name}_${tool.name}`,
        description: tool.description || '',
        inputSchema: this.convertInputSchema(tool.inputSchema),
        outputSchema: this.convertOutputSchema(tool.outputSchema),
        strict: getMastraToolStrictMeta(toolMeta),
        ...mcpToolProps,
        requireApproval,
        mcpMetadata: {
          serverName: this.name,
          serverVersion: serverMeta.version,
          serverInstructions: serverMeta.instructions,
          forwardInstructions: this.forwardInstructions,
          instructionsMaxLength: this.instructionsMaxLength,
        },
        ...(tool.outputSchema ? { toModelOutput: createStructuredToolToModelOutput() } : {}),
        execute: async (
          input: any,
          context?: {
            requestContext?: RequestContext | null;
            runId?: string;
            abortSignal?: AbortSignal;
            _meta?: Record<string, unknown>;
          },
        ) => {
          // A hydrated tool was rebuilt from cache without ever opening a connection, so the
          // first execution is what establishes it. `connect()` is memoised.
          if (serverMeta.connectFirst) {
            await this.connect();
          }

          const operationContext = context?.requestContext ?? null;

          return this.operationContextStore.run(operationContext, async () => {
            const executeToolCall = async () => {
              this.log('debug', `Executing tool: ${tool.name}`, { toolArgs: input, runId: context?.runId });
              // progressToken spreads last so the Mastra-managed token takes precedence.
              const progressMeta = this.enableProgressTracking
                ? { progressToken: context?.runId || crypto.randomUUID() }
                : undefined;
              const _meta = this.requestMeta({ ...context?._meta, ...progressMeta });

              const res = await this.client.callTool(
                { name: tool.name, arguments: input, ...(_meta ? { _meta } : {}) },
                { timeout: this.timeout, signal: context?.abortSignal },
              );

              // Per the MCP spec, tool *execution* failures are reported in-band with
              // `isError: true`. Map that onto Mastra's failed-tool-call path unless the
              // consumer opted into `'return'`.
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

              if (res.structuredContent !== undefined) {
                // Enforce the server-advertised outputSchema before the result reaches the
                // model. Covers hydrated tools too, which never populate the SDK's tools/list
                // output-schema cache. On mismatch, return the structured ValidationError
                // shape createTool produces so the model can self-correct.
                if (!res.isError && outputValidator) {
                  const validation = validateToolOutput(outputValidator, res.structuredContent, tool.name);
                  if (validation.error) {
                    this.log('debug', `Tool output failed schema validation: ${tool.name}`, {
                      message: validation.error.message,
                    });
                    return validation.error;
                  }
                }
                return attachMcpCallToolContent(
                  res.structuredContent,
                  res.content,
                  res._meta ? this.stampServerIdInMeta(res._meta) : undefined,
                );
              }

              return res;
            };

            const failedTransport = this.transport;
            const lifecycleGeneration = this.lifecycleGeneration;
            try {
              return await executeToolCall();
            } catch (e) {
              // In-band tool errors are semantic failures, never transport issues.
              const isToolExecutionError = e instanceof MastraError && e.id === 'MCP_CLIENT_TOOL_EXECUTION_FAILED';

              if (!isToolExecutionError && isReconnectableMCPError(e)) {
                this.log('debug', `Transport error detected for tool ${tool.name}, attempting reconnection...`, {
                  error: e instanceof Error ? e.message : String(e),
                });

                try {
                  await this.reconnectAfterTransportFailure(failedTransport, lifecycleGeneration);
                  this.log('debug', `Retrying tool ${tool.name} after reconnection...`);
                  return await executeToolCall();
                } catch (reconnectError) {
                  this.log('error', `Reconnection or retry failed for tool ${tool.name}`, {
                    originalError: e instanceof Error ? e.message : String(e),
                    reconnectError: reconnectError instanceof Error ? reconnectError.stack : String(reconnectError),
                    toolArgs: input,
                  });
                  throw reconnectError;
                }
              }

              this.log('error', `Error calling tool: ${tool.name}`, {
                error: e instanceof Error ? e.stack : JSON.stringify(e, null, 2),
                toolArgs: input,
              });
              throw e;
            }
          });
        },
      });

      // The agent runtime reads this back via the typed `getNeedsApprovalFn` helper.
      if (needsApprovalFn) {
        mastraTool.needsApprovalFn = needsApprovalFn;
      }

      return mastraTool;
    } catch (toolCreationError: unknown) {
      this.log('error', `Failed to create Mastra tool wrapper for MCP tool: ${tool.name}`, {
        error: toolCreationError instanceof Error ? toolCreationError.stack : String(toolCreationError),
        mcpToolDefinition: tool,
      });
      return undefined;
    }
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
