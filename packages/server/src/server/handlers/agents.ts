import { Agent, isDurableAgentLike } from '@mastra/core/agent';
import type { AgentModelManagerConfig, DurableAgentLike } from '@mastra/core/agent';
import { AGENT_STREAM_TOPIC } from '@mastra/core/agent/durable';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { PROVIDER_REGISTRY } from '@mastra/core/llm';
import type { SystemMessage } from '@mastra/core/llm';
import type {
  InputProcessor,
  OutputProcessor,
  InputProcessorOrWorkflow,
  OutputProcessorOrWorkflow,
} from '@mastra/core/processors';
import type { RequestContext } from '@mastra/core/request-context';
import { zodToJsonSchema } from '@mastra/core/utils/zod-to-json';
import { stringify } from 'superjson';

import { z } from 'zod';
import { WORKSPACE_TOOLS, resolveToolConfig } from '../constants';
import type { WorkspaceToolName } from '../constants';

import { HTTPException } from '../http-exception';
import {
  agentIdPathParams,
  agentSkillPathParams,
  listAgentsResponseSchema,
  serializedAgentSchema,
  agentExecutionBodySchema,
  agentExecutionLegacyBodySchema,
  generateResponseSchema,
  streamResponseSchema,
  providersResponseSchema,
  approveToolCallBodySchema,
  declineToolCallBodySchema,
  toolCallResponseSchema,
  updateAgentModelBodySchema,
  reorderAgentModelListBodySchema,
  updateAgentModelInModelListBodySchema,
  modelManagementResponseSchema,
  modelConfigIdPathParams,
  enhanceInstructionsBodySchema,
  enhanceInstructionsResponseSchema,
  approveNetworkToolCallBodySchema,
  declineNetworkToolCallBodySchema,
  observeAgentBodySchema,
  observeAgentResponseSchema,
} from '../schemas/agents';
import { createStoredAgentResponseSchema } from '../schemas/stored-agents';
import { getAgentSkillResponseSchema } from '../schemas/workspace';
import type { ServerRoute } from '../server-adapter/routes';
import { createRoute } from '../server-adapter/routes/route-builder';
import type { Context } from '../types';

import { toSlug } from '../utils';

import { handleError } from './error';
import {
  sanitizeBody,
  validateBody,
  getEffectiveResourceId,
  getEffectiveThreadId,
  validateThreadOwnership,
} from './utils';

/**
 * Checks if a provider has its required API key environment variable(s) configured.
 * Handles provider IDs with suffixes (e.g., "openai.chat" -> "openai").
 * Also handles custom gateway providers that are stored with gateway prefix (e.g., "acme/acme-openai").
 * @param providerId - The provider identifier (may include a suffix like ".chat" or be from a custom gateway)
 * @returns true if all required environment variables are set, false otherwise
 */
export function isProviderConnected(providerId: string): boolean {
  // Clean provider ID (e.g., "openai.chat" -> "openai")
  const cleanId = providerId.includes('.') ? providerId.split('.')[0]! : providerId;

  // First, try direct lookup
  let provider = PROVIDER_REGISTRY[cleanId as keyof typeof PROVIDER_REGISTRY];

  // If not found and doesn't contain a slash, check if it exists with a gateway prefix
  // This handles custom gateway providers stored as "gateway/provider" in the registry
  if (!provider && !cleanId.includes('/')) {
    // Search for a provider ID that matches the pattern "*/cleanId"
    const registryKeys = Object.keys(PROVIDER_REGISTRY);
    const matchingKey = registryKeys.find(key => {
      // Check if the key matches the pattern "gateway/providerId"
      const parts = key.split('/');
      return parts.length === 2 && parts[1] === cleanId;
    });

    if (matchingKey) {
      provider = PROVIDER_REGISTRY[matchingKey as keyof typeof PROVIDER_REGISTRY];
    }
  }

  if (!provider) return false;

  const envVars = Array.isArray(provider.apiKeyEnvVar) ? provider.apiKeyEnvVar : [provider.apiKeyEnvVar];
  return envVars.every(envVar => !!process.env[envVar]);
}

export interface SerializedProcessor {
  id: string;
  name?: string;
}

export interface SerializedSkill {
  name: string;
  description: string;
  license?: string;
}

export interface SerializedTool {
  id: string;
  description?: string;
  inputSchema?: string;
  outputSchema?: string;
  requestContextSchema?: string;
  requireApproval?: boolean;
}

interface SerializedToolInput {
  id?: string;
  description?: string;
  inputSchema?: { jsonSchema?: unknown } | unknown;
  outputSchema?: { jsonSchema?: unknown } | unknown;
  requestContextSchema?: { jsonSchema?: unknown } | unknown;
}

export interface SerializedWorkflow {
  name: string;
  steps?: Record<string, { id: string; description?: string }>;
}

export interface SerializedAgent {
  name: string;
  description?: string;
  instructions?: SystemMessage;
  tools: Record<string, SerializedTool>;
  agents: Record<string, SerializedAgentDefinition>;
  workflows: Record<string, SerializedWorkflow>;
  skills: SerializedSkill[];
  workspaceTools: string[];
  /** ID of the agent's workspace (if configured) */
  workspaceId?: string;
  inputProcessors: SerializedProcessor[];
  outputProcessors: SerializedProcessor[];
  provider?: string;
  modelId?: string;
  modelVersion?: string;
  modelList?: Array<
    Omit<AgentModelManagerConfig, 'model'> & {
      model: {
        modelId: string;
        provider: string;
        modelVersion: string;
      };
    }
  >;
  // We can't use the true types here because they are not serializable
  defaultOptions?: Record<string, unknown>;
  defaultGenerateOptionsLegacy?: Record<string, unknown>;
  defaultStreamOptionsLegacy?: Record<string, unknown>;
  /** Serialized JSON schema for request context validation */
  requestContextSchema?: string;
  source?: 'code' | 'stored';
  status?: 'draft' | 'published' | 'archived';
  activeVersionId?: string;
  hasDraft?: boolean;
}

export interface SerializedAgentWithId extends SerializedAgent {
  id: string;
}

export async function getSerializedAgentTools(
  tools: Record<string, SerializedToolInput>,
  partial: boolean = false,
): Promise<Record<string, SerializedTool>> {
  return Object.entries(tools || {}).reduce<Record<string, SerializedTool>>((acc, [key, tool]) => {
    const toolId = tool.id ?? `tool-${key}`;

    let inputSchemaForReturn: string | undefined = undefined;
    let outputSchemaForReturn: string | undefined = undefined;
    let requestContextSchemaForReturn: string | undefined = undefined;

    // Only process schemas if not in partial mode
    if (!partial) {
      try {
        if (tool.inputSchema) {
          if (tool.inputSchema && typeof tool.inputSchema === 'object' && 'jsonSchema' in tool.inputSchema) {
            inputSchemaForReturn = stringify(tool.inputSchema.jsonSchema);
          } else if (typeof tool.inputSchema === 'function') {
            const inputSchema = tool.inputSchema();
            if (inputSchema && inputSchema.jsonSchema) {
              inputSchemaForReturn = stringify(inputSchema.jsonSchema);
            }
          } else if (tool.inputSchema) {
            inputSchemaForReturn = stringify(
              zodToJsonSchema(tool.inputSchema as Parameters<typeof zodToJsonSchema>[0]),
            );
          }
        }

        if (tool.outputSchema) {
          if (tool.outputSchema && typeof tool.outputSchema === 'object' && 'jsonSchema' in tool.outputSchema) {
            outputSchemaForReturn = stringify(tool.outputSchema.jsonSchema);
          } else if (typeof tool.outputSchema === 'function') {
            const outputSchema = tool.outputSchema();
            if (outputSchema && outputSchema.jsonSchema) {
              outputSchemaForReturn = stringify(outputSchema.jsonSchema);
            }
          } else if (tool.outputSchema) {
            outputSchemaForReturn = stringify(
              zodToJsonSchema(tool.outputSchema as Parameters<typeof zodToJsonSchema>[0]),
            );
          }
        }

        if (tool.requestContextSchema) {
          if (
            tool.requestContextSchema &&
            typeof tool.requestContextSchema === 'object' &&
            'jsonSchema' in tool.requestContextSchema
          ) {
            requestContextSchemaForReturn = stringify(tool.requestContextSchema.jsonSchema);
          } else if (typeof tool.requestContextSchema === 'function') {
            const requestContextSchema = (tool.requestContextSchema as () => { jsonSchema?: unknown })();
            if (requestContextSchema && requestContextSchema.jsonSchema) {
              requestContextSchemaForReturn = stringify(requestContextSchema.jsonSchema);
            }
          } else if (tool.requestContextSchema) {
            requestContextSchemaForReturn = stringify(
              zodToJsonSchema(tool.requestContextSchema as Parameters<typeof zodToJsonSchema>[0]),
            );
          }
        }
      } catch (error) {
        console.error(`Error getting serialized tool`, {
          toolId: tool.id,
          error,
        });
      }
    }

    acc[key] = {
      ...tool,
      id: toolId,
      inputSchema: inputSchemaForReturn,
      outputSchema: outputSchemaForReturn,
      requestContextSchema: requestContextSchemaForReturn,
    };
    return acc;
  }, {});
}

