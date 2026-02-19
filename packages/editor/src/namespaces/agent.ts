import { createHash } from 'node:crypto';

import { Memory } from '@mastra/memory';
import { Agent } from '@mastra/core/agent';
import type { Mastra } from '@mastra/core';
import { Workspace, CompositeVersionedSkillSource } from '@mastra/core/workspace';
import type { SkillSource, VersionedSkillEntry } from '@mastra/core/workspace';
import type { MastraMemory, MemoryConfig, SerializedMemoryConfig, SharedMemoryConfig } from '@mastra/core/memory';
import type { MastraVector as MastraVectorProvider } from '@mastra/core/vector';
import type { ToolAction } from '@mastra/core/tools';
import type { Workflow } from '@mastra/core/workflows';
import type { MastraScorers } from '@mastra/core/evals';
import type {
  StorageResolvedAgentType,
  StorageScorerConfig,
  StorageToolConfig,
  StorageMCPClientToolsConfig,
  StorageSkillConfig,
} from '@mastra/core/storage';
import { convertSchemaToZod } from '@mastra/schema-compat';

import type {
  StorageCreateAgentInput,
  StorageUpdateAgentInput,
  StorageListAgentsInput,
  StorageListAgentsOutput,
  StorageListAgentsResolvedOutput,
  StorageConditionalVariant,
  StorageConditionalField,
  StorageDefaultOptions,
  StorageModelConfig,
  AgentInstructionBlock,
  StoredProcessorGraph,
  StorageWorkspaceRef,
} from '@mastra/core/storage';

import { RequestContext } from '@mastra/core/request-context';

import { evaluateRuleGroup } from '../rule-evaluator';
import { resolveInstructionBlocks } from '../instruction-builder';
import { hydrateProcessorGraph, selectFirstMatchingGraph } from '../processor-graph-hydrator';
import { CrudEditorNamespace } from './base';
import type { StorageAdapter } from './base';
import { EditorMCPNamespace } from './mcp';

export class EditorAgentNamespace extends CrudEditorNamespace<
  StorageCreateAgentInput,
  StorageUpdateAgentInput,
  StorageListAgentsInput,
  StorageListAgentsOutput,
  StorageListAgentsResolvedOutput,
  StorageResolvedAgentType,
  Agent
