import { Agent, isDurableAgentLike } from '@mastra/core/agent';
import type {
  AgentEditorConfig,
  AgentMessageInput,
  AgentModelManagerConfig,
  AgentSignalInput,
  DurableAgentLike,
} from '@mastra/core/agent';
import { AGENT_STREAM_TOPIC, DurableStepIds } from '@mastra/core/agent/durable';
import type { AIV5Type } from '@mastra/core/agent/message-list';
import type { VersionOverrides } from '@mastra/core/di';
import { mergeVersionOverrides, MASTRA_VERSIONS_KEY } from '@mastra/core/di';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { PROVIDER_REGISTRY, parseModelString, defaultGateways } from '@mastra/core/llm';
import type { ProviderConfig, SystemMessage } from '@mastra/core/llm';
import type {
  InputProcessor,
  OutputProcessor,
  InputProcessorOrWorkflow,
  OutputProcessorOrWorkflow,
} from '@mastra/core/processors';
import type { RequestContext } from '@mastra/core/request-context';
import { zodToJsonSchema } from '@mastra/core/utils/zod-to-json';
import { toStandardSchema, standardSchemaToJSONSchema } from '@mastra/schema-compat/schema';
import type { PublicSchema } from '@mastra/schema-compat/schema';
import { stringify } from 'superjson';

import { z } from 'zod/v4';
import {
  MASTRA_IS_STUDIO_KEY,
  MASTRA_RESOURCE_ID_KEY,
  WORKSPACE_TOOLS,
  isReservedRequestContextKey,
  resolveToolConfig,
} from '../constants';
import type { WorkspaceToolName } from '../constants';
import { MastraFGAPermissions } from '../fga-permissions';

import { HTTPException } from '../http-exception';
import {
  agentIdPathParams,
  agentSkillPathParams,
  agentVersionQuerySchema,
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
  sendToolApprovalBodySchema,
  sendToolApprovalResponseSchema,
  listSuspendedRunsQuerySchema,
  listSuspendedRunsResponseSchema,
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
  sendAgentMessageBodySchema,
  sendAgentSignalBodySchema,
  queueAgentMessageBodySchema,
  subscribeAgentThreadBodySchema,
  abortAgentThreadBodySchema,
  abortAgentThreadResponseSchema,
  streamUntilIdleBodySchema,
  resumeStreamBodySchema,
  resumeStreamUntilIdleBodySchema,
  recoverBodySchema,
} from '../schemas/agents';
import type { ProviderListItem } from '../schemas/agents';
import { createStoredAgentResponseSchema } from '../schemas/stored-agents';
import { getAgentSkillResponseSchema, skillDisambiguationQuerySchema } from '../schemas/workspace';
import type { InferParams, RouteSchemas, ServerRoute } from '../server-adapter/routes';
import { createRoute } from '../server-adapter/routes/route-builder';
import type { Context } from '../types';

import { toSlug } from '../utils';

import { handleError } from './error';
import {
  sanitizeBody,
  validateBody,
  getEffectiveResourceId,
  requireEffectiveResourceId,
  getEffectiveThreadId,
  enforceThreadAccess,
  validateThreadOwnership,
  validateRunOwnership,
} from './utils';

/**
 * Merge incoming version overrides onto a RequestContext.
 * Reads any existing overrides, shallow-merges per category, and writes back.
 */
function stashVersionOverrides(ctx: RequestContext, versions: VersionOverrides | undefined): void {
  if (!versions) return;
  const existingRaw = ctx.get(MASTRA_VERSIONS_KEY);
  const existing =
    existingRaw && typeof existingRaw === 'object' && !Array.isArray(existingRaw)
      ? (existingRaw as VersionOverrides)
      : undefined;
  const merged = mergeVersionOverrides(existing, versions);
  if (merged) {
    ctx.set(MASTRA_VERSIONS_KEY, merged);
  }
}

/**
 * Ensure `defaultStatus` is set on the version overrides in the RequestContext
 * so sub-agents inherit the same draft/published semantics as the parent.
 *
 * When the parent agent is resolved via a specific versionId (editor context),
 * sub-agents should default to `draft`. When resolved with published (main
 * chat), sub-agents default to `published`. An explicit `defaultStatus` from
 * the request body takes precedence.
 */
function ensureDefaultVersionStatus(ctx: RequestContext, versionOptions: { versionId: string } | undefined): void {
  const existingRaw = ctx.get(MASTRA_VERSIONS_KEY) as VersionOverrides | undefined;
  // Don't overwrite an explicit defaultStatus from the body
  if (existingRaw?.defaultStatus) return;

  const inferredStatus: 'draft' | 'published' = versionOptions ? 'draft' : 'published';
  const updated: VersionOverrides = { ...existingRaw, defaultStatus: inferredStatus };
  ctx.set(MASTRA_VERSIONS_KEY, updated);
}

function getIsStudioFromContext(requestContext: RequestContext): boolean {
  return requestContext.get(MASTRA_IS_STUDIO_KEY) === true;
}

function mergeBodyRequestContext(serverRequestContext: RequestContext, bodyRequestContext: unknown): void {
  if (!bodyRequestContext || typeof bodyRequestContext !== 'object') {
    return;
  }

  for (const [key, value] of Object.entries(bodyRequestContext)) {
    if (isReservedRequestContextKey(key)) continue;
    if (serverRequestContext.get(key) === undefined) {
      serverRequestContext.set(key, value);
    }
  }
}

function normalizePublicExecutionOptions(
  options: Record<string, unknown> | undefined,
  serverRequestContext: RequestContext,
): Record<string, unknown> | undefined {
  if (!options || typeof options !== 'object' || Array.isArray(options)) return undefined;

  const { actor: _actor, requestContext, ...normalized } = options;
  mergeBodyRequestContext(serverRequestContext, requestContext);
  return { ...normalized, requestContext: serverRequestContext };
}

function hasSuspendedToolCall(snapshot: Record<string, any>, toolCallId: string): boolean {
  const resumeTarget = snapshot.resumeLabels?.[toolCallId];
  const resumeStep = resumeTarget?.stepId ? snapshot.context?.[resumeTarget.stepId] : undefined;
  if (
    resumeStep?.status === 'suspended' &&
    (resumeStep.suspendPayload?.requireToolApproval ||
      resumeStep.suspendPayload?.toolCallSuspended ||
      resumeStep.suspendPayload?.toolCallId)
  ) {
    return true;
  }

  const visit = (value: unknown): boolean => {
    if (!value || typeof value !== 'object') return false;
    if (Array.isArray(value)) return value.some(visit);

    const record = value as Record<string, any>;
    const payload = record.suspendPayload;
    if (
      record.status === 'suspended' &&
      (payload?.requireToolApproval?.toolCallId === toolCallId || payload?.toolCallId === toolCallId)
    ) {
      return true;
    }
    return Object.values(record).some(visit);
  };

  return visit(snapshot.context);
}

async function validateDurableToolCallAccess({
  mastra,
  agent,
  runId,
  toolCallId,
  requestContext,
}: {
  mastra: any;
  agent: Agent;
  runId: string;
  toolCallId: string;
  requestContext: RequestContext;
}): Promise<void> {
  if (!isDurableAgentLike(agent)) return;

  const workflowsStore = await mastra.getStorage()?.getStore('workflows');
  const workflowRun = await workflowsStore?.getWorkflowRunById({
    workflowName: DurableStepIds.AGENTIC_LOOP,
    runId,
  });
  if (!workflowRun) {
    throw new HTTPException(403, { message: 'Access denied: durable run belongs to a different resource' });
  }

  let snapshot = workflowRun.snapshot as Record<string, any> | string | undefined;
  if (typeof snapshot === 'string') {
    try {
      snapshot = JSON.parse(snapshot) as Record<string, any>;
    } catch {
      snapshot = undefined;
    }
  }

  const input = snapshot?.context?.input;
  const persistedResourceIds = new Set(
    [
      workflowRun.resourceId,
      input?.state?.resourceId,
      input?.messageListState?.memoryInfo?.resourceId,
      input?.requestContextEntries?.[MASTRA_RESOURCE_ID_KEY],
    ].filter((resourceId): resourceId is string => typeof resourceId === 'string' && resourceId.length > 0),
  );
  const effectiveResourceId = getEffectiveResourceId(requestContext, undefined);
  const [persistedResourceId] = persistedResourceIds;
  if (persistedResourceIds.size > 1 || (persistedResourceId && persistedResourceId !== effectiveResourceId)) {
    throw new HTTPException(403, { message: 'Access denied: durable run belongs to a different resource' });
  }

  if (
    !snapshot ||
    snapshot.status !== 'suspended' ||
    input?.agentId !== agent.id ||
    !hasSuspendedToolCall(snapshot, toolCallId)
  ) {
    throw new HTTPException(403, { message: 'Access denied: tool call is not suspended on this durable run' });
  }
}

/**
 * Providers whose apiKeyEnvVar entries are aliases for the same credential (any one
 * suffices), rather than distinct required values (all needed — the default assumption).
 * Keep this list to cases with a confirmed alias relationship; see the "google" entry in
 * PROVIDER_OVERRIDES in packages/core/src/llm/model/gateways/models-dev.ts and #17343.
 */
const ALIASED_API_KEY_ENV_VAR_PROVIDERS = new Set(['google']);

/**
 * Checks if a provider has its required API key environment variable(s) configured.
 * Handles provider IDs with suffixes (e.g., "openai.chat" -> "openai").
 * Also handles custom gateway providers that are stored with gateway prefix (e.g., "acme/acme-openai").
 * @param providerId - The provider identifier (may include a suffix like ".chat" or be from a custom gateway)
 * @param customProviders - Optional record of custom gateway providers to check
 * @returns true if all required environment variables are set (or, for aliased providers, if any one is set), false otherwise
 */