export function getSerializedProcessors(
  processors: (InputProcessor | OutputProcessor | InputProcessorOrWorkflow | OutputProcessorOrWorkflow)[],
): SerializedProcessor[] {
  return processors.map(processor => {
    // Processors are class instances or objects with a name property
    // Use the name property if available, otherwise fall back to constructor name
    return {
      id: processor.id,
      name: processor.name || processor.constructor.name,
    };
  });
}

/**
 * Extract skills from agent's workspace.
 * Uses agent.getWorkspace() to get the workspace and then workspace.skills.list().
 */
export async function getSerializedSkillsFromAgent(
  agent: Agent,
  requestContext?: RequestContext,
): Promise<SerializedSkill[]> {
  try {
    const workspace = await agent.getWorkspace({ requestContext });
    if (!workspace?.skills) {
      return [];
    }

    const skillsList = await workspace.skills.list();
    return skillsList.map(skill => ({
      name: skill.name,
      description: skill.description,
      license: skill.license,
    }));
  } catch {
    return [];
  }
}

/**
 * Get the list of available workspace tools for an agent.
 *
 * Tries to use core's `createWorkspaceTools` for an accurate tool list that
 * respects runtime availability (e.g. `@ast-grep/napi` for ast_edit).
 * Falls back to inlined config-based logic for older core versions that don't
 * export `createWorkspaceTools`.
 */
export async function getWorkspaceToolsFromAgent(agent: Agent, requestContext?: RequestContext): Promise<string[]> {
  try {
    const workspace = await agent.getWorkspace({ requestContext });
    if (!workspace) {
      return [];
    }

    // Try core's createWorkspaceTools — it checks runtime dep availability
    try {
      const mod = await import('@mastra/core/workspace');
      if (typeof mod.createWorkspaceTools === 'function') {
        return Object.keys(mod.createWorkspaceTools(workspace));
      }
    } catch {
      // Older core version without workspace module — fall through
    }

    // Fallback: inlined logic for older core versions.
    // Does not include AST_EDIT — only available via createWorkspaceTools above.
    const tools: string[] = [];
    const isReadOnly = workspace.filesystem?.readOnly ?? false;
    const toolsConfig = workspace.getToolsConfig();

    // Helper to check if a tool is enabled
    const isEnabled = (toolName: WorkspaceToolName) => {
      return resolveToolConfig(toolsConfig, toolName).enabled;
    };

    // Filesystem tools
    if (workspace.filesystem) {
      // Read tools
      if (isEnabled(WORKSPACE_TOOLS.FILESYSTEM.READ_FILE)) {
        tools.push(WORKSPACE_TOOLS.FILESYSTEM.READ_FILE);
      }
      if (isEnabled(WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES)) {
        tools.push(WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES);
      }
      if (isEnabled(WORKSPACE_TOOLS.FILESYSTEM.FILE_STAT)) {
        tools.push(WORKSPACE_TOOLS.FILESYSTEM.FILE_STAT);
      }

      // Write tools only if not readonly
      if (!isReadOnly) {
        if (isEnabled(WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE)) {
          tools.push(WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE);
        }
        if (isEnabled(WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE)) {
          tools.push(WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE);
        }
        if (isEnabled(WORKSPACE_TOOLS.FILESYSTEM.DELETE)) {
          tools.push(WORKSPACE_TOOLS.FILESYSTEM.DELETE);
        }
        if (isEnabled(WORKSPACE_TOOLS.FILESYSTEM.MKDIR)) {
          tools.push(WORKSPACE_TOOLS.FILESYSTEM.MKDIR);
        }
      }

      // Grep tool (filesystem-based, not BM25/vector)
      if (isEnabled(WORKSPACE_TOOLS.FILESYSTEM.GREP)) {
        tools.push(WORKSPACE_TOOLS.FILESYSTEM.GREP);
      }
    }

    // Search tools (available if BM25 or vector search is enabled)
    if (workspace.canBM25 || workspace.canVector) {
      if (isEnabled(WORKSPACE_TOOLS.SEARCH.SEARCH)) {
        tools.push(WORKSPACE_TOOLS.SEARCH.SEARCH);
      }
      if (!isReadOnly && isEnabled(WORKSPACE_TOOLS.SEARCH.INDEX)) {
        tools.push(WORKSPACE_TOOLS.SEARCH.INDEX);
      }
    }

    // Sandbox tools
    if (workspace.sandbox) {
      if (workspace.sandbox.executeCommand && isEnabled(WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND)) {
        tools.push(WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND);
      }
    }

    return tools;
  } catch {
    return [];
  }
}

interface SerializedAgentDefinition {
  id: string;
  name: string;
}

async function getSerializedAgentDefinition({
  agent,
  requestContext,
}: {
  agent: Agent;
  requestContext: RequestContext;
}): Promise<Record<string, SerializedAgentDefinition>> {
  let serializedAgentAgents: Record<string, SerializedAgentDefinition> = {};

  if ('listAgents' in agent) {
    const agents = await agent.listAgents({ requestContext });
    serializedAgentAgents = Object.entries(agents || {}).reduce<Record<string, SerializedAgentDefinition>>(
      (acc, [key, agent]) => {
        return {
          ...acc,
          [key]: { id: agent.id, name: agent.name },
        };
      },
      {},
    );
  }
  return serializedAgentAgents;
}

