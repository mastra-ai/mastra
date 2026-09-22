import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type * as http from 'node:http';
import type { Agent, ToolsInput } from '@mastra/core/agent';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { MCPServerBase } from '@mastra/core/mcp';
import type {
  MCPServerConfig as CoreMCPServerConfig,
  MCPServerFGAConfig,
  MCPToolExecutionResultV2,
  ServerDetailInfo,
  ServerInfo,
} from '@mastra/core/mcp';
import { EntityType, SpanType, getOrCreateSpan } from '@mastra/core/observability';
import type { Span, TracingContext } from '@mastra/core/observability';
import { RequestContext } from '@mastra/core/request-context';
import { isStandardSchemaWithJSON, standardSchemaToJSONSchema, toStandardSchema } from '@mastra/core/schema';
import type { StandardSchemaWithJSON } from '@mastra/core/schema';
import { createTool, isValidationError } from '@mastra/core/tools';
import type { InternalCoreTool, MCPToolExecutionContext, MCPToolType, ToolAction } from '@mastra/core/tools';
import { makeCoreTool } from '@mastra/core/utils';
import type { SuspendOptions, Workflow } from '@mastra/core/workflows';
import { PromptSchema } from '@modelcontextprotocol/core';
import { RESOURCE_MIME_TYPE, RESOURCE_URI_META_KEY } from '@modelcontextprotocol/ext-apps';
import { hostHeaderValidation, originValidation, toNodeHandler } from '@modelcontextprotocol/node';
import type { NodeMcpRequestHandler } from '@modelcontextprotocol/node';
import {
  CLIENT_INFO_META_KEY,
  PROTOCOL_VERSION_META_KEY,
  Server,
  ProtocolError,
  ProtocolErrorCode,
  createMcpHandler,
  createRequestStateCodec,
  inputRequired,
  specTypeSchemas,
} from '@modelcontextprotocol/server';
import type {
  BlobResourceContents,
  CallToolResult,
  HandlerResultTypeMap,
  Implementation,
  InputRequiredResult,
  McpHttpHandler,
  RequestMethod,
  RequestStateCodec,
  RequestTypeMap,
  Resource,
  ServerCapabilities,
  ServerContext,
  ServerNotifier,
  TextResourceContents,
  Tool as MCPTool,
  jsonSchemaValidator,
} from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import type { StdioServerHandle } from '@modelcontextprotocol/server/stdio';

import { withMastraToolStrictMeta } from '../shared/mastra-tool-meta';
import { ServerPromptActions, ServerResourceActions, ServerToolActions } from './actions';
import {
  INPUT_KEY,
  hashArguments,
  principalOf,
  readContinuation,
  toRequestContext,
  toToolExecutionContext,
} from './request';
import type { ContinuationEnvelope } from './request';
import type {
  AppResources,
  MCPAuthInfoToUserMapper,
  MCPServerCacheHints,
  MCPServerHTTPRequestOptions,
  MCPServerPrompts,
  MCPServerRequest,
  MCPServerRequestStateOptions,
  MCPServerResources,
} from './types';

export interface MCPServerConfig extends CoreMCPServerConfig {
  resources?: MCPServerResources;
  prompts?: MCPServerPrompts;
  /** MCP Apps (SEP-1865) HTML resources served under `ui://`. */
  appResources?: AppResources;
  /** Custom JSON Schema validator, for runtimes where the SDK default is unavailable. */
  jsonSchemaValidator?: jsonSchemaValidator;
  cacheHints?: MCPServerCacheHints;
  /** Integrity protection for `input_required` continuation state. */
  requestState?: MCPServerRequestStateOptions;
}

export interface MCPServerHTTPOptions {
  url: URL;
  httpPath: string;
  req: http.IncomingMessage;
  res: http.ServerResponse<http.IncomingMessage>;
  options?: MCPServerHTTPRequestOptions;
}

/** The JSON Schema form a suspended handler asks the client to fill in. */
type JSONSchema7 = NonNullable<Extract<MCPToolExecutionResultV2, { status: 'suspended' }>['resumeSchema']>;

const EMPTY_OBJECT_SCHEMA = { type: 'object', properties: {} } as const;

/** Tool description served over Mastra's REST routes; `id` is what Studio keys tools by. */
type ToolInfo = {
  id: string;
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  toolType?: MCPToolType;
  _meta?: Record<string, unknown>;
};

/** Where a suspended handler is resumed from and what the client is asked. */
interface Suspension {
  method: ContinuationEnvelope['method'];
  name: string;
  argsHash: string;
  round: number;
  suspendPayload: unknown;
  resumeSchema: JSONSchema7 | undefined;
}