export function isProviderConnected(providerId: string, customProviders?: Record<string, ProviderConfig>): boolean {
  // Vertex AI is a distinct provider from Google AI Studio and must not be collapsed to the
  // "google" registry entry below (e.g. "google.vertex.chat", "google.vertex.anthropic.chat",
  // or the bare docs-sidebar id "google-vertex"). Vertex has no registry entry of its own
  // (provider-registry.json is machine-generated from gateway APIs, so a hand-authored Vertex
  // entry there would be overwritten on the next regeneration).
  //
  // @ai-sdk/google-vertex's createVertex() calls loadSetting() for both project and location,
  // which throws unconditionally when the env var is absent (no default) — see
  // GOOGLE_VERTEX_PROJECT/GOOGLE_VERTEX_LOCATION in @ai-sdk/google-vertex's
  // google-vertex-provider.ts. Both are therefore hard requirements we can check directly.
  // GOOGLE_APPLICATION_CREDENTIALS is deliberately NOT required here: it's only one of several
  // ways Application Default Credentials can be supplied (gcloud CLI login, GCE/Cloud Run
  // metadata server also work with no env var at all), so requiring it would produce new false
  // negatives for anyone authenticated through one of those other paths.
  if (providerId === 'google-vertex' || providerId.startsWith('google.vertex')) {
    return !!(process.env.GOOGLE_VERTEX_PROJECT && process.env.GOOGLE_VERTEX_LOCATION);
  }

  // Clean provider ID (e.g., "openai.chat" -> "openai")
  const cleanId = providerId.includes('.') ? providerId.split('.')[0]! : providerId;

  // First, try direct lookup in static registry
  let provider: ProviderConfig | undefined = PROVIDER_REGISTRY[cleanId as keyof typeof PROVIDER_REGISTRY];

  // If not found, check custom providers
  if (!provider && customProviders) {
    provider = customProviders[cleanId];
  }

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

    if (!provider && customProviders) {
      const customMatchingKey = Object.keys(customProviders).find(key => {
        const parts = key.split('/');
        return parts.length === 2 && parts[1] === cleanId;
      });
      if (customMatchingKey) {
        provider = customProviders[customMatchingKey];
      }
    }
  }

  if (!provider) return false;

  const envVars = Array.isArray(provider.apiKeyEnvVar) ? provider.apiKeyEnvVar : [provider.apiKeyEnvVar];

  // Most providers with multiple apiKeyEnvVar entries need every one of them (e.g. Netlify's
  // NETLIFY_TOKEN + NETLIFY_SITE_ID are two distinct required values, checked separately by
  // NetlifyGateway.getApiKey — see packages/core/src/llm/model/gateways/netlify.ts). Google is a
  // deliberate exception: GOOGLE_API_KEY and GOOGLE_GENERATIVE_AI_API_KEY are aliases for the same
  // credential (see the "google" entry in PROVIDER_OVERRIDES in
  // packages/core/src/llm/model/gateways/models-dev.ts, and #17343), so only one needs to be set.
  if (ALIASED_API_KEY_ENV_VAR_PROVIDERS.has(cleanId)) {
    return envVars.some(envVar => !!process.env[envVar]);
  }
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
  path: string;
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

function resolveLazySchema(schema: unknown): unknown {
  if (typeof schema === 'function' && !('~standard' in schema)) {
    return resolveLazySchema(schema());
  }
  return schema;
}

function schemaToJsonSchema(schema: PublicSchema<unknown> | undefined) {
  if (!schema) {
    return undefined;
  }

  return standardSchemaToJSONSchema(toStandardSchema(schema), { target: 'draft-2020-12' });
}

export interface SerializedWorkflow {
  name: string;
  steps?: Record<string, { id: string; description?: string }>;
}

export interface SerializedAgent {
  name: string;
  description?: string;
  metadata?: Record<string, unknown>;
  instructions?: SystemMessage;
  tools: Record<string, SerializedTool>;
  agents: Record<string, SerializedAgentDefinition>;
  workflows: Record<string, SerializedWorkflow>;
  skills: SerializedSkill[];
  workspaceTools: string[];
  /** Browser tool names available to this agent (if browser is configured) */
  browserTools: string[];
  /** ID of the agent's workspace (if configured) */
  workspaceId?: string;
  inputProcessors: SerializedProcessor[];
  outputProcessors: SerializedProcessor[];
  provider?: string;
  modelId?: string;
  modelVersion?: string;
  supportsMemory?: boolean;
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

  source?: 'code' | 'stored' | 'fs';
  status?: 'draft' | 'published' | 'archived';
  activeVersionId?: string;
  hasDraft?: boolean;
  editor?: AgentEditorConfig;
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
        const inputSchema = schemaToJsonSchema(
          resolveLazySchema(tool.inputSchema) as PublicSchema<unknown> | undefined,
        );
        if (inputSchema !== undefined) {
          inputSchemaForReturn = stringify(inputSchema);
        }

        const outputSchema = schemaToJsonSchema(
          resolveLazySchema(tool.outputSchema) as PublicSchema<unknown> | undefined,
        );
        if (outputSchema !== undefined) {
          outputSchemaForReturn = stringify(outputSchema);
        }