> {
  protected async getStorageAdapter(): Promise<
    StorageAdapter<
      StorageCreateAgentInput,
      StorageUpdateAgentInput,
      StorageListAgentsInput,
      StorageListAgentsOutput,
      StorageListAgentsResolvedOutput,
      StorageResolvedAgentType
    >
  > {
    const storage = this.mastra?.getStorage();
    if (!storage) throw new Error('Storage is not configured');
    const store = await storage.getStore('agents');
    if (!store) throw new Error('Agents storage domain is not available');

    return {
      create: input => store.create({ agent: input }),
      getByIdResolved: async (id, options) => {
        if (options?.versionId || options?.versionNumber) {
          // Fetch the agent metadata first
          const agent = await store.getById(id);
          if (!agent) return null;

          // Fetch the specific version
          const version = options.versionId
            ? await store.getVersion(options.versionId)
            : await store.getVersionByNumber(id, options.versionNumber!);

          if (!version) return null;

          const {
            id: versionId,
            agentId: _aId,
            versionNumber: _vn,
            changedFields: _cf,
            changeMessage: _cm,
            createdAt: _ca,
            ...snapshotConfig
          } = version;
          return { ...agent, ...snapshotConfig, resolvedVersionId: versionId } as StorageResolvedAgentType;
        }
        return store.getByIdResolved(id, options?.status ? { status: options.status } : undefined);
      },
      update: input => store.update(input),
      delete: id => store.delete(id),
      list: args => store.list(args),
      listResolved: args => store.listResolved(args),
    };
  }

  /**
   * Hydrate a stored agent config into a runtime Agent instance.
   */
  protected async hydrate(storedAgent: StorageResolvedAgentType): Promise<Agent> {
    return this.createAgentFromStoredConfig(storedAgent);
  }

  protected override onCacheEvict(id: string): void {
    this.mastra?.removeAgent(id);
  }

  /**
   * Evict all cached agents that reference a given skill ID.
   * Called by EditorSkillNamespace after a skill is published so that
   * subsequent agent.getById() calls re-hydrate with the updated skill version.
   */
  invalidateAgentsReferencingSkill(skillId: string): void {
    for (const [agentId, agent] of this._cache.entries()) {
      const raw = (agent as Agent).toRawConfig?.();
      if (!raw?.skills) continue;

      const skillsField = raw.skills;
      let found = false;

      if (Array.isArray(skillsField)) {
        // StorageConditionalVariant<Record<string, StorageSkillConfig>>[]
        found = skillsField.some(
          (variant: { value?: Record<string, unknown> }) => variant?.value && skillId in variant.value,
        );
      } else if (typeof skillsField === 'object' && skillsField !== null) {
        // Plain Record<string, StorageSkillConfig>
        found = skillId in (skillsField as Record<string, unknown>);
      }

      if (found) {
        this.logger?.debug(
          `[invalidateAgentsReferencingSkill] Evicting agent "${agentId}" (references skill "${skillId}")`,
        );
        this._cache.delete(agentId);
        this.onCacheEvict(agentId);
      }
    }
  }

  // ============================================================================
  // Private helpers
  // ============================================================================

  /**
   * Detect whether a StorageConditionalField value is a conditional variant array
   * (as opposed to the plain static value T).
   */
  private isConditionalVariants<T>(field: StorageConditionalField<T>): field is StorageConditionalVariant<T>[] {
    return (
      Array.isArray(field) &&
      field.length > 0 &&
      typeof field[0] === 'object' &&
      field[0] !== null &&
      'value' in field[0]
    );
  }

  /**
   * Accumulate all matching variants for an array-typed field.
   * Each matching variant's value (an array) is concatenated in order.
   * Variants with no rules are treated as unconditional (always included).
   */
  private accumulateArrayVariants<T>(
    variants: StorageConditionalVariant<T[]>[],
    context: Record<string, unknown>,
  ): T[] {
    const result: T[] = [];
    for (const variant of variants) {
      if (!variant.rules || evaluateRuleGroup(variant.rules, context)) {
        result.push(...variant.value);
      }
    }
    return result;
  }

  /**
   * Accumulate all matching variants for an object/record-typed field.
   * Each matching variant's value is shallow-merged in order, so later
   * matches override keys from earlier ones.
   * Variants with no rules are treated as unconditional (always included).
   */
  private accumulateObjectVariants<T extends Record<string, unknown>>(
    variants: StorageConditionalVariant<T>[],
    context: Record<string, unknown>,
  ): T | undefined {
    let result: T | undefined;
    for (const variant of variants) {
      if (!variant.rules || evaluateRuleGroup(variant.rules, context)) {
        result = result ? { ...result, ...variant.value } : { ...variant.value };
      }
    }
    return result;
  }

  private async createAgentFromStoredConfig(storedAgent: StorageResolvedAgentType): Promise<Agent> {
    if (!this.mastra) {
      throw new Error('MastraEditor is not registered with a Mastra instance');
    }

    this.logger?.debug(`[createAgentFromStoredConfig] Creating agent from stored config "${storedAgent.id}"`);

    const instructions = this.resolveStoredInstructions(storedAgent.instructions);

    // Determine if any conditional fields exist that require dynamic resolution
    const hasConditionalTools = storedAgent.tools != null && this.isConditionalVariants(storedAgent.tools);
    const hasConditionalMCPClients =
      storedAgent.mcpClients != null && this.isConditionalVariants(storedAgent.mcpClients);
    const hasConditionalIntegrationTools =
      storedAgent.integrationTools != null && this.isConditionalVariants(storedAgent.integrationTools);
    const hasConditionalWorkflows = storedAgent.workflows != null && this.isConditionalVariants(storedAgent.workflows);
    const hasConditionalAgents = storedAgent.agents != null && this.isConditionalVariants(storedAgent.agents);
    const hasConditionalMemory = storedAgent.memory != null && this.isConditionalVariants(storedAgent.memory);
    const hasConditionalScorers = storedAgent.scorers != null && this.isConditionalVariants(storedAgent.scorers);
    const hasConditionalInputProcessors =
      storedAgent.inputProcessors != null && this.isConditionalVariants(storedAgent.inputProcessors);
    const hasConditionalOutputProcessors =
      storedAgent.outputProcessors != null && this.isConditionalVariants(storedAgent.outputProcessors);
    const hasConditionalDefaultOptions =
      storedAgent.defaultOptions != null && this.isConditionalVariants(storedAgent.defaultOptions);
    const hasConditionalModel = this.isConditionalVariants(storedAgent.model);
    const hasConditionalWorkspace = storedAgent.workspace != null && this.isConditionalVariants(storedAgent.workspace);

    // --- Resolve fields: conditional fields accumulate all matching variants ---

    // Tools: registry tools, MCP client tools, and integration tools can each be conditional.
    // If any is conditional, the combined result must be a dynamic function.
    const isDynamicTools = hasConditionalTools || hasConditionalMCPClients || hasConditionalIntegrationTools;

    let tools:
      | Record<string, ToolAction<any, any, any, any, any, any>>
      | (({
          requestContext,
        }: {
          requestContext: RequestContext;
        }) => Promise<Record<string, ToolAction<any, any, any, any, any, any>>>);

    if (isDynamicTools) {
      // At least one tool source is conditional — resolve all at request time
      tools = async ({ requestContext }: { requestContext: RequestContext }) => {
        const ctx = requestContext.toJSON();

        // Resolve registry tools
        const resolvedToolsConfig = hasConditionalTools
          ? this.accumulateObjectVariants(
              storedAgent.tools as StorageConditionalVariant<Record<string, StorageToolConfig>>[],
              ctx,
            )
          : (storedAgent.tools as Record<string, StorageToolConfig> | undefined);
        const registryTools = this.resolveStoredTools(resolvedToolsConfig);

        // Resolve MCP client tools
        const resolvedMCPClientsConfig = hasConditionalMCPClients
          ? this.accumulateObjectVariants(
              storedAgent.mcpClients as StorageConditionalVariant<Record<string, StorageMCPClientToolsConfig>>[],
              ctx,
            )
          : (storedAgent.mcpClients as Record<string, StorageMCPClientToolsConfig> | undefined);
        const mcpTools = await this.resolveStoredMCPTools(resolvedMCPClientsConfig);

        // Resolve integration tools (tool providers)
        const resolvedIntegrationToolsConfig = hasConditionalIntegrationTools
          ? this.accumulateObjectVariants(
              storedAgent.integrationTools as StorageConditionalVariant<Record<string, StorageMCPClientToolsConfig>>[],
              ctx,
            )
          : (storedAgent.integrationTools as Record<string, StorageMCPClientToolsConfig> | undefined);
        const integrationTools = await this.resolveStoredIntegrationTools(resolvedIntegrationToolsConfig, ctx);

        return { ...registryTools, ...mcpTools, ...integrationTools };
      };
    } else {
      // All are static — resolve once at agent creation time
      const registryTools = this.resolveStoredTools(storedAgent.tools as Record<string, StorageToolConfig> | undefined);
      const mcpTools = await this.resolveStoredMCPTools(
        storedAgent.mcpClients as Record<string, StorageMCPClientToolsConfig> | undefined,
      );
      const integrationTools = await this.resolveStoredIntegrationTools(
        storedAgent.integrationTools as Record<string, StorageMCPClientToolsConfig> | undefined,
      );
      tools = { ...registryTools, ...mcpTools, ...integrationTools };
    }

    // Workflows: variant values may be string[] or Record<string, StorageToolConfig>
    const workflows = hasConditionalWorkflows
      ? ({ requestContext }: { requestContext: RequestContext }) => {
          const ctx = requestContext.toJSON();
          const variants = storedAgent.workflows as StorageConditionalVariant<
            Record<string, StorageToolConfig> | string[]
          >[];
          const isArrayVariant = Array.isArray(variants[0]?.value);
          const resolved = isArrayVariant
            ? this.accumulateArrayVariants(variants as StorageConditionalVariant<string[]>[], ctx)
            : this.accumulateObjectVariants(
                variants as StorageConditionalVariant<Record<string, StorageToolConfig>>[],
                ctx,
              );
          return this.resolveStoredWorkflows(resolved);
        }
      : this.resolveStoredWorkflows(storedAgent.workflows as Record<string, StorageToolConfig> | string[] | undefined);

    // Agents: variant values may be string[] or Record<string, StorageToolConfig>
    const agents = hasConditionalAgents
      ? ({ requestContext }: { requestContext: RequestContext }) => {
          const ctx = requestContext.toJSON();
          const variants = storedAgent.agents as StorageConditionalVariant<
            Record<string, StorageToolConfig> | string[]
          >[];
          const isArrayVariant = Array.isArray(variants[0]?.value);
          const resolved = isArrayVariant
            ? this.accumulateArrayVariants(variants as StorageConditionalVariant<string[]>[], ctx)
            : this.accumulateObjectVariants(
                variants as StorageConditionalVariant<Record<string, StorageToolConfig>>[],
                ctx,
              );
          return this.resolveStoredAgents(resolved);
        }
      : this.resolveStoredAgents(storedAgent.agents as Record<string, StorageToolConfig> | string[] | undefined);

    // Memory (object): accumulate by merging config from all matching variants
    const memory = hasConditionalMemory
      ? ({ requestContext }: { requestContext: RequestContext }) => {
          const ctx = requestContext.toJSON();
          const resolved = this.accumulateObjectVariants(
            storedAgent.memory as StorageConditionalVariant<SerializedMemoryConfig>[],
            ctx,
          );
          return this.resolveStoredMemory(resolved as SerializedMemoryConfig | undefined);
        }
      : this.resolveStoredMemory(storedAgent.memory as SerializedMemoryConfig | undefined);

    // Scorers (Record): accumulate by merging objects from all matching variants
    const scorers = hasConditionalScorers
      ? async ({ requestContext }: { requestContext: RequestContext }) => {
          const ctx = requestContext.toJSON();
          const resolved = this.accumulateObjectVariants(
            storedAgent.scorers as StorageConditionalVariant<Record<string, StorageScorerConfig>>[],
            ctx,
          );
          return this.resolveStoredScorers(resolved);
        }
      : await this.resolveStoredScorers(storedAgent.scorers as Record<string, StorageScorerConfig> | undefined);

    // Input processors (graph): first-match from conditional variants, then hydrate
    const processorProviders = this.editor.getProcessorProviders();
    const hydrationCtx = { providers: processorProviders, mastra: this.mastra, logger: this.logger };

    const inputProcessors = hasConditionalInputProcessors
      ? ({ requestContext }: { requestContext: RequestContext }) => {
          const ctx = requestContext.toJSON();
          const graph = selectFirstMatchingGraph(
            storedAgent.inputProcessors as StorageConditionalVariant<StoredProcessorGraph>[],
            ctx,
          );
          return hydrateProcessorGraph(graph, 'input', hydrationCtx);
        }
      : hydrateProcessorGraph(storedAgent.inputProcessors as StoredProcessorGraph | undefined, 'input', hydrationCtx);

    // Output processors (graph): first-match from conditional variants, then hydrate
    const outputProcessors = hasConditionalOutputProcessors
      ? ({ requestContext }: { requestContext: RequestContext }) => {
          const ctx = requestContext.toJSON();
          const graph = selectFirstMatchingGraph(
            storedAgent.outputProcessors as StorageConditionalVariant<StoredProcessorGraph>[],
            ctx,
          );
          return hydrateProcessorGraph(graph, 'output', hydrationCtx);
        }
      : hydrateProcessorGraph(storedAgent.outputProcessors as StoredProcessorGraph | undefined, 'output', hydrationCtx);

    // Model (object): accumulate by merging config from all matching variants
    let model: string | (({ requestContext }: { requestContext: RequestContext }) => string);
    let staticModelConfig: StorageModelConfig | undefined;

    /** Extract model-level settings into the shape expected by defaultOptions.modelSettings */
    const modelSettingsFrom = (cfg: StorageModelConfig) => ({
      temperature: cfg.temperature,
      topP: cfg.topP,
      frequencyPenalty: cfg.frequencyPenalty,
      presencePenalty: cfg.presencePenalty,
      maxOutputTokens: cfg.maxCompletionTokens,
    });

    if (hasConditionalModel) {
      model = ({ requestContext }: { requestContext: RequestContext }) => {
        const ctx = requestContext.toJSON();
        const resolved = this.accumulateObjectVariants(
          storedAgent.model as StorageConditionalVariant<StorageModelConfig>[],
          ctx,
        );
        if (!resolved || !resolved.provider || !resolved.name) {
          throw new Error(
            `Stored agent "${storedAgent.id}" conditional model resolved to invalid configuration. Both provider and name are required.`,
          );
        }
        return `${resolved.provider}/${resolved.name}`;
      };
    } else {
      staticModelConfig = storedAgent.model as StorageModelConfig;
      if (!staticModelConfig || !staticModelConfig.provider || !staticModelConfig.name) {
        throw new Error(
          `Stored agent "${storedAgent.id}" has no active version or invalid model configuration. Both provider and name are required.`,
        );
      }
      model = `${staticModelConfig.provider}/${staticModelConfig.name}`;
    }

    // Default options (object): accumulate by merging from all matching variants.
    // When the model is conditional, defaultOptions must also be dynamic so that
    // model-level settings (temperature, topP, etc.) are forwarded at request time.
    const staticDefaultOptions =
      hasConditionalDefaultOptions || hasConditionalModel
        ? undefined
        : (storedAgent.defaultOptions as StorageDefaultOptions | undefined);

    const resolveModelSettings = (ctx: Record<string, unknown>) => {
      const resolved = this.accumulateObjectVariants(
        storedAgent.model as StorageConditionalVariant<StorageModelConfig>[],
        ctx,
      );
      return resolved ? modelSettingsFrom(resolved) : {};
    };

    let defaultOptions;
    if (hasConditionalDefaultOptions || hasConditionalModel) {
      defaultOptions = ({ requestContext }: { requestContext: RequestContext }) => {
        const ctx = requestContext.toJSON();

        const baseOptions = hasConditionalDefaultOptions
          ? (this.accumulateObjectVariants(
              storedAgent.defaultOptions as StorageConditionalVariant<StorageDefaultOptions>[],
              ctx,
            ) ?? {})
          : ((storedAgent.defaultOptions as StorageDefaultOptions | undefined) ?? {});

        const mSettings = hasConditionalModel
          ? resolveModelSettings(ctx)
          : staticModelConfig
            ? modelSettingsFrom(staticModelConfig)
            : {};

        return {
          ...baseOptions,
          modelSettings: {
            ...((baseOptions as Record<string, unknown>).modelSettings as Record<string, unknown> | undefined),
            ...mSettings,
          },
        };
      };
    } else {
      defaultOptions = {
        ...staticDefaultOptions,
        modelSettings: {
          ...staticDefaultOptions?.modelSettings,
          ...(staticModelConfig ? modelSettingsFrom(staticModelConfig) : undefined),
        },
      };
    }

    // Convert requestContextSchema from JSON Schema to ZodSchema if present
    const requestContextSchema = storedAgent.requestContextSchema
      ? convertSchemaToZod(storedAgent.requestContextSchema as Record<string, unknown>)
      : undefined;

    // Resolve agent-level skill source for versioned skills (pin/latest strategy).
    // This creates a CompositeVersionedSkillSource that reads from the blob store
    // instead of the live filesystem, enabling draft/publish/rollback semantics.
    const skillSource = await this.resolveAgentSkillSource(storedAgent.skills);

    // Workspace: resolve stored workspace reference (ID or inline) to a runtime Workspace.
    // When conditional, wrapped in a DynamicArgument function resolved at request time.
    const workspace = hasConditionalWorkspace
      ? async ({ requestContext }: { requestContext: RequestContext }) => {
          const ctx = requestContext.toJSON();
          const resolvedRef = this.accumulateObjectVariants(
            storedAgent.workspace as StorageConditionalVariant<StorageWorkspaceRef>[],
            ctx,
          );
          return this.resolveStoredWorkspace(resolvedRef, skillSource);
        }
      : await this.resolveStoredWorkspace(storedAgent.workspace as StorageWorkspaceRef | undefined, skillSource);

    const skillsFormat = storedAgent.skillsFormat;

    // Cast to `any` to avoid TS2589 "excessively deep" errors caused by the
    // complex generic inference of Agent<TTools, TRequestContext, …>.  The
    // individual field values have already been validated above.
    const agent = new Agent({
      id: storedAgent.id,
      name: storedAgent.name,
      description: storedAgent.description,
      instructions: instructions ?? '',
      model,
      memory,
      tools,
      workflows,
      agents,
      scorers,
      mastra: this.mastra,
      inputProcessors,
      outputProcessors,
      rawConfig: storedAgent as unknown as Record<string, unknown>,
      defaultOptions,
      requestContextSchema,
      workspace,
      ...(skillsFormat && { skillsFormat }),
    } as any);

    this.mastra?.addAgent(agent, storedAgent.id, { source: 'stored' });
    this.logger?.debug(`[createAgentFromStoredConfig] Successfully created agent "${storedAgent.id}"`);

    return agent;
  }

  private resolveStoredInstructions(
    instructions: string | AgentInstructionBlock[] | undefined,
  ):
    | string
    | (({ requestContext, mastra }: { requestContext: RequestContext; mastra?: Mastra }) => Promise<string>)
    | undefined {
    if (instructions === undefined || instructions === null) return undefined;
    if (typeof instructions === 'string') return instructions;

    const blocks = instructions;
    return async ({ requestContext }: { requestContext: RequestContext; mastra?: Mastra }) => {
      const storage = this.editor.__mastra!.getStorage();
      if (!storage) throw new Error('Storage is not configured');
      const promptBlocksStore = await storage.getStore('promptBlocks');
      if (!promptBlocksStore) throw new Error('Prompt blocks storage domain is not available');
      const context = requestContext.toJSON();
      return resolveInstructionBlocks(blocks, context, { promptBlocksStorage: promptBlocksStore });
    };
  }

  /**
   * Resolve stored tool IDs to actual tool instances from Mastra's registry.
   * Applies description overrides from per-tool config when present.
   */
  private resolveStoredTools(
    storedTools?: Record<string, StorageToolConfig> | string[],
  ): Record<string, ToolAction<any, any, any, any, any, any>> {
    if (
      !storedTools ||
      (Array.isArray(storedTools) ? storedTools.length === 0 : Object.keys(storedTools).length === 0)
    ) {
      return {};
    }

    if (!this.mastra) {
      return {};
    }

    // Normalize legacy string[] format to Record
    const normalized: Record<string, StorageToolConfig> = Array.isArray(storedTools)
      ? Object.fromEntries(storedTools.map(key => [key, {}]))
      : storedTools;

    const resolvedTools: Record<string, ToolAction<any, any, any, any, any, any>> = {};

    for (const [toolKey, toolConfig] of Object.entries(normalized)) {
      try {
        const tool = this.mastra.getToolById(toolKey);

        if (toolConfig.description) {
          resolvedTools[toolKey] = { ...tool, description: toolConfig.description };
        } else {
          resolvedTools[toolKey] = tool;
        }
      } catch {
        this.logger?.warn(`Tool "${toolKey}" referenced in stored agent but not registered in Mastra`);
      }
    }

    return resolvedTools;
  }

  /**
   * Resolve MCP client/server references to tools.
   *
   * For each entry in `mcpClients`, resolution checks two sources in order:
   * 1. Stored MCP clients (from DB) — creates an MCPClient to fetch remote tools
   * 2. Code-defined MCP servers on the Mastra instance — uses `server.tools()` directly
   *
   * When `clientToolsConfig.tools` is absent, no tools are included (client registered but nothing selected).
   * When `clientToolsConfig.tools` is an empty object `{}`, all tools from the source are included.
   * When specified with keys, only listed tools are included with optional description overrides.
   */
  private async resolveStoredMCPTools(
    mcpClients?: Record<string, StorageMCPClientToolsConfig>,
  ): Promise<Record<string, ToolAction<any, any, any, any, any, any>>> {
    if (!mcpClients || Object.keys(mcpClients).length === 0) return {};
    if (!this.mastra) return {};

    const allTools: Record<string, ToolAction<any, any, any, any, any, any>> = {};

    // Lazily loaded — only needed when stored MCP clients are found
    let MCPClient: any;

    for (const [clientId, clientToolsConfig] of Object.entries(mcpClients)) {
      try {
        // No `tools` key = client registered but no tools selected yet
        if (!clientToolsConfig.tools) continue;

        let tools: Record<string, any> | undefined;

        // 1. Check stored MCP clients (remote servers from DB)
        const storedClient = await this.editor.mcp.getById(clientId);
        if (storedClient) {
          if (!MCPClient) {
            try {
              const mcpModule = await import('@mastra/mcp');
              MCPClient = mcpModule.MCPClient;
            } catch {
              this.logger?.warn(
                'Stored MCP client references found but @mastra/mcp is not installed. ' +
                  'Install @mastra/mcp to use remote MCP tools.',
              );
              continue;
            }
          }
          const clientOptions = EditorMCPNamespace.toMCPClientOptions(storedClient);
          const client = new MCPClient(clientOptions);
          tools = await client.listTools();
          this.logger?.debug(`[resolveStoredMCPTools] Loaded tools from stored MCP client "${clientId}"`);
        } else {
          // 2. Fallback to code-defined MCP server on the Mastra instance
          //    Check by registration key first, then by server ID
          const mcpServer = this.mastra.getMCPServer(clientId) ?? this.mastra.getMCPServerById(clientId);
          if (mcpServer) {
            tools = mcpServer.tools() as Record<string, any>;
            this.logger?.debug(`[resolveStoredMCPTools] Loaded tools from code-defined MCP server "${clientId}"`);
          }
        }

        if (!tools) {
          this.logger?.warn(`MCP client/server "${clientId}" referenced in stored agent but not found`);
          continue;
        }

        // Two-layer filtering:
        //   1. Client-level (per-server): storedClient.servers[serverName].tools — narrows tools exposed by each server
        //   2. Agent-level: clientToolsConfig.tools — further narrows from the client set
        // Agent-level description overrides take precedence over client-level.
        //
        // Tools from MCPClient.listTools() are namespaced as `serverName_toolName`.
        // Per-server tool configs use the non-namespaced `toolName`.
        const clientServers = storedClient?.servers;
        const agentAllowedTools = clientToolsConfig.tools;

        for (const [namespacedToolName, tool] of Object.entries(tools)) {
          // Parse the server name and bare tool name from the namespaced key
          const underscoreIdx = namespacedToolName.indexOf('_');
          const serverName = underscoreIdx > -1 ? namespacedToolName.slice(0, underscoreIdx) : undefined;
          const bareToolName = underscoreIdx > -1 ? namespacedToolName.slice(underscoreIdx + 1) : namespacedToolName;

          // Client-level per-server filter: if a server has tools defined, only include listed tools
          if (serverName && clientServers?.[serverName]?.tools) {
            if (!(bareToolName in clientServers[serverName].tools!)) continue;
          }

          // Agent-level filter: `tools: {}` = all tools; `tools: { slug: ... }` = specific tools
          const hasAgentFilter = agentAllowedTools && Object.keys(agentAllowedTools).length > 0;
          if (hasAgentFilter && !(namespacedToolName in agentAllowedTools)) continue;

          // Description override: agent-level (namespaced key) takes precedence over client-level (bare key)
          const serverToolConfig = serverName ? clientServers?.[serverName]?.tools?.[bareToolName] : undefined;
          const description = agentAllowedTools?.[namespacedToolName]?.description ?? serverToolConfig?.description;

          if (description) {
            allTools[namespacedToolName] = { ...(tool as ToolAction<any, any, any, any, any, any>), description };
          } else {
            allTools[namespacedToolName] = tool as ToolAction<any, any, any, any, any, any>;
          }
        }
      } catch (error) {
        this.logger?.warn(`Failed to resolve MCP tools from "${clientId}"`, { error });
      }
    }

    return allTools;
  }

  /**
   * Resolve integration tool references from tool providers.
   *
   * For each entry in `integrationTools`, looks up the tool provider by ID
   * from the editor's registered tool providers and calls `getTools()` on it.
   *
   * When `providerConfig.tools` is absent, no tools are included (provider registered but nothing selected).
   * When `providerConfig.tools` is an empty object `{}`, all tools from the provider are included.
   * When `providerConfig.tools` has specific keys, only those tools are included with optional overrides.
   */
  private async resolveStoredIntegrationTools(
    integrationTools?: Record<string, StorageMCPClientToolsConfig>,
    requestContext?: Record<string, unknown>,
  ): Promise<Record<string, ToolAction<any, any, any, any, any, any>>> {
    if (!integrationTools || Object.keys(integrationTools).length === 0) return {};

    const allTools: Record<string, ToolAction<any, any, any, any, any, any>> = {};

    for (const [providerId, providerConfig] of Object.entries(integrationTools)) {
      try {
        // No `tools` key = provider registered but no tools selected yet
        if (!providerConfig.tools) continue;

        const provider = this.editor.getToolProvider(providerId);
        if (!provider) {
          this.logger?.warn(
            `Tool provider "${providerId}" referenced in stored agent but not registered in the editor`,
          );
          continue;
        }

        // `tools: {}` = all tools; `tools: { slug: ... }` = specific tools
        const wantedSlugs = Object.keys(providerConfig.tools);

        let slugsToResolve: string[];
        if (wantedSlugs.length === 0) {
          // "All tools" — ask the provider for its full catalog
          const allAvailable = await provider.listTools();
          slugsToResolve = allAvailable.data.map(t => t.slug);
        } else {
          slugsToResolve = wantedSlugs;
        }

        // Fetch tools from the provider — pass slugs, configs, and request context
        const providerTools = await provider.resolveTools(slugsToResolve, providerConfig.tools, { requestContext });

        for (const [toolId, tool] of Object.entries(providerTools)) {
          // Apply description override if configured at the agent level
          const description = providerConfig.tools?.[toolId]?.description;
          if (description) {
            allTools[toolId] = { ...tool, description };
          } else {
            allTools[toolId] = tool;
          }
        }

        this.logger?.debug(
          `[resolveStoredIntegrationTools] Loaded ${Object.keys(providerTools).length} tools from provider "${providerId}"`,
        );
      } catch (error) {
        this.logger?.warn(`Failed to resolve integration tools from provider "${providerId}"`, { error });
      }
    }

    return allTools;
  }

  private resolveStoredWorkflows(
    storedWorkflows?: Record<string, StorageToolConfig> | string[],
  ): Record<string, Workflow<any, any, any, any, any, any, any>> {
    if (
      !storedWorkflows ||
      (Array.isArray(storedWorkflows) ? storedWorkflows.length === 0 : Object.keys(storedWorkflows).length === 0)
    ) {
      return {};
    }
    if (!this.mastra) return {};

    // Normalize legacy string[] format to Record
    const normalized: Record<string, StorageToolConfig> = Array.isArray(storedWorkflows)
      ? Object.fromEntries(storedWorkflows.map(key => [key, {}]))
      : storedWorkflows;

    const resolvedWorkflows: Record<string, Workflow<any, any, any, any, any, any, any>> = {};
    for (const workflowKey of Object.keys(normalized)) {
      try {
        resolvedWorkflows[workflowKey] = this.mastra.getWorkflow(workflowKey);
      } catch {
        try {
          resolvedWorkflows[workflowKey] = this.mastra.getWorkflowById(workflowKey);
        } catch {
          this.logger?.warn(`Workflow "${workflowKey}" referenced in stored agent but not registered in Mastra`);
        }
      }
    }
    return resolvedWorkflows;
  }

  private resolveStoredAgents(storedAgents?: Record<string, StorageToolConfig> | string[]): Record<string, Agent<any>> {
    if (
      !storedAgents ||
      (Array.isArray(storedAgents) ? storedAgents.length === 0 : Object.keys(storedAgents).length === 0)
    ) {
      return {};
    }
    if (!this.mastra) return {};

    // Normalize legacy string[] format to Record
    const normalized: Record<string, StorageToolConfig> = Array.isArray(storedAgents)
      ? Object.fromEntries(storedAgents.map(key => [key, {}]))
      : storedAgents;

    const resolvedAgents: Record<string, Agent<any>> = {};
    for (const agentKey of Object.keys(normalized)) {
      try {
        resolvedAgents[agentKey] = this.mastra.getAgent(agentKey);
      } catch {
        try {
          resolvedAgents[agentKey] = this.mastra.getAgentById(agentKey);
        } catch {
          this.logger?.warn(`Agent "${agentKey}" referenced in stored agent but not registered in Mastra`);
        }
      }
    }
    return resolvedAgents;
  }

  private resolveStoredMemory(memoryConfig?: SerializedMemoryConfig): MastraMemory | undefined {
    if (!memoryConfig) {
      this.logger?.debug(`[resolveStoredMemory] No memory config provided`);
      return undefined;
    }
    if (!this.mastra) {
      this.logger?.warn('MastraEditor not registered with Mastra instance. Cannot instantiate memory.');
      return undefined;
    }

    try {
      let vector: MastraVectorProvider | undefined;
      if (memoryConfig.vector) {
        const vectors = this.mastra.listVectors();
        vector = vectors?.[memoryConfig.vector];
        if (!vector) {
          this.logger?.warn(`Vector provider "${memoryConfig.vector}" not found in Mastra instance`);
        }
      }

      // Build options, merging observationalMemory from serialized config
      let options: MemoryConfig | undefined = memoryConfig.options ? { ...memoryConfig.options } : undefined;
      if (memoryConfig.observationalMemory) {
        options = {
          ...options,
          observationalMemory: memoryConfig.observationalMemory,
        };
      }

      if (options?.semanticRecall && (!vector || !memoryConfig.embedder)) {
        this.logger?.warn(
          'Semantic recall is enabled but no vector store or embedder are configured. ' +
            'Creating memory without semantic recall. ' +
            'To use semantic recall, configure a vector store and embedder in your Mastra instance.',
        );

        const adjustedOptions = { ...options, semanticRecall: false };
        const sharedConfig: SharedMemoryConfig = {
          storage: this.mastra.getStorage(),
          vector,
          options: adjustedOptions,
          embedder: memoryConfig.embedder,
          embedderOptions: memoryConfig.embedderOptions,
        };
        return new Memory(sharedConfig);
      }

      const sharedConfig: SharedMemoryConfig = {
        storage: this.mastra.getStorage(),
        vector,
        options,
        embedder: memoryConfig.embedder,
        embedderOptions: memoryConfig.embedderOptions,
      };
      return new Memory(sharedConfig);
    } catch (error) {
      this.logger?.error('Failed to resolve memory from config', { error });
      return undefined;
    }
  }

  private async resolveStoredScorers(
    storedScorers?: Record<string, StorageScorerConfig>,
  ): Promise<MastraScorers | undefined> {
    if (!storedScorers || Object.keys(storedScorers).length === 0) return undefined;
    if (!this.mastra) return undefined;

    const resolvedScorers: MastraScorers = {};
    const storage = this.mastra.getStorage();
    const scorerStore = storage ? await storage.getStore('scorerDefinitions') : null;

    for (const [scorerKey, scorerConfig] of Object.entries(storedScorers)) {
      // DB takes priority: try stored scorer definitions first
      if (scorerStore) {
        try {
          const storedDef = await scorerStore.getByIdResolved(scorerKey);
          if (storedDef) {
            const scorer = this.editor.scorer.resolve(storedDef);
            if (scorer) {
              resolvedScorers[scorerKey] = { scorer, sampling: scorerConfig.sampling };
              continue;
            }
          }
        } catch {
          // Fall through to registry lookup
        }
      }

      // Fall back to registry scorers
      try {
        const scorer = this.mastra.getScorer(scorerKey);
        resolvedScorers[scorerKey] = { scorer, sampling: scorerConfig.sampling };
      } catch {
        try {
          const scorer = this.mastra.getScorerById(scorerKey);
          resolvedScorers[scorerKey] = { scorer, sampling: scorerConfig.sampling };
        } catch {
          this.logger?.warn(`Scorer "${scorerKey}" referenced in stored agent but not found in registry or storage`);
        }
      }
    }

    return Object.keys(resolvedScorers).length > 0 ? resolvedScorers : undefined;
  }

  // ============================================================================
  // Clone
  // ============================================================================

  /**
   * Clone a runtime Agent instance into storage, creating a new stored agent
   * with the resolved configuration of the source agent.
   */
  async clone(
    agent: Agent,
    options: {
      newId: string;
      newName?: string;
      metadata?: Record<string, unknown>;
      authorId?: string;
      requestContext?: RequestContext;
    },
  ): Promise<StorageResolvedAgentType> {
    const requestContext = options.requestContext ?? new RequestContext();

    // 1. Extract model config
    const llm = await agent.getLLM({ requestContext });
    const provider = llm.getProvider();
    const modelId = llm.getModelId();

    const defaultOptions = await agent.getDefaultOptions({ requestContext });
    const modelSettings = (defaultOptions as Record<string, any>)?.modelSettings;

    const model: StorageModelConfig = {
      provider,
      name: modelId,
      ...(modelSettings?.temperature !== undefined && { temperature: modelSettings.temperature }),
      ...(modelSettings?.topP !== undefined && { topP: modelSettings.topP }),
      ...(modelSettings?.frequencyPenalty !== undefined && { frequencyPenalty: modelSettings.frequencyPenalty }),
      ...(modelSettings?.presencePenalty !== undefined && { presencePenalty: modelSettings.presencePenalty }),
      ...(modelSettings?.maxOutputTokens !== undefined && { maxCompletionTokens: modelSettings.maxOutputTokens }),
    };

    // 2. Extract instructions
    const instructions = await agent.getInstructions({ requestContext });
    let instructionsStr: string;
    if (typeof instructions === 'string') {
      instructionsStr = instructions;
    } else if (Array.isArray(instructions)) {
      instructionsStr = instructions
        .map(msg => {
          if (typeof msg === 'string') {
            return msg;
          }
          return typeof msg.content === 'string' ? msg.content : '';
        })
        .filter(Boolean)
        .join('\n\n');
    } else if (instructions && typeof instructions === 'object' && 'content' in instructions) {
      instructionsStr = typeof instructions.content === 'string' ? instructions.content : '';
    } else {
      instructionsStr = '';
    }

    // 3. Extract tool keys
    const tools = await agent.listTools({ requestContext });
    const toolKeys = Object.keys(tools || {});

    // 4. Extract workflow keys
    const workflows = await agent.listWorkflows({ requestContext });
    const workflowKeys = Object.keys(workflows || {});

    // 5. Extract sub-agent keys
    const agentsResolved = await agent.listAgents({ requestContext });
    const agentKeys = Object.keys(agentsResolved || {});

    // 6. Extract memory config
    const memory = await agent.getMemory({ requestContext });
    const memoryConfig = memory?.getConfig();

    // 7. Processors from code-defined agents cannot be automatically serialized
    // to a StoredProcessorGraph (requires provider ID + config). Processors must
    // be configured via the editor UI after cloning.

    // 8. Extract scorer keys with sampling config
    let storedScorers: Record<string, StorageScorerConfig> | undefined;
    const resolvedScorers = await agent.listScorers({ requestContext });
    if (resolvedScorers && Object.keys(resolvedScorers).length > 0) {
      storedScorers = {};
      for (const [key, entry] of Object.entries(resolvedScorers)) {
        storedScorers[key] = {
          ...(entry.sampling && { sampling: entry.sampling }),
        };
      }
    }

    // 9. Extract default options (serializable parts only)
    const storageDefaultOptions: StorageDefaultOptions | undefined = defaultOptions
      ? {
          maxSteps: (defaultOptions as Record<string, any>)?.maxSteps,
          runId: (defaultOptions as Record<string, any>)?.runId,
          savePerStep: (defaultOptions as Record<string, any>)?.savePerStep,
          activeTools: (defaultOptions as Record<string, any>)?.activeTools,
          toolChoice: (defaultOptions as Record<string, any>)?.toolChoice,
          modelSettings: (defaultOptions as Record<string, any>)?.modelSettings,
          returnScorerData: (defaultOptions as Record<string, any>)?.returnScorerData,
          requireToolApproval: (defaultOptions as Record<string, any>)?.requireToolApproval,
          autoResumeSuspendedTools: (defaultOptions as Record<string, any>)?.autoResumeSuspendedTools,
          toolCallConcurrency: (defaultOptions as Record<string, any>)?.toolCallConcurrency,
          maxProcessorRetries: (defaultOptions as Record<string, any>)?.maxProcessorRetries,
          includeRawChunks: (defaultOptions as Record<string, any>)?.includeRawChunks,
        }
      : undefined;

    // 10. Create the stored agent
    const createInput: StorageCreateAgentInput = {
      id: options.newId,
      name: options.newName || `${agent.name} (Clone)`,
      description: agent.getDescription() || undefined,
      instructions: instructionsStr,
      model,
      tools: toolKeys.length > 0 ? Object.fromEntries(toolKeys.map(key => [key, {}])) : undefined,
      workflows: workflowKeys.length > 0 ? Object.fromEntries(workflowKeys.map(key => [key, {}])) : undefined,
      agents: agentKeys.length > 0 ? Object.fromEntries(agentKeys.map(key => [key, {}])) : undefined,
      memory: memoryConfig,
      scorers: storedScorers,
      defaultOptions: storageDefaultOptions,
      metadata: options.metadata,
      authorId: options.authorId,
    };

    const adapter = await this.getStorageAdapter();
    await adapter.create(createInput);

    const resolved = await adapter.getByIdResolved(options.newId);
    if (!resolved) {
      throw new Error(`Failed to resolve cloned agent '${options.newId}' after creation.`);
    }

    return resolved;
  }

  // ============================================================================
  // Workspace Resolution
  // ============================================================================

  /**
   * Resolve a stored workspace reference to a runtime Workspace instance.
   * Handles both ID-based references (looked up from editor.workspace) and
   * inline workspace configurations (hydrated directly).
   *
   * When a skillSource is provided (from resolveAgentSkillSource), it is passed
   * to the workspace hydration so the workspace uses versioned blob-backed skills
   * instead of filesystem-based discovery.
   */
  private async resolveStoredWorkspace(
    workspaceRef: StorageWorkspaceRef | undefined,
    skillSource?: SkillSource,
  ): Promise<Workspace<any, any, any> | undefined> {
    if (!workspaceRef) return undefined;

    const workspaceNs = this.editor.workspace;
    if (!workspaceNs) {
      this.logger?.warn('[resolveStoredWorkspace] No workspace namespace available on editor');
      return undefined;
    }

    const hydrateOptions = skillSource ? { skillSource } : undefined;

    if (workspaceRef.type === 'id') {
      // Look up the stored workspace by ID and hydrate it to a runtime Workspace
      const resolved = await workspaceNs.getById(workspaceRef.workspaceId);
      if (!resolved) {
        this.logger?.warn(
          `[resolveStoredWorkspace] Workspace '${workspaceRef.workspaceId}' not found in storage, skipping`,
        );
        return undefined;
      }
      // getById returns StorageResolvedWorkspaceType — we need to hydrate it
      return workspaceNs.hydrateSnapshotToWorkspace(workspaceRef.workspaceId, resolved, hydrateOptions);
    }

    if (workspaceRef.type === 'inline') {
      // Use a deterministic ID based on config content to avoid leaking
      // duplicate workspace instances on repeated calls.
      const configHash = createHash('sha256').update(JSON.stringify(workspaceRef.config)).digest('hex').slice(0, 12);
      return workspaceNs.hydrateSnapshotToWorkspace(`inline-${configHash}`, workspaceRef.config, hydrateOptions);
    }

    return undefined;
  }

  /**
   * Resolve agent-level skill configurations into a CompositeVersionedSkillSource.
   *
   * For each skill in the agent's `skills` map, checks the resolution strategy:
   * - `pin: '<versionId>'` → reads the specific version's tree from the DB
   * - `strategy: 'latest'` → reads the skill's active version tree
   * - `strategy: 'live'` or no strategy → skips (uses filesystem-based discovery)
   *
   * Returns a CompositeVersionedSkillSource if any versioned skills were resolved,
   * or undefined if all skills use filesystem-based discovery.
   */
  private async resolveAgentSkillSource(skills: StorageResolvedAgentType['skills']): Promise<SkillSource | undefined> {
    if (!skills || typeof skills !== 'object') return undefined;

    // Resolve conditional field to a plain record
    const skillConfigs = Array.isArray(skills) ? undefined : (skills as Record<string, StorageSkillConfig>);
    if (!skillConfigs || Object.keys(skillConfigs).length === 0) return undefined;

    const storage = this.mastra?.getStorage();
    if (!storage) return undefined;

    const skillStore = await storage.getStore('skills');
    if (!skillStore) return undefined;

    const blobStore = await this.editor.resolveBlobStore();
    if (!blobStore) return undefined;

    const versionedEntries: VersionedSkillEntry[] = [];

    for (const [skillId, config] of Object.entries(skillConfigs)) {
      if (!config) continue;

      // Determine if this skill should use versioned resolution
      const isPinned = !!config.pin;
      const isLatest = config.strategy === 'latest';

      if (!isPinned && !isLatest) {
        // 'live' strategy or no strategy — skip, use filesystem
        continue;
      }

      try {
        let version;
        let dirName: string;

        if (isPinned) {
          // Look up the specific pinned version
          version = await skillStore.getVersion(config.pin!);
          dirName = version?.name || skillId;
        } else {
          // strategy: 'latest' — resolve using activeVersionId (honors rollback)
          const resolved = await skillStore.getByIdResolved(skillId);
          if (resolved?.activeVersionId) {
            version = await skillStore.getVersion(resolved.activeVersionId);
          }
          if (!version) {
            version = await skillStore.getLatestVersion(skillId);
          }
          dirName = resolved?.name || version?.name || skillId;
        }

        if (!version?.tree) {
          this.logger?.warn(
            `[resolveAgentSkillSource] Skill '${skillId}' version has no tree manifest, skipping versioned resolution`,
          );
          continue;
        }
        versionedEntries.push({
          dirName,
          tree: version.tree,
          versionCreatedAt: version.createdAt,
        });
      } catch (error) {
        this.logger?.warn(`[resolveAgentSkillSource] Failed to resolve version for skill '${skillId}': ${error}`);
      }
    }

    if (versionedEntries.length === 0) return undefined;

    return new CompositeVersionedSkillSource(versionedEntries, blobStore);
  }
}