/**
 * Exposes Mastra tools, agents, workflows, resources and prompts to Model Context
 * Protocol (MCP) clients using protocol revision 2026-07-28: self-contained requests
 * over Streamable HTTP or stdio, native `input_required` continuation and
 * per-request logging.
 *
 * @example
 * `yourTool` is a tool you have already configured.
 * ```typescript
 * import { MCPServer } from '@mastra/mcp';
 *
 * const server = new MCPServer({
 *   id: 'my-server',
 *   name: 'My Server',
 *   version: '1.0.0',
 *   tools: { yourTool },
 * });
 * await server.startStdio();
 * ```
 *
 * @see For documentation bundled with your installed package, locate
 * `@mastra/mcp/package.json` with your project's resolver or package-manager
 * tooling, then read `dist/docs/SKILL.md` from that package root and follow its
 * reference links. Use package-manager tools for virtual or archived packages.
 *
 * @see [MCP server documentation](https://mastra.ai/reference/tools/mcp-server)
 * if packaged docs are unavailable.
 */
export class MCPServer extends MCPServerBase {
  override readonly mcpVersion = 2 as const;

  readonly resources: ServerResourceActions;
  readonly prompts: ServerPromptActions;
  readonly toolActions: ServerToolActions;

  private readonly resourceOptions?: MCPServerResources;
  private readonly promptOptions?: MCPServerPrompts;
  private readonly appResourceList: Resource[] = [];
  private readonly appResourceHtml = new Map<string, string>();
  private readonly jsonSchemaValidator?: jsonSchemaValidator;
  private readonly cacheHints?: MCPServerCacheHints;
  private readonly mapAuthInfoToUser?: MCPAuthInfoToUserMapper;
  private readonly fga?: MCPServerFGAConfig;
  private readonly requestStateCodec: RequestStateCodec<ContinuationEnvelope>;

  private httpHandler?: McpHttpHandler;
  private nodeHandler?: NodeMcpRequestHandler;
  private stdioHandle?: StdioServerHandle;
  private stdioInstance?: Server;

  constructor(config: MCPServerConfig) {
    super(config);
    this.jsonSchemaValidator = config.jsonSchemaValidator;
    this.cacheHints = config.cacheHints;
    this.mapAuthInfoToUser = config.mapAuthInfoToUser;
    this.fga = config.fga;
    this.promptOptions = config.prompts;
    this.resourceOptions = config.resources;
    this.loadAppResources(config.appResources);
    this.requestStateCodec = this.createRequestStateCodec(config.requestState);
    if (config.resources?.resumeSchema) this.assertFormRepresentable('resources', config.resources.resumeSchema);
    if (config.prompts?.resumeSchema) this.assertFormRepresentable('prompts', config.prompts.resumeSchema);

    const deps = { getLogger: () => this.logger, getNotifier: () => this.notifier() };
    this.toolActions = new ServerToolActions({
      ...deps,
      addTools: tools => this.addTools(tools),
      removeTools: keys => this.removeTools(keys),
    });
    this.resources = new ServerResourceActions(deps);
    this.prompts = new ServerPromptActions(deps);
  }

  private createRequestStateCodec(options: MCPServerRequestStateOptions | undefined) {
    let key = options?.key;
    if (key === undefined) {
      key = randomBytes(32);
      this.logger.warn(
        'No requestState.key configured: continuation state is signed with a per-process key, so a suspended request can only be resumed on this process. Set requestState.key in multi-instance and serverless deployments.',
      );
    }
    return createRequestStateCodec<ContinuationEnvelope>({ key, ttlSeconds: options?.ttlSeconds });
  }

  // ---------------------------------------------------------------------------
  // Catalogue

