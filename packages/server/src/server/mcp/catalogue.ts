import type { ToolsInput } from '@mastra/core/agent';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { Mastra } from '@mastra/core/mastra';
import type { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import type { JSONSchema7 } from '@mastra/schema-compat';
import { MASTRA_RESOURCE_ID_KEY } from '../constants';
import { GENERATE_AGENT_ROUTE, GET_AGENT_BY_ID_ROUTE, getAgentFromSystem, LIST_AGENTS_ROUTE } from '../handlers/agents';
import { EXECUTE_TOOL_ROUTE, findTool, GET_TOOL_BY_ID_ROUTE, LIST_TOOLS_ROUTE } from '../handlers/tools';
import {
  CANCEL_WORKFLOW_RUN_ROUTE,
  GET_WORKFLOW_BY_ID_ROUTE,
  GET_WORKFLOW_RUN_BY_ID_ROUTE,
  LIST_WORKFLOWS_ROUTE,
  listWorkflowsFromSystem,
  RESUME_ASYNC_WORKFLOW_ROUTE,
  START_ASYNC_WORKFLOW_ROUTE,
} from '../handlers/workflows';
import { authorizeRoute, checkRouteRBAC, dispatchRoute } from '../server-adapter';
import type { DispatchRouteInput, ServerContext, ServerRoute } from '../server-adapter';
import { getEffectivePermission } from '../server-adapter/routes/permissions';
import { getBuiltinMCPCapabilities } from './capabilities';
import type { BuiltinMCPCapabilities } from './capabilities';
import type { MCPPrimitiveKind, ResolvedBuiltinMCPConfig } from './config';
import { object, str, toJSONSchema } from './schema';
import { addMemoryTools } from './toolsets/memory';
import { addObservabilityTools } from './toolsets/observability';
import { addStoredAgentTools } from './toolsets/stored-agents';

type MCPTool = ReturnType<typeof createTool>;
export type ToolAnnotations = { readOnlyHint?: boolean; destructiveHint?: boolean; openWorldHint?: boolean };
export type Args = Record<string, any>;
type Execute = (args: Args, signal?: AbortSignal) => Promise<unknown>;
type AddOptions = { annotations?: ToolAnnotations; outputSchema?: JSONSchema7 };

/** What a toolset needs to register route-backed tools. Every call goes through `dispatchRoute`. */
export interface CatalogueKit {
  mastra: Mastra;
  requestContext: RequestContext;
  config: ResolvedBuiltinMCPConfig;
  capabilities: BuiltinMCPCapabilities;
  /** Whether the caller may use the route in the selected toolsets, mode, and server capabilities. */
  offered(route: ServerRoute): boolean;
  /** Whether the caller may run the route from a tool (route RBAC and read-only mode), whether or not it has its own tool. */
  permitted(route: ServerRoute): boolean;
  call(route: ServerRoute, input: DispatchRouteInput, signal?: AbortSignal): Promise<unknown>;
  /** Registers a tool under an explicit name. Callers check `offered` first. */
  add(
    name: string,
    route: ServerRoute,
    description: string,
    inputSchema: JSONSchema7,
    execute: Execute,
    options?: AddOptions,
  ): void;
  /** Registers the route's own `mcp` tool when it is offered. */
  addOperation(route: ServerRoute, inputSchema: JSONSchema7, execute: Execute, options?: AddOptions): void;
  /**
   * Registers one tool backed by several routes (named by the first route's `mcp`), offered only when
   * every route is. `execute` dispatches each call to the route it needs.
   */
  addCombined(routes: ServerRoute[], inputSchema: JSONSchema7, execute: Execute): void;
  /** Agent ids the caller can see, or undefined when it cannot list agents. */
  visibleAgentIds(): Promise<string[] | undefined>;
  /** Throws a 404 when `id` names a primitive that include/exclude leaves out. */
  requireSelected(kind: MCPPrimitiveKind, id: string, label: string): Promise<void>;
  idParam(label: string, ids: string[] | undefined, listTool: string): JSONSchema7;
}

const MAX_TOOL_NAME_LENGTH = 64;

export interface BuiltinMCPContext {
  mastra: Mastra;
  /** The RequestContext populated by the `/mcp` route's authentication. Every tool call reuses it. */
  requestContext: RequestContext;
  registeredTools?: ToolsInput;
  taskStore?: ServerContext['taskStore'];
  routePrefix?: string;
  abortSignal: AbortSignal;
  /** The `/mcp` request reduced to its `Authorization` header, seen by dispatched routes' auth rules. */
  request?: Request;
  /** The built-in MCP route, used to check `mcp:execute` with the same RBAC provider. */
  mcpRoute: ServerRoute;
}

/** A backing route's permission is a read when every permission it accepts has the `read` action. */
function isReadRoute(route: ServerRoute): boolean {
  const permission = getEffectivePermission(route);
  if (!permission) return false;
  return (Array.isArray(permission) ? permission : [permission]).every(p => p.split(':')[1] === 'read');
}

// FNV-1a: short, deterministic suffix for truncated or colliding names.
function shortHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0').slice(0, 6);
}

