import { Memory } from '@mastra/memory';
import {
  Agent,
  Mastra,
  IMastraEditor,
  MastraEditorConfig,
} from '@mastra/core';

import type {
  MastraMemory,
  MastraVectorProvider,
  Logger,
  ToolAction,
  Workflow,
  MastraScorers,
  StorageResolvedAgentType,
  StorageScorerConfig,
  SerializedMemoryConfig,
  SharedMemoryConfig,
} from '@mastra/core';

import type {
  Processor,
  InputProcessorOrWorkflow,
  OutputProcessorOrWorkflow,
} from '@mastra/core/processors';

export type { MastraEditorConfig };

export class MastraEditor implements IMastraEditor {
  private logger?: Logger;
  private mastra?: Mastra;

  constructor(config?: MastraEditorConfig) {
    this.logger = config?.logger;
  }

  /**
   * Register this editor with a Mastra instance.
   * This gives the editor access to Mastra's storage, tools, workflows, etc.
   */
  registerWithMastra(mastra: Mastra): void {
    this.mastra = mastra;
    // Use Mastra's logger if not already set
    if (!this.logger) {
      this.logger = mastra.getLogger();
    }
  }

  /**
   * Get the agents storage domain from the Mastra storage.
   */
  private async getAgentsStore() {
    const storage = this.mastra!.getStorage();
    if (!storage) throw new Error('Storage is not configured');
    const agentsStore = await storage.getStore('agents');
    if (!agentsStore) throw new Error('Agents storage domain is not available');
    return agentsStore;
  }

  /**
   * Get a stored agent by its ID.
   * Returns null when agent is not found. Returns an Agent instance by default,
   * or raw StorageResolvedAgentType when raw option is true.
   */
  public async getStoredAgentById(
    id: string,
    options?: { returnRaw?: false; versionId?: string; versionNumber?: number },
  ): Promise<Agent | null>;
  public async getStoredAgentById(
    id: string,
    options: { returnRaw: true; versionId?: string; versionNumber?: number },
  ): Promise<StorageResolvedAgentType | null>;
  public async getStoredAgentById(
    id: string,
    options?: { returnRaw?: boolean; versionId?: string; versionNumber?: number },
  ): Promise<Agent | StorageResolvedAgentType | null> {
    if (!this.mastra) {
      throw new Error('MastraEditor is not registered with a Mastra instance');
    }

    const agentsStore = await this.getAgentsStore();

    // Handle version resolution
    if (options?.versionId && options?.versionNumber !== undefined) {
      this.logger?.warn(`Both versionId and versionNumber provided for agent "${id}". Using versionId.`);
    }

    if (options?.versionId) {
      // Fetch the specific version by its ID
      const version = await agentsStore.getVersion(options.versionId);
      if (!version) {
        return null;
      }
      // Verify the version belongs to the requested agent
      if (version.agentId !== id) {
        return null;
      }
      // Extract snapshot config fields from the version (strip version-specific metadata)
      const {
        id: _versionId,
        agentId: _agentId,
        versionNumber: _versionNumber,
        changedFields: _changedFields,
        changeMessage: _changeMessage,
        createdAt: _createdAt,
        ...snapshotConfig
      } = version;

      // Fetch the thin agent record to build a resolved agent
      const agentRecord = await agentsStore.getAgentById({ id });
      if (!agentRecord) {
        return null;
      }

      // When retrieving a specific version, we should not use the activeVersionId from the agent record
      const { activeVersionId: _activeVersionId, ...agentRecordWithoutActiveVersion } = agentRecord;
      const resolvedAgent: StorageResolvedAgentType = { ...agentRecordWithoutActiveVersion, ...snapshotConfig };
      if (options?.returnRaw) {
        return resolvedAgent;
      }
      return this.createAgentFromStoredConfig(resolvedAgent);
    }

    if (options?.versionNumber !== undefined) {
      // Fetch the specific version by agent ID and version number
      const version = await agentsStore.getVersionByNumber(id, options.versionNumber);
      if (!version) {
        return null;
      }
      // Extract snapshot config fields from the version (strip version-specific metadata)
      const {
        id: _versionId,
        agentId: _agentId,
        versionNumber: _versionNumber,
        changedFields: _changedFields,
        changeMessage: _changeMessage,
        createdAt: _createdAt,
        ...snapshotConfig
      } = version;

      // Fetch the thin agent record to build a resolved agent
      const agentRecord = await agentsStore.getAgentById({ id });
      if (!agentRecord) {
        return null;
      }

      // When retrieving a specific version, we should not use the activeVersionId from the agent record
      const { activeVersionId: _activeVersionId, ...agentRecordWithoutActiveVersion } = agentRecord;
      const resolvedAgent: StorageResolvedAgentType = { ...agentRecordWithoutActiveVersion, ...snapshotConfig };
      if (options?.returnRaw) {
        return resolvedAgent;
      }
      return this.createAgentFromStoredConfig(resolvedAgent);
    }

    // Default behavior: get the current agent config with version resolution
    // Check cache first for non-raw requests (allows in-memory model changes to persist)
    if (!options?.returnRaw) {
      const agentCache = this.mastra.getStoredAgentCache();
      if (agentCache) {
        const cached = agentCache.get(id);
        if (cached) {
          this.logger?.debug(`[getStoredAgentById] Returning cached agent "${id}"`);
          return cached;
        }
        this.logger?.debug(`[getStoredAgentById] Cache miss for agent "${id}", fetching from storage`);
      }
    }

    const storedAgent = await agentsStore.getAgentByIdResolved({ id });

    if (!storedAgent) {
      return null;
    }

    if (options?.returnRaw) {
      return storedAgent;
    }

    const agent = this.createAgentFromStoredConfig(storedAgent);

    // Cache the agent for future requests
    const agentCache = this.mastra.getStoredAgentCache();
    if (agentCache) {
      agentCache.set(id, agent);
    }

    return agent;
  }

