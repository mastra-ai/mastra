import type { AgentConfig, ToolsInput } from '@mastra/core/agent';
import { AgentController } from '@mastra/core/agent-controller';
import type { AgentControllerConfig, AgentControllerMode } from '@mastra/core/agent-controller';
import { createCodingAgent } from '@mastra/core/coding-agent';
import type { PubSub } from '@mastra/core/events';
import type { GatewayLanguageModel } from '@mastra/core/llm';
import { Mastra } from '@mastra/core/mastra';
import type { InputProcessor } from '@mastra/core/processors';
import type { RequestContext } from '@mastra/core/request-context';
import type { PublicSchema } from '@mastra/core/schema';
import type { ApiRoute } from '@mastra/core/server';
import type { MastraCompositeStore } from '@mastra/core/storage';
import type { ToolAfterHookContext, ToolHooks } from '@mastra/core/tools';
import type { Workspace } from '@mastra/core/workspace';
import { z } from 'zod';

import type { MastraCodeState } from './schema.js';

// Keep the restricted entry point independent from the regular Mastra Code
// schema, whose defaults intentionally consult the local process environment.
// The disabled model sentinel fails closed if a host injects an observational
// memory processor without also supplying its model configuration.
const disabledModelId = '__restricted_model_disabled__';
const restrictedStateSchema = z.looseObject({
  currentModelId: z.string().optional(),
  modeId: z.string().optional(),
  subagentModelId: z.string().optional(),
  projectPath: z.string().optional(),
  projectName: z.string().optional(),
  factoryProjectId: z.string().optional(),
  factoryOrgId: z.string().optional(),
  factoryOrgUnresolved: z.boolean().optional(),
  projectRepositoryId: z.string().optional(),
  branch: z.string().optional(),
  untrustedCheckout: z.boolean().optional(),
  baseRef: z.string().optional(),
  skipGlobalInstructions: z.boolean().default(true),
  configDir: z.string().default('.mastracode'),
  homeDir: z.string().optional(),
  gitBranch: z.string().optional(),
  lastCommand: z.string().optional(),
  observerModelId: z.string().default(disabledModelId),
  reflectorModelId: z.string().default(disabledModelId),
  observationThreshold: z.number().default(30_000),
  reflectionThreshold: z.number().default(40_000),
  cavemanObservations: z.boolean().default(false),
  observeAttachments: z.union([z.literal('auto'), z.boolean()]).default('auto'),
  omScope: z.enum(['thread', 'resource']).optional(),
  thinkingLevel: z.enum(['off', 'low', 'medium', 'high', 'xhigh', 'max']).optional(),
  yolo: z.boolean().default(false),
  permissionRules: z
    .object({
      categories: z.record(z.string(), z.enum(['allow', 'ask', 'deny'])).default({}),
      tools: z.record(z.string(), z.enum(['allow', 'ask', 'deny'])).default({}),
    })
    .default({ categories: {}, tools: {} }),
  smartEditing: z.boolean().default(true),
  notifications: z.enum(['bell', 'system', 'both', 'off']).default('off'),
  tasks: z
    .array(
      z.object({
        id: z.string().optional(),
        content: z.string(),
        status: z.enum(['pending', 'in_progress', 'completed']),
        activeForm: z.string(),
      }),
    )
    .default([]),
  sandboxAllowedPaths: z.array(z.string()).default([]),
  pluginSkillPaths: z.array(z.string()).default([]),
  pluginCommandPaths: z.array(z.string()).default([]),
  pluginInstructions: z.array(z.string()).default([]),
  activePlan: z
    .object({
      title: z.string(),
      plan: z.string(),
      approvedAt: z.string(),
    })
    .nullable()
    .default(null),
  activeBrowserSettings: z.never().optional(),
});

export type RestrictedModel =
  | GatewayLanguageModel
  | ((args: {
      requestContext: RequestContext;
      mastra?: Mastra;
    }) => GatewayLanguageModel | Promise<GatewayLanguageModel>);

export type RestrictedToolProvider =
  | Record<string, ToolsInput[string] | undefined>
  | ((args: {
      requestContext: RequestContext;
    }) => Record<string, ToolsInput[string] | undefined> | Promise<Record<string, ToolsInput[string] | undefined>>);

