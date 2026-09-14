import { readFileSync } from 'node:fs';
import type * as http from 'node:http';
import type { Agent } from '@mastra/core/agent';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { MCPServerBaseV2, isMCPToolV2, parseMCPInputRequiredV2 } from '@mastra/core/mcp';
import type {
  MCPServerConfigV2,
  MCPServerFGAConfig,
  MCPServerToolsV2,
  MCPToolInfoV2,
  MCPToolExecutionContextV2,
  MCPToolOutcomeV2,
  MCPToolV2,
  ServerDetailInfo,
  ServerInfo,
} from '@mastra/core/mcp';
import { EntityType, SpanType, getOrCreateSpan } from '@mastra/core/observability';
import type { Span } from '@mastra/core/observability';
import { RequestContext } from '@mastra/core/request-context';
import { standardSchemaToJSONSchema } from '@mastra/core/schema';
import type { StandardSchemaWithJSON } from '@mastra/core/schema';
import { createTool, isValidationError } from '@mastra/core/tools';
import type { Tool } from '@mastra/core/tools';
import type { Workflow } from '@mastra/core/workflows';
import { PromptSchema } from '@modelcontextprotocol/core';
import { RESOURCE_MIME_TYPE, RESOURCE_URI_META_KEY } from '@modelcontextprotocol/ext-apps';
import { hostHeaderValidation, originValidation, toNodeHandler } from '@modelcontextprotocol/node';
import type { NodeMcpRequestHandler } from '@modelcontextprotocol/node';
import {
  Server,
  ProtocolError,
  ProtocolErrorCode,
  createMcpHandler,
  specTypeSchemas,
} from '@modelcontextprotocol/server';
import type {
  BlobResourceContents,
  CallToolResult,
  InputRequiredResult,
  McpHttpHandler,
  Tool as MCPTool,
  Resource,
  ServerCapabilities,
  ServerContext,
  ServerNotifier,
  TextResourceContents,
  jsonSchemaValidator,
} from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import type { StdioServerHandle } from '@modelcontextprotocol/server/stdio';

import { withMastraToolStrictMeta } from '../shared/mastra-tool-meta';
import { ServerPromptActions, ServerResourceActions, ServerToolActions } from './actions';
import { toServerRequest } from './request';
import type {
  AppResources,
  MCPAuthInfoToUserMapperV2,
  MCPInputRequired,
  MCPRequestStateVerifier,
  MCPServerCacheHints,
  MCPServerHTTPRequestOptions,
  MCPServerPrompts,
  MCPServerRequest,
  MCPServerResources,
} from './types';

export interface MCPServerConfig extends MCPServerConfigV2 {
  /** Agents exposed as `ask_<key>` tools. Each agent needs a description. */
  agents?: Record<string, Agent>;
  /** Workflows exposed as `run_<key>` tools. Each workflow needs a description. */
  workflows?: Record<string, Workflow>;
  resources?: MCPServerResources;
  prompts?: MCPServerPrompts;
  /** MCP Apps (SEP-1865) HTML resources served under `ui://`. */
  appResources?: AppResources;
  /** Custom JSON Schema validator, for runtimes where the SDK default is unavailable. */
  jsonSchemaValidator?: jsonSchemaValidator;
  cacheHints?: MCPServerCacheHints;
  mapAuthInfoToUser?: MCPAuthInfoToUserMapperV2;
  fga?: MCPServerFGAConfig;
  /**
   * Integrity check for echoed continuation state. Without it `requestState`
   * reaches handlers as the raw client-controlled string.
   */
  requestState?: { verify: MCPRequestStateVerifier };
}

export interface MCPServerHTTPOptions {
  url: URL;
  httpPath: string;
  req: http.IncomingMessage;
  res: http.ServerResponse<http.IncomingMessage>;
  options?: MCPServerHTTPRequestOptions;
}

type CatalogueTool = Tool | MCPToolV2;