async function formatAgentList({
  id,
  mastra,
  agent,
  requestContext,
  partial = false,
}: {
  id: string;
  mastra: Context['mastra'];
  agent: Agent;
  requestContext: RequestContext;
  partial?: boolean;
}): Promise<SerializedAgentWithId> {
  const description = agent.getDescription();
  const instructions = await agent.getInstructions({ requestContext });
  const tools = await agent.listTools({ requestContext });
  const llm = await agent.getLLM({ requestContext });
  const defaultGenerateOptionsLegacy = await agent.getDefaultGenerateOptionsLegacy({ requestContext });
  const defaultStreamOptionsLegacy = await agent.getDefaultStreamOptionsLegacy({ requestContext });
  const defaultOptions = await agent.getDefaultOptions({ requestContext });
  const serializedAgentTools = await getSerializedAgentTools(tools, partial);

  let serializedAgentWorkflows: Record<
    string,
    { name: string; steps?: Record<string, { id: string; description?: string }> }
  > = {};

  const logger = mastra.getLogger();

  if ('listWorkflows' in agent) {
    try {
      const workflows = await agent.listWorkflows({ requestContext });
      serializedAgentWorkflows = Object.entries(workflows || {}).reduce<
        Record<string, { name: string; steps?: Record<string, { id: string; description?: string }> }>
      >((acc, [key, workflow]) => {
        return {
          ...acc,
          [key]: {
            name: workflow.name || 'Unnamed workflow',
          },
        };
      }, {});
    } catch (error) {
      logger.error('Error getting workflows for agent', { agentName: agent.name, error });
    }
  }

  const serializedAgentAgents = await getSerializedAgentDefinition({ agent, requestContext });

  // Get and serialize only user-configured processors (excludes memory-derived processors)
  // This ensures the UI only shows processors explicitly configured by the user
  let serializedInputProcessors: ReturnType<typeof getSerializedProcessors> = [];
  let serializedOutputProcessors: ReturnType<typeof getSerializedProcessors> = [];
  try {
    const configuredProcessorWorkflows = await agent.getConfiguredProcessorWorkflows();
    const inputProcessorWorkflows = configuredProcessorWorkflows.filter(w => w.id.endsWith('-input-processor'));
    const outputProcessorWorkflows = configuredProcessorWorkflows.filter(w => w.id.endsWith('-output-processor'));
    serializedInputProcessors = getSerializedProcessors(inputProcessorWorkflows);
    serializedOutputProcessors = getSerializedProcessors(outputProcessorWorkflows);
  } catch (error) {
    logger.error('Error getting configured processors for agent', { agentName: agent.name, error });
  }

  // Extract skills, workspace tools, and workspaceId from agent's workspace
  const serializedSkills = await getSerializedSkillsFromAgent(agent, requestContext);
  const workspaceTools = await getWorkspaceToolsFromAgent(agent, requestContext);

  // Get workspaceId if agent has a workspace
  let workspaceId: string | undefined;
  try {
    const workspace = await agent.getWorkspace({ requestContext });
    workspaceId = workspace?.id;
  } catch {
    // Agent doesn't have a workspace or can't access it
  }

  const model = llm?.getModel();
  const models = await agent.getModelList(requestContext);
  const modelList = models?.map(md => ({
    ...md,
    model: {
      modelId: md.model.modelId,
      provider: md.model.provider,
      modelVersion: md.model.specificationVersion,
    },
  }));

  // Serialize requestContextSchema if present
  let serializedRequestContextSchema: string | undefined;
  if (agent.requestContextSchema) {
    try {
      serializedRequestContextSchema = stringify(zodToJsonSchema(agent.requestContextSchema));
    } catch (error) {
      logger.error('Error serializing requestContextSchema for agent', { agentName: agent.name, error });
    }
  }

  return {
    id: agent.id || id,
    name: agent.name,
    description,
    instructions,
    agents: serializedAgentAgents,
    tools: serializedAgentTools,
    workflows: serializedAgentWorkflows,
    skills: serializedSkills,
    workspaceTools,
    workspaceId,
    inputProcessors: serializedInputProcessors,
    outputProcessors: serializedOutputProcessors,
    provider: llm?.getProvider(),
    modelId: llm?.getModelId(),
    modelVersion: model?.specificationVersion,
    defaultOptions,
    modelList,
    defaultGenerateOptionsLegacy,
    defaultStreamOptionsLegacy,
    requestContextSchema: serializedRequestContextSchema,
    source: (agent as any).source ?? 'code',
    ...(agent.toRawConfig()?.status
      ? { status: agent.toRawConfig()!.status as 'draft' | 'published' | 'archived' }
      : {}),
    ...(agent.toRawConfig()?.activeVersionId
      ? { activeVersionId: agent.toRawConfig()!.activeVersionId as string }
      : {}),
    hasDraft: !!(
      agent.toRawConfig()?.resolvedVersionId &&
      agent.toRawConfig()?.activeVersionId &&
      agent.toRawConfig()!.resolvedVersionId !== agent.toRawConfig()!.activeVersionId
    ),
  };
}

export async function getAgentFromSystem({ mastra, agentId }: { mastra: Context['mastra']; agentId: string }) {
  const logger = mastra.getLogger();

  if (!agentId) {
    throw new HTTPException(400, { message: 'Agent ID is required' });
  }

  let agent;

  try {
    agent = mastra.getAgentById(agentId);
  } catch (error) {
    logger.debug('Error getting agent from mastra, searching agents for agent', error);
  }

  if (!agent) {
    logger.debug(`Agent ${agentId} not found, looking through sub-agents`);
    const agents = mastra.listAgents();
    if (Object.keys(agents || {}).length) {
      for (const [_, ag] of Object.entries(agents)) {
        try {
          const subAgents = await ag.listAgents();

          if (subAgents[agentId]) {
            agent = subAgents[agentId];
            break;
          }
        } catch (error) {
          logger.debug('Error getting agent from agent', error);
        }
      }
    }
  }

  // If still not found, try to get stored agent
  if (!agent) {
    logger.debug(`Agent ${agentId} not found in code-defined agents, looking in stored agents`);
    try {
      agent = (await mastra.getEditor()?.agent.getById(agentId)) ?? null;
    } catch (error) {
      logger.debug('Error getting stored agent', error);
    }
  }

  if (!agent) {
    throw new HTTPException(404, { message: `Agent with id ${agentId} not found` });
  }

  return agent;
}

async function formatAgent({
  mastra,
  agent,
  requestContext,
  isStudio,
}: {
  mastra: Context['mastra'];
  agent: Agent;
  requestContext: RequestContext;
  isStudio: boolean;
}): Promise<SerializedAgent> {
  const description = agent.getDescription();

  const tools = await agent.listTools({ requestContext });
  const serializedAgentTools = await getSerializedAgentTools(tools);

  let serializedAgentWorkflows: Record<
    string,
    { name: string; steps: Record<string, { id: string; description?: string }> }
  > = {};

  if ('listWorkflows' in agent) {
    const logger = mastra.getLogger();
    try {
      const workflows = await agent.listWorkflows({ requestContext });

      serializedAgentWorkflows = Object.entries(workflows || {}).reduce<
        Record<string, { name: string; steps: Record<string, { id: string; description?: string }> }>
      >((acc, [key, workflow]) => {
        return {
          ...acc,
          [key]: {
            name: workflow.name || 'Unnamed workflow',
            steps: Object.entries(workflow.steps).reduce<Record<string, { id: string; description?: string }>>(
              (acc, [key, step]) => {
                return {
                  ...acc,
                  [key]: {
                    id: step.id,
                    description: step.description,
                  },
                };
              },
              {},
            ),
          },
        };
      }, {});
    } catch (error) {
      logger.error('Error getting workflows for agent', { agentName: agent.name, error });
    }
  }

  let proxyRequestContext = requestContext;
  if (isStudio) {
    proxyRequestContext = new Proxy(requestContext, {
      get(target, prop) {
        if (prop === 'get') {
          return function (key: string) {
            const value = target.get(key);
            return value ?? `<${key}>`;
          };
        }
        return Reflect.get(target, prop);
      },
    });
  }

  const instructions = await agent.getInstructions({ requestContext: proxyRequestContext });
  const llm = await agent.getLLM({ requestContext });
  const defaultGenerateOptionsLegacy = await agent.getDefaultGenerateOptionsLegacy({
    requestContext: proxyRequestContext,
  });
  const defaultStreamOptionsLegacy = await agent.getDefaultStreamOptionsLegacy({ requestContext: proxyRequestContext });
  const defaultOptions = await agent.getDefaultOptions({ requestContext: proxyRequestContext });

  const model = llm?.getModel();
  const models = await agent.getModelList(requestContext);
  const modelList = models?.map(md => ({
    ...md,
    model: {
      modelId: md.model.modelId,
      provider: md.model.provider,
      modelVersion: md.model.specificationVersion,
    },
  }));

  const serializedAgentAgents = await getSerializedAgentDefinition({ agent, requestContext: proxyRequestContext });

  // Get and serialize only user-configured processors (excludes memory-derived processors)
  // This ensures the UI only shows processors explicitly configured by the user
  let serializedInputProcessors: ReturnType<typeof getSerializedProcessors> = [];
  let serializedOutputProcessors: ReturnType<typeof getSerializedProcessors> = [];
  try {
    const configuredProcessorWorkflows = await agent.getConfiguredProcessorWorkflows();
    const inputProcessorWorkflows = configuredProcessorWorkflows.filter(w => w.id.endsWith('-input-processor'));
    const outputProcessorWorkflows = configuredProcessorWorkflows.filter(w => w.id.endsWith('-output-processor'));
    serializedInputProcessors = getSerializedProcessors(inputProcessorWorkflows);
    serializedOutputProcessors = getSerializedProcessors(outputProcessorWorkflows);
  } catch (error) {
    mastra.getLogger().error('Error getting configured processors for agent', { agentName: agent.name, error });
  }

  // Extract skills, workspace tools, and workspaceId from agent's workspace
  const serializedSkills = await getSerializedSkillsFromAgent(agent, proxyRequestContext);
  const workspaceTools = await getWorkspaceToolsFromAgent(agent, proxyRequestContext);

  // Get workspaceId if agent has a workspace
  let workspaceId: string | undefined;
  try {
    const workspace = await agent.getWorkspace({ requestContext: proxyRequestContext });
    workspaceId = workspace?.id;
  } catch {
    // Agent doesn't have a workspace or can't access it
  }

  // Serialize requestContextSchema if present
  let serializedRequestContextSchema: string | undefined;
  if (agent.requestContextSchema) {
    try {
      serializedRequestContextSchema = stringify(zodToJsonSchema(agent.requestContextSchema));
    } catch (error) {
      mastra.getLogger().error('Error serializing requestContextSchema for agent', { agentName: agent.name, error });
    }
  }

  return {
    name: agent.name,
    description,
    instructions,
    tools: serializedAgentTools,
    agents: serializedAgentAgents,
    workflows: serializedAgentWorkflows,
    skills: serializedSkills,
    workspaceTools,
    workspaceId,
    inputProcessors: serializedInputProcessors,
    outputProcessors: serializedOutputProcessors,
    provider: llm?.getProvider(),
    modelId: llm?.getModelId(),
    modelVersion: model?.specificationVersion,
    modelList,
    defaultOptions,
    defaultGenerateOptionsLegacy,
    defaultStreamOptionsLegacy,
    requestContextSchema: serializedRequestContextSchema,
    source: (agent as any).source ?? 'code',
    ...(agent.toRawConfig()?.status
      ? { status: agent.toRawConfig()!.status as 'draft' | 'published' | 'archived' }
      : {}),
  };
}