  convertTools(
    tools: ToolsInput,
    agents?: Record<string, Agent>,
    workflows?: Record<string, Workflow>,
  ): Record<string, InternalCoreTool> {
    const converted: Record<string, InternalCoreTool> = {};
    const convert = (name: string, tool: NonNullable<ToolsInput[string]>) => {
      const coreTool = makeCoreTool(tool, {
        name,
        requestContext: new RequestContext(),
        tracingContext: {},
        mastra: this.mastra,
        logger: this.logger,
        description: 'description' in tool ? tool.description : undefined,
      }) as InternalCoreTool;
      converted[name] = { ...coreTool, id: name } as InternalCoreTool;
    };

    for (const [name, tool] of Object.entries(tools)) {
      if (!tool || !('execute' in tool) || typeof tool.execute !== 'function') {
        this.logger.warn('Tool has no execute function, skipping', { tool: name });
        continue;
      }
      if ('resumeSchema' in tool && tool.resumeSchema)
        this.assertFormRepresentable(`tool '${name}'`, tool.resumeSchema);
      convert(name, tool);
    }

    for (const [key, agent] of Object.entries(agents ?? {})) {
      const description = agent.getDescription();
      if (!description) {
        throw new MastraError({
          id: 'MCP_SERVER_AGENT_OR_WORKFLOW_TOOL_CONVERSION_FAILED',
          domain: ErrorDomain.MCP,
          category: ErrorCategory.USER,
          text: `Agent '${agent.name}' (key: '${key}') must have a non-empty description to be used in an MCPServer.`,
        });
      }
      const name = `ask_${key}`;
      if (converted[name]) {
        this.logger.warn(`Tool '${name}' already exists; agent '${key}' is not exposed.`);
        continue;
      }
      convert(
        name,
        createTool({
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
        }),
      );
    }

    for (const [key, workflow] of Object.entries(workflows ?? {})) {
      if (!workflow.description) {
        throw new MastraError({
          id: 'MCP_SERVER_AGENT_OR_WORKFLOW_TOOL_CONVERSION_FAILED',
          domain: ErrorDomain.MCP,
          category: ErrorCategory.USER,
          text: `Workflow '${workflow.id}' (key: '${key}') must have a non-empty description to be used in an MCPServer.`,
        });
      }
      const name = `run_${key}`;
      if (converted[name]) {
        this.logger.warn(`Tool '${name}' already exists; workflow '${key}' is not exposed.`);
        continue;
      }
      convert(
        name,
        createTool({
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
        }),
      );
    }

    this.logger.info(`${Object.keys(converted).length} tools registered`);
    return converted;
  }

  /**
   * A suspended handler's `resumeSchema` becomes the form the client fills in, and
   * the protocol only allows a flat object of primitives there. Checked at registration
   * so a tool cannot suspend into a request no client can answer.
   */
  private assertFormRepresentable(owner: string, resumeSchema: unknown): void {
    const requestedSchema = this.formSchema(resumeSchema);
    const validation = specTypeSchemas.ElicitRequestFormParams['~standard'].validate({
      message: owner,
      requestedSchema,
    });
    if (validation instanceof Promise || validation.issues) {
      throw new MastraError({
        id: 'MCP_SERVER_RESUME_SCHEMA_NOT_REPRESENTABLE',
        domain: ErrorDomain.MCP,
        category: ErrorCategory.USER,
        text: `The resumeSchema of ${owner} cannot be presented as an input request: it must be an object whose properties are strings, numbers, booleans or enums.`,
        details: { owner, issues: JSON.stringify(validation instanceof Promise ? 'async' : validation.issues) },
      });
    }
  }

  /**
   * Input-request forms are a restricted flat-object subset of JSON Schema, so
   * the dialect declaration is left off the requested schema.
   */
  private formSchema(resumeSchema: unknown): Record<string, unknown> {
    const schema = isStandardSchemaWithJSON(resumeSchema)
      ? resumeSchema
      : toStandardSchema(resumeSchema as Parameters<typeof toStandardSchema>[0]);
    const { $schema: _dialect, ...form } = this.jsonSchema(schema, { io: 'input' }) ?? {};
    return Object.keys(form).length ? form : { type: 'object', properties: {} };
  }

  /**
   * Converts a tool schema to JSON Schema 2020-12, the dialect MCP 2026-07-28
   * assumes when none is declared. The dialect declaration is kept so validators
   * that dispatch on `$schema` pick the same draft on both sides.
   */
  private jsonSchema(schema: unknown, options?: { io: 'input' | 'output' }): Record<string, unknown> | undefined {
    if (!schema) return undefined;
    return isStandardSchemaWithJSON(schema)
      ? (standardSchemaToJSONSchema(schema, { ...options, target: 'draft-2020-12' }) as Record<string, unknown>)
      : ((schema as { jsonSchema?: Record<string, unknown> }).jsonSchema ?? (schema as Record<string, unknown>));
  }

  private addTools(tools: ToolsInput): void {
    const converted = this.convertTools(tools);
    for (const key of Object.keys(converted)) {
      if (this.convertedTools[key]) this.logger.warn(`Tool '${key}' already exists and will be replaced.`);
    }
    this.convertedTools = { ...this.convertedTools, ...converted };
    this.originalTools = { ...this.originalTools, ...tools };
    if (this.mastra) {
      for (const [key, tool] of Object.entries(tools)) {
        if (isRegistrableTool(tool)) this.mastra.addTool(tool, this.mastraToolKey(key, tool));
      }
    }
  }

  private removeTools(toolIds: string[]): string[] {
    const removed: string[] = [];
    const convertedTools = { ...this.convertedTools };
    const originalTools = { ...this.originalTools };
    for (const toolId of toolIds) {
      if (!convertedTools[toolId]) {
        this.logger.warn(`Cannot remove tool '${toolId}': tool not found.`);
        continue;
      }
      const original = originalTools[toolId];
      delete convertedTools[toolId];
      delete originalTools[toolId];
      removed.push(toolId);
      if (this.mastra && original && typeof original === 'object' && 'id' in original) {
        this.mastra.removeTool(this.mastraToolKey(toolId, original));
      }
    }
    this.convertedTools = convertedTools;
    this.originalTools = originalTools;
    return removed;
  }