/**
 * Names entity tools `<prefix>_<id>`, sanitized to `[A-Za-z0-9_-]` and at most 64 characters.
 * Ids that are already valid are named first, so they keep the plain name when a sanitized id collides with them.
 */
export function nameEntityTools(prefix: string, ids: string[], used: Set<string>): Map<string, string> {
  const names = new Map<string, string>();
  const sanitize = (id: string) => id.replace(/[^A-Za-z0-9_-]/g, '_');
  const ordered = [...ids].sort((a, b) => {
    const aClean = sanitize(a) === a;
    const bClean = sanitize(b) === b;
    return aClean === bClean ? a.localeCompare(b) : aClean ? -1 : 1;
  });
  for (const id of ordered) {
    let name = `${prefix}_${sanitize(id)}`;
    if (name.length > MAX_TOOL_NAME_LENGTH || used.has(name)) {
      name = `${name.slice(0, MAX_TOOL_NAME_LENGTH - 7)}_${shortHash(id)}`;
    }
    used.add(name);
    names.set(id, name);
  }
  return names;
}

/**
 * Maps every name of a registered primitive (its `.id` and registration key) to all of its names.
 * A name that is some primitive's `.id` resolves to that primitive, as in the handlers' id-first lookups.
 */
function registryNames(...registries: Array<Record<string, { id?: string } | undefined> | undefined>) {
  const byId = new Map<string, Set<string>>();
  for (const registry of registries) {
    for (const [key, value] of Object.entries(registry ?? {})) {
      const id = typeof value?.id === 'string' ? value.id : key;
      const names = byId.get(id) ?? new Set([id]);
      names.add(key);
      byId.set(id, names);
    }
  }
  const byName = new Map<string, string[]>();
  for (const names of byId.values()) for (const name of names) byName.set(name, [...names]);
  for (const [id, names] of byId) byName.set(id, [...names]);
  return byName;
}

export function toolError(status: number, body: unknown): MastraError {
  const details = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const message = details.message ?? details.error ?? (typeof body === 'string' ? body : 'Request failed');
  const issues = Array.isArray(details.issues) ? ` ${JSON.stringify(details.issues)}` : '';
  return new MastraError({
    id: 'MASTRA_MCP_TOOL_CALL_FAILED',
    domain: ErrorDomain.MCP,
    category: status >= 500 ? ErrorCategory.SYSTEM : ErrorCategory.USER,
    text: `${status} ${String(message)}${issues}`,
    details: { status },
  });
}

const missingDescriptionWarnings = new WeakMap<Mastra, Set<string>>();

function describeAgent(mastra: Mastra, id: string, agent: { name?: string; description?: string } | undefined): string {
  if (agent?.description) return agent.description;
  let warned = missingDescriptionWarnings.get(mastra);
  if (!warned) missingDescriptionWarnings.set(mastra, (warned = new Set()));
  if (!warned.has(id)) {
    warned.add(id);
    mastra
      .getLogger()
      ?.warn(`Agent "${id}" has no description; MCP clients get a generic one. Add a description to the agent.`);
  }
  return `Call the ${agent?.name ?? id} agent.`;
}