// ============================================================================
// Route Definitions (new pattern - handlers defined inline with createRoute)
// ============================================================================

export const LIST_AGENTS_ROUTE = createRoute({
  method: 'GET',
  path: '/agents',
  responseType: 'json',
  queryParamSchema: z.object({
    partial: z.string().optional(),
  }),
  responseSchema: listAgentsResponseSchema,
  summary: 'List all agents',
  description: 'Returns a list of all available agents in the system (both code-defined and stored)',
  tags: ['Agents'],
  requiresAuth: true,
  handler: async ({ mastra, requestContext, partial }) => {
    try {
      const codeAgents = mastra.listAgents();

      const isPartial = partial === 'true';

      // Serialize code-defined agents
      const serializedCodeAgentsMap = await Promise.all(
        Object.entries(codeAgents).map(async ([id, agent]) => {
          return formatAgentList({ id, mastra, agent, requestContext, partial: isPartial });
        }),
      );

      const serializedAgents = serializedCodeAgentsMap.reduce<Record<string, (typeof serializedCodeAgentsMap)[number]>>(
        (acc, { id, ...rest }) => {
          acc[id] = { id, ...rest };
          return acc;
        },
        {},
      );

      // Also fetch and include stored agents
      try {
        const editor = mastra.getEditor();

        let storedAgentsResult;
        try {
          storedAgentsResult = await editor?.agent.list();
        } catch (error) {
          console.error('Error listing stored agents:', error);
          storedAgentsResult = null;
        }

        if (storedAgentsResult?.agents) {
          // Process each agent individually to avoid one bad agent breaking the whole list
          for (const storedAgentConfig of storedAgentsResult.agents) {
            try {
              const agent = await editor?.agent.getById(storedAgentConfig.id, { status: 'draft' });
              if (!agent) continue;

              const serialized = await formatAgentList({
                id: agent.id,
                mastra,
                agent,
                requestContext,
                partial: isPartial,
              });

              // Don't overwrite code-defined agents with same ID
              if (!serializedAgents[serialized.id]) {
                serializedAgents[serialized.id] = serialized;
              }
            } catch (agentError) {
              // Log but continue with other agents
              const logger = mastra.getLogger();
              logger.warn('Failed to serialize stored agent', { agentId: storedAgentConfig.id, error: agentError });
            }
          }
        }
      } catch (storageError) {
        // Storage not configured or doesn't support agents - log and ignore
        const logger = mastra.getLogger();
        logger.debug('Could not fetch stored agents', { error: storageError });
      }

      return serializedAgents;
    } catch (error) {
      return handleError(error, 'Error getting agents');
    }
  },
});

export const GET_AGENT_BY_ID_ROUTE = createRoute({
  method: 'GET',
  path: '/agents/:agentId',
  responseType: 'json',
  pathParamSchema: agentIdPathParams,
  responseSchema: serializedAgentSchema,
  summary: 'Get agent by ID',
  description: 'Returns details for a specific agent including configuration, tools, and memory settings',
  tags: ['Agents'],
  requiresAuth: true,
  handler: async ({ agentId, mastra, requestContext }) => {
    try {
      const agent = await getAgentFromSystem({ mastra, agentId });
      const isStudio = false; // TODO: Get from context if needed
      const result = await formatAgent({
        mastra,
        agent,
        requestContext,
        isStudio,
      });
      return result;
    } catch (error) {
      return handleError(error, 'Error getting agent');
    }
  },
});

/**
 * POST /agents/:agentId/clone - Clone an agent to a stored agent
 */
export const CLONE_AGENT_ROUTE = createRoute({
  method: 'POST',
  path: '/agents/:agentId/clone',
  responseType: 'json',
  pathParamSchema: agentIdPathParams,
  bodySchema: z.object({
    newId: z.string().optional().describe('ID for the cloned agent. If not provided, derived from agent ID.'),
    newName: z.string().optional().describe('Name for the cloned agent. Defaults to "{name} (Clone)".'),
    metadata: z.record(z.string(), z.unknown()).optional(),
    authorId: z.string().optional(),
  }),
  responseSchema: createStoredAgentResponseSchema,
  summary: 'Clone agent',
  description: 'Clones a code-defined or stored agent to a new stored agent in the database',
  tags: ['Agents'],
  requiresAuth: true,
  handler: async ({ agentId, mastra, newId, newName, metadata, authorId, requestContext }) => {
    try {
      const editor = mastra.getEditor();
      if (!editor) {
        return handleError(new Error('Editor is not configured on the Mastra instance'), 'Error cloning agent');
      }

      const agent = await getAgentFromSystem({ mastra, agentId });

      const cloneId = toSlug(newId || `${agentId}-clone`);

      const result = await editor.agent.clone(agent, {
        newId: cloneId,
        newName,
        metadata,
        authorId,
        requestContext,
      });

      return result;
    } catch (error) {
      return handleError(error, 'Error cloning agent');
    }
  },
});

export const GENERATE_AGENT_ROUTE: ServerRoute<
  z.infer<typeof agentIdPathParams> & z.infer<typeof agentExecutionBodySchema>,
  unknown
> = createRoute({
  method: 'POST',
  path: '/agents/:agentId/generate',
  responseType: 'json',
  pathParamSchema: agentIdPathParams,
  bodySchema: agentExecutionBodySchema,
  responseSchema: generateResponseSchema,
  summary: 'Generate agent response',
  description: 'Executes an agent with the provided messages and returns the complete response',
  tags: ['Agents'],
  requiresAuth: true,
  handler: async ({ agentId, mastra, abortSignal, requestContext: serverRequestContext, ...params }) => {
    try {
      const agent = await getAgentFromSystem({ mastra, agentId });

      // UI Frameworks may send "client tools" in the body,
      // but it interferes with llm providers tool handling, so we remove them
      sanitizeBody(params, ['tools']);

      const { messages, memory: memoryOption, requestContext: bodyRequestContext, ...rest } = params;

      validateBody({ messages });

      // Merge body's requestContext values into the server's RequestContext instance
      // Only set values that don't already exist on the server context to prevent
      // clients from overwriting server-populated auth/tenant values
      if (bodyRequestContext && typeof bodyRequestContext === 'object') {
        for (const [key, value] of Object.entries(bodyRequestContext)) {
          if (serverRequestContext.get(key) === undefined) {
            serverRequestContext.set(key, value);
          }
        }
      }

      // Authorization: apply context overrides to memory option if present
      let authorizedMemoryOption = memoryOption;
      if (memoryOption) {
        const clientThreadId = typeof memoryOption.thread === 'string' ? memoryOption.thread : memoryOption.thread?.id;

        const effectiveResourceId = getEffectiveResourceId(serverRequestContext, memoryOption.resource);
        const effectiveThreadId = getEffectiveThreadId(serverRequestContext, clientThreadId);

        // Validate thread ownership if accessing an existing thread
        if (effectiveThreadId && effectiveResourceId) {
          const memoryInstance = await agent.getMemory({ requestContext: serverRequestContext });
          if (memoryInstance) {
            const thread = await memoryInstance.getThreadById({ threadId: effectiveThreadId });
            await validateThreadOwnership(thread, effectiveResourceId);
          }
        }

        // Build authorized memory option with effective values
        authorizedMemoryOption = {
          ...memoryOption,
          resource: effectiveResourceId ?? memoryOption.resource,
          thread: effectiveThreadId ?? memoryOption.thread,
        };
      }

      const result = await agent.generate<unknown>(messages, {
        ...rest,
        requestContext: serverRequestContext,
        memory: authorizedMemoryOption,
        abortSignal,
      });

      return result;
    } catch (error) {
      return handleError(error, 'Error generating from agent');
    }
  },
});