/**
 * MCPServer exposes Mastra tools, agents, workflows, resources and prompts over the
 * Model Context Protocol revision 2026-07-28: self-contained requests over Streamable
 * HTTP or stdio, native `input_required` continuation and per-request logging.
 *
 * @example
 * ```typescript
 * import { MCPServer } from '@mastra/mcp';
 * import { createTool } from '@mastra/core/tools';
 * import { z } from 'zod';
 *
 * const weatherTool = createTool({
 *   id: 'getWeather',
 *   description: 'Gets the current weather for a location.',
 *   inputSchema: z.object({ location: z.string() }),
 *   execute: async ({ location }) => `Weather in ${location} is sunny.`,
 * });
 *
 * const server = new MCPServer({ name: 'My Weather Server', version: '1.0.0', tools: { weatherTool } });
 * await server.startStdio();
 * ```
 */
export class MCPServer extends MCPServerBaseV2 {
  readonly resources: ServerResourceActions;
  readonly prompts: ServerPromptActions;
  readonly toolActions: ServerToolActions;

  private readonly resourceOptions?: MCPServerResources;
  private readonly promptOptions?: MCPServerPrompts;
  private readonly appResourceList: Resource[] = [];
  private readonly appResourceHtml = new Map<string, string>();
  private readonly jsonSchemaValidator?: jsonSchemaValidator;
  private readonly cacheHints?: MCPServerCacheHints;
  private readonly mapAuthInfoToUser?: MCPAuthInfoToUserMapperV2;
  private readonly fga?: MCPServerFGAConfig;
  private readonly requestStateVerifier?: MCPRequestStateVerifier;

  private httpHandler?: McpHttpHandler;
  private nodeHandler?: NodeMcpRequestHandler;
  private stdioHandle?: StdioServerHandle;
  private stdioInstance?: Server;

  constructor(config: MCPServerConfig) {
    const derived = deriveTools(config);
    super({ ...config, tools: { ...config.tools, ...derived.tools } });
    for (const warning of derived.warnings) this.logger.warn(warning);
    for (const [key, tool] of Object.entries(config.tools)) {
      if (tool.id !== undefined && tool.id !== key) {
        this.logger.warn(`Tool key '${key}' differs from its id '${tool.id}'; the key is the MCP tool name.`);
      }
    }

    this.jsonSchemaValidator = config.jsonSchemaValidator;
    this.cacheHints = config.cacheHints;
    this.mapAuthInfoToUser = config.mapAuthInfoToUser;
    this.fga = config.fga;
    this.requestStateVerifier = config.requestState?.verify;
    this.promptOptions = config.prompts;
    this.loadAppResources(config.appResources);
    this.resourceOptions = config.resources;

    const deps = { getLogger: () => this.logger, getNotifier: () => this.notifier() };
    this.toolActions = new ServerToolActions({
      ...deps,
      addTools: tools => this.addTools(tools),
      removeTools: keys => this.removeTools(keys),
    });
    this.resources = new ServerResourceActions(deps);
    this.prompts = new ServerPromptActions(deps);
  }

  // ---------------------------------------------------------------------------
  // Catalogue

  private tool(name: string): CatalogueTool | undefined {
    return this.tools()[name];
  }

  private jsonSchema(schema: StandardSchemaWithJSON | undefined): Record<string, unknown> | undefined {
    if (!schema) return undefined;
    // The SDK default validator only supports the 2020-12 dialect; the dialect
    // declaration is stripped before the schema is advertised.
    const { $schema: _dialect, ...rest } = standardSchemaToJSONSchema(schema) as Record<string, unknown>;
    return rest;
  }

  private toolInfo(name: string, tool: CatalogueTool): MCPToolInfoV2 {
    const native = isMCPToolV2(tool);
    return {
      id: name,
      name,
      description: tool.description,
      inputSchema: this.jsonSchema(tool.inputSchema) ?? { type: 'object', properties: {} },
      outputSchema: this.jsonSchema(tool.outputSchema),
      toolType: native ? undefined : tool.mcp?.toolType,
      _meta: withMastraToolStrictMeta(native ? tool._meta : tool.mcp?._meta, native ? undefined : tool.strict),
    };
  }

  /** Builds the wire tool description, validated against the spec schema. */
  private toMCPTool(name: string, tool: CatalogueTool): MCPTool {
    const info = this.toolInfo(name, tool);
    const validation = specTypeSchemas.Tool['~standard'].validate({
      name,
      description: info.description,
      inputSchema: info.inputSchema,
      outputSchema: info.outputSchema,
      annotations: isMCPToolV2(tool) ? tool.annotations : tool.mcp?.annotations,
      _meta: normalizeUiMeta(info._meta),
    });
    if (validation instanceof Promise || validation.issues) {
      throw new Error(`Tool '${name}' does not describe a valid MCP tool (input schemas must be objects)`);
    }
    return validation.value;
  }