  /** Mirrors `__registerMastra`: the tool's intrinsic id when it has one, else its key. */
  private mastraToolKey(key: string, tool: NonNullable<ToolsInput[string]>): string {
    return 'id' in tool && typeof tool.id === 'string' ? tool.id : key;
  }

  /** Schema-less tools advertise an open empty object rather than the default validator schema. */
  private hasInputSchema(name: string): boolean {
    const original = this.originalTools[name];
    return !original || !('inputSchema' in original) || original.inputSchema !== undefined;
  }

  private resumeSchemaOf(name: string): JSONSchema7 | undefined {
    const original = this.originalTools[name];
    if (!original || !('resumeSchema' in original) || !original.resumeSchema) return undefined;
    return this.formSchema(original.resumeSchema);
  }

  /**
   * Prefers the tool's own schema over the converted core tool's, which has
   * already been lowered to draft-07, so 2020-12 shapes survive advertisement.
   */
  private advertisedSchema(name: string, field: 'inputSchema' | 'outputSchema', converted: unknown) {
    const original = this.originalTools[name];
    const own = original && field in original ? (original as Record<string, unknown>)[field] : undefined;
    return this.jsonSchema(isStandardSchemaWithJSON(own) ? own : converted, {
      io: field === 'inputSchema' ? 'input' : 'output',
    });
  }

  private toolInfo(name: string, tool: InternalCoreTool): ToolInfo {
    return {
      id: name,
      name,
      description: tool.description,
      inputSchema: this.hasInputSchema(name)
        ? (this.advertisedSchema(name, 'inputSchema', tool.parameters) ?? EMPTY_OBJECT_SCHEMA)
        : EMPTY_OBJECT_SCHEMA,
      outputSchema: this.advertisedSchema(name, 'outputSchema', tool.outputSchema),
      toolType: tool.mcp?.toolType,
      _meta: withMastraToolStrictMeta(tool.mcp?._meta, tool.strict),
    };
  }

  /** Builds the wire tool description, validated against the spec schema. */
  private toMCPTool(name: string, tool: InternalCoreTool): MCPTool {
    const info = this.toolInfo(name, tool);
    const validation = specTypeSchemas.Tool['~standard'].validate({
      name,
      description: info.description,
      inputSchema: info.inputSchema,
      outputSchema: info.outputSchema,
      annotations: tool.mcp?.annotations,
      _meta: normalizeUiMeta(info._meta),
    });
    if (validation instanceof Promise || validation.issues) {
      throw new Error(`Tool '${name}' does not describe a valid MCP tool (input schemas must be objects)`);
    }
    return validation.value;
  }

  private hasUiMetadata(): boolean {
    return Object.values(this.convertedTools).some(tool => {
      const meta = tool.mcp?._meta as { ui?: { resourceUri?: string } } | undefined;
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
        // Continuation state is verified before any handler runs; a tampered,
        // expired or foreign envelope answers the round with -32602.
        requestState: { verify: this.requestStateCodec.verify },
      },
    );
    // Deprecated session-level log control (SEP-2577): not served.
    server.removeRequestHandler('logging/setLevel');
    this.registerToolHandlers(server);
    this.registerResourceHandlers(server);
    this.registerPromptHandlers(server);
    return server;
  }

  /**
   * Registers `method` under an `MCP_SERVER_REQUEST` span, so every request the
   * server answers is recorded — including the list and read methods that never
   * reach a tool, and requests that fail before any work is done.
   */
  private setTracedHandler<M extends RequestMethod>(
    server: Server,
    method: M,
    handler: (
      request: RequestTypeMap[M],
      ctx: ServerContext,
      trace: {
        requestSpan: Span<SpanType.MCP_SERVER_REQUEST> | undefined;
        /** Resolved once per request, before the span, and shared with the handler. */
        requestContext: RequestContext;
        /**
         * Records the error behind an `isError` result. A handler that turns a
         * caught error into an error result reports it here so the span carries
         * the original error rather than its serialized text.
         */
        reportError: (error: Error) => void;
      },
    ) => Promise<HandlerResultTypeMap[M]>,
  ): void {
    server.setRequestHandler(method, async (request, ctx) => {
      const params = request.params as Record<string, unknown> | undefined;
      // A span can only be given its request context when it is created, so auth is
      // resolved first. A mapper that throws still leaves a failed span behind.
      let requestContext: RequestContext;
      try {
        requestContext = await toRequestContext(ctx, this.mapAuthInfoToUser);
      } catch (error) {
        this.startRequestSpan(method, params, { server, ctx })?.error({ error: error as Error });
        throw error;
      }
      const requestSpan = this.startRequestSpan(method, params, { server, ctx, requestContext });
      let reportedError: Error | undefined;
      return this.traceRequest(
        requestSpan,
        () =>
          handler(request, ctx, {
            requestSpan,
            requestContext,
            reportError: error => {
              reportedError = error;
            },
          }),
        () => reportedError,
      );
    });
  }