// Legacy routes (deprecated)
export const GENERATE_LEGACY_ROUTE = createRoute({
  method: 'POST',
  path: '/agents/:agentId/generate-legacy',
  responseType: 'json' as const,
  pathParamSchema: agentIdPathParams,
  bodySchema: agentExecutionLegacyBodySchema,
  responseSchema: generateResponseSchema,
  summary: '[DEPRECATED] Generate with legacy format',
  description: 'Legacy endpoint for generating agent responses. Use /agents/:agentId/generate instead.',
  tags: ['Agents', 'Legacy'],
  requiresAuth: true,
  handler: async ({ mastra, agentId, abortSignal, requestContext, ...params }) => {
    try {
      const agent = await getAgentFromSystem({ mastra, agentId });

      // UI Frameworks may send "client tools" in the body,
      // but it interferes with llm providers tool handling, so we remove them
      sanitizeBody(params, ['tools']);

      const { messages, resourceId, resourceid, threadId, ...rest } = params;
      // Use resourceId if provided, fall back to resourceid (deprecated)
      const clientResourceId = resourceId ?? resourceid;

      // Authorization: context values take precedence over client-provided values
      const effectiveResourceId = getEffectiveResourceId(requestContext, clientResourceId);
      const effectiveThreadId = getEffectiveThreadId(requestContext, threadId);

      validateBody({ messages });

      if ((effectiveThreadId && !effectiveResourceId) || (!effectiveThreadId && effectiveResourceId)) {
        throw new HTTPException(400, { message: 'Both threadId or resourceId must be provided' });
      }

      // Validate thread ownership if accessing an existing thread
      if (effectiveThreadId && effectiveResourceId) {
        const memory = await agent.getMemory({ requestContext });
        if (memory) {
          const thread = await memory.getThreadById({ threadId: effectiveThreadId });
          await validateThreadOwnership(thread, effectiveResourceId);
        }
      }

      const result = await agent.generateLegacy(messages, {
        ...rest,
        abortSignal,
        resourceId: effectiveResourceId ?? '',
        threadId: effectiveThreadId ?? '',
      });

      return result;
    } catch (error) {
      return handleError(error, 'Error generating from agent');
    }
  },
});

export const STREAM_GENERATE_LEGACY_ROUTE = createRoute({
  method: 'POST',
  path: '/agents/:agentId/stream-legacy',
  responseType: 'datastream-response' as const,
  pathParamSchema: agentIdPathParams,
  bodySchema: agentExecutionLegacyBodySchema,
  responseSchema: streamResponseSchema,
  summary: '[DEPRECATED] Stream with legacy format',
  description: 'Legacy endpoint for streaming agent responses. Use /agents/:agentId/stream instead.',
  tags: ['Agents', 'Legacy'],
  requiresAuth: true,
  handler: async ({ mastra, agentId, abortSignal, requestContext, ...params }) => {
    try {
      const agent = await getAgentFromSystem({ mastra, agentId });

      // UI Frameworks may send "client tools" in the body,
      // but it interferes with llm providers tool handling, so we remove them
      sanitizeBody(params, ['tools']);

      const { messages, resourceId, resourceid, threadId, ...rest } = params;
      // Use resourceId if provided, fall back to resourceid (deprecated)
      const clientResourceId = resourceId ?? resourceid;

      // Authorization: context values take precedence over client-provided values
      const effectiveResourceId = getEffectiveResourceId(requestContext, clientResourceId);
      const effectiveThreadId = getEffectiveThreadId(requestContext, threadId);

      validateBody({ messages });

      if ((effectiveThreadId && !effectiveResourceId) || (!effectiveThreadId && effectiveResourceId)) {
        throw new HTTPException(400, { message: 'Both threadId or resourceId must be provided' });
      }

      // Validate thread ownership if accessing an existing thread
      if (effectiveThreadId && effectiveResourceId) {
        const memory = await agent.getMemory({ requestContext });
        if (memory) {
          const thread = await memory.getThreadById({ threadId: effectiveThreadId });
          await validateThreadOwnership(thread, effectiveResourceId);
        }
      }

      const streamResult = await agent.streamLegacy(messages, {
        ...rest,
        abortSignal,
        resourceId: effectiveResourceId ?? '',
        threadId: effectiveThreadId ?? '',
      });

      const streamResponse = rest.output
        ? streamResult.toTextStreamResponse({
            headers: {
              'Transfer-Encoding': 'chunked',
            },
          })
        : streamResult.toDataStreamResponse({
            sendUsage: true,
            sendReasoning: true,
            getErrorMessage: (error: any) => {
              return `An error occurred while processing your request. ${error instanceof Error ? error.message : JSON.stringify(error)}`;
            },
            headers: {
              'Transfer-Encoding': 'chunked',
            },
          });

      return streamResponse;
    } catch (error) {
      return handleError(error, 'error streaming agent response');
    }
  },
});

export const GET_PROVIDERS_ROUTE = createRoute({
  method: 'GET',
  path: '/agents/providers',
  responseType: 'json',
  responseSchema: providersResponseSchema,
  summary: 'List AI providers',
  description: 'Returns a list of all configured AI model providers',
  tags: ['Agents'],
  requiresAuth: true,
  handler: async () => {
    try {
      const providers = Object.entries(PROVIDER_REGISTRY).map(([id, provider]) => {
        return {
          id,
          name: provider.name,
          label: (provider as any).label || provider.name,
          description: (provider as any).description || '',
          envVar: provider.apiKeyEnvVar,
          connected: isProviderConnected(id),
          docUrl: provider.docUrl,
          models: [...provider.models], // Convert readonly array to regular array
        };
      });
      return { providers };
    } catch (error) {
      return handleError(error, 'Error fetching providers');
    }
  },
});

export const GENERATE_AGENT_VNEXT_ROUTE: ServerRoute<
  z.infer<typeof agentIdPathParams> & z.infer<typeof agentExecutionBodySchema>,
  unknown
> = createRoute({
  method: 'POST',
  path: '/agents/:agentId/generate/vnext',
  responseType: 'json',
  pathParamSchema: agentIdPathParams,
  bodySchema: agentExecutionBodySchema,
  responseSchema: generateResponseSchema,
  summary: 'Generate a response from an agent',
  description: 'Generate a response from an agent',
  tags: ['Agents'],
  requiresAuth: true,
  handler: GENERATE_AGENT_ROUTE.handler,
});

export const STREAM_GENERATE_ROUTE = createRoute({
  method: 'POST',
  path: '/agents/:agentId/stream',
  responseType: 'stream' as const,
  streamFormat: 'sse' as const,
  pathParamSchema: agentIdPathParams,
  bodySchema: agentExecutionBodySchema,
  responseSchema: streamResponseSchema,
  summary: 'Stream agent response',
  description: 'Executes an agent with the provided messages and streams the response in real-time',
  tags: ['Agents'],
  requiresAuth: true,
  handler: async ({ mastra, agentId, abortSignal, requestContext: serverRequestContext, ...params }) => {
    try {
      const agent = await getAgentFromSystem({ mastra, agentId });

      // UI Frameworks may send "client tools" in the body,
      // but it interferes with llm providers tool handling, so we remove them
      sanitizeBody(params, ['tools']);

      const { messages, memory: memoryOption, requestContext: bodyRequestContext, ...rest } = params;
      validateBody({ messages });

      // Merge body's requestContext values into the server's RequestContext instance
      // Only set values that don't already exist on the server context to prevent
      // clients from overwriting server-populated auth/tenant values
      if (bodyRequestContext && typeof bodyRequestContext === 'object') {
        for (const [key, value] of Object.entries(bodyRequestContext)) {
          if (serverRequestContext.get(key) === undefined) {
            serverRequestContext.set(key, value);
          }
        }
      }

      // Authorization: apply context overrides to memory option if present
      let authorizedMemoryOption = memoryOption;
      if (memoryOption) {
        const clientThreadId = typeof memoryOption.thread === 'string' ? memoryOption.thread : memoryOption.thread?.id;

        const effectiveResourceId = getEffectiveResourceId(serverRequestContext, memoryOption.resource);
        const effectiveThreadId = getEffectiveThreadId(serverRequestContext, clientThreadId);

        // Validate thread ownership if accessing an existing thread
        if (effectiveThreadId && effectiveResourceId) {
          const memoryInstance = await agent.getMemory({ requestContext: serverRequestContext });
          if (memoryInstance) {
            const thread = await memoryInstance.getThreadById({ threadId: effectiveThreadId });
            await validateThreadOwnership(thread, effectiveResourceId);
          }
        }

        // Build authorized memory option with effective values
        authorizedMemoryOption = {
          ...memoryOption,
          resource: effectiveResourceId ?? memoryOption.resource,
          thread: effectiveThreadId ?? memoryOption.thread,
        };
      }

      const streamResult = await agent.stream<unknown>(messages, {
        ...rest,
        requestContext: serverRequestContext,
        memory: authorizedMemoryOption,
        abortSignal,
      });

      return streamResult.fullStream;
    } catch (error) {
      return handleError(error, 'error streaming agent response');
    }
  },
});