  private hasUiMetadata(): boolean {
    return Object.values(this.tools()).some(tool => {
      const meta = (isMCPToolV2(tool) ? tool._meta : tool.mcp?._meta) as { ui?: { resourceUri?: string } } | undefined;
      return Boolean(meta?.ui?.resourceUri);
    });
  }

  // ---------------------------------------------------------------------------
  // Protocol instance

  private capabilities(): ServerCapabilities {
    const capabilities: ServerCapabilities = {
      tools: { listChanged: true },
      // Static declaration required by the 2026-07-28 logging utility; delivery
      // itself is gated per request by the caller's `_meta` log-level opt-in.
      logging: {},
    };
    if (this.resourceOptions || this.appResourceList.length > 0) {
      capabilities.resources = { subscribe: true, listChanged: true };
    }
    if (this.promptOptions) capabilities.prompts = { listChanged: true };
    if (this.appResourceList.length > 0 || this.hasUiMetadata()) {
      capabilities.extensions = { 'io.modelcontextprotocol/ui': {} };
    }
    return capabilities;
  }

  private createServerInstance(): Server {
    const server = new Server(
      { name: this.name, version: this.version },
      {
        capabilities: this.capabilities(),
        instructions: this.instructions,
        jsonSchemaValidator: this.jsonSchemaValidator,
        cacheHints: this.cacheHints,
        requestState: this.requestStateVerifier ? { verify: this.requestStateVerifier } : undefined,
      },
    );
    // Deprecated session-level log control (SEP-2577): not served by v2.
    server.removeRequestHandler('logging/setLevel');
    this.registerToolHandlers(server);
    this.registerResourceHandlers(server);
    this.registerPromptHandlers(server);
    return server;
  }

  private async serverRequest(ctx: ServerContext): Promise<MCPServerRequest> {
    return toServerRequest(ctx, this.name, this.mapAuthInfoToUser);
  }

  private registerToolHandlers(server: Server): void {
    server.setRequestHandler('tools/list', async (_request, ctx) => {
      const { requestContext } = await this.serverRequest(ctx);
      const entries = await this.authorizedToolEntries(requestContext);
      return { tools: entries.map(([name, tool]) => this.toMCPTool(name, tool)) };
    });

    server.setRequestHandler('tools/call', async (request, ctx) => {
      const name = request.params.name;
      const tool = this.tool(name);
      if (!tool) {
        this.logger.warn('Unknown tool requested', { tool: name });
        return errorResult(`Unknown tool: ${name}`);
      }
      const { request: mcpRequest, requestContext } = await this.serverRequest(ctx);
      const args = request.params.arguments ?? {};
      const span = getOrCreateSpan({
        type: SpanType.TOOL_CALL,
        name: `tool: '${name}'`,
        input: args,
        entityType: EntityType.TOOL,
        entityId: name,
        entityName: name,
        attributes: { toolType: 'tool', toolDescription: tool.description },
        requestContext,
        mastra: this.mastra,
      });
      const startedAt = Date.now();
      try {
        const outcome = await this.invokeTool(name, args, {
          request: mcpRequest,
          requestContext,
          tracingContext: { currentSpan: span },
          mastra: this.mastra,
        });
        const result = this.toCallToolResult(name, tool, outcome);
        span?.end({ output: outcome.kind === 'completed' ? outcome.value : undefined, attributes: { success: true } });
        this.logger.info(`Tool '${name}' finished in ${Date.now() - startedAt}ms (${outcome.kind}).`);
        return result;
      } catch (error) {
        span?.error({ error: error as Error, attributes: { success: false } });
        if (error instanceof ProtocolError) throw error;
        this.logger.error('Tool execution failed', { tool: name, error });
        const mastraError =
          error instanceof MastraError
            ? error
            : new MastraError(
                {
                  id: 'TOOL_EXECUTION_FAILED',
                  domain: ErrorDomain.TOOL,
                  category: ErrorCategory.USER,
                  details: { toolName: name },
                },
                error,
              );
        return errorResult(JSON.stringify(mastraError.toJSON()));
      }
    });
  }

