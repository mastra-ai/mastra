import { randomUUID } from 'node:crypto';
import type { TextPart, UIMessage, StreamObjectResult } from '@internal/ai-sdk-v4';
import { OpenAIReasoningSchemaCompatLayer, OpenAISchemaCompatLayer } from '@mastra/schema-compat';
import type { ModelInformation } from '@mastra/schema-compat';
import type { JSONSchema7 } from 'json-schema';
import { z } from 'zod';
import type { ZodSchema } from 'zod';
import type { MastraPrimitives, MastraUnion } from '../action';
import { MastraBase } from '../base';
import { MastraError, ErrorDomain, ErrorCategory } from '../error';
import type {
  ScorerRunInputForAgent,
  ScorerRunOutputForAgent,
  MastraScorers,
  MastraScorer,
  ScoringSamplingConfig,
} from '../evals';
import { runScorer } from '../evals/hooks';
import { resolveModelConfig } from '../llm';
import { MastraLLMV1 } from '../llm/model';
import type { GenerateObjectResult, GenerateTextResult, StreamTextResult } from '../llm/model/base.types';
import { MastraLLMVNext } from '../llm/model/model.loop';
import { ModelRouterLanguageModel } from '../llm/model/router';
import type {
  MastraLanguageModel,
  MastraLanguageModelV2,
  MastraLegacyLanguageModel,
  MastraModelConfig,
} from '../llm/model/shared.types';
import { RegisteredLogger } from '../logger';
import { networkLoop } from '../loop/network';
import type { Mastra } from '../mastra';
import type { MastraMemory } from '../memory/memory';
import type { MemoryConfig } from '../memory/types';
import type { TracingContext, TracingProperties } from '../observability';
import { EntityType, InternalSpans, SpanType, getOrCreateSpan } from '../observability';
import type {
  InputProcessorOrWorkflow,
  OutputProcessorOrWorkflow,
  ProcessorWorkflow,
  Processor,
} from '../processors/index';
import { ProcessorStepSchema, isProcessorWorkflow } from '../processors/index';
import { SkillsProcessor } from '../processors/processors/skills';
import { WorkspaceInstructionsProcessor } from '../processors/processors/workspace-instructions';
import type { ProcessorState } from '../processors/runner';
import { ProcessorRunner } from '../processors/runner';
import { RequestContext, MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY } from '../request-context';

import type { MastraAgentNetworkStream } from '../stream';
import type { FullOutput, MastraModelOutput } from '../stream/base/output';
import { createTool } from '../tools';
import type { CoreTool } from '../tools/types';
import type { DynamicArgument } from '../types';
import { makeCoreTool, createMastraProxy, ensureToolProperties, isZodType, deepMerge } from '../utils';
import type { ToolOptions } from '../utils';
import type { MastraVoice } from '../voice';
import { DefaultVoice } from '../voice';
import { createWorkflow, createStep, isProcessor } from '../workflows';
import type { AnyWorkflow, OutputWriter, Step, WorkflowResult } from '../workflows';
import type { AnyWorkspace } from '../workspace';
import { createWorkspaceTools } from '../workspace';
import type { SkillFormat } from '../workspace/skills';
import { zodToJsonSchema } from '../zod-to-json';
import { AgentLegacyHandler } from './agent-legacy';
import type {
  AgentExecutionOptions,
  AgentExecutionOptionsBase,
  InnerAgentExecutionOptions,
  MultiPrimitiveExecutionOptions,
  NetworkOptions,
} from './agent.types';
import { MessageList } from './message-list';
import type { MessageInput, MessageListInput, UIMessageWithMetadata, MastraDBMessage } from './message-list';
import { SaveQueueManager } from './save-queue';
import { TripWire } from './trip-wire';
import type {
  AgentConfig,
  AgentGenerateOptions,
  AgentStreamOptions,
  ToolsetsInput,
  ToolsInput,
  AgentModelManagerConfig,
  AgentCreateOptions,
  AgentExecuteOnFinishOptions,
  AgentInstructions,
  AgentMethodType,
  StructuredOutputOptions,
} from './types';
import { isSupportedLanguageModel, resolveThreadIdFromArgs, supportedLanguageModelSpecifications } from './utils';
import { createPrepareStreamWorkflow } from './workflows/prepare-stream';

export type MastraLLM = MastraLLMV1 | MastraLLMVNext;

type ModelFallbacks = {
  id: string;
  model: DynamicArgument<MastraModelConfig>;
  maxRetries: number;
  enabled: boolean;
}[];

function resolveMaybePromise<T, R = void>(value: T | Promise<T> | PromiseLike<T>, cb: (value: T) => R): R | Promise<R> {
  if (value instanceof Promise || (value != null && typeof (value as PromiseLike<T>).then === 'function')) {
    return Promise.resolve(value).then(cb);
  }

  return cb(value as T);
}

/**
 * The Agent class is the foundation for creating AI agents in Mastra. It provides methods for generating responses,
 * streaming interactions, managing memory, and handling voice capabilities.
 *
 * @example
 * ```typescript
 * import { Agent } from '@mastra/core/agent';
 * import { Memory } from '@mastra/memory';
 *
 * const agent = new Agent({
 *   id: 'my-agent',
 *   name: 'My Agent',
 *   instructions: 'You are a helpful assistant',
 *   model: 'openai/gpt-5',
 *   tools: {
 *     calculator: calculatorTool,
 *   },
 *   memory: new Memory(),
 * });
 * ```
 */
export class Agent<
  TAgentId extends string = string,
  TTools extends ToolsInput = ToolsInput,
  TOutput = undefined,
  TRequestContext extends Record<string, any> | unknown = unknown,