export const STREAM_GENERATE_VNEXT_DEPRECATED_ROUTE = createRoute({
  method: 'POST',
  path: '/agents/:agentId/stream/vnext',
  responseType: 'stream',
  pathParamSchema: agentIdPathParams,
  bodySchema: agentExecutionBodySchema,
  responseSchema: streamResponseSchema,
  summary: 'Stream a response from an agent',
  description: '[DEPRECATED] This endpoint is deprecated. Please use /stream instead.',
  tags: ['Agents'],
  requiresAuth: true,
  deprecated: true,
  handler: STREAM_GENERATE_ROUTE.handler,
});

export const OBSERVE_AGENT_STREAM_ROUTE = createRoute({
  method: 'POST',
  path: '/agents/:agentId/observe',
  responseType: 'stream' as const,
  streamFormat: 'sse' as const,
  pathParamSchema: agentIdPathParams,
  bodySchema: observeAgentBodySchema,
  responseSchema: observeAgentResponseSchema,
  summary: 'Observe agent stream',
  description:
    'Reconnect to an existing agent stream to receive missed events. Supports position-based resume with offset for efficient reconnection.',
  tags: ['Agents', 'Streaming'],
  requiresAuth: true,
  handler: async ({ mastra, agentId, runId, offset, abortSignal }) => {
    try {
      // Verify agent exists and get its pubsub for stream subscription.
      // Durable agents have their own CachingPubSub instance separate from mastra.pubsub,
      // so we must subscribe to the agent's pubsub to receive the correct stream events.
      const agent = await getAgentFromSystem({ mastra, agentId });
      const agentPubsub = isDurableAgentLike(agent) ? (agent as DurableAgentLike).pubsub : undefined;
      const pubsub = agentPubsub ?? mastra.pubsub;

      // Create a ReadableStream that subscribes to the agent stream topic
      // The stream adapter handles replay logic via subscribeWithReplay or subscribeFromOffset
      const topic = AGENT_STREAM_TOPIC(runId);
      let handleEvent: ((event: any) => void) | null = null;
      let idleTimer: ReturnType<typeof setTimeout> | null = null;

      // Idle timeout: close the stream if no events are received within 5 minutes.
      // This prevents subscription leaks when an agent crashes without emitting a terminal event.
      const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

      function cleanup(controller: ReadableStreamDefaultController) {
        if (idleTimer) {
          clearTimeout(idleTimer);
          idleTimer = null;
        }
        if (handleEvent) {
          void pubsub.unsubscribe(topic, handleEvent);
          handleEvent = null;
        }
        try {
          controller.close();
        } catch {
          // Stream may already be closed
        }
      }

      function resetIdleTimer(controller: ReadableStreamDefaultController) {
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(() => cleanup(controller), IDLE_TIMEOUT_MS);
      }

      const stream = new ReadableStream({
        start(controller) {
          // Wire up abortSignal for cleanup on client disconnect
          if (abortSignal) {
            if (abortSignal.aborted) {
              cleanup(controller);
              return;
            }
            abortSignal.addEventListener('abort', () => cleanup(controller), { once: true });
          }

          resetIdleTimer(controller);

          handleEvent = (event: any) => {
            const isTerminal = event.type === 'finish' || event.type === 'error';
            try {
              controller.enqueue(event);
            } catch {
              // Stream may be closed
            }
            if (isTerminal) {
              cleanup(controller);
            } else {
              resetIdleTimer(controller);
            }
          };

          // Subscribe with replay support
          const subscribePromise =
            offset !== undefined
              ? pubsub.subscribeFromOffset(topic, offset, handleEvent)
              : pubsub.subscribeWithReplay(topic, handleEvent);

          subscribePromise.catch((error: any) => {
            console.error(`[ObserveAgentStream] Failed to subscribe to ${topic}:`, error);
            if (idleTimer) {
              clearTimeout(idleTimer);
              idleTimer = null;
            }
            controller.error(error);
          });
        },
        cancel() {
          if (idleTimer) {
            clearTimeout(idleTimer);
            idleTimer = null;
          }
          if (handleEvent) {
            void pubsub.unsubscribe(topic, handleEvent);
            handleEvent = null;
          }
        },
      });

      return stream;
    } catch (error) {
      return handleError(error, 'error observing agent stream');
    }
  },
});

export const APPROVE_TOOL_CALL_ROUTE = createRoute({
  method: 'POST',
  path: '/agents/:agentId/approve-tool-call',
  responseType: 'stream' as const,
  streamFormat: 'sse' as const,
  pathParamSchema: agentIdPathParams,
  bodySchema: approveToolCallBodySchema,
  responseSchema: toolCallResponseSchema,
  summary: 'Approve tool call',
  description: 'Approves a pending tool call and continues agent execution',
  tags: ['Agents', 'Tools'],
  requiresAuth: true,
  handler: async ({ mastra, agentId, abortSignal, ...params }) => {
    try {
      const agent = await getAgentFromSystem({ mastra, agentId });

      if (!params.runId) {
        throw new HTTPException(400, { message: 'Run id is required' });
      }

      if (!params.toolCallId) {
        throw new HTTPException(400, { message: 'Tool call id is required' });
      }

      // UI Frameworks may send "client tools" in the body,
      // but it interferes with llm providers tool handling, so we remove them
      sanitizeBody(params, ['tools']);

      const streamResult = await agent.approveToolCall({
        ...params,
        abortSignal,
      });

      return streamResult.fullStream;
    } catch (error) {
      return handleError(error, 'error approving tool call');
    }
  },
});

export const DECLINE_TOOL_CALL_ROUTE = createRoute({
  method: 'POST',
  path: '/agents/:agentId/decline-tool-call',
  responseType: 'stream' as const,
  streamFormat: 'sse' as const,
  pathParamSchema: agentIdPathParams,
  bodySchema: declineToolCallBodySchema,
  responseSchema: toolCallResponseSchema,
  summary: 'Decline tool call',
  description: 'Declines a pending tool call and continues agent execution without executing the tool',
  tags: ['Agents', 'Tools'],
  requiresAuth: true,
  handler: async ({ mastra, agentId, abortSignal, ...params }) => {
    try {
      const agent = await getAgentFromSystem({ mastra, agentId });

      if (!params.runId) {
        throw new HTTPException(400, { message: 'Run id is required' });
      }

      if (!params.toolCallId) {
        throw new HTTPException(400, { message: 'Tool call id is required' });
      }

      // UI Frameworks may send "client tools" in the body,
      // but it interferes with llm providers tool handling, so we remove them
      sanitizeBody(params, ['tools']);

      const streamResult = await agent.declineToolCall({
        ...params,
        abortSignal,
      });

      return streamResult.fullStream;
    } catch (error) {
      return handleError(error, 'error declining tool call');
    }
  },
});

export const APPROVE_TOOL_CALL_GENERATE_ROUTE = createRoute({
  method: 'POST',
  path: '/agents/:agentId/approve-tool-call-generate',
  responseType: 'json' as const,
  pathParamSchema: agentIdPathParams,
  bodySchema: approveToolCallBodySchema,
  responseSchema: generateResponseSchema,
  summary: 'Approve tool call (non-streaming)',
  description: 'Approves a pending tool call and returns the complete response',
  tags: ['Agents', 'Tools'],
  requiresAuth: true,
  handler: async ({ mastra, agentId, abortSignal, ...params }) => {
    try {
      const agent = await getAgentFromSystem({ mastra, agentId });

      if (!params.runId) {
        throw new HTTPException(400, { message: 'Run id is required' });
      }

      if (!params.toolCallId) {
        throw new HTTPException(400, { message: 'Tool call id is required' });
      }

      // UI Frameworks may send "client tools" in the body,
      // but it interferes with llm providers tool handling, so we remove them
      sanitizeBody(params, ['tools']);

      const result = await agent.approveToolCallGenerate({
        ...params,
        abortSignal,
      });

      return result;
    } catch (error) {
      return handleError(error, 'error approving tool call');
    }
  },
});