export interface RestrictedProjectMetadata {
  /** Stable resource id used to scope controller threads. */
  resourceId: string;
  /** Human-readable project name exposed in controller state. */
  name: string;
  /** Workspace path understood by the injected workspace. It is never inspected by this factory. */
  rootPath: string;
  /** Optional branch name supplied by the embedding host. */
  gitBranch?: string;
}

/**
 * Fail-closed configuration for embedding Mastra Code in a credentialed server.
 *
 * Every capability is supplied by the embedding host. This factory does not
 * discover local settings, credentials, projects, instructions, tools, or
 * workspaces. Subagents, goals, workflows, plugins, discovered hooks, MCP, provider login,
 * browser automation, and polling signal providers are not registered.
 */
export interface RestrictedMastraCodeConfig {
  project: RestrictedProjectMetadata;
  /** A pre-resolved model instance or resolver. Construct it with host-owned credentials. */
  model: RestrictedModel;
  /** Complete system instructions. No repository or global instruction files are loaded. */
  instructions: AgentConfig['instructions'];
  /** Explicit controller modes. Each mode is permanently bounded by `allowedTools`. */
  modes: AgentControllerMode[];
  /** Explicit global tool allowlist. An empty array creates a tool-free agent. */
  allowedTools: string[];
  /** Host-supplied non-workspace tools. Built-in Mastra Code tools are not added. */
  tools?: RestrictedToolProvider;
  /** Host-supplied workspace. No local fallback is available. */
  workspace: Workspace;
  /** Host-supplied persistence. No settings-based storage fallback is available. */
  storage: MastraCompositeStore;
  /** Host-supplied memory, or false to disable memory. */
  memory: AgentControllerConfig<MastraCodeState>['memory'] | false;
  /** Initial state owned by the host. Project identity always wins over these values. */
  initialState?: Partial<MastraCodeState>;
  inputProcessors?: InputProcessor[];
  /** Observe completed tool calls. The observer cannot add or replace tools. */
  postToolObserver?: (context: ToolAfterHookContext) => void | Promise<void>;
  pubsub?: PubSub;
  idGenerator?: AgentControllerConfig<MastraCodeState>['idGenerator'];
}

export interface RestrictedMastraCodeMountConfig extends RestrictedMastraCodeConfig {
  mastra?: Mastra;
  controllerId?: string;
  buildApiRoutes?: (deps: { controller: AgentController<MastraCodeState> }) => ApiRoute[];
  buildServerConfig?: (deps: {
    controller: AgentController<MastraCodeState>;
  }) => Omit<NonNullable<ConstructorParameters<typeof Mastra>[0]>['server'], 'apiRoutes'>;
}

/** Validates required host authority decisions and returns the fixed tool allowlist. */
function validateRestrictedConfig(config: RestrictedMastraCodeConfig): Set<string> {
  if (!config.project.resourceId.trim()) throw new Error('Restricted Mastra Code requires project.resourceId');
  if (!config.project.name.trim()) throw new Error('Restricted Mastra Code requires project.name');
  if (!config.project.rootPath.trim()) throw new Error('Restricted Mastra Code requires project.rootPath');
  if (config.modes.length === 0) throw new Error('Restricted Mastra Code requires at least one mode');
  if (config.memory === undefined) throw new Error('Restricted Mastra Code requires an explicit memory policy');

  const allowedTools = new Set<string>();
  for (const name of config.allowedTools) {
    if (!name.trim()) throw new Error('Restricted Mastra Code tool names must not be empty');
    allowedTools.add(name);
  }
  return allowedTools;
}

/** Bounds every controller mode by the host's global tool allowlist. */
function restrictModes(modes: AgentControllerMode[], allowedTools: Set<string>): AgentControllerMode[] {
  return modes.map(mode => ({
    ...mode,
    availableTools: (mode.availableTools ?? [...allowedTools]).filter(name => allowedTools.has(name)),
  }));
}

