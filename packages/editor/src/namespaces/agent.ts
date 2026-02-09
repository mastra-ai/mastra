import { Memory } from '@mastra/memory';
import { Agent } from '@mastra/core';

import type {
  Mastra,
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

import type { RequestContext } from '@mastra/core/request-context';
import type { AgentInstructionBlock } from '@mastra/core/storage';
import type { Processor, InputProcessorOrWorkflow, OutputProcessorOrWorkflow } from '@mastra/core/processors';

import type { MastraEditor } from '../index';
import { resolveInstructionBlocks } from '../instruction-builder';

export class EditorAgentNamespace {
  constructor(private editor: MastraEditor) {}

  private get mastra(): Mastra | undefined {
    return this.editor.__mastra;
  }

  private get logger(): Logger | undefined {
    return this.editor.__logger;
  }

  private async getStore() {
    const storage = this.mastra!.getStorage();
    if (!storage) throw new Error('Storage is not configured');
    const store = await storage.getStore('agents');
    if (!store) throw new Error('Agents storage domain is not available');
    return store;
  }

  // ============================================================================
  // Public API
  // ============================================================================

  getById(
    id: string,
    options?: { returnRaw?: false; versionId?: string; versionNumber?: number },
  ): Promise<Agent | null>;
  getById(
    id: string,
    options: { returnRaw: true; versionId?: string; versionNumber?: number },
  ): Promise<StorageResolvedAgentType | null>;
  async getById(
    id: string,
    options?: { returnRaw?: boolean; versionId?: string; versionNumber?: number },
  ): Promise<Agent | StorageResolvedAgentType | null> {
    if (!this.mastra) {
      throw new Error('MastraEditor is not registered with a Mastra instance');
    }

    const agentsStore = await this.getStore();

    // Handle version resolution
    if (options?.versionId && options?.versionNumber !== undefined) {
      this.logger?.warn(`Both versionId and versionNumber provided for agent "${id}". Using versionId.`);
    }

    if (options?.versionId) {
      const version = await agentsStore.getVersion(options.versionId);
      if (!version) return null;
      if (version.agentId !== id) return null;

      const {
        id: _versionId,
        agentId: _agentId,
        versionNumber: _versionNumber,
        changedFields: _changedFields,
        changeMessage: _changeMessage,
        createdAt: _createdAt,
        ...snapshotConfig
      } = version;

      const agentRecord = await agentsStore.getAgentById({ id });
      if (!agentRecord) return null;

      const { activeVersionId: _activeVersionId, ...agentRecordWithoutActiveVersion } = agentRecord;
      const resolvedAgent: StorageResolvedAgentType = { ...agentRecordWithoutActiveVersion, ...snapshotConfig };
      if (options?.returnRaw) return resolvedAgent;
      return this.createAgentFromStoredConfig(resolvedAgent);
    }

    if (options?.versionNumber !== undefined) {
      const version = await agentsStore.getVersionByNumber(id, options.versionNumber);
      if (!version) return null;

      const {
        id: _versionId,
        agentId: _agentId,
        versionNumber: _versionNumber,
        changedFields: _changedFields,
        changeMessage: _changeMessage,
        createdAt: _createdAt,
        ...snapshotConfig
      } = version;

      const agentRecord = await agentsStore.getAgentById({ id });
      if (!agentRecord) return null;

      const { activeVersionId: _activeVersionId, ...agentRecordWithoutActiveVersion } = agentRecord;
      const resolvedAgent: StorageResolvedAgentType = { ...agentRecordWithoutActiveVersion, ...snapshotConfig };
      if (options?.returnRaw) return resolvedAgent;
      return this.createAgentFromStoredConfig(resolvedAgent);
    }

    // Default: get current agent config with version resolution
    if (!options?.returnRaw) {
      const agentCache = this.mastra.getStoredAgentCache();
      if (agentCache) {
        const cached = agentCache.get(id);
        if (cached) return cached;
        this.logger?.debug(`[getById] Cache miss for agent "${id}", fetching from storage`);
      }
    }

    const storedAgent = await agentsStore.getAgentByIdResolved({ id });
    if (!storedAgent) return null;

    if (options?.returnRaw) return storedAgent;

    const agent = await this.createAgentFromStoredConfig(storedAgent);

    const agentCache = this.mastra.getStoredAgentCache();
    if (agentCache) {
      agentCache.set(id, agent);
    }

    return agent;
  }

  list(options?: { returnRaw?: false; page?: number; pageSize?: number }): Promise<{
    agents: Agent[];
    total: number;
    page: number;
    perPage: number;
    hasMore: boolean;
  }>;
  list(options: { returnRaw: true; page?: number; pageSize?: number }): Promise<{
    agents: StorageResolvedAgentType[];
    total: number;
    page: number;
    perPage: number;
    hasMore: boolean;
  }>;
  async list(options?: { returnRaw?: boolean; page?: number; pageSize?: number }): Promise<{
    agents: Agent[] | StorageResolvedAgentType[];
    total: number;
    page: number;
    perPage: number | false;
    hasMore: boolean;
  }> {
    if (!this.mastra) {
      throw new Error('MastraEditor is not registered with a Mastra instance');
    }

    const agentsStore = await this.getStore();
    const result = await agentsStore.listAgentsResolved({
      page: options?.page,
      perPage: options?.pageSize,
      orderBy: { field: 'createdAt', direction: 'DESC' },
    });

    if (options?.returnRaw) return result;

    const agents = await Promise.all(
      result.agents.map((storedAgent: StorageResolvedAgentType) =>
        this.createAgentFromStoredConfig(storedAgent),
      ),
    );

    return {
      agents,
      total: result.total,
      page: result.page,
      perPage: result.perPage,
      hasMore: result.hasMore,
    };
  }

  clearCache(agentId?: string): void {
    if (!this.mastra) return;

    const agentCache = this.mastra.getStoredAgentCache();

    if (agentId) {
      if (agentCache) agentCache.delete(agentId);
      this.mastra.removeAgent(agentId);
      this.logger?.debug(`[clearCache] Cleared cache and registry for agent "${agentId}"`);
    } else {
      if (agentCache) agentCache.clear();
      this.logger?.debug('[clearCache] Cleared all cached agents');
    }
  }

  // ============================================================================
  // Private helpers
  // ============================================================================

  private async createAgentFromStoredConfig(storedAgent: StorageResolvedAgentType): Promise<Agent> {
    if (!this.mastra) {
      throw new Error('MastraEditor is not registered with a Mastra instance');
    }

    this.logger?.debug(`[createAgentFromStoredConfig] Creating agent from stored config "${storedAgent.id}"`);

    const tools = this.resolveStoredTools(storedAgent.tools);
    const workflows = this.resolveStoredWorkflows(storedAgent.workflows);
    const agents = this.resolveStoredAgents(storedAgent.agents);
    const memory = this.resolveStoredMemory(storedAgent.memory);
    const scorers = await this.resolveStoredScorers(storedAgent.scorers);
    const inputProcessors = this.resolveStoredInputProcessors(storedAgent.inputProcessors);
    const outputProcessors = this.resolveStoredOutputProcessors(storedAgent.outputProcessors);

    const modelConfig = storedAgent.model;
    if (!modelConfig || !modelConfig.provider || !modelConfig.name) {
      throw new Error(
        `Stored agent "${storedAgent.id}" has no active version or invalid model configuration. Both provider and name are required.`,
      );
    }
    const model = `${modelConfig.provider}/${modelConfig.name}`;

    const defaultOptions = storedAgent.defaultOptions;
    const instructions = this.resolveStoredInstructions(storedAgent.instructions);

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

  private resolveStoredTools(storedTools?: string[]): Record<string, ToolAction<any, any, any, any, any, any>> {
    if (!storedTools || storedTools.length === 0) return {};
    if (!this.mastra) return {};

    const resolvedTools: Record<string, ToolAction<any, any, any, any, any, any>> = {};
    for (const toolKey of storedTools) {
      try {
        resolvedTools[toolKey] = this.mastra.getToolById(toolKey);
      } catch {
        this.logger?.warn(`Tool "${toolKey}" referenced in stored agent but not registered in Mastra`);
      }
    }
    return resolvedTools;
  }

  private resolveStoredWorkflows(
    storedWorkflows?: string[],
  ): Record<string, Workflow<any, any, any, any, any, any, any>> {
    if (!storedWorkflows || storedWorkflows.length === 0) return {};
    if (!this.mastra) return {};

    const resolvedWorkflows: Record<string, Workflow<any, any, any, any, any, any, any>> = {};
    for (const workflowKey of storedWorkflows) {
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

  private resolveStoredAgents(storedAgents?: string[]): Record<string, Agent<any>> {
    if (!storedAgents || storedAgents.length === 0) return {};
    if (!this.mastra) return {};

    const resolvedAgents: Record<string, Agent<any>> = {};
    for (const agentKey of storedAgents) {
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

      if (memoryConfig.options?.semanticRecall && (!vector || !memoryConfig.embedder)) {
        this.logger?.warn(
          'Semantic recall is enabled but no vector store or embedder are configured. ' +
            'Creating memory without semantic recall. ' +
            'To use semantic recall, configure a vector store and embedder in your Mastra instance.',
        );

        const adjustedOptions = { ...memoryConfig.options, semanticRecall: false };
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
        options: memoryConfig.options,
        embedder: memoryConfig.embedder,
        embedderOptions: memoryConfig.embedderOptions,
      };
      return new Memory(sharedConfig);
    } catch (error) {
      this.logger?.error('Failed to resolve memory from config', { error });
      return undefined;
    }
  }

  private async resolveStoredScorers(storedScorers?: Record<string, StorageScorerConfig>): Promise<MastraScorers | undefined> {
    if (!storedScorers || Object.keys(storedScorers).length === 0) return undefined;
    if (!this.mastra) return undefined;

    const resolvedScorers: MastraScorers = {};
    const storage = this.mastra.getStorage();
    const scorerStore = storage ? await storage.getStore('scorerDefinitions') : null;

    for (const [scorerKey, scorerConfig] of Object.entries(storedScorers)) {
      // DB takes priority: try stored scorer definitions first
      if (scorerStore) {
        try {
          const storedDef = await scorerStore.getScorerDefinitionByIdResolved({ id: scorerKey });
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

  private resolveStoredOutputProcessors(storedProcessors?: string[]): OutputProcessorOrWorkflow[] | undefined {
    if (!storedProcessors || storedProcessors.length === 0) return undefined;

    const resolved: OutputProcessorOrWorkflow[] = [];
    for (const key of storedProcessors) {
      const processor = this.findProcessor(key);
      if (
        processor &&
        (processor.processOutputStream || processor.processOutputResult || processor.processOutputStep)
      ) {
        resolved.push(processor as OutputProcessorOrWorkflow);
      }
    }
    return resolved.length > 0 ? resolved : undefined;
  }
}