/**
 * Builds the tools one caller sees on the built-in MCP server.
 *
 * Each tool is backed by a server route and runs it with `dispatchRoute` and the caller's own
 * RequestContext, so RBAC, FGA, and the handler's ownership checks are exactly those of the HTTP route.
 * Tools the caller would be refused are left out; every call is authorized again.
 */
export async function buildBuiltinMCPTools(
  ctx: BuiltinMCPContext,
  config: ResolvedBuiltinMCPConfig,
): Promise<Record<string, MCPTool>> {
  const { mastra, requestContext } = ctx;
  const capabilities = await getBuiltinMCPCapabilities(mastra);
  const routeContext: ServerContext = {
    mastra,
    requestContext,
    registeredTools: ctx.registeredTools,
    taskStore: ctx.taskStore,
    routePrefix: ctx.routePrefix,
    abortSignal: ctx.abortSignal,
    request: ctx.request,
  };
  const mcpExecuteRoute: ServerRoute = { ...ctx.mcpRoute, requiresPermission: 'mcp:execute' };

  // Every tools/call needs `mcp:execute` on top of the backing route's own permission.
  const canExecute = checkRouteRBAC(mastra, mcpExecuteRoute, requestContext) === null;

  /** Whether the caller may run this route from a tool: route-level RBAC and read-only mode. */
  const permitted = (route: ServerRoute) =>
    canExecute && (!config.readOnly || isReadRoute(route)) && checkRouteRBAC(mastra, route, requestContext) === null;
  /** Whether the route's own tool is offered: permitted, in the configured toolsets, and supported by the server. */
  const offered = (route: ServerRoute) =>
    Boolean(route.mcp) &&
    config.toolsets.has(route.mcp!.toolset) &&
    (route.mcp!.requires?.(capabilities) ?? true) &&
    permitted(route);

  const call = async (route: ServerRoute, input: DispatchRouteInput, signal: AbortSignal | undefined) => {
    const denied = checkRouteRBAC(mastra, mcpExecuteRoute, requestContext);
    if (denied) throw toolError(denied.status, denied);
    const abortSignal = signal ? AbortSignal.any([signal, ctx.abortSignal]) : ctx.abortSignal;
    const result = await dispatchRoute(route, input, { ...routeContext, abortSignal });
    if (!result.ok) throw toolError(result.status, result.body);
    return result.result;
  };

  // include/exclude name a primitive by its `.id` or its registration key, and handlers resolve either,
  // so selection always checks every name of the primitive an id resolves to.
  const registries = {
    agents: () => registryNames(mastra.listAgents() as Record<string, { id?: string }>),
    workflows: () => registryNames(mastra.listWorkflows() as Record<string, { id?: string }>),
    tools: () => registryNames(ctx.registeredTools as Record<string, { id?: string }>, mastra.listTools()),
  };
  const registryCache = new Map<MCPPrimitiveKind, Map<string, string[]>>();
  /** Every name of the registered primitive called `name` (just `name` when it isn't registered). */
  const namesOf = (kind: MCPPrimitiveKind, name: string): string[] => {
    let names = registryCache.get(kind);
    if (!names) registryCache.set(kind, (names = registries[kind]()));
    return names.get(name) ?? [name];
  };
  /** Resolves a caller-supplied id with the backing handler's own resolver, then returns every name it has. */
  const resolveNames = async (kind: MCPPrimitiveKind, id: string): Promise<string[]> => {
    let resolved: string | undefined;
    try {
      if (kind === 'agents') resolved = (await getAgentFromSystem({ mastra, agentId: id, requestContext })).id;
      else if (kind === 'workflows') resolved = (await listWorkflowsFromSystem({ mastra, workflowId: id })).workflow.id;
      else
        resolved = (await findTool({ mastra, registeredTools: ctx.registeredTools, toolId: id, requestContext }))?.id;
    } catch {
      // Not found: the backing route answers 404 itself.
    }
    return [...new Set([id, ...(resolved ? namesOf(kind, resolved) : [])])];
  };
  const requireSelected = async (kind: MCPPrimitiveKind, id: string, label: string) => {
    if (!config.isSelected(kind, await resolveNames(kind, id))) throw toolError(404, `${label} not found`);
  };
  /** Keys of listed entities that a configured id list (e.g. `featured`) names by `.id` or registration key. */
  const named = (kind: MCPPrimitiveKind, listed: Map<string, unknown>, ids: string[]) =>
    [...listed.keys()].filter(key => namesOf(kind, key).some(name => ids.includes(name)));

  /** Lists visible entities through the backing list route, so FGA filtering and stored agents are inherited. */
  const listVisible = async (route: ServerRoute, kind: MCPPrimitiveKind, query?: DispatchRouteInput['query']) => {
    if (checkRouteRBAC(mastra, route, requestContext)) return undefined;
    const result = await dispatchRoute(route, { query }, routeContext);
    if (!result.ok) return undefined;
    const entries = Object.entries((result.result ?? {}) as Record<string, any>);
    return new Map(entries.filter(([key]) => config.isSelected(kind, namesOf(kind, key))));
  };

  const idParam = (label: string, ids: string[] | undefined, listTool: string): JSONSchema7 =>
    ids && ids.length > 0 && ids.length <= config.enumLimit
      ? { type: 'string', enum: ids, description: `${label} id. Call ${listTool} for descriptions.` }
      : str(`${label} id. Call ${listTool} to find ids.`);

  const annotationsFor = (route: ServerRoute, extra: ToolAnnotations = {}): ToolAnnotations =>
    isReadRoute(route) ? { readOnlyHint: true, ...extra } : { readOnlyHint: false, destructiveHint: false, ...extra };

  const tools: Record<string, MCPTool> = {};
  const used = new Set<string>();
  const add = (
    name: string,
    route: ServerRoute,
    description: string,
    inputSchema: JSONSchema7,
    execute: (args: Args, signal?: AbortSignal) => Promise<unknown>,
    options: { annotations?: ToolAnnotations; outputSchema?: JSONSchema7 } = {},
  ) => {
    used.add(name);
    tools[name] = createTool({
      id: name,
      description,
      inputSchema,
      outputSchema: options.outputSchema,
      mcp: { annotations: options.annotations ?? annotationsFor(route) },
      execute: async (args, context) => execute((args ?? {}) as Args, context?.abortSignal),
    });
  };
  const addOperation = (
    route: ServerRoute,
    inputSchema: JSONSchema7,
    execute: (args: Args, signal?: AbortSignal) => Promise<unknown>,
    options?: { annotations?: ToolAnnotations; outputSchema?: JSONSchema7 },
  ) => {
    if (offered(route)) add(route.mcp!.name, route, route.mcp!.description, inputSchema, execute, options);
  };
  const matches = (query: unknown, ...values: unknown[]) =>
    typeof query !== 'string' ||
    values.some(value => typeof value === 'string' && value.toLowerCase().includes(query.toLowerCase()));
  const listInput = (label: string) =>
    object({ query: str(`Only return ${label} whose id or name contains this text.`) });

  // ---------------------------------------------------------------------------
  // Agents

  let visibleAgents: Promise<Map<string, any> | undefined> | undefined;
  const listVisibleAgents = () => (visibleAgents ??= listVisible(LIST_AGENTS_ROUTE, 'agents', { partial: 'true' }));

  if (config.toolsets.has('agents')) {
    const agents = await listVisibleAgents();
    const agentIds = agents ? [...agents.keys()].sort() : undefined;

    const callAgentOutput = object({
      text: { type: 'string' },
      threadId: { type: 'string' },
      runId: { type: 'string' },
      usage: { type: 'object' },
    });
    const callAgent = async (agentId: string, args: Args, signal?: AbortSignal) => {
      await requireSelected('agents', agentId, 'Agent');
      const { message } = args;
      // The generate route decides the effective resource (auth-derived ids win); a new thread is minted
      // whenever there is one, so memory-backed agents work without the client managing thread ids.
      const resourceId = args.resourceId ?? requestContext.get(MASTRA_RESOURCE_ID_KEY);
      const threadId = args.threadId ?? (resourceId ? crypto.randomUUID() : undefined);
      const body: Args = { messages: [{ role: 'user', content: message }] };
      if (threadId || resourceId) body.memory = { thread: threadId, resource: resourceId };
      const result = (await call(GENERATE_AGENT_ROUTE, { pathParams: { agentId }, body }, signal)) as Args;
      return {
        text: result?.text ?? '',
        ...(threadId ? { threadId } : {}),
        ...(result?.runId ? { runId: result.runId } : {}),
        ...(result?.totalUsage || result?.usage ? { usage: result.totalUsage ?? result.usage } : {}),
      };
    };
    const messageInput = {
      message: str('The message to send.'),
      threadId: str('Conversation thread id. Reuse the threadId from an earlier reply to continue it.'),
      resourceId: str('Owner of the conversation memory (for example a user id).'),
    };
    const agentAnnotations = { readOnlyHint: false, destructiveHint: false, openWorldHint: true };

    addOperation(LIST_AGENTS_ROUTE, listInput('agents'), async (args, signal) => {
      const listed = (await call(LIST_AGENTS_ROUTE, { query: { partial: 'true' } }, signal)) as Record<string, any>;
      return {
        agents: Object.entries(listed ?? {})
          .filter(
            ([id, agent]) => config.isSelected('agents', namesOf('agents', id)) && matches(args.query, id, agent?.name),
          )
          .map(([id, agent]) => ({ id, name: agent?.name, description: describeAgent(mastra, id, agent) })),
      };
    });
    addOperation(
      GET_AGENT_BY_ID_ROUTE,
      object({ agentId: idParam('Agent', agentIds, 'list_agents') }, ['agentId']),
      async (args, signal) => {
        await requireSelected('agents', args.agentId, 'Agent');
        return call(GET_AGENT_BY_ID_ROUTE, { pathParams: { agentId: args.agentId } }, signal);
      },
    );
    addOperation(
      GENERATE_AGENT_ROUTE,
      object({ agentId: idParam('Agent', agentIds, 'list_agents'), ...messageInput }, ['agentId', 'message']),
      (args, signal) => callAgent(args.agentId, args, signal),
      { annotations: agentAnnotations, outputSchema: callAgentOutput },
    );

    if (agents && offered(GENERATE_AGENT_ROUTE)) {
      const featured = [];
      for (const id of named('agents', agents, config.featured.agents)) {
        if (!(await authorizeRoute(mastra, GENERATE_AGENT_ROUTE, { agentId: id }, requestContext))) {
          featured.push(id);
        }
      }
      for (const [id, name] of nameEntityTools('agent', featured, used)) {
        add(
          name,
          GENERATE_AGENT_ROUTE,
          describeAgent(mastra, id, agents.get(id)),
          object(messageInput, ['message']),
          (args, signal) => callAgent(id, args, signal),
          { annotations: agentAnnotations, outputSchema: callAgentOutput },
        );
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Workflows

  if (config.toolsets.has('workflows')) {
    const workflows = await listVisible(LIST_WORKFLOWS_ROUTE, 'workflows', { partial: 'true' });
    const workflowIds = workflows ? [...workflows.keys()].sort() : undefined;
    const workflowId = () => idParam('Workflow', workflowIds, 'list_workflows');
    const runId = str('Workflow run id.');

    /** Suspended runs return what a client needs to resume them with resume_workflow_run. */
    const toRunResult = (id: string, result: Args) =>
      result?.status === 'suspended'
        ? { status: 'suspended', runId: id, suspendPayload: result.suspendPayload, suspendedSteps: result.suspended }
        : { runId: id, ...result };

    const startWorkflow = async (id: string, args: Args, signal?: AbortSignal) => {
      await requireSelected('workflows', id, 'Workflow');
      const run = args.runId ?? crypto.randomUUID();
      const result = await call(
        START_ASYNC_WORKFLOW_ROUTE,
        { pathParams: { workflowId: id }, query: { runId: run }, body: { inputData: args.inputData } },
        signal,
      );
      return toRunResult(run, result as Args);
    };

    addOperation(LIST_WORKFLOWS_ROUTE, listInput('workflows'), async (args, signal) => {
      const listed = (await call(LIST_WORKFLOWS_ROUTE, { query: { partial: 'true' } }, signal)) as Record<string, any>;
      return {
        workflows: Object.entries(listed ?? {})
          .filter(
            ([id, workflow]) =>
              config.isSelected('workflows', namesOf('workflows', id)) && matches(args.query, id, workflow?.name),
          )
          .map(([id, workflow]) => ({ id, name: workflow?.name, description: workflow?.description })),
      };
    });
    addOperation(
      GET_WORKFLOW_BY_ID_ROUTE,
      object({ workflowId: workflowId() }, ['workflowId']),
      async (args, signal) => {
        await requireSelected('workflows', args.workflowId, 'Workflow');
        return call(GET_WORKFLOW_BY_ID_ROUTE, { pathParams: { workflowId: args.workflowId } }, signal);
      },
    );
    addOperation(
      START_ASYNC_WORKFLOW_ROUTE,
      object(
        {
          workflowId: workflowId(),
          inputData: { description: 'Input matching the workflow input schema (see get_workflow).' },
          runId: str('Optional id for the new run.'),
        },
        ['workflowId'],
      ),
      (args, signal) => startWorkflow(args.workflowId, args, signal),
    );
    addOperation(
      GET_WORKFLOW_RUN_BY_ID_ROUTE,
      object(
        {
          workflowId: workflowId(),
          runId,
          fields: str('Comma-separated fields to return: result, error, payload, steps, activeStepsPath.'),
        },
        ['workflowId', 'runId'],
      ),
      async (args, signal) => {
        await requireSelected('workflows', args.workflowId, 'Workflow');
        return call(
          GET_WORKFLOW_RUN_BY_ID_ROUTE,
          {
            pathParams: { workflowId: args.workflowId, runId: args.runId },
            query: args.fields ? { fields: args.fields } : {},
          },
          signal,
        );
      },
    );
    addOperation(
      RESUME_ASYNC_WORKFLOW_ROUTE,
      object(
        {
          workflowId: workflowId(),
          runId,
          step: str('Suspended step to resume. Defaults to the suspended step.'),
          resumeData: { description: 'Data the suspended step asked for.' },
        },
        ['workflowId', 'runId'],
      ),
      async (args, signal) => {
        await requireSelected('workflows', args.workflowId, 'Workflow');
        const result = await call(
          RESUME_ASYNC_WORKFLOW_ROUTE,
          {
            pathParams: { workflowId: args.workflowId },
            query: { runId: args.runId },
            body: { step: args.step, resumeData: args.resumeData },
          },
          signal,
        );
        return toRunResult(args.runId, result as Args);
      },
    );
    addOperation(
      CANCEL_WORKFLOW_RUN_ROUTE,
      object({ workflowId: workflowId(), runId }, ['workflowId', 'runId']),
      async (args, signal) => {
        await requireSelected('workflows', args.workflowId, 'Workflow');
        return call(
          CANCEL_WORKFLOW_RUN_ROUTE,
          { pathParams: { workflowId: args.workflowId, runId: args.runId } },
          signal,
        );
      },
      { annotations: { readOnlyHint: false, destructiveHint: true } },
    );

    if (workflows && offered(START_ASYNC_WORKFLOW_ROUTE)) {
      const registered = mastra.listWorkflows() as Record<
        string,
        { id?: string; inputSchema?: unknown; description?: string }
      >;
      // Featured tools are named from the workflow's `.id`; the list is keyed by registration key.
      const featured = new Map<string, string>();
      for (const key of named('workflows', workflows, config.featured.workflows)) {
        const id = registered[key]?.id ?? key;
        if (!(await authorizeRoute(mastra, START_ASYNC_WORKFLOW_ROUTE, { workflowId: id }, requestContext))) {
          featured.set(id, key);
        }
      }
      for (const [id, name] of nameEntityTools('workflow', [...featured.keys()], used)) {
        const key = featured.get(id)!;
        const inputSchema = toJSONSchema(registered[key]?.inputSchema);
        const isObject = inputSchema?.type === 'object';
        add(
          name,
          START_ASYNC_WORKFLOW_ROUTE,
          workflows.get(key)?.description ?? registered[key]?.description ?? `Run the ${id} workflow.`,
          isObject ? inputSchema : object({ inputData: inputSchema ?? {} }),
          (args, signal) => startWorkflow(id, { inputData: isObject ? args : args.inputData }, signal),
        );
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Tools

  if (config.toolsets.has('tools')) {
    const listed = await listVisible(LIST_TOOLS_ROUTE, 'tools');
    const visible = listed
      ? [...listed.keys()].map(key => {
          const tool: any = ctx.registeredTools?.[key] ?? mastra.listTools()?.[key];
          return { key, id: (tool?.id as string | undefined) ?? key, tool };
        })
      : [];
    const asEntityTools = listed !== undefined && visible.length <= config.enumLimit && offered(EXECUTE_TOOL_ROUTE);

    if (asEntityTools) {
      const allowed = [];
      for (const entry of visible) {
        if (!(await authorizeRoute(mastra, EXECUTE_TOOL_ROUTE, { toolId: entry.id }, requestContext))) {
          allowed.push(entry);
        }
      }
      const byId = new Map(allowed.map(entry => [entry.id, entry]));
      for (const [id, name] of nameEntityTools('tool', [...byId.keys()], used)) {
        const { tool } = byId.get(id)!;
        const inputSchema = toJSONSchema(tool?.inputSchema);
        const isObject = inputSchema?.type === 'object';
        add(
          name,
          EXECUTE_TOOL_ROUTE,
          tool?.description ?? `Call the ${id} tool.`,
          isObject ? inputSchema : object({ data: inputSchema ?? {} }),
          async (args, signal) => {
            await requireSelected('tools', id, 'Tool');
            return call(
              EXECUTE_TOOL_ROUTE,
              { pathParams: { toolId: id }, body: { data: isObject ? args : args.data } },
              signal,
            );
          },
          { annotations: { readOnlyHint: false, destructiveHint: false, ...tool?.mcp?.annotations } },
        );
      }
    } else {
      const toolIds = listed ? visible.map(entry => entry.id).sort() : undefined;
      const toolId = () => idParam('Tool', toolIds, 'list_tools');
      addOperation(LIST_TOOLS_ROUTE, listInput('tools'), async (args, signal) => {
        const tools = (await call(LIST_TOOLS_ROUTE, {}, signal)) as Record<string, any>;
        return {
          tools: Object.entries(tools ?? {})
            .map(([key, tool]) => ({
              key,
              id: (tool?.id as string | undefined) ?? key,
              description: tool?.description,
            }))
            .filter(
              tool =>
                config.isSelected('tools', [...namesOf('tools', tool.key), tool.id]) && matches(args.query, tool.id),
            )
            .map(({ id, description }) => ({ id, description })),
        };
      });
      addOperation(GET_TOOL_BY_ID_ROUTE, object({ toolId: toolId() }, ['toolId']), async (args, signal) => {
        await requireSelected('tools', args.toolId, 'Tool');
        return call(GET_TOOL_BY_ID_ROUTE, { pathParams: { toolId: args.toolId } }, signal);
      });
      addOperation(
        EXECUTE_TOOL_ROUTE,
        object({ toolId: toolId(), data: { description: 'Input matching the tool input schema (see get_tool).' } }, [
          'toolId',
        ]),
        async (args, signal) => {
          await requireSelected('tools', args.toolId, 'Tool');
          return call(EXECUTE_TOOL_ROUTE, { pathParams: { toolId: args.toolId }, body: { data: args.data } }, signal);
        },
      );
    }
  }

  const kit: CatalogueKit = {
    mastra,
    requestContext,
    config,
    capabilities,
    offered,
    permitted,
    call,
    add,
    addOperation,
    addCombined: (routes, inputSchema, execute) => {
      if (routes.every(offered))
        add(routes[0]!.mcp!.name, routes[0]!, routes[0]!.mcp!.description, inputSchema, execute);
    },
    visibleAgentIds: async () => {
      const agents = await listVisibleAgents();
      return agents ? [...agents.keys()].sort() : undefined;
    },
    requireSelected,
    idParam,
  };
  if (config.toolsets.has('memory')) await addMemoryTools(kit);
  addObservabilityTools(kit);
  if (config.toolsets.has('stored_agents')) addStoredAgentTools(kit);

  return tools;
}