> extends MastraBase {
  public id: TAgentId;
  public name: string;
  public source?: 'code' | 'stored';
  #instructions: DynamicArgument<AgentInstructions, TRequestContext>;
  readonly #description?: string;
  model: DynamicArgument<MastraModelConfig> | ModelFallbacks;
  #originalModel: DynamicArgument<MastraModelConfig> | ModelFallbacks;
  maxRetries?: number;
  #mastra?: Mastra;
  #memory?: DynamicArgument<MastraMemory>;
  #skillsFormat?: SkillFormat;
  #workflows?: DynamicArgument<Record<string, AnyWorkflow>>;
  #defaultGenerateOptionsLegacy: DynamicArgument<AgentGenerateOptions>;
  #defaultStreamOptionsLegacy: DynamicArgument<AgentStreamOptions>;
  #defaultOptions: DynamicArgument<AgentExecutionOptions<TOutput>>;
  #defaultNetworkOptions: DynamicArgument<NetworkOptions>;
  #tools: DynamicArgument<TTools, TRequestContext>;
  #scorers: DynamicArgument<MastraScorers>;
  #agents: DynamicArgument<Record<string, Agent>>;
  #voice: MastraVoice;
  #workspace?: DynamicArgument<AnyWorkspace | undefined>;
  #inputProcessors?: DynamicArgument<InputProcessorOrWorkflow[]>;
  #outputProcessors?: DynamicArgument<OutputProcessorOrWorkflow[]>;
  #maxProcessorRetries?: number;
  #requestContextSchema?: ZodSchema<TRequestContext>;
  readonly #options?: AgentCreateOptions;
  #legacyHandler?: AgentLegacyHandler;

  // This flag is for agent network messages. We should change the agent network formatting and remove this flag after.
  private _agentNetworkAppend = false;

  /**
   * Creates a new Agent instance with the specified configuration.
   *
   * @example
   * ```typescript
   * import { Agent } from '@mastra/core/agent';
   * import { Memory } from '@mastra/memory';
   *
   * const agent = new Agent({
   *   id: 'weatherAgent',
   *   name: 'Weather Agent',
   *   instructions: 'You help users with weather information',
   *   model: 'openai/gpt-5',
   *   tools: { getWeather },
   *   memory: new Memory(),
   *   maxRetries: 2,
   * });
   * ```
   */
  constructor(config: AgentConfig<TAgentId, TTools, TOutput, TRequestContext>) {
    super({ component: RegisteredLogger.AGENT, rawConfig: config.rawConfig });

    this.name = config.name;
    this.id = config.id ?? config.name;
    this.source = 'code';

    this.#instructions = config.instructions;
    this.#description = config.description;
    this.#options = config.options;

    if (!config.model) {
      const mastraError = new MastraError({
        id: 'AGENT_CONSTRUCTOR_MODEL_REQUIRED',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        details: {
          agentName: config.name,
        },
        text: `LanguageModel is required to create an Agent. Please provide the 'model'.`,
      });
      this.logger.trackException(mastraError);
      this.logger.error(mastraError.toString());
      throw mastraError;
    }

    if (Array.isArray(config.model)) {
      if (config.model.length === 0) {
        const mastraError = new MastraError({
          id: 'AGENT_CONSTRUCTOR_MODEL_ARRAY_EMPTY',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          details: {
            agentName: config.name,
          },
          text: `Model array is empty. Please provide at least one model.`,
        });
        this.logger.trackException(mastraError);
        this.logger.error(mastraError.toString());
        throw mastraError;
      }
      this.model = config.model.map(mdl => ({
        id: randomUUID(),
        model: mdl.model,
        maxRetries: mdl.maxRetries ?? config?.maxRetries ?? 0,
        enabled: mdl.enabled ?? true,
      }));
      this.#originalModel = [...this.model];
    } else {
      this.model = config.model;
      this.#originalModel = config.model;
    }

    this.maxRetries = config.maxRetries ?? 0;

    if (config.workflows) {
      this.#workflows = config.workflows;
    }

    this.#defaultGenerateOptionsLegacy = config.defaultGenerateOptionsLegacy || {};
    this.#defaultStreamOptionsLegacy = config.defaultStreamOptionsLegacy || {};
    this.#defaultOptions = config.defaultOptions || ({} as AgentExecutionOptions<TOutput>);
    this.#defaultNetworkOptions = config.defaultNetworkOptions || {};

    this.#tools = config.tools || ({} as TTools);

    if (config.mastra) {
      this.__registerMastra(config.mastra);
      this.__registerPrimitives({
        logger: config.mastra.getLogger(),
      });
    }

    this.#scorers = config.scorers || ({} as MastraScorers);

    this.#agents = config.agents || ({} as Record<string, Agent>);

    if (config.memory) {
      this.#memory = config.memory;
    }

    if (config.skillsFormat) {
      this.#skillsFormat = config.skillsFormat;
    }

    if (config.voice) {
      this.#voice = config.voice;
      if (typeof config.tools !== 'function') {
        this.#voice?.addTools(this.#tools as TTools);
      }
      if (typeof config.instructions === 'string') {
        this.#voice?.addInstructions(config.instructions);
      }
    } else {
      this.#voice = new DefaultVoice();
    }

    if (config.workspace) {
      this.#workspace = config.workspace;
    }

    if (config.inputProcessors) {
      this.#inputProcessors = config.inputProcessors;
    }

    if (config.outputProcessors) {
      this.#outputProcessors = config.outputProcessors;
    }

    if (config.maxProcessorRetries !== undefined) {
      this.#maxProcessorRetries = config.maxProcessorRetries;
    }

    if (config.requestContextSchema) {
      this.#requestContextSchema = config.requestContextSchema;
    }

    // @ts-expect-error Flag for agent network messages
    this._agentNetworkAppend = config._agentNetworkAppend || false;
  }

  getMastraInstance() {
    return this.#mastra;
  }

  /**
   * Gets the skills processors to add to input processors when workspace has skills.
   * @internal
   */
  private async getSkillsProcessors(
    configuredProcessors: InputProcessorOrWorkflow[],
    requestContext?: RequestContext,
  ): Promise<InputProcessorOrWorkflow[]> {
    // Check if workspace has skills configured
    const workspace = await this.getWorkspace({ requestContext: requestContext || new RequestContext() });
    if (!workspace?.skills) {
      return [];
    }

    // Check for existing SkillsProcessor in configured processors to avoid duplicates
    const hasSkillsProcessor = configuredProcessors.some(
      p => !isProcessorWorkflow(p) && 'id' in p && p.id === 'skills-processor',
    );
    if (hasSkillsProcessor) {
      return [];
    }

    // Create new SkillsProcessor using workspace
    return [new SkillsProcessor({ workspace, format: this.#skillsFormat })];
  }

  /**
   * Gets the workspace-instructions processors to add when the workspace has a
   * filesystem or sandbox (i.e. something to describe).
   * @internal
   */
  private async getWorkspaceInstructionsProcessors(
    configuredProcessors: InputProcessorOrWorkflow[],
    requestContext?: RequestContext,
  ): Promise<InputProcessorOrWorkflow[]> {
    const workspace = await this.getWorkspace({ requestContext: requestContext || new RequestContext() });
    if (!workspace) return [];

    // Skip if workspace has no filesystem or sandbox (nothing to describe)
    if (!workspace.filesystem && !workspace.sandbox) return [];

    // Check for existing processor to avoid duplicates
    const hasProcessor = configuredProcessors.some(
      p => !isProcessorWorkflow(p) && 'id' in p && p.id === 'workspace-instructions-processor',
    );
    if (hasProcessor) return [];

    return [new WorkspaceInstructionsProcessor({ workspace })];
  }

  /**
   * Validates the request context against the agent's requestContextSchema.
   * Throws an error if validation fails.
   */
  async #validateRequestContext(requestContext?: RequestContext) {
    if (this.#requestContextSchema && isZodType(this.#requestContextSchema)) {
      const contextValues = requestContext?.all ?? {};
      const validatedRequestContext = await this.#requestContextSchema.safeParseAsync(contextValues);

      if (!validatedRequestContext.success) {
        const errors = validatedRequestContext.error.issues;
        const errorMessages = errors.map((e: any) => `- ${e.path?.join('.')}: ${e.message}`).join('\n');
        throw new MastraError({
          id: 'AGENT_REQUEST_CONTEXT_VALIDATION_FAILED',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          text: `Request context validation failed for agent '${this.id}':\n${errorMessages}`,
          details: {
            agentId: this.id,
            agentName: this.name,
          },
        });
      }
    }
  }

  /**
   * Returns the agents configured for this agent, resolving function-based agents if necessary.
   * Used in multi-agent collaboration scenarios where this agent can delegate to other agents.
   *
   * @example
   * ```typescript
   * const agents = await agent.listAgents();
   * console.log(Object.keys(agents)); // ['agent1', 'agent2']
   * ```
   */
  public listAgents({ requestContext = new RequestContext() }: { requestContext?: RequestContext } = {}) {
    const agentsToUse = this.#agents
      ? typeof this.#agents === 'function'
        ? this.#agents({ requestContext })
        : this.#agents
      : {};

    return resolveMaybePromise(agentsToUse, agents => {
      if (!agents) {
        const mastraError = new MastraError({
          id: 'AGENT_GET_AGENTS_FUNCTION_EMPTY_RETURN',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          details: {
            agentName: this.name,
          },
          text: `[Agent:${this.name}] - Function-based agents returned empty value`,
        });
        this.logger.trackException(mastraError);
        this.logger.error(mastraError.toString());
        throw mastraError;
      }

      Object.entries(agents || {}).forEach(([_agentName, agent]) => {
        if (this.#mastra) {
          agent.__registerMastra(this.#mastra);
        }
      });

      return agents;
    });
  }

  /**
   * Creates and returns a ProcessorRunner with resolved input/output processors.
   * @internal
   */
  private async getProcessorRunner({
    requestContext,
    inputProcessorOverrides,
    outputProcessorOverrides,
    processorStates,
  }: {
    requestContext: RequestContext;
    inputProcessorOverrides?: InputProcessorOrWorkflow[];
    outputProcessorOverrides?: OutputProcessorOrWorkflow[];
    processorStates?: Map<string, ProcessorState>;
  }): Promise<ProcessorRunner> {
    // Resolve processors - overrides replace user-configured but auto-derived (memory, skills) are kept
    const inputProcessors = await this.listResolvedInputProcessors(requestContext, inputProcessorOverrides);
    const outputProcessors = await this.listResolvedOutputProcessors(requestContext, outputProcessorOverrides);

    return new ProcessorRunner({
      inputProcessors,
      outputProcessors,
      logger: this.logger,
      agentName: this.name,
      processorStates,
    });
  }

  /**
   * Combines multiple processors into a single workflow.
   * Each processor becomes a step in the workflow, chained together.
   * If there's only one item and it's already a workflow, returns it as-is.
   * @internal
   */
  private combineProcessorsIntoWorkflow<T extends InputProcessorOrWorkflow | OutputProcessorOrWorkflow>(
    processors: T[],
    workflowId: string,
  ): T[] {
    // No processors - return empty array
    if (processors.length === 0) {
      return [];
    }

    // Single item that's already a workflow - mark it as processor type and return
    if (processors.length === 1 && isProcessorWorkflow(processors[0]!)) {
      const workflow = processors[0]!;
      // Mark the workflow as a processor workflow if not already set
      // Note: This mutates the workflow, but processor workflows are expected to be
      // dedicated to this purpose and not reused as regular workflows
      if (!workflow.type) {
        workflow.type = 'processor';
      }
      return [workflow];
    }

    // Filter out invalid processors (objects that don't implement any processor methods)
    const validProcessors = processors.filter(p => isProcessorWorkflow(p) || isProcessor(p));

    if (validProcessors.length === 0) {
      return [];
    }

    // If after filtering we have a single workflow, mark it as processor type and return
    if (validProcessors.length === 1 && isProcessorWorkflow(validProcessors[0]!)) {
      const workflow = validProcessors[0]!;
      // Mark the workflow as a processor workflow if not already set
      if (!workflow.type) {
        workflow.type = 'processor';
      }
      return [workflow];
    }

    // Create a single workflow with all processors chained
    // Mark it as a processor workflow type
    // validateInputs is disabled because ProcessorStepSchema contains z.custom() fields
    // that may hold user-provided Zod schemas. When users use Zod 4 schemas while Mastra
    // uses Zod 3 internally, validation fails due to incompatible internal structures.
    let workflow = createWorkflow({
      id: workflowId,
      inputSchema: ProcessorStepSchema,
      outputSchema: ProcessorStepSchema,
      type: 'processor',
      options: {
        validateInputs: false,
        tracingPolicy: {
          // mark all workflow spans related to processor execution as internal
          internal: InternalSpans.WORKFLOW,
        },
      },
    });

    for (const [index, processorOrWorkflow] of validProcessors.entries()) {
      // Convert processor to step, or use workflow directly (nested workflows are allowed)
      let step: Step<string, unknown, any, any, any, any>;
      if (isProcessorWorkflow(processorOrWorkflow)) {
        step = processorOrWorkflow;
      } else {
        // Set processorIndex on the processor for span attributes
        const processor = processorOrWorkflow;
        // @ts-expect-error - processorIndex is set at runtime for span attributes
        processor.processorIndex = index;
        // Cast needed because TypeScript can't narrow after isProcessorWorkflow check
        step = createStep(processor as unknown as Parameters<typeof createStep>[0]);
      }
      workflow = workflow.then(step);
    }

    // The resulting workflow is compatible with both Input and Output processor types
    return [workflow.commit() as T];
  }

  /**
   * Resolves and returns output processors from agent configuration.
   * All processors are combined into a single workflow for consistency.
   * @internal
   */
  private async listResolvedOutputProcessors(
    requestContext?: RequestContext,
    configuredProcessorOverrides?: OutputProcessorOrWorkflow[],
  ): Promise<OutputProcessorOrWorkflow[]> {
    // Get configured output processors - use overrides if provided (from generate/stream options),
    // otherwise use agent constructor processors
    const configuredProcessors = configuredProcessorOverrides
      ? configuredProcessorOverrides
      : this.#outputProcessors
        ? typeof this.#outputProcessors === 'function'
          ? await this.#outputProcessors({ requestContext: requestContext || new RequestContext() })
          : this.#outputProcessors
        : [];

    // Get memory output processors (with deduplication)
    // Use getMemory() to ensure storage is injected from Mastra if not explicitly configured
    const memory = await this.getMemory({ requestContext: requestContext || new RequestContext() });

    const memoryProcessors = memory ? await memory.getOutputProcessors(configuredProcessors, requestContext) : [];

    // Combine all processors into a single workflow
    // Memory processors should run last (to persist messages after other processing)
    const allProcessors = [...configuredProcessors, ...memoryProcessors];
    return this.combineProcessorsIntoWorkflow(allProcessors, `${this.id}-output-processor`);
  }

  /**
   * Resolves and returns input processors from agent configuration.
   * All processors are combined into a single workflow for consistency.
   * @internal
   */
  private async listResolvedInputProcessors(
    requestContext?: RequestContext,
    configuredProcessorOverrides?: InputProcessorOrWorkflow[],
  ): Promise<InputProcessorOrWorkflow[]> {
    // Get configured input processors - use overrides if provided (from generate/stream options),
    // otherwise use agent constructor processors
    const configuredProcessors = configuredProcessorOverrides
      ? configuredProcessorOverrides
      : this.#inputProcessors
        ? typeof this.#inputProcessors === 'function'
          ? await this.#inputProcessors({ requestContext: requestContext || new RequestContext() })
          : this.#inputProcessors
        : [];

    // Get memory input processors (with deduplication)
    // Use getMemory() to ensure storage is injected from Mastra if not explicitly configured
    const memory = await this.getMemory({ requestContext: requestContext || new RequestContext() });

    const memoryProcessors = memory ? await memory.getInputProcessors(configuredProcessors, requestContext) : [];

    // Get workspace instructions processors (with deduplication)
    const workspaceProcessors = await this.getWorkspaceInstructionsProcessors(configuredProcessors, requestContext);

    // Get skills processors if skills are configured (with deduplication)
    const skillsProcessors = await this.getSkillsProcessors(configuredProcessors, requestContext);

    // Combine all processors into a single workflow
    // Memory processors should run first (to fetch history, semantic recall, working memory)
    // Workspace instructions run after memory
    // Skills processors run after workspace but before user-configured processors
    const allProcessors = [...memoryProcessors, ...workspaceProcessors, ...skillsProcessors, ...configuredProcessors];
    return this.combineProcessorsIntoWorkflow(allProcessors, `${this.id}-input-processor`);
  }

  /**
   * Returns the input processors for this agent, resolving function-based processors if necessary.
   */
  public async listInputProcessors(requestContext?: RequestContext): Promise<InputProcessorOrWorkflow[]> {
    return this.listResolvedInputProcessors(requestContext);
  }

  /**
   * Returns the output processors for this agent, resolving function-based processors if necessary.
   */
  public async listOutputProcessors(requestContext?: RequestContext): Promise<OutputProcessorOrWorkflow[]> {
    return this.listResolvedOutputProcessors(requestContext);
  }

  /**
   * Resolves a processor by its ID from both input and output processors.
   * This method resolves dynamic processor functions and includes memory-derived processors.
   * Returns the processor if found, null otherwise.
   *
   * @example
   * ```typescript
   * const omProcessor = await agent.resolveProcessorById('observational-memory');
   * if (omProcessor) {
   *   // Observational memory is configured
   * }
   * ```
   */
  public async resolveProcessorById<TId extends string = string>(
    processorId: TId,
    requestContext?: RequestContext,
  ): Promise<Processor<TId> | null> {
    const ctx = requestContext || new RequestContext();

    // Get raw input processors (before combining into workflow)
    const configuredInputProcessors = this.#inputProcessors
      ? typeof this.#inputProcessors === 'function'
        ? await this.#inputProcessors({ requestContext: ctx })
        : this.#inputProcessors
      : [];

    // Get memory input processors
    const memory = await this.getMemory({ requestContext: ctx });
    const memoryInputProcessors = memory ? await memory.getInputProcessors(configuredInputProcessors, ctx) : [];

    // Search all input processors
    for (const p of [...memoryInputProcessors, ...configuredInputProcessors]) {
      if (!isProcessorWorkflow(p) && isProcessor(p) && p.id === processorId) {
        return p as Processor<TId>;
      }
    }

    // Get raw output processors (before combining into workflow)
    const configuredOutputProcessors = this.#outputProcessors
      ? typeof this.#outputProcessors === 'function'
        ? await this.#outputProcessors({ requestContext: ctx })
        : this.#outputProcessors
      : [];

    // Get memory output processors
    const memoryOutputProcessors = memory ? await memory.getOutputProcessors(configuredOutputProcessors, ctx) : [];

    // Search all output processors
    for (const p of [...memoryOutputProcessors, ...configuredOutputProcessors]) {
      if (!isProcessorWorkflow(p) && isProcessor(p) && p.id === processorId) {
        return p as Processor<TId>;
      }
    }

    return null;
  }

  /**
   * Returns only the user-configured input processors, excluding memory-derived processors.
   * Useful for scenarios where memory processors should not be applied (e.g., network routing agents).
   *
   * Unlike `listInputProcessors()` which includes both memory and configured processors,
   * this method returns only what was explicitly configured via the `inputProcessors` option.
   */
  public async listConfiguredInputProcessors(requestContext?: RequestContext): Promise<InputProcessorOrWorkflow[]> {
    if (!this.#inputProcessors) return [];

    const configuredProcessors =
      typeof this.#inputProcessors === 'function'
        ? await this.#inputProcessors({ requestContext: requestContext || new RequestContext() })
        : this.#inputProcessors;

    return this.combineProcessorsIntoWorkflow(configuredProcessors, `${this.id}-configured-input-processor`);
  }

  /**
   * Returns only the user-configured output processors, excluding memory-derived processors.
   * Useful for scenarios where memory processors should not be applied (e.g., network routing agents).
   *
   * Unlike `listOutputProcessors()` which includes both memory and configured processors,
   * this method returns only what was explicitly configured via the `outputProcessors` option.
   */
  public async listConfiguredOutputProcessors(requestContext?: RequestContext): Promise<OutputProcessorOrWorkflow[]> {
    if (!this.#outputProcessors) return [];

    const configuredProcessors =
      typeof this.#outputProcessors === 'function'
        ? await this.#outputProcessors({ requestContext: requestContext || new RequestContext() })
        : this.#outputProcessors;

    return this.combineProcessorsIntoWorkflow(configuredProcessors, `${this.id}-configured-output-processor`);
  }

  /**
   * Returns the IDs of the raw configured input and output processors,
   * without combining them into workflows. Used by the editor to clone
   * agent processor configuration to storage.
   */
  public async getConfiguredProcessorIds(
    requestContext?: RequestContext,
  ): Promise<{ inputProcessorIds: string[]; outputProcessorIds: string[] }> {
    const ctx = requestContext || new RequestContext();

    let inputProcessorIds: string[] = [];
    if (this.#inputProcessors) {
      const processors =
        typeof this.#inputProcessors === 'function'
          ? await this.#inputProcessors({ requestContext: ctx })
          : this.#inputProcessors;
      inputProcessorIds = processors.map(p => p.id).filter(Boolean);
    }

    let outputProcessorIds: string[] = [];
    if (this.#outputProcessors) {
      const processors =
        typeof this.#outputProcessors === 'function'
          ? await this.#outputProcessors({ requestContext: ctx })
          : this.#outputProcessors;
      outputProcessorIds = processors.map(p => p.id).filter(Boolean);
    }

    return { inputProcessorIds, outputProcessorIds };
  }

  /**
   * Returns configured processor workflows for registration with Mastra.
   * This excludes memory-derived processors to avoid triggering memory factory functions.
   * @internal
   */
  public async getConfiguredProcessorWorkflows(): Promise<ProcessorWorkflow[]> {
    const workflows: ProcessorWorkflow[] = [];

    // Get input processors (static or from function)
    if (this.#inputProcessors) {
      const inputProcessors =
        typeof this.#inputProcessors === 'function'
          ? await this.#inputProcessors({ requestContext: new RequestContext() })
          : this.#inputProcessors;

      const combined = this.combineProcessorsIntoWorkflow(inputProcessors, `${this.id}-input-processor`);
      for (const p of combined) {
        if (isProcessorWorkflow(p)) {
          workflows.push(p);
        }
      }
    }

    // Get output processors (static or from function)
    if (this.#outputProcessors) {
      const outputProcessors =
        typeof this.#outputProcessors === 'function'
          ? await this.#outputProcessors({ requestContext: new RequestContext() })
          : this.#outputProcessors;

      const combined = this.combineProcessorsIntoWorkflow(outputProcessors, `${this.id}-output-processor`);
      for (const p of combined) {
        if (isProcessorWorkflow(p)) {
          workflows.push(p);
        }
      }
    }

    return workflows;
  }

  /**
   * Returns whether this agent has its own memory configured.
   *
   * @example
   * ```typescript
   * if (agent.hasOwnMemory()) {
   *   const memory = await agent.getMemory();
   * }
   * ```
   */
  public hasOwnMemory(): boolean {
    return Boolean(this.#memory);
  }

  /**
   * Gets the memory instance for this agent, resolving function-based memory if necessary.
   * The memory system enables conversation persistence, semantic recall, and working memory.
   *
   * @example
   * ```typescript
   * const memory = await agent.getMemory();
   * if (memory) {
   *   // Memory is configured
   * }
   * ```
   */
  public async getMemory({ requestContext = new RequestContext() }: { requestContext?: RequestContext } = {}): Promise<
    MastraMemory | undefined
  > {
    if (!this.#memory) {
      return undefined;
    }

    let resolvedMemory: MastraMemory;

    if (typeof this.#memory !== 'function') {
      resolvedMemory = this.#memory;
    } else {
      const result = this.#memory({ requestContext, mastra: this.#mastra });
      resolvedMemory = await Promise.resolve(result);

      if (!resolvedMemory) {
        const mastraError = new MastraError({
          id: 'AGENT_GET_MEMORY_FUNCTION_EMPTY_RETURN',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          details: {
            agentName: this.name,
          },
          text: `[Agent:${this.name}] - Function-based memory returned empty value`,
        });
        this.logger.trackException(mastraError);
        this.logger.error(mastraError.toString());
        throw mastraError;
      }
    }

    if (this.#mastra && resolvedMemory) {
      resolvedMemory.__registerMastra(this.#mastra);

      if (!resolvedMemory.hasOwnStorage) {
        const storage = this.#mastra.getStorage();
        if (storage) {
          resolvedMemory.setStorage(storage);
        }
      }
    }

    return resolvedMemory;
  }

  /**
   * Checks if this agent has its own workspace configured.
   *
   * @example
   * ```typescript
   * if (agent.hasOwnWorkspace()) {
   *   const workspace = await agent.getWorkspace();
   * }
   * ```
   */
  public hasOwnWorkspace(): boolean {
    return Boolean(this.#workspace);
  }

  /**
   * Gets the workspace instance for this agent, resolving function-based workspace if necessary.
   * The workspace provides filesystem and sandbox capabilities for file operations and code execution.
   *
   * @example
   * ```typescript
   * const workspace = await agent.getWorkspace();
   * if (workspace) {
   *   await workspace.writeFile('/data.json', JSON.stringify(data));
   *   const result = await workspace.executeCode('console.log("Hello")');
   * }
   * ```
   */
  public async getWorkspace({
    requestContext = new RequestContext(),
  }: { requestContext?: RequestContext } = {}): Promise<AnyWorkspace | undefined> {
    // If agent has its own workspace configured, use it
    if (this.#workspace) {
      if (typeof this.#workspace !== 'function') {
        return this.#workspace;
      }

      const result = this.#workspace({ requestContext, mastra: this.#mastra });
      const resolvedWorkspace = await Promise.resolve(result);

      if (!resolvedWorkspace) {
        return undefined;
      }

      // Propagate logger to factory-resolved workspace
      resolvedWorkspace.__setLogger(this.logger);

      // Auto-register dynamically created workspace with Mastra for lookup via listWorkspaces()/getWorkspaceById()
      if (this.#mastra) {
        this.#mastra.addWorkspace(resolvedWorkspace);
      }

      return resolvedWorkspace;
    }

    // Fall back to Mastra's global workspace
    return this.#mastra?.getWorkspace();
  }

  get voice() {
    if (typeof this.#instructions === 'function') {
      const mastraError = new MastraError({
        id: 'AGENT_VOICE_INCOMPATIBLE_WITH_FUNCTION_INSTRUCTIONS',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        details: {
          agentName: this.name,
        },
        text: 'Voice is not compatible when instructions are a function. Please use getVoice() instead.',
      });
      this.logger.trackException(mastraError);
      this.logger.error(mastraError.toString());
      throw mastraError;
    }

    return this.#voice;
  }

  /**
   * Gets the request context schema for this agent.
   * Returns the Zod schema used to validate request context values, or undefined if not set.
   */
  get requestContextSchema() {
    return this.#requestContextSchema;
  }

  /**
   * Gets the workflows configured for this agent, resolving function-based workflows if necessary.
   * Workflows are step-based execution flows that can be triggered by the agent.
   *
   * @example
   * ```typescript
   * const workflows = await agent.listWorkflows();
   * const workflow = workflows['myWorkflow'];
   * ```
   */
  public async listWorkflows({
    requestContext = new RequestContext(),
  }: { requestContext?: RequestContext } = {}): Promise<Record<string, AnyWorkflow>> {
    let workflowRecord;
    if (typeof this.#workflows === 'function') {
      workflowRecord = await Promise.resolve(this.#workflows({ requestContext, mastra: this.#mastra }));
    } else {
      workflowRecord = this.#workflows ?? {};
    }

    Object.entries(workflowRecord || {}).forEach(([_workflowName, workflow]) => {
      if (this.#mastra) {
        workflow.__registerMastra(this.#mastra);
      }
    });

    return workflowRecord;
  }

  async listScorers({
    requestContext = new RequestContext(),
  }: { requestContext?: RequestContext } = {}): Promise<MastraScorers> {
    if (typeof this.#scorers !== 'function') {
      return this.#scorers;
    }

    const result = this.#scorers({ requestContext, mastra: this.#mastra });
    return resolveMaybePromise(result, scorers => {
      if (!scorers) {
        const mastraError = new MastraError({
          id: 'AGENT_GET_SCORERS_FUNCTION_EMPTY_RETURN',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          details: {
            agentName: this.name,
          },
          text: `[Agent:${this.name}] - Function-based scorers returned empty value`,
        });
        this.logger.trackException(mastraError);
        this.logger.error(mastraError.toString());
        throw mastraError;
      }

      return scorers;
    });
  }

  /**
   * Gets the voice instance for this agent with tools and instructions configured.
   * The voice instance enables text-to-speech and speech-to-text capabilities.
   *
   * @example
   * ```typescript
   * const voice = await agent.getVoice();
   * const audioStream = await voice.speak('Hello world');
   * ```
   */
  public async getVoice({ requestContext }: { requestContext?: RequestContext } = {}) {
    if (this.#voice) {
      const voice = this.#voice;
      voice?.addTools(await this.listTools({ requestContext }));
      const instructions = await this.getInstructions({ requestContext });
      voice?.addInstructions(this.#convertInstructionsToString(instructions));
      return voice;
    } else {
      return new DefaultVoice();
    }
  }

  /**
   * Gets the instructions for this agent, resolving function-based instructions if necessary.
   * Instructions define the agent's behavior and capabilities.
   *
   * @example
   * ```typescript
   * const instructions = await agent.getInstructions();
   * console.log(instructions); // 'You are a helpful assistant'
   * ```
   */
  public getInstructions({ requestContext = new RequestContext() }: { requestContext?: RequestContext } = {}):
    | AgentInstructions
    | Promise<AgentInstructions> {
    if (typeof this.#instructions === 'function') {
      const result = this.#instructions({
        requestContext: requestContext as RequestContext<TRequestContext>,
        mastra: this.#mastra,
      });
      return resolveMaybePromise(result, instructions => {
        if (!instructions) {
          const mastraError = new MastraError({
            id: 'AGENT_GET_INSTRUCTIONS_FUNCTION_EMPTY_RETURN',
            domain: ErrorDomain.AGENT,
            category: ErrorCategory.USER,
            details: {
              agentName: this.name,
            },
            text: 'Instructions are required to use an Agent. The function-based instructions returned an empty value.',
          });
          this.logger.trackException(mastraError);
          this.logger.error(mastraError.toString());
          throw mastraError;
        }

        return instructions;
      });
    }

    return this.#instructions;
  }

  /**
   * Helper function to convert agent instructions to string for backward compatibility
   * Used for legacy methods that expect string instructions (e.g., voice)
   * @internal
   */
  #convertInstructionsToString(instructions: AgentInstructions): string {
    if (typeof instructions === 'string') {
      return instructions;
    }

    if (Array.isArray(instructions)) {
      // Handle array of messages (strings or objects)
      return instructions
        .map(msg => {
          if (typeof msg === 'string') {
            return msg;
          }
          // Safely extract content from message objects
          return typeof msg.content === 'string' ? msg.content : '';
        })
        .filter(content => content) // Remove empty strings
        .join('\n\n');
    }

    // Handle single message object - safely extract content
    return typeof instructions.content === 'string' ? instructions.content : '';
  }

  /**
   * Returns the description of the agent.
   *
   * @example
   * ```typescript
   * const description = agent.getDescription();
   * console.log(description); // 'A helpful weather assistant'
   * ```
   */
  public getDescription(): string {
    return this.#description ?? '';
  }

  /**
   * Gets the legacy handler instance, initializing it lazily if needed.
   * @internal
   */
  private getLegacyHandler(): AgentLegacyHandler {
    if (!this.#legacyHandler) {
      this.#legacyHandler = new AgentLegacyHandler({
        logger: this.logger,
        name: this.name,
        id: this.id,
        mastra: this.#mastra,
        getDefaultGenerateOptionsLegacy: this.getDefaultGenerateOptionsLegacy.bind(this),
        getDefaultStreamOptionsLegacy: this.getDefaultStreamOptionsLegacy.bind(this),
        hasOwnMemory: this.hasOwnMemory.bind(this),
        getInstructions: async (options: { requestContext: RequestContext }) => {
          const result = await this.getInstructions(options);
          return result;
        },
        getLLM: this.getLLM.bind(this) as any,
        getMemory: this.getMemory.bind(this),
        convertTools: this.convertTools.bind(this),
        getMemoryMessages: (...args) => this.getMemoryMessages(...args),
        __runInputProcessors: this.__runInputProcessors.bind(this),
        getMostRecentUserMessage: this.getMostRecentUserMessage.bind(this),
        genTitle: this.genTitle.bind(this),
        resolveTitleGenerationConfig: this.resolveTitleGenerationConfig.bind(this),
        saveStepMessages: this.saveStepMessages.bind(this),
        convertInstructionsToString: this.#convertInstructionsToString.bind(this),
        tracingPolicy: this.#options?.tracingPolicy,
        _agentNetworkAppend: this._agentNetworkAppend,
        listResolvedOutputProcessors: this.listResolvedOutputProcessors.bind(this),
        __runOutputProcessors: this.__runOutputProcessors.bind(this),
        runScorers: this.#runScorers.bind(this),
      });
    }
    return this.#legacyHandler;
  }

  /**
   * Gets the default generate options for the legacy generate method.
   * These options are used as defaults when calling `generateLegacy()` without explicit options.
   *
   * @example
   * ```typescript
   * const options = await agent.getDefaultGenerateOptionsLegacy();
   * console.log(options.maxSteps); // 5
   * ```
   */
  public getDefaultGenerateOptionsLegacy({
    requestContext = new RequestContext(),
  }: { requestContext?: RequestContext } = {}): AgentGenerateOptions | Promise<AgentGenerateOptions> {
    if (typeof this.#defaultGenerateOptionsLegacy !== 'function') {
      return this.#defaultGenerateOptionsLegacy;
    }

    const result = this.#defaultGenerateOptionsLegacy({ requestContext, mastra: this.#mastra });
    return resolveMaybePromise(result, options => {
      if (!options) {
        const mastraError = new MastraError({
          id: 'AGENT_GET_DEFAULT_GENERATE_OPTIONS_FUNCTION_EMPTY_RETURN',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          details: {
            agentName: this.name,
          },
          text: `[Agent:${this.name}] - Function-based default generate options returned empty value`,
        });
        this.logger.trackException(mastraError);
        this.logger.error(mastraError.toString());
        throw mastraError;
      }

      return options;
    });
  }

  /**
   * Gets the default stream options for the legacy stream method.
   * These options are used as defaults when calling `streamLegacy()` without explicit options.
   *
   * @example
   * ```typescript
   * const options = await agent.getDefaultStreamOptionsLegacy();
   * console.log(options.temperature); // 0.7
   * ```
   */
  public getDefaultStreamOptionsLegacy({
    requestContext = new RequestContext(),
  }: { requestContext?: RequestContext } = {}): AgentStreamOptions | Promise<AgentStreamOptions> {
    if (typeof this.#defaultStreamOptionsLegacy !== 'function') {
      return this.#defaultStreamOptionsLegacy;
    }

    const result = this.#defaultStreamOptionsLegacy({ requestContext, mastra: this.#mastra });
    return resolveMaybePromise(result, options => {
      if (!options) {
        const mastraError = new MastraError({
          id: 'AGENT_GET_DEFAULT_STREAM_OPTIONS_FUNCTION_EMPTY_RETURN',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          details: {
            agentName: this.name,
          },
          text: `[Agent:${this.name}] - Function-based default stream options returned empty value`,
        });
        this.logger.trackException(mastraError);
        this.logger.error(mastraError.toString());
        throw mastraError;
      }

      return options;
    });
  }

  /**
   * Gets the default options for this agent, resolving function-based options if necessary.
   * These options are used as defaults when calling `stream()` or `generate()` without explicit options.
   *
   * @example
   * ```typescript
   * const options = await agent.getDefaultStreamOptions();
   * console.log(options.maxSteps); // 5
   * ```
   */
  public getDefaultOptions({ requestContext = new RequestContext() }: { requestContext?: RequestContext } = {}):
    | AgentExecutionOptions<TOutput>
    | Promise<AgentExecutionOptions<TOutput>> {
    if (typeof this.#defaultOptions !== 'function') {
      return this.#defaultOptions;
    }

    const result = this.#defaultOptions({ requestContext, mastra: this.#mastra });

    return resolveMaybePromise(result, options => {
      if (!options) {
        const mastraError = new MastraError({
          id: 'AGENT_GET_DEFAULT_OPTIONS_FUNCTION_EMPTY_RETURN',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          details: {
            agentName: this.name,
          },
          text: `[Agent:${this.name}] - Function-based default options returned empty value`,
        });
        this.logger.trackException(mastraError);
        this.logger.error(mastraError.toString());
        throw mastraError;
      }

      return options;
    });
  }

  /**
   * Gets the default NetworkOptions for this agent, resolving function-based options if necessary.
   * These options are used as defaults when calling `network()` without explicit options.
   *
   * @returns NetworkOptions containing maxSteps, completion (CompletionConfig), and other network settings
   *
   * @example
   * ```typescript
   * const options = await agent.getDefaultNetworkOptions();
   * console.log(options.maxSteps); // 20
   * console.log(options.completion?.scorers); // [testsScorer, buildScorer]
   * ```
   */
  public getDefaultNetworkOptions({ requestContext = new RequestContext() }: { requestContext?: RequestContext } = {}):
    | NetworkOptions
    | Promise<NetworkOptions> {
    if (typeof this.#defaultNetworkOptions !== 'function') {
      return this.#defaultNetworkOptions;
    }

    const result = this.#defaultNetworkOptions({ requestContext, mastra: this.#mastra });

    return resolveMaybePromise(result, options => {
      if (!options) {
        const mastraError = new MastraError({
          id: 'AGENT_GET_DEFAULT_NETWORK_OPTIONS_FUNCTION_EMPTY_RETURN',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          details: {
            agentName: this.name,
          },
          text: `[Agent:${this.name}] - Function-based default network options returned empty value`,
        });
        this.logger.trackException(mastraError);
        this.logger.error(mastraError.toString());
        throw mastraError;
      }

      return options;
    });
  }

  /**
   * Gets the tools configured for this agent, resolving function-based tools if necessary.
   * Tools extend the agent's capabilities, allowing it to perform specific actions or access external systems.
   *
   * @example
   * ```typescript
   * const tools = await agent.listTools();
   * console.log(Object.keys(tools)); // ['calculator', 'weather']
   * ```
   */
  public listTools({ requestContext = new RequestContext() }: { requestContext?: RequestContext } = {}):
    | TTools
    | Promise<TTools> {
    if (typeof this.#tools !== 'function') {
      return ensureToolProperties(this.#tools) as TTools;
    }

    const result = this.#tools({
      requestContext: requestContext as RequestContext<TRequestContext>,
      mastra: this.#mastra,
    });

    return resolveMaybePromise(result, tools => {
      if (!tools) {
        const mastraError = new MastraError({
          id: 'AGENT_GET_TOOLS_FUNCTION_EMPTY_RETURN',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          details: {
            agentName: this.name,
          },
          text: `[Agent:${this.name}] - Function-based tools returned empty value`,
        });
        this.logger.trackException(mastraError);
        this.logger.error(mastraError.toString());
        throw mastraError;
      }

      return ensureToolProperties(tools) as TTools;
    });
  }

  /**
   * Gets or creates an LLM instance based on the provided or configured model.
   * The LLM wraps the language model with additional capabilities like error handling.
   *
   * @example
   * ```typescript
   * const llm = await agent.getLLM();
   * // Use with custom model
   * const customLlm = await agent.getLLM({ model: 'openai/gpt-5' });
   * ```
   */
  public getLLM({
    requestContext = new RequestContext(),
    model,
  }: {
    requestContext?: RequestContext;
    model?: DynamicArgument<MastraModelConfig>;
  } = {}): MastraLLM | Promise<MastraLLM> {
    // If model is provided, resolve it; otherwise use the agent's model
    const modelToUse = this.getModel({ modelConfig: model, requestContext });

    return resolveMaybePromise(modelToUse, resolvedModel => {
      let llm: MastraLLM | Promise<MastraLLM>;
      if (isSupportedLanguageModel(resolvedModel)) {
        const modelsPromise =
          Array.isArray(this.model) && !model
            ? this.prepareModels(requestContext)
            : this.prepareModels(requestContext, resolvedModel);

        llm = modelsPromise.then(models => {
          const enabledModels = models.filter(model => model.enabled);
          return new MastraLLMVNext({
            models: enabledModels,
            mastra: this.#mastra,
            options: { tracingPolicy: this.#options?.tracingPolicy },
          });
        });
      } else {
        llm = new MastraLLMV1({
          model: resolvedModel,
          mastra: this.#mastra,
          options: { tracingPolicy: this.#options?.tracingPolicy },
        });
      }

      return resolveMaybePromise(llm, resolvedLLM => {
        // Apply stored primitives if available
        if (this.#primitives) {
          resolvedLLM.__registerPrimitives(this.#primitives);
        }
        if (this.#mastra) {
          resolvedLLM.__registerMastra(this.#mastra);
        }
        return resolvedLLM;
      }) as MastraLLM;
    });
  }

  /**
   * Resolves a model configuration to a LanguageModel instance
   * @param modelConfig The model configuration (magic string, config object, or LanguageModel)
   * @returns A LanguageModel instance
   * @internal
   */
  private async resolveModelConfig(
    modelConfig: DynamicArgument<MastraModelConfig>,
    requestContext: RequestContext,
  ): Promise<MastraLanguageModel | MastraLegacyLanguageModel> {
    try {
      return await resolveModelConfig(modelConfig, requestContext, this.#mastra);
    } catch (error) {
      const mastraError = new MastraError({
        id: 'AGENT_GET_MODEL_MISSING_MODEL_INSTANCE',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        details: {
          agentName: this.name,
          originalError: error instanceof Error ? error.message : String(error),
        },
        text: `[Agent:${this.name}] - Failed to resolve model configuration`,
      });
      this.logger.trackException(mastraError);
      this.logger.error(mastraError.toString());
      throw mastraError;
    }
  }

  /**
   * Gets the model instance, resolving it if it's a function or model configuration.
   * When the agent has multiple models configured, returns the first enabled model.
   *
   * @example
   * ```typescript
   * const model = await agent.getModel();
   * // Get with custom model config
   * const customModel = await agent.getModel({
   *   modelConfig: 'openai/gpt-5'
   * });
   * ```
   */
  public getModel({
    requestContext = new RequestContext(),
    modelConfig = this.model,
  }: { requestContext?: RequestContext; modelConfig?: Agent['model'] } = {}):
    | MastraLanguageModel
    | MastraLegacyLanguageModel
    | Promise<MastraLanguageModel | MastraLegacyLanguageModel> {
    if (!Array.isArray(modelConfig)) return this.resolveModelConfig(modelConfig, requestContext);

    if (modelConfig.length === 0 || !modelConfig[0]) {
      const mastraError = new MastraError({
        id: 'AGENT_GET_MODEL_MISSING_MODEL_INSTANCE',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        details: {
          agentName: this.name,
        },
        text: `[Agent:${this.name}] - Empty model list provided`,
      });
      this.logger.trackException(mastraError);
      this.logger.error(mastraError.toString());
      throw mastraError;
    }
    return this.resolveModelConfig(modelConfig[0].model, requestContext);
  }

  /**
   * Gets the list of configured models if the agent has multiple models, otherwise returns null.
   * Used for model fallback and load balancing scenarios.
   *
   * @example
   * ```typescript
   * const models = await agent.getModelList();
   * if (models) {
   *   console.log(models.map(m => m.id));
   * }
   * ```
   */
  public async getModelList(
    requestContext: RequestContext = new RequestContext(),
  ): Promise<Array<AgentModelManagerConfig> | null> {
    if (!Array.isArray(this.model)) {
      return null;
    }
    return this.prepareModels(requestContext);
  }

  /**
   * Updates the agent's instructions.
   * @internal
   */
  __updateInstructions(newInstructions: string) {
    this.#instructions = newInstructions;
    this.logger.debug(`[Agents:${this.name}] Instructions updated.`, { model: this.model, name: this.name });
  }

  /**
   * Updates the agent's model configuration.
   * @internal
   */
  __updateModel({ model }: { model: DynamicArgument<MastraModelConfig> }) {
    this.model = model;
    this.logger.debug(`[Agents:${this.name}] Model updated.`, { model: this.model, name: this.name });
  }

  /**
   * Resets the agent's model to the original model set during construction.
   * Clones arrays to prevent reordering mutations from affecting the original snapshot.
   * @internal
   */
  __resetToOriginalModel() {
    this.model = Array.isArray(this.#originalModel) ? [...this.#originalModel] : this.#originalModel;
    this.logger.debug(`[Agents:${this.name}] Model reset to original.`, { model: this.model, name: this.name });
  }

  reorderModels(modelIds: string[]) {
    if (!Array.isArray(this.model)) {
      this.logger.warn(`[Agents:${this.name}] model is not an array`);
      return;
    }

    this.model = this.model.sort((a, b) => {
      const aIndex = modelIds.indexOf(a.id);
      const bIndex = modelIds.indexOf(b.id);
      const aPos = aIndex === -1 ? Infinity : aIndex;
      const bPos = bIndex === -1 ? Infinity : bIndex;
      return aPos - bPos;
    });
    this.logger.debug(`[Agents:${this.name}] Models reordered`);
  }

  updateModelInModelList({
    id,
    model,
    enabled,
    maxRetries,
  }: {
    id: string;
    model?: DynamicArgument<MastraModelConfig>;
    enabled?: boolean;
    maxRetries?: number;
  }) {
    if (!Array.isArray(this.model)) {
      this.logger.warn(`[Agents:${this.name}] model is not an array`);
      return;
    }

    const modelToUpdate = this.model.find(m => m.id === id);
    if (!modelToUpdate) {
      this.logger.warn(`[Agents:${this.name}] model ${id} not found`);
      return;
    }

    this.model = this.model.map(mdl => {
      if (mdl.id === id) {
        return {
          ...mdl,
          model: model ?? mdl.model,
          enabled: enabled ?? mdl.enabled,
          maxRetries: maxRetries ?? mdl.maxRetries,
        };
      }
      return mdl;
    });
    this.logger.debug(`[Agents:${this.name}] model ${id} updated`);
  }

  #primitives?: MastraPrimitives;

  /**
   * Registers  logger primitives with the agent.
   * @internal
   */
  __registerPrimitives(p: MastraPrimitives) {
    if (p.logger) {
      this.__setLogger(p.logger);
    }

    // Store primitives for later use when creating LLM instances
    this.#primitives = p;

    this.logger.debug(`[Agents:${this.name}] initialized.`, { model: this.model, name: this.name });
  }

  /**
   * Registers the Mastra instance with the agent.
   * @internal
   */
  __registerMastra(mastra: Mastra) {
    this.#mastra = mastra;

    // Propagate logger to workspace if it's a direct instance (not a factory function)
    if (this.#workspace && typeof this.#workspace !== 'function') {
      this.#workspace.__setLogger(this.logger);
    }
    // Mastra will be passed to the LLM when it's created in getLLM()

    // Auto-register tools with the Mastra instance
    if (this.#tools && typeof this.#tools === 'object') {
      Object.entries(this.#tools).forEach(([key, tool]) => {
        try {
          // Only add tools that have an id property (ToolAction type)
          if (tool && typeof tool === 'object' && 'id' in tool) {
            // Use tool's intrinsic ID to avoid collisions across agents
            const toolKey = typeof (tool as any).id === 'string' ? (tool as any).id : key;
            mastra.addTool(tool as any, toolKey);
          }
        } catch (error) {
          // Tool might already be registered, that's okay
          if (error instanceof MastraError && error.id !== 'MASTRA_ADD_TOOL_DUPLICATE_KEY') {
            throw error;
          }
        }
      });
    }

    // Auto-register input processors with the Mastra instance
    if (this.#inputProcessors && Array.isArray(this.#inputProcessors)) {
      this.#inputProcessors.forEach(processor => {
        try {
          mastra.addProcessor(processor);
        } catch (error) {
          // Processor might already be registered, that's okay
          if (error instanceof MastraError && error.id !== 'MASTRA_ADD_PROCESSOR_DUPLICATE_KEY') {
            throw error;
          }
        }
        // Always register the configuration with agent context
        mastra.addProcessorConfiguration(processor, this.id, 'input');
      });
    }

    // Auto-register output processors with the Mastra instance
    if (this.#outputProcessors && Array.isArray(this.#outputProcessors)) {
      this.#outputProcessors.forEach(processor => {
        try {
          mastra.addProcessor(processor);
        } catch (error) {
          // Processor might already be registered, that's okay
          if (error instanceof MastraError && error.id !== 'MASTRA_ADD_PROCESSOR_DUPLICATE_KEY') {
            throw error;
          }
        }
        // Always register the configuration with agent context
        mastra.addProcessorConfiguration(processor, this.id, 'output');
      });
    }
  }

  /**
   * Set the concrete tools for the agent
   * @param tools
   * @internal
   */
  __setTools(tools: TTools) {
    this.#tools = tools;
    this.logger.debug(`[Agents:${this.name}] Tools set for agent ${this.name}`, { model: this.model, name: this.name });
  }

  async generateTitleFromUserMessage({
    message,
    requestContext = new RequestContext(),
    tracingContext,
    model,
    instructions,
  }: {
    message: string | MessageInput;
    requestContext?: RequestContext;
    tracingContext: TracingContext;
    model?: DynamicArgument<MastraModelConfig>;
    instructions?: DynamicArgument<string>;
  }) {
    // need to use text, not object output or it will error for models that don't support structured output (eg Deepseek R1)
    const llm = await this.getLLM({ requestContext, model });

    const normMessage = new MessageList().add(message, 'user').get.all.ui().at(-1);
    if (!normMessage) {
      throw new Error(`Could not generate title from input ${JSON.stringify(message)}`);
    }

    const partsToGen: TextPart[] = [];
    for (const part of normMessage.parts) {
      if (part.type === `text`) {
        partsToGen.push(part);
      } else if (part.type === `source`) {
        partsToGen.push({
          type: 'text',
          text: `User added URL: ${part.source.url.substring(0, 100)}`,
        });
      } else if (part.type === `file`) {
        partsToGen.push({
          type: 'text',
          text: `User added ${part.mimeType} file: ${part.data.substring(0, 100)}`,
        });
      }
    }

    // Resolve instructions using the dedicated method
    const systemInstructions = await this.resolveTitleInstructions(requestContext, instructions);

    let text = '';

    if (isSupportedLanguageModel(llm.getModel())) {
      const messageList = new MessageList()
        .add(
          [
            {
              role: 'system',
              content: systemInstructions,
            },
          ],
          'system',
        )
        .add(
          [
            {
              role: 'user',
              content: JSON.stringify(partsToGen),
            },
          ],
          'input',
        );
      const result = (llm as MastraLLMVNext).stream({
        methodType: 'generate',
        requestContext,
        tracingContext,
        messageList,
        agentId: this.id,
        agentName: this.name,
      });

      text = await result.text;
    } else {
      const result = await (llm as MastraLLMV1).__text({
        requestContext,
        tracingContext,
        messages: [
          {
            role: 'system',
            content: systemInstructions,
          },
          {
            role: 'user',
            content: JSON.stringify(partsToGen),
          },
        ],
      });

      text = result.text;
    }

    // Strip out any r1 think tags if present
    const cleanedText = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    return cleanedText;
  }

  getMostRecentUserMessage(messages: Array<UIMessage | UIMessageWithMetadata>) {
    const userMessages = messages.filter(message => message.role === 'user');
    return userMessages.at(-1);
  }

  async genTitle(
    userMessage: string | MessageInput | undefined,
    requestContext: RequestContext,
    tracingContext: TracingContext,
    model?: DynamicArgument<MastraModelConfig>,
    instructions?: DynamicArgument<string>,
  ) {
    try {
      if (userMessage) {
        const normMessage = new MessageList().add(userMessage, 'user').get.all.ui().at(-1);
        if (normMessage) {
          return await this.generateTitleFromUserMessage({
            message: normMessage,
            requestContext,
            tracingContext,
            model,
            instructions,
          });
        }
      }
      // If no user message, return undefined so existing title is preserved
      return undefined;
    } catch (e) {
      this.logger.error('Error generating title:', e);
      // Return undefined on error so existing title is preserved
      return undefined;
    }
  }

  public __setMemory(memory: DynamicArgument<MastraMemory>) {
    this.#memory = memory;
  }

  public __setWorkspace(workspace: DynamicArgument<AnyWorkspace | undefined>) {
    this.#workspace = workspace;
    if (this.#mastra && workspace && typeof workspace !== 'function') {
      workspace.__setLogger(this.logger);
      this.#mastra.addWorkspace(workspace);
    }
  }

  /**
   * Retrieves and converts memory tools to CoreTool format.
   * @internal
   */
  private async listMemoryTools({
    runId,
    resourceId,
    threadId,
    requestContext,
    tracingContext,
    mastraProxy,
    memoryConfig,
    autoResumeSuspendedTools,
  }: {
    runId?: string;
    resourceId?: string;
    threadId?: string;
    requestContext: RequestContext;
    tracingContext?: TracingContext;
    mastraProxy?: MastraUnion;
    memoryConfig?: MemoryConfig;
    autoResumeSuspendedTools?: boolean;
  }) {
    let convertedMemoryTools: Record<string, CoreTool> = {};

    if (this._agentNetworkAppend) {
      this.logger.debug(`[Agent:${this.name}] - Skipping memory tools (agent network context)`, { runId });
      return convertedMemoryTools;
    }

    // Get memory tools if available
    const memory = await this.getMemory({ requestContext });

    // Skip memory tools if there's no usable context — thread-scoped needs threadId, resource-scoped needs resourceId
    if (!threadId && !resourceId) {
      this.logger.debug(`[Agent:${this.name}] - Skipping memory tools (no thread or resource context)`, { runId });
      return convertedMemoryTools;
    }

    const memoryTools = memory?.listTools?.(memoryConfig);

    if (memoryTools) {
      this.logger.debug(
        `[Agent:${this.name}] - Adding tools from memory ${Object.keys(memoryTools || {}).join(', ')}`,
        {
          runId,
        },
      );
      for (const [toolName, tool] of Object.entries(memoryTools)) {
        const toolObj = tool;
        const options: ToolOptions = {
          name: toolName,
          runId,
          threadId,
          resourceId,
          logger: this.logger,
          mastra: mastraProxy as MastraUnion | undefined,
          memory,
          agentName: this.name,
          requestContext,
          tracingContext,
          model: await this.getModel({ requestContext }),
          tracingPolicy: this.#options?.tracingPolicy,
          requireApproval: (toolObj as any).requireApproval,
        };
        const convertedToCoreTool = makeCoreTool(toolObj, options, undefined, autoResumeSuspendedTools);
        convertedMemoryTools[toolName] = convertedToCoreTool;
      }
    }

    return convertedMemoryTools;
  }

  /**
   * Lists workspace tools if a workspace is configured.
   * @internal
   */
  private async listWorkspaceTools({
    runId,
    resourceId,
    threadId,
    requestContext,
    tracingContext,
    mastraProxy,
    autoResumeSuspendedTools,
  }: {
    runId?: string;
    resourceId?: string;
    threadId?: string;
    requestContext: RequestContext;
    tracingContext?: TracingContext;
    mastraProxy?: MastraUnion;
    autoResumeSuspendedTools?: boolean;
  }) {
    let convertedWorkspaceTools: Record<string, CoreTool> = {};

    if (this._agentNetworkAppend) {
      this.logger.debug(`[Agent:${this.name}] - Skipping workspace tools (agent network context)`, { runId });
      return convertedWorkspaceTools;
    }

    // Get workspace tools if available
    const workspace = await this.getWorkspace({ requestContext });

    if (!workspace) {
      return convertedWorkspaceTools;
    }

    const workspaceTools = createWorkspaceTools(workspace);

    if (Object.keys(workspaceTools).length > 0) {
      this.logger.debug(`[Agent:${this.name}] - Adding workspace tools: ${Object.keys(workspaceTools).join(', ')}`, {
        runId,
      });

      for (const [toolName, tool] of Object.entries(workspaceTools)) {
        const toolObj = tool;
        const options: ToolOptions = {
          name: toolName,
          runId,
          threadId,
          resourceId,
          logger: this.logger,
          mastra: mastraProxy as MastraUnion | undefined,
          agentName: this.name,
          requestContext,
          tracingContext,
          model: await this.getModel({ requestContext }),
          tracingPolicy: this.#options?.tracingPolicy,
          requireApproval: (toolObj as any).requireApproval,
        };
        const convertedToCoreTool = makeCoreTool(toolObj, options, undefined, autoResumeSuspendedTools);
        convertedWorkspaceTools[toolName] = convertedToCoreTool;
      }
    }

    return convertedWorkspaceTools;
  }

  /**
   * Executes input processors on the message list before LLM processing.
   * @internal
   */
  private async __runInputProcessors({
    requestContext,
    tracingContext,
    messageList,
    inputProcessorOverrides,
    processorStates,
  }: {
    requestContext: RequestContext;
    tracingContext: TracingContext;
    messageList: MessageList;
    inputProcessorOverrides?: InputProcessorOrWorkflow[];
    processorStates?: Map<string, ProcessorState>;
  }): Promise<{
    messageList: MessageList;
    tripwire?: {
      reason: string;
      retry?: boolean;
      metadata?: unknown;
      processorId?: string;
    };
  }> {
    let tripwire: { reason: string; retry?: boolean; metadata?: unknown; processorId?: string } | undefined;

    if (
      inputProcessorOverrides?.length ||
      this.#inputProcessors ||
      this.#memory ||
      this.#workspace ||
      this.#mastra?.getWorkspace()
    ) {
      const runner = await this.getProcessorRunner({
        requestContext,
        inputProcessorOverrides,
        processorStates,
      });
      try {
        messageList = await runner.runInputProcessors(messageList, tracingContext, requestContext);
      } catch (error) {
        if (error instanceof TripWire) {
          tripwire = {
            reason: error.message,
            retry: error.options?.retry,
            metadata: error.options?.metadata,
            processorId: error.processorId,
          };
        } else {
          throw new MastraError(
            {
              id: 'AGENT_INPUT_PROCESSOR_ERROR',
              domain: ErrorDomain.AGENT,
              category: ErrorCategory.USER,
              text: `[Agent:${this.name}] - Input processor error`,
            },
            error,
          );
        }
      }
    }

    return {
      messageList,
      tripwire,
    };
  }

  /**
   * Executes output processors on the message list after LLM processing.
   * @internal
   */
  private async __runOutputProcessors({
    requestContext,
    tracingContext,
    messageList,
    outputProcessorOverrides,
  }: {
    requestContext: RequestContext;
    tracingContext: TracingContext;
    messageList: MessageList;
    outputProcessorOverrides?: OutputProcessorOrWorkflow[];
  }): Promise<{
    messageList: MessageList;
    tripwire?: {
      reason: string;
      retry?: boolean;
      metadata?: unknown;
      processorId?: string;
    };
  }> {
    let tripwire: { reason: string; retry?: boolean; metadata?: unknown; processorId?: string } | undefined;

    if (outputProcessorOverrides?.length || this.#outputProcessors || this.#memory) {
      const runner = await this.getProcessorRunner({
        requestContext,
        outputProcessorOverrides,
      });

      try {
        messageList = await runner.runOutputProcessors(messageList, tracingContext, requestContext);
      } catch (e) {
        if (e instanceof TripWire) {
          tripwire = {
            reason: e.message,
            retry: e.options?.retry,
            metadata: e.options?.metadata,
            processorId: e.processorId,
          };
          this.logger.debug(`[Agent:${this.name}] - Output processor tripwire triggered: ${e.message}`);
        } else {
          throw e;
        }
      }
    }

    return {
      messageList,
      tripwire,
    };
  }

  /**
   * Fetches remembered messages from memory for the current thread.
   * @internal
   */
  private async getMemoryMessages({
    resourceId,
    threadId,
    vectorMessageSearch,
    memoryConfig,
    requestContext,
  }: {
    resourceId?: string;
    threadId: string;
    vectorMessageSearch: string;
    memoryConfig?: MemoryConfig;
    requestContext: RequestContext;
  }): Promise<{ messages: MastraDBMessage[] }> {
    const memory = await this.getMemory({ requestContext });
    if (!memory) {
      return { messages: [] };
    }

    const threadConfig = memory.getMergedThreadConfig(memoryConfig || {});
    if (!threadConfig.lastMessages && !threadConfig.semanticRecall) {
      return { messages: [] };
    }

    return memory.recall({
      threadId,
      resourceId,
      perPage: threadConfig.lastMessages,
      threadConfig: memoryConfig,
      // The new user messages aren't in the list yet cause we add memory messages first to try to make sure ordering is correct (memory comes before new user messages)
      vectorSearchString: threadConfig.semanticRecall && vectorMessageSearch ? vectorMessageSearch : undefined,
    });
  }

  /**
   * Retrieves and converts assigned tools to CoreTool format.
   * @internal
   */
  private async listAssignedTools({
    runId,
    resourceId,
    threadId,
    requestContext,
    tracingContext,
    mastraProxy,
    outputWriter,
    autoResumeSuspendedTools,
  }: {
    runId?: string;
    resourceId?: string;
    threadId?: string;
    requestContext: RequestContext;
    tracingContext?: TracingContext;
    mastraProxy?: MastraUnion;
    outputWriter?: OutputWriter;
    autoResumeSuspendedTools?: boolean;
  }) {
    let toolsForRequest: Record<string, CoreTool> = {};

    this.logger.debug(`[Agents:${this.name}] - Assembling assigned tools`, { runId, threadId, resourceId });

    const memory = await this.getMemory({ requestContext });

    // Mastra tools passed into the Agent
    const assignedTools = await this.listTools({ requestContext });

    const assignedToolEntries = Object.entries(assignedTools || {});

    const assignedCoreToolEntries = await Promise.all(
      assignedToolEntries.map(async ([k, tool]) => {
        if (!tool) {
          return;
        }

        const options: ToolOptions = {
          name: k,
          runId,
          threadId,
          resourceId,
          logger: this.logger,
          mastra: mastraProxy as MastraUnion | undefined,
          memory,
          agentName: this.name,
          requestContext,
          tracingContext,
          model: await this.getModel({ requestContext }),
          outputWriter,
          tracingPolicy: this.#options?.tracingPolicy,
          requireApproval: (tool as any).requireApproval,
        };
        return [k, makeCoreTool(tool, options, undefined, autoResumeSuspendedTools)];
      }),
    );

    const assignedToolEntriesConverted = Object.fromEntries(
      assignedCoreToolEntries.filter((entry): entry is [string, CoreTool] => Boolean(entry)),
    );

    toolsForRequest = {
      ...assignedToolEntriesConverted,
    };

    return toolsForRequest;
  }

  /**
   * Retrieves and converts toolset tools to CoreTool format.
   * @internal
   */
  private async listToolsets({
    runId,
    threadId,
    resourceId,
    toolsets,
    requestContext,
    tracingContext,
    mastraProxy,
    autoResumeSuspendedTools,
  }: {
    runId?: string;
    threadId?: string;
    resourceId?: string;
    toolsets: ToolsetsInput;
    requestContext: RequestContext;
    tracingContext?: TracingContext;
    mastraProxy?: MastraUnion;
    autoResumeSuspendedTools?: boolean;
  }) {
    let toolsForRequest: Record<string, CoreTool> = {};

    const memory = await this.getMemory({ requestContext });
    const toolsFromToolsets = Object.values(toolsets || {});

    if (toolsFromToolsets.length > 0) {
      this.logger.debug(`[Agent:${this.name}] - Adding tools from toolsets ${Object.keys(toolsets || {}).join(', ')}`, {
        runId,
      });
      for (const toolset of toolsFromToolsets) {
        for (const [toolName, tool] of Object.entries(toolset)) {
          const toolObj = tool;
          const options: ToolOptions = {
            name: toolName,
            runId,
            threadId,
            resourceId,
            logger: this.logger,
            mastra: mastraProxy as MastraUnion | undefined,
            memory,
            agentName: this.name,
            requestContext,
            tracingContext,
            model: await this.getModel({ requestContext }),
            tracingPolicy: this.#options?.tracingPolicy,
            requireApproval: (toolObj as any).requireApproval,
          };
          const convertedToCoreTool = makeCoreTool(toolObj, options, 'toolset', autoResumeSuspendedTools);
          toolsForRequest[toolName] = convertedToCoreTool;
        }
      }
    }

    return toolsForRequest;
  }

  /**
   * Retrieves and converts client-side tools to CoreTool format.
   * @internal
   */
  private async listClientTools({
    runId,
    threadId,
    resourceId,
    requestContext,
    tracingContext,
    mastraProxy,
    clientTools,
    autoResumeSuspendedTools,
  }: {
    runId?: string;
    threadId?: string;
    resourceId?: string;
    requestContext: RequestContext;
    tracingContext?: TracingContext;
    mastraProxy?: MastraUnion;
    clientTools?: ToolsInput;
    autoResumeSuspendedTools?: boolean;
  }) {
    let toolsForRequest: Record<string, CoreTool> = {};
    const memory = await this.getMemory({ requestContext });
    // Convert client tools
    const clientToolsForInput = Object.entries(clientTools || {});
    if (clientToolsForInput.length > 0) {
      this.logger.debug(`[Agent:${this.name}] - Adding client tools ${Object.keys(clientTools || {}).join(', ')}`, {
        runId,
      });
      for (const [toolName, tool] of clientToolsForInput) {
        const { execute, ...rest } = tool;
        const options: ToolOptions = {
          name: toolName,
          runId,
          threadId,
          resourceId,
          logger: this.logger,
          mastra: mastraProxy as MastraUnion | undefined,
          memory,
          agentName: this.name,
          requestContext,
          tracingContext,
          model: await this.getModel({ requestContext }),
          tracingPolicy: this.#options?.tracingPolicy,
          requireApproval: (tool as any).requireApproval,
        };
        const convertedToCoreTool = makeCoreTool(rest, options, 'client-tool', autoResumeSuspendedTools);
        toolsForRequest[toolName] = convertedToCoreTool;
      }
    }

    return toolsForRequest;
  }

  /**
   * Retrieves and converts agent tools to CoreTool format.
   * @internal
   */
  private async listAgentTools({
    runId,
    threadId,
    resourceId,
    requestContext,
    tracingContext,
    methodType,
    autoResumeSuspendedTools,
  }: {
    runId?: string;
    threadId?: string;
    resourceId?: string;
    requestContext: RequestContext;
    tracingContext?: TracingContext;
    methodType: AgentMethodType;
    autoResumeSuspendedTools?: boolean;
  }) {
    const convertedAgentTools: Record<string, CoreTool> = {};
    const agents = await this.listAgents({ requestContext });

    if (Object.keys(agents).length > 0) {
      for (const [agentName, agent] of Object.entries(agents)) {
        const agentInputSchema = z.object({
          prompt: z.string().describe('The prompt to send to the agent'),
          // Using .nullish() instead of .optional() because OpenAI sends null for unfilled optional fields
          threadId: z.string().nullish().describe('Thread ID for conversation continuity for memory messages'),
          resourceId: z.string().nullish().describe('Resource/user identifier for memory messages'),
          instructions: z.string().nullish().describe('Custom instructions to override agent defaults'),
          maxSteps: z.number().min(3).nullish().describe('Maximum number of execution steps for the sub-agent'),
          // using minimum of 3 to ensure if the agent has a tool call, the llm gets executed again after the tool call step, using the tool call result
          // to return a proper llm response
        });

        const agentOutputSchema = z.object({
          text: z.string().describe('The response from the agent'),
          subAgentThreadId: z.string().describe('The thread ID of the agent').optional(),
          subAgentResourceId: z.string().describe('The resource ID of the agent').optional(),
        });

        const modelVersion = (await agent.getModel({ requestContext })).specificationVersion;

        const toolObj = createTool({
          id: `agent-${agentName}`,
          description: agent.getDescription() || `Agent: ${agentName}`,
          inputSchema: agentInputSchema,
          outputSchema: agentOutputSchema,
          mastra: this.#mastra,
          // manually wrap agent tools with tracing, so that we can pass the
          // current tool span onto the agent to maintain continuity of the trace
          execute: async (inputData: z.infer<typeof agentInputSchema>, context) => {
            // Save the parent agent's MastraMemory before the sub-agent runs.
            // The sub-agent's prepare-memory-step will overwrite this key with
            // its own thread/resource identity. We restore it after the sub-agent
            // returns so the parent's processors (OM, working memory, etc.) still
            // see the correct context on subsequent steps.
            const savedMastraMemory = requestContext.get('MastraMemory');
            try {
              this.logger.debug(`[Agent:${this.name}] - Executing agent as tool ${agentName}`, {
                name: agentName,
                args: inputData,
                runId,
                threadId,
                resourceId,
              });

              let result: any;
              const slugify = await import(`@sindresorhus/slugify`);
              const subAgentThreadId =
                inputData.threadId ||
                context?.mastra?.generateId({
                  idType: 'thread',
                  source: 'agent',
                  entityId: agentName,
                  resourceId,
                }) ||
                randomUUID();
              const subAgentResourceId =
                inputData.resourceId ||
                context?.mastra?.generateId({
                  idType: 'generic',
                  source: 'agent',
                  entityId: agentName,
                }) ||
                `${slugify.default(this.id)}-${agentName}`;

              const suspendedToolRunId = (inputData as any).suspendedToolRunId;

              const { resumeData, suspend } = context?.agent ?? {};

              if (
                (methodType === 'generate' || methodType === 'generateLegacy') &&
                supportedLanguageModelSpecifications.includes(modelVersion)
              ) {
                if (!agent.hasOwnMemory() && this.#memory) {
                  agent.__setMemory(this.#memory);
                }

                const generateResult = resumeData
                  ? await agent.resumeGenerate(resumeData, {
                      runId: suspendedToolRunId,
                      requestContext,
                      tracingContext: context?.tracingContext,
                      ...(inputData.instructions && { instructions: inputData.instructions }),
                      ...(inputData.maxSteps && { maxSteps: inputData.maxSteps }),
                      ...(resourceId && threadId
                        ? { memory: { resource: subAgentResourceId, thread: subAgentThreadId } }
                        : {}),
                    })
                  : await agent.generate(inputData.prompt, {
                      requestContext,
                      tracingContext: context?.tracingContext,
                      ...(inputData.instructions && { instructions: inputData.instructions }),
                      ...(inputData.maxSteps && { maxSteps: inputData.maxSteps }),
                      ...(resourceId && threadId
                        ? {
                            memory: {
                              resource: subAgentResourceId,
                              thread: subAgentThreadId,
                            },
                          }
                        : {}),
                    });

                if (generateResult.finishReason === 'suspended') {
                  return suspend?.(generateResult.suspendPayload, {
                    resumeSchema: generateResult.resumeSchema,
                    runId: generateResult.runId,
                    isAgentSuspend: true,
                  });
                }

                result = { text: generateResult.text, subAgentThreadId, subAgentResourceId };
              } else if (methodType === 'generate' && modelVersion === 'v1') {
                const generateResult = await agent.generateLegacy(inputData.prompt, {
                  requestContext,
                  tracingContext: context?.tracingContext,
                });
                result = { text: generateResult.text };
              } else if (
                (methodType === 'stream' || methodType === 'streamLegacy') &&
                supportedLanguageModelSpecifications.includes(modelVersion)
              ) {
                if (!agent.hasOwnMemory() && this.#memory) {
                  agent.__setMemory(this.#memory);
                }

                const streamResult = resumeData
                  ? await agent.resumeStream(resumeData, {
                      runId: suspendedToolRunId,
                      requestContext,
                      tracingContext: context?.tracingContext,
                      ...(inputData.instructions && { instructions: inputData.instructions }),
                      ...(inputData.maxSteps && { maxSteps: inputData.maxSteps }),
                      ...(resourceId && threadId
                        ? {
                            memory: {
                              resource: subAgentResourceId,
                              thread: subAgentThreadId,
                            },
                          }
                        : {}),
                    })
                  : await agent.stream(inputData.prompt, {
                      requestContext,
                      tracingContext: context?.tracingContext,
                      ...(inputData.instructions && { instructions: inputData.instructions }),
                      ...(inputData.maxSteps && { maxSteps: inputData.maxSteps }),
                      ...(resourceId && threadId
                        ? {
                            memory: {
                              resource: subAgentResourceId,
                              thread: subAgentThreadId,
                            },
                          }
                        : {}),
                    });

                let fullText = '';
                for await (const chunk of streamResult.fullStream) {
                  if (context?.writer) {
                    // Data chunks from writer.custom() should bubble up directly without wrapping
                    if (chunk.type.startsWith('data-')) {
                      // Write data chunks directly to original stream to bubble up
                      await context.writer.custom(chunk as any);
                      if (chunk.type === 'data-tool-call-approval') {
                        return suspend?.(
                          {},
                          { requireToolApproval: true, runId: streamResult.runId, isAgentSuspend: true },
                        );
                      }

                      if (chunk.type === 'data-tool-call-suspended') {
                        return suspend?.(chunk.data.suspendPayload, {
                          resumeSchema: chunk.data.resumeSchema,
                          runId: streamResult.runId,
                          isAgentSuspend: true,
                        });
                      }
                    } else {
                      await context.writer.write(chunk);
                      if (chunk.type === 'tool-call-approval') {
                        return suspend?.(
                          {},
                          { requireToolApproval: true, runId: streamResult.runId, isAgentSuspend: true },
                        );
                      }

                      if (chunk.type === 'tool-call-suspended') {
                        return suspend?.(chunk.payload.suspendPayload, {
                          resumeSchema: chunk.payload.resumeSchema,
                          runId: streamResult.runId,
                          isAgentSuspend: true,
                        });
                      }
                    }
                  }

                  if (chunk.type === 'text-delta') {
                    fullText += chunk.payload.text;
                  }
                }

                result = { text: fullText, subAgentThreadId, subAgentResourceId };
              } else {
                const streamResult = await agent.streamLegacy(inputData.prompt, {
                  requestContext,
                  tracingContext: context?.tracingContext,
                });

                let fullText = '';
                for await (const chunk of streamResult.fullStream) {
                  if (context?.writer) {
                    // Data chunks from writer.custom() should bubble up directly without wrapping
                    if (chunk.type.startsWith('data-')) {
                      // Write data chunks directly to original stream to bubble up
                      await context.writer.custom(chunk as any);
                    } else {
                      await context.writer.write(chunk);
                    }
                  }

                  if (chunk.type === 'text-delta') {
                    fullText += chunk.textDelta;
                  }
                }

                result = { text: fullText };
              }

              // Restore the parent agent's MastraMemory after sub-agent execution
              if (savedMastraMemory !== undefined) {
                requestContext.set('MastraMemory', savedMastraMemory);
              }

              return result;
            } catch (err) {
              // Restore even on error so the parent's retry/fallback logic
              // sees the correct memory context
              if (savedMastraMemory !== undefined) {
                requestContext.set('MastraMemory', savedMastraMemory);
              }

              const mastraError = new MastraError(
                {
                  id: 'AGENT_AGENT_TOOL_EXECUTION_FAILED',
                  domain: ErrorDomain.AGENT,
                  category: ErrorCategory.USER,
                  details: {
                    agentName: this.name,
                    subAgentName: agentName,
                    runId: runId || '',
                    threadId: threadId || '',
                    resourceId: resourceId || '',
                  },
                  text: `[Agent:${this.name}] - Failed agent tool execution for ${agentName}`,
                },
                err,
              );
              this.logger.trackException(mastraError);
              this.logger.error(mastraError.toString());
              throw mastraError;
            }
          },
        });

        const options: ToolOptions = {
          name: `agent-${agentName}`,
          runId,
          threadId,
          resourceId,
          logger: this.logger,
          mastra: this.#mastra,
          memory: await this.getMemory({ requestContext }),
          agentName: this.name,
          requestContext,
          model: await this.getModel({ requestContext }),
          tracingContext,
          tracingPolicy: this.#options?.tracingPolicy,
        };

        // TODO; fix recursion type
        convertedAgentTools[`agent-${agentName}`] = makeCoreTool(
          toolObj as any,
          options,
          undefined,
          autoResumeSuspendedTools,
        );
      }
    }

    return convertedAgentTools;
  }

  /**
   * Retrieves and converts workflow tools to CoreTool format.
   * @internal
   */
  private async listWorkflowTools({
    runId,
    threadId,
    resourceId,
    requestContext,
    tracingContext,
    methodType,
    autoResumeSuspendedTools,
  }: {
    runId?: string;
    threadId?: string;
    resourceId?: string;
    requestContext: RequestContext;
    tracingContext?: TracingContext;
    methodType: AgentMethodType;
    autoResumeSuspendedTools?: boolean;
  }) {
    const convertedWorkflowTools: Record<string, CoreTool> = {};
    const workflows = await this.listWorkflows({ requestContext });
    if (Object.keys(workflows).length > 0) {
      for (const [workflowName, workflow] of Object.entries(workflows)) {
        const extendedInputSchema = z.object({
          // @ts-expect-error - zod types mismatch between v3 and v4
          inputData: workflow.inputSchema ?? z.object({}).passthrough(),
          ...(workflow.stateSchema ? { initialState: workflow.stateSchema } : {}),
        });

        const toolObj = createTool({
          id: `workflow-${workflowName}`,
          description: workflow.description || `Workflow: ${workflowName}`,
          inputSchema: extendedInputSchema,
          outputSchema: z.union([
            z.object({
              // @ts-expect-error - zod types mismatch between v3 and v4
              result: workflow.outputSchema,
              runId: z.string().describe('Unique identifier for the workflow run'),
            }),
            z.object({
              runId: z.string().describe('Unique identifier for the workflow run'),
              error: z.string().describe('Error message if workflow execution failed'),
            }),
          ]),
          mastra: this.#mastra,
          // manually wrap workflow tools with tracing, so that we can pass the
          // current tool span onto the workflow to maintain continuity of the trace
          // @ts-expect-error - context type mismatch in workflow tool
          execute: async (inputData, context) => {
            try {
              const { initialState, inputData: workflowInputData, suspendedToolRunId } = inputData as any;
              const runIdToUse = suspendedToolRunId || runId;
              this.logger.debug(`[Agent:${this.name}] - Executing workflow as tool ${workflowName}`, {
                name: workflowName,
                description: workflow.description,
                args: inputData,
                runId: runIdToUse,
                threadId,
                resourceId,
              });

              const run = await workflow.createRun({ runId: runIdToUse });
              const { resumeData, suspend } = context?.agent ?? {};

              let result: WorkflowResult<any, any, any, any> | undefined = undefined;

              if (methodType === 'generate' || methodType === 'generateLegacy') {
                if (resumeData) {
                  result = await run.resume({
                    resumeData,
                    requestContext,
                    tracingContext: context?.tracingContext,
                  });
                } else {
                  result = await run.start({
                    inputData: workflowInputData,
                    requestContext,
                    tracingContext: context?.tracingContext,
                    ...(initialState && { initialState }),
                  });
                }
              } else if (methodType === 'streamLegacy') {
                const streamResult = run.streamLegacy({
                  inputData: workflowInputData,
                  requestContext,
                  tracingContext: context?.tracingContext,
                });

                if (context?.writer) {
                  await streamResult.stream.pipeTo(context.writer);
                } else {
                  for await (const _chunk of streamResult.stream) {
                    // complete the stream
                  }
                }

                result = await streamResult.getWorkflowState();
              } else if (methodType === 'stream') {
                const streamResult = resumeData
                  ? run.resumeStream({
                      resumeData,
                      requestContext,
                      tracingContext: context?.tracingContext,
                    })
                  : run.stream({
                      inputData: workflowInputData,
                      requestContext,
                      tracingContext: context?.tracingContext,
                      ...(initialState && { initialState }),
                    });

                if (context?.writer) {
                  await streamResult.fullStream.pipeTo(context.writer);
                }

                result = await streamResult.result;
              }

              if (result?.status === 'success') {
                const workflowOutput = result?.result || result;
                return { result: workflowOutput, runId: run.runId };
              } else if (result?.status === 'failed') {
                const workflowOutputError = result?.error;
                return {
                  error: workflowOutputError?.message || String(workflowOutputError) || 'Workflow execution failed',
                  runId: run.runId,
                };
              } else if (result?.status === 'suspended') {
                const suspendedStep = result?.suspended?.[0]?.[0]!;
                const suspendPayload = result?.steps?.[suspendedStep]?.suspendPayload;
                const suspendedStepIds = result?.suspended?.map(stepPath => stepPath.join('.'));
                const firstSuspendedStepPath = [...(result?.suspended?.[0] ?? [])];
                let wflowStep = workflow;
                while (firstSuspendedStepPath.length > 0) {
                  const key = firstSuspendedStepPath.shift();
                  if (key) {
                    if (!wflowStep.steps[key]) {
                      this.logger.warn(`Suspended step '${key}' not found in workflow '${workflowName}'`);
                      break;
                    }
                    wflowStep = wflowStep.steps[key] as any;
                  }
                }
                const resumeSchema = (wflowStep as Step<any, any, any, any, any, any>)?.resumeSchema;
                if (suspendPayload?.__workflow_meta) {
                  delete suspendPayload.__workflow_meta;
                }
                return suspend?.(suspendPayload, {
                  resumeLabel: suspendedStepIds,
                  resumeSchema: resumeSchema ? JSON.stringify(zodToJsonSchema(resumeSchema)) : undefined,
                });
              } else {
                // This is to satisfy the execute fn's return value for typescript
                return {
                  error: `Workflow should never reach this path, workflow returned no status`,
                  runId: run.runId,
                };
              }
            } catch (err) {
              const mastraError = new MastraError(
                {
                  id: 'AGENT_WORKFLOW_TOOL_EXECUTION_FAILED',
                  domain: ErrorDomain.AGENT,
                  category: ErrorCategory.USER,
                  details: {
                    agentName: this.name,
                    runId: (inputData as any).suspendedToolRunId || runId || '',
                    threadId: threadId || '',
                    resourceId: resourceId || '',
                  },
                  text: `[Agent:${this.name}] - Failed workflow tool execution`,
                },
                err,
              );
              this.logger.trackException(mastraError);
              this.logger.error(mastraError.toString());
              throw mastraError;
            }
          },
        });

        const options: ToolOptions = {
          name: `workflow-${workflowName}`,
          runId,
          threadId,
          resourceId,
          logger: this.logger,
          mastra: this.#mastra,
          memory: await this.getMemory({ requestContext }),
          agentName: this.name,
          requestContext,
          model: await this.getModel({ requestContext }),
          tracingContext,
          tracingPolicy: this.#options?.tracingPolicy,
        };

        convertedWorkflowTools[`workflow-${workflowName}`] = makeCoreTool(
          toolObj,
          options,
          undefined,
          autoResumeSuspendedTools,
        );
      }
    }

    return convertedWorkflowTools;
  }

  /**
   * Assembles all tools from various sources into a unified CoreTool dictionary.
   * @internal
   */
  private async convertTools({
    toolsets,
    clientTools,
    threadId,
    resourceId,
    runId,
    requestContext,
    tracingContext,
    outputWriter,
    methodType,
    memoryConfig,
    autoResumeSuspendedTools,
  }: {
    toolsets?: ToolsetsInput;
    clientTools?: ToolsInput;
    threadId?: string;
    resourceId?: string;
    runId?: string;
    requestContext: RequestContext;
    tracingContext?: TracingContext;
    outputWriter?: OutputWriter;
    methodType: AgentMethodType;
    memoryConfig?: MemoryConfig;
    autoResumeSuspendedTools?: boolean;
  }): Promise<Record<string, CoreTool>> {
    let mastraProxy = undefined;
    const logger = this.logger;

    if (this.#mastra) {
      mastraProxy = createMastraProxy({ mastra: this.#mastra, logger });
    }

    const assignedTools = await this.listAssignedTools({
      runId,
      resourceId,
      threadId,
      requestContext,
      tracingContext,
      mastraProxy,
      outputWriter,
      autoResumeSuspendedTools,
    });

    const memoryTools = await this.listMemoryTools({
      runId,
      resourceId,
      threadId,
      requestContext,
      tracingContext,
      mastraProxy,
      memoryConfig,
      autoResumeSuspendedTools,
    });

    const toolsetTools = await this.listToolsets({
      runId,
      resourceId,
      threadId,
      requestContext,
      tracingContext,
      mastraProxy,
      toolsets: toolsets!,
      autoResumeSuspendedTools,
    });

    const clientSideTools = await this.listClientTools({
      runId,
      resourceId,
      threadId,
      requestContext,
      tracingContext,
      mastraProxy,
      clientTools: clientTools!,
      autoResumeSuspendedTools,
    });

    const agentTools = await this.listAgentTools({
      runId,
      resourceId,
      threadId,
      requestContext,
      methodType,
      tracingContext,
      autoResumeSuspendedTools,
    });

    const workflowTools = await this.listWorkflowTools({
      runId,
      resourceId,
      threadId,
      requestContext,
      methodType,
      tracingContext,
      autoResumeSuspendedTools,
    });

    const workspaceTools = await this.listWorkspaceTools({
      runId,
      resourceId,
      threadId,
      requestContext,
      tracingContext,
      mastraProxy,
      autoResumeSuspendedTools,
    });

    const allTools = {
      ...assignedTools,
      ...memoryTools,
      ...toolsetTools,
      ...clientSideTools,
      ...agentTools,
      ...workflowTools,
      ...workspaceTools,
    };
    return this.formatTools(allTools);
  }

  /**
   * Formats and validates tool names to comply with naming restrictions.
   * @internal
   */
  private formatTools(tools: Record<string, CoreTool>): Record<string, CoreTool> {
    const INVALID_CHAR_REGEX = /[^a-zA-Z0-9_\-]/g;
    const STARTING_CHAR_REGEX = /[a-zA-Z_]/;

    for (const key of Object.keys(tools)) {
      if (tools[key] && (key.length > 63 || key.match(INVALID_CHAR_REGEX) || !key[0]!.match(STARTING_CHAR_REGEX))) {
        let newKey = key.replace(INVALID_CHAR_REGEX, '_');
        if (!newKey[0]!.match(STARTING_CHAR_REGEX)) {
          newKey = '_' + newKey;
        }
        newKey = newKey.slice(0, 63);

        if (tools[newKey]) {
          const mastraError = new MastraError({
            id: 'AGENT_TOOL_NAME_COLLISION',
            domain: ErrorDomain.AGENT,
            category: ErrorCategory.USER,
            details: {
              agentName: this.name,
              toolName: newKey,
            },
            text: `Two or more tools resolve to the same name "${newKey}". Please rename one of the tools to avoid this collision.`,
          });
          this.logger.trackException(mastraError);
          this.logger.error(mastraError.toString());
          throw mastraError;
        }

        tools[newKey] = tools[key];
        delete tools[key];
      }
    }

    return tools;
  }

  /**
   * Adds response messages from a step to the MessageList and schedules persistence.
   * This is used for incremental saving: after each agent step, messages are added to a save queue
   * and a debounced save operation is triggered to avoid redundant writes.
   *
   * @param result - The step result containing response messages.
   * @param messageList - The MessageList instance for the current thread.
   * @param threadId - The thread ID.
   * @param memoryConfig - The memory configuration for saving.
   * @param runId - (Optional) The run ID for logging.
   * @internal
   */
  private async saveStepMessages({
    result,
    messageList,
    runId,
  }: {
    result: any;
    messageList: MessageList;
    runId?: string;
  }) {
    try {
      messageList.add(result.response.messages, 'response');
      // Message saving is now handled by MessageHistory output processor
    } catch (e) {
      this.logger.error('Error adding messages on step finish', {
        error: e,
        runId,
      });
      throw e;
    }
  }

  async #runScorers({
    messageList,
    runId,
    requestContext,
    structuredOutput,
    overrideScorers,
    threadId,
    resourceId,
    tracingContext,
  }: {
    messageList: MessageList;
    runId: string;
    requestContext: RequestContext;
    structuredOutput?: boolean;
    overrideScorers?:
      | MastraScorers
      | Record<string, { scorer: MastraScorer['name']; sampling?: ScoringSamplingConfig }>;
    threadId?: string;
    resourceId?: string;
    tracingContext: TracingContext;
  }) {
    let scorers: Record<string, { scorer: MastraScorer; sampling?: ScoringSamplingConfig }> = {};
    try {
      scorers = overrideScorers
        ? this.resolveOverrideScorerReferences(overrideScorers)
        : await this.listScorers({ requestContext });
    } catch (e) {
      this.logger.warn(`[Agent:${this.name}] - Failed to get scorers: ${e}`);
      return;
    }

    const scorerInput: ScorerRunInputForAgent = {
      inputMessages: messageList.getPersisted.input.db(),
      rememberedMessages: messageList.getPersisted.remembered.db(),
      systemMessages: messageList.getSystemMessages(),
      taggedSystemMessages: messageList.getPersisted.taggedSystemMessages,
    };

    const scorerOutput: ScorerRunOutputForAgent = messageList.getPersisted.response.db();

    if (Object.keys(scorers || {}).length > 0) {
      for (const [_id, scorerObject] of Object.entries(scorers)) {
        runScorer({
          scorerId: scorerObject.scorer.id,
          scorerObject: scorerObject,
          runId,
          input: scorerInput,
          output: scorerOutput,
          requestContext,
          entity: {
            id: this.id,
            name: this.name,
          },
          source: 'LIVE',
          entityType: 'AGENT',
          structuredOutput: !!structuredOutput,
          threadId,
          resourceId,
          tracingContext,
        });
      }
    }
  }

  /**
   * Resolves scorer name references to actual scorer instances from Mastra.
   * @internal
   */
  private resolveOverrideScorerReferences(
    overrideScorers: MastraScorers | Record<string, { scorer: MastraScorer['name']; sampling?: ScoringSamplingConfig }>,
  ) {
    const result: Record<string, { scorer: MastraScorer; sampling?: ScoringSamplingConfig }> = {};
    for (const [id, scorerObject] of Object.entries(overrideScorers)) {
      // If the scorer is a string (scorer name), we need to get the scorer from the mastra instance
      if (typeof scorerObject.scorer === 'string') {
        try {
          if (!this.#mastra) {
            throw new MastraError({
              id: 'AGENT_GENEREATE_SCORER_NOT_FOUND',
              domain: ErrorDomain.AGENT,
              category: ErrorCategory.USER,
              text: `Mastra not found when fetching scorer. Make sure to fetch agent from mastra.getAgent()`,
            });
          }

          const scorer = this.#mastra.getScorerById(scorerObject.scorer);
          result[id] = { scorer, sampling: scorerObject.sampling };
        } catch (error) {
          this.logger.warn(`[Agent:${this.name}] - Failed to get scorer ${scorerObject.scorer}: ${error}`);
        }
      } else {
        result[id] = scorerObject;
      }
    }

    // Only throw if scorers were provided but none could be resolved
    if (Object.keys(result).length === 0 && Object.keys(overrideScorers).length > 0) {
      throw new MastraError({
        id: 'AGENT_GENEREATE_SCORER_NOT_FOUND',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `No scorers found in overrideScorers`,
      });
    }

    return result;
  }

  /**
   * Resolves and prepares model configurations for the LLM.
   * @internal
   */
  private async prepareModels(
    requestContext: RequestContext,
    model?: DynamicArgument<MastraLanguageModel> | ModelFallbacks,
  ): Promise<Array<AgentModelManagerConfig>> {
    if (model || !Array.isArray(this.model)) {
      const modelToUse = model ?? this.model;
      const resolvedModel = await this.resolveModelConfig(
        modelToUse as DynamicArgument<MastraModelConfig>,
        requestContext,
      );

      if (!isSupportedLanguageModel(resolvedModel)) {
        const mastraError = new MastraError({
          id: 'AGENT_PREPARE_MODELS_INCOMPATIBLE_WITH_MODEL_ARRAY_V1',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          details: {
            agentName: this.name,
          },
          text: `[Agent:${this.name}] - Only v2/v3 models are allowed when an array of models is provided`,
        });
        this.logger.trackException(mastraError);
        this.logger.error(mastraError.toString());
        throw mastraError;
      }

      // Extract headers from ModelRouterLanguageModel if available
      let headers: Record<string, string> | undefined;
      if (resolvedModel instanceof ModelRouterLanguageModel) {
        headers = (resolvedModel as any).config?.headers;
      }

      return [
        {
          id: 'main',
          model: resolvedModel,
          maxRetries: this.maxRetries ?? 0,
          enabled: true,
          headers,
        },
      ];
    }

    const models = await Promise.all(
      this.model.map(async modelConfig => {
        const model = await this.resolveModelConfig(modelConfig.model, requestContext);

        if (!isSupportedLanguageModel(model)) {
          const mastraError = new MastraError({
            id: 'AGENT_PREPARE_MODELS_INCOMPATIBLE_WITH_MODEL_ARRAY_V1',
            domain: ErrorDomain.AGENT,
            category: ErrorCategory.USER,
            details: {
              agentName: this.name,
            },
            text: `[Agent:${this.name}] - Only v2/v3 models are allowed when an array of models is provided`,
          });
          this.logger.trackException(mastraError);
          this.logger.error(mastraError.toString());
          throw mastraError;
        }

        const modelId = modelConfig.id || model.modelId;
        if (!modelId) {
          const mastraError = new MastraError({
            id: 'AGENT_PREPARE_MODELS_MISSING_MODEL_ID',
            domain: ErrorDomain.AGENT,
            category: ErrorCategory.USER,
            details: {
              agentName: this.name,
            },
            text: `[Agent:${this.name}] - Unable to determine model ID. Please provide an explicit ID in the model configuration.`,
          });
          this.logger.trackException(mastraError);
          this.logger.error(mastraError.toString());
          throw mastraError;
        }

        // Extract headers from ModelRouterLanguageModel if available
        let headers: Record<string, string> | undefined;
        if (model instanceof ModelRouterLanguageModel) {
          headers = (model as any).config?.headers;
        }

        return {
          id: modelId,
          model: model,
          maxRetries: modelConfig.maxRetries ?? 0,
          enabled: modelConfig.enabled ?? true,
          headers,
        };
      }),
    );

    return models;
  }

  /**
   * Executes the agent call, handling tools, memory, and streaming.
   * @internal
   */
  async #execute<OUTPUT = undefined>({ methodType, resumeContext, ...options }: InnerAgentExecutionOptions<OUTPUT>) {
    const existingSnapshot = resumeContext?.snapshot;
    let snapshotMemoryInfo;
    if (existingSnapshot) {
      for (const key in existingSnapshot?.context) {
        const step = existingSnapshot?.context[key];
        if (step && step.status === 'suspended' && step.suspendPayload?.__streamState) {
          snapshotMemoryInfo = step.suspendPayload?.__streamState?.messageList?.memoryInfo;
          break;
        }
      }
    }
    const requestContext = options.requestContext || new RequestContext();

    // Reserved keys from requestContext take precedence for security.
    // This allows middleware to securely set resourceId/threadId based on authenticated user,
    // preventing attackers from hijacking another user's memory by passing different values in the body.
    const resourceIdFromContext = requestContext.get(MASTRA_RESOURCE_ID_KEY) as string | undefined;
    const threadIdFromContext = requestContext.get(MASTRA_THREAD_ID_KEY) as string | undefined;

    const threadFromArgs = threadIdFromContext
      ? { id: threadIdFromContext }
      : resolveThreadIdFromArgs({
          memory: {
            ...options.memory,
            thread: options.memory?.thread || snapshotMemoryInfo?.threadId,
          },
        });

    const resourceId = resourceIdFromContext || options.memory?.resource || snapshotMemoryInfo?.resourceId;
    const memoryConfig = options.memory?.options;

    if (resourceId && threadFromArgs && !this.hasOwnMemory()) {
      this.logger.warn(
        `[Agent:${this.name}] - No memory is configured but resourceId and threadId were passed in args. This will not work.`,
      );
    }

    const llm = (await this.getLLM({ requestContext, model: options.model })) as MastraLLMVNext;

    // Apply OpenAI schema compatibility layer automatically for OpenAI models
    // In direct mode, use the main model; in processor mode, use structuredOutput.model
    if ('structuredOutput' in options && options.structuredOutput?.schema) {
      let structuredOutputModel = llm.getModel();
      if (options.structuredOutput?.model) {
        structuredOutputModel = (await this.resolveModelConfig(
          options.structuredOutput?.model,
          requestContext,
        )) as MastraLanguageModelV2;
      }

      const targetProvider = structuredOutputModel.provider;
      const targetModelId = structuredOutputModel.modelId;
      // Only transform Zod schemas for OpenAI models, OpenAI is the most common and there is a huge issue that so many users run into
      // We transform all .optional() to .nullable().transform(v => v === null ? undefined : v)
      // OpenAI can't handle optional fields, we turn them to nullable and then transform the data received back so the types match the users schema
      if (targetProvider.includes('openai') || targetModelId.includes('openai')) {
        if (isZodType(options.structuredOutput.schema) && targetModelId) {
          const modelInfo: ModelInformation = {
            provider: targetProvider,
            modelId: targetModelId,
            supportsStructuredOutputs: false, // Set to false to enable transform
          };

          const isReasoningModel = /^o[1-5]/.test(targetModelId);
          const compatLayer = isReasoningModel
            ? new OpenAIReasoningSchemaCompatLayer(modelInfo)
            : new OpenAISchemaCompatLayer(modelInfo);

          if (compatLayer.shouldApply() && options.structuredOutput.schema) {
            options.structuredOutput.schema = compatLayer.processZodType(options.structuredOutput.schema);
          }
        }
      }
    }

    const runId =
      options.runId ||
      this.#mastra?.generateId({
        idType: 'run',
        source: 'agent',
        entityId: this.id,
        threadId: threadFromArgs?.id,
        resourceId,
      }) ||
      randomUUID();
    const instructions = options.instructions || (await this.getInstructions({ requestContext }));

    // Set Tracing context
    // Note this span is ended at the end of #executeOnFinish
    const agentSpan = getOrCreateSpan({
      type: SpanType.AGENT_RUN,
      name: `agent run: '${this.id}'`,
      entityType: EntityType.AGENT,
      entityId: this.id,
      entityName: this.name,
      input: options.messages,
      attributes: {
        conversationId: threadFromArgs?.id,
        instructions: this.#convertInstructionsToString(instructions),
      },
      metadata: {
        runId,
        resourceId,
        threadId: threadFromArgs?.id,
      },
      tracingPolicy: this.#options?.tracingPolicy,
      tracingOptions: options.tracingOptions,
      tracingContext: options.tracingContext,
      requestContext,
      mastra: this.#mastra,
    });

    const memory = await this.getMemory({ requestContext });
    const workspace = await this.getWorkspace({ requestContext });

    const saveQueueManager = new SaveQueueManager({
      logger: this.logger,
      memory,
    });

    if (process.env.NODE_ENV !== 'test') {
      this.logger.debug(`[Agents:${this.name}] - Starting generation`, { runId });
    }

    // Create a capabilities object with bound methods
    const capabilities = {
      agentName: this.name,
      logger: this.logger,
      getMemory: this.getMemory.bind(this),
      getModel: this.getModel.bind(this),
      generateMessageId: this.#mastra?.generateId?.bind(this.#mastra) || (() => randomUUID()),
      _agentNetworkAppend:
        '_agentNetworkAppend' in this
          ? Boolean((this as unknown as { _agentNetworkAppend: unknown })._agentNetworkAppend)
          : undefined,
      saveStepMessages: this.saveStepMessages.bind(this),
      convertTools: this.convertTools.bind(this),
      getMemoryMessages: this.getMemoryMessages.bind(this),
      runInputProcessors: this.__runInputProcessors.bind(this),
      executeOnFinish: this.#executeOnFinish.bind(this),
      inputProcessors: async ({
        requestContext,
        overrides,
      }: {
        requestContext: RequestContext;
        overrides?: InputProcessorOrWorkflow[];
      }) => this.listResolvedInputProcessors(requestContext, overrides),
      outputProcessors: async ({
        requestContext,
        overrides,
      }: {
        requestContext: RequestContext;
        overrides?: OutputProcessorOrWorkflow[];
      }) => this.listResolvedOutputProcessors(requestContext, overrides),
      llm,
    };

    // Create the workflow with all necessary context
    const executionWorkflow = createPrepareStreamWorkflow<OUTPUT>({
      capabilities,
      options: { ...options, methodType } as any,
      threadFromArgs,
      resourceId,
      runId,
      requestContext,
      agentSpan: agentSpan!,
      methodType,
      instructions,
      memoryConfig,
      memory,
      saveQueueManager,
      returnScorerData: options.returnScorerData,
      requireToolApproval: options.requireToolApproval,
      toolCallConcurrency: options.toolCallConcurrency,
      resumeContext,
      agentId: this.id,
      agentName: this.name,
      toolCallId: options.toolCallId,
      workspace,
    });

    const run = await executionWorkflow.createRun();
    const result = await run.start({ tracingContext: { currentSpan: agentSpan } });

    return result;
  }

  /**
   * Handles post-execution tasks including memory persistence and title generation.
   * @internal
   */
  async #executeOnFinish({
    result,
    readOnlyMemory,
    thread: threadAfter,
    threadId,
    resourceId,
    memoryConfig,
    outputText,
    requestContext,
    agentSpan,
    runId,
    messageList,
    threadExists,
    structuredOutput = false,
    overrideScorers,
  }: AgentExecuteOnFinishOptions) {
    const resToLog = {
      text: result.text,
      object: result.object,
      toolResults: result.toolResults,
      toolCalls: result.toolCalls,
      usage: result.usage,
      steps: result.steps.map(s => {
        return {
          stepType: s.stepType,
          text: s.text,
          toolResults: s.toolResults,
          toolCalls: s.toolCalls,
          usage: s.usage,
        };
      }),
    };
    this.logger.debug(`[Agent:${this.name}] - Post processing LLM response`, {
      runId,
      result: resToLog,
      threadId,
      resourceId,
    });

    const messageListResponses = messageList.get.response.aiV4.core();

    const usedWorkingMemory = messageListResponses.some(
      m => m.role === 'tool' && m.content.some(c => c.toolName === 'updateWorkingMemory'),
    );
    // working memory updates the thread, so we need to get the latest thread if we used it
    const memory = await this.getMemory({ requestContext });
    const thread = usedWorkingMemory ? (threadId ? await memory?.getThreadById({ threadId }) : undefined) : threadAfter;

    if (memory && resourceId && thread && !readOnlyMemory) {
      try {
        // Add LLM response messages to the list
        let responseMessages = result.response.messages;
        if (!responseMessages && result.object) {
          responseMessages = [
            {
              id: result.response.id,
              role: 'assistant',
              content: [
                {
                  type: 'text',
                  text: outputText, // outputText contains the stringified object
                },
              ],
            },
          ];
        }

        if (responseMessages) {
          messageList.add(responseMessages, 'response');
        }

        if (!threadExists) {
          await memory.createThread({
            threadId: thread.id,
            metadata: thread.metadata,
            title: thread.title,
            memoryConfig,
            resourceId: thread.resourceId,
          });
        }

        // Generate title if needed
        // Note: Message saving is now handled by MessageHistory output processor
        // Use threadExists to determine if this is the first turn - it's reliable regardless
        // of whether MessageHistory processor is loaded (e.g., when lastMessages is disabled)
        const config = memory.getMergedThreadConfig(memoryConfig);
        const {
          shouldGenerate,
          model: titleModel,
          instructions: titleInstructions,
        } = this.resolveTitleGenerationConfig(config.generateTitle);

        if (shouldGenerate && !thread.title) {
          const userMessage = this.getMostRecentUserMessage(messageList.get.all.ui());
          if (userMessage) {
            const title = await this.genTitle(
              userMessage,
              requestContext,
              { currentSpan: agentSpan },
              titleModel,
              titleInstructions,
            );
            if (title) {
              await memory.createThread({
                threadId: thread.id,
                resourceId,
                memoryConfig,
                title,
                metadata: thread.metadata,
              });
            }
          }
        }
      } catch (e) {
        if (e instanceof MastraError) {
          throw e;
        }
        const mastraError = new MastraError(
          {
            id: 'AGENT_MEMORY_PERSIST_RESPONSE_MESSAGES_FAILED',
            domain: ErrorDomain.AGENT,
            category: ErrorCategory.SYSTEM,
            details: {
              agentName: this.name,
              runId: runId || '',
              threadId: threadId || '',
              result: JSON.stringify(resToLog),
            },
          },
          e,
        );
        this.logger.trackException(mastraError);
        this.logger.error(mastraError.toString());
        throw mastraError;
      }
    } else {
      let responseMessages = result.response.messages;
      if (!responseMessages && result.object) {
        responseMessages = [
          {
            id: result.response.id,
            role: 'assistant',
            content: [
              {
                type: 'text',
                text: outputText, // outputText contains the stringified object
              },
            ],
          },
        ];
      }
      if (responseMessages) {
        messageList.add(responseMessages, 'response');
      }
    }

    await this.#runScorers({
      messageList,
      runId,
      requestContext,
      structuredOutput,
      overrideScorers,
      tracingContext: { currentSpan: agentSpan },
    });

    agentSpan?.end({
      output: {
        text: result.text,
        object: result.object,
        files: result.files,
      },
    });
  }

  /**
   * Executes a network loop where multiple agents can collaborate to handle messages.
   * The routing agent delegates tasks to appropriate sub-agents based on the conversation.
   *
   * @experimental
   *
   * @example
   * ```typescript
   * const result = await agent.network('Find the weather in Tokyo and plan an activity', {
   *   memory: {
   *     thread: 'user-123',
   *     resource: 'my-app'
   *   },
   *   maxSteps: 10
   * });
   *
   * for await (const chunk of result.stream) {
   *   console.log(chunk);
   * }
   * ```
   */
  async network(
    messages: MessageListInput,
    options?: MultiPrimitiveExecutionOptions<undefined>,
  ): Promise<MastraAgentNetworkStream<undefined>>;
  async network<OUTPUT extends {}>(
    messages: MessageListInput,
    options?: MultiPrimitiveExecutionOptions<OUTPUT>,
  ): Promise<MastraAgentNetworkStream<OUTPUT>>;
  async network<OUTPUT = undefined>(messages: MessageListInput, options?: MultiPrimitiveExecutionOptions<OUTPUT>) {
    const requestContextToUse = options?.requestContext || new RequestContext();

    // Merge default network options with call-specific options
    const defaultNetworkOptions = await this.getDefaultNetworkOptions({ requestContext: requestContextToUse });
    const mergedOptions = {
      ...defaultNetworkOptions,
      ...options,
      // Deep merge nested objects
      routing: { ...defaultNetworkOptions?.routing, ...options?.routing },
      completion: { ...defaultNetworkOptions?.completion, ...options?.completion },
    };

    const runId = mergedOptions?.runId || this.#mastra?.generateId() || randomUUID();

    // Reserved keys from requestContext take precedence for security.
    // This allows middleware to securely set resourceId/threadId based on authenticated user,
    // preventing attackers from hijacking another user's memory by passing different values in the body.
    const resourceIdFromContext = requestContextToUse.get(MASTRA_RESOURCE_ID_KEY) as string | undefined;
    const threadIdFromContext = requestContextToUse.get(MASTRA_THREAD_ID_KEY) as string | undefined;

    const threadId =
      threadIdFromContext ||
      (typeof mergedOptions?.memory?.thread === 'string'
        ? mergedOptions?.memory?.thread
        : mergedOptions?.memory?.thread?.id);
    const resourceId = resourceIdFromContext || mergedOptions?.memory?.resource;

    return await networkLoop<OUTPUT>({
      networkName: this.name,
      requestContext: requestContextToUse,
      runId,
      routingAgent: this,
      routingAgentOptions: {
        modelSettings: mergedOptions?.modelSettings,
        memory: mergedOptions?.memory,
      } as unknown as AgentExecutionOptions<OUTPUT>,
      generateId: context => this.#mastra?.generateId(context) || randomUUID(),
      maxIterations: mergedOptions?.maxSteps || 1,
      messages,
      threadId,
      resourceId,
      validation: mergedOptions?.completion,
      routing: mergedOptions?.routing,
      onIterationComplete: mergedOptions?.onIterationComplete,
      autoResumeSuspendedTools: mergedOptions?.autoResumeSuspendedTools,
      mastra: this.#mastra,
      structuredOutput: mergedOptions?.structuredOutput as OUTPUT extends {} ? StructuredOutputOptions<OUTPUT> : never,
      onAbort: mergedOptions?.onAbort,
      abortSignal: mergedOptions?.abortSignal,
    });
  }

  /**
   * Resumes a suspended network loop where multiple agents can collaborate to handle messages.
   * The routing agent delegates tasks to appropriate sub-agents based on the conversation.
   *
   * @experimental
   *
   * @example
   * ```typescript
   * const result = await agent.resumeNetwork({ approved: true }, {
   *   runId: 'previous-run-id',
   *   memory: {
   *     thread: 'user-123',
   *     resource: 'my-app'
   *   },
   *   maxSteps: 10
   * });
   *
   * for await (const chunk of result.stream) {
   *   console.log(chunk);
   * }
   * ```
   */
  async resumeNetwork(resumeData: any, options: Omit<MultiPrimitiveExecutionOptions, 'runId'> & { runId: string }) {
    const runId = options.runId;
    const requestContextToUse = options?.requestContext || new RequestContext();

    // Merge default network options with call-specific options
    const defaultNetworkOptions = await this.getDefaultNetworkOptions({ requestContext: requestContextToUse });
    const mergedOptions = {
      ...defaultNetworkOptions,
      ...options,
      // Deep merge nested objects
      routing: { ...defaultNetworkOptions?.routing, ...options?.routing },
      completion: { ...defaultNetworkOptions?.completion, ...options?.completion },
    };

    // Reserved keys from requestContext take precedence for security.
    // This allows middleware to securely set resourceId/threadId based on authenticated user,
    // preventing attackers from hijacking another user's memory by passing different values in the body.
    const resourceIdFromContext = requestContextToUse.get(MASTRA_RESOURCE_ID_KEY) as string | undefined;
    const threadIdFromContext = requestContextToUse.get(MASTRA_THREAD_ID_KEY) as string | undefined;

    const threadId =
      threadIdFromContext ||
      (typeof mergedOptions?.memory?.thread === 'string'
        ? mergedOptions?.memory?.thread
        : mergedOptions?.memory?.thread?.id);
    const resourceId = resourceIdFromContext || mergedOptions?.memory?.resource;

    return await networkLoop({
      networkName: this.name,
      requestContext: requestContextToUse,
      runId,
      routingAgent: this,
      routingAgentOptions: {
        modelSettings: mergedOptions?.modelSettings,
        memory: mergedOptions?.memory,
      },
      generateId: context => this.#mastra?.generateId(context) || randomUUID(),
      maxIterations: mergedOptions?.maxSteps || 1,
      messages: [],
      threadId,
      resourceId,
      resumeData,
      validation: mergedOptions?.completion,
      routing: mergedOptions?.routing,
      onIterationComplete: mergedOptions?.onIterationComplete,
      autoResumeSuspendedTools: mergedOptions?.autoResumeSuspendedTools,
      mastra: this.#mastra,
      onAbort: mergedOptions?.onAbort,
      abortSignal: mergedOptions?.abortSignal,
    });
  }

  /**
   * Approves a pending network tool call and resumes execution.
   * Used when `tool.requireApproval` is enabled to allow the agent to proceed with a tool call.
   *
   * @example
   * ```typescript
   * const stream = await agent.approveNetworkToolCall({
   *   runId: 'pending-run-id'
   * });
   *
   * for await (const chunk of stream) {
   *   console.log(chunk);
   * }
   * ```
   */
  async approveNetworkToolCall(options: Omit<MultiPrimitiveExecutionOptions, 'runId'> & { runId: string }) {
    return this.resumeNetwork({ approved: true }, options);
  }

  /**
   * Declines a pending network tool call and resumes execution.
   * Used when `tool.requireApproval` is enabled to allow the agent to proceed with a tool call.
   *
   * @example
   * ```typescript
   * const stream = await agent.declineNetworkToolCall({
   *   runId: 'pending-run-id'
   * });
   *
   * for await (const chunk of stream) {
   *   console.log(chunk);
   * }
   * ```
   */
  async declineNetworkToolCall(options: Omit<MultiPrimitiveExecutionOptions, 'runId'> & { runId: string }) {
    return this.resumeNetwork({ approved: false }, options);
  }
  async generate(messages: MessageListInput, options?: AgentExecutionOptions<TOutput>): Promise<FullOutput<TOutput>>;
  async generate<OUTPUT extends {}>(
    messages: MessageListInput,
    options: AgentExecutionOptionsBase<OUTPUT> & {
      structuredOutput: StructuredOutputOptions<OUTPUT>;
    },
  ): Promise<FullOutput<OUTPUT>>;
  // Catch-all overload to handle conditional types when OUTPUT is generic
  async generate<OUTPUT>(
    messages: MessageListInput,
    options?: AgentExecutionOptionsBase<any> & {
      structuredOutput?: StructuredOutputOptions<any>;
    },
  ): Promise<FullOutput<OUTPUT>>;
  async generate(
    messages: MessageListInput,
    options?: AgentExecutionOptionsBase<any> & {
      structuredOutput?: StructuredOutputOptions<any>;
    },
  ): Promise<FullOutput<any>> {
    // Validate request context if schema is provided
    await this.#validateRequestContext(options?.requestContext);

    const defaultOptions = await this.getDefaultOptions({
      requestContext: options?.requestContext,
    });
    const mergedOptions = deepMerge(
      defaultOptions as Record<string, unknown>,
      (options ?? {}) as Record<string, unknown>,
    ) as AgentExecutionOptions<any>;

    const llm = await this.getLLM({
      requestContext: mergedOptions.requestContext,
    });

    const modelInfo = llm.getModel();

    if (!isSupportedLanguageModel(modelInfo)) {
      const modelId = modelInfo.modelId || 'unknown';
      const provider = modelInfo.provider || 'unknown';
      const specVersion = modelInfo.specificationVersion;

      throw new MastraError({
        id: 'AGENT_GENERATE_V1_MODEL_NOT_SUPPORTED',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text:
          specVersion === 'v1'
            ? `Agent "${this.name}" is using AI SDK v4 model (${provider}:${modelId}) which is not compatible with generate(). Please use AI SDK v5+ models or call the generateLegacy() method instead. See https://mastra.ai/en/docs/streaming/overview for more information.`
            : `Agent "${this.name}" has a model (${provider}:${modelId}) with unrecognized specificationVersion "${specVersion}". Supported versions: v1 (legacy), v2 (AI SDK v5), v3 (AI SDK v6). Please ensure your AI SDK provider is compatible with this version of Mastra.`,
        details: {
          agentName: this.name,
          modelId,
          provider,
          specificationVersion: specVersion,
        },
      });
    }

    const executeOptions = {
      ...mergedOptions,
      messages,
      methodType: 'generate',
      // Use agent's maxProcessorRetries as default, allow options to override
      maxProcessorRetries: mergedOptions.maxProcessorRetries ?? this.#maxProcessorRetries,
    } as unknown as InnerAgentExecutionOptions<any>;

    const result = await this.#execute(executeOptions);

    if (result.status !== 'success') {
      if (result.status === 'failed') {
        throw new MastraError(
          {
            id: 'AGENT_GENERATE_FAILED',
            domain: ErrorDomain.AGENT,
            category: ErrorCategory.USER,
          },
          // pass original error to preserve stack trace
          result.error,
        );
      }
      throw new MastraError({
        id: 'AGENT_GENERATE_UNKNOWN_ERROR',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: 'An unknown error occurred while streaming',
      });
    }

    const fullOutput = await result.result.getFullOutput();

    const error = fullOutput.error;

    if (fullOutput.finishReason === 'error' && error) {
      throw error;
    }

    return fullOutput;
  }

  async stream<OUTPUT extends {}>(
    messages: MessageListInput,
    streamOptions: AgentExecutionOptionsBase<OUTPUT> & {
      structuredOutput: StructuredOutputOptions<OUTPUT>;
    },
  ): Promise<MastraModelOutput<OUTPUT>>;
  async stream<OUTPUT>(
    messages: MessageListInput,
    streamOptions: AgentExecutionOptionsBase<any> & {
      structuredOutput?: StructuredOutputOptions<any>;
    },
  ): Promise<MastraModelOutput<OUTPUT>>;
  async stream(messages: MessageListInput, streamOptions?: AgentExecutionOptions): Promise<MastraModelOutput>;
  async stream<OUTPUT = TOutput>(
    messages: MessageListInput,
    streamOptions?: AgentExecutionOptions<OUTPUT>,
  ): Promise<MastraModelOutput<OUTPUT>> {
    // Validate request context if schema is provided
    await this.#validateRequestContext(streamOptions?.requestContext);

    const defaultOptions = await this.getDefaultOptions({
      requestContext: streamOptions?.requestContext,
    });
    const mergedOptions = deepMerge(
      defaultOptions as Record<string, unknown>,
      (streamOptions ?? {}) as Record<string, unknown>,
    ) as AgentExecutionOptions<OUTPUT>;

    const llm = await this.getLLM({
      requestContext: mergedOptions.requestContext,
    });

    const modelInfo = llm.getModel();

    if (!isSupportedLanguageModel(modelInfo)) {
      const modelId = modelInfo.modelId || 'unknown';
      const provider = modelInfo.provider || 'unknown';
      const specVersion = modelInfo.specificationVersion;

      throw new MastraError({
        id: 'AGENT_STREAM_V1_MODEL_NOT_SUPPORTED',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text:
          specVersion === 'v1'
            ? `Agent "${this.name}" is using AI SDK v4 model (${provider}:${modelId}) which is not compatible with stream(). Please use AI SDK v5+ models or call the streamLegacy() method instead. See https://mastra.ai/en/docs/streaming/overview for more information.`
            : `Agent "${this.name}" has a model (${provider}:${modelId}) with unrecognized specificationVersion "${specVersion}". Supported versions: v1 (legacy), v2 (AI SDK v5), v3 (AI SDK v6). Please ensure your AI SDK provider is compatible with this version of Mastra.`,
        details: {
          agentName: this.name,
          modelId,
          provider,
          specificationVersion: specVersion,
        },
      });
    }

    const executeOptions = {
      ...mergedOptions,
      messages,
      methodType: 'stream',
      // Use agent's maxProcessorRetries as default, allow options to override
      maxProcessorRetries: mergedOptions.maxProcessorRetries ?? this.#maxProcessorRetries,
    } as unknown as InnerAgentExecutionOptions<OUTPUT>;

    const result = await this.#execute(executeOptions);

    if (result.status !== 'success') {
      if (result.status === 'failed') {
        throw new MastraError(
          {
            id: 'AGENT_STREAM_FAILED',
            domain: ErrorDomain.AGENT,
            category: ErrorCategory.USER,
          },
          // pass original error to preserve stack trace
          result.error,
        );
      }
      throw new MastraError({
        id: 'AGENT_STREAM_UNKNOWN_ERROR',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: 'An unknown error occurred while streaming',
      });
    }

    return result.result;
  }

  /**
   * Resumes a previously suspended stream execution.
   * Used to continue execution after a suspension point (e.g., tool approval, workflow suspend).
   *
   * @example
   * ```typescript
   * // Resume after suspension
   * const stream = await agent.resumeStream(
   *   { approved: true },
   *   { runId: 'previous-run-id' }
   * );
   * ```
   */
  async resumeStream<OUTPUT extends {}>(
    resumeData: any,
    streamOptions: AgentExecutionOptionsBase<OUTPUT> & {
      structuredOutput: StructuredOutputOptions<OUTPUT>;
      toolCallId?: string;
    },
  ): Promise<MastraModelOutput<OUTPUT>>;
  async resumeStream<OUTPUT>(
    resumeData: any,
    streamOptions: AgentExecutionOptionsBase<any> & {
      structuredOutput?: StructuredOutputOptions<any>;
      toolCallId?: string;
    },
  ): Promise<MastraModelOutput<OUTPUT>>;
  async resumeStream(
    resumeData: any,
    streamOptions?: AgentExecutionOptions & { toolCallId?: string },
  ): Promise<MastraModelOutput>;
  async resumeStream<OUTPUT = TOutput>(
    resumeData: MessageListInput,
    streamOptions?: AgentExecutionOptions<OUTPUT> & { toolCallId?: string },
  ): Promise<MastraModelOutput<OUTPUT>> {
    const defaultOptions = await this.getDefaultOptions({
      requestContext: streamOptions?.requestContext,
    });

    let mergedStreamOptions = deepMerge(
      defaultOptions as Record<string, unknown>,
      (streamOptions ?? {}) as Record<string, unknown>,
    ) as typeof defaultOptions;

    const llm = await this.getLLM({
      requestContext: mergedStreamOptions.requestContext,
    });

    if (!isSupportedLanguageModel(llm.getModel())) {
      const modelInfo = llm.getModel();
      const specVersion = modelInfo.specificationVersion;
      throw new MastraError({
        id: 'AGENT_STREAM_V1_MODEL_NOT_SUPPORTED',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text:
          specVersion === 'v1'
            ? 'V1 models are not supported for resumeStream. Please use streamLegacy instead.'
            : `Model has unrecognized specificationVersion "${specVersion}". Supported versions: v1 (legacy), v2 (AI SDK v5), v3 (AI SDK v6). Please ensure your AI SDK provider is compatible with this version of Mastra.`,
        details: {
          modelId: modelInfo.modelId,
          provider: modelInfo.provider,
          specificationVersion: specVersion,
        },
      });
    }

    const workflowsStore = await this.#mastra?.getStorage()?.getStore('workflows');
    const existingSnapshot = await workflowsStore?.loadWorkflowSnapshot({
      workflowName: 'agentic-loop',
      runId: streamOptions?.runId ?? '',
    });

    const result = await this.#execute({
      ...mergedStreamOptions,
      messages: [],
      resumeContext: {
        resumeData,
        snapshot: existingSnapshot,
      },
      methodType: 'stream',
    } as unknown as InnerAgentExecutionOptions<OUTPUT>);

    if (result.status !== 'success') {
      if (result.status === 'failed') {
        throw new MastraError(
          {
            id: 'AGENT_STREAM_FAILED',
            domain: ErrorDomain.AGENT,
            category: ErrorCategory.USER,
          },
          // pass original error to preserve stack trace
          result.error,
        );
      }
      throw new MastraError({
        id: 'AGENT_STREAM_UNKNOWN_ERROR',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: 'An unknown error occurred while streaming',
      });
    }

    return result.result as unknown as MastraModelOutput<OUTPUT>;
  }

  /**
   * Resumes a previously suspended generate execution.
   * Used to continue execution after a suspension point (e.g., tool approval, workflow suspend).
   *
   * @example
   * ```typescript
   * // Resume after suspension
   * const stream = await agent.resumeGenerate(
   *   { approved: true },
   *   { runId: 'previous-run-id' }
   * );
   * ```
   */
  async resumeGenerate<OUTPUT = undefined>(
    resumeData: any,
    options?: AgentExecutionOptions<OUTPUT> & { toolCallId?: string },
  ): Promise<Awaited<ReturnType<MastraModelOutput<OUTPUT>['getFullOutput']>>> {
    const defaultOptions = await this.getDefaultOptions({
      requestContext: options?.requestContext,
    });

    const mergedOptions = deepMerge(
      defaultOptions as Record<string, unknown>,
      (options ?? {}) as Record<string, unknown>,
    ) as typeof defaultOptions;

    const llm = await this.getLLM({
      requestContext: mergedOptions.requestContext,
    });

    const modelInfo = llm.getModel();

    if (!isSupportedLanguageModel(modelInfo)) {
      const modelId = modelInfo.modelId || 'unknown';
      const provider = modelInfo.provider || 'unknown';
      const specVersion = modelInfo.specificationVersion;
      throw new MastraError({
        id: 'AGENT_GENERATE_V1_MODEL_NOT_SUPPORTED',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text:
          specVersion === 'v1'
            ? `Agent "${this.name}" is using AI SDK v4 model (${provider}:${modelId}) which is not compatible with generate(). Please use AI SDK v5+ models or call the generateLegacy() method instead. See https://mastra.ai/en/docs/streaming/overview for more information.`
            : `Agent "${this.name}" has a model (${provider}:${modelId}) with unrecognized specificationVersion "${specVersion}". Supported versions: v1 (legacy), v2 (AI SDK v5), v3 (AI SDK v6). Please ensure your AI SDK provider is compatible with this version of Mastra.`,
        details: {
          agentName: this.name,
          modelId,
          provider,
          specificationVersion: specVersion,
        },
      });
    }

    const workflowsStore = await this.#mastra?.getStorage()?.getStore('workflows');
    const existingSnapshot = await workflowsStore?.loadWorkflowSnapshot({
      workflowName: 'agentic-loop',
      runId: options?.runId ?? '',
    });

    const result = await this.#execute({
      ...mergedOptions,
      messages: [],
      resumeContext: {
        resumeData,
        snapshot: existingSnapshot,
      },
      methodType: 'generate',
      // Use agent's maxProcessorRetries as default, allow options to override
      maxProcessorRetries: mergedOptions.maxProcessorRetries ?? this.#maxProcessorRetries,
    } as unknown as InnerAgentExecutionOptions<OUTPUT>);

    if (result.status !== 'success') {
      if (result.status === 'failed') {
        throw new MastraError(
          {
            id: 'AGENT_GENERATE_FAILED',
            domain: ErrorDomain.AGENT,
            category: ErrorCategory.USER,
          },
          // pass original error to preserve stack trace
          result.error,
        );
      }
      throw new MastraError({
        id: 'AGENT_GENERATE_UNKNOWN_ERROR',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: 'An unknown error occurred while generating',
      });
    }

    const fullOutput = (await result.result.getFullOutput()) as Awaited<
      ReturnType<MastraModelOutput<OUTPUT>['getFullOutput']>
    >;

    const error = fullOutput.error;

    if (fullOutput.finishReason === 'error' && error) {
      throw error;
    }

    return fullOutput;
  }

  /**
   * Approves a pending tool call and resumes execution.
   * Used when `requireToolApproval` is enabled to allow the agent to proceed with a tool call.
   *
   * @example
   * ```typescript
   * const stream = await agent.approveToolCall({
   *   runId: 'pending-run-id'
   * });
   *
   * for await (const chunk of stream) {
   *   console.log(chunk);
   * }
   * ```
   */
  async approveToolCall<OUTPUT = undefined>(
    options: AgentExecutionOptions<OUTPUT> & { runId: string; toolCallId?: string },
  ): Promise<MastraModelOutput<OUTPUT>> {
    return this.resumeStream({ approved: true }, options);
  }

  /**
   * Declines a pending tool call and resumes execution.
   * Used when `requireToolApproval` is enabled to prevent the agent from executing a tool call.
   *
   * @example
   * ```typescript
   * const stream = await agent.declineToolCall({
   *   runId: 'pending-run-id'
   * });
   *
   * for await (const chunk of stream) {
   *   console.log(chunk);
   * }
   * ```
   */
  async declineToolCall<OUTPUT = undefined>(
    options: AgentExecutionOptions<OUTPUT> & { runId: string; toolCallId?: string },
  ): Promise<MastraModelOutput<OUTPUT>> {
    return this.resumeStream({ approved: false }, options);
  }

  /**
   * Approves a pending tool call and returns the complete result (non-streaming).
   * Used when `requireToolApproval` is enabled with generate() to allow the agent to proceed.
   *
   * @example
   * ```typescript
   * const output = await agent.generate('Find user', { requireToolApproval: true });
   * if (output.finishReason === 'suspended') {
   *   const result = await agent.approveToolCallGenerate({
   *     runId: output.runId,
   *     toolCallId: output.suspendPayload.toolCallId
   *   });
   *   console.log(result.text);
   * }
   * ```
   */
  async approveToolCallGenerate<OUTPUT = undefined>(
    options: AgentExecutionOptions<OUTPUT> & { runId: string; toolCallId?: string },
  ): Promise<Awaited<ReturnType<MastraModelOutput<OUTPUT>['getFullOutput']>>> {
    return this.resumeGenerate({ approved: true }, options);
  }

  /**
   * Declines a pending tool call and returns the complete result (non-streaming).
   * Used when `requireToolApproval` is enabled with generate() to prevent tool execution.
   *
   * @example
   * ```typescript
   * const output = await agent.generate('Find user', { requireToolApproval: true });
   * if (output.finishReason === 'suspended') {
   *   const result = await agent.declineToolCallGenerate({
   *     runId: output.runId,
   *     toolCallId: output.suspendPayload.toolCallId
   *   });
   *   console.log(result.text);
   * }
   * ```
   */
  async declineToolCallGenerate<OUTPUT = undefined>(
    options: AgentExecutionOptions<OUTPUT> & { runId: string; toolCallId?: string },
  ): Promise<Awaited<ReturnType<MastraModelOutput<OUTPUT>['getFullOutput']>>> {
    return this.resumeGenerate({ approved: false }, options);
  }

  /**
   * Legacy implementation of generate method using AI SDK v4 models.
   * Use this method if you need to continue using AI SDK v4 models.
   *
   * @example
   * ```typescript
   * const result = await agent.generateLegacy('What is 2+2?');
   * console.log(result.text);
   * ```
   */
  async generateLegacy(
    messages: MessageListInput,
    args?: AgentGenerateOptions<undefined, undefined> & { output?: never; experimental_output?: never },
  ): Promise<GenerateTextResult<any, undefined>>;
  async generateLegacy<OUTPUT extends ZodSchema | JSONSchema7>(
    messages: MessageListInput,
    args?: AgentGenerateOptions<OUTPUT, undefined> & { output?: OUTPUT; experimental_output?: never },
  ): Promise<GenerateObjectResult<OUTPUT>>;
  async generateLegacy<EXPERIMENTAL_OUTPUT extends ZodSchema | JSONSchema7>(
    messages: MessageListInput,
    args?: AgentGenerateOptions<undefined, EXPERIMENTAL_OUTPUT> & {
      output?: never;
      experimental_output?: EXPERIMENTAL_OUTPUT;
    },
  ): Promise<GenerateTextResult<any, EXPERIMENTAL_OUTPUT>>;
  async generateLegacy<
    OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
    EXPERIMENTAL_OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
  >(
    messages: MessageListInput,
    generateOptions: AgentGenerateOptions<OUTPUT, EXPERIMENTAL_OUTPUT> = {},
  ): Promise<OUTPUT extends undefined ? GenerateTextResult<any, EXPERIMENTAL_OUTPUT> : GenerateObjectResult<OUTPUT>> {
    return this.getLegacyHandler().generateLegacy(messages, generateOptions);
  }

  /**
   * Legacy implementation of stream method using AI SDK v4 models.
   * Use this method if you need to continue using AI SDK v4 models.
   *
   * @example
   * ```typescript
   * const result = await agent.streamLegacy('Tell me a story');
   * for await (const chunk of result.textStream) {
   *   process.stdout.write(chunk);
   * }
   * ```
   */
  async streamLegacy<
    OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
    EXPERIMENTAL_OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
  >(
    messages: MessageListInput,
    args?: AgentStreamOptions<OUTPUT, EXPERIMENTAL_OUTPUT> & { output?: never; experimental_output?: never },
  ): Promise<StreamTextResult<any, OUTPUT extends ZodSchema ? z.infer<OUTPUT> : unknown>>;
  async streamLegacy<
    OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
    EXPERIMENTAL_OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
  >(
    messages: MessageListInput,
    args?: AgentStreamOptions<OUTPUT, EXPERIMENTAL_OUTPUT> & { output?: OUTPUT; experimental_output?: never },
  ): Promise<StreamObjectResult<any, OUTPUT extends ZodSchema ? z.infer<OUTPUT> : unknown, any> & TracingProperties>;
  async streamLegacy<
    OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
    EXPERIMENTAL_OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
  >(
    messages: MessageListInput,
    args?: AgentStreamOptions<OUTPUT, EXPERIMENTAL_OUTPUT> & {
      output?: never;
      experimental_output?: EXPERIMENTAL_OUTPUT;
    },
  ): Promise<
    StreamTextResult<any, OUTPUT extends ZodSchema ? z.infer<OUTPUT> : unknown> & {
      partialObjectStream: StreamTextResult<
        any,
        OUTPUT extends ZodSchema
          ? z.infer<OUTPUT>
          : EXPERIMENTAL_OUTPUT extends ZodSchema
            ? z.infer<EXPERIMENTAL_OUTPUT>
            : unknown
      >['experimental_partialOutputStream'];
    }
  >;
  async streamLegacy<
    OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
    EXPERIMENTAL_OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
  >(
    messages: MessageListInput,
    streamOptions: AgentStreamOptions<OUTPUT, EXPERIMENTAL_OUTPUT> = {},
  ): Promise<
    | StreamTextResult<any, OUTPUT extends ZodSchema ? z.infer<OUTPUT> : unknown>
    | (StreamObjectResult<any, OUTPUT extends ZodSchema ? z.infer<OUTPUT> : unknown, any> & TracingProperties)
  > {
    return this.getLegacyHandler().streamLegacy(messages, streamOptions);
  }

  /**
   * Resolves the configuration for title generation.
   * @internal
   */
  resolveTitleGenerationConfig(
    generateTitleConfig:
      | boolean
      | { model: DynamicArgument<MastraModelConfig>; instructions?: DynamicArgument<string> }
      | undefined,
  ): {
    shouldGenerate: boolean;
    model?: DynamicArgument<MastraModelConfig>;
    instructions?: DynamicArgument<string>;
  } {
    if (typeof generateTitleConfig === 'boolean') {
      return { shouldGenerate: generateTitleConfig };
    }

    if (typeof generateTitleConfig === 'object' && generateTitleConfig !== null) {
      return {
        shouldGenerate: true,
        model: generateTitleConfig.model,
        instructions: generateTitleConfig.instructions,
      };
    }

    return { shouldGenerate: false };
  }

  /**
   * Resolves title generation instructions, handling both static strings and dynamic functions
   * @internal
   */
  async resolveTitleInstructions(
    requestContext: RequestContext,
    instructions?: DynamicArgument<string>,
  ): Promise<string> {
    const DEFAULT_TITLE_INSTRUCTIONS = `
      - you will generate a short title based on the first message a user begins a conversation with
      - ensure it is not more than 80 characters long
      - the title should be a summary of the user's message
      - do not use quotes or colons
      - the entire text you return will be used as the title`;

    if (!instructions) {
      return DEFAULT_TITLE_INSTRUCTIONS;
    }

    if (typeof instructions === 'string') {
      return instructions;
    } else {
      const result = instructions({ requestContext, mastra: this.#mastra });
      return resolveMaybePromise(result, resolvedInstructions => {
        return resolvedInstructions || DEFAULT_TITLE_INSTRUCTIONS;
      });
    }
  }
}