  private toCallToolResult(
    name: string,
    tool: CatalogueTool,
    outcome: MCPToolOutcomeV2<unknown>,
  ): CallToolResult | InputRequiredResult {
    if (outcome.kind === 'input_required') {
      this.logger.debug(`Tool '${name}' requires client input.`);
      return parseMCPInputRequiredV2(outcome.result);
    }
    const value = outcome.value;
    if (isValidationError(value)) {
      this.logger.warn(`Tool '${name}' rejected its input.`, { error: value.message });
      return errorResult(value.message);
    }
    if (!tool.outputSchema) {
      return {
        isError: false,
        content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value) }],
      };
    }
    // Business tools already validated `value` against their output schema.
    const structuredContent = value as Record<string, unknown>;
    return { isError: false, structuredContent, content: [{ type: 'text', text: JSON.stringify(structuredContent) }] };
  }

  private registerResourceHandlers(server: Server): void {
    const options = this.resourceOptions;
    const hasAppResources = this.appResourceList.length > 0;
    if (!options && !hasAppResources) return;

    const listResources = async (request: MCPServerRequest): Promise<Resource[]> => [
      ...this.appResourceList,
      ...((await options?.listResources(request)) ?? []),
    ];

    // Providers are re-evaluated with the current request every time; resource
    // lists are scoped per caller and never cached on the shared server.
    server.setRequestHandler('resources/list', async (_request, ctx) => ({
      resources: await listResources(await this.serverRequest(ctx)),
    }));

    server.setRequestHandler('resources/read', async (request, ctx) => {
      const uri = request.params.uri;
      const serverRequest = await this.serverRequest(ctx);
      const resource = (await listResources(serverRequest)).find(r => r.uri === uri);
      if (!resource) throw new ProtocolError(ProtocolErrorCode.InvalidParams, `Resource not found: ${uri}`);

      const html = this.appResourceHtml.get(uri);
      if (html !== undefined) return { contents: [this.resourceContents(resource, { text: html })] };
      if (!options) throw new ProtocolError(ProtocolErrorCode.InvalidParams, `Resource not found: ${uri}`);

      const result = await options.getResourceContent({ uri, ...serverRequest });
      if (isInputRequired(result)) return parseMCPInputRequiredV2(result.result);
      const contents = (Array.isArray(result) ? result : [result]).map(content =>
        this.resourceContents(resource, content),
      );
      return { contents };
    });

    if (options?.resourceTemplates) {
      server.setRequestHandler('resources/templates/list', async (_request, ctx) => ({
        resourceTemplates: await options.resourceTemplates!(await this.serverRequest(ctx)),
      }));
    }
  }

  private resourceContents(
    resource: Resource,
    content: { text?: string } | { blob?: string },
  ): TextResourceContents | BlobResourceContents {
    // `_meta` is preserved on contents: MCP Apps hosts read the UI CSP from it.
    const base = {
      uri: resource.uri,
      mimeType: resource.mimeType,
      ...(resource._meta ? { _meta: resource._meta } : {}),
    };
    if ('text' in content && content.text !== undefined) return { ...base, text: content.text };
    if ('blob' in content && content.blob !== undefined) return { ...base, blob: content.blob };
    throw new Error(`Resource '${resource.uri}' returned content with neither text nor blob`);
  }

  private registerPromptHandlers(server: Server): void {
    const options = this.promptOptions;
    if (!options) return;

    const listPrompts = async (request: MCPServerRequest) => {
      const prompts = await options.listPrompts(request);
      for (const prompt of prompts) PromptSchema.parse(prompt);
      return prompts;
    };

    server.setRequestHandler('prompts/list', async (_request, ctx) => ({
      prompts: await listPrompts(await this.serverRequest(ctx)),
    }));

    if (!options.getPromptMessages) return;
    server.setRequestHandler('prompts/get', async (request, ctx) => {
      const { name, arguments: args } = request.params;
      const serverRequest = await this.serverRequest(ctx);
      const prompt = (await listPrompts(serverRequest)).find(p => p.name === name);
      if (!prompt) throw new ProtocolError(ProtocolErrorCode.InvalidParams, `Prompt "${name}" not found`);
      for (const arg of prompt.arguments ?? []) {
        if (arg.required && (args?.[arg.name] === undefined || args?.[arg.name] === null)) {
          throw new ProtocolError(ProtocolErrorCode.InvalidParams, `Missing required argument: ${arg.name}`);
        }
      }
      const result = await options.getPromptMessages!({ name, args, ...serverRequest });
      if (isInputRequired(result)) return parseMCPInputRequiredV2(result.result);
      return { description: prompt.description, messages: result };
    });
  }

  // ---------------------------------------------------------------------------
  // App resources

  private loadAppResources(appResources: AppResources | undefined): void {
    for (const [uri, appResource] of Object.entries(appResources ?? {})) {
      const html = appResource.html ?? (appResource.htmlPath ? readFileSync(appResource.htmlPath, 'utf-8') : undefined);
      if (html === undefined) {
        this.logger.warn(`App resource '${uri}' has neither html nor htmlPath; skipping`);
        continue;
      }
      this.appResourceHtml.set(uri, html);
      this.appResourceList.push({
        uri,
        name: appResource.name,
        description: appResource.description,
        mimeType: RESOURCE_MIME_TYPE,
        ...(appResource.meta ? { _meta: { ui: appResource.meta } } : {}),
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Authorization

  /** Native tools are authorized here; business tools are authorized in `executeTool`. */
  override async invokeTool(
    toolId: string,
    input: unknown,
    context: MCPToolExecutionContextV2,
  ): Promise<MCPToolOutcomeV2<unknown>> {
    const tool = this.tool(toolId);
    if (tool && isMCPToolV2(tool)) await this.enforceToolExecutionFGA(toolId, context.requestContext);
    return super.invokeTool(toolId, input, context);
  }

  override async executeTool(
    toolId: string,
    input: unknown,
    context?: Parameters<MCPServerBaseV2['executeTool']>[2],
  ): Promise<unknown> {
    await this.enforceToolExecutionFGA(toolId, context?.requestContext ?? new RequestContext());
    return super.executeTool(toolId, input, context);
  }

  private async enforceToolExecutionFGA(toolId: string, requestContext: RequestContext): Promise<void> {
    const fgaProvider = this.mastra?.getServer?.()?.fga;
    if (!fgaProvider) return;

    const { getMCPToolFGAResourceId, requireFGA, FGADeniedError, MastraFGAPermissions } =
      await import('@mastra/core/auth/ee');
    const resourceId = getMCPToolFGAResourceId(this.id, toolId);
    const user = requestContext.get('user');
    if (!user) {
      throw new FGADeniedError({ id: 'unknown' }, { type: 'tool', id: resourceId }, MastraFGAPermissions.TOOLS_EXECUTE);
    }
    const permission =
      this.fga?.permissionMapping?.[MastraFGAPermissions.TOOLS_EXECUTE] ?? MastraFGAPermissions.TOOLS_EXECUTE;
    const mapping = this.fga?.resourceMapping?.tool ?? this.fga?.resourceMapping?.tools;
    const resource = mapping
      ? { type: mapping.fgaResourceType, id: mapping.deriveId?.({ user, resourceId, requestContext }) ?? resourceId }
      : { type: 'tool', id: resourceId };

    await requireFGA({
      fgaProvider,
      user,
      resource,
      permission,
      requestContext,
      context: { resourceId },
      metadata: { mcpServerId: this.id, mcpServerName: this.name, toolId },
    });
  }

  private async authorizedToolEntries(requestContext: RequestContext): Promise<Array<[string, CatalogueTool]>> {
    const entries = Object.entries(this.tools());
    if (!this.mastra?.getServer?.()?.fga) return entries;
    if (!requestContext.get('user')) return [];
    const accessible = await Promise.all(
      entries.map(async entry => {
        try {
          await this.enforceToolExecutionFGA(entry[0], requestContext);
          return entry;
        } catch (error) {
          if (error instanceof Error && error.name === 'FGADeniedError') return undefined;
          throw error;
        }
      }),
    );
    return accessible.filter((entry): entry is [string, CatalogueTool] => entry !== undefined);
  }

  // ---------------------------------------------------------------------------
  // Transports

  private notifier(): ServerNotifier | undefined {
    if (this.httpHandler) return this.httpHandler.notify;
    const stdio = this.stdioInstance;
    if (!stdio) return undefined;
    const report = (error: unknown) => this.logger.error('Failed to publish stdio notification', { error });
    return {
      toolsChanged: () => void stdio.sendToolListChanged().catch(report),
      promptsChanged: () => void stdio.sendPromptListChanged().catch(report),
      resourcesChanged: () => void stdio.sendResourceListChanged().catch(report),
      resourceUpdated: uri => void stdio.sendResourceUpdated({ uri }).catch(report),
    };
  }

  private getNodeHandler(): NodeMcpRequestHandler {
    if (!this.nodeHandler) {
      this.httpHandler = createMcpHandler(() => this.createServerInstance(), {
        legacy: 'reject',
        onerror: error => this.logger.error('MCP handler error', { error: error.toString() }),
      });
      this.nodeHandler = toNodeHandler(this.httpHandler, {
        onerror: error => this.logger.error('MCP Node handler adapter error', { error: error.toString() }),
      });
    }
    return this.nodeHandler;
  }

  /** Serves the current process's stdio. Legacy openings are rejected. */
  async startStdio(): Promise<void> {
    this.stdioHandle = serveStdio(
      () => {
        this.stdioInstance = this.createServerInstance();
        return this.stdioInstance;
      },
      {
        legacy: 'reject',
        onerror: error => this.logger.error('MCP stdio handler error', { error: error.toString() }),
      },
    );
    this.logger.info('Started MCP Server (stdio, 2026-07-28)');
  }

  /**
   * Handles one Streamable HTTP request at `httpPath`. Every request is
   * self-contained; requests without a 2026-07-28 envelope are rejected.
   */
  async startHTTP({ url, httpPath, req, res, options }: MCPServerHTTPOptions): Promise<void> {
    if (url.pathname !== httpPath) {
      res.writeHead(404);
      res.end();
      return;
    }
    if (options?.enableDnsRebindingProtection) {
      if (options.allowedHosts?.length) {
        const hostnames = options.allowedHosts.map(host => new URL(`http://${host}`).hostname);
        if (!hostHeaderValidation(hostnames)(req, res)) return;
      }
      if (options.allowedOrigins?.length) {
        const hostnames = options.allowedOrigins.map(origin => new URL(origin).hostname);
        if (!originValidation(hostnames)(req, res)) return;
      }
    }
    try {
      // Body-parsing middleware (express.json(), Fastify) leaves the stream consumed.
      const parsedBody = (req as http.IncomingMessage & { body?: unknown }).body;
      await this.getNodeHandler()(req, res, parsedBody);
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'MCP_SERVER_HTTP_CONNECTION_FAILED',
          domain: ErrorDomain.MCP,
          category: ErrorCategory.USER,
          text: 'Failed to handle MCP request',
        },
        error,
      );
      this.logger.trackException(mastraError);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null }),
        );
      }
    }
  }

  async close(): Promise<void> {
    if (this.stdioHandle) {
      await this.stdioHandle.close();
      this.stdioHandle = undefined;
      this.stdioInstance = undefined;
    }
    if (this.httpHandler) {
      await this.httpHandler.close();
      this.httpHandler = undefined;
      this.nodeHandler = undefined;
    }
  }

  // ---------------------------------------------------------------------------
  // Registry information

  getServerInfo(): ServerInfo {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      repository: this.repository,
      version_detail: { version: this.version, release_date: this.releaseDate, is_latest: this.isLatest },
    };
  }

  getServerDetail(): ServerDetailInfo {
    return {
      ...this.getServerInfo(),
      package_canonical: this.packageCanonical,
      packages: this.packages,
      remotes: this.remotes,
    };
  }

  getToolListInfo(requestContext?: RequestContext): { tools: MCPToolInfoV2[] } | Promise<{ tools: MCPToolInfoV2[] }> {
    const toInfo = (entries: Array<[string, CatalogueTool]>) => ({
      tools: entries.map(([name, tool]) => this.toolInfo(name, tool)),
    });
    if (this.mastra?.getServer?.()?.fga) {
      return requestContext ? this.authorizedToolEntries(requestContext).then(toInfo) : { tools: [] };
    }
    return toInfo(Object.entries(this.tools()));
  }

  getToolInfo(toolId: string): MCPToolInfoV2 | undefined {
    const tool = this.tool(toolId);
    return tool ? this.toolInfo(toolId, tool) : undefined;
  }

  /** Reads an `ui://` app resource; application resources require a protocol request. */
  async readResource(uri: string): Promise<{ contents: Array<{ uri: string; text?: string; blob?: string }> }> {
    const html = this.appResourceHtml.get(uri);
    if (html === undefined) {
      throw new MastraError({
        id: 'MCP_SERVER_RESOURCE_NOT_FOUND',
        domain: ErrorDomain.MCP,
        category: ErrorCategory.USER,
        text: `Resource '${uri}' not found; application resources are only readable through an MCP request`,
        details: { uri },
      });
    }
    return { contents: [{ uri, text: html }] };
  }

  /** Lists `ui://` app resources; application resources require a protocol request. */
  async listResources(): Promise<{ resources: Resource[] }> {
    return { resources: [...this.appResourceList] };
  }
}