export const DECLINE_TOOL_CALL_GENERATE_ROUTE = createRoute({
  method: 'POST',
  path: '/agents/:agentId/decline-tool-call-generate',
  responseType: 'json' as const,
  pathParamSchema: agentIdPathParams,
  bodySchema: declineToolCallBodySchema,
  responseSchema: generateResponseSchema,
  summary: 'Decline tool call (non-streaming)',
  description: 'Declines a pending tool call and returns the complete response',
  tags: ['Agents', 'Tools'],
  requiresAuth: true,
  handler: async ({ mastra, agentId, abortSignal, ...params }) => {
    try {
      const agent = await getAgentFromSystem({ mastra, agentId });

      if (!params.runId) {
        throw new HTTPException(400, { message: 'Run id is required' });
      }

      if (!params.toolCallId) {
        throw new HTTPException(400, { message: 'Tool call id is required' });
      }

      // UI Frameworks may send "client tools" in the body,
      // but it interferes with llm providers tool handling, so we remove them
      sanitizeBody(params, ['tools']);

      const result = await agent.declineToolCallGenerate({
        ...params,
        abortSignal,
      });

      return result;
    } catch (error) {
      return handleError(error, 'error declining tool call');
    }
  },
});

export const STREAM_NETWORK_ROUTE = createRoute({
  method: 'POST',
  path: '/agents/:agentId/network',
  responseType: 'stream' as const,
  streamFormat: 'sse' as const,
  pathParamSchema: agentIdPathParams,
  bodySchema: agentExecutionBodySchema,
  responseSchema: streamResponseSchema,
  summary: 'Stream agent network',
  description: 'Executes an agent network with multiple agents and streams the response',
  tags: ['Agents'],
  requiresAuth: true,
  handler: async ({ mastra, messages, agentId, ...params }) => {
    try {
      const agent = await getAgentFromSystem({ mastra, agentId });

      // UI Frameworks may send "client tools" in the body,
      // but it interferes with llm providers tool handling, so we remove them
      sanitizeBody(params, ['tools']);

      validateBody({ messages });

      const streamResult = await agent.network(messages, {
        ...params,
      });

      return streamResult;
    } catch (error) {
      return handleError(error, 'error streaming agent loop response');
    }
  },
});

export const APPROVE_NETWORK_TOOL_CALL_ROUTE = createRoute({
  method: 'POST',
  path: '/agents/:agentId/approve-network-tool-call',
  responseType: 'stream' as const,
  streamFormat: 'sse' as const,
  pathParamSchema: agentIdPathParams,
  bodySchema: approveNetworkToolCallBodySchema,
  responseSchema: streamResponseSchema,
  summary: 'Approve network tool call',
  description: 'Approves a pending network tool call and continues network agent execution',
  tags: ['Agents', 'Tools'],
  requiresAuth: true,
  handler: async ({ mastra, agentId, ...params }) => {
    try {
      const agent = await getAgentFromSystem({ mastra, agentId });

      if (!params.runId) {
        throw new HTTPException(400, { message: 'Run id is required' });
      }

      // UI Frameworks may send "client tools" in the body,
      // but it interferes with llm providers tool handling, so we remove them
      sanitizeBody(params, ['tools']);

      const streamResult = await agent.approveNetworkToolCall({
        ...params,
      });

      return streamResult;
    } catch (error) {
      return handleError(error, 'error approving network tool call');
    }
  },
});

export const DECLINE_NETWORK_TOOL_CALL_ROUTE = createRoute({
  method: 'POST',
  path: '/agents/:agentId/decline-network-tool-call',
  responseType: 'stream' as const,
  streamFormat: 'sse' as const,
  pathParamSchema: agentIdPathParams,
  bodySchema: declineNetworkToolCallBodySchema,
  responseSchema: streamResponseSchema,
  summary: 'Decline network tool call',
  description: 'Declines a pending network tool call and continues network agent execution without executing the tool',
  tags: ['Agents', 'Tools'],
  requiresAuth: true,
  handler: async ({ mastra, agentId, ...params }) => {
    try {
      const agent = await getAgentFromSystem({ mastra, agentId });

      if (!params.runId) {
        throw new HTTPException(400, { message: 'Run id is required' });
      }

      // UI Frameworks may send "client tools" in the body,
      // but it interferes with llm providers tool handling, so we remove them
      sanitizeBody(params, ['tools']);

      const streamResult = await agent.declineNetworkToolCall({
        ...params,
      });

      return streamResult;
    } catch (error) {
      return handleError(error, 'error declining network tool call');
    }
  },
});

export const UPDATE_AGENT_MODEL_ROUTE = createRoute({
  method: 'POST',
  path: '/agents/:agentId/model',
  responseType: 'json',
  pathParamSchema: agentIdPathParams,
  bodySchema: updateAgentModelBodySchema,
  responseSchema: modelManagementResponseSchema,
  summary: 'Update agent model',
  description: 'Updates the AI model used by the agent',
  tags: ['Agents', 'Models'],
  requiresAuth: true,
  handler: async ({ mastra, agentId, modelId, provider }) => {
    try {
      const agent = await getAgentFromSystem({ mastra, agentId });

      // Use the universal Mastra router format: provider/model
      const newModel = `${provider}/${modelId}`;

      // Update the model in-memory only (for temporary testing)
      // This allows users to test different models without persisting
      // To save permanently, users should use the Edit agent dialog
      agent.__updateModel({ model: newModel });

      return { message: 'Agent model updated' };
    } catch (error) {
      return handleError(error, 'error updating agent model');
    }
  },
});

export const RESET_AGENT_MODEL_ROUTE = createRoute({
  method: 'POST',
  path: '/agents/:agentId/model/reset',
  responseType: 'json',
  pathParamSchema: agentIdPathParams,
  responseSchema: modelManagementResponseSchema,
  summary: 'Reset agent model',
  description: 'Resets the agent model to its original configuration',
  tags: ['Agents', 'Models'],
  requiresAuth: true,
  handler: async ({ mastra, agentId }) => {
    try {
      const agent = await getAgentFromSystem({ mastra, agentId });

      agent.__resetToOriginalModel();

      return { message: 'Agent model reset to original' };
    } catch (error) {
      return handleError(error, 'error resetting agent model');
    }
  },
});

export const REORDER_AGENT_MODEL_LIST_ROUTE = createRoute({
  method: 'POST',
  path: '/agents/:agentId/models/reorder',
  responseType: 'json',
  pathParamSchema: agentIdPathParams,
  bodySchema: reorderAgentModelListBodySchema,
  responseSchema: modelManagementResponseSchema,
  summary: 'Reorder agent model list',
  description: 'Reorders the model list for agents with multiple model configurations',
  tags: ['Agents', 'Models'],
  requiresAuth: true,
  handler: async ({ mastra, agentId, reorderedModelIds }) => {
    try {
      const agent = await getAgentFromSystem({ mastra, agentId });

      const modelList = await agent.getModelList();
      if (!modelList || modelList.length === 0) {
        throw new HTTPException(400, { message: 'Agent model list is not found or empty' });
      }

      agent.reorderModels(reorderedModelIds);

      return { message: 'Model list reordered' };
    } catch (error) {
      return handleError(error, 'error reordering model list');
    }
  },
});

export const UPDATE_AGENT_MODEL_IN_MODEL_LIST_ROUTE = createRoute({
  method: 'POST',
  path: '/agents/:agentId/models/:modelConfigId',
  responseType: 'json',
  pathParamSchema: modelConfigIdPathParams,
  bodySchema: updateAgentModelInModelListBodySchema,
  responseSchema: modelManagementResponseSchema,
  summary: 'Update model in model list',
  description: 'Updates a specific model configuration in the agent model list',
  tags: ['Agents', 'Models'],
  requiresAuth: true,
  handler: async ({ mastra, agentId, modelConfigId, model: bodyModel, maxRetries, enabled }) => {
    try {
      const agent = await getAgentFromSystem({ mastra, agentId });

      const modelList = await agent.getModelList();
      if (!modelList || modelList.length === 0) {
        throw new HTTPException(400, { message: 'Agent model list is not found or empty' });
      }

      const modelConfig = modelList.find(config => config.id === modelConfigId);
      if (!modelConfig) {
        throw new HTTPException(404, { message: `Model config with id ${modelConfigId} not found` });
      }

      const newModel =
        bodyModel?.modelId && bodyModel?.provider ? `${bodyModel.provider}/${bodyModel.modelId}` : modelConfig.model;

      const updated = {
        ...modelConfig,
        model: newModel,
        ...(maxRetries !== undefined ? { maxRetries } : {}),
        ...(enabled !== undefined ? { enabled } : {}),
      };

      agent.updateModelInModelList(updated);

      return { message: 'Model updated in model list' };
    } catch (error) {
      return handleError(error, 'error updating model in model list');
    }
  },
});