  /**
   * Opens the span for one served request. `connection` is absent for
   * {@link executeTool}, which is called in-process and negotiates nothing.
   */
  private startRequestSpan(
    method: string,
    params: Record<string, unknown> | undefined,
    connection?: { server?: Server; ctx?: ServerContext; requestContext?: RequestContext },
  ): Span<SpanType.MCP_SERVER_REQUEST> | undefined {
    // A stateless HTTP request carries its own envelope; a stdio connection
    // negotiates once and the instance holds what it agreed to.
    const envelope = connection?.ctx?.mcpReq.envelope as Record<string, unknown> | undefined;
    const protocolVersion = envelope?.[PROTOCOL_VERSION_META_KEY] ?? connection?.server?.getNegotiatedProtocolVersion();
    const client = (envelope?.[CLIENT_INFO_META_KEY] ?? connection?.server?.getClientVersion()) as
      | Implementation
      | undefined;
    const target = params?.name ?? params?.uri;
    const targetName = typeof target === 'string' ? target : undefined;

    return getOrCreateSpan({
      type: SpanType.MCP_SERVER_REQUEST,
      name: targetName ? `${method} ${targetName}` : method,
      entityType: EntityType.MCP_SERVER,
      entityId: this.id,
      entityName: this.name,
      input: params,
      attributes: {
        mcpMethod: method,
        targetName,
        mcpServer: this.name,
        serverVersion: this.version,
        mcpProtocolVersion: typeof protocolVersion === 'string' ? protocolVersion : undefined,
        clientName: client?.name,
        clientVersion: client?.version,
      },
      tracingContext: {},
      requestContext: connection?.requestContext,
      mastra: this.mastra,
    });
  }

  /**
   * Runs `fn` under a request span. Only the protocol's own `isError` marks a
   * failure; the rest of a result is opaque handler output that may legitimately
   * carry any field. A thrown error ends the whole span tree and is rethrown.
   */
  private async traceRequest<T>(
    requestSpan: Span<SpanType.MCP_SERVER_REQUEST> | undefined,
    fn: () => Promise<T>,
    getReportedError?: () => Error | undefined,
  ): Promise<T> {
    try {
      const result = await fn();
      const errorResult = result as { isError?: boolean; content?: Array<{ text?: string }> } | undefined;
      if (errorResult?.isError) {
        requestSpan?.error({
          error:
            getReportedError?.() ??
            new MastraError({
              id: 'MCP_SERVER_REQUEST_FAILED',
              domain: ErrorDomain.MCP,
              category: ErrorCategory.USER,
              text: errorResult.content
                ?.map(c => c.text)
                .filter(Boolean)
                .join('\n'),
            }),
        });
      } else {
        requestSpan?.end({ output: result });
      }
      return result;
    } catch (error) {
      requestSpan?.error({ error: error as Error, endTree: true });
      throw error;
    }
  }

  /** Answers a suspended round: one keyed form derived from the handler's `resumeSchema`. */
  private async inputRequired(
    ctx: ServerContext,
    requestContext: RequestContext,
    suspension: Suspension,
  ): Promise<InputRequiredResult> {
    const payload = suspension.suspendPayload as { message?: unknown } | undefined;
    const message =
      typeof payload?.message === 'string'
        ? payload.message
        : typeof suspension.resumeSchema?.description === 'string'
          ? suspension.resumeSchema.description
          : `"${suspension.name}" needs more input`;
    const { method, name, argsHash, round, suspendPayload } = suspension;
    return inputRequired({
      inputRequests: {
        [INPUT_KEY]: inputRequired.elicit({
          message,
          requestedSchema: (suspension.resumeSchema ?? { type: 'object', properties: {} }) as never,
        }),
      },
      requestState: await this.requestStateCodec.mint({
        method,
        name,
        argsHash,
        round,
        suspendPayload,
        principal: principalOf(ctx, requestContext),
        iat: Math.floor(Date.now() / 1000),
      }),
    });
  }

