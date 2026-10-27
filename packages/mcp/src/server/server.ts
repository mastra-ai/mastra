import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type * as http from 'node:http';
import type { Agent, ToolsInput } from '@mastra/core/agent';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { MCPServerBase } from '@mastra/core/mcp';
import type {
  MCPServerConfig as CoreMCPServerConfig,
  MCPServerEventInfo,
  MCPServerEventsInspector,
  MCPServerFGAConfig,
  MCPToolExecutionResultV2,
  ServerDetailInfo,
  ServerInfo,
} from '@mastra/core/mcp';
import { EntityType, SpanType, getOrCreateSpan } from '@mastra/core/observability';
import type { Span, TracingContext } from '@mastra/core/observability';
import { MASTRA_AUTH_TOKEN_KEY, RequestContext } from '@mastra/core/request-context';
import { isStandardSchemaWithJSON, standardSchemaToJSONSchema, toStandardSchema } from '@mastra/core/schema';
import type { StandardSchemaWithJSON } from '@mastra/core/schema';
import { createTool, isValidationError, validateToolInput } from '@mastra/core/tools';
import type { InternalCoreTool, MCPToolExecutionContext, MCPToolType, ToolAction } from '@mastra/core/tools';
import { makeCoreTool } from '@mastra/core/utils';
import type { SuspendOptions, Workflow } from '@mastra/core/workflows';
import { PromptSchema } from '@modelcontextprotocol/core';
import { RESOURCE_MIME_TYPE, RESOURCE_URI_META_KEY } from '@modelcontextprotocol/ext-apps';
import { hostHeaderValidation, originValidation, toNodeHandler } from '@modelcontextprotocol/node';
import type { NodeMcpRequestHandler } from '@modelcontextprotocol/node';
import {
  CLIENT_CAPABILITIES_META_KEY,
  CLIENT_INFO_META_KEY,
  MissingRequiredClientCapabilityError,
  PROTOCOL_VERSION_META_KEY,
  Server,
  ProtocolError,
  ProtocolErrorCode,
  createMcpHandler,
  createRequestStateCodec,
  inputRequired,
  inputResponse,
  specTypeSchemas,
} from '@modelcontextprotocol/server';
import type {
  BlobResourceContents,
  CallToolResult,
  ClientCapabilities,
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

import { DEFAULT_EVENTS_HEARTBEAT_INTERVAL_MS, EVENTS_EXTENSION_ID } from '../shared/events';
import { JSON_SCHEMA_2020_12, toJsonSchema2020 } from '../shared/json-schema-dialect';
import { withMastraToolStrictMeta } from '../shared/mastra-tool-meta';
import { hasTasksCapability, tasksCapabilityEntry } from '../shared/tasks';
import type { MCPTask, MCPTaskInputRequests } from '../shared/tasks';
import { withServerTraceContext, withoutTraceContext } from '../shared/trace-context';
import type { CallerTraceContext } from '../shared/trace-context';
import { ServerPromptActions, ServerResourceActions, ServerToolActions } from './actions';
import { ServerEventActions } from './events/actions';
import { registerEventHandlers } from './events/handlers';
import { createEventsInspector, listEventsInfo } from './events/inspector';
import { ServerEventRegistry, toDescriptor } from './events/registry';
import type { MCPServerEventDefinition, MCPServerEventsOptions } from './events/types';
import { WebhookDispatcher } from './events/webhook-dispatcher';
import {
  INPUT_KEY,
  callerTrace,
  hashArguments,
  principalOf,
  readContinuation,
  toRequestContext,
  toToolExecutionContext,
} from './request';
import type { ContinuationEnvelope } from './request';
import { BackgroundTaskMCPTaskStore } from './tasks/background-store';
import { resolveTasksConfig, SelectingMCPTaskStore } from './tasks/config';
import type { MCPServerTasksOptions, ResolvedTasksConfig, ResolvedToolTaskMode } from './tasks/config';
import { emitTaskResults, taskHandleResult } from './tasks/emit';
import { registerTaskHandlers } from './tasks/handlers';
import { InMemoryMCPTaskStore } from './tasks/in-memory-store';
import type {
  MCPTaskAttempt,
  MCPTaskAttemptOutcome,
  MCPTaskCreateParams,
  MCPTaskRunOptions,
  MCPTaskStore,
  MCPTaskWork,
} from './tasks/store';
import {
  firstSuspendedStep,
  isFinalRunStatus,
  isStillSuspended,
  isWorkflowTaskContext,
  runErrorMessage,
  runSummary,
} from './tasks/workflow-runs';
import type { AnsweredSuspension, WorkflowRunView, WorkflowTaskContext } from './tasks/workflow-runs';
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
  /**
   * Event types served over the MCP Events extension (`events/list`, `events/poll`,
   * `events/stream`), keyed by event name. Declare each with `defineEvent()`.
   *
   * @experimental SEP-3415 is a draft; this API may change.
   */
  events?: Record<string, MCPServerEventDefinition>;
  /**
   * Server-wide settings for `events`.
   *
   * @experimental SEP-3415 is a draft; this API may change.
   */
  eventsOptions?: MCPServerEventsOptions;
  /**
   * Serves `tools/call` as MCP Tasks (`io.modelcontextprotocol/tasks`) for the tools you opt in: a
   * client that declared the extension gets a task handle and polls `tasks/get` for the result.
   * Other clients keep getting synchronous answers.
   *
   * @experimental SEP-2663 extension; API may change.
   */
  tasks?: MCPServerTasksOptions;
  /**
   * How requests from 2025-era clients (those that open with `initialize`) are served
   * over HTTP.
   *
   * - `'reject'` (default): they get the unsupported-protocol-version error.
   * - `'stateless'`: each one is answered by a fresh server instance without a session.
   *   `GET` and `DELETE` session operations get `405`. Features that need 2026-07-28
   *   (suspend/resume, `subscriptions/listen`, events) are not available to these clients.
   */
  legacy?: 'reject' | 'stateless';
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

interface RunToolOptions {
  requestContext?: RequestContext;
  mcp?: MCPToolExecutionContext;
  tracingContext?: TracingContext;
  /** Overrides the request's signal, for work that outlives the request. */
  abortSignal?: AbortSignal;
  resumeData?: unknown;
  suspendPayload?: unknown;
}

/**
 * What a tool task records at creation: everything its work needs to be rebuilt, and nothing tied to
 * the request that started it.
 */
type ToolTaskContext = {
  toolName: string;
  args: unknown;
  /** The caller's request context, minus the bearer token. */
  requestContext: Record<string, unknown>;
  /** The answered `input_required` round the creating `tools/call` carried, if any. */
  resume?: { resumeData: unknown; suspendPayload: unknown };
};

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
  /**
   * Publishes occurrences of the configured `events` to poll, push and (when
   * `eventsOptions.webhook` is set) webhook subscribers.
   *
   * @experimental SEP-3415 is a draft; this API may change.
   */
  readonly events: ServerEventActions;

  private readonly resourceOptions?: MCPServerResources;
  private readonly promptOptions?: MCPServerPrompts;
  private readonly appResourceList: Resource[] = [];
  private readonly appResourceHtml = new Map<string, string>();
  private readonly jsonSchemaValidator?: jsonSchemaValidator;
  private readonly cacheHints?: MCPServerCacheHints;
  private readonly mapAuthInfoToUser?: MCPAuthInfoToUserMapper;
  private readonly fga?: MCPServerFGAConfig;
  private readonly requestStateCodec: RequestStateCodec<ContinuationEnvelope>;
  private readonly eventRegistry: ServerEventRegistry;
  private readonly eventsOptions: MCPServerEventsOptions;
  private eventsInspector: MCPServerEventsInspector | undefined;
  private readonly webhooks?: WebhookDispatcher;
  private readonly legacy: 'reject' | 'stateless';
  private readonly tasks: ResolvedTasksConfig;
  /** Where tasks are kept: `tasks.store`, or the store picked on first use. */
  private readonly taskStore: MCPTaskStore;
  /** Prepared on Mastra registration so its executors exist before the manager recovers rows. */
  private backgroundTaskStore?: BackgroundTaskMCPTaskStore;

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
    this.eventsOptions = config.eventsOptions ?? {};
    this.legacy = config.legacy ?? 'reject';
    this.tasks = resolveTasksConfig(config.tasks, {
      tools: Object.keys(config.tools ?? {}),
      workflows: Object.keys(config.workflows ?? {}),
      agents: Object.keys(config.agents ?? {}),
    });
    this.hasStableId = Boolean(config.id);
    this.taskStore = this.tasks.store ?? new SelectingMCPTaskStore(() => this.selectTaskStore());
    const webhook = this.eventsOptions.webhook;
    this.eventRegistry = new ServerEventRegistry(config.events, { webhook: webhook !== undefined });
    if (webhook && this.eventRegistry.size > 0) {
      this.webhooks = new WebhookDispatcher({
        registry: this.eventRegistry,
        options: webhook,
        getLogger: () => this.logger,
      });
    }
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
    this.events = new ServerEventActions(this.eventRegistry, () =>
      this.eventRegistry
        .list()
        .map(event => toDescriptor(event, (schema, options) => this.jsonSchema(schema, options))),
    );
  }

  private createRequestStateCodec(options: MCPServerRequestStateOptions | undefined) {
    let key = options?.key;
    if (key === undefined) {
      key = globalThis.crypto.getRandomValues(new Uint8Array(32));
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
    const validation = formValidation(owner, requestedSchema);
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

  /** The input-request form for `resumeSchema`, or `undefined` when the protocol can't present it. */
  private representableForm(resumeSchema: unknown): JSONSchema7 | undefined {
    const requestedSchema = resumeSchema ? this.formSchema(resumeSchema) : { type: 'object', properties: {} };
    const validation = formValidation('form', requestedSchema);
    return validation instanceof Promise || validation.issues ? undefined : (requestedSchema as JSONSchema7);
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
   * that dispatch on `$schema` pick the same draft on both sides. Some vendors
   * (e.g. zod v3) emit 2019-09 for this target, so it is rewritten to 2020-12.
   */
  private jsonSchema(schema: unknown, options?: { io: 'input' | 'output' }): Record<string, unknown> | undefined {
    if (!schema) return undefined;
    if (!isStandardSchemaWithJSON(schema)) {
      return (schema as { jsonSchema?: Record<string, unknown> }).jsonSchema ?? (schema as Record<string, unknown>);
    }
    const converted = standardSchemaToJSONSchema(schema, { ...options, target: 'draft-2020-12' }) as Record<
      string,
      unknown
    >;
    if (!converted.$schema || converted.$schema === JSON_SCHEMA_2020_12) return converted;
    return toJsonSchema2020(converted) ?? converted;
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
      title: tool.title,
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
    return Object.values(this.convertedTools).some(tool => Boolean(uiResourceUri(tool.mcp?._meta)));
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
    if (this.eventRegistry.size > 0) {
      capabilities.extensions = { ...capabilities.extensions, [EVENTS_EXTENSION_ID]: this.eventsCapability() };
    }
    if (this.tasks.enabled) {
      capabilities.extensions = { ...capabilities.extensions, ...tasksCapabilityEntry() };
    }
    return capabilities;
  }

  /**
   * Settings advertised under `extensions["io.modelcontextprotocol/events"]`. `listChanged` is not
   * advertised: the SDK's `subscriptions/listen` drops the `eventsListChanged` filter, so
   * `notifications/events/list_changed` cannot be delivered.
   */
  private eventsCapability(): Record<string, never> {
    return {};
  }

  private createServerInstance(): Server {
    const server = new Server(
      {
        name: this.name,
        version: this.version,
        title: this.title,
        description: this.description,
        websiteUrl: this.websiteUrl,
        icons: this.icons,
      },
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
    if (this.eventRegistry.size > 0) {
      registerEventHandlers(server, {
        registry: this.eventRegistry,
        heartbeatIntervalMs: this.eventsOptions.heartbeatIntervalMs ?? DEFAULT_EVENTS_HEARTBEAT_INTERVAL_MS,
        listPageSize: this.eventsOptions.listPageSize,
        maxStreams: this.eventsOptions.maxStreams,
        webhooks: this.webhooks,
        getLogger: () => this.logger,
        jsonSchema: (schema, options) => this.jsonSchema(schema, options),
        trace: (instance, method, params, ctx, fn) => this.traceCustomRequest(instance, method, params, ctx, fn),
      });
    }
    if (this.tasks.enabled) {
      registerTaskHandlers(server, {
        store: this.taskStore,
        authorize: this.tasks.authorize,
        principal: principalOf,
        trace: (instance, method, params, ctx, fn) => this.traceCustomRequest(instance, method, params, ctx, fn),
      });
      // A tool handler can only return a CallToolResult; task handles are rewritten on the way out.
      const connect = server.connect.bind(server);
      server.connect = async transport => {
        emitTaskResults(transport);
        return connect(transport);
      };
    }
    return server;
  }

  /**
   * {@link setTracedHandler} for methods outside the spec's request map (the events
   * extension): the request runs under an `MCP_SERVER_REQUEST` span with its resolved
   * request context. A push stream's span lasts as long as the stream.
   */
  private async traceCustomRequest<T>(
    server: Server,
    method: string,
    params: Record<string, unknown>,
    ctx: ServerContext,
    fn: (requestContext: RequestContext) => Promise<T>,
  ): Promise<T> {
    const caller = callerTrace(ctx);
    let requestContext: RequestContext;
    try {
      requestContext = await toRequestContext(ctx, this.mapAuthInfoToUser);
    } catch (error) {
      this.startRequestSpan(method, params, { server, ctx, caller })?.error({ error: error as Error });
      throw error;
    }
    const requestSpan = this.startRequestSpan(method, params, { server, ctx, caller, requestContext });
    return this.traceRequest(requestSpan, () => fn(requestContext));
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
      const caller = callerTrace(ctx);
      // A span can only be given its request context when it is created, so auth is
      // resolved first. A mapper that throws still leaves a failed span behind.
      let requestContext: RequestContext;
      try {
        requestContext = await toRequestContext(ctx, this.mapAuthInfoToUser);
      } catch (error) {
        this.startRequestSpan(method, params, { server, ctx, caller })?.error({ error: error as Error });
        throw error;
      }
      const requestSpan = this.startRequestSpan(method, params, { server, ctx, caller, requestContext });
      let reportedError: Error | undefined;
      const result = await this.traceRequest(
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
      // Only `tools/call` replies name the serving span: the client reads and removes
      // the key on that path. Added after the span recorded the result, so the span
      // output stays the handler's own.
      return method === 'tools/call' ? withServerTraceContext(result, requestSpan, caller !== undefined) : result;
    });
  }

  /**
   * Opens the span for one served request. `connection` is absent for
   * {@link executeTool}, which is called in-process and negotiates nothing.
   */
  private startRequestSpan(
    method: string,
    params: Record<string, unknown> | undefined,
    connection?: { server?: Server; ctx?: ServerContext; caller?: CallerTraceContext; requestContext?: RequestContext },
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
    const caller = connection?.caller;

    return getOrCreateSpan({
      type: SpanType.MCP_SERVER_REQUEST,
      name: targetName ? `${method} ${targetName}` : method,
      entityType: EntityType.MCP_SERVER,
      entityId: this.id,
      entityName: this.name,
      input: withoutTraceContext(params),
      attributes: {
        mcpMethod: method,
        targetName,
        mcpServer: this.name,
        serverVersion: this.version,
        mcpProtocolVersion: typeof protocolVersion === 'string' ? protocolVersion : undefined,
        clientName: client?.name,
        clientVersion: client?.version,
        callerTraceparent: caller?.traceparent,
        callerTracestate: caller?.tracestate,
      },
      tracingContext: {},
      // The request keeps its own trace and links to the caller's span, so each
      // side keeps its own root and trace summary in every exporter.
      links: caller && [caller.link],
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
    const { method, name, argsHash, round, suspendPayload } = suspension;
    return inputRequired({
      inputRequests: { [INPUT_KEY]: this.inputRequestForm(name, suspendPayload, suspension.resumeSchema) },
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

  /** The form a suspended handler asks the client to fill in. */
  private inputRequestForm(name: string, suspendPayload: unknown, resumeSchema: JSONSchema7 | undefined) {
    const payload = suspendPayload as { message?: unknown } | undefined;
    const message =
      typeof payload?.message === 'string'
        ? payload.message
        : typeof resumeSchema?.description === 'string'
          ? resumeSchema.description
          : `"${name}" needs more input`;
    return inputRequired.elicit({
      message,
      requestedSchema: (resumeSchema ?? { type: 'object', properties: {} }) as never,
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
        const resume = continuation && {
          resumeData: continuation.resumeData,
          suspendPayload: continuation.suspendPayload,
        };
        const taskMode = this.tasks.modeFor(name, tool.mcp?.toolType);
        const asTask = taskMode.mode !== 'off' && clientDeclaredTasks(ctx);
        if (taskMode.mode !== 'off' && !asTask && this.tasks.required.has(name)) {
          throw new MissingRequiredClientCapabilityError(
            { requiredCapabilities: { extensions: tasksCapabilityEntry() } },
            `Tool '${name}' only runs as a task; declare the io.modelcontextprotocol/tasks extension`,
          );
        }
        if (asTask && tool.mcp?.toolType === 'workflow') {
          return await this.startWorkflowTask(ctx, requestContext, name, args, taskMode, {
            currentSpan: trace.requestSpan,
          });
        }
        if (asTask && taskMode.mode === 'always') {
          return this.startToolTask(ctx, requestContext, name, args, taskMode, { resume });
        }
        const options = {
          requestContext,
          mcp,
          tracingContext: { currentSpan: trace.requestSpan },
          ...resume,
        };
        let execution: MCPToolExecutionResultV2;
        if (asTask) {
          const raced = await this.runWithinSyncWindow(ctx, requestContext, name, tool, args, taskMode, options);
          if ('task' in raced) return raced.task;
          execution = raced.execution;
        } else {
          execution = await this.runTool(name, tool, args, options);
        }
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
        // 2025-era clients need non-object structured results wrapped as `{ result }`; the codec decides per era.
        const result = server.projectCallToolResult(
          this.toCallToolResult(name, tool, execution.output),
          this.toolInfo(name, tool).outputSchema,
        );
        this.logger.info(`Tool '${name}' finished in ${Date.now() - startedAt}ms.`);
        return result;
      } catch (error) {
        if (error instanceof ProtocolError) throw error;
        const mastraError = this.toolError(name, error);
        // The client still receives the serialized error, but the span keeps the
        // original so its id and message survive instead of a JSON blob.
        trace.reportError(mastraError);
        return errorResult(JSON.stringify(mastraError.toJSON()));
      }
    });
  }

  /** Logs a tool's failure and wraps it as the error a client receives. */
  private toolError(name: string, error: unknown): MastraError {
    this.logger.error('Tool execution failed', { tool: name, error });
    return error instanceof MastraError
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
  }

  // ---------------------------------------------------------------------------
  // Tasks

  /**
   * `'auto'` mode: runs the tool under the request for up to `syncWindowMs`. A tool that settles in
   * time is answered like any synchronous call; otherwise the same execution carries on as a task,
   * no longer tied to the request's cancellation.
   */
  private async runWithinSyncWindow(
    ctx: ServerContext,
    requestContext: RequestContext,
    name: string,
    tool: InternalCoreTool,
    args: unknown,
    taskMode: ResolvedToolTaskMode,
    options: RunToolOptions & { mcp: MCPToolExecutionContext },
  ): Promise<{ execution: MCPToolExecutionResultV2 } | { task: CallToolResult }> {
    const controller = new AbortController();
    const requestSignal = ctx.mcpReq.signal;
    const followRequest = () => controller.abort(requestSignal.reason);
    if (requestSignal.aborted) followRequest();
    else requestSignal.addEventListener('abort', followRequest, { once: true });

    const settled = this.runTool(name, tool, args, {
      ...options,
      abortSignal: controller.signal,
      // The request may be answered while the tool still runs; its notifications then have nowhere to go.
      mcp: {
        ...options.mcp,
        extra: { ...options.mcp.extra, signal: controller.signal },
        log: (...params) => options.mcp.log!(...params).catch(() => {}),
        progress: params => options.mcp.progress!(params).catch(() => {}),
      },
    }).then(
      execution => ({ execution }),
      (error: unknown) => ({ error }),
    );
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<'timeout'>(resolve => {
      timer = setTimeout(() => resolve('timeout'), taskMode.syncWindowMs);
    });
    const winner = await Promise.race([settled, deadline]);
    clearTimeout(timer);
    requestSignal.removeEventListener('abort', followRequest);
    if (winner !== 'timeout') {
      if ('error' in winner) throw winner.error;
      return winner;
    }
    const first = settled.then(
      (outcome): MCPTaskAttemptOutcome =>
        'error' in outcome
          ? this.toolErrorOutcome(name, outcome.error)
          : this.toTaskOutcome(name, tool, outcome.execution),
    );
    try {
      return {
        task: await this.startToolTask(ctx, requestContext, name, args, taskMode, {
          resume:
            options.resumeData === undefined
              ? undefined
              : { resumeData: options.resumeData, suspendPayload: options.suspendPayload },
          initialAttempt: { outcome: first, abort: reason => controller.abort(reason) },
        }),
      };
    } catch (error) {
      // No task owns the execution, so nothing could ever cancel it.
      controller.abort(error);
      throw error;
    }
  }

  /**
   * Creates the task (durably, before answering) and hands its work to the store. `initialAttempt`
   * is an execution that already started under the request; it stays in this process.
   */
  private async startToolTask(
    ctx: ServerContext,
    requestContext: RequestContext,
    name: string,
    args: unknown,
    taskMode: ResolvedToolTaskMode,
    { resume, initialAttempt }: { resume?: ToolTaskContext['resume'] } & MCPTaskRunOptions,
  ): Promise<CallToolResult> {
    const context: ToolTaskContext = {
      toolName: name,
      args,
      requestContext: this.persistTaskRequestContext(name, requestContext),
      ...(resume && { resume }),
    };
    const params = { ttlMs: taskMode.ttlMs, principal: principalOf(ctx, requestContext), context };
    const { store, task } = await this.createTask(params, initialAttempt !== undefined);
    store.run(task.taskId, this.toolTaskWork(context), { initialAttempt });
    this.logger.debug(`Tool '${name}' continues as task.`);
    return taskHandleResult(task);
  }

  /** The request context a task keeps for its later attempts. */
  private persistTaskRequestContext(name: string, requestContext: RequestContext): Record<string, unknown> {
    const { persisted, dropped } = persistableRequestContext(requestContext);
    if (dropped.length > 0) {
      // Later runs only see what was persisted; a missing `user` fails their authorization checks.
      this.logger.warn(`Tool task '${name}' can't persist request context keys; runs from the task won't see them`, {
        tool: name,
        keys: dropped,
      });
    }
    return persisted;
  }

  /** Creates a task durably. `pinned` keeps its first attempt on this worker, which already runs it. */
  private async createTask(
    params: MCPTaskCreateParams,
    pinned: boolean,
  ): Promise<{ store: MCPTaskStore; task: MCPTask }> {
    const store = this.taskStore instanceof SelectingMCPTaskStore ? await this.taskStore.resolve() : this.taskStore;
    const task =
      store instanceof BackgroundTaskMCPTaskStore
        ? await store.create(params, { pinToWorker: pinned })
        : await store.create(params);
    return { store, task };
  }

  /**
   * The work of a tool task, rebuilt from nothing but what the task's `context` records, so a store
   * can dispatch it again after a restart. Each attempt runs the tool once; an answered suspension
   * runs it again with `resumeData`, as everywhere else in Mastra.
   */
  private toolTaskWork(context: ToolTaskContext): MCPTaskWork {
    const name = context.toolName;
    return async attempt => {
      const tool = this.convertedTools[name];
      if (!tool) throw new Error(`Tool '${name}' is no longer served`);
      const requestContext: RequestContext = new RequestContext(Object.entries(context.requestContext));
      try {
        // Every attempt is authorized on its own, against the persisted caller, like every synchronous round.
        await this.enforceToolExecutionFGA(name, requestContext);
      } catch (error) {
        return this.toolErrorOutcome(name, error);
      }
      let { resumeData, suspendPayload } = context.resume ?? {};
      if (attempt.resume) {
        // One key is enough: the server emits exactly one input request per suspension (see toTaskOutcome).
        const [key] = Object.keys(attempt.resume.inputResponses);
        const answer = inputResponse(attempt.resume.inputResponses, key!);
        if (answer.kind !== 'elicit') return completed(errorResult(`Unsupported input response for tool '${name}'`));
        if (answer.action !== 'accept') {
          return completed(errorResult(`Tool '${name}' was ${answer.action === 'decline' ? 'declined' : 'cancelled'}`));
        }
        resumeData = answer.content ?? {};
        suspendPayload = attempt.resume.suspendPayload;
      }
      try {
        const execution = await this.runTool(name, tool, context.args, {
          requestContext,
          abortSignal: attempt.signal,
          resumeData,
          suspendPayload,
        });
        return this.toTaskOutcome(name, tool, execution);
      } catch (error) {
        return this.toolErrorOutcome(name, error);
      }
    };
  }

  private toTaskOutcome(
    name: string,
    tool: InternalCoreTool,
    execution: MCPToolExecutionResultV2,
  ): MCPTaskAttemptOutcome {
    if (execution.status === 'suspended') {
      this.logger.debug(`Tool task '${name}' requires client input.`);
      // A fresh key per suspension: a task's keys must be unique over its lifetime.
      const inputRequests = {
        [`${INPUT_KEY}-${randomUUID()}`]: this.inputRequestForm(name, execution.suspendPayload, execution.resumeSchema),
      } as MCPTaskInputRequests;
      return { status: 'input_required', inputRequests, suspendPayload: execution.suspendPayload };
    }
    if (
      tool.mcp?.toolType === 'agent' &&
      (execution.output as { finishReason?: unknown })?.finishReason === 'suspended'
    ) {
      // TODO(MCP Tasks): answer an agent's tool approval or suspended tool through `input_required`.
      return completed(
        errorResult(
          `Agent '${name.slice('ask_'.length)}' paused for tool approval or input, which MCP tasks don't support yet`,
        ),
      );
    }
    return completed(this.toCallToolResult(name, tool, execution.output));
  }

  /** A tool that throws inside a task completes it with `isError`, as a synchronous call would answer. */
  private toolErrorOutcome(name: string, error: unknown): MCPTaskAttemptOutcome {
    return completed(errorResult(JSON.stringify(this.toolError(name, error).toJSON())));
  }

  // ---------------------------------------------------------------------------
  // Workflow tasks
  //
  // A workflow task follows one workflow run. The run starts exactly once, here under the request
  // that creates the task; a task's work only ever watches, resumes or cancels it. A run whose
  // server died is continued by Mastra's workflow recovery, and the task re-attaches to it.

  /**
   * Starts the run behind a `run_<key>` task. `'auto'` answers synchronously when the run finishes
   * within `syncWindowMs`; a run that suspends or outlasts the window continues as a task.
   */
  private async startWorkflowTask(
    ctx: ServerContext,
    requestContext: RequestContext,
    name: string,
    args: unknown,
    taskMode: ResolvedToolTaskMode,
    tracingContext: TracingContext,
  ): Promise<CallToolResult> {
    const workflowKey = name.slice('run_'.length);
    const workflow = this.workflowFor(workflowKey);
    if (!workflow) throw new Error(`Workflow '${workflowKey}' is not served`);
    // Rejected input answers as the plain tool does, before a run or task exists to be left behind.
    const input = validateToolInput(workflow.inputSchema, args, name);
    if (input.error) {
      this.logger.warn(`Tool '${name}' rejected its input.`, { error: input.error.message });
      return errorResult(input.error.message);
    }
    // Never the task id: a task id is unguessable, a run id is visible to anyone who can list runs.
    const context: WorkflowTaskContext = {
      toolName: name,
      kind: 'workflow',
      workflowKey,
      runId: randomUUID(),
      requestContext: this.persistTaskRequestContext(name, requestContext),
    };
    const params = { ttlMs: taskMode.ttlMs, principal: principalOf(ctx, requestContext), context };
    const start = () => {
      const run = workflow.createRun({ runId: context.runId });
      const result: Promise<WorkflowRunView> = run.then(started =>
        started.start({ inputData: args, requestContext, tracingContext }),
      );
      const cancel = () =>
        void run
          .then(started => started.cancel())
          .catch(error => this.logger.warn('Could not cancel workflow run', { tool: name, error }));
      return { result, cancel };
    };

    if (taskMode.mode === 'always') {
      // The task exists before the run does: if creating it fails, nothing ran.
      const { store, task } = await this.createTask(params, true);
      const live = start();
      store.run(task.taskId, this.workflowTaskWork(context), {
        initialAttempt: this.liveWorkflowAttempt(workflow, context, live.result, live.cancel),
      });
      this.logger.debug(`Workflow tool '${name}' runs as task.`);
      return taskHandleResult(task);
    }

    const live = start();
    const requestSignal = ctx.mcpReq.signal;
    const followRequest = () => live.cancel();
    if (requestSignal.aborted) followRequest();
    else requestSignal.addEventListener('abort', followRequest, { once: true });
    const settled = live.result.then(
      view => ({ view }),
      (error: unknown) => ({ error }),
    );
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<'timeout'>(resolve => {
      timer = setTimeout(() => resolve('timeout'), taskMode.syncWindowMs);
    });
    const winner = await Promise.race([settled, deadline]);
    clearTimeout(timer);
    requestSignal.removeEventListener('abort', followRequest);
    if (winner !== 'timeout') {
      if ('error' in winner) throw winner.error;
      const outcome = this.workflowRunOutcome(workflow, context, winner.view);
      // A suspended run continues as a task: the client supports them, and they can ask for input.
      if (outcome?.status === 'completed') return outcome.result;
    }
    try {
      const { store, task } = await this.createTask(params, true);
      store.run(task.taskId, this.workflowTaskWork(context), {
        initialAttempt: this.liveWorkflowAttempt(workflow, context, live.result, live.cancel),
      });
      this.logger.debug(`Workflow tool '${name}' continues as task.`);
      return taskHandleResult(task);
    } catch (error) {
      // No task owns the run, so nothing could ever cancel it.
      live.cancel();
      throw error;
    }
  }

  /** The first attempt of a workflow task: the run this request started, in this process. */
  private liveWorkflowAttempt(
    workflow: Workflow,
    context: WorkflowTaskContext,
    result: Promise<WorkflowRunView>,
    cancel: () => void,
  ): NonNullable<MCPTaskRunOptions['initialAttempt']> {
    const controller = new AbortController();
    return {
      outcome: result.then(
        view =>
          this.workflowRunOutcome(workflow, context, view) ??
          this.watchWorkflowRun(workflow, context, controller.signal),
        (error: unknown) => this.toolErrorOutcome(context.toolName, error),
      ),
      abort: reason => {
        controller.abort(reason);
        cancel();
      },
    };
  }

  /**
   * The work of a workflow task, rebuilt from its context. It never starts the run: a first attempt
   * dispatched again (after a restart) re-attaches to it, and an answered suspension resumes it.
   */
  private workflowTaskWork(context: WorkflowTaskContext): MCPTaskWork {
    const name = context.toolName;
    return async attempt => {
      const workflow = this.workflowFor(context.workflowKey);
      if (!workflow) throw new Error(`Workflow '${context.workflowKey}' is no longer served`);
      const requestContext: RequestContext = new RequestContext(Object.entries(context.requestContext));
      try {
        await this.enforceToolExecutionFGA(name, requestContext);
      } catch (error) {
        return this.toolErrorOutcome(name, error);
      }
      const cancelRun = () => void this.cancelWorkflowRun(context);
      if (attempt.signal.aborted) cancelRun();
      else attempt.signal.addEventListener('abort', cancelRun, { once: true });
      try {
        if (!attempt.resume) return await this.watchWorkflowRun(workflow, context, attempt.signal);
        return await this.resumeWorkflowRun(workflow, context, attempt, requestContext);
      } finally {
        attempt.signal.removeEventListener('abort', cancelRun);
      }
    };
  }

  private async resumeWorkflowRun(
    workflow: Workflow,
    context: WorkflowTaskContext,
    attempt: MCPTaskAttempt,
    requestContext: RequestContext,
  ): Promise<MCPTaskAttemptOutcome> {
    const { inputResponses, suspendPayload } = attempt.resume!;
    // One key is enough: the server asks for one suspension at a time (see workflowRunOutcome).
    const [key] = Object.keys(inputResponses);
    const answer = inputResponse(inputResponses, key!);
    const label = `Workflow '${context.workflowKey}'`;
    if (answer.kind !== 'elicit') return completed(errorResult(`Unsupported input response for ${label}`));
    if (answer.action !== 'accept') {
      await this.cancelWorkflowRun(context);
      return completed(errorResult(`${label} was ${answer.action === 'decline' ? 'declined' : 'cancelled'}`));
    }
    const current = await workflow.getWorkflowRunById(context.runId, { withNestedWorkflows: false });
    if (!current) throw new Error(`${label} run '${context.runId}' was lost`);
    const answered = suspendPayload as AnsweredSuspension;
    // Resumed elsewhere since the task asked (Studio, the API): the answer is stale, so follow the
    // run, which asks again if it waits for input once more.
    if (!isStillSuspended({ status: current.status, steps: current.steps }, answered)) {
      return this.watchWorkflowRun(workflow, context, attempt.signal);
    }
    const run = await workflow.createRun({ runId: context.runId });
    let view: WorkflowRunView;
    try {
      view = await run.resume({
        step: answered.step,
        resumeData: answer.content ?? {},
        requestContext,
      });
    } catch (error) {
      // Resumed already, by another instance or an earlier try of this attempt: follow that.
      if (isResumeClaimLost(error)) return this.watchWorkflowRun(workflow, context, attempt.signal);
      return this.toolErrorOutcome(context.toolName, error);
    }
    return this.workflowRunOutcome(workflow, context, view) ?? this.watchWorkflowRun(workflow, context, attempt.signal);
  }

  /**
   * Polls the run until it finishes or suspends on a step the client can answer. The only way to
   * follow a run from any instance, whichever engine runs it.
   */
  private async watchWorkflowRun(
    workflow: Workflow,
    context: WorkflowTaskContext,
    signal: AbortSignal,
  ): Promise<MCPTaskAttemptOutcome> {
    let first = true;
    for (;;) {
      signal.throwIfAborted();
      const state = await workflow.getWorkflowRunById(context.runId, { withNestedWorkflows: false });
      // Started under the request that created the task, so a run that never started never will.
      if (!state || (first && state.status === 'pending')) {
        throw new Error(`Workflow '${context.workflowKey}' run '${context.runId}' was lost`);
      }
      first = false;
      const outcome = this.workflowRunOutcome(workflow, context, {
        status: state.status,
        input: state.payload,
        steps: state.steps,
        result: state.result,
        error: state.error,
      });
      if (outcome) return outcome;
      await sleep(WORKFLOW_POLL_INTERVAL_MS, signal);
    }
  }

  /**
   * What a run's state means for its task, or `undefined` while there is nothing to report: the
   * run is still going, or waits on a step whose `resumeSchema` no input request can present (the
   * task stays `working` until the run is resumed some other way).
   */
  private workflowRunOutcome(
    workflow: Workflow,
    context: WorkflowTaskContext,
    view: WorkflowRunView,
  ): MCPTaskAttemptOutcome | undefined {
    const label = `Workflow '${context.workflowKey}'`;
    switch (view.status) {
      case 'success':
      case 'bailed':
        return completed({ isError: false, content: [{ type: 'text', text: JSON.stringify(runSummary(view)) }] });
      case 'failed':
        return completed(errorResult(`${label} failed: ${runErrorMessage(view)}`));
      case 'tripwire':
        return completed(errorResult(`${label} was blocked: ${runErrorMessage(view)}`));
      case 'canceled':
        return completed(errorResult(`${label} run was cancelled`));
      case 'suspended': {
        const suspended = firstSuspendedStep(workflow, view);
        if (!suspended) return undefined;
        const requestedSchema = this.representableForm(suspended.step?.resumeSchema);
        if (!requestedSchema) return undefined;
        this.logger.debug(`Workflow task '${context.toolName}' requires client input.`);
        // A fresh key per suspension: a task's keys must be unique over its lifetime.
        const inputRequests = {
          [`${INPUT_KEY}-${randomUUID()}`]: this.inputRequestForm(context.toolName, suspended.payload, requestedSchema),
        } as MCPTaskInputRequests;
        const answered: AnsweredSuspension = { step: suspended.path, suspendedAt: suspended.suspendedAt };
        return { status: 'input_required', inputRequests, suspendPayload: answered };
      }
      default:
        return undefined;
    }
  }

  /**
   * Cancels the task's run. A run that already finished is left alone. With `executing: false` (the
   * store's cancel hook, on whichever instance got `tasks/cancel`), a run that is executing is left
   * to the attempt running it: writing `canceled` under a run another process executes doesn't stop
   * it there, its next write overwrites the status, and that process's own cancel then finds the run
   * already `canceled` and does nothing.
   */
  private async cancelWorkflowRun(context: WorkflowTaskContext, { executing = true } = {}): Promise<void> {
    const workflow = this.workflowFor(context.workflowKey);
    if (!workflow) return;
    try {
      const state = await workflow.getWorkflowRunById(context.runId, { withNestedWorkflows: false });
      if (!state || isFinalRunStatus(state.status)) return;
      if (!executing && state.status === 'running') return;
      await (await workflow.createRun({ runId: context.runId })).cancel();
    } catch (error) {
      this.logger.warn('Could not cancel workflow run', { tool: context.toolName, error });
    }
  }

  private workflowFor(key: string): Workflow | undefined {
    return this.workflows?.[key] as Workflow | undefined;
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
    options: RunToolOptions,
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
      abortSignal: options.abortSignal ?? options.mcp?.extra.signal,
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
    // Hosts may detect an MCP App from the call result, so mirror the tool's declared app link onto it.
    const resourceUri = uiResourceUri(tool.mcp?._meta);
    const meta = resourceUri ? { _meta: { ui: { resourceUri }, [RESOURCE_URI_META_KEY]: resourceUri } } : {};
    if (!tool.outputSchema) {
      return {
        isError: false,
        content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value) }],
        ...meta,
      };
    }
    // Tools with an output schema already validated `value` against it.
    const structuredContent = value as Record<string, unknown>;
    return {
      isError: false,
      structuredContent,
      content: [{ type: 'text', text: JSON.stringify(structuredContent) }],
      ...meta,
    };
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
        legacy: this.legacy,
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
   * self-contained; requests without a 2026-07-28 envelope are rejected unless
   * `legacy: 'stateless'` is configured.
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
    this.webhooks?.close();
    // Ends open event streams first, then yields a macrotask so the protocol writes their final
    // results before the transports are torn down.
    if (this.eventRegistry.openStreams.size > 0) {
      this.eventRegistry.closeStreams();
      await new Promise(resolve => setImmediate(resolve));
    }
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
    // Aborts in-memory tasks still running; a store passed in by the application is left to it.
    // Background-task rows stay in storage for other instances to serve.
    const selected = this.taskStore instanceof SelectingMCPTaskStore ? this.taskStore.selected : undefined;
    if (selected instanceof InMemoryMCPTaskStore) selected.close();
    this.backgroundTaskStore?.close();
  }

  /** Whether the id was given (in the config, or as a Mastra registration key) rather than generated per process. */
  private hasStableId = false;

  override setId(id: Parameters<MCPServerBase['setId']>[0]): void {
    super.setId(id);
    if (this.id === id) this.hasStableId = true;
  }

  /** @internal */
  override __registerMastra(mastra: Parameters<MCPServerBase['__registerMastra']>[0]): void {
    super.__registerMastra(mastra);
    // Usually the manager exists by now and has not recovered rows yet: register the executors
    // synchronously so recovered attempts find them.
    this.prepareBackgroundTaskStore();
  }

  /**
   * Builds the background-task store and registers an executor for every task tool, when tasks
   * are on, no store was passed in, and Mastra has background tasks.
   */
  private prepareBackgroundTaskStore(): BackgroundTaskMCPTaskStore | undefined {
    if (this.backgroundTaskStore) return this.backgroundTaskStore;
    if (!this.tasks.enabled || this.tasks.store) return undefined;
    const manager = this.mastra?.backgroundTaskManager;
    if (!manager) return undefined;
    const store = new BackgroundTaskMCPTaskStore({
      manager,
      serverId: this.id,
      workFor: context =>
        isWorkflowTaskContext(context)
          ? this.workflowTaskWork(context)
          : this.toolTaskWork(context as unknown as ToolTaskContext),
      onCancel: context =>
        isWorkflowTaskContext(context) ? this.cancelWorkflowRun(context, { executing: false }) : undefined,
      recoverFor: name => this.tasks.modeFor(name, this.convertedTools[name]?.mcp?.toolType).recover,
      logger: () => this.logger,
    });
    for (const [name, tool] of Object.entries(this.convertedTools)) {
      if (this.tasks.modeFor(name, tool.mcp?.toolType).mode !== 'off') store.registerTool(name);
    }
    this.backgroundTaskStore = store;
    return store;
  }

  /**
   * Mastra's background tasks when the storage keeps per-row expiry (so a task's TTL, not the
   * global cleanup, decides when it is deleted); an in-memory store otherwise.
   */
  private async selectTaskStore(): Promise<MCPTaskStore> {
    const manager = this.mastra?.backgroundTaskManager;
    if (manager) {
      // Fails this request when storage is unreachable; the next task request chooses again.
      const storage = await manager.getStorage();
      if (storage.supportsTaskExpiry === true) {
        const prepared = this.backgroundTaskStore;
        const store = this.prepareBackgroundTaskStore()!;
        if (!this.hasStableId) {
          this.logger.warn(
            `MCP server '${this.name}' keeps tasks in Mastra storage under the generated id '${this.id}', which changes on every start: other instances and restarts won't find its tasks. Pass \`id\` to the MCPServer, or register it under a key in Mastra's \`mcpServers\`.`,
          );
        }
        if (!prepared) {
          this.logger.warn(
            `MCP server '${this.name}' serves tasks from Mastra background tasks that started after it was registered; tasks created before a restart may not have been recovered`,
          );
        }
        return store;
      }
      this.logger.warn(
        `MCP server '${this.name}' keeps tasks in memory: the background tasks storage (${storage.constructor.name}) does not support task expiry. Upgrade the storage adapter to serve tasks across instances.`,
      );
      this.backgroundTaskStore?.close();
      this.backgroundTaskStore = undefined;
    }
    return new InMemoryMCPTaskStore({
      onCancel: context =>
        isWorkflowTaskContext(context) ? this.cancelWorkflowRun(context, { executing: false }) : undefined,
    });
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
  async readResource(uri: string): Promise<{
    contents: Array<{ uri: string; text?: string; blob?: string; mimeType?: string; _meta?: Record<string, unknown> }>;
  }> {
    const html = this.appResourceHtml.get(uri);
    const resource = this.appResourceList.find(r => r.uri === uri);
    if (html === undefined || !resource) {
      throw new MastraError({
        id: 'MCP_SERVER_RESOURCE_NOT_FOUND',
        domain: ErrorDomain.MCP,
        category: ErrorCategory.USER,
        text: `Resource '${uri}' not found; application resources are only readable through an MCP request`,
        details: { uri },
      });
    }
    return { contents: [this.resourceContents(resource, { text: html })] };
  }

  /** Lists `ui://` app resources; application resources require a protocol request. */
  async listResources(): Promise<{ resources: Resource[] }> {
    return { resources: [...this.appResourceList] };
  }

  /**
   * The declared event types as Studio shows them, or `undefined` when the server has none.
   * @experimental
   */
  getEventsInfo(): { events: MCPServerEventInfo[] } | undefined {
    if (this.eventRegistry.size === 0) return undefined;
    return { events: listEventsInfo(this.eventsDeps()) };
  }

  /**
   * Polls, streams and test-emits events in-process through the `events/poll` and
   * `events/stream` code paths, or `undefined` when the server has none. Used by Studio.
   * @experimental
   */
  getEventsInspector(): MCPServerEventsInspector | undefined {
    if (this.eventRegistry.size === 0) return undefined;
    this.eventsInspector ??= createEventsInspector(this.eventsDeps());
    return this.eventsInspector;
  }

  private eventsDeps() {
    return {
      registry: this.eventRegistry,
      heartbeatIntervalMs: this.eventsOptions.heartbeatIntervalMs ?? DEFAULT_EVENTS_HEARTBEAT_INTERVAL_MS,
      maxStreams: this.eventsOptions.maxStreams,
      getLogger: () => this.logger,
      jsonSchema: (schema: unknown, options: { io: 'input' | 'output' }) => this.jsonSchema(schema, options),
    };
  }
}

/** Tools with an intrinsic id are also registered on the Mastra instance, like `__registerMastra` does. */
function isRegistrableTool(tool: ToolsInput[string]): tool is ToolAction<any, any, any, any> {
  return !!tool && typeof tool === 'object' && 'id' in tool && typeof tool.id === 'string';
}

function errorResult(text: string): CallToolResult {
  return { content: [{ type: 'text', text }], isError: true };
}

function completed(result: CallToolResult): MCPTaskAttemptOutcome {
  return { status: 'completed', result };
}

/** How often a workflow task reads its run's state while it runs elsewhere. */
const WORKFLOW_POLL_INTERVAL_MS = 1_000;

function formValidation(message: string, requestedSchema: unknown) {
  return specTypeSchemas.ElicitRequestFormParams['~standard'].validate({ message, requestedSchema });
}

/** `run.resume()` lost to another resume, or found the run no longer suspended. */
function isResumeClaimLost(error: unknown): boolean {
  return (
    error instanceof MastraError &&
    (error.id === 'WORKFLOW_RESUME_ALREADY_CLAIMED' || error.id === 'WORKFLOW_RUN_NOT_SUSPENDED')
  );
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

/** Whether this request's client declared the Tasks extension; only 2026-07-28 requests carry it. */
function clientDeclaredTasks(ctx: ServerContext): boolean {
  const envelope = ctx.mcpReq.envelope as Record<string, unknown> | undefined;
  return hasTasksCapability(envelope?.[CLIENT_CAPABILITIES_META_KEY] as ClientCapabilities | undefined);
}

/** The request context a task keeps. Bearer tokens are dropped so they are never stored with the task. */
function persistableRequestContext(requestContext: RequestContext): {
  persisted: Record<string, unknown>;
  dropped: string[];
} {
  const { authInfo, [MASTRA_AUTH_TOKEN_KEY]: _authToken, ...rest } = requestContext.toJSON() as Record<string, unknown>;
  let stripped = rest;
  if (authInfo && typeof authInfo === 'object') {
    const { token: _token, ...withoutToken } = authInfo as Record<string, unknown>;
    stripped = { ...rest, authInfo: withoutToken };
  } else if (authInfo !== undefined) {
    stripped = { ...rest, authInfo };
  }
  // A JSON round trip, so every store sees what a durable one would read back: plain objects, no shared references.
  const persisted = JSON.parse(JSON.stringify(stripped)) as Record<string, unknown>;
  const dropped = [...requestContext.keys()].filter(
    key =>
      typeof key === 'string' &&
      key !== MASTRA_AUTH_TOKEN_KEY &&
      requestContext.get(key) !== undefined &&
      !(key in persisted),
  ) as string[];
  return { persisted, dropped };
}

/** The tool's MCP App URI; the nested key wins over the flat one, as in ext-apps' `getToolUiResourceUri`. */
function uiResourceUri(meta: Record<string, unknown> | undefined): string | undefined {
  const ui = meta?.ui as { resourceUri?: string } | undefined;
  return ui?.resourceUri || (meta?.[RESOURCE_URI_META_KEY] as string | undefined) || undefined;
}

/** Writes the tool's MCP App URI to both the nested and the flat key, so every host opens the same app. */
function normalizeUiMeta(meta: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  const resourceUri = uiResourceUri(meta);
  if (!meta || !resourceUri) return meta;
  const ui = meta.ui as Record<string, unknown> | undefined;
  return { ...meta, ui: { ...ui, resourceUri }, [RESOURCE_URI_META_KEY]: resourceUri };
}

export { ServerPromptActions, ServerResourceActions, ServerToolActions };