function deriveTools(config: MCPServerConfig): { tools: MCPServerToolsV2; warnings: string[] } {
  const tools: MCPServerToolsV2 = {};
  const warnings: string[] = [];
  const taken = (name: string) => name in config.tools || name in tools;

  for (const [key, agent] of Object.entries(config.agents ?? {})) {
    const description = agent.getDescription();
    if (!description) {
      throw new Error(
        `Agent '${agent.name}' (key: '${key}') must have a non-empty description to be used in an MCPServer.`,
      );
    }
    const name = `ask_${key}`;
    if (taken(name)) {
      warnings.push(`Tool '${name}' already exists; agent '${key}' is not exposed.`);
      continue;
    }
    tools[name] = createTool({
      id: name,
      description: `Ask agent '${agent.name}' a question. Agent description: ${description}`,
      inputSchema: {
        type: 'object' as const,
        properties: { message: { type: 'string', description: 'The question or input for the agent.' } },
        required: ['message'],
        additionalProperties: false,
      },
      mcp: { toolType: 'agent' },
      execute: async (inputData, context) => {
        const { message } = inputData as { message: string };
        return agent.generate(message, {
          requestContext: context?.requestContext,
          tracingContext: context?.tracingContext,
          abortSignal: context?.abortSignal,
        });
      },
    });
  }

  for (const [key, workflow] of Object.entries(config.workflows ?? {})) {
    if (!workflow.description) {
      throw new Error(
        `Workflow '${workflow.id}' (key: '${key}') must have a non-empty description to be used in an MCPServer.`,
      );
    }
    const name = `run_${key}`;
    if (taken(name)) {
      warnings.push(`Tool '${name}' already exists; workflow '${key}' is not exposed.`);
      continue;
    }
    tools[name] = createTool({
      id: name,
      description: `Run workflow '${key}'. Workflow description: ${workflow.description}`,
      inputSchema: workflow.inputSchema,
      mcp: { toolType: 'workflow' },
      execute: async (inputData, context) => {
        const run = await workflow.createRun({ runId: context?.requestContext?.get('runId') });
        return run.start({
          inputData,
          requestContext: context?.requestContext,
          tracingContext: context?.tracingContext,
        });
      },
    });
  }

  return { tools, warnings };
}

function errorResult(text: string): CallToolResult {
  return { content: [{ type: 'text', text }], isError: true };
}

function isInputRequired<T>(value: T | MCPInputRequired): value is MCPInputRequired {
  return typeof value === 'object' && value !== null && 'kind' in value && value.kind === 'input_required';
}

/** Keeps `_meta.ui.resourceUri` and the flat MCP Apps key in sync for older hosts. */
function normalizeUiMeta(meta: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!meta) return undefined;
  const ui = meta.ui as { resourceUri?: string } | undefined;
  const flat = meta[RESOURCE_URI_META_KEY] as string | undefined;
  if (ui?.resourceUri && !flat) return { ...meta, [RESOURCE_URI_META_KEY]: ui.resourceUri };
  if (flat && !ui?.resourceUri) return { ...meta, ui: { ...(ui ?? {}), resourceUri: flat } };
  return meta;
}

export { ServerPromptActions, ServerResourceActions, ServerToolActions };
