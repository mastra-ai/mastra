import { Memory } from '@mastra/memory';
import { Agent } from '@mastra/core';
import { convertSchemaToZod } from '@mastra/schema-compat';

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
  StorageToolConfig,
} from '@mastra/core';

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
} from '@mastra/core/storage';

import type { RequestContext } from '@mastra/core/request-context';
import type { Processor, InputProcessorOrWorkflow, OutputProcessorOrWorkflow } from '@mastra/core/processors';

import { evaluateRuleGroup } from '../rule-evaluator';
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

          const {
            id: _vId,
            agentId: _aId,
            versionNumber: _vn,
            changedFields: _cf,
            changeMessage: _cm,
            createdAt: _ca,
            ...snapshotConfig
          } = version;
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

    // --- Resolve fields: conditional fields accumulate all matching variants ---

    // Tools (Record): accumulate by merging objects from all matching variants
    const tools = hasConditionalTools
      ? ({ requestContext }: { requestContext: RequestContext }) => {
          const ctx = requestContext.toJSON();
          const resolved = this.accumulateObjectVariants(
            storedAgent.tools as StorageConditionalVariant<Record<string, StorageToolConfig>>[],
            ctx,
          );
          return this.resolveStoredTools(resolved);
        }
      : this.resolveStoredTools(storedAgent.tools as Record<string, StorageToolConfig> | undefined);

    // Workflows (array): accumulate by concatenating all matching variants
    const workflows = hasConditionalWorkflows
      ? ({ requestContext }: { requestContext: RequestContext }) => {
          const ctx = requestContext.toJSON();
          const resolved = this.accumulateArrayVariants(
            storedAgent.workflows as StorageConditionalVariant<string[]>[],
            ctx,
          );
          return this.resolveStoredWorkflows(resolved);
        }
      : this.resolveStoredWorkflows(storedAgent.workflows as string[] | undefined);

    // Agents (array): accumulate by concatenating all matching variants
    const agents = hasConditionalAgents
      ? ({ requestContext }: { requestContext: RequestContext }) => {
          const ctx = requestContext.toJSON();
          const resolved = this.accumulateArrayVariants(
            storedAgent.agents as StorageConditionalVariant<string[]>[],
            ctx,
          );
          return this.resolveStoredAgents(resolved);
        }
      : this.resolveStoredAgents(storedAgent.agents as string[] | undefined);

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

    // Input processors (array): accumulate by concatenating all matching variants
    const inputProcessors = hasConditionalInputProcessors
      ? ({ requestContext }: { requestContext: RequestContext }) => {
          const ctx = requestContext.toJSON();
          const resolved = this.accumulateArrayVariants(
            storedAgent.inputProcessors as StorageConditionalVariant<string[]>[],
            ctx,
          );
          return this.resolveStoredInputProcessors(resolved);
        }
      : this.resolveStoredInputProcessors(storedAgent.inputProcessors as string[] | undefined);

    // Output processors (array): accumulate by concatenating all matching variants
    const outputProcessors = hasConditionalOutputProcessors
      ? ({ requestContext }: { requestContext: RequestContext }) => {
          const ctx = requestContext.toJSON();
          const resolved = this.accumulateArrayVariants(
            storedAgent.outputProcessors as StorageConditionalVariant<string[]>[],
            ctx,
          );
          return this.resolveStoredOutputProcessors(resolved);
        }
      : this.resolveStoredOutputProcessors(storedAgent.outputProcessors as string[] | undefined);

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