  private async serverRequest(
    ctx: ServerContext,
    requestContext: RequestContext,
    method: ContinuationEnvelope['method'],
    name: string,
    args: unknown,
    resumeSchema: StandardSchemaWithJSON | undefined,
  ): Promise<{
    request: MCPServerRequest;
    continuation: ReturnType<typeof readContinuation>;
    suspended: () => { payload: unknown } | undefined;
    argsHash: string;
  }> {
    const argsHash = hashArguments(args);
    const continuation = readContinuation(ctx, requestContext, { method, name, argsHash });
    if (continuation?.outcome === 'accept' && resumeSchema) {
      const validation = await resumeSchema['~standard'].validate(continuation.resumeData);
      if (validation.issues) {
        throw new ProtocolError(
          ProtocolErrorCode.InvalidParams,
          `Input response for ${method} "${name}" does not match its resumeSchema: ${validation.issues.map(issue => issue.message).join('; ')}`,
        );
      }
      continuation.resumeData = validation.value;
    }
    let suspension: { payload: unknown } | undefined;
    const request: MCPServerRequest = {
      extra: toToolExecutionContext(ctx, this.name).extra,
      requestContext,
      suspend: async payload => void (suspension = { payload }),
      resumeData: continuation?.resumeData,
      suspendPayload: continuation?.suspendPayload,
    };
    return { request, continuation, suspended: () => suspension, argsHash };
  }

  private registerToolHandlers(server: Server): void {
    this.setTracedHandler(server, 'tools/list', async (_request, _ctx, trace) => {
      const entries = await this.authorizedToolEntries(trace.requestContext);
      return { tools: entries.map(([name, tool]) => this.toMCPTool(name, tool)) };
    });

    this.setTracedHandler(server, 'tools/call', async (request, ctx, trace) => {
      const name = request.params.name;
      const tool = this.convertedTools[name];
      if (!tool) {
        this.logger.warn('Unknown tool requested', { tool: name });
        return errorResult(`Unknown tool: ${name}`);
      }
      const args = request.params.arguments ?? {};
      const argsHash = hashArguments(args);
      const requestContext = trace.requestContext;
      const continuation = readContinuation(ctx, requestContext, { method: 'tools/call', name, argsHash });
      const mcp = toToolExecutionContext(ctx, this.name);
      const startedAt = Date.now();
      try {
        // Every round is authorized on its own; nothing is trusted from the envelope.
        await this.enforceToolExecutionFGA(name, requestContext);
        if (continuation && continuation.outcome !== 'accept') {
          return errorResult(`Tool '${name}' was ${continuation.outcome === 'decline' ? 'declined' : 'cancelled'}`);
        }
        const execution = await this.runTool(name, tool, args, {
          requestContext,
          mcp,
          tracingContext: { currentSpan: trace.requestSpan },
          resumeData: continuation?.resumeData,
          suspendPayload: continuation?.suspendPayload,
        });
        if (execution.status === 'suspended') {
          this.logger.debug(`Tool '${name}' requires client input.`);
          return this.inputRequired(ctx, requestContext, {
            method: 'tools/call',
            name,
            argsHash,
            round: (continuation?.round ?? 0) + 1,
            suspendPayload: execution.suspendPayload,
            resumeSchema: execution.resumeSchema,
          });
        }
        const result = this.toCallToolResult(name, tool, execution.output);
        this.logger.info(`Tool '${name}' finished in ${Date.now() - startedAt}ms.`);
        return result;
      } catch (error) {
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
        // The client still receives the serialized error, but the span keeps the
        // original so its id and message survive instead of a JSON blob.
        trace.reportError(mastraError);
        return errorResult(JSON.stringify(mastraError.toJSON()));
      }
    });
  }

  /**
   * Runs one round of a tool. The tool sees the same `suspend` / `resumeData` /
   * `suspendPayload` vocabulary as under an agent or workflow; nothing else is
   * carried between rounds.
   */
  private async runTool(
    name: string,
    tool: InternalCoreTool,
    args: unknown,
    options: {
      requestContext?: RequestContext;
      mcp?: MCPToolExecutionContext;
      tracingContext?: TracingContext;
      resumeData?: unknown;
      suspendPayload?: unknown;
    },
  ): Promise<MCPToolExecutionResultV2> {
    if (!tool.execute) throw new Error(`Tool '${name}' cannot be executed.`);
    let suspension: { payload: unknown; resumeSchema?: string } | undefined;
    const output = await tool.execute(args, {
      // The 1.x idiom: an empty toolCallId keeps CoreToolBuilder on the MCP path.
      toolCallId: '',
      messages: [],
      // The request span already records this call; a builder tool span would double it.
      skipToolSpan: true,
      requestContext: options.requestContext,
      tracingContext: options.tracingContext,
      abortSignal: options.mcp?.extra.signal,
      ...(options.mcp ? { mcp: options.mcp } : {}),
      suspend: async (payload: unknown, suspendOptions?: SuspendOptions) => {
        suspension = { payload, resumeSchema: suspendOptions?.resumeSchema };
      },
      resumeData: options.resumeData,
      suspendPayload: options.suspendPayload,
    });
    if (suspension) {
      const { payload, resumeSchema } = suspension as { payload: unknown; resumeSchema?: string };
      // The core builder serializes the resume schema as draft-07 JSON; forms carry no dialect.
      const { $schema: _dialect, ...fromBuilder } = resumeSchema ? JSON.parse(resumeSchema) : {};
      return {
        status: 'suspended',
        suspendPayload: payload,
        resumeSchema: this.resumeSchemaOf(name) ?? (resumeSchema ? fromBuilder : undefined),
      };
    }
    return { status: 'completed', output };
  }