/** Filters static and request-scoped host tools before exposing them to the agent. */
function createRestrictedToolProvider(
  provider: RestrictedToolProvider | undefined,
  allowedTools: Set<string>,
): AgentConfig['tools'] {
  return async ({ requestContext }) => {
    const resolved = typeof provider === 'function' ? await provider({ requestContext }) : provider;
    if (!resolved) return {};

    return Object.fromEntries(
      Object.entries(resolved).filter(
        (entry): entry is [string, NonNullable<(typeof entry)[1]>] =>
          allowedTools.has(entry[0]) && entry[1] !== undefined,
      ),
    );
  };
}

/** Adapts an explicit host observer without enabling discovered hook configuration. */
function createRestrictedToolHooks(observer: RestrictedMastraCodeConfig['postToolObserver']): ToolHooks | undefined {
  if (!observer) return undefined;
  return {
    afterToolCall: async context => {
      await observer(context);
    },
  };
}

/**
 * Creates an uninitialized, restricted Mastra Code controller.
 *
 * Use {@link mountRestrictedAgentControllerOnMastra} for the normal server
 * lifecycle. This lower-level function is useful when the host owns controller
 * registration and initialization.
 */
export async function createRestrictedMastraCodeAgentController(config: RestrictedMastraCodeConfig) {
  const allowedTools = validateRestrictedConfig(config);
  const modes = restrictModes(config.modes, allowedTools);
  const defaultModeId =
    modes.find(mode => mode.metadata?.default === true)?.id ??
    modes.find(mode => mode.id === 'build')?.id ??
    modes[0]!.id;
  const memory = config.memory === false ? undefined : config.memory;

  const codeAgent = createCodingAgent({
    id: 'code-agent',
    name: 'Code Agent',
    workspace: undefined,
    model: config.model,
    instructions: config.instructions,
    tools: createRestrictedToolProvider(config.tools, allowedTools),
    hooks: createRestrictedToolHooks(config.postToolObserver),
    inputProcessors: config.inputProcessors ?? [],
    memory,
    signals: [],
  });

  const controller = new AgentController<MastraCodeState>({
    id: 'mastra-code',
    resourceId: config.project.resourceId,
    storage: config.storage,
    memory,
    pubsub: config.pubsub,
    stateSchema: restrictedStateSchema as PublicSchema<MastraCodeState>,
    agent: codeAgent,
    subagents: [],
    gateways: [],
    workspace: config.workspace,
    initialState: {
      ...config.initialState,
      yolo: false,
      skipGlobalInstructions: true,
      projectPath: config.project.rootPath,
      projectName: config.project.name,
      gitBranch: config.project.gitBranch,
      pluginSkillPaths: [],
      pluginCommandPaths: [],
      pluginInstructions: [],
    },
    modes,
    defaultModeId,
    intervalHandlers: [],
    idGenerator: config.idGenerator,
  });

  return {
    controller,
    storage: config.storage,
    memory,
    workspace: config.workspace,
    codeAgent,
    projectPath: config.project.rootPath,
    allowedTools: [...allowedTools],
  };
}

export type RestrictedMastraCodeAgentController = Awaited<ReturnType<typeof createRestrictedMastraCodeAgentController>>;

/**
 * Mounts a restricted Mastra Code controller without registering local
 * workflows or any discovery-backed capability.
 */
export async function mountRestrictedAgentControllerOnMastra(
  config: RestrictedMastraCodeMountConfig,
): Promise<RestrictedMastraCodeAgentController & { mastra: Mastra }> {
  const base = await createRestrictedMastraCodeAgentController(config);
  const controllerId = config.controllerId ?? base.controller.id;

  let mastra = config.mastra;
  if (mastra) {
    base.controller.__registerMastra(mastra);
  } else {
    const apiRoutes = config.buildApiRoutes?.({ controller: base.controller });
    const extraServerConfig = config.buildServerConfig?.({ controller: base.controller });
    const server = {
      ...extraServerConfig,
      ...(apiRoutes?.length ? { apiRoutes } : {}),
    };
    mastra = new Mastra({
      agentControllers: { [controllerId]: base.controller },
      storage: config.storage,
      ...(config.pubsub ? { pubsub: config.pubsub } : {}),
      ...(Object.keys(server).length ? { server } : {}),
    });
  }

  await base.controller.init();
  await mastra.startWorkers();
  return { ...base, mastra };
}