const ENHANCE_SYSTEM_PROMPT_INSTRUCTIONS = `You are an expert system prompt engineer, specialized in analyzing and enhancing instructions to create clear, effective, and comprehensive system prompts. Your goal is to help users transform their basic instructions into well-structured system prompts that will guide AI behavior effectively.

Follow these steps to analyze and enhance the instructions:

1. ANALYSIS PHASE
- Identify the core purpose and goals
- Extract key constraints and requirements
- Recognize domain-specific terminology and concepts
- Note any implicit assumptions that should be made explicit

2. PROMPT STRUCTURE
Create a system prompt with these components:
a) ROLE DEFINITION
    - Clear statement of the AI's role and purpose
    - Key responsibilities and scope
    - Primary stakeholders and users
b) CORE CAPABILITIES
    - Main functions and abilities
    - Specific domain knowledge required
    - Tools and resources available
c) BEHAVIORAL GUIDELINES
    - Communication style and tone
    - Decision-making framework
    - Error handling approach
    - Ethical considerations
d) CONSTRAINTS & BOUNDARIES
    - Explicit limitations
    - Out-of-scope activities
    - Security and privacy considerations
e) SUCCESS CRITERIA
    - Quality standards
    - Expected outcomes
    - Performance metrics

3. QUALITY CHECKS
Ensure the prompt is:
- Clear and unambiguous
- Comprehensive yet concise
- Properly scoped
- Technically accurate
- Ethically sound

4. OUTPUT FORMAT
Return your response as JSON with exactly these two fields:
- explanation: A brief explanation of the changes you made and why
- new_prompt: The complete enhanced system prompt as a single string

Remember: A good system prompt should be specific enough to guide behavior but flexible enough to handle edge cases. Focus on creating prompts that are clear, actionable, and aligned with the intended use case.`;

// Helper to find the first model with a connected provider
async function findConnectedModel(agent: Agent): Promise<Awaited<ReturnType<Agent['getModel']>> | null> {
  const modelList = await agent.getModelList();

  if (modelList && modelList.length > 0) {
    // Find the first enabled model with a connected provider
    for (const modelConfig of modelList) {
      if (modelConfig.enabled !== false) {
        const model = modelConfig.model;
        if (isProviderConnected(model.provider)) {
          return model;
        }
      }
    }
    return null;
  }

  // No model list, check the default model
  const defaultModel = await agent.getModel();
  if (isProviderConnected(defaultModel.provider)) {
    return defaultModel;
  }
  return null;
}

type EnhanceInstructionsResponse = z.infer<typeof enhanceInstructionsResponseSchema>;

export const ENHANCE_INSTRUCTIONS_ROUTE = createRoute({
  method: 'POST',
  path: '/agents/:agentId/instructions/enhance',
  responseType: 'json',
  pathParamSchema: agentIdPathParams,
  bodySchema: enhanceInstructionsBodySchema,
  responseSchema: enhanceInstructionsResponseSchema,
  summary: 'Enhance agent instructions',
  description: 'Uses AI to enhance or modify agent instructions based on user feedback',
  tags: ['Agents'],
  requiresAuth: true,
  handler: async ({ mastra, agentId, instructions, comment }) => {
    try {
      const agent = await getAgentFromSystem({ mastra, agentId });

      // Find the first model with a connected provider (similar to how chat works)
      const model = await findConnectedModel(agent);
      if (!model) {
        throw new HTTPException(400, {
          message:
            'No model with a configured API key found. Please set the required environment variable for your model provider.',
        });
      }

      const systemPromptAgent = new Agent({
        id: 'system-prompt-enhancer',
        name: 'system-prompt-enhancer',
        instructions: ENHANCE_SYSTEM_PROMPT_INSTRUCTIONS,
        model,
      });

      const result = await systemPromptAgent.generate(
        `We need to improve the system prompt.
Current: ${instructions}
${comment ? `User feedback: ${comment}` : ''}`,
        {
          structuredOutput: {
            schema: enhanceInstructionsResponseSchema,
          },
        },
      );

      return (await result.object) as unknown as EnhanceInstructionsResponse;
    } catch (error) {
      return handleError(error, 'Error enhancing instructions');
    }
  },
});

export const STREAM_VNEXT_DEPRECATED_ROUTE = createRoute({
  method: 'POST',
  path: '/agents/:agentId/streamVNext',
  responseType: 'stream',
  pathParamSchema: agentIdPathParams,
  bodySchema: agentExecutionBodySchema,
  responseSchema: streamResponseSchema,
  summary: 'Stream a response from an agent',
  description: '[DEPRECATED] This endpoint is deprecated. Please use /stream instead.',
  tags: ['Agents'],
  requiresAuth: true,
  deprecated: true,
  handler: async () => {
    throw new HTTPException(410, { message: 'This endpoint is deprecated. Please use /stream instead.' });
  },
});

export const STREAM_UI_MESSAGE_VNEXT_DEPRECATED_ROUTE = createRoute({
  method: 'POST',
  path: '/agents/:agentId/stream/vnext/ui',
  responseType: 'stream',
  pathParamSchema: agentIdPathParams,
  bodySchema: agentExecutionBodySchema,
  responseSchema: streamResponseSchema,
  summary: 'Stream UI messages from an agent',
  description:
    '[DEPRECATED] This endpoint is deprecated. Please use the @mastra/ai-sdk package for uiMessage transformations',
  tags: ['Agents'],
  requiresAuth: true,
  deprecated: true,
  handler: async () => {
    try {
      throw new MastraError({
        category: ErrorCategory.USER,
        domain: ErrorDomain.MASTRA_SERVER,
        id: 'DEPRECATED_ENDPOINT',
        text: 'This endpoint is deprecated. Please use the @mastra/ai-sdk package to for uiMessage transformations',
      });
    } catch (error) {
      return handleError(error, 'error streaming agent response');
    }
  },
});

export const STREAM_UI_MESSAGE_DEPRECATED_ROUTE = createRoute({
  method: 'POST',
  path: '/agents/:agentId/stream/ui',
  responseType: 'stream',
  pathParamSchema: agentIdPathParams,
  bodySchema: agentExecutionBodySchema,
  responseSchema: streamResponseSchema,
  summary: 'Stream UI messages from an agent',
  description:
    '[DEPRECATED] This endpoint is deprecated. Please use the @mastra/ai-sdk package for uiMessage transformations',
  tags: ['Agents'],
  requiresAuth: true,
  deprecated: true,
  handler: STREAM_UI_MESSAGE_VNEXT_DEPRECATED_ROUTE.handler,
});

// ============================================================================
// Agent Skill Routes
// ============================================================================

export const GET_AGENT_SKILL_ROUTE = createRoute({
  method: 'GET',
  path: '/agents/:agentId/skills/:skillName',
  responseType: 'json',
  pathParamSchema: agentSkillPathParams,
  responseSchema: getAgentSkillResponseSchema,
  summary: 'Get agent skill',
  description: 'Returns details for a specific skill available to the agent via its workspace',
  tags: ['Agents', 'Skills'],
  handler: async ({ mastra, agentId, skillName, requestContext }) => {
    try {
      const agent = agentId ? mastra.getAgentById(agentId) : null;
      if (!agent) {
        throw new HTTPException(404, { message: 'Agent not found' });
      }

      // Get the agent's workspace
      const workspace = await agent.getWorkspace({ requestContext });
      if (!workspace?.skills) {
        throw new HTTPException(404, { message: 'Agent does not have skills configured' });
      }

      // Get the skill from the workspace
      const skill = await workspace.skills.get(skillName);
      if (!skill) {
        throw new HTTPException(404, { message: `Skill "${skillName}" not found` });
      }

      return {
        name: skill.name,
        description: skill.description,
        license: skill.license,
        compatibility: skill.compatibility,
        metadata: skill.metadata,
        path: skill.path,
        instructions: skill.instructions,
        source: skill.source,
        references: skill.references,
        scripts: skill.scripts,
        assets: skill.assets,
      };
    } catch (error) {
      return handleError(error, 'Error getting agent skill');
    }
  },
});