  private toCallToolResult(name: string, tool: InternalCoreTool, value: unknown): CallToolResult {
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
    // Tools with an output schema already validated `value` against it.
    const structuredContent = value as Record<string, unknown>;
    return { isError: false, structuredContent, content: [{ type: 'text', text: JSON.stringify(structuredContent) }] };
  }

  private registerResourceHandlers(server: Server): void {
    const options = this.resourceOptions;
    const hasAppResources = this.appResourceList.length > 0;
    if (!options && !hasAppResources) return;

    const listResources = async (ctx: ServerContext, requestContext: RequestContext): Promise<Resource[]> => [
      ...this.appResourceList,
      ...((await options?.listResources({
        extra: toToolExecutionContext(ctx, this.name).extra,
        requestContext,
      })) ?? []),
    ];

    // Providers are re-evaluated with the current request every time; resource
    // lists are scoped per caller and never cached on the shared server.
    this.setTracedHandler(server, 'resources/list', async (_request, ctx, trace) => ({
      resources: await listResources(ctx, trace.requestContext),
    }));

    this.setTracedHandler(server, 'resources/read', async (request, ctx, trace) => {
      const uri = request.params.uri;
      const resource = (await listResources(ctx, trace.requestContext)).find(r => r.uri === uri);
      if (!resource) throw new ProtocolError(ProtocolErrorCode.InvalidParams, `Resource not found: ${uri}`);

      const html = this.appResourceHtml.get(uri);
      if (html !== undefined) return { contents: [this.resourceContents(resource, { text: html })] };
      if (!options) throw new ProtocolError(ProtocolErrorCode.InvalidParams, `Resource not found: ${uri}`);

      const {
        request: serverRequest,
        continuation,
        suspended,
        argsHash,
      } = await this.serverRequest(ctx, trace.requestContext, 'resources/read', uri, {}, options.resumeSchema);
      if (continuation && continuation.outcome !== 'accept') {
        throw new ProtocolError(ProtocolErrorCode.InvalidParams, `Reading '${uri}' was ${continuation.outcome}ed`);
      }
      const result = await options.getResourceContent({ uri, ...serverRequest });
      const suspension = suspended();
      if (suspension) {
        return this.inputRequired(ctx, serverRequest.requestContext, {
          method: 'resources/read',
          name: uri,
          argsHash,
          round: (continuation?.round ?? 0) + 1,
          suspendPayload: suspension.payload,
          resumeSchema: options.resumeSchema ? this.formSchema(options.resumeSchema) : undefined,
        });
      }
      if (result === undefined) throw new Error(`Resource '${uri}' returned no content`);
      const contents = (Array.isArray(result) ? result : [result]).map(content =>
        this.resourceContents(resource, content),
      );
      return { contents };
    });

    if (options?.resourceTemplates) {
      this.setTracedHandler(server, 'resources/templates/list', async (_request, ctx, trace) => ({
        resourceTemplates: await options.resourceTemplates!({
          extra: toToolExecutionContext(ctx, this.name).extra,
          requestContext: trace.requestContext,
        }),
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

    const listPrompts = async (ctx: ServerContext, requestContext: RequestContext) => {
      const prompts = await options.listPrompts({
        extra: toToolExecutionContext(ctx, this.name).extra,
        requestContext,
      });
      for (const prompt of prompts) PromptSchema.parse(prompt);
      return prompts;
    };

    this.setTracedHandler(server, 'prompts/list', async (_request, ctx, trace) => ({
      prompts: await listPrompts(ctx, trace.requestContext),
    }));

    if (!options.getPromptMessages) return;
    this.setTracedHandler(server, 'prompts/get', async (request, ctx, trace) => {
      const { name, arguments: args } = request.params;
      const prompt = (await listPrompts(ctx, trace.requestContext)).find(p => p.name === name);
      if (!prompt) throw new ProtocolError(ProtocolErrorCode.InvalidParams, `Prompt "${name}" not found`);
      for (const arg of prompt.arguments ?? []) {
        if (arg.required && (args?.[arg.name] === undefined || args?.[arg.name] === null)) {
          throw new ProtocolError(ProtocolErrorCode.InvalidParams, `Missing required argument: ${arg.name}`);
        }
      }
      const {
        request: serverRequest,
        continuation,
        suspended,
        argsHash,
      } = await this.serverRequest(ctx, trace.requestContext, 'prompts/get', name, args ?? {}, options.resumeSchema);
      if (continuation && continuation.outcome !== 'accept') {
        throw new ProtocolError(ProtocolErrorCode.InvalidParams, `Prompt "${name}" was ${continuation.outcome}ed`);
      }
      const messages = await options.getPromptMessages!({ name, args, ...serverRequest });
      const suspension = suspended();
      if (suspension) {
        return this.inputRequired(ctx, serverRequest.requestContext, {
          method: 'prompts/get',
          name,
          argsHash,
          round: (continuation?.round ?? 0) + 1,
          suspendPayload: suspension.payload,
          resumeSchema: options.resumeSchema ? this.formSchema(options.resumeSchema) : undefined,
        });
      }
      if (messages === undefined) throw new Error(`Prompt "${name}" returned no messages`);
      return { description: prompt.description, messages };
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

  private async authorizedToolEntries(requestContext: RequestContext): Promise<Array<[string, InternalCoreTool]>> {
    const entries = Object.entries(this.convertedTools);
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
    return accessible.filter((entry): entry is [string, InternalCoreTool] => entry !== undefined);
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
  // Registry information and direct execution

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

  getToolListInfo(requestContext?: RequestContext): { tools: ToolInfo[] } | Promise<{ tools: ToolInfo[] }> {
    const toInfo = (entries: Array<[string, InternalCoreTool]>) => ({
      tools: entries.map(([name, tool]) => this.toolInfo(name, tool)),
    });
    if (this.mastra?.getServer?.()?.fga) {
      return requestContext ? this.authorizedToolEntries(requestContext).then(toInfo) : { tools: [] };
    }
    return toInfo(Object.entries(this.convertedTools));
  }

  getToolInfo(toolId: string): ToolInfo | undefined {
    const tool = this.convertedTools[toolId];
    return tool ? this.toolInfo(toolId, tool) : undefined;
  }

  /**
   * Runs a tool without a protocol client (the Studio/REST route). A tool that
   * suspends is reported as such; the caller continues by sending the same
   * arguments with `resumeData` and `suspendPayload`.
   */
  async executeTool(
    toolId: string,
    args: unknown,
    executionContext: Parameters<MCPServerBase['executeTool']>[2] = {},
  ): Promise<MCPToolExecutionResultV2> {
    const requestContext = executionContext.requestContext ?? new RequestContext();
    // The in-process caller gets the same request span a wire `tools/call` opens.
    // It is opened before the tool lookup and the authorization check so an
    // unknown tool or a denial is recorded as a failed request, not lost.
    const requestSpan = this.startRequestSpan('tools/call', { name: toolId, arguments: args }, { requestContext });
    return this.traceRequest(requestSpan, async () => {
      const tool = this.convertedTools[toolId];
      if (!tool) {
        this.logger.warn('Unknown tool requested', { tool: toolId, server: this.name });
        throw new MastraError({
          id: 'MCP_SERVER_TOOL_EXECUTE_PREPARATION_FAILED',
          domain: ErrorDomain.MCP,
          category: ErrorCategory.USER,
          text: `Unknown tool: ${toolId}`,
          details: { toolId },
        });
      }
      // A denial is reported as such, not as a failed execution.
      await this.enforceToolExecutionFGA(toolId, requestContext);
      try {
        const execution = await this.runTool(toolId, tool, args, {
          requestContext,
          tracingContext: { currentSpan: requestSpan },
          resumeData: executionContext.resumeData,
          suspendPayload: executionContext.suspendPayload,
        });
        // Invalid input or resume data is the caller's error, not a completed call.
        if (execution.status === 'completed' && isValidationError(execution.output)) {
          throw new MastraError({
            id: 'MCP_SERVER_TOOL_INVALID_INPUT',
            domain: ErrorDomain.MCP,
            category: ErrorCategory.USER,
            text: execution.output.message,
            details: { toolId },
          });
        }
        this.logger.info('Tool executed successfully', { tool: toolId });
        return execution;
      } catch (error) {
        if (error instanceof MastraError && error.id === 'MCP_SERVER_TOOL_INVALID_INPUT') throw error;
        const mastraError = new MastraError(
          {
            id: 'MCP_SERVER_TOOL_EXECUTE_FAILED',
            domain: ErrorDomain.MCP,
            category: ErrorCategory.USER,
            details: { toolId, args: JSON.stringify(args) },
          },
          error,
        );
        this.logger.trackException(mastraError);
        throw mastraError;
      }
    });
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

/** Tools with an intrinsic id are also registered on the Mastra instance, like `__registerMastra` does. */
function isRegistrableTool(tool: ToolsInput[string]): tool is ToolAction<any, any, any, any> {
  return !!tool && typeof tool === 'object' && 'id' in tool && typeof tool.id === 'string';
}

function errorResult(text: string): CallToolResult {
  return { content: [{ type: 'text', text }], isError: true };
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
