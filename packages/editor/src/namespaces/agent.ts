import { Memory } from '@mastra/memory';
import { Agent } from '@mastra/core';

import type {
  Mastra,
  MastraMemory,
  MastraVectorProvider,
  ToolAction,
  Workflow,
  MastraScorers,
  StorageResolvedAgentType,
  StorageScorerConfig,
  SerializedMemoryConfig,
  SharedMemoryConfig,
} from '@mastra/core';

import type {
  StorageCreateAgentInput,
  StorageUpdateAgentInput,
  StorageListAgentsInput,
  StorageListAgentsOutput,
  StorageListAgentsResolvedOutput,
} from '@mastra/core/storage';

import type { RequestContext } from '@mastra/core/request-context';
import type { AgentInstructionBlock } from '@mastra/core/storage';
import type { Processor, InputProcessorOrWorkflow, OutputProcessorOrWorkflow } from '@mastra/core/processors';

import { resolveInstructionBlocks } from '../instruction-builder';
import { CrudEditorNamespace } from './base';
import type { StorageAdapter } from './base';

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
    const storage = this.mastra!.getStorage();
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

          const { id: _vId, agentId: _aId, versionNumber: _vn, changedFields: _cf, changeMessage: _cm, createdAt: _ca, ...snapshotConfig } = version;
          return { ...agent, ...snapshotConfig } as StorageResolvedAgentType;
        }
        return store.getByIdResolved(id);
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
      rawConfig: storedAgent as unknown as Record<string, unknown>,
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