  /**
   * List all stored agents with page-based pagination.
   */
  public async listStoredAgents(options?: {
    returnRaw?: false;
    page?: number;
    pageSize?: number;
  }): Promise<{
    agents: Agent[];
    total: number;
    page: number;
    perPage: number;
    hasMore: boolean;
  }>;
  public async listStoredAgents(options: {
    returnRaw: true;
    page?: number;
    pageSize?: number;
  }): Promise<{
    agents: StorageResolvedAgentType[];
    total: number;
    page: number;
    perPage: number;
    hasMore: boolean;
  }>;
  public async listStoredAgents(options?: {
    returnRaw?: boolean;
    page?: number;
    pageSize?: number;
  }): Promise<{
    agents: Agent[] | StorageResolvedAgentType[];
    total: number;
    page: number;
    perPage: number | false;
    hasMore: boolean;
  }> {
    if (!this.mastra) {
      throw new Error('MastraEditor is not registered with a Mastra instance');
    }

    const agentsStore = await this.getAgentsStore();

    // Use listAgentsResolved to get version-resolved configs
    const result = await agentsStore.listAgentsResolved({
      page: options?.page,
      perPage: options?.pageSize,
      orderBy: { field: 'createdAt', direction: 'DESC' },
    });

    if (options?.returnRaw) {
      return result;
    }

    // Transform stored configs into Agent instances
    const agents = result.agents.map((storedAgent: StorageResolvedAgentType) =>
      this.createAgentFromStoredConfig(storedAgent),
    );

    return {
      agents,
      total: result.total,
      page: result.page,
      perPage: result.perPage,
      hasMore: result.hasMore,
    };
  }

  /**
   * Clear the stored agent cache for a specific agent ID, or all cached agents.
   */
  public clearStoredAgentCache(agentId?: string): void {
    if (!this.mastra) return;

    const agentCache = this.mastra.getStoredAgentCache();
    if (!agentCache) return;

    if (agentId) {
      agentCache.delete(agentId);
      this.logger?.debug(`[clearStoredAgentCache] Cleared cache for agent "${agentId}"`);
    } else {
      agentCache.clear();
      this.logger?.debug('[clearStoredAgentCache] Cleared all cached agents');
    }
  }