        const requestContextSchema = schemaToJsonSchema(
          resolveLazySchema(tool.requestContextSchema) as PublicSchema<unknown> | undefined,
        );
        if (requestContextSchema !== undefined) {
          requestContextSchemaForReturn = stringify(requestContextSchema);
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
 * Extract skills from an agent (both inline and workspace skills).
 * Uses agent.listSkills() which merges agent-level and workspace-level skills.
 */
export async function getSerializedSkillsFromAgent(
  agent: Agent,
  requestContext?: RequestContext,
): Promise<SerializedSkill[]> {
  try {
    const skillsList = await agent.listSkills({ requestContext });
    return skillsList.map(skill => ({
      name: skill.name,
      description: skill.description,
      license: skill.license,
      path: skill.path,
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
        return Object.keys(await mod.createWorkspaceTools(workspace));
      }
    } catch {
      // Older core version without workspace module — fall through
    }

    // Fallback: inlined logic for older core versions.
    // Does not include AST_EDIT — only available via createWorkspaceTools above.
    const tools: string[] = [];
    const isReadOnly = workspace.filesystem?.readOnly ?? false;
    const toolsConfig = workspace.getToolsConfig();

    // Build context for dynamic config resolution
    const configContext = {
      workspace,
      requestContext: requestContext ? Object.fromEntries(requestContext.entries()) : {},
    };

    // Helper to check if a tool is enabled
    const isEnabled = async (toolName: WorkspaceToolName) => {
      return (await resolveToolConfig(toolsConfig, toolName, configContext)).enabled;
    };

    // Filesystem tools
    if (workspace.filesystem) {
      // Read tools
      if (await isEnabled(WORKSPACE_TOOLS.FILESYSTEM.READ_FILE)) {
        tools.push(WORKSPACE_TOOLS.FILESYSTEM.READ_FILE);
      }
      if (await isEnabled(WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES)) {
        tools.push(WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES);
      }
      if (await isEnabled(WORKSPACE_TOOLS.FILESYSTEM.FILE_STAT)) {
        tools.push(WORKSPACE_TOOLS.FILESYSTEM.FILE_STAT);
      }

      // Write tools only if not readonly
      if (!isReadOnly) {
        if (await isEnabled(WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE)) {
          tools.push(WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE);
        }
        if (await isEnabled(WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE)) {
          tools.push(WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE);
        }
        if (await isEnabled(WORKSPACE_TOOLS.FILESYSTEM.DELETE)) {
          tools.push(WORKSPACE_TOOLS.FILESYSTEM.DELETE);
        }
        if (await isEnabled(WORKSPACE_TOOLS.FILESYSTEM.MKDIR)) {
          tools.push(WORKSPACE_TOOLS.FILESYSTEM.MKDIR);
        }
      }

      // Grep tool (filesystem-based, not BM25/vector)
      if (await isEnabled(WORKSPACE_TOOLS.FILESYSTEM.GREP)) {
        tools.push(WORKSPACE_TOOLS.FILESYSTEM.GREP);
      }
    }

    // Search tools (available if BM25 or vector search is enabled)
    if (workspace.canBM25 || workspace.canVector) {
      if (await isEnabled(WORKSPACE_TOOLS.SEARCH.SEARCH)) {
        tools.push(WORKSPACE_TOOLS.SEARCH.SEARCH);
      }
      if (!isReadOnly && (await isEnabled(WORKSPACE_TOOLS.SEARCH.INDEX))) {
        tools.push(WORKSPACE_TOOLS.SEARCH.INDEX);
      }
    }

    // Sandbox tools
    if (workspace.sandbox) {
      if (workspace.sandbox.executeCommand && (await isEnabled(WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND))) {
        tools.push(WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND);
      }
    }

    return tools;
  } catch {
    return [];
  }
}

/**
 * Get the list of browser tool names for an agent.
 * Returns the tool names from the agent's browser provider if configured.
 */
export function getBrowserToolsFromAgent(agent: Agent, onError?: (error: unknown) => void): string[] {
  try {
    const browser = agent.browser;
    if (!browser) {
      return [];
    }
    return Object.keys(browser.getTools());
  } catch (error) {
    onError?.(error);
    return [];
  }
}

function createBrowserToolsErrorLogger(
  logger: ReturnType<Context['mastra']['getLogger']>,
  agentId: string,
): (error: unknown) => void {
  return error => logger.warn('Failed to get browser tools for agent', { agentId, error });
}

interface SerializedAgentDefinition {
  id: string;
  name: string;
}

async function getSerializedAgentDefinition({
  agent,
  requestContext,
  logger,
}: {
  agent: Agent;
  requestContext: RequestContext;
  logger?: ReturnType<Context['mastra']['getLogger']>;
}): Promise<Record<string, SerializedAgentDefinition>> {
  let serializedAgentAgents: Record<string, SerializedAgentDefinition> = {};

  if ('listAgents' in agent) {
    try {
      const agents = await agent.listAgents({ requestContext });
      serializedAgentAgents = Object.entries(agents || {}).reduce<Record<string, SerializedAgentDefinition>>(
        (acc, [key, agent]) => {
          acc[key] = { id: agent.id, name: agent.name ?? key };
          return acc;
        },
        {},
      );
    } catch (error) {
      logger?.warn('Error getting sub-agents for agent', { agentName: agent.name, error });
    }
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
  const logger = mastra.getLogger();

  const description = agent.getDescription();

  // Per-agent dynamic getters can throw (e.g. when their callbacks destructure
  // fields from `requestContext` that aren't present under the active preset).
  // Wrap each independent getter so a single failure doesn't abort the whole
  // serialization — the agent will still be listed with safe defaults, and the
  // failure is logged so the user can see what went wrong in `mastra dev`.
  let metadata: Record<string, unknown> | undefined;
  if (typeof agent.getMetadata === 'function') {
    try {
      metadata = await agent.getMetadata({ requestContext });
    } catch {}
  }

  let instructions: SystemMessage | undefined;
  try {
    instructions = await agent.getInstructions({ requestContext });
  } catch (error) {
    logger.warn('Error getting instructions for agent', { agentName: agent.name, error });
  }

  let tools: Record<string, SerializedToolInput> = {};
  try {
    tools = await agent.listTools({ requestContext });
  } catch (error) {
    logger.warn('Error listing tools for agent', { agentName: agent.name, error });
  }

  let llm: Awaited<ReturnType<Agent['getLLM']>> | undefined;
  try {
    llm = await agent.getLLM({ requestContext });
  } catch (error) {
    logger.warn('Error getting LLM for agent', { agentName: agent.name, error });
  }

  let defaultGenerateOptionsLegacy: Awaited<ReturnType<Agent['getDefaultGenerateOptionsLegacy']>> | undefined;
  try {
    defaultGenerateOptionsLegacy = await agent.getDefaultGenerateOptionsLegacy({ requestContext });
  } catch (error) {
    logger.warn('Error getting default generate options for agent', { agentName: agent.name, error });
  }

  let defaultStreamOptionsLegacy: Awaited<ReturnType<Agent['getDefaultStreamOptionsLegacy']>> | undefined;
  try {
    defaultStreamOptionsLegacy = await agent.getDefaultStreamOptionsLegacy({ requestContext });
  } catch (error) {
    logger.warn('Error getting default stream options for agent', { agentName: agent.name, error });
  }

  let defaultOptions: Awaited<ReturnType<Agent['getDefaultOptions']>> | undefined;
  try {
    defaultOptions = await agent.getDefaultOptions({ requestContext });
  } catch (error) {
    logger.warn('Error getting default options for agent', { agentName: agent.name, error });
  }

  const serializedAgentTools = await getSerializedAgentTools(tools, partial);

  let serializedAgentWorkflows: Record<
    string,
    { name: string; steps?: Record<string, { id: string; description?: string }> }
  > = {};

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

  const serializedAgentAgents = await getSerializedAgentDefinition({ agent, requestContext, logger });

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
  const browserTools = getBrowserToolsFromAgent(agent, createBrowserToolsErrorLogger(logger, agent.id));

  // Get workspaceId if agent has a workspace
  let workspaceId: string | undefined;
  try {
    const workspace = await agent.getWorkspace({ requestContext });
    workspaceId = workspace?.id;
  } catch {
    // Agent doesn't have a workspace or can't access it
  }

  const model = llm?.getModel();
  const supportsMemory =
    typeof (agent as Agent & { supportsMemory?: () => boolean }).supportsMemory === 'function'
      ? (agent as Agent & { supportsMemory: () => boolean }).supportsMemory()
      : true;

  let models: Awaited<ReturnType<Agent['getModelList']>> | undefined;
  try {
    models = await agent.getModelList(requestContext);
  } catch (error) {
    logger.warn('Error getting model list for agent', { agentName: agent.name, error });
  }
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
    metadata,
    instructions,
    agents: serializedAgentAgents,
    tools: serializedAgentTools,
    workflows: serializedAgentWorkflows,
    skills: serializedSkills,
    workspaceTools,
    browserTools,
    workspaceId,
    inputProcessors: serializedInputProcessors,
    outputProcessors: serializedOutputProcessors,
    provider:
      typeof agent.model === 'string'
        ? (parseModelString(agent.model).provider ?? llm?.getProvider())
        : llm?.getProvider(),
    modelId: typeof agent.model === 'string' ? parseModelString(agent.model).modelId : llm?.getModelId(),
    modelVersion: model?.specificationVersion,
    supportsMemory,
    defaultOptions,
    modelList,
    defaultGenerateOptionsLegacy,
    defaultStreamOptionsLegacy,
    requestContextSchema: serializedRequestContextSchema,
    source: (agent as any).source ?? 'code',
    editor: agent.__getEditorConfig?.(),
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

export function extractVersionOptions(
  requestContext?: RequestContext,
  bodyRequestContext?: Record<string, unknown>,
): { versionId: string } | undefined {
  // First check the server-populated RequestContext (e.g. from auth middleware)
  const agentVersionId = requestContext?.get('agentVersionId');
  if (typeof agentVersionId === 'string' && agentVersionId) {
    return { versionId: agentVersionId };
  }
  // Fall back to body requestContext — the client may send agentVersionId there
  // (e.g. the playground editor sends it so the correct stored version is loaded)
  const bodyVersionId = bodyRequestContext?.agentVersionId;
  if (typeof bodyVersionId === 'string' && bodyVersionId) {
    return { versionId: bodyVersionId };
  }
  return undefined;
}

export async function getAgentFromSystem({
  mastra,
  agentId,
  versionOptions,
  requestContext,
}: {
  mastra: Context['mastra'];
  agentId: string;
  versionOptions?: { status?: 'draft' | 'published' } | { versionId: string };
  requestContext?: RequestContext;
}): Promise<Agent> {
  const logger = mastra.getLogger();

  if (!agentId) {
    throw new HTTPException(400, { message: 'Agent ID is required' });
  }

  let agent: Agent | null | undefined;

  try {
    agent = mastra.getAgentById(agentId);
  } catch (error) {
    logger.debug('Error getting agent from mastra, searching agents for agent', error);
  }

  if (!agent) {
    logger.debug('Agent not found, looking through sub-agents', { agentId });
    const agents = mastra.listAgents();
    if (Object.keys(agents || {}).length) {
      for (const [_, ag] of Object.entries(agents)) {
        try {
          const subAgents = await ag.listAgents();

          const subAgent = subAgents[agentId];
          if (subAgent instanceof Agent) {
            agent = subAgent;
            break;
          }
        } catch (error) {
          logger.debug('Error getting agent from agent', error);
        }
      }
    }
  }

  // If a code-defined agent was found, apply stored config overrides (if any)
  if (agent && mastra.getEditor) {
    try {
      const editorAgent = mastra.getEditor()?.agent;
      if (editorAgent) {
        agent = await editorAgent.applyStoredOverrides(
          agent,
          versionOptions ?? { status: 'published' },
          requestContext,
        );
      }
    } catch (error) {
      logger.debug('Error applying stored overrides to code agent', error);
    }
  }

  // If still not found, try to get stored agent
  if (!agent) {
    logger.debug('Agent not found in code-defined agents, looking in stored agents', { agentId });
    try {
      agent = (await mastra.getEditor()?.agent.getById(agentId, versionOptions)) ?? null;
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
  let metadata: Record<string, unknown> | undefined;
  if (typeof agent.getMetadata === 'function') {
    try {
      metadata = await agent.getMetadata({ requestContext });
    } catch {}
  }

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

  const instructionsRequestContext = isStudio
    ? new Proxy(requestContext, {
        get(target, prop) {
          if (prop === 'get') {
            return function (key: string) {
              const value = target.get(key);
              return value ?? `<${key}>`;
            };
          }
          return Reflect.get(target, prop);
        },
      })
    : requestContext;

  const instructions = await agent.getInstructions({ requestContext: instructionsRequestContext });
  const llm = await agent.getLLM({ requestContext });
  const defaultGenerateOptionsLegacy = await agent.getDefaultGenerateOptionsLegacy({
    requestContext,
  });
  const defaultStreamOptionsLegacy = await agent.getDefaultStreamOptionsLegacy({ requestContext });
  const defaultOptions = await agent.getDefaultOptions({ requestContext });

  const model = llm?.getModel();
  const supportsMemory =
    typeof (agent as Agent & { supportsMemory?: () => boolean }).supportsMemory === 'function'
      ? (agent as Agent & { supportsMemory: () => boolean }).supportsMemory()
      : true;
  const models = await agent.getModelList(requestContext);
  const modelList = models?.map(md => ({
    ...md,
    model: {
      modelId: md.model.modelId,
      provider: md.model.provider,
      modelVersion: md.model.specificationVersion,
    },
  }));

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
    mastra.getLogger().error('Error getting configured processors for agent', { agentName: agent.name, error });
  }

  // Extract skills, workspace tools, and workspaceId from agent's workspace
  const serializedSkills = await getSerializedSkillsFromAgent(agent, requestContext);
  const workspaceTools = await getWorkspaceToolsFromAgent(agent, requestContext);
  const browserTools = getBrowserToolsFromAgent(agent, createBrowserToolsErrorLogger(mastra.getLogger(), agent.id));

  // Get workspaceId if agent has a workspace
  let workspaceId: string | undefined;
  try {
    const workspace = await agent.getWorkspace({ requestContext });
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
    metadata,
    instructions,
    tools: serializedAgentTools,
    agents: serializedAgentAgents,
    workflows: serializedAgentWorkflows,
    skills: serializedSkills,
    workspaceTools,
    browserTools,
    workspaceId,
    inputProcessors: serializedInputProcessors,
    outputProcessors: serializedOutputProcessors,
    provider:
      typeof agent.model === 'string'
        ? (parseModelString(agent.model).provider ?? llm?.getProvider())
        : llm?.getProvider(),
    modelId: typeof agent.model === 'string' ? parseModelString(agent.model).modelId : llm?.getModelId(),
    modelVersion: model?.specificationVersion,
    supportsMemory,
    modelList,
    defaultOptions,
    defaultGenerateOptionsLegacy,
    defaultStreamOptionsLegacy,
    requestContextSchema: serializedRequestContextSchema,
    source: (agent as any).source ?? 'code',
    editor: agent.__getEditorConfig?.(),
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
  requiresPermission: MastraFGAPermissions.AGENTS_READ,
  handler: async ({ mastra, requestContext, partial }) => {
    try {
      const codeAgents = mastra.listAgents();

      const isPartial = partial === 'true';

      // Apply stored config overrides to code-defined agents before serializing
      const editor = mastra.getEditor?.();
      const logger = mastra.getLogger();
      // Use `Promise.allSettled` so that one agent's catastrophic serialization
      // failure (e.g. an unhandled throw from a user-supplied dynamic config
      // callback) cannot reject the entire response. Failing agents are logged
      // and skipped, matching the existing stored-agent loop below.
      const serializedCodeAgentsMap = await Promise.allSettled(
        Object.entries(codeAgents).map(async ([id, agent]) => {
          let mergedAgent = agent;
          if (editor) {
            try {
              mergedAgent = await editor.agent.applyStoredOverrides(agent, undefined, requestContext);
            } catch {
              // If overrides fail, use the original code agent
            }
          }
          return formatAgentList({ id, mastra, agent: mergedAgent, requestContext, partial: isPartial });
        }),
      );

      const serializedAgents: Record<string, SerializedAgentWithId> = {};
      for (let i = 0; i < serializedCodeAgentsMap.length; i++) {
        const settled = serializedCodeAgentsMap[i]!;
        if (settled.status === 'fulfilled') {
          const { id, ...rest } = settled.value;
          serializedAgents[id] = { id, ...rest };
        } else {
          const agentId = Object.keys(codeAgents)[i];
          logger.warn('Failed to serialize agent', { agentId, error: settled.reason });
        }
      }

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

        // Build a set of code-defined agent IDs (keys in #agents may be config keys,
        // not agent.id). Stored configs sharing one of these IDs are overrides and
        // should not be hydrated as standalone stored agents.
        const codeAgentIds = new Set<string>();
        for (const [key, agent] of Object.entries(codeAgents)) {
          codeAgentIds.add(key);
          if (agent?.id) codeAgentIds.add(agent.id);
        }

        if (storedAgentsResult?.agents) {
          // Process each agent individually to avoid one bad agent breaking the whole list
          for (const storedAgentConfig of storedAgentsResult.agents) {
            // Skip stored configs that overlay an existing code-defined agent.
            // Those are overrides (no standalone model), not standalone stored agents,
            // and trying to hydrate them as standalone would fail model validation.
            if (codeAgentIds.has(storedAgentConfig.id)) continue;
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

      // Filter agents by FGA if configured
      const fgaProvider = mastra.getServer?.()?.fga;
      const user = requestContext?.get('user');
      if (fgaProvider && user) {
        const agentList = Object.values(serializedAgents) as unknown as Array<{ id: string }>;
        const accessible = await fgaProvider.filterAccessible(
          user,
          agentList,
          'agent',
          MastraFGAPermissions.AGENTS_READ,
        );
        const accessibleSet = new Set(accessible.map(a => a.id));
        for (const id of Object.keys(serializedAgents)) {
          if (!accessibleSet.has(id)) {
            delete serializedAgents[id];
          }
        }
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
  queryParamSchema: agentVersionQuerySchema,
  responseSchema: serializedAgentSchema,
  summary: 'Get agent by ID',
  description:
    'Returns details for a specific agent including configuration, tools, and memory settings. Use query params to control which stored config version is used for overrides: ?status=published (active version, default), ?status=draft (latest draft), or ?versionId=<id> (specific version). Use either status or versionId, not both.',
  tags: ['Agents'],
  requiresAuth: true,
  requiresPermission: MastraFGAPermissions.AGENTS_READ,
  handler: async ({ agentId, mastra, requestContext, status, versionId }) => {
    try {
      const versionOptions = versionId ? { versionId } : status ? { status } : undefined;
      const agent = await getAgentFromSystem({ mastra, agentId, versionOptions, requestContext });
      const isStudio = getIsStudioFromContext(requestContext);
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

      const agent = await getAgentFromSystem({
        mastra,
        agentId,
        versionOptions: extractVersionOptions(requestContext),
      });

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

export const GENERATE_AGENT_ROUTE = createRoute({
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
  requiresPermission: MastraFGAPermissions.AGENTS_EXECUTE,
  handler: async ({ agentId, mastra, abortSignal, requestContext: serverRequestContext, ...params }) => {
    try {
      // UI Frameworks may send "client tools" in the body,
      // but it interferes with llm providers tool handling, so we remove them
      sanitizeBody(params, ['tools', 'actor']);

      const { messages, memory: memoryOption, requestContext: bodyRequestContext, versions, ...rest } = params;

      validateBody({ messages });

      const versionOptions = extractVersionOptions(
        serverRequestContext,
        bodyRequestContext as Record<string, unknown> | undefined,
      );

      const agent = await getAgentFromSystem({
        mastra,
        agentId,
        versionOptions,
        requestContext: serverRequestContext,
      });

      // Merge body's requestContext values into the server's RequestContext instance.
      // Reserved keys stay server-controlled.
      mergeBodyRequestContext(serverRequestContext, bodyRequestContext);

      // Stash version overrides from body onto requestContext for sub-agent resolution
      stashVersionOverrides(serverRequestContext, versions);

      // Propagate draft/published default to sub-agents
      ensureDefaultVersionStatus(serverRequestContext, versionOptions);

      // Authorization: apply context overrides to memory option if present
      let authorizedMemoryOption = memoryOption;
      if (memoryOption) {
        const clientThreadId = typeof memoryOption.thread === 'string' ? memoryOption.thread : memoryOption.thread?.id;

        const effectiveResourceId = getEffectiveResourceId(serverRequestContext, memoryOption.resource);
        requireEffectiveResourceId(effectiveResourceId);
        const effectiveThreadId = getEffectiveThreadId(serverRequestContext, clientThreadId);

        // Validate thread ownership if accessing an existing thread
        if (effectiveThreadId) {
          const memoryInstance = await agent.getMemory({ requestContext: serverRequestContext });
          if (memoryInstance) {
            const thread = await memoryInstance.getThreadById({ threadId: effectiveThreadId });
            if (thread) {
              await enforceThreadAccess({
                mastra,
                requestContext: serverRequestContext,
                threadId: effectiveThreadId,
                thread,
                effectiveResourceId,
                permission: MastraFGAPermissions.MEMORY_WRITE,
              });
            }
          }
        }

        // Build authorized memory option with effective values
        authorizedMemoryOption = {
          ...memoryOption,
          resource: effectiveResourceId ?? memoryOption.resource,
          thread: effectiveThreadId ?? memoryOption.thread,
        };
      }

      const { structuredOutput, ...restOptions } = rest;

      const options = {
        ...restOptions,
        // Schema validates context permissively; runtime values are ModelMessages.
        context: restOptions.context as AIV5Type.ModelMessage[] | undefined,
        requestContext: serverRequestContext,
        memory: authorizedMemoryOption,
        abortSignal,
      };

      const result = structuredOutput
        ? await agent.generate(messages, { ...options, structuredOutput })
        : await agent.generate(messages, options);

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
      const agent = await getAgentFromSystem({
        mastra,
        agentId,
        versionOptions: extractVersionOptions(requestContext),
        requestContext,
      });

      // UI Frameworks may send "client tools" in the body,
      // but it interferes with llm providers tool handling, so we remove them
      sanitizeBody(params, ['tools', 'actor']);

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
      if (effectiveThreadId) {
        const memory = await agent.getMemory({ requestContext });
        if (memory) {
          const thread = await memory.getThreadById({ threadId: effectiveThreadId });
          if (thread) {
            await enforceThreadAccess({
              mastra,
              requestContext,
              threadId: effectiveThreadId,
              thread,
              effectiveResourceId,
              permission: MastraFGAPermissions.MEMORY_WRITE,
            });
          }
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
      const agent = await getAgentFromSystem({
        mastra,
        agentId,
        versionOptions: extractVersionOptions(requestContext),
        requestContext,
      });

      // UI Frameworks may send "client tools" in the body,
      // but it interferes with llm providers tool handling, so we remove them
      sanitizeBody(params, ['tools', 'actor']);

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
      if (effectiveThreadId) {
        const memory = await agent.getMemory({ requestContext });
        if (memory) {
          const thread = await memory.getThreadById({ threadId: effectiveThreadId });
          if (thread) {
            await enforceThreadAccess({
              mastra,
              requestContext,
              threadId: effectiveThreadId,
              thread,
              effectiveResourceId,
              permission: MastraFGAPermissions.MEMORY_WRITE,
            });
          }
        }
      }

      const streamResult = await agent.streamLegacy(messages, {
        ...rest,
        abortSignal,
        resourceId: effectiveResourceId ?? '',
        threadId: effectiveThreadId ?? '',
      });

      // Note: Do NOT set Transfer-Encoding header explicitly in the headers option.
      // Runtimes automatically add this header for streaming responses,
      // and setting it explicitly causes duplicate headers which break HTTP protocol.
      const streamResponse = rest.output
        ? streamResult.toTextStreamResponse()
        : // Without `output`, streamLegacy returns a StreamTextResult which has
          // toDataStreamResponse; TS resolves the object-stream overload because
          // `output` is optionally typed on the body schema.
          (
            streamResult as unknown as {
              toDataStreamResponse: (options: Record<string, unknown>) => Response;
            }
          ).toDataStreamResponse({
            sendUsage: true,
            sendReasoning: true,
            getErrorMessage: (error: any) => {
              // Sanitize the error message to prevent leaking internal details,
              // stack traces, or provider-specific error metadata to the client.
              // See: https://github.com/mastra-ai/mastra/issues/15827
              if (error instanceof Error) {
                const safeMessage = error.message
                  // Strip file paths (e.g. /home/user/..., C:\users\...)
                  .replace(/([A-Za-z]:)?[\/][^\s,)]+/g, '<path>')
                  // Strip stack-trace lines ("at Foo (bar.js:10:5)")
                  .replace(/\s+at\s+[^\n]*/g, '')
                  // Strip aiohttp/provider response bodies embedded in messages
                  .replace(/Response body:.*/s, '')
                  .trim();
                return `An error occurred while processing your request. ${safeMessage || 'Unknown error'}`;
              }
              // For non-Error objects, avoid JSON.stringify which could dump
              // entire error payloads (including secrets from provider responses).
              return 'An error occurred while processing your request.';
            },
          });

      return streamResponse;
    } catch (error) {
      return handleError(error, 'error streaming agent response');
    }
  },
});

/**
 * Collect the full list of configured AI model providers (static registry +
 * gateway providers) in the shape returned by `GET /agents/providers`.
 *
 * Extracted so the agent-builder available-models endpoint can reuse the exact
 * same source data before applying the model policy.
 */
export async function buildProvidersList(mastra: Context['mastra']): Promise<ProviderListItem[]> {
  const allProviders: Record<string, ProviderConfig> = {};

  // When AUTO_BLOCK_EXTERNAL_PROVIDERS is set, surface only providers from
  // user-registered custom gateways. The static registry (OpenAI, Anthropic,
  // Gemini, etc.) and the built-in default gateways (models.dev, netlify,
  // mastra) are all treated as "external" and hidden — useful for enterprise
  // deployments that route exclusively through their own gateway.
  const blockExternalProviders =
    process.env.AUTO_BLOCK_EXTERNAL_PROVIDERS === 'true' || process.env.AUTO_BLOCK_EXTERNAL_PROVIDERS === '1';
  const defaultGatewayIds = new Set<string>(defaultGateways.map(gateway => gateway.id));

  if (!blockExternalProviders) {
    for (const [id, provider] of Object.entries(PROVIDER_REGISTRY)) {
      allProviders[id] = provider as ProviderConfig;
    }
  }

  // Include gateway providers (defaults + user-registered)
  if (mastra) {
    const allGateways = mastra.listGateways();
    if (allGateways) {
      for (const gateway of Object.values(allGateways)) {
        // Skip models.dev gateway (already covered by PROVIDER_REGISTRY)
        if (gateway.id === 'models.dev') continue;
        // When blocking external providers, skip the built-in default gateways
        // so only user-registered custom gateways remain.
        if (blockExternalProviders && defaultGatewayIds.has(gateway.id)) continue;
        try {
          const gatewayProviders = await gateway.fetchProviders();
          for (const [providerId, config] of Object.entries(gatewayProviders)) {
            // Apply the same prefixing logic as registry-generator to avoid
            // creating duplicate entries alongside PROVIDER_REGISTRY data.
            // If providerId matches gateway.id, it's a unified gateway — use just the gateway ID.
            // Otherwise, prefix with gateway.id (e.g., "netlify/anthropic").
            const prefixedId = providerId === gateway.id ? gateway.id : `${gateway.id}/${providerId}`;
            // Only add if not already present from PROVIDER_REGISTRY to prevent
            // duplicates when PROVIDER_REGISTRY already has the prefixed key
            // (e.g. dev mode where GatewayRegistry includes custom gateways).
            if (!(prefixedId in allProviders)) {
              allProviders[prefixedId] = config;
            }
          }
        } catch (error) {
          console.warn(`Failed to fetch providers from gateway "${gateway.id}":`, error);
        }
      }
    }
  }

  return Object.entries(allProviders).map(([id, provider]) => {
    return {
      id,
      name: provider.name,
      label: (provider as any).label || provider.name,
      description: (provider as any).description || '',
      envVar: provider.apiKeyEnvVar,
      connected: isProviderConnected(id, allProviders),
      docUrl: provider.docUrl,
      models: [...provider.models],
    };
  });
}

export const GET_PROVIDERS_ROUTE = createRoute({
  method: 'GET',
  path: '/agents/providers',
  responseType: 'json',
  responseSchema: providersResponseSchema,
  summary: 'List AI providers',
  description: 'Returns a list of all configured AI model providers',
  tags: ['Agents'],
  requiresAuth: true,
  requiresPermission: ['agents:read'],
  handler: async ({ mastra }) => {
    try {
      const providers = await buildProvidersList(mastra);
      return { providers };
    } catch (error) {
      return handleError(error, 'Error fetching providers');
    }
  },
});

export const GENERATE_AGENT_VNEXT_ROUTE = createRoute({
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
  requiresPermission: MastraFGAPermissions.AGENTS_EXECUTE,
  handler: async ({ mastra, agentId, abortSignal, requestContext: serverRequestContext, ...params }) => {
    try {
      // UI Frameworks may send "client tools" in the body,
      // but it interferes with llm providers tool handling, so we remove them
      sanitizeBody(params, ['tools', 'actor']);

      const { messages, memory: memoryOption, requestContext: bodyRequestContext, versions, ...rest } = params;
      validateBody({ messages });

      const versionOptions = extractVersionOptions(
        serverRequestContext,
        bodyRequestContext as Record<string, unknown> | undefined,
      );

      const agent = await getAgentFromSystem({
        mastra,
        agentId,
        versionOptions,
        requestContext: serverRequestContext,
      });

      // Merge body's requestContext values into the server's RequestContext instance.
      // Reserved keys stay server-controlled.
      mergeBodyRequestContext(serverRequestContext, bodyRequestContext);

      // Stash version overrides from body onto requestContext for sub-agent resolution
      stashVersionOverrides(serverRequestContext, versions);

      // Propagate draft/published default to sub-agents
      ensureDefaultVersionStatus(serverRequestContext, versionOptions);

      // Authorization: apply context overrides to memory option if present
      let authorizedMemoryOption = memoryOption;
      if (memoryOption) {
        const clientThreadId = typeof memoryOption.thread === 'string' ? memoryOption.thread : memoryOption.thread?.id;

        const effectiveResourceId = getEffectiveResourceId(serverRequestContext, memoryOption.resource);
        requireEffectiveResourceId(effectiveResourceId);
        const effectiveThreadId = getEffectiveThreadId(serverRequestContext, clientThreadId);

        // Validate thread ownership if accessing an existing thread
        if (effectiveThreadId) {
          const memoryInstance = await agent.getMemory({ requestContext: serverRequestContext });
          if (memoryInstance) {
            const thread = await memoryInstance.getThreadById({ threadId: effectiveThreadId });
            if (thread) {
              await enforceThreadAccess({
                mastra,
                requestContext: serverRequestContext,
                threadId: effectiveThreadId,
                thread,
                effectiveResourceId,
                permission: MastraFGAPermissions.MEMORY_WRITE,
              });
            }
          }
        }

        // Build authorized memory option with effective values
        authorizedMemoryOption = {
          ...memoryOption,
          resource: effectiveResourceId ?? memoryOption.resource,
          thread: effectiveThreadId ?? memoryOption.thread,
        };
      }

      const { structuredOutput, untilIdle, ...restOptions } = rest;

      const options: Record<string, any> = {
        ...restOptions,
        requestContext: serverRequestContext,
        memory: authorizedMemoryOption,
        abortSignal,
      };

      // Support `untilIdle` option on the /stream endpoint — delegates to
      // the idle-loop wrapper internally (same behaviour as /stream-until-idle).
      if (untilIdle) {
        options.untilIdle = untilIdle;
      }

      const streamResult = structuredOutput
        ? await agent.stream(messages, { ...options, structuredOutput })
        : await agent.stream(messages, options);

      return streamResult.fullStream;
    } catch (error) {
      return handleError(error, 'error streaming agent response');
    }
  },
});

const sendAgentSignalResponseSchema: z.ZodType<{ accepted: true; runId: string; signal?: unknown }> = z.object({
  accepted: z.literal(true),
  runId: z.string(),
  signal: z.unknown().optional(),
});

/**
 * Maps a rejected `result.accepted` (signal/message routing) to an HTTP error.
 *
 * `accepted` only rejects on a setup/misconfig failure surfaced before the run
 * starts (e.g. no model selected, request-context validation, FGA denied) — these
 * are tagged `ErrorCategory.USER` and are the caller's fault, so they map to 400.
 * Anything else falls through to `handleError` (500 by default, or the error's own
 * status). Run/generation errors never reject `accepted`; they surface on the
 * `wake` output stream instead.
 */
function handleSignalRoutingError(error: unknown, defaultMessage: string): never {
  if (
    error instanceof MastraError &&
    error.category === ErrorCategory.USER &&
    !(error as { status?: unknown }).status &&
    !(error as { details?: { status?: unknown } }).details?.status
  ) {
    throw new HTTPException(400, { message: error.message, cause: error });
  }
  return handleError(error, defaultMessage);
}

const sendAgentMessageResponseSchema = sendAgentSignalResponseSchema;

export const SEND_AGENT_SIGNAL_ROUTE: ServerRoute<
  InferParams<typeof agentIdPathParams, undefined, typeof sendAgentSignalBodySchema>,
  z.infer<typeof sendAgentSignalResponseSchema>,
  'json',
  RouteSchemas<
    typeof agentIdPathParams,
    undefined,
    typeof sendAgentSignalBodySchema,
    typeof sendAgentSignalResponseSchema
  >,
  'POST',
  '/agents/:agentId/signals'
> = createRoute({
  method: 'POST',
  path: '/agents/:agentId/signals',
  responseType: 'json' as const,
  pathParamSchema: agentIdPathParams,
  bodySchema: sendAgentSignalBodySchema,
  responseSchema: sendAgentSignalResponseSchema,
  summary: 'Send agent signal',
  description: 'Sends a signal to an active agent run or starts a memory thread run when the thread is idle',
  tags: ['Agents', 'Streaming'],
  requiresAuth: true,
  requiresPermission: 'agents:execute',
  handler: async ({
    mastra,
    agentId,
    requestContext: serverRequestContext,
    signal,
    runId,
    resourceId,
    threadId,
    ifActive,
    ifIdle,
  }) => {
    try {
      const idleStreamOptions = ifIdle?.streamOptions as
        | (Record<string, unknown> & { requestContext?: Record<string, unknown>; versions?: VersionOverrides })
        | undefined;
      const bodyRequestContext = idleStreamOptions?.requestContext;
      const normalizedIdleStreamOptions = normalizePublicExecutionOptions(idleStreamOptions, serverRequestContext);
      const versionOptions = extractVersionOptions(serverRequestContext, bodyRequestContext);

      const agent = await getAgentFromSystem({
        mastra,
        agentId,
        versionOptions,
        requestContext: serverRequestContext,
      });
      stashVersionOverrides(
        serverRequestContext,
        normalizedIdleStreamOptions?.versions as VersionOverrides | undefined,
      );
      ensureDefaultVersionStatus(serverRequestContext, versionOptions);
      const effectiveResourceId = getEffectiveResourceId(serverRequestContext, resourceId);
      const effectiveThreadId = getEffectiveThreadId(serverRequestContext, threadId);
      const ifIdleWithContext = {
        ifIdle: {
          ...(ifIdle ?? {}),
          streamOptions: { ...(normalizedIdleStreamOptions ?? {}), requestContext: serverRequestContext } as any,
        },
      };

      if (effectiveThreadId && effectiveResourceId) {
        const memory = await agent.getMemory({ requestContext: serverRequestContext });
        if (memory) {
          const thread = await memory.getThreadById({ threadId: effectiveThreadId });
          await validateThreadOwnership(thread, effectiveResourceId);
        }
      }

      if (typeof (agent as { sendSignal?: unknown }).sendSignal !== 'function') {
        throw new HTTPException(501, { message: 'agent signals are not supported by this Mastra core version' });
      }

      const agentSignal = signal as AgentSignalInput;

      if (runId) {
        const result = await agent.sendSignal(agentSignal, {
          runId,
          ...(effectiveResourceId ? { resourceId: effectiveResourceId } : {}),
          ...(effectiveThreadId ? { threadId: effectiveThreadId } : {}),
          ...(ifActive ? { ifActive } : {}),
        });
        // `accepted` resolves once the runtime decides how to route the signal; it only
        // rejects on a setup/misconfig failure (e.g. no model), which `handleError` maps
        // below. `runId` is present on `wake`/`deliver` (a run exists); `persist`/`discard`
        // never start a run, so we fall back to the caller's `runId` to keep the wire
        // contract (`runId: string`) stable.
        const settled = await result.accepted;
        const settledRunId = 'runId' in settled ? settled.runId : runId;
        return result.signal === undefined
          ? { accepted: true as const, runId: settledRunId }
          : { accepted: true as const, runId: settledRunId, signal: result.signal };
      }

      if (!effectiveResourceId || !effectiveThreadId) {
        throw new HTTPException(400, { message: 'resourceId and threadId are required when runId is not provided' });
      }

      const result = await agent.sendSignal(agentSignal, {
        resourceId: effectiveResourceId,
        threadId: effectiveThreadId,
        ...(ifActive ? { ifActive } : {}),
        ...ifIdleWithContext,
      });
      // `accepted` carries the authoritative `runId` for `wake`/`deliver` (a run exists).
      // `persist`/`discard` never start a run; the stored-message id (`result.signal.id`)
      // is the correlatable id for those, keeping the wire contract (`runId: string`) stable.
      const settled = await result.accepted;
      const settledRunId = 'runId' in settled ? settled.runId : result.signal?.id;
      return result.signal === undefined
        ? { accepted: true as const, runId: settledRunId }
        : { accepted: true as const, runId: settledRunId, signal: result.signal };
    } catch (error) {
      return handleSignalRoutingError(error, 'error sending agent signal');
    }
  },
});

async function handleAgentMessageRoute({
  mastra,
  agentId,
  requestContext: serverRequestContext,
  message,
  runId,
  resourceId,
  threadId,
  ifActive,
  ifIdle,
  methodName,
}: {
  mastra: any;
  agentId: string;
  requestContext: RequestContext;
  message: AgentMessageInput;
  runId?: string;
  resourceId?: string;
  threadId?: string;
  ifActive?: { behavior?: 'deliver' | 'persist' | 'discard' };
  ifIdle?: { behavior?: 'wake' | 'persist' | 'discard'; streamOptions?: Record<string, unknown> };
  methodName: 'sendMessage' | 'queueMessage';
}) {
  const idleStreamOptions = ifIdle?.streamOptions as
    (Record<string, unknown> & { requestContext?: Record<string, unknown>; versions?: VersionOverrides }) | undefined;
  const bodyRequestContext = idleStreamOptions?.requestContext;
  const normalizedIdleStreamOptions = normalizePublicExecutionOptions(idleStreamOptions, serverRequestContext);
  const versionOptions = extractVersionOptions(serverRequestContext, bodyRequestContext);

  const agent = await getAgentFromSystem({
    mastra,
    agentId,
    versionOptions,
    requestContext: serverRequestContext,
  });
  stashVersionOverrides(serverRequestContext, normalizedIdleStreamOptions?.versions as VersionOverrides | undefined);
  ensureDefaultVersionStatus(serverRequestContext, versionOptions);
  const effectiveResourceId = getEffectiveResourceId(serverRequestContext, resourceId);
  const effectiveThreadId = getEffectiveThreadId(serverRequestContext, threadId);
  const ifIdleWithContext = {
    ifIdle: {
      ...(ifIdle ?? {}),
      streamOptions: { ...(normalizedIdleStreamOptions ?? {}), requestContext: serverRequestContext } as any,
    },
  };

  if (effectiveThreadId && effectiveResourceId) {
    const memory = await agent.getMemory({ requestContext: serverRequestContext });
    if (memory) {
      const thread = await memory.getThreadById({ threadId: effectiveThreadId });
      await validateThreadOwnership(thread, effectiveResourceId);
    }
  }

  if (typeof (agent as unknown as Record<string, unknown>)[methodName] !== 'function') {
    throw new HTTPException(501, { message: `agent ${methodName} is not supported by this Mastra core version` });
  }

  if (runId) {
    const result = await agent[methodName](message, {
      runId,
      ...(effectiveResourceId ? { resourceId: effectiveResourceId } : {}),
      ...(effectiveThreadId ? { threadId: effectiveThreadId } : {}),
      ...(ifActive ? { ifActive } : {}),
    } as any);
    const settled = await result.accepted;
    const settledRunId: string = settled && 'runId' in settled ? settled.runId : runId;
    return result.signal === undefined
      ? { accepted: true as const, runId: settledRunId }
      : { accepted: true as const, runId: settledRunId, signal: result.signal };
  }

  if (!effectiveResourceId || !effectiveThreadId) {
    throw new HTTPException(400, { message: 'resourceId and threadId are required when runId is not provided' });
  }

  const result = await agent[methodName](message, {
    resourceId: effectiveResourceId,
    threadId: effectiveThreadId,
    ...(ifActive ? { ifActive } : {}),
    ...ifIdleWithContext,
  } as any);
  const settled = await result.accepted;
  const settledRunId: string = settled && 'runId' in settled ? settled.runId : result.signal?.id;
  return result.signal === undefined
    ? { accepted: true as const, runId: settledRunId }
    : { accepted: true as const, runId: settledRunId, signal: result.signal };
}

export const SEND_AGENT_MESSAGE_ROUTE = createRoute({
  method: 'POST',
  path: '/agents/:agentId/send-message',
  responseType: 'json' as const,
  pathParamSchema: agentIdPathParams,
  bodySchema: sendAgentMessageBodySchema,
  responseSchema: sendAgentMessageResponseSchema,
  summary: 'Send agent message',
  description: 'Sends a user message to an active agent run or starts a memory thread run when the thread is idle',
  tags: ['Agents', 'Streaming'],
  requiresAuth: true,
  requiresPermission: 'agents:execute',
  handler: async params => {
    try {
      return await handleAgentMessageRoute({ ...params, methodName: 'sendMessage' });
    } catch (error) {
      return handleSignalRoutingError(error, 'error sending agent message');
    }
  },
});

export const QUEUE_AGENT_MESSAGE_ROUTE = createRoute({
  method: 'POST',
  path: '/agents/:agentId/queue-message',
  responseType: 'json' as const,
  pathParamSchema: agentIdPathParams,
  bodySchema: queueAgentMessageBodySchema,
  responseSchema: sendAgentMessageResponseSchema,
  summary: 'Queue agent message',
  description:
    'Queues a user message to run after the active thread run completes, or starts a memory thread run when idle',
  tags: ['Agents', 'Streaming'],
  requiresAuth: true,
  requiresPermission: 'agents:execute',
  handler: async params => {
    try {
      return await handleAgentMessageRoute({ ...params, methodName: 'queueMessage' });
    } catch (error) {
      return handleSignalRoutingError(error, 'error queueing agent message');
    }
  },
});

export const ABORT_AGENT_THREAD_ROUTE = createRoute({
  method: 'POST',
  path: '/agents/:agentId/threads/abort',
  responseType: 'json' as const,
  pathParamSchema: agentIdPathParams,
  bodySchema: abortAgentThreadBodySchema,
  responseSchema: abortAgentThreadResponseSchema,
  summary: 'Abort active agent thread run',
  description: 'Aborts the currently active stream run for a memory thread without changing thread subscriptions',
  tags: ['Agents', 'Streaming'],
  requiresAuth: true,
  requiresPermission: 'agents:execute',
  handler: async ({ mastra, agentId, resourceId, threadId, requestContext: serverRequestContext }) => {
    try {
      const agent = await getAgentFromSystem({ mastra, agentId, requestContext: serverRequestContext });
      if (typeof (agent as { abortThreadStream?: unknown }).abortThreadStream !== 'function') {
        throw new HTTPException(501, {
          message: 'agent thread aborts are not supported by this Mastra core version',
        });
      }

      const effectiveResourceId = getEffectiveResourceId(serverRequestContext, resourceId);
      const effectiveThreadId = getEffectiveThreadId(serverRequestContext, threadId);

      if (!effectiveThreadId) {
        throw new HTTPException(400, { message: 'threadId is required' });
      }

      if (effectiveResourceId) {
        const memory = await agent.getMemory({ requestContext: serverRequestContext });
        if (memory) {
          const thread = await memory.getThreadById({ threadId: effectiveThreadId });
          await validateThreadOwnership(thread, effectiveResourceId);
        }
      }

      const aborted = await agent.abortThreadStream({ resourceId: effectiveResourceId, threadId: effectiveThreadId });
      return { aborted };
    } catch (error) {
      return handleError(error, 'error aborting agent thread');
    }
  },
});

export const SUBSCRIBE_AGENT_THREAD_ROUTE = createRoute({
  method: 'POST',
  path: '/agents/:agentId/threads/subscribe',
  responseType: 'stream' as const,
  streamFormat: 'sse' as const,
  sseFlushOnConnect: true,
  pathParamSchema: agentIdPathParams,
  bodySchema: subscribeAgentThreadBodySchema,
  responseSchema: streamResponseSchema,
  summary: 'Subscribe to agent thread runs',
  description: 'Subscribes to future and active stream runs for a memory thread',
  tags: ['Agents', 'Streaming'],
  requiresAuth: true,
  requiresPermission: 'agents:execute',
  handler: async ({ mastra, agentId, resourceId, threadId, abortSignal, requestContext: serverRequestContext }) => {
    try {
      const agent = await getAgentFromSystem({ mastra, agentId, requestContext: serverRequestContext });
      if (typeof (agent as { subscribeToThread?: unknown }).subscribeToThread !== 'function') {
        throw new HTTPException(501, {
          message: 'agent thread subscriptions are not supported by this Mastra core version',
        });
      }

      const effectiveResourceId = getEffectiveResourceId(serverRequestContext, resourceId);
      const effectiveThreadId = getEffectiveThreadId(serverRequestContext, threadId);

      if (!effectiveThreadId) {
        throw new HTTPException(400, { message: 'threadId is required' });
      }

      if (effectiveResourceId) {
        const memory = await agent.getMemory({ requestContext: serverRequestContext });
        if (memory) {
          const thread = await memory.getThreadById({ threadId: effectiveThreadId });
          await validateThreadOwnership(thread, effectiveResourceId);
        }
      }

      const subscription = await agent.subscribeToThread({
        resourceId: effectiveResourceId,
        threadId: effectiveThreadId,
      });

      let cleanedUp = false;
      let heartbeat: ReturnType<typeof setTimeout> | undefined;
      const clearHeartbeat = () => {
        if (heartbeat) {
          clearTimeout(heartbeat);
          heartbeat = undefined;
        }
      };
      const cleanup = (closeController?: ReadableStreamDefaultController) => {
        if (cleanedUp) return;
        cleanedUp = true;
        clearHeartbeat();
        subscription.unsubscribe();
        if (closeController) {
          try {
            closeController.close();
          } catch {}
        }
      };

      return new ReadableStream({
        async start(controller) {
          const scheduleHeartbeat = () => {
            if (cleanedUp) return;
            clearHeartbeat();
            heartbeat = setTimeout(() => {
              heartbeat = undefined;
              if (cleanedUp) return;
              try {
                controller.enqueue(': heartbeat\n\n');
              } catch {
                cleanup();
                return;
              }
              scheduleHeartbeat();
            }, 25_000);
          };
          const abortCleanup = () => cleanup(controller);
          abortSignal?.addEventListener('abort', abortCleanup, { once: true });
          scheduleHeartbeat();

          try {
            for await (const part of subscription.stream) {
              controller.enqueue(part);
              scheduleHeartbeat();
            }
            cleanup(controller);
          } catch (error) {
            cleanup();
            controller.error(error);
          } finally {
            clearHeartbeat();
            abortSignal?.removeEventListener('abort', abortCleanup);
          }
        },
        cancel() {
          cleanup();
        },
      });
    } catch (error) {
      return handleError(error, 'error subscribing to agent thread');
    }
  },
});

export const STREAM_UNTIL_IDLE_GENERATE_ROUTE = createRoute({
  method: 'POST',
  path: '/agents/:agentId/stream-until-idle',
  responseType: 'stream' as const,
  streamFormat: 'sse' as const,
  pathParamSchema: agentIdPathParams,
  bodySchema: streamUntilIdleBodySchema,
  responseSchema: streamResponseSchema,
  summary: 'Stream agent response until idle',
  description:
    'Executes an agent with the provided messages and streams the response in real-time, also listens for background task completions and streams them in real-time',
  tags: ['Agents'],
  requiresAuth: true,
  requiresPermission: MastraFGAPermissions.AGENTS_EXECUTE,
  handler: async ({ mastra, agentId, abortSignal, requestContext: serverRequestContext, ...params }) => {
    try {
      // UI Frameworks may send "client tools" in the body,
      // but it interferes with llm providers tool handling, so we remove them
      sanitizeBody(params, ['tools', 'actor']);

      const { messages, memory: memoryOption, requestContext: bodyRequestContext, ...rest } = params;
      validateBody({ messages });

      const agent = await getAgentFromSystem({
        mastra,
        agentId,
        versionOptions: extractVersionOptions(
          serverRequestContext,
          bodyRequestContext as Record<string, unknown> | undefined,
        ),
        requestContext: serverRequestContext,
      });

      // Merge body's requestContext values into the server's RequestContext instance.
      // Reserved keys stay server-controlled.
      mergeBodyRequestContext(serverRequestContext, bodyRequestContext);

      // Authorization: apply context overrides to memory option if present
      let authorizedMemoryOption = memoryOption;
      if (memoryOption) {
        const clientThreadId = typeof memoryOption.thread === 'string' ? memoryOption.thread : memoryOption.thread?.id;

        const effectiveResourceId = getEffectiveResourceId(serverRequestContext, memoryOption.resource);
        requireEffectiveResourceId(effectiveResourceId);
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

      const { structuredOutput, ...restOptions } = rest;

      const options = {
        ...restOptions,
        // Schema validates context permissively; runtime values are ModelMessages.
        context: restOptions.context as AIV5Type.ModelMessage[] | undefined,
        requestContext: serverRequestContext,
        memory: authorizedMemoryOption,
        abortSignal,
      };

      const streamResult = structuredOutput
        ? await agent.streamUntilIdle(messages, { ...options, structuredOutput })
        : await agent.streamUntilIdle(messages, options);

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
  handler: async ({ mastra, agentId, abortSignal, requestContext, ...params }) => {
    try {
      const agent = await getAgentFromSystem({
        mastra,
        agentId,
        versionOptions: extractVersionOptions(requestContext),
      });

      if (!params.runId) {
        throw new HTTPException(400, { message: 'Run id is required' });
      }

      if (!params.toolCallId) {
        throw new HTTPException(400, { message: 'Tool call id is required' });
      }

      // UI Frameworks may send "client tools" in the body,
      // but it interferes with llm providers tool handling, so we remove them
      sanitizeBody(params, ['tools', 'actor']);

      await validateDurableToolCallAccess({
        mastra,
        agent,
        runId: params.runId,
        toolCallId: params.toolCallId,
        requestContext,
      });

      const streamResult = await agent.approveToolCall({
        ...params,
        requestContext,
        abortSignal,
      });

      return streamResult.fullStream;
    } catch (error) {
      return handleError(error, 'error approving tool call');
    }
  },
});

async function validateSubscriptionToolCallThreadAccess({
  agent,
  requestContext,
  resourceId,
  threadId,
}: {
  agent: Agent;
  requestContext: RequestContext;
  resourceId?: string;
  threadId?: string;
}) {
  const effectiveResourceId = getEffectiveResourceId(requestContext, resourceId);
  const effectiveThreadId = getEffectiveThreadId(requestContext, threadId);

  if (!effectiveThreadId) {
    throw new HTTPException(400, { message: 'threadId is required' });
  }

  if (effectiveResourceId) {
    const memory = await agent.getMemory({ requestContext });
    if (memory) {
      const thread = await memory.getThreadById({ threadId: effectiveThreadId });
      await validateThreadOwnership(thread, effectiveResourceId);
    }
  }

  return { effectiveResourceId: effectiveResourceId ?? '', effectiveThreadId };
}

export const SEND_TOOL_APPROVAL_ROUTE = createRoute({
  method: 'POST',
  path: '/agents/:agentId/send-tool-approval',
  responseType: 'json' as const,
  pathParamSchema: agentIdPathParams,
  bodySchema: sendToolApprovalBodySchema,
  responseSchema: sendToolApprovalResponseSchema,
  summary: 'Send tool approval',
  description: 'Approves or declines a pending tool call and publishes resumed chunks to thread subscribers',
  tags: ['Agents', 'Tools'],
  requiresAuth: true,
  requiresPermission: 'agents:execute',
  handler: async ({ mastra, agentId, abortSignal, requestContext: serverRequestContext, ...params }) => {
    try {
      const bodyRequestContext = (params as { requestContext?: Record<string, unknown> }).requestContext;
      const versionOptions = extractVersionOptions(serverRequestContext, bodyRequestContext);

      const agent = await getAgentFromSystem({
        mastra,
        agentId,
        versionOptions,
        requestContext: serverRequestContext,
      });

      if (!params.toolCallId) {
        throw new HTTPException(400, { message: 'Tool call id is required' });
      }

      mergeBodyRequestContext(serverRequestContext, bodyRequestContext);
      sanitizeBody(params, ['tools', 'actor']);
      const normalizedStreamOptions = normalizePublicExecutionOptions(
        params.streamOptions as Record<string, unknown> | undefined,
        serverRequestContext,
      );
      const { effectiveResourceId, effectiveThreadId } = await validateSubscriptionToolCallThreadAccess({
        agent,
        requestContext: serverRequestContext,
        resourceId: params.resourceId,
        threadId: params.threadId,
      });

      return await agent.sendToolApproval({
        ...params,
        ...(normalizedStreamOptions ? { streamOptions: normalizedStreamOptions } : {}),
        resourceId: effectiveResourceId,
        threadId: effectiveThreadId,
        requestContext: serverRequestContext,
        abortSignal,
      });
    } catch (error) {
      return handleError(error, 'error sending tool approval');
    }
  },
});

export const LIST_SUSPENDED_RUNS_ROUTE = createRoute({
  method: 'GET',
  path: '/agents/:agentId/suspended-runs',
  responseType: 'json' as const,
  pathParamSchema: agentIdPathParams,
  queryParamSchema: listSuspendedRunsQuerySchema,
  responseSchema: listSuspendedRunsResponseSchema,
  summary: 'List suspended runs',
  description:
    'Lists suspended agent runs from storage — runs waiting on a tool-call approval or on a tool that suspended. Works after a server restart and across instances.',
  tags: ['Agents', 'Tools'],
  requiresAuth: true,
  handler: async ({ mastra, agentId, requestContext, ...query }) => {
    try {
      const agent = await getAgentFromSystem({
        mastra,
        agentId,
        versionOptions: extractVersionOptions(requestContext),
      });

      // Honor server-enforced thread/resource scoping from the request context
      // so clients cannot list suspended runs outside their own scope.
      const effectiveResourceId = getEffectiveResourceId(requestContext, query.resourceId);
      const effectiveThreadId = getEffectiveThreadId(requestContext, query.threadId);

      // Validate ownership/FGA before honoring a thread filter — without this a
      // caller could probe another user's suspended approvals (including
      // tool-call args) by guessing a threadId. Reject when ownership cannot be
      // verified (no memory configured, or the thread does not exist) so a
      // thread-scoped query is never honored unchecked.
      if (effectiveThreadId) {
        const memory = await agent.getMemory({ requestContext });
        if (!memory) {
          throw new HTTPException(403, {
            message: 'Access denied: agent has no memory configured to validate thread ownership',
          });
        }
        const thread = await memory.getThreadById({ threadId: effectiveThreadId });
        if (!thread) {
          throw new HTTPException(403, { message: 'Access denied: thread not found' });
        }
        await enforceThreadAccess({
          mastra,
          requestContext,
          threadId: effectiveThreadId,
          thread,
          effectiveResourceId,
        });
      }

      return await agent.listSuspendedRuns({
        threadId: effectiveThreadId,
        resourceId: effectiveResourceId,
        fromDate: query.fromDate,
        toDate: query.toDate,
        perPage: query.perPage,
        page: query.page,
      });
    } catch (error) {
      return handleError(error, 'error listing suspended runs');
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
  handler: async ({ mastra, agentId, abortSignal, requestContext, ...params }) => {
    try {
      const agent = await getAgentFromSystem({
        mastra,
        agentId,
        versionOptions: extractVersionOptions(requestContext),
      });

      if (!params.runId) {
        throw new HTTPException(400, { message: 'Run id is required' });
      }

      if (!params.toolCallId) {
        throw new HTTPException(400, { message: 'Tool call id is required' });
      }

      // UI Frameworks may send "client tools" in the body,
      // but it interferes with llm providers tool handling, so we remove them
      sanitizeBody(params, ['tools', 'actor']);

      await validateDurableToolCallAccess({
        mastra,
        agent,
        runId: params.runId,
        toolCallId: params.toolCallId,
        requestContext,
      });

      const streamResult = await agent.declineToolCall({
        ...params,
        requestContext,
        abortSignal,
      });

      return streamResult.fullStream;
    } catch (error) {
      return handleError(error, 'error declining tool call');
    }
  },
});

export const RESUME_STREAM_ROUTE = createRoute({
  method: 'POST',
  path: '/agents/:agentId/resume-stream',
  responseType: 'stream' as const,
  streamFormat: 'sse' as const,
  pathParamSchema: agentIdPathParams,
  bodySchema: resumeStreamBodySchema,
  responseSchema: streamResponseSchema,
  summary: 'Resume agent stream',
  description: 'Resumes a suspended agent stream with custom resume data',
  tags: ['Agents'],
  requiresAuth: true,
  requiresPermission: MastraFGAPermissions.AGENTS_EXECUTE,
  handler: async ({ mastra, agentId, abortSignal, requestContext: serverRequestContext, ...params }) => {
    try {
      if (!params.runId) {
        throw new HTTPException(400, { message: 'Run id is required' });
      }

      sanitizeBody(params, ['tools', 'actor']);

      const {
        resumeData,
        runId,
        toolCallId,
        memory: memoryOption,
        requestContext: bodyRequestContext,
        versions,
        ...rest
      } = params;

      const versionOptions = extractVersionOptions(
        serverRequestContext,
        bodyRequestContext as Record<string, unknown> | undefined,
      );

      const agent = await getAgentFromSystem({
        mastra,
        agentId,
        versionOptions,
      });

      mergeBodyRequestContext(serverRequestContext, bodyRequestContext);

      stashVersionOverrides(serverRequestContext, versions);
      ensureDefaultVersionStatus(serverRequestContext, versionOptions);

      let authorizedMemoryOption = memoryOption;
      const clientThreadId = typeof memoryOption?.thread === 'string' ? memoryOption.thread : memoryOption?.thread?.id;
      const effectiveResourceId = getEffectiveResourceId(serverRequestContext, memoryOption?.resource);
      if (memoryOption) {
        requireEffectiveResourceId(effectiveResourceId);
      }
      const effectiveThreadId = getEffectiveThreadId(serverRequestContext, clientThreadId);

      if (effectiveThreadId) {
        const memoryInstance = await agent.getMemory({ requestContext: serverRequestContext });
        if (memoryInstance) {
          const thread = await memoryInstance.getThreadById({ threadId: effectiveThreadId });
          if (thread) {
            await enforceThreadAccess({
              mastra,
              requestContext: serverRequestContext,
              threadId: effectiveThreadId,
              thread,
              effectiveResourceId,
              permission: MastraFGAPermissions.MEMORY_WRITE,
            });
          }
        }
      }

      if (memoryOption || effectiveResourceId || effectiveThreadId) {
        authorizedMemoryOption = {
          ...memoryOption,
          ...(effectiveResourceId ? { resource: effectiveResourceId } : {}),
          ...(effectiveThreadId ? { thread: effectiveThreadId } : {}),
        } as NonNullable<typeof authorizedMemoryOption>;
      }

      const workflowsStore = await mastra.getStorage()?.getStore('workflows');
      const workflowRun = await workflowsStore?.getWorkflowRunById({ workflowName: 'agentic-loop', runId });
      await validateRunOwnership(workflowRun, getEffectiveResourceId(serverRequestContext, undefined));

      const { structuredOutput, untilIdle, ...restOptions } = rest;

      const options: Record<string, any> = {
        runId,
        toolCallId,
        ...restOptions,
        requestContext: serverRequestContext,
        memory: authorizedMemoryOption,
        abortSignal,
      };

      // Support `untilIdle` option on the /resume-stream endpoint — delegates
      // to the idle-loop wrapper internally (same behaviour as /resume-stream-until-idle).
      if (untilIdle) {
        options.untilIdle = untilIdle;
      }

      const streamResult = structuredOutput
        ? await agent.resumeStream(resumeData, { ...options, structuredOutput })
        : await agent.resumeStream(resumeData, options);

      return streamResult.fullStream;
    } catch (error) {
      return handleError(error, 'error resuming agent stream');
    }
  },
});

export const RECOVER_ROUTE = createRoute({
  method: 'POST',
  path: '/agents/:agentId/recover',
  responseType: 'stream' as const,
  streamFormat: 'sse' as const,
  pathParamSchema: agentIdPathParams,
  bodySchema: recoverBodySchema,
  responseSchema: streamResponseSchema,
  summary: 'Recover an orphaned durable agent run',
  description:
    'Re-drives an orphaned RUNNING durable-agent run after a process restart. Only supported on durable agents (createDurableAgent). Returns a stream that replays past chunks and continues the loop to completion.',
  tags: ['Agents'],
  requiresAuth: true,
  requiresPermission: MastraFGAPermissions.AGENTS_EXECUTE,
  handler: async ({ mastra, agentId, abortSignal, requestContext: serverRequestContext, ...params }) => {
    try {
      if (!params.runId) {
        throw new HTTPException(400, { message: 'Run id is required' });
      }

      const { runId, versions } = params;
      const bodyRequestContext = (params as { requestContext?: Record<string, unknown> }).requestContext;

      const versionOptions = extractVersionOptions(
        serverRequestContext,
        bodyRequestContext as Record<string, unknown> | undefined,
      );

      // Merge body-scoped context and apply version overrides BEFORE
      // resolving the agent, so that `getAgentFromSystem` picks the
      // correct draft/published version and any downstream agent lookups
      // (memory, tools) see the same stashed overrides. Mirrors the order
      // used by other execute-style routes that predate this one but
      // needed the same fix.
      mergeBodyRequestContext(serverRequestContext, bodyRequestContext);
      stashVersionOverrides(serverRequestContext, versions);
      ensureDefaultVersionStatus(serverRequestContext, versionOptions);

      const agent = await getAgentFromSystem({
        mastra,
        agentId,
        versionOptions,
      });

      // Durable-agent check via duck-typing to avoid a hard runtime dep on the
      // DurableAgent class inside @mastra/core (mirrors the pattern used by
      // Mastra.recoverAllDurableAgents()).
      if (!isDurableAgentLike(agent)) {
        throw new HTTPException(400, {
          message: 'Agent does not support recover. Only durable agents (createDurableAgent) can recover runs.',
        });
      }

      const workflowsStore = await mastra.getStorage()?.getStore('workflows');
      const workflowRun = await workflowsStore?.getWorkflowRunById({
        workflowName: DurableStepIds.AGENTIC_LOOP,
        runId,
      });
      await validateRunOwnership(workflowRun, getEffectiveResourceId(serverRequestContext, undefined));

      // NOTE: DurableAgent.recover() reads the workflow's requestContext from
      // the persisted snapshot. serverRequestContext is only used above for
      // ownership checks and version resolution.
      const streamResult = await (agent as any).recover(runId, {
        abortSignal,
      });

      return streamResult.fullStream;
    } catch (error) {
      return handleError(error, 'error recovering agent run');
    }
  },
});

export const RESUME_STREAM_UNTIL_IDLE_ROUTE = createRoute({
  method: 'POST',
  path: '/agents/:agentId/resume-stream-until-idle',
  responseType: 'stream' as const,
  streamFormat: 'sse' as const,
  pathParamSchema: agentIdPathParams,
  bodySchema: resumeStreamUntilIdleBodySchema,
  responseSchema: streamResponseSchema,
  summary: 'Resume agent stream until idle',
  description:
    'Resumes a suspended agent stream until idle with custom resume data, also listens for background task completions and streams them in real-time',
  tags: ['Agents'],
  requiresAuth: true,
  requiresPermission: 'agents:execute',
  handler: async ({ mastra, agentId, abortSignal, requestContext: serverRequestContext, ...params }) => {
    try {
      if (!params.runId) {
        throw new HTTPException(400, { message: 'Run id is required' });
      }

      sanitizeBody(params, ['tools', 'actor']);

      const {
        resumeData,
        runId,
        toolCallId,
        memory: memoryOption,
        requestContext: bodyRequestContext,
        versions,
        ...rest
      } = params;

      // Honor body-scoped `requestContext.agentVersionId` so callers
      // resuming a suspended draft / versioned agent get the right one.
      // Mirrors RESUME_STREAM_ROUTE.
      const versionOptions = extractVersionOptions(
        serverRequestContext,
        bodyRequestContext as Record<string, unknown> | undefined,
      );

      const agent = await getAgentFromSystem({
        mastra,
        agentId,
        versionOptions,
      });

      mergeBodyRequestContext(serverRequestContext, bodyRequestContext);

      stashVersionOverrides(serverRequestContext, versions);
      ensureDefaultVersionStatus(serverRequestContext, versionOptions);

      let authorizedMemoryOption = memoryOption;
      const clientThreadId = typeof memoryOption?.thread === 'string' ? memoryOption.thread : memoryOption?.thread?.id;
      const effectiveResourceId = getEffectiveResourceId(serverRequestContext, memoryOption?.resource);
      if (memoryOption) {
        requireEffectiveResourceId(effectiveResourceId);
      }
      const effectiveThreadId = getEffectiveThreadId(serverRequestContext, clientThreadId);

      // Use the same FGA-aware ownership gate as RESUME_STREAM_ROUTE — the
      // older `validateThreadOwnership` only compared resource ids and
      // skipped the FGA check entirely when either id was missing.
      if (effectiveThreadId) {
        const memoryInstance = await agent.getMemory({ requestContext: serverRequestContext });
        if (memoryInstance) {
          const thread = await memoryInstance.getThreadById({ threadId: effectiveThreadId });
          if (thread) {
            await enforceThreadAccess({
              mastra,
              requestContext: serverRequestContext,
              threadId: effectiveThreadId,
              thread,
              effectiveResourceId,
              permission: MastraFGAPermissions.MEMORY_WRITE,
            });
          }
        }
      }

      if (memoryOption || effectiveResourceId || effectiveThreadId) {
        authorizedMemoryOption = {
          ...memoryOption,
          ...(effectiveResourceId ? { resource: effectiveResourceId } : {}),
          ...(effectiveThreadId ? { thread: effectiveThreadId } : {}),
        } as NonNullable<typeof authorizedMemoryOption>;
      }

      const workflowsStore = await mastra.getStorage()?.getStore('workflows');
      const workflowRun = await workflowsStore?.getWorkflowRunById({ workflowName: 'agentic-loop', runId });
      await validateRunOwnership(workflowRun, getEffectiveResourceId(serverRequestContext, undefined));

      const { structuredOutput, ...restOptions } = rest;

      const options = {
        runId,
        toolCallId,
        ...restOptions,
        // Schema validates context permissively; runtime values are ModelMessages.
        context: restOptions.context as AIV5Type.ModelMessage[] | undefined,
        requestContext: serverRequestContext,
        memory: authorizedMemoryOption,
        abortSignal,
      };

      const streamResult = structuredOutput
        ? await agent.resumeStreamUntilIdle(resumeData, { ...options, structuredOutput })
        : await agent.resumeStreamUntilIdle(resumeData, options);

      return streamResult.fullStream;
    } catch (error) {
      return handleError(error, 'error resuming agent stream');
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
  handler: async ({ mastra, agentId, abortSignal, requestContext, ...params }) => {
    try {
      const agent = await getAgentFromSystem({
        mastra,
        agentId,
        versionOptions: extractVersionOptions(requestContext),
      });

      if (!params.runId) {
        throw new HTTPException(400, { message: 'Run id is required' });
      }

      if (!params.toolCallId) {
        throw new HTTPException(400, { message: 'Tool call id is required' });
      }

      // UI Frameworks may send "client tools" in the body,
      // but it interferes with llm providers tool handling, so we remove them
      sanitizeBody(params, ['tools', 'actor']);

      await validateDurableToolCallAccess({
        mastra,
        agent,
        runId: params.runId,
        toolCallId: params.toolCallId,
        requestContext,
      });

      const result = await agent.approveToolCallGenerate({
        ...params,
        requestContext,
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
  handler: async ({ mastra, agentId, abortSignal, requestContext, ...params }) => {
    try {
      const agent = await getAgentFromSystem({
        mastra,
        agentId,
        versionOptions: extractVersionOptions(requestContext),
      });

      if (!params.runId) {
        throw new HTTPException(400, { message: 'Run id is required' });
      }

      if (!params.toolCallId) {
        throw new HTTPException(400, { message: 'Tool call id is required' });
      }

      // UI Frameworks may send "client tools" in the body,
      // but it interferes with llm providers tool handling, so we remove them
      sanitizeBody(params, ['tools', 'actor']);

      await validateDurableToolCallAccess({
        mastra,
        agent,
        runId: params.runId,
        toolCallId: params.toolCallId,
        requestContext,
      });

      const result = await agent.declineToolCallGenerate({
        ...params,
        requestContext,
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
  handler: async ({ mastra, messages, agentId, requestContext, ...params }) => {
    try {
      const agent = await getAgentFromSystem({
        mastra,
        agentId,
        versionOptions: extractVersionOptions(requestContext),
      });

      // UI Frameworks may send "client tools" in the body,
      // but it interferes with llm providers tool handling, so we remove them
      sanitizeBody(params, ['tools', 'actor']);

      validateBody({ messages });

      // Authorization: context values take precedence over client-provided values
      let authorizedMemoryOption = params.memory;
      if (params.memory) {
        const effectiveResourceId = getEffectiveResourceId(requestContext, params.memory.resource);
        requireEffectiveResourceId(effectiveResourceId);
        authorizedMemoryOption = { ...params.memory, resource: effectiveResourceId };
      }

      const streamResult = await agent.network(messages, {
        ...params,
        memory: authorizedMemoryOption,
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
  handler: async ({ mastra, agentId, requestContext, ...params }) => {
    try {
      const agent = await getAgentFromSystem({
        mastra,
        agentId,
        versionOptions: extractVersionOptions(requestContext),
      });

      if (!params.runId) {
        throw new HTTPException(400, { message: 'Run id is required' });
      }

      // UI Frameworks may send "client tools" in the body,
      // but it interferes with llm providers tool handling, so we remove them
      sanitizeBody(params, ['tools', 'actor']);

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
  handler: async ({ mastra, agentId, requestContext, ...params }) => {
    try {
      const agent = await getAgentFromSystem({
        mastra,
        agentId,
        versionOptions: extractVersionOptions(requestContext),
      });

      if (!params.runId) {
        throw new HTTPException(400, { message: 'Run id is required' });
      }

      // UI Frameworks may send "client tools" in the body,
      // but it interferes with llm providers tool handling, so we remove them
      sanitizeBody(params, ['tools', 'actor']);

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
  queryParamSchema: skillDisambiguationQuerySchema,
  responseSchema: getAgentSkillResponseSchema,
  summary: 'Get agent skill',
  description: 'Returns details for a specific skill available to the agent (inline or workspace)',
  tags: ['Agents', 'Skills'],
  handler: async ({ mastra, agentId, skillName, path, requestContext }) => {
    try {
      const agent = agentId ? mastra.getAgentById(agentId) : null;
      if (!agent) {
        throw new HTTPException(404, { message: 'Agent not found' });
      }

      // Use the optional ?path= query param for disambiguation, otherwise fall back to name
      const identifier = path ? decodeURIComponent(path) : skillName;

      // Get the skill from the agent (searches both inline and workspace skills)
      const skill = await agent.getSkill(identifier, { requestContext });
      if (!skill) {
        throw new HTTPException(404, { message: `Skill "${identifier}" not found` });
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