  /**
   * Create an Agent instance from stored configuration.
   * Resolves all stored references (tools, workflows, agents, memory, scorers)
   * and registers the agent with the Mastra instance.
   */
  private createAgentFromStoredConfig(storedAgent: StorageResolvedAgentType): Agent {
    if (!this.mastra) {
      throw new Error('MastraEditor is not registered with a Mastra instance');
    }

    this.logger?.debug(`[createAgentFromStoredConfig] Creating agent from stored config "${storedAgent.id}"`);

    // Resolve all the stored references to actual instances
    const tools = this.resolveStoredTools(storedAgent.tools);
    const workflows = this.resolveStoredWorkflows(storedAgent.workflows);
    const agents = this.resolveStoredAgents(storedAgent.agents);
    const memory = this.resolveStoredMemory(storedAgent.memory);
    console.log(`[createAgentFromStoredConfig] Resolved memory: ${memory ? 'Memory instance created' : 'No memory'} for agent \"${storedAgent.id}\"`, { memory });
    const scorers = this.resolveStoredScorers(storedAgent.scorers);
    const inputProcessors = this.resolveStoredInputProcessors(storedAgent.inputProcessors);
    const outputProcessors = this.resolveStoredOutputProcessors(storedAgent.outputProcessors);

    // Extract model configuration
    const modelConfig = storedAgent.model;

    // Skip agents without model configuration (no active version)
    if (!modelConfig || !modelConfig.provider || !modelConfig.name) {
      throw new Error(
        `Stored agent "${storedAgent.id}" has no active version or invalid model configuration. Both provider and name are required.`,
      );
    }
    const model = `${modelConfig.provider}/${modelConfig.name}`;

    // Extract additional options from defaultOptions
    const defaultOptions = storedAgent.defaultOptions;

    // Create agent instance with resolved dependencies
    const agent = new Agent({
      id: storedAgent.id,
      name: storedAgent.name,
      description: storedAgent.description,
      instructions: storedAgent.instructions,
      model,
      memory,
      tools,
      workflows,
      agents,
      scorers,
      mastra: this.mastra,
      inputProcessors,
      outputProcessors,
      defaultOptions: {
        maxSteps: defaultOptions?.maxSteps,
        modelSettings: {
          temperature: modelConfig.temperature,
          topP: modelConfig.topP,
          frequencyPenalty: modelConfig.frequencyPenalty,
          presencePenalty: modelConfig.presencePenalty,
          maxOutputTokens: modelConfig.maxCompletionTokens,
        },
      },
    });

    this.mastra?.addAgent(agent, storedAgent.id, { source: 'stored' });

    this.logger?.debug(`[createAgentFromStoredConfig] Successfully created agent \"${storedAgent.id}\"`);

    return agent;
  }

  /**
   * Resolve stored tool IDs to actual tool instances from Mastra's registry.
   */
  private resolveStoredTools(storedTools?: string[]): Record<string, ToolAction<any, any, any, any, any, any>> {
    if (!storedTools || storedTools.length === 0) {
      return {};
    }

    if (!this.mastra) {
      return {};
    }

    const resolvedTools: Record<string, ToolAction<any, any, any, any, any, any>> = {};

    for (const toolKey of storedTools) {
      try {
        const tool = this.mastra.getToolById(toolKey);
        resolvedTools[toolKey] = tool;
      } catch {
        this.logger?.warn(`Tool "${toolKey}" referenced in stored agent but not registered in Mastra`);
      }
    }

    return resolvedTools;
  }

  /**
   * Resolve stored workflow IDs to actual workflow instances from Mastra's registry.
   */
  private resolveStoredWorkflows(
    storedWorkflows?: string[],
  ): Record<string, Workflow<any, any, any, any, any, any, any>> {
    if (!storedWorkflows || storedWorkflows.length === 0) {
      return {};
    }

    if (!this.mastra) {
      return {};
    }

    const resolvedWorkflows: Record<string, Workflow<any, any, any, any, any, any, any>> = {};

    for (const workflowKey of storedWorkflows) {
      try {
        const workflow = this.mastra.getWorkflow(workflowKey);
        resolvedWorkflows[workflowKey] = workflow;
      } catch {
        try {
          const workflow = this.mastra.getWorkflowById(workflowKey);
          resolvedWorkflows[workflowKey] = workflow;
        } catch {
          this.logger?.warn(`Workflow "${workflowKey}" referenced in stored agent but not registered in Mastra`);
        }
      }
    }

    return resolvedWorkflows;
  }

  /**
   * Resolve stored agent IDs to actual agent instances from Mastra's registry.
   */
  private resolveStoredAgents(storedAgents?: string[]): Record<string, Agent<any>> {
    if (!storedAgents || storedAgents.length === 0) {
      return {};
    }

    if (!this.mastra) {
      return {};
    }

    const resolvedAgents: Record<string, Agent<any>> = {};

    for (const agentKey of storedAgents) {
      try {
        const agent = this.mastra.getAgent(agentKey);
        resolvedAgents[agentKey] = agent;
      } catch {
        try {
          const agent = this.mastra.getAgentById(agentKey);
          resolvedAgents[agentKey] = agent;
        } catch {
          this.logger?.warn(`Agent "${agentKey}" referenced in stored agent but not registered in Mastra`);
        }
      }
    }

    return resolvedAgents;
  }

  /**
   * Resolve stored memory config to a MastraMemory instance.
   * Uses @mastra/memory Memory class to instantiate from serialized config.
   */
  private resolveStoredMemory(memoryConfig?: SerializedMemoryConfig): MastraMemory | undefined {
    this.logger?.debug(`[resolveStoredMemory] Called with config:`, { memoryConfig });
    if (!memoryConfig) {
      this.logger?.debug(`[resolveStoredMemory] No memory config provided`);
      return undefined;
    }

    if (!this.mastra) {
      this.logger?.warn('MastraEditor not registered with Mastra instance. Cannot instantiate memory.');
      return undefined;
    }

    try {
      // Resolve vector provider if specified
      let vector: MastraVectorProvider | undefined;
      if (memoryConfig.vector) {
        const vectors = this.mastra.listVectors();
        vector = vectors?.[memoryConfig.vector];
        if (!vector) {
          this.logger?.warn(`Vector provider "${memoryConfig.vector}" not found in Mastra instance`);
        }
      }

      // Construct the full memory config
      const sharedConfig: SharedMemoryConfig = {
        storage: this.mastra.getStorage(),
        vector,
        options: memoryConfig.options,
        embedder: memoryConfig.embedder,
        embedderOptions: memoryConfig.embedderOptions,
      };

      // Instantiate Memory class
      return new Memory(sharedConfig);
    } catch (error) {
      this.logger?.error('Failed to resolve memory from config', { error });
      return undefined;
    }
  }

  /**
   * Resolve stored scorer configs to MastraScorers instances.
   */
  private resolveStoredScorers(storedScorers?: Record<string, StorageScorerConfig>): MastraScorers | undefined {
    if (!storedScorers || Object.keys(storedScorers).length === 0) {
      return undefined;
    }

    if (!this.mastra) {
      return undefined;
    }

    const resolvedScorers: MastraScorers = {};

    for (const [scorerKey, scorerConfig] of Object.entries(storedScorers)) {
      // Try to find the scorer in registered scorers by key
      try {
        const scorer = this.mastra.getScorer(scorerKey);
        resolvedScorers[scorerKey] = {
          scorer,
          sampling: scorerConfig.sampling,
        };
      } catch {
        // Try by ID
        try {
          const scorer = this.mastra.getScorerById(scorerKey);
          resolvedScorers[scorerKey] = {
            scorer,
            sampling: scorerConfig.sampling,
          };
        } catch {
          this.logger?.warn(`Scorer "${scorerKey}" referenced in stored agent but not registered in Mastra`);
        }
      }
    }

    return Object.keys(resolvedScorers).length > 0 ? resolvedScorers : undefined;
  }

  /**
   * Look up a processor by key or ID from Mastra's registry.
   */
  private findProcessor(processorKey: string): Processor<any> | undefined {
    if (!this.mastra) return undefined;

    try {
      return this.mastra.getProcessor(processorKey);
    } catch {
      try {
        return this.mastra.getProcessorById(processorKey);
      } catch {
        this.logger?.warn(`Processor "${processorKey}" referenced in stored agent but not registered in Mastra`);
        return undefined;
      }
    }
  }

  /**
   * Resolve stored input processor keys to actual processor instances.
   */
  private resolveStoredInputProcessors(storedProcessors?: string[]): InputProcessorOrWorkflow[] | undefined {
    if (!storedProcessors || storedProcessors.length === 0) return undefined;

    const resolved: InputProcessorOrWorkflow[] = [];
    for (const key of storedProcessors) {
      const processor = this.findProcessor(key);
      if (processor && (processor.processInput || processor.processInputStep)) {
        resolved.push(processor as InputProcessorOrWorkflow);
      }
    }
    return resolved.length > 0 ? resolved : undefined;
  }

  /**
   * Resolve stored output processor keys to actual processor instances.
   */
  private resolveStoredOutputProcessors(storedProcessors?: string[]): OutputProcessorOrWorkflow[] | undefined {
    if (!storedProcessors || storedProcessors.length === 0) return undefined;

    const resolved: OutputProcessorOrWorkflow[] = [];
    for (const key of storedProcessors) {
      const processor = this.findProcessor(key);
      if (processor && (processor.processOutputStream || processor.processOutputResult || processor.processOutputStep)) {
        resolved.push(processor as OutputProcessorOrWorkflow);
      }
    }
    return resolved.length > 0 ? resolved : undefined;
  }
}
