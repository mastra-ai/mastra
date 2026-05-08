import { randomUUID } from 'node:crypto';
import type { UIMessage } from '@internal/ai-sdk-v4';
import type { ModelMessage } from '@internal/ai-sdk-v5';
import { wrapSchemaWithNullTransform } from '@mastra/schema-compat';
import type { StandardSchemaWithJSON } from '@mastra/schema-compat/schema';
import type { JSONSchema7 } from 'json-schema';
import { z } from 'zod/v4';
import type { MastraPrimitives, MastraUnion } from '../action';
import { MastraFGAPermissions } from '../auth/ee';
import type { AgentBackgroundConfig, ToolBackgroundConfig } from '../background-tasks';
import { MastraBase } from '../base';
import type { MastraBrowser } from '../browser/browser';
import type { BrowserContext } from '../browser/processor';
import { AgentChannels } from '../channels/agent-channels';
import type { ChannelConfig } from '../channels/agent-channels';
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
import type { CoreMessage } from '../llm';
import { MastraLLMV1 } from '../llm/model';
import type {
  GenerateObjectResult,
  GenerateTextResult,
  StreamObjectResult,
  StreamTextResult,
} from '../llm/model/base.types';
import { MastraLLMVNext } from '../llm/model/model.loop';
import type { ProviderOptions } from '../llm/model/provider-options';
import { ModelRouterLanguageModel } from '../llm/model/router';
import type { MastraLanguageModel, MastraLegacyLanguageModel, MastraModelConfig } from '../llm/model/shared.types';
import { RegisteredLogger } from '../logger';
import { networkLoop } from '../loop/network';
import type { Mastra } from '../mastra';
import type { VersionOverrides } from '../mastra/types';
import { mergeVersionOverrides } from '../mastra/types';
import type { MastraMemory } from '../memory/memory';
import type { MemoryConfig, MemoryConfigInternal } from '../memory/types';
import type { DefinitionSource, TracingProperties, ObservabilityContext } from '../observability';
import {
  EntityType,
  InternalSpans,
  SpanType,
  getOrCreateSpan,
  createObservabilityContext,
  resolveObservabilityContext,
} from '../observability';
import type {
  ErrorProcessorOrWorkflow,
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
import { RequestContext, MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY, MASTRA_VERSIONS_KEY } from '../request-context';
import type { InferStandardSchemaOutput } from '../schema';
import { toStandardSchema, standardSchemaToJSONSchema } from '../schema';
import { ChunkFrom } from '../stream';
import type { MastraAgentNetworkStream } from '../stream';
import type { FullOutput, MastraModelOutput } from '../stream/base/output';
import { createTool } from '../tools';
import type { ToolToConvert } from '../tools/tool-builder/builder';
import { isMastraTool, isProviderTool } from '../tools/toolchecks';
import type { CoreTool } from '../tools/types';
import type { DynamicArgument } from '../types';
import { makeCoreTool, createMastraProxy, ensureToolProperties, deepMerge } from '../utils';
import type { ToolOptions } from '../utils';
import type { MastraVoice } from '../voice';
import { DefaultVoice } from '../voice';
import { createWorkflow, createStep, isProcessor } from '../workflows';
import type { AnyWorkflow, OutputWriter, Step, WorkflowResult } from '../workflows';
import type { AnyWorkspace } from '../workspace';
import { createWorkspaceTools } from '../workspace';
import { createSkillTools } from '../workspace/skills';
import type { SkillFormat } from '../workspace/skills';
import { AgentLegacyHandler } from './agent-legacy';
import type {
  AgentExecutionOptions,
  AgentExecutionOptionsBase,
  InnerAgentExecutionOptions,
  MultiPrimitiveExecutionOptions,
  NetworkOptions,
  DelegationConfig,
  DelegationStartContext,
  DelegationCompleteContext,
} from './agent.types';
import { MessageList } from './message-list';
import type { MessageInput, MessageListInput, UIMessageWithMetadata, MastraDBMessage } from './message-list';
import { SaveQueueManager } from './save-queue';
import { runStreamUntilIdle, runResumeStreamUntilIdle } from './stream-until-idle';
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
  PublicStructuredOutputOptions,
  ModelFallbackSettings,
  ModelWithRetries,
  ZodSchema,
} from './types';
import { isSupportedLanguageModel, resolveThreadIdFromArgs, supportedLanguageModelSpecifications } from './utils';
import { createPrepareStreamWorkflow } from './workflows/prepare-stream';
import type { AgentCapabilities } from './workflows/prepare-stream/schema';

export type MastraLLM = MastraLLMV1 | MastraLLMVNext;

type ModelFallbacks = {
  id: string;
  model: DynamicArgument<MastraModelConfig>;
  maxRetries: number;
  enabled: boolean;
  modelSettings?: DynamicArgument<ModelFallbackSettings>;
  providerOptions?: DynamicArgument<ProviderOptions>;
  headers?: DynamicArgument<Record<string, string>>;
}[];

type ResolvedModelSelection = MastraModelConfig | ModelFallbacks;

function resolveMaybePromise<T, R = void>(value: T | Promise<T> | PromiseLike<T>, cb: (value: T) => R): R | Promise<R> {
  if (value instanceof Promise || (value != null && typeof (value as PromiseLike<T>).then === 'function')) {
    return Promise.resolve(value).then(cb);
  }

  return cb(value as T);
}

function hasConfiguredProcessor(
  processors: InputProcessorOrWorkflow[],
  predicate: (processor: Processor) => boolean,
): boolean {
  return processors.some(processor => {
    const maybeWorkflow = processor as {
      steps?: Record<string, unknown>;
      stepGraph?: Array<{ type: string; step?: unknown; steps?: Array<{ step?: unknown }> }>;
    };
    const isWorkflowLike = isProcessorWorkflow(processor);

    const workflowSteps = [
      ...Object.values(maybeWorkflow.steps ?? {}),
      ...(maybeWorkflow.stepGraph ?? []).flatMap(entry => {
        if (entry.type === 'step') {
          return entry.step ? [entry.step] : [];
        }
        return entry.steps?.map(stepEntry => stepEntry.step).filter(Boolean) ?? [];
      }),
    ];

    if (!isWorkflowLike || workflowSteps.length === 0) {
      const processorId =
        typeof (processor as Processor).id === 'string' && (processor as Processor).id.startsWith('processor:')
          ? (processor as Processor).id.slice('processor:'.length)
          : (processor as Processor).id;
      return predicate({
        ...(processor as Processor),
        id: processorId,
        providesSkillDiscovery: (processor as Processor).providesSkillDiscovery,
      } as Processor);
    }

    return workflowSteps.some(step => {
      if (isProcessorWorkflow(step)) {
        return hasConfiguredProcessor([step], predicate);
      }

      const stepId = typeof (step as { id?: unknown }).id === 'string' ? (step as { id: string }).id : undefined;
      if (!stepId?.startsWith('processor:')) {
        return false;
      }

      const processorId = stepId.slice('processor:'.length);
      const workflowStep = step as { providesSkillDiscovery?: Processor['providesSkillDiscovery'] };
      return predicate({
        id: processorId,
        providesSkillDiscovery: workflowStep.providesSkillDiscovery,
      } as Processor);
    });
  });
}

function hasEagerSkillsProcessor(processors: InputProcessorOrWorkflow[]): boolean {
  return hasConfiguredProcessor(processors, processor => processor.id === 'skills-processor');
}

function hasOnDemandSkillDiscoveryProcessor(processors: InputProcessorOrWorkflow[]): boolean {
  return hasConfiguredProcessor(processors, processor => processor.providesSkillDiscovery === 'on-demand');
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
  public source?: DefinitionSource;
  #instructions: DynamicArgument<AgentInstructions, TRequestContext>;
  readonly #description?: string;
  model: DynamicArgument<MastraModelConfig | ModelWithRetries[], TRequestContext> | ModelFallbacks;
  #originalModel: DynamicArgument<MastraModelConfig | ModelWithRetries[], TRequestContext> | ModelFallbacks;
  maxRetries?: number;
  #mastra?: Mastra;
  #memory?: DynamicArgument<MastraMemory, TRequestContext>;
  #skillsFormat?: SkillFormat;
  #workflows?: DynamicArgument<Record<string, AnyWorkflow>, TRequestContext>;
  #defaultGenerateOptionsLegacy: DynamicArgument<AgentGenerateOptions, TRequestContext>;
  #defaultStreamOptionsLegacy: DynamicArgument<AgentStreamOptions, TRequestContext>;
  #defaultOptions: DynamicArgument<AgentExecutionOptions<TOutput>, TRequestContext>;
  #defaultNetworkOptions: DynamicArgument<NetworkOptions, TRequestContext>;
  #tools: DynamicArgument<TTools, TRequestContext>;
  #scorers: DynamicArgument<MastraScorers, TRequestContext>;
  #agents: DynamicArgument<Record<string, Agent>, TRequestContext>;
  #voice: MastraVoice;
  #agentChannels: AgentChannels | null = null;
  #workspace?: DynamicArgument<AnyWorkspace | undefined, TRequestContext>;
  #inputProcessors?: DynamicArgument<InputProcessorOrWorkflow[], TRequestContext>;
  #outputProcessors?: DynamicArgument<OutputProcessorOrWorkflow[], TRequestContext>;
  #maxProcessorRetries?: number;
  #errorProcessors?: DynamicArgument<ErrorProcessorOrWorkflow[], TRequestContext>;
  #browser?: MastraBrowser;
  #hasExplicitBrowser = false;
  #requestContextSchema?: StandardSchemaWithJSON<TRequestContext>;
  #backgroundTasks?: AgentBackgroundConfig;
  /**
   * Tracks the active `streamUntilIdle` wrapper per `(threadId|resourceId)`
   * scope on this Agent instance. A new call for the same scope aborts the
   * prior one before subscribing so bg-task pubsub events aren't fanned into
   * two concurrent wrappers (which would forward duplicate events and
   * trigger duplicate continuation turns).
   *
   * Value is the prior wrapper's `forceClose`. Entries remove themselves on
   * close if they're still the active one.
   */
  #activeStreamUntilIdle = new Map<string, () => void>();
  readonly #options?: AgentCreateOptions;
  #legacyHandler?: AgentLegacyHandler;
  #config: AgentConfig<TAgentId, TTools, TOutput, TRequestContext>;

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

    this.#config = config;

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
        throw mastraError;
      }
      this.model = config.model.map(mdl => Agent.toFallbackEntry(mdl, config?.maxRetries ?? 0)) as ModelFallbacks;
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

    if (config.channels) {
      if (config.channels instanceof AgentChannels) {
        this.#agentChannels = config.channels;
        this.#agentChannels.__setAgent(this);
      } else if (
        'adapters' in config.channels &&
        config.channels.adapters &&
        Object.keys(config.channels.adapters).length > 0
      ) {
        // ChannelConfig with adapters — direct adapter configuration
        const channelConfig = config.channels as ChannelConfig;
        this.#agentChannels = new AgentChannels({
          ...channelConfig,
          userName: channelConfig.userName ?? config.name,
        });
        this.#agentChannels.__setAgent(this);
      }
    }

    if (config.browser) {
      // Runtime check: Agent requires SDK providers (AgentBrowser, StagehandBrowser)
      // CLI providers (BrowserViewer) should be used with Workspace instead
      if (config.browser.providerType !== 'sdk') {
        const mastraError = new MastraError({
          id: 'AGENT_INVALID_BROWSER_PROVIDER',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          details: {
            agentName: config.name,
            providerType: config.browser.providerType,
          },
          text: `Agent.browser requires an SDK provider (providerType: 'sdk'), but received '${config.browser.providerType}'. Use @mastra/agent-browser or @mastra/stagehand for Agent.browser. For CLI providers like @mastra/browser-viewer, use Workspace.browser instead.`,
        });
        this.logger.trackException(mastraError);
        throw mastraError;
      }
      this.#browser = config.browser;
      this.#hasExplicitBrowser = true;
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

    if (config.errorProcessors) {
      this.#errorProcessors = config.errorProcessors;
    }

    if (config.requestContextSchema) {
      this.#requestContextSchema = toStandardSchema(config.requestContextSchema);
    }

    if (config.backgroundTasks) {
      this.#backgroundTasks = config.backgroundTasks;
    }

    // @ts-expect-error Flag for agent network messages
    this._agentNetworkAppend = config._agentNetworkAppend || false;
  }

  getMastraInstance() {
    return this.#mastra;
  }

  /**
   * Returns the background tasks configuration for this agent.
   */
  getBackgroundTasksConfig(): AgentBackgroundConfig | undefined {
    return this.#backgroundTasks;
  }

  /**
   * Returns the statically-configured sub-agents without executing dynamic
   * resolvers. Used by Mastra at registration time to detect whether background
   * tasks should be auto-enabled. Returns undefined when sub-agents are
   * configured via a function (those get resolved per-request).
   * @internal
   */
  __getStaticAgents(): Record<string, Agent> | undefined {
    if (typeof this.#agents === 'function') return undefined;
    return this.#agents as Record<string, Agent> | undefined;
  }

  /**
   * True when this agent has any sub-agent registry configured — either a
   * static record with entries OR a dynamic (function-based) resolver.
   * Used by Mastra at registration time to decide whether to auto-enable
   * background tasks; we can't know what a function resolver will return
   * at request time, so we enable defensively.
   * @internal
   */
  __hasSubAgentsConfigured(): boolean {
    if (typeof this.#agents === 'function') return true;
    const record = this.#agents as Record<string, Agent> | undefined;
    return !!record && Object.keys(record).length > 0;
  }

  /**
   * Disables background task dispatch for this agent. Every tool call will run
   * synchronously in the agentic loop, regardless of the agent's or tools'
   * background configuration.
   *
   * Useful when this agent is invoked as a sub-agent and the parent has wrapped
   * the entire sub-agent invocation as a background task — you don't want the
   * sub-agent's own tools to also dispatch separate background tasks inside it.
   */
  disableBackgroundTasks(): void {
    this.#backgroundTasks = { ...(this.#backgroundTasks ?? {}), disabled: true };
  }

  /**
   * Re-enables background task dispatch after it has been disabled.
   */
  enableBackgroundTasks(): void {
    if (this.#backgroundTasks) {
      this.#backgroundTasks = { ...this.#backgroundTasks, disabled: false };
    }
  }

  /**
   * Inspects a sub-agent (a child agent invoked as a tool) and derives a
   * ToolBackgroundConfig if any of its tools are background-eligible OR if the
   * sub-agent itself has a background tasks config that enables tools.
   *
   * Returns undefined when no background dispatch is warranted, so the parent
   * runs the sub-agent synchronously.
   *
   * @internal
   */
  private async deriveSubAgentBackgroundConfig(
    subAgent: Agent<any, any, any, any>,
    requestContext: RequestContext,
  ): Promise<ToolBackgroundConfig | undefined> {
    try {
      const subAgentBgConfig = subAgent.getBackgroundTasksConfig?.();

      // 1. Sub-agent has its own backgroundTasks config that enables tools
      if (subAgentBgConfig?.disabled !== true && subAgentBgConfig?.tools) {
        if (subAgentBgConfig.tools === 'all') {
          return { enabled: true, waitTimeoutMs: subAgentBgConfig.waitTimeoutMs };
        }
        const hasEnabledTool = Object.values(subAgentBgConfig.tools).some(t => {
          if (typeof t === 'boolean') return t;
          return t?.enabled === true;
        });
        if (hasEnabledTool) {
          return { enabled: true, waitTimeoutMs: subAgentBgConfig.waitTimeoutMs };
        }
      }

      // 2. Any of the sub-agent's tools has background.enabled === true
      const subAgentTools = await subAgent.convertTools({ requestContext, methodType: 'generate' });
      if (subAgentTools && typeof subAgentTools === 'object') {
        for (const tool of Object.values(subAgentTools)) {
          const bg = (tool as any)?.background as ToolBackgroundConfig | undefined;
          if (bg?.enabled === true) {
            return { enabled: true, waitTimeoutMs: subAgentBgConfig?.waitTimeoutMs };
          }
        }
      }
    } catch {
      // If anything fails (e.g., dynamic tools throw), skip background derivation
    }
    return undefined;
  }

  /**
   * Returns the AgentChannels instance that manages all channel adapters.
   * Returns null if no channels are configured.
   */
  getChannels(): AgentChannels | null {
    return this.#agentChannels;
  }

  /**
   * Sets the AgentChannels instance for this agent.
   * Used by ChannelProvider implementations to inject the channels they create.
   * @internal
   */
  setChannels(agentChannels: AgentChannels): void {
    if (this.#agentChannels && this.#agentChannels !== agentChannels) {
      this.logger?.debug(`Replacing existing AgentChannels on agent "${this.name}"`);
    }
    this.#agentChannels = agentChannels;
    agentChannels.__setAgent(this);
  }

  /**
   * Returns the browser instance for this agent, if configured.
   * Browser tools are automatically added at execution time via `convertTools()`.
   * This getter is primarily used by server-side code to access browser features
   * like screencast streaming and input injection.
   */
  get browser(): MastraBrowser | undefined {
    return this.#browser;
  }

  /**
   * Sets or updates the browser instance for this agent.
   * This allows hot-swapping browser configuration without recreating the agent.
   * Browser tools will be automatically updated on the next execution.
   *
   * @param browser - The new browser instance, or undefined to disable browser tools
   */
  setBrowser(browser: MastraBrowser | undefined): void {
    this.#browser = browser;
    // Mark as explicit so workspace browser doesn't overwrite
    // Setting to undefined is also explicit (disabling browser tools)
    this.#hasExplicitBrowser = true;
  }

  /**
   * Returns true if this agent was configured with its own browser instance.
   * Used by Harness to avoid overwriting agent-level browser configuration.
   */
  hasOwnBrowser(): boolean {
    return this.#hasExplicitBrowser;
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
    const hasSkillsProcessor = hasEagerSkillsProcessor(configuredProcessors);
    const hasOnDemandProcessor = hasOnDemandSkillDiscoveryProcessor(configuredProcessors);
    if (hasSkillsProcessor || hasOnDemandProcessor) {
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
    if (this.#requestContextSchema) {
      const contextValues = requestContext?.all ?? {};
      const validation = await this.#requestContextSchema['~standard'].validate(contextValues);

      if (validation.issues) {
        const errors = validation.issues;
        const errorMessages = errors
          .map(e => {
            const pathStr = e.path?.map((p: any) => (typeof p === 'object' ? p.key : p)).join('.');
            return `- ${pathStr}: ${e.message}`;
          })
          .join('\n');
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
        ? this.#agents({ requestContext: requestContext as RequestContext<TRequestContext> })
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
    errorProcessorOverrides,
    processorStates,
  }: {
    requestContext: RequestContext;
    inputProcessorOverrides?: InputProcessorOrWorkflow[];
    outputProcessorOverrides?: OutputProcessorOrWorkflow[];
    errorProcessorOverrides?: ErrorProcessorOrWorkflow[];
    processorStates?: Map<string, ProcessorState>;
  }): Promise<ProcessorRunner> {
    // Resolve processors - overrides replace user-configured but auto-derived (memory, skills) are kept
    const inputProcessors = await this.listResolvedInputProcessors(requestContext, inputProcessorOverrides);
    const outputProcessors = await this.listResolvedOutputProcessors(requestContext, outputProcessorOverrides);
    const errorProcessors =
      errorProcessorOverrides ??
      (this.#errorProcessors
        ? typeof this.#errorProcessors === 'function'
          ? await this.#errorProcessors({ requestContext: requestContext as RequestContext<TRequestContext> })
          : this.#errorProcessors
        : []);

    return new ProcessorRunner({
      inputProcessors,
      outputProcessors,
      errorProcessors,
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
          ? await this.#outputProcessors({
              requestContext: (requestContext || new RequestContext()) as RequestContext<TRequestContext>,
            })
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
   * Resolves input processors from agent configuration in execution order.
   * @internal
   */
  private async resolveInputProcessors(
    requestContext?: RequestContext,
    configuredProcessorOverrides?: InputProcessorOrWorkflow[],
  ): Promise<InputProcessorOrWorkflow[]> {
    // Get configured input processors - use overrides if provided (from generate/stream options),
    // otherwise use agent constructor processors
    const configuredProcessors = configuredProcessorOverrides
      ? configuredProcessorOverrides
      : this.#inputProcessors
        ? typeof this.#inputProcessors === 'function'
          ? await this.#inputProcessors({
              requestContext: (requestContext || new RequestContext()) as RequestContext<TRequestContext>,
            })
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

    // Get channel input processors (with deduplication)
    const channelProcessors = this.#agentChannels ? this.#agentChannels.getInputProcessors(configuredProcessors) : [];

    // Get browser context processors (with deduplication)
    const browserProcessors = this.#browser ? this.#browser.getInputProcessors(configuredProcessors) : [];

    // Memory processors should run first (to fetch history, semantic recall, working memory)
    // Workspace instructions run after memory
    // Skills processors run after workspace
    // Channel processors run after skills (context injection for platform awareness)
    // Browser processors run after channel processors to inject browser context
    // User-configured processors run last to allow customization
    return [
      ...memoryProcessors,
      ...workspaceProcessors,
      ...skillsProcessors,
      ...channelProcessors,
      ...browserProcessors,
      ...configuredProcessors,
    ];
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
    const processors = await this.resolveInputProcessors(requestContext, configuredProcessorOverrides);
    return this.combineProcessorsIntoWorkflow(processors, `${this.id}-input-processor`);
  }

  /**
   * Resolves and returns input processors for the provider-boundary LLM request hook.
   * These processors stay uncombined because processLLMRequest runs after conversion to model prompt format.
   * @internal
   */
  private async listResolvedLLMRequestProcessors(
    requestContext?: RequestContext,
    configuredProcessorOverrides?: InputProcessorOrWorkflow[],
  ): Promise<InputProcessorOrWorkflow[]> {
    return this.resolveInputProcessors(requestContext, configuredProcessorOverrides);
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
   * Returns the error processors for this agent, resolving function-based processors if necessary.
   */
  public async listErrorProcessors(requestContext?: RequestContext): Promise<ErrorProcessorOrWorkflow[]> {
    if (!this.#errorProcessors) return [];
    return typeof this.#errorProcessors === 'function'
      ? await this.#errorProcessors({ requestContext: requestContext as RequestContext<TRequestContext> })
      : this.#errorProcessors;
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
        ? await this.#inputProcessors({ requestContext: ctx as RequestContext<TRequestContext> })
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
        ? await this.#outputProcessors({ requestContext: ctx as RequestContext<TRequestContext> })
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
        ? await this.#inputProcessors({
            requestContext: (requestContext || new RequestContext()) as RequestContext<TRequestContext>,
          })
        : this.#inputProcessors;

    return configuredProcessors;
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
        ? await this.#outputProcessors({
            requestContext: (requestContext || new RequestContext()) as RequestContext<TRequestContext>,
          })
        : this.#outputProcessors;

    return configuredProcessors;
  }

  /**
   * Returns the IDs of the raw configured input, output, and error processors,
   * without combining them into workflows. Used by the editor to clone
   * agent processor configuration to storage.
   */
  public async getConfiguredProcessorIds(
    requestContext?: RequestContext,
  ): Promise<{ inputProcessorIds: string[]; outputProcessorIds: string[]; errorProcessorIds: string[] }> {
    const ctx = requestContext || new RequestContext();

    let inputProcessorIds: string[] = [];
    if (this.#inputProcessors) {
      const processors =
        typeof this.#inputProcessors === 'function'
          ? await this.#inputProcessors({ requestContext: ctx as RequestContext<TRequestContext> })
          : this.#inputProcessors;
      inputProcessorIds = processors.map(p => p.id).filter(Boolean);
    }

    let outputProcessorIds: string[] = [];
    if (this.#outputProcessors) {
      const processors =
        typeof this.#outputProcessors === 'function'
          ? await this.#outputProcessors({ requestContext: ctx as RequestContext<TRequestContext> })
          : this.#outputProcessors;
      outputProcessorIds = processors.map(p => p.id).filter(Boolean);
    }

    let errorProcessorIds: string[] = [];
    if (this.#errorProcessors) {
      const processors =
        typeof this.#errorProcessors === 'function'
          ? await this.#errorProcessors({ requestContext: ctx as RequestContext<TRequestContext> })
          : this.#errorProcessors;
      errorProcessorIds = processors.map(p => p.id).filter(Boolean);
    }

    return { inputProcessorIds, outputProcessorIds, errorProcessorIds };
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
          ? await this.#inputProcessors({ requestContext: new RequestContext() as RequestContext<TRequestContext> })
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
          ? await this.#outputProcessors({ requestContext: new RequestContext() as RequestContext<TRequestContext> })
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
      const result = this.#memory({
        requestContext: requestContext as RequestContext<TRequestContext>,
        mastra: this.#mastra,
      });
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
        this.#setBrowserFromWorkspace(this.#workspace);
        return this.#workspace;
      }

      const result = this.#workspace({
        requestContext: requestContext as RequestContext<TRequestContext>,
        mastra: this.#mastra,
      });
      const resolvedWorkspace = await Promise.resolve(result);

      if (!resolvedWorkspace) {
        // Clear derived browser when factory returns no workspace
        if (!this.#hasExplicitBrowser) {
          this.#browser = undefined;
        }
        return undefined;
      }

      // Propagate logger to factory-resolved workspace
      resolvedWorkspace.__setLogger(this.logger);

      // Auto-register dynamically created workspace with Mastra for lookup via listWorkspaces()/getWorkspaceById()
      if (this.#mastra) {
        this.#mastra.addWorkspace(resolvedWorkspace, undefined, {
          source: 'agent',
          agentId: this.id,
          agentName: this.name,
        });
      }

      this.#setBrowserFromWorkspace(resolvedWorkspace);

      return resolvedWorkspace;
    }

    // Fall back to Mastra's global workspace
    const globalWorkspace = this.#mastra?.getWorkspace();
    if (globalWorkspace) {
      this.#setBrowserFromWorkspace(globalWorkspace);
    } else if (!this.#hasExplicitBrowser) {
      // Clear derived browser when no workspace available
      this.#browser = undefined;
    }
    return globalWorkspace;
  }

  /**
   * Sets the agent's browser from workspace if:
   * 1. Agent doesn't already have a browser configured (SDK approach)
   * 2. Workspace has a browser configured (CLI approach)
   * @internal
   */
  #setBrowserFromWorkspace(workspace: AnyWorkspace): void {
    // Skip if agent has an explicitly configured browser (SDK approach takes precedence)
    if (this.#hasExplicitBrowser) {
      return;
    }

    // Keep browser in sync with workspace per-request; clear when absent
    // This allows factory workspaces to return different browsers per request
    this.#browser = workspace.browser;
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
      workflowRecord = await Promise.resolve(
        this.#workflows({ requestContext: requestContext as RequestContext<TRequestContext>, mastra: this.#mastra }),
      );
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

    const result = this.#scorers({
      requestContext: requestContext as RequestContext<TRequestContext>,
      mastra: this.#mastra,
    });
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
        __runProcessInputStep: this.__runProcessInputStep.bind(this),
        getMostRecentUserMessage: this.getMostRecentUserMessage.bind(this),
        genTitle: this.genTitle.bind(this),
        resolveTitleGenerationConfig: this.resolveTitleGenerationConfig.bind(this),
        convertInstructionsToString: this.#convertInstructionsToString.bind(this),
        tracingPolicy: this.#options?.tracingPolicy,
        resolvedVersionId: this.toRawConfig()?.resolvedVersionId as string | undefined,
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

    const result = this.#defaultGenerateOptionsLegacy({
      requestContext: requestContext as RequestContext<TRequestContext>,
      mastra: this.#mastra,
    });
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

    const result = this.#defaultStreamOptionsLegacy({
      requestContext: requestContext as RequestContext<TRequestContext>,
      mastra: this.#mastra,
    });
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

    const result = this.#defaultOptions({
      requestContext: requestContext as RequestContext<TRequestContext>,
      mastra: this.#mastra,
    });

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

    const result = this.#defaultNetworkOptions({
      requestContext: requestContext as RequestContext<TRequestContext>,
      mastra: this.#mastra,
    });

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
        throw mastraError;
      }

      return options;
    });
  }

  /**
   * Gets the tools configured for this agent, resolving function-based tools if necessary.
   * Tools extend the agent's capabilities, allowing it to perform specific actions or access external systems.
   *
   * Note: Browser tools are NOT included here. They are added at execution time via `convertTools()`.
   *
   * @example
   * ```typescript
   * const tools = await agent.listTools();
   * console.log(Object.keys(tools)); // ['calculator', 'weather', ...]
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
    model?: DynamicArgument<MastraModelConfig, TRequestContext>;
  } = {}): MastraLLM | Promise<MastraLLM> {
    const modelSelectionPromise = model
      ? this.resolveModelSelection(
          model as DynamicArgument<MastraModelConfig | ModelWithRetries[], TRequestContext>,
          requestContext,
        )
      : this.resolveModelSelection(this.model, requestContext);

    return modelSelectionPromise.then(modelSelection => {
      const firstEnabledModel = Array.isArray(modelSelection)
        ? modelSelection.find(m => m.enabled)?.model
        : modelSelection;

      if (!firstEnabledModel) {
        const mastraError = new MastraError({
          id: 'AGENT_GET_LLM_NO_ENABLED_MODELS',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          details: { agentName: this.name },
          text: `[Agent:${this.name}] - No enabled models found in model list`,
        });
        this.logger.trackException(mastraError);
        throw mastraError;
      }

      const resolvedModel = this.resolveModelConfig(firstEnabledModel, requestContext);

      return resolveMaybePromise(resolvedModel, modelInfo => {
        let llm: MastraLLM | Promise<MastraLLM>;
        if (isSupportedLanguageModel(modelInfo)) {
          // Filter disabled entries before prepareModels so their model factories and
          // dynamic resolvers are never invoked on the streaming path. A disabled
          // entry's throwing/side-effecting factory must not break the request.
          const enabledSelection = Array.isArray(modelSelection)
            ? (modelSelection.filter(m => m.enabled) as typeof modelSelection)
            : modelSelection;

          llm = this.prepareModels(requestContext, enabledSelection).then(models => {
            return new MastraLLMVNext({
              models,
              mastra: this.#mastra,
              options: { tracingPolicy: this.#options?.tracingPolicy },
            });
          });
        } else {
          llm = new MastraLLMV1({
            model: modelInfo,
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
      throw mastraError;
    }
  }

  /**
   * Type guard to check if an array is already normalized to ModelFallbacks.
   * Used to optimize and avoid double normalization.
   * @internal
   */
  private isModelFallbacks(arr: any[]): arr is ModelFallbacks {
    if (arr.length === 0) return false;
    return arr.every(
      item =>
        typeof item.id === 'string' &&
        typeof item.model !== 'undefined' &&
        typeof item.maxRetries === 'number' &&
        typeof item.enabled === 'boolean',
    );
  }

  /**
   * Normalizes model arrays into the internal fallback shape.
   * @internal
   */
  private normalizeModelFallbacks(models: ModelWithRetries[] | ModelFallbacks): ModelFallbacks {
    if (this.isModelFallbacks(models)) {
      return models;
    }

    return models.map(m => Agent.toFallbackEntry(m, this.maxRetries ?? 0)) as ModelFallbacks;
  }

  /**
   * Builds a single normalized fallback entry from a user-supplied `ModelWithRetries`.
   * Shared by the constructor and `normalizeModelFallbacks` to keep the mapping in one place.
   * @internal
   */
  private static toFallbackEntry(mdl: ModelWithRetries, defaultMaxRetries: number): ModelFallbacks[number] {
    return {
      id: mdl.id ?? randomUUID(),
      model: mdl.model as DynamicArgument<MastraModelConfig>,
      maxRetries: mdl.maxRetries ?? defaultMaxRetries,
      enabled: mdl.enabled ?? true,
      modelSettings: mdl.modelSettings,
      providerOptions: mdl.providerOptions,
      headers: mdl.headers,
    };
  }

  /**
   * Ensures a model can participate in prepared multi-model execution.
   * @internal
   */
  private assertSupportsPreparedModels(
    model: MastraLanguageModel | MastraLegacyLanguageModel,
  ): asserts model is MastraLanguageModel {
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
      throw mastraError;
    }
  }

  /**
   * Resolves model configuration that may be a dynamic function returning a single model or array of models.
   * Supports DynamicArgument for both MastraModelConfig and ModelWithRetries[].
   * Normalizes fallback arrays while preserving single-model semantics.
   *
   * @internal
   */
  private async resolveModelSelection(
    modelConfig: DynamicArgument<MastraModelConfig | ModelWithRetries[], TRequestContext> | ModelFallbacks,
    requestContext: RequestContext,
  ): Promise<ResolvedModelSelection> {
    // If it's a dynamic function, resolve it
    if (typeof modelConfig === 'function') {
      const resolved = await modelConfig({
        requestContext: requestContext as RequestContext<TRequestContext>,
        mastra: this.#mastra,
      });

      // If function returns an array, validate and normalize it to ModelFallbacks
      if (Array.isArray(resolved)) {
        if (resolved.length === 0) {
          const mastraError = new MastraError({
            id: 'AGENT_RESOLVE_MODEL_EMPTY_ARRAY',
            domain: ErrorDomain.AGENT,
            category: ErrorCategory.USER,
            details: { agentName: this.name },
            text: `[Agent:${this.name}] - Dynamic function returned empty model array`,
          });
          this.logger.trackException(mastraError);
          throw mastraError;
        }

        return this.normalizeModelFallbacks(resolved);
      }

      return resolved;
    }

    // Already resolved - if it's a static array, check if already normalized
    if (Array.isArray(modelConfig)) {
      // Validate empty array
      if (modelConfig.length === 0) {
        const mastraError = new MastraError({
          id: 'AGENT_RESOLVE_MODEL_EMPTY_ARRAY',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          details: { agentName: this.name },
          text: `[Agent:${this.name}] - Empty model array provided`,
        });
        this.logger.trackException(mastraError);
        throw mastraError;
      }

      return this.normalizeModelFallbacks(modelConfig);
    }

    return modelConfig;
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
  }: {
    requestContext?: RequestContext;
    modelConfig?: DynamicArgument<MastraModelConfig | ModelWithRetries[], TRequestContext> | ModelFallbacks;
  } = {}): MastraLanguageModel | MastraLegacyLanguageModel | Promise<MastraLanguageModel | MastraLegacyLanguageModel> {
    return this.resolveModelSelection(modelConfig, requestContext).then(resolved => {
      if (!Array.isArray(resolved)) {
        return this.resolveModelConfig(resolved, requestContext);
      }

      const enabledModel = resolved.find(entry => entry.enabled);
      if (!enabledModel) {
        const mastraError = new MastraError({
          id: 'AGENT_GET_MODEL_MISSING_MODEL_INSTANCE',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          details: { agentName: this.name },
          text: `[Agent:${this.name}] - No enabled models found in model list`,
        });
        this.logger.trackException(mastraError);
        throw mastraError;
      }

      return this.resolveModelConfig(enabledModel.model, requestContext);
    });
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
    if (typeof this.model === 'function') {
      const resolved = await this.resolveModelSelection(this.model, requestContext);
      if (!Array.isArray(resolved)) {
        return null;
      }
      return this.prepareModels(requestContext, resolved);
    }

    // Backward compatibility: Return null for static single-model agents
    if (!Array.isArray(this.model)) {
      return null;
    }

    // Static array configuration
    return this.prepareModels(requestContext);
  }

  /**
   * Updates the agent's instructions.
   * @internal
   */
  __updateInstructions(newInstructions: DynamicArgument<AgentInstructions, any>) {
    this.#instructions = newInstructions as DynamicArgument<AgentInstructions, TRequestContext>;
  }

  /**
   * Updates the agent's model configuration.
   * @internal
   */
  __updateModel({ model }: { model: DynamicArgument<MastraModelConfig, TRequestContext> | ModelFallbacks }) {
    this.model = model as DynamicArgument<MastraModelConfig | ModelWithRetries[], TRequestContext> | ModelFallbacks;
    this.logger.debug(`[Agents:${this.name}] Model updated.`, { model: this.model, name: this.name });
  }

  /**
   * Resets the agent's model to the original model set during construction.
   * Clones arrays to prevent reordering mutations from affecting the original snapshot.
   * @internal
   */
  __resetToOriginalModel() {
    this.model = Array.isArray(this.#originalModel) ? [...this.#originalModel] : this.#originalModel;
  }

  /**
   * Returns a snapshot of the raw field values that may be overridden by stored config.
   * Used by the editor to save/restore code defaults externally.
   * @internal
   */
  __getOverridableFields() {
    return {
      instructions: this.#instructions,
      model: this.model,
      tools: this.#tools,
      workspace: this.#workspace,
    };
  }

  reorderModels(modelIds: string[]) {
    if (!Array.isArray(this.model)) {
      this.logger.warn('Model is not an array', { agent: this.name });
      return;
    }

    // TypeScript sees this.model as ModelWithRetries[] | ModelFallbacks after Array.isArray check.
    // At runtime, arrays are always normalized to ModelFallbacks (with required id) in the constructor.
    // The cast tells TypeScript to trust this runtime invariant.
    this.model = (this.model as ModelFallbacks).sort((a, b) => {
      const aIndex = modelIds.indexOf(a.id);
      const bIndex = modelIds.indexOf(b.id);
      const aPos = aIndex === -1 ? Infinity : aIndex;
      const bPos = bIndex === -1 ? Infinity : bIndex;
      return aPos - bPos;
    });
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
      this.logger.warn('Model is not an array', { agent: this.name });
      return;
    }

    // TypeScript sees this.model as ModelWithRetries[] | ModelFallbacks after Array.isArray check.
    // At runtime, arrays are always normalized to ModelFallbacks (with required id) in the constructor.
    // The cast tells TypeScript to trust this runtime invariant.
    const modelArray = this.model as ModelFallbacks;
    const modelToUpdate = modelArray.find(m => m.id === id);
    if (!modelToUpdate) {
      this.logger.warn('Model not found', { agent: this.name, modelId: id });
      return;
    }

    this.model = modelArray.map(mdl => {
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
  __setTools(tools: DynamicArgument<TTools, any>) {
    this.#tools = tools as DynamicArgument<TTools, TRequestContext>;
  }

  /**
   * Create a lightweight clone of this agent that can be independently mutated
   * without affecting the original instance. Used by the editor to apply
   * version overrides without mutating the singleton agent.
   * @internal
   */
  __fork(): Agent<TAgentId, TTools, TOutput, TRequestContext> {
    const fork = new Agent<TAgentId, TTools, TOutput, TRequestContext>({
      ...this.#config,
      rawConfig: this.toRawConfig(),
    });

    // Preserve runtime state that may have been set after construction
    // (e.g. when Mastra registers agents via __registerMastra / __registerPrimitives).
    // Assign fields directly to avoid re-triggering tool/processor registration
    // side effects that __registerMastra would cause.
    if (this.#mastra && !this.#config.mastra) {
      fork.#mastra = this.#mastra;
    }
    if (this.#primitives) {
      fork.#primitives = this.#primitives;
    }

    fork.source = this.source;
    fork._agentNetworkAppend = this._agentNetworkAppend;

    return fork;
  }

  /**
   * Extract plain text lines from a single message's parts array.
   * Modeled after observational memory's formatObserverMessage — switches on
   * part type, emits role-prefixed text, and drops all metadata.
   */
  private formatMessagePartsForTitle(parts: Array<{ type: string; [key: string]: any }>, role: string): string[] {
    const lines: string[] = [];
    for (const part of parts) {
      if (part.type === 'text') {
        lines.push(`${role}: ${part.text}`);
      } else if (part.type === 'tool-invocation') {
        const inv = part.toolInvocation;
        if (inv.state === 'result') {
          const resultStr = typeof inv.result === 'string' ? inv.result : JSON.stringify(inv.result);
          lines.push(`Tool Result ${inv.toolName}: ${resultStr.slice(0, 200)}`);
        } else {
          lines.push(`Tool Call ${inv.toolName}: ${JSON.stringify(inv.args).slice(0, 200)}`);
        }
      } else if (part.type === 'reasoning') {
        if (part.reasoning) {
          lines.push(`Reasoning: ${part.reasoning}`);
        }
      } else if (part.type === 'source-url') {
        lines.push(`${role}: User added URL: ${part.url.substring(0, 100)}`);
      } else if (part.type === 'file') {
        lines.push(`${role}: User added ${part.mediaType} file: ${part.url.slice(0, 100)}`);
      }
    }
    return lines;
  }

  /**
   * Format an array of UI messages into plain text for title generation.
   * Like observational memory's formatMessagesForObserver — loops over messages,
   * formats each one's parts with role context, and joins the results.
   */
  formatMessagesForTitle(
    messages: Array<{ role: string; content?: string; parts?: Array<{ type: string; [key: string]: any }> }>,
  ): string {
    const lines: string[] = [];
    for (const msg of messages) {
      const role = msg.role.charAt(0).toUpperCase() + msg.role.slice(1);
      if (typeof msg.content === 'string' && msg.content) {
        lines.push(`${role}: ${msg.content}`);
      }
      if (msg.parts && Array.isArray(msg.parts) && msg.parts.length > 0) {
        lines.push(...this.formatMessagePartsForTitle(msg.parts, role));
      }
    }
    return lines.join('\n');
  }

  async generateTitleFromUserMessage({
    message,
    messages,
    requestContext = new RequestContext(),
    model,
    instructions,
    ...rest
  }: {
    message?: string | MessageInput;
    messages?: Array<{ role: string; content?: string; parts?: Array<{ type: string; [key: string]: any }> }>;
    requestContext?: RequestContext;
    model?: DynamicArgument<MastraModelConfig, TRequestContext>;
    instructions?: DynamicArgument<string>;
  } & Partial<ObservabilityContext>) {
    const observabilityContext = resolveObservabilityContext(rest);
    // need to use text, not object output or it will error for models that don't support structured output (eg Deepseek R1)
    const llm = await this.getLLM({ requestContext, model });

    let userContent: string;

    if (messages && messages.length > 0) {
      // Multi-message path: format all messages with roles
      userContent = this.formatMessagesForTitle(messages);
    } else if (message) {
      // Single message path (backward compat): normalize and format
      const normMessage = new MessageList().add(message, 'user').get.all.aiV5.ui().at(-1);
      if (!normMessage) {
        throw new Error(`Could not generate title from input ${JSON.stringify(message)}`);
      }
      userContent = this.formatMessagesForTitle([normMessage]);
    } else {
      throw new Error('Either message or messages must be provided');
    }

    if (!userContent) {
      return undefined;
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
              content: userContent,
            },
          ],
          'input',
        );
      const result = (llm as MastraLLMVNext).stream({
        methodType: 'generate',
        requestContext,
        ...observabilityContext,
        messageList,
        agentId: this.id,
        agentName: this.name,
      });

      text = await result.text;
    } else {
      const result = await (llm as MastraLLMV1).__text({
        requestContext,
        ...observabilityContext,
        messages: [
          {
            role: 'system',
            content: systemInstructions,
          },
          {
            role: 'user',
            content: userContent,
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
    observabilityContext: ObservabilityContext,
    model?: DynamicArgument<MastraModelConfig, TRequestContext>,
    instructions?: DynamicArgument<string>,
    uiMessages?: Array<{ role: string; content?: string; parts?: Array<{ type: string; [key: string]: any }> }>,
  ) {
    try {
      if (uiMessages && uiMessages.length > 0) {
        return await this.generateTitleFromUserMessage({
          messages: uiMessages,
          requestContext,
          ...observabilityContext,
          model,
          instructions,
        });
      }
      if (userMessage) {
        const normMessage = new MessageList().add(userMessage, 'user').get.all.ui().at(-1);
        if (normMessage) {
          return await this.generateTitleFromUserMessage({
            message: normMessage,
            requestContext,
            ...observabilityContext,
            model,
            instructions,
          });
        }
      }
      // If no user message, return undefined so existing title is preserved
      return undefined;
    } catch (e) {
      this.logger.error('Error generating title', { agent: this.name, error: e });
      // Return undefined on error so existing title is preserved
      return undefined;
    }
  }

  public __setMemory(memory: DynamicArgument<MastraMemory, TRequestContext>) {
    this.#memory = memory;
  }

  public __setWorkspace(workspace: DynamicArgument<AnyWorkspace | undefined, TRequestContext>) {
    this.#workspace = workspace;
    if (this.#mastra && workspace && typeof workspace !== 'function') {
      workspace.__setLogger(this.logger);
      this.#mastra.addWorkspace(workspace, undefined, {
        source: 'agent',
        agentId: this.id,
        agentName: this.name,
      });
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
    mastraProxy,
    memoryConfig,
    autoResumeSuspendedTools,
    backgroundTaskEnabled,
    ...rest
  }: {
    runId?: string;
    resourceId?: string;
    threadId?: string;
    requestContext: RequestContext;
    mastraProxy?: MastraUnion;
    memoryConfig?: MemoryConfigInternal;
    autoResumeSuspendedTools?: boolean;
    backgroundTaskEnabled?: boolean;
  } & Partial<ObservabilityContext>) {
    const observabilityContext = resolveObservabilityContext(rest);
    let convertedMemoryTools: Record<string, CoreTool> = {};

    if (this._agentNetworkAppend) {
      this.logger.debug('Skipping memory tools (agent network context)', { agent: this.name, runId });
      return convertedMemoryTools;
    }

    // Get memory tools if available
    const memory = await this.getMemory({ requestContext });

    // Skip memory tools if there's no usable context — thread-scoped needs threadId, resource-scoped needs resourceId
    if (!threadId && !resourceId) {
      this.logger.debug('Skipping memory tools (no thread or resource context)', { agent: this.name, runId });
      return convertedMemoryTools;
    }

    const memoryTools = memory?.listTools?.(memoryConfig);

    if (memoryTools) {
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
          agentId: this.id,
          requestContext,
          ...observabilityContext,
          model: await this.getModel({ requestContext }),
          tracingPolicy: this.#options?.tracingPolicy,
          requireApproval: (toolObj as any).requireApproval,
          backgroundConfig: (toolObj as any).background,
        };
        const convertedToCoreTool = makeCoreTool(
          toolObj,
          options,
          undefined,
          autoResumeSuspendedTools,
          backgroundTaskEnabled,
        );
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
    mastraProxy,
    autoResumeSuspendedTools,
    backgroundTaskEnabled,
    ...rest
  }: {
    runId?: string;
    resourceId?: string;
    threadId?: string;
    requestContext: RequestContext;
    mastraProxy?: MastraUnion;
    autoResumeSuspendedTools?: boolean;
    backgroundTaskEnabled?: boolean;
  } & Partial<ObservabilityContext>) {
    const observabilityContext = resolveObservabilityContext(rest);
    let convertedWorkspaceTools: Record<string, CoreTool> = {};

    if (this._agentNetworkAppend) {
      this.logger.debug('Skipping workspace tools (agent network context)', { agent: this.name, runId });
      return convertedWorkspaceTools;
    }

    // Get workspace tools if available
    const workspace = await this.getWorkspace({ requestContext });

    if (!workspace) {
      return convertedWorkspaceTools;
    }

    const workspaceTools = await createWorkspaceTools(workspace, {
      requestContext: requestContext ? Object.fromEntries(requestContext.entries()) : {},
      workspace,
    });

    if (Object.keys(workspaceTools).length > 0) {
      this.logger.debug('Adding workspace tools', { agent: this.name, tools: Object.keys(workspaceTools), runId });

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
          agentId: this.id,
          requestContext,
          ...observabilityContext,
          model: await this.getModel({ requestContext }),
          tracingPolicy: this.#options?.tracingPolicy,
          requireApproval: (toolObj as any).requireApproval,
          backgroundConfig: (toolObj as any).background,
          workspace,
        };
        const convertedToCoreTool = makeCoreTool(
          toolObj,
          options,
          undefined,
          autoResumeSuspendedTools,
          backgroundTaskEnabled,
        );
        convertedWorkspaceTools[toolName] = convertedToCoreTool;
      }
    }

    return convertedWorkspaceTools;
  }

  /**
   * Returns tools provided by the agent's channels (e.g. discord_send_message).
   * @internal
   */
  private async listChannelTools({
    runId,
    resourceId,
    threadId,
    requestContext,
    mastraProxy,
    autoResumeSuspendedTools,
    backgroundTaskEnabled,
    ...rest
  }: {
    runId?: string;
    resourceId?: string;
    threadId?: string;
    requestContext: RequestContext;
    mastraProxy?: MastraUnion;
    autoResumeSuspendedTools?: boolean;
    backgroundTaskEnabled?: boolean;
  } & Partial<ObservabilityContext>) {
    const observabilityContext = resolveObservabilityContext(rest);
    const convertedChannelTools: Record<string, CoreTool> = {};

    if (!this.#agentChannels) {
      return convertedChannelTools;
    }

    const channelTools = this.#agentChannels.getTools();

    if (Object.keys(channelTools).length > 0) {
      const memory = await this.getMemory({ requestContext });

      for (const [toolName, tool] of Object.entries(channelTools)) {
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
          ...observabilityContext,
          tracingPolicy: this.#options?.tracingPolicy,
        };
        convertedChannelTools[toolName] = makeCoreTool(
          tool as ToolToConvert,
          options,
          undefined,
          autoResumeSuspendedTools,
          backgroundTaskEnabled,
        );
      }
    }

    return convertedChannelTools;
  }

  /**
   * Returns skill tools (skill, skill_search, skill_read) when the workspace
   * has skills configured. These are added at the Agent level (like workspace
   * tools) rather than inside a processor, so they persist across turns and
   * survive serialization across tool-approval pauses.
   * @internal
   */
  private async listSkillTools({
    runId,
    resourceId,
    threadId,
    requestContext,
    mastraProxy,
    autoResumeSuspendedTools,
    backgroundTaskEnabled,
    suppressEagerSkillTools,
    ...rest
  }: {
    runId?: string;
    resourceId?: string;
    threadId?: string;
    requestContext: RequestContext;
    mastraProxy?: MastraUnion;
    autoResumeSuspendedTools?: boolean;
    backgroundTaskEnabled?: boolean;
    suppressEagerSkillTools: boolean;
  } & Partial<ObservabilityContext>) {
    const observabilityContext = resolveObservabilityContext(rest);
    let convertedSkillTools: Record<string, CoreTool> = {};

    if (this._agentNetworkAppend) {
      return convertedSkillTools;
    }

    const workspace = await this.getWorkspace({ requestContext });
    if (!workspace?.skills) {
      return convertedSkillTools;
    }

    const skillTools = createSkillTools(workspace.skills);

    if (Object.keys(skillTools).length > 0) {
      this.logger.debug('Adding skill tools', { agent: this.name, tools: Object.keys(skillTools), runId });

      for (const [toolName, tool] of Object.entries(skillTools)) {
        if (suppressEagerSkillTools && (toolName === 'skill' || toolName === 'skill_search')) {
          continue;
        }
        const toolObj = tool;
        const options: ToolOptions = {
          name: toolName,
          runId,
          threadId,
          resourceId,
          logger: this.logger,
          mastra: mastraProxy as MastraUnion | undefined,
          agentName: this.name,
          agentId: this.id,
          requestContext,
          ...observabilityContext,
          model: await this.getModel({ requestContext }),
          tracingPolicy: this.#options?.tracingPolicy,
          requireApproval: false, // Skill tools never require approval
          backgroundConfig: (toolObj as any).background,
          workspace,
        };
        const convertedToCoreTool = makeCoreTool(
          toolObj,
          options,
          undefined,
          autoResumeSuspendedTools,
          backgroundTaskEnabled,
        );
        convertedSkillTools[toolName] = convertedToCoreTool;
      }
    }

    return convertedSkillTools;
  }

  /**
   * Lists browser tools if a browser is configured.
   * @internal
   */
  private async listBrowserTools({
    runId,
    resourceId,
    threadId,
    requestContext,
    autoResumeSuspendedTools,
    backgroundTaskEnabled,
    ...rest
  }: {
    runId?: string;
    resourceId?: string;
    threadId?: string;
    requestContext: RequestContext;
    autoResumeSuspendedTools?: boolean;
    backgroundTaskEnabled?: boolean;
  } & Partial<ObservabilityContext>) {
    const observabilityContext = resolveObservabilityContext(rest);
    let convertedBrowserTools: Record<string, CoreTool> = {};

    if (this._agentNetworkAppend) {
      return convertedBrowserTools;
    }

    // Check if browser is configured
    if (!this.#browser) {
      return convertedBrowserTools;
    }

    // Get browser tools from the provider
    const browserTools = this.#browser.getTools();

    if (Object.keys(browserTools).length > 0) {
      this.logger.debug(`[Agent:${this.name}] - Adding browser tools: ${Object.keys(browserTools).join(', ')}`, {
        runId,
      });

      for (const [toolName, tool] of Object.entries(browserTools)) {
        const toolObj = tool;
        const options: ToolOptions = {
          name: toolName,
          runId,
          threadId,
          resourceId,
          logger: this.logger,
          mastra: undefined,
          agentName: this.name,
          agentId: this.id,
          requestContext,
          ...observabilityContext,
          model: await this.getModel({ requestContext }),
          tracingPolicy: this.#options?.tracingPolicy,
          requireApproval: (toolObj as any).requireApproval,
          backgroundConfig: (toolObj as any).background,
        };
        const convertedToCoreTool = makeCoreTool(
          toolObj,
          options,
          undefined,
          autoResumeSuspendedTools,
          backgroundTaskEnabled,
        );
        convertedBrowserTools[toolName] = convertedToCoreTool;
      }
    }

    return convertedBrowserTools;
  }

  /**
   * Executes input processors on the message list before LLM processing.
   * @internal
   */
  private async __runInputProcessors({
    requestContext,
    messageList,
    inputProcessorOverrides,
    processorStates,
    ...observabilityContext
  }: {
    requestContext: RequestContext;
    messageList: MessageList;
    inputProcessorOverrides?: InputProcessorOrWorkflow[];
    processorStates?: Map<string, ProcessorState>;
  } & ObservabilityContext): Promise<{
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
      this.#mastra?.getWorkspace() ||
      this.#browser ||
      this.#agentChannels
    ) {
      const runner = await this.getProcessorRunner({
        requestContext,
        inputProcessorOverrides,
        processorStates,
      });
      try {
        messageList = await runner.runInputProcessors(messageList, observabilityContext, requestContext, 0);
      } catch (error) {
        if (error instanceof TripWire) {
          tripwire = {
            reason: error.message,
            retry: error.options?.retry,
            metadata: error.options?.metadata,
            processorId: error.processorId,
          };
          this.logger.warn('Input processor tripwire triggered', {
            agent: this.name,
            reason: error.message,
            processorId: error.processorId,
            retry: error.options?.retry,
          });
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
   * Runs processInputStep phase on input processors.
   * Used by legacy path to execute per-step input processing (e.g., Observational Memory)
   * that would otherwise only run in the v5 agentic loop.
   * @internal
   */
  private async __runProcessInputStep(
    args: Partial<ObservabilityContext> & {
      requestContext: RequestContext;
      messageList: MessageList;
      stepNumber?: number;
      inputProcessorOverrides?: InputProcessorOrWorkflow[];
      processorStates?: Map<string, ProcessorState>;
      tools?: Record<string, CoreTool>;
      runId?: string;
      threadId?: string;
      resourceId?: string;
      outputWriter?: OutputWriter;
      autoResumeSuspendedTools?: boolean;
      backgroundTaskEnabled?: boolean;
    },
  ): Promise<{
    messageList: MessageList;
    tools?: Record<string, CoreTool>;
    tripwire?: {
      reason: string;
      retry?: boolean;
      metadata?: unknown;
      processorId?: string;
    };
  }> {
    const {
      requestContext,
      messageList,
      stepNumber = 0,
      inputProcessorOverrides,
      processorStates,
      tools,
      runId,
      threadId,
      resourceId,
      outputWriter,
      autoResumeSuspendedTools,
      backgroundTaskEnabled,
      ...rest
    } = args;
    const observabilityContext = resolveObservabilityContext(rest);

    let tripwire: { reason: string; retry?: boolean; metadata?: unknown; processorId?: string } | undefined;
    let nextTools = tools;

    if (inputProcessorOverrides?.length || this.#inputProcessors || this.#memory) {
      const runner = await this.getProcessorRunner({
        requestContext,
        inputProcessorOverrides,
        processorStates,
      });
      try {
        const llm = await this.getLLM({ requestContext });
        const model = llm.getModel();
        const result = await runner.runProcessInputStep({
          messageList,
          stepNumber,
          steps: [],
          ...observabilityContext,
          requestContext,
          // Cast needed: legacy v1 models return LanguageModelV1 which doesn't satisfy MastraLanguageModel.
          // OM's processInputStep doesn't use the model parameter, so this is safe.
          model: model as MastraLanguageModel,
          tools,
          retryCount: 0,
        });
        if (result.tools) {
          const workspace = await this.getWorkspace({ requestContext });
          const memory = await this.getMemory({ requestContext });
          const mastraProxy = this.#mastra
            ? createMastraProxy({ mastra: this.#mastra, logger: this.logger })
            : undefined;
          const convertedTools: Record<string, CoreTool> = {};

          for (const [name, tool] of Object.entries(result.tools)) {
            if (isMastraTool(tool) || isProviderTool(tool)) {
              convertedTools[name] = makeCoreTool(
                tool as unknown as ToolToConvert,
                {
                  name,
                  runId,
                  threadId,
                  resourceId,
                  logger: this.logger,
                  mastra: mastraProxy as MastraUnion | undefined,
                  memory,
                  agentName: this.name,
                  agentId: this.id,
                  requestContext,
                  ...observabilityContext,
                  model: await this.getModel({ requestContext }),
                  outputWriter,
                  tracingPolicy: this.#options?.tracingPolicy,
                  requireApproval: (tool as any).requireApproval,
                  backgroundConfig: (tool as any).background,
                  workspace,
                },
                undefined,
                autoResumeSuspendedTools,
                backgroundTaskEnabled,
              );
            } else {
              convertedTools[name] = tool as CoreTool;
            }
          }

          nextTools = convertedTools;
        }
      } catch (error) {
        if (error instanceof TripWire) {
          tripwire = {
            reason: error.message,
            retry: error.options?.retry,
            metadata: error.options?.metadata,
            processorId: error.processorId,
          };
          this.logger.warn('Input step processor tripwire triggered', {
            agent: this.name,
            reason: error.message,
            processorId: error.processorId,
            retry: error.options?.retry,
          });
        } else {
          throw new MastraError(
            {
              id: 'AGENT_INPUT_STEP_PROCESSOR_ERROR',
              domain: ErrorDomain.AGENT,
              category: ErrorCategory.USER,
              text: `[Agent:${this.name}] - Input step processor error`,
            },
            error,
          );
        }
      }
    }

    return {
      messageList,
      tools: nextTools,
      tripwire,
    };
  }

  /**
   * Executes output processors on the message list after LLM processing.
   * @internal
   */
  private async __runOutputProcessors({
    requestContext,
    messageList,
    outputProcessorOverrides,
    ...observabilityContext
  }: {
    requestContext: RequestContext;
    messageList: MessageList;
    outputProcessorOverrides?: OutputProcessorOrWorkflow[];
  } & ObservabilityContext): Promise<{
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
        messageList = await runner.runOutputProcessors(messageList, observabilityContext, requestContext);
      } catch (e) {
        if (e instanceof TripWire) {
          tripwire = {
            reason: e.message,
            retry: e.options?.retry,
            metadata: e.options?.metadata,
            processorId: e.processorId,
          };
          this.logger.warn('Output processor tripwire triggered', {
            agent: this.name,
            reason: e.message,
            processorId: e.processorId,
            retry: e.options?.retry,
          });
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
    memoryConfig?: MemoryConfigInternal;
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
      // When lastMessages is false (disabled), don't pass perPage so recall()
      // can detect the disabled state from config and return empty history.
      // When lastMessages is a number, pass it as perPage to limit results.
      ...(typeof threadConfig.lastMessages === 'number' ? { perPage: threadConfig.lastMessages } : {}),
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
    mastraProxy,
    outputWriter,
    autoResumeSuspendedTools,
    backgroundTaskEnabled,
    ...rest
  }: {
    runId?: string;
    resourceId?: string;
    threadId?: string;
    requestContext: RequestContext;
    mastraProxy?: MastraUnion;
    outputWriter?: OutputWriter;
    autoResumeSuspendedTools?: boolean;
    backgroundTaskEnabled?: boolean;
  } & Partial<ObservabilityContext>) {
    const observabilityContext = resolveObservabilityContext(rest);
    let toolsForRequest: Record<string, CoreTool> = {};

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
          agentId: this.id,
          requestContext,
          ...observabilityContext,
          model: await this.getModel({ requestContext }),
          outputWriter,
          tracingPolicy: this.#options?.tracingPolicy,
          requireApproval: (tool as any).requireApproval,
          backgroundConfig: (tool as any).background,
        };
        return [k, makeCoreTool(tool, options, undefined, autoResumeSuspendedTools, backgroundTaskEnabled)];
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
    mastraProxy,
    autoResumeSuspendedTools,
    backgroundTaskEnabled,
    ...rest
  }: {
    runId?: string;
    threadId?: string;
    resourceId?: string;
    toolsets: ToolsetsInput;
    requestContext: RequestContext;
    mastraProxy?: MastraUnion;
    autoResumeSuspendedTools?: boolean;
    backgroundTaskEnabled?: boolean;
  } & Partial<ObservabilityContext>) {
    const observabilityContext = resolveObservabilityContext(rest);
    let toolsForRequest: Record<string, CoreTool> = {};

    const memory = await this.getMemory({ requestContext });
    const toolsFromToolsets = Object.values(toolsets || {});

    if (toolsFromToolsets.length > 0) {
      this.logger.debug('Adding tools from toolsets', {
        agent: this.name,
        toolsets: Object.keys(toolsets || {}),
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
            agentId: this.id,
            requestContext,
            ...observabilityContext,
            model: await this.getModel({ requestContext }),
            tracingPolicy: this.#options?.tracingPolicy,
            requireApproval: (toolObj as any).requireApproval,
            backgroundConfig: (toolObj as any).background,
          };
          const convertedToCoreTool = makeCoreTool(
            toolObj,
            options,
            'toolset',
            autoResumeSuspendedTools,
            backgroundTaskEnabled,
          );
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
    mastraProxy,
    clientTools,
    autoResumeSuspendedTools,
    backgroundTaskEnabled,
    ...rest
  }: {
    runId?: string;
    threadId?: string;
    resourceId?: string;
    requestContext: RequestContext;
    mastraProxy?: MastraUnion;
    clientTools?: ToolsInput;
    autoResumeSuspendedTools?: boolean;
    backgroundTaskEnabled?: boolean;
  } & Partial<ObservabilityContext>) {
    const observabilityContext = resolveObservabilityContext(rest);
    let toolsForRequest: Record<string, CoreTool> = {};
    const memory = await this.getMemory({ requestContext });
    // Convert client tools
    const clientToolsForInput = Object.entries(clientTools || {});
    if (clientToolsForInput.length > 0) {
      this.logger.debug('Adding client tools', { agent: this.name, tools: Object.keys(clientTools || {}), runId });
      for (const [toolName, tool] of clientToolsForInput) {
        const { execute, ...toolRest } = tool;
        const toolToConvert = isProviderTool(tool) ? tool : toolRest;
        const options: ToolOptions = {
          name: toolName,
          runId,
          threadId,
          resourceId,
          logger: this.logger,
          mastra: mastraProxy as MastraUnion | undefined,
          memory,
          agentName: this.name,
          agentId: this.id,
          requestContext,
          ...observabilityContext,
          model: await this.getModel({ requestContext }),
          tracingPolicy: this.#options?.tracingPolicy,
          requireApproval: (tool as any).requireApproval,
          backgroundConfig: (tool as any).background,
        };
        const convertedToCoreTool = makeCoreTool(
          toolToConvert,
          options,
          'client-tool',
          autoResumeSuspendedTools,
          backgroundTaskEnabled,
        );
        toolsForRequest[toolName] = convertedToCoreTool;
      }
    }

    return toolsForRequest;
  }

  /**
   * Strips tool parts from messages.
   *
   * When a supervisor delegates to a sub-agent, the parent's conversation
   * history may include tool_call parts for its own delegation tools
   * (agent-* and workflow-*) and other tools. The sub-agent doesn't have these tools,
   * so sending references to them causes model providers to reject or
   * mishandle the request.
   *
   * This function removes those parts while preserving all other
   * conversation context (user messages, assistant text, etc.).
   * @internal
   */
  private stripParentToolParts(messages: MastraDBMessage[]): MastraDBMessage[] {
    return messages
      .map(message => {
        if (message.role === 'assistant') {
          const content = message.content;
          const parts = Array.isArray(content) ? content : content?.parts;
          if (!Array.isArray(parts)) return message;
          const filtered = parts.filter((part: any) => part?.type !== 'tool-call');
          if (filtered.length === 0) return null;
          if (Array.isArray(content)) {
            return { ...message, content: filtered };
          }
          return { ...message, content: { ...content, parts: filtered } };
        }

        if ((message as any).role === 'tool') {
          return null;
        }

        return message;
      })
      .filter((message): message is MastraDBMessage => Boolean(message));
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
    methodType,
    autoResumeSuspendedTools,
    delegation,
    backgroundTaskEnabled,
    ...rest
  }: {
    runId?: string;
    threadId?: string;
    resourceId?: string;
    requestContext: RequestContext;
    methodType: AgentMethodType;
    autoResumeSuspendedTools?: boolean;
    delegation?: DelegationConfig;
    backgroundTaskEnabled?: boolean;
  } & Partial<ObservabilityContext>) {
    const observabilityContext = resolveObservabilityContext(rest);
    const convertedAgentTools: Record<string, CoreTool> = {};
    const agents = await this.listAgents({ requestContext });

    if (Object.keys(agents).length > 0) {
      for (const [agentName, agent] of Object.entries(agents)) {
        const agentInputSchema = z.object({
          prompt: z.string().describe('The prompt to send to the agent'),
          // Using .nullish() instead of .optional() because OpenAI sends null for unfilled optional fields
          threadId: z.string().nullish().describe('Thread ID for conversation continuity for memory messages'),
          resourceId: z.string().nullish().describe('Resource/user identifier for memory messages'),
          instructions: z
            .string()
            .nullish()
            .describe(
              'Additional instructions to append to the agent instructions. Only provide if you have specific guidance beyond what the agent already knows. Leave empty in most cases.',
            ),
          maxSteps: z.number().min(3).nullish().describe('Maximum number of execution steps for the sub-agent'),
          // using minimum of 3 to ensure if the agent has a tool call, the llm gets executed again after the tool call step, using the tool call result
          // to return a proper llm response
        });

        const agentOutputSchema = z.object({
          text: z.string().describe('The response from the agent'),
          subAgentThreadId: z.string().describe('The thread ID of the agent').optional(),
          subAgentResourceId: z.string().describe('The resource ID of the agent').optional(),
          subAgentToolResults: z
            .array(
              z.object({
                toolName: z.string().describe('The name of the tool'),
                toolCallId: z.string().describe('The ID of the tool call'),
                result: z.unknown().describe('The result of the tool call'),
                args: z.unknown().describe('The arguments of the tool call').optional(),
                isError: z.boolean().describe('Whether the tool call resulted in an error').optional(),
              }),
            )
            .describe("The results from the agent's tool calls")
            .optional(),
        });

        const toModelOutput = delegation?.includeSubAgentToolResultsInModelContext
          ? undefined
          : (output: z.infer<typeof agentOutputSchema>) => ({
              type: 'text' as const,
              value: output.text,
            });

        const toolObj = createTool({
          id: `agent-${agentName}`,
          description: agent.getDescription() || `Agent: ${agentName}`,
          inputSchema: agentInputSchema,
          outputSchema: agentOutputSchema,
          mastra: this.#mastra,
          ...(toModelOutput ? { toModelOutput } : {}),
          // manually wrap agent tools with tracing, so that we can pass the
          // current tool span onto the agent to maintain continuity of the trace
          execute: async (inputData: z.infer<typeof agentInputSchema>, context) => {
            const startTime = Date.now();
            const toolCallId = context?.agent?.toolCallId || randomUUID();

            // Get messages from context - available at tool execution time
            const contextMessages = (context?.agent?.messages || []) as MastraDBMessage[];

            // Strip tool call/result parts from the context.
            const sanitizedMessages = this.stripParentToolParts(contextMessages);

            let fullSubAgentMessages: MastraDBMessage[] = sanitizedMessages;

            // Derive iteration from the number of assistant messages (rough approximation)
            // Each iteration typically produces an assistant message
            const derivedIteration = Math.max(1, sanitizedMessages.filter(m => m.role === 'assistant').length);

            // Build delegation start context
            const delegationStartContext: DelegationStartContext = {
              primitiveId: agent.id,
              primitiveType: 'agent',
              prompt: inputData.prompt,
              params: {
                threadId: inputData.threadId || undefined,
                resourceId: inputData.resourceId || undefined,
                instructions: inputData.instructions || undefined,
                maxSteps: inputData.maxSteps || undefined,
              },
              iteration: derivedIteration,
              runId: runId || randomUUID(),
              threadId,
              resourceId,
              parentAgentId: this.id,
              parentAgentName: this.name,
              toolCallId,
              messages: sanitizedMessages,
            };

            // Generate sub-agent thread and resource IDs early (before any rejection)
            // These are needed for both successful execution and rejection cases
            const slugify = await import(`@sindresorhus/slugify`);
            const subAgentThreadId = inputData.threadId
              ? `${inputData.threadId}-${randomUUID()}`
              : context?.mastra?.generateId({
                  idType: 'thread',
                  source: 'agent',
                  entityId: agentName,
                  resourceId,
                }) || randomUUID();

            const subAgentResourceId = inputData.resourceId
              ? `${inputData.resourceId}-${agentName}`
              : context?.mastra?.generateId({
                  idType: 'generic',
                  source: 'agent',
                  entityId: agentName,
                }) || `${slugify.default(this.id)}-${agentName}`;

            // Save the parent agent's MastraMemory before the sub-agent runs.
            // The sub-agent's prepare-memory-step will overwrite this key with
            // its own thread/resource identity. We restore it after the sub-agent
            // returns so the parent's processors (OM, working memory, etc.) still
            // see the correct context on subsequent steps.
            const savedMastraMemory = requestContext.get('MastraMemory');

            // Save and clear reserved thread/resource keys so they don't override the
            // sub-agent's isolated memory config. These keys take precedence over the
            // memory option in generate/stream, so leaving them would cause the
            // sub-agent to write to the parent's thread instead of its own.
            const savedThreadIdKey = requestContext.get(MASTRA_THREAD_ID_KEY) as string | undefined;
            const savedResourceIdKey = requestContext.get(MASTRA_RESOURCE_ID_KEY) as string | undefined;
            if (savedThreadIdKey !== undefined) {
              requestContext.delete(MASTRA_THREAD_ID_KEY);
            }
            if (savedResourceIdKey !== undefined) {
              requestContext.delete(MASTRA_RESOURCE_ID_KEY);
            }

            // Resolve versioned sub-agent if a version override exists on requestContext.
            // This must happen before onDelegationStart so the rejection branch can
            // use the correct model version and memory config from the resolved agent.
            let resolvedAgent = agent;
            const versionOverrides = requestContext.get(MASTRA_VERSIONS_KEY) as VersionOverrides | undefined;
            const agentVersionSelector = versionOverrides?.agents?.[agent.id];
            if (agentVersionSelector && this.#mastra) {
              try {
                resolvedAgent = await this.#mastra.resolveVersionedAgent(agent, agentVersionSelector);
              } catch (versionError) {
                this.logger.warn('Failed to resolve versioned sub-agent, using code-defined default', {
                  agent: this.name,
                  targetAgent: agentName,
                  targetAgentId: agent.id,
                  versionSelector: agentVersionSelector,
                  error: versionError,
                });
              }
            }

            // Recompute derived values from the resolved agent (may differ from
            // code-defined agent if a stored version changed the model or defaults)
            const resolvedModelVersion = (await resolvedAgent.getModel({ requestContext })).specificationVersion;
            const resolvedDefaultOptions = await resolvedAgent.getDefaultOptions?.({ requestContext });
            const resolvedHasOwnMemoryConfig = resolvedDefaultOptions?.memory !== undefined;

            // Propagate parent memory to the resolved agent if it doesn't have its own.
            // This must happen before onDelegationStart so the rejection path can
            // save messages via resolvedAgent.getMemory().
            if (
              (methodType === 'generate' ||
                methodType === 'generateLegacy' ||
                methodType === 'stream' ||
                methodType === 'streamLegacy') &&
              supportedLanguageModelSpecifications.includes(resolvedModelVersion)
            ) {
              if (!resolvedAgent.hasOwnMemory() && this.#memory) {
                resolvedAgent.__setMemory(this.#memory as DynamicArgument<MastraMemory>);
              }
            }

            // Call onDelegationStart hook if provided
            let effectivePrompt = inputData.prompt;
            let effectiveInstructions = inputData.instructions;
            let effectiveMaxSteps = inputData.maxSteps;
            if (delegation?.onDelegationStart) {
              try {
                const startResult = await delegation.onDelegationStart(delegationStartContext);
                if (startResult) {
                  // Check if delegation should be rejected
                  if (startResult.proceed === false) {
                    const rejectionMessage =
                      startResult.rejectionReason || 'Delegation rejected by onDelegationStart hook';
                    this.logger.debug('Delegation rejected', {
                      agent: this.name,
                      targetAgent: agentName,
                      reason: rejectionMessage,
                    });

                    if (
                      (methodType === 'stream' || methodType === 'streamLegacy') &&
                      supportedLanguageModelSpecifications.includes(resolvedModelVersion)
                    ) {
                      await context.writer?.write({
                        type: 'text-delta',
                        payload: {
                          id: randomUUID(),
                          text: `[Delegation Rejected] ${rejectionMessage}`,
                        },
                        runId,
                        from: ChunkFrom.AGENT,
                      });
                    }

                    // Save rejection messages to sub-agent's memory so the UI can display them
                    const memory = await resolvedAgent.getMemory({ requestContext });
                    if (memory) {
                      try {
                        // Create user message with the original prompt
                        const userMessage: MastraDBMessage = {
                          id: this.#mastra?.generateId() || randomUUID(),
                          role: 'user',
                          type: 'text',
                          createdAt: new Date(),
                          threadId: subAgentThreadId,
                          resourceId: subAgentResourceId,
                          content: {
                            format: 2,
                            parts: [
                              {
                                type: 'text',
                                text: effectivePrompt,
                              },
                            ],
                          },
                        };

                        // Create assistant message with the rejection
                        const assistantMessage: MastraDBMessage = {
                          id: this.#mastra?.generateId() || randomUUID(),
                          role: 'assistant',
                          type: 'text',
                          createdAt: new Date(new Date().getTime() + 1),
                          threadId: subAgentThreadId,
                          resourceId: subAgentResourceId,
                          content: {
                            format: 2,
                            parts: [
                              {
                                type: 'text',
                                text: `[Delegation Rejected] ${rejectionMessage}`,
                              },
                            ],
                          },
                        };

                        await memory.createThread({
                          resourceId: subAgentResourceId,
                          threadId: subAgentThreadId,
                        });

                        await memory.saveMessages({
                          messages: [userMessage, assistantMessage],
                        });
                      } catch (memoryError) {
                        this.logger.error('Failed to save rejection to sub-agent memory', {
                          agent: this.name,
                          error: memoryError,
                        });
                      }
                    }

                    if (savedThreadIdKey !== undefined) {
                      requestContext.set(MASTRA_THREAD_ID_KEY, savedThreadIdKey);
                    }
                    if (savedResourceIdKey !== undefined) {
                      requestContext.set(MASTRA_RESOURCE_ID_KEY, savedResourceIdKey);
                    }

                    return {
                      text: `[Delegation Rejected] ${rejectionMessage}`,
                      subAgentThreadId,
                      subAgentResourceId,
                    };
                  }
                  // Apply modifications
                  if (startResult.modifiedPrompt !== undefined) {
                    effectivePrompt = startResult.modifiedPrompt;
                  }
                  if (startResult.modifiedInstructions !== undefined) {
                    effectiveInstructions = startResult.modifiedInstructions;
                  }
                  if (startResult.modifiedMaxSteps !== undefined) {
                    effectiveMaxSteps = startResult.modifiedMaxSteps;
                  }
                }
              } catch (hookError) {
                this.logger.error('onDelegationStart hook error', { agent: this.name, error: hookError });
                // Continue with original values on hook error
              }
            }

            this.logger.debug('Delegation accepted', {
              agent: this.name,
              targetAgent: agentName,
              modifiedPrompt: effectivePrompt !== inputData.prompt,
              modifiedInstructions: effectiveInstructions !== inputData.instructions,
              modifiedMaxSteps: effectiveMaxSteps !== inputData.maxSteps,
            });

            // Append LLM-provided instructions to the sub-agent's own instructions
            if (effectiveInstructions) {
              const agentOwnInstructions = await resolvedAgent.getInstructions({ requestContext });
              if (agentOwnInstructions) {
                const ownStr = this.#convertInstructionsToString(agentOwnInstructions);
                if (ownStr) {
                  effectiveInstructions = `${ownStr}\n\n${effectiveInstructions}`;
                }
              }
            }

            try {
              this.logger.debug('Executing agent as tool', {
                agent: this.name,
                targetAgent: agentName,
                args: inputData,
                runId,
                threadId,
                resourceId,
              });

              let result: any;
              const suspendedToolRunId = (inputData as any).suspendedToolRunId;

              const { resumeData, suspend } = context?.agent ?? {};

              // Apply messageFilter callback (runs after onDelegationStart so effectivePrompt
              // reflects any hook modifications). Falls back to full context on error.
              let filteredContextMessages = sanitizedMessages;
              if (delegation?.messageFilter) {
                try {
                  filteredContextMessages = await delegation.messageFilter({
                    messages: sanitizedMessages,
                    primitiveId: agent.id,
                    primitiveType: 'agent',
                    prompt: effectivePrompt,
                    iteration: derivedIteration,
                    runId: runId || randomUUID(),
                    threadId,
                    resourceId,
                    parentAgentId: this.id,
                    parentAgentName: this.name,
                    toolCallId,
                  });
                } catch (filterError) {
                  this.logger.error('messageFilter error', { agent: this.name, error: filterError });
                  // Fall back to unfiltered context on error
                }
              }

              // Pass history as context (not messages) so it reaches the LLM but is not persisted to the sub-agent thread.
              const messagesForSubAgent: MessageListInput = [{ role: 'user' as const, content: effectivePrompt }];

              const subAgentPromptCreatedAt = new Date();

              if (
                (methodType === 'generate' || methodType === 'generateLegacy') &&
                supportedLanguageModelSpecifications.includes(resolvedModelVersion)
              ) {
                const generateResult = resumeData
                  ? await resolvedAgent.resumeGenerate(resumeData, {
                      runId: suspendedToolRunId,
                      requestContext,
                      ...resolveObservabilityContext(context ?? {}),
                      ...(effectiveInstructions && { instructions: effectiveInstructions }),
                      ...(effectiveMaxSteps && { maxSteps: effectiveMaxSteps }),
                      context: filteredContextMessages as unknown as ModelMessage[],
                      ...(resourceId && threadId && !resolvedHasOwnMemoryConfig
                        ? {
                            memory: {
                              resource: subAgentResourceId,
                              thread: subAgentThreadId,
                              options: { lastMessages: false },
                            },
                          }
                        : {}),
                      disableBackgroundTasks: true,
                    })
                  : await resolvedAgent.generate(messagesForSubAgent, {
                      requestContext,
                      ...resolveObservabilityContext(context ?? {}),
                      ...(effectiveInstructions && { instructions: effectiveInstructions }),
                      ...(effectiveMaxSteps && { maxSteps: effectiveMaxSteps }),
                      context: filteredContextMessages as unknown as ModelMessage[],
                      ...(resourceId && threadId && !resolvedHasOwnMemoryConfig
                        ? {
                            memory: {
                              resource: subAgentResourceId,
                              thread: subAgentThreadId,
                              options: { lastMessages: false },
                            },
                          }
                        : {}),
                      disableBackgroundTasks: true,
                    });

                const agentResponseMessages = generateResult.response.dbMessages ?? [];
                const subAgentToolResults = generateResult.toolResults?.map(toolResult => ({
                  toolName: toolResult.payload.toolName,
                  toolCallId: toolResult.payload.toolCallId,
                  result: toolResult.payload.result,
                  args: toolResult.payload.args,
                  isError: toolResult.payload.isError,
                }));
                // Create user message with the original prompt
                const userMessage: MastraDBMessage = {
                  id: this.#mastra?.generateId() || randomUUID(),
                  role: 'user',
                  type: 'text',
                  createdAt: subAgentPromptCreatedAt,
                  threadId: subAgentThreadId,
                  resourceId: subAgentResourceId,
                  content: {
                    format: 2,
                    parts: [
                      {
                        type: 'text',
                        text: effectivePrompt,
                      },
                    ],
                  },
                };

                fullSubAgentMessages = [userMessage, ...agentResponseMessages];

                // Save response messages to sub-agent's memory so the UI can display them
                const memory = await resolvedAgent.getMemory({ requestContext });
                if (memory) {
                  try {
                    await memory.createThread({
                      resourceId: subAgentResourceId,
                      threadId: subAgentThreadId,
                    });

                    await memory.saveMessages({
                      messages: fullSubAgentMessages,
                    });
                  } catch (memoryError) {
                    this.logger.error('Failed to save messages to sub-agent memory', {
                      agent: this.name,
                      error: memoryError,
                    });
                  }
                }

                if (generateResult.finishReason === 'suspended') {
                  if (savedThreadIdKey !== undefined) {
                    requestContext.set(MASTRA_THREAD_ID_KEY, savedThreadIdKey);
                  }
                  if (savedResourceIdKey !== undefined) {
                    requestContext.set(MASTRA_RESOURCE_ID_KEY, savedResourceIdKey);
                  }
                  return suspend?.(generateResult.suspendPayload, {
                    resumeSchema: generateResult.resumeSchema,
                    runId: generateResult.runId,
                    isAgentSuspend: true,
                  });
                }

                result = { text: generateResult.text, subAgentThreadId, subAgentResourceId, subAgentToolResults };
              } else if (methodType === 'generate' && resolvedModelVersion === 'v1') {
                const generateResult = await resolvedAgent.generateLegacy(messagesForSubAgent, {
                  requestContext,
                  ...resolveObservabilityContext(context ?? {}),
                  context: filteredContextMessages as unknown as CoreMessage[],
                });
                result = { text: generateResult.text };
              } else if (
                (methodType === 'stream' || methodType === 'streamLegacy') &&
                supportedLanguageModelSpecifications.includes(resolvedModelVersion)
              ) {
                const streamResult = resumeData
                  ? await resolvedAgent.resumeStream(resumeData, {
                      runId: suspendedToolRunId,
                      requestContext,
                      ...resolveObservabilityContext(context ?? {}),
                      ...(effectiveInstructions && { instructions: effectiveInstructions }),
                      ...(effectiveMaxSteps && { maxSteps: effectiveMaxSteps }),
                      context: filteredContextMessages as unknown as ModelMessage[],
                      ...(resourceId && threadId && !resolvedHasOwnMemoryConfig
                        ? {
                            memory: {
                              resource: subAgentResourceId,
                              thread: subAgentThreadId,
                              options: {
                                lastMessages: false,
                              },
                            },
                          }
                        : {}),
                      disableBackgroundTasks: true,
                    })
                  : await resolvedAgent.stream(messagesForSubAgent, {
                      requestContext,
                      ...resolveObservabilityContext(context ?? {}),
                      ...(effectiveInstructions && { instructions: effectiveInstructions }),
                      ...(effectiveMaxSteps && { maxSteps: effectiveMaxSteps }),
                      context: filteredContextMessages as unknown as ModelMessage[],
                      ...(resourceId && threadId && !resolvedHasOwnMemoryConfig
                        ? {
                            memory: {
                              resource: subAgentResourceId,
                              thread: subAgentThreadId,
                              options: {
                                lastMessages: false,
                              },
                            },
                          }
                        : {}),
                      disableBackgroundTasks: true,
                    });

                let requireToolApproval;
                let suspendedPayload;
                let resumeSchema;
                for await (const chunk of streamResult.fullStream) {
                  if (context?.writer) {
                    // Data chunks from writer.custom() should bubble up directly without wrapping
                    if (chunk.type.startsWith('data-')) {
                      // Write data chunks directly to original stream to bubble up
                      await context.writer.custom(chunk as any);
                      if (chunk.type === 'data-tool-call-approval') {
                        suspendedPayload = {};
                        requireToolApproval = true;
                      }

                      if (chunk.type === 'data-tool-call-suspended') {
                        suspendedPayload = chunk.data.suspendPayload;
                        resumeSchema = chunk.data.resumeSchema;
                      }
                    } else {
                      await context.writer.write(chunk);
                      if (chunk.type === 'tool-call-approval') {
                        suspendedPayload = {};
                        requireToolApproval = true;
                      }

                      if (chunk.type === 'tool-call-suspended') {
                        suspendedPayload = chunk.payload.suspendPayload;
                        resumeSchema = chunk.payload.resumeSchema;
                      }
                    }
                  }
                }

                const subAgentToolResults = (await streamResult.toolResults)?.map(toolResult => ({
                  toolName: toolResult.payload.toolName,
                  toolCallId: toolResult.payload.toolCallId,
                  result: toolResult.payload.result,
                  args: toolResult.payload.args,
                  isError: toolResult.payload.isError,
                }));
                const agentResponseMessages = streamResult.messageList.get.response.db();
                // Create user message with the original prompt
                const userMessage: MastraDBMessage = {
                  id: this.#mastra?.generateId() || randomUUID(),
                  role: 'user',
                  type: 'text',
                  createdAt: subAgentPromptCreatedAt,
                  threadId: subAgentThreadId,
                  resourceId: subAgentResourceId,
                  content: {
                    format: 2,
                    parts: [
                      {
                        type: 'text',
                        text: effectivePrompt,
                      },
                    ],
                  },
                };

                fullSubAgentMessages = [userMessage, ...agentResponseMessages];

                // Save response messages to sub-agent's memory so the UI can display them
                const streamMemory = await resolvedAgent.getMemory({ requestContext });
                if (streamMemory) {
                  try {
                    await streamMemory.createThread({
                      resourceId: subAgentResourceId,
                      threadId: subAgentThreadId,
                    });

                    await streamMemory.saveMessages({
                      messages: fullSubAgentMessages,
                    });
                  } catch (memoryError) {
                    this.logger.error('Failed to save messages to sub-agent memory', {
                      agent: this.name,
                      error: memoryError,
                    });
                  }
                }

                if (requireToolApproval || suspendedPayload || resumeSchema) {
                  if (savedThreadIdKey !== undefined) {
                    requestContext.set(MASTRA_THREAD_ID_KEY, savedThreadIdKey);
                  }
                  if (savedResourceIdKey !== undefined) {
                    requestContext.set(MASTRA_RESOURCE_ID_KEY, savedResourceIdKey);
                  }
                  return suspend?.(suspendedPayload, {
                    resumeSchema,
                    requireToolApproval,
                    runId: streamResult.runId,
                    isAgentSuspend: true,
                  });
                }

                // Use streamResult.text (a delayed promise) which resolves to the
                // output-processor-modified text, rather than the raw accumulated text-deltas.
                const processedText = await streamResult.text;
                result = {
                  text: processedText,
                  subAgentThreadId,
                  subAgentResourceId,
                  subAgentToolResults,
                };
              } else {
                const streamResult = await resolvedAgent.streamLegacy(effectivePrompt, {
                  requestContext,
                  ...resolveObservabilityContext(context ?? {}),
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

              // Call onDelegationComplete hook if provided
              if (delegation?.onDelegationComplete) {
                try {
                  let bailed = false;
                  const delegationCompleteContext: DelegationCompleteContext = {
                    primitiveId: agent.id,
                    primitiveType: 'agent',
                    prompt: effectivePrompt,
                    result,
                    duration: Date.now() - startTime,
                    success: true,
                    iteration: derivedIteration,
                    runId: runId || randomUUID(),
                    toolCallId,
                    parentAgentId: this.id,
                    parentAgentName: this.name,
                    messages: fullSubAgentMessages,
                    bail: () => {
                      bailed = true;
                    },
                  };

                  const completeResult = await delegation.onDelegationComplete(delegationCompleteContext);

                  // If bailed, add a marker to the result and signal via requestContext
                  if (bailed) {
                    requestContext.set('__mastra_delegationBailed', true);
                  }

                  // Handle feedback if provided
                  if (completeResult?.feedback) {
                    const feedbackMessage: MastraDBMessage = {
                      id: this.#mastra?.generateId() || randomUUID(),
                      role: 'assistant',
                      type: 'text',
                      createdAt: new Date(),
                      content: {
                        format: 2,
                        parts: [{ type: 'text', text: completeResult.feedback }],
                        metadata: {
                          mode: 'stream',
                          completionResult: {
                            suppressFeedback: true,
                          },
                        },
                      },
                      threadId,
                      resourceId,
                    };
                    const supervisorMemory = await this.getMemory({ requestContext });
                    if (supervisorMemory) {
                      try {
                        await supervisorMemory.saveMessages({
                          messages: [feedbackMessage],
                        });
                      } catch (memoryError) {
                        this.logger.error('Failed to save feedback to supervisor memory', {
                          agent: this.name,
                          error: memoryError,
                        });
                      }
                    }
                  }
                } catch (hookError) {
                  this.logger.error('onDelegationComplete hook error', { agent: this.name, error: hookError });
                }
              }
              // Restore the parent agent's MastraMemory after sub-agent execution
              if (savedMastraMemory !== undefined) {
                requestContext.set('MastraMemory', savedMastraMemory);
              }
              if (savedThreadIdKey !== undefined) {
                requestContext.set(MASTRA_THREAD_ID_KEY, savedThreadIdKey);
              }
              if (savedResourceIdKey !== undefined) {
                requestContext.set(MASTRA_RESOURCE_ID_KEY, savedResourceIdKey);
              }

              return result;
            } catch (err) {
              let bailed = false;
              // Call onDelegationComplete with error if hook is provided
              if (delegation?.onDelegationComplete) {
                try {
                  const delegationCompleteContext: DelegationCompleteContext = {
                    primitiveId: agent.id,
                    primitiveType: 'agent',
                    prompt: effectivePrompt,
                    result: { text: '' },
                    duration: Date.now() - startTime,
                    success: false,
                    error: err instanceof Error ? err : new Error(String(err)),
                    iteration: derivedIteration,
                    runId: runId || randomUUID(),
                    toolCallId,
                    parentAgentId: this.id,
                    parentAgentName: this.name,
                    messages: fullSubAgentMessages,
                    bail: () => {
                      bailed = true;
                    },
                  };

                  const completeResult = await delegation.onDelegationComplete(delegationCompleteContext);

                  if (bailed) {
                    requestContext.set('__mastra_delegationBailed', true);
                  }

                  if (completeResult?.feedback) {
                    const feedbackMessage: MastraDBMessage = {
                      id: this.#mastra?.generateId() || randomUUID(),
                      role: 'assistant',
                      type: 'text',
                      createdAt: new Date(),
                      content: {
                        format: 2,
                        parts: [{ type: 'text', text: completeResult.feedback }],
                        metadata: {
                          mode: 'stream',
                          completionResult: {
                            suppressFeedback: true,
                          },
                        },
                      },
                      threadId,
                      resourceId,
                    };
                    const supervisorMemory = await this.getMemory({ requestContext });
                    if (supervisorMemory) {
                      try {
                        await supervisorMemory.saveMessages({
                          messages: [feedbackMessage],
                        });
                      } catch (memoryError) {
                        this.logger.error('Failed to save feedback to supervisor memory', {
                          agent: this.name,
                          error: memoryError,
                        });
                      }
                    }
                  }
                } catch (hookError) {
                  this.logger.error('onDelegationComplete hook error on failure', {
                    agent: this.name,
                    error: hookError,
                  });
                }
              }

              // Restore even on error so the parent's retry/fallback logic
              // sees the correct memory context
              if (savedMastraMemory !== undefined) {
                requestContext.set('MastraMemory', savedMastraMemory);
              }
              if (savedThreadIdKey !== undefined) {
                requestContext.set(MASTRA_THREAD_ID_KEY, savedThreadIdKey);
              }
              if (savedResourceIdKey !== undefined) {
                requestContext.set(MASTRA_RESOURCE_ID_KEY, savedResourceIdKey);
              }

              const mastraError = new MastraError(
                {
                  id: 'AGENT_AGENT_TOOL_EXECUTION_FAILED',
                  domain: ErrorDomain.AGENT,
                  category: ErrorCategory.USER,
                  details: {
                    agentName: this.name,
                    subAgentName: agent.name,
                    runId: runId || '',
                    threadId: threadId || '',
                    resourceId: resourceId || '',
                  },
                  text: `[Agent:${this.name}] - Failed agent tool execution for ${agentName}`,
                },
                err,
              );
              this.logger.trackException(mastraError);
              throw mastraError;
            }
          },
        });

        // Derive a ToolBackgroundConfig from the sub-agent's tools/config so the
        // parent can dispatch the entire sub-agent invocation as a background task
        // when appropriate.
        const subAgentBackgroundConfig = await this.deriveSubAgentBackgroundConfig(agent, requestContext);

        const options: ToolOptions = {
          name: `agent-${agentName}`,
          runId,
          threadId,
          resourceId,
          logger: this.logger,
          mastra: this.#mastra,
          memory: await this.getMemory({ requestContext }),
          agentName: this.name,
          agentId: this.id,
          requestContext,
          model: await this.getModel({ requestContext }),
          ...observabilityContext,
          tracingPolicy: this.#options?.tracingPolicy,
          backgroundConfig: subAgentBackgroundConfig,
        };

        convertedAgentTools[`agent-${agentName}`] = makeCoreTool(
          toolObj,
          options,
          undefined,
          autoResumeSuspendedTools,
          backgroundTaskEnabled,
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
    methodType,
    autoResumeSuspendedTools,
    backgroundTaskEnabled,
    ...rest
  }: {
    runId?: string;
    threadId?: string;
    resourceId?: string;
    requestContext: RequestContext;
    methodType: AgentMethodType;
    autoResumeSuspendedTools?: boolean;
    backgroundTaskEnabled?: boolean;
  } & Partial<ObservabilityContext>) {
    const observabilityContext = resolveObservabilityContext(rest);
    const convertedWorkflowTools: Record<string, CoreTool> = {};
    const workflows = await this.listWorkflows({ requestContext });
    if (Object.keys(workflows).length > 0) {
      for (const [workflowName, workflow] of Object.entries(workflows)) {
        // Build input/output schemas as JSONSchema7 to avoid Zod composition issues
        // when workflow schemas are StandardSchemaWithJSON wrappers (e.g. from storage)
        const inputDataJsonSchema: JSONSchema7 = workflow.inputSchema
          ? standardSchemaToJSONSchema(workflow.inputSchema, { io: 'input' })
          : { type: 'object', additionalProperties: true };

        const inputProperties: Record<string, JSONSchema7> = {
          inputData: inputDataJsonSchema,
        };
        const inputRequired = ['inputData'];

        if (workflow.stateSchema) {
          inputProperties.initialState = standardSchemaToJSONSchema(workflow.stateSchema, { io: 'input' });
        }

        const extendedInputSchema: JSONSchema7 = {
          type: 'object',
          properties: inputProperties,
          required: inputRequired,
          additionalProperties: true,
        };

        const outputResultProperties: Record<string, JSONSchema7> = {
          runId: { type: 'string', description: 'Unique identifier for the workflow run' },
        };
        if (workflow.outputSchema) {
          outputResultProperties.result = standardSchemaToJSONSchema(workflow.outputSchema, { io: 'output' });
        }

        const outputSchema: JSONSchema7 = {
          anyOf: [
            {
              type: 'object',
              properties: outputResultProperties,
              required: ['runId'],
            },
            {
              type: 'object',
              properties: {
                runId: { type: 'string', description: 'Unique identifier for the workflow run' },
                error: { type: 'string', description: 'Error message if workflow execution failed' },
              },
              required: ['runId', 'error'],
            },
          ],
        };

        const toolObj = createTool({
          id: `workflow-${workflowName}`,
          description: workflow.description || `Workflow: ${workflowName}`,
          inputSchema: extendedInputSchema,
          outputSchema,
          mastra: this.#mastra,
          // manually wrap workflow tools with tracing, so that we can pass the
          // current tool span onto the workflow to maintain continuity of the trace
          execute: async (inputData, context) => {
            const savedMastraMemory = requestContext.get('MastraMemory');
            try {
              const { initialState, inputData: workflowInputData, suspendedToolRunId } = inputData as any;
              // Use a unique runId for each workflow tool call to prevent parallel calls
              // from sharing the same cached Run instance (see #13473).
              // For resume cases, suspendedToolRunId is injected into inputData by
              // tool-call-step (from metadata stored during suspension).
              // For fresh calls: generate a new unique runId.
              const runIdToUse = suspendedToolRunId || randomUUID();
              this.logger.debug('Executing workflow as tool', {
                agent: this.name,
                workflow: workflowName,
                description: workflow.description,
                args: inputData,
                runId: runIdToUse,
                threadId,
                resourceId,
              });

              const run = await workflow.createRun({ runId: runIdToUse, resourceId });
              const { resumeData, suspend } = context?.agent ?? {};

              let result: WorkflowResult<any, any, any, any> | undefined = undefined;

              if (methodType === 'generate' || methodType === 'generateLegacy') {
                if (resumeData) {
                  result = await run.resume({
                    resumeData,
                    requestContext,
                    ...resolveObservabilityContext(context ?? {}),
                  });
                } else {
                  result = await run.start({
                    inputData: workflowInputData,
                    requestContext,
                    ...resolveObservabilityContext(context ?? {}),
                    ...(initialState && { initialState }),
                  });
                }
              } else if (methodType === 'streamLegacy') {
                const streamResult = run.streamLegacy({
                  inputData: workflowInputData,
                  requestContext,
                  ...resolveObservabilityContext(context ?? {}),
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
                      ...resolveObservabilityContext(context ?? {}),
                    })
                  : run.stream({
                      inputData: workflowInputData,
                      requestContext,
                      ...resolveObservabilityContext(context ?? {}),
                      ...(initialState && { initialState }),
                    });

                if (context?.writer) {
                  await streamResult.fullStream.pipeTo(context.writer);
                }

                result = await streamResult.result;
              }

              if (savedMastraMemory !== undefined) {
                requestContext.set('MastraMemory', savedMastraMemory);
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
                      this.logger.warn('Suspended step not found in workflow', {
                        agent: this.name,
                        step: key,
                        workflow: workflowName,
                      });
                      break;
                    }
                    wflowStep = wflowStep.steps[key] as any;
                  }
                }
                const resumeSchema = (wflowStep as Step<any, any, any, any, any, any>)?.resumeSchema;
                if (suspendPayload?.__workflow_meta) {
                  delete suspendPayload.__workflow_meta;
                }
                // Normalize resumeSchema to StandardSchemaWithJSON before extracting JSON Schema
                const normalizedResumeSchema = resumeSchema ? toStandardSchema(resumeSchema) : undefined;
                return suspend?.(suspendPayload, {
                  resumeLabel: suspendedStepIds,
                  resumeSchema: normalizedResumeSchema
                    ? JSON.stringify(standardSchemaToJSONSchema(normalizedResumeSchema))
                    : undefined,
                  runId: runIdToUse,
                });
              } else {
                // This is to satisfy the execute fn's return value for typescript
                return {
                  error: `Workflow should never reach this path, workflow returned no status`,
                  runId: run.runId,
                };
              }
            } catch (err) {
              if (savedMastraMemory !== undefined) {
                requestContext.set('MastraMemory', savedMastraMemory);
              }

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
          agentId: this.id,
          requestContext,
          model: await this.getModel({ requestContext }),
          ...observabilityContext,
          tracingPolicy: this.#options?.tracingPolicy,
        };

        convertedWorkflowTools[`workflow-${workflowName}`] = makeCoreTool(
          toolObj,
          options,
          undefined,
          autoResumeSuspendedTools,
          backgroundTaskEnabled,
        );
      }
    }

    return convertedWorkflowTools;
  }

  /**
   * Get tools for execution.
   *
   * This method assembles all tools from various sources (assigned tools, memory tools,
   * toolsets, client tools, agent tools, workflow tools) into a unified CoreTool dictionary.
   *
   * This is useful for durable execution where tools need to be reconstructed from
   * serialized state rather than stored in a registry.
   *
   * @param options - Options for tool assembly
   * @returns A record of tool names to CoreTool instances
   */
  async getToolsForExecution(options: {
    toolsets?: ToolsetsInput;
    clientTools?: ToolsInput;
    threadId?: string;
    resourceId?: string;
    runId?: string;
    requestContext?: RequestContext;
    memoryConfig?: MemoryConfig;
    autoResumeSuspendedTools?: boolean;
  }): Promise<Record<string, CoreTool>> {
    const requestContext = options.requestContext ?? new RequestContext();
    return this.convertTools({
      ...options,
      requestContext,
      methodType: 'stream',
    });
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
    outputWriter,
    methodType,
    memoryConfig,
    autoResumeSuspendedTools,
    delegation,
    backgroundTaskEnabled,
    inputProcessors,
    ...rest
  }: {
    toolsets?: ToolsetsInput;
    clientTools?: ToolsInput;
    threadId?: string;
    resourceId?: string;
    runId?: string;
    requestContext: RequestContext;
    outputWriter?: OutputWriter;
    methodType: AgentMethodType;
    memoryConfig?: MemoryConfigInternal;
    autoResumeSuspendedTools?: boolean;
    delegation?: DelegationConfig;
    backgroundTaskEnabled?: boolean;
    inputProcessors?: InputProcessorOrWorkflow[];
  } & Partial<ObservabilityContext>): Promise<Record<string, CoreTool>> {
    const observabilityContext = resolveObservabilityContext(rest);
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
      ...observabilityContext,
      mastraProxy,
      outputWriter,
      autoResumeSuspendedTools,
      backgroundTaskEnabled,
    });

    const memoryTools = await this.listMemoryTools({
      runId,
      resourceId,
      threadId,
      requestContext,
      ...observabilityContext,
      mastraProxy,
      memoryConfig,
      autoResumeSuspendedTools,
      backgroundTaskEnabled,
    });

    const toolsetTools = await this.listToolsets({
      runId,
      resourceId,
      threadId,
      requestContext,
      ...observabilityContext,
      mastraProxy,
      toolsets: toolsets!,
      autoResumeSuspendedTools,
      backgroundTaskEnabled,
    });

    const clientSideTools = await this.listClientTools({
      runId,
      resourceId,
      threadId,
      requestContext,
      ...observabilityContext,
      mastraProxy,
      clientTools: clientTools!,
      autoResumeSuspendedTools,
      backgroundTaskEnabled,
    });

    const agentTools = await this.listAgentTools({
      runId,
      resourceId,
      threadId,
      requestContext,
      methodType,
      ...observabilityContext,
      autoResumeSuspendedTools,
      delegation,
    });

    const workflowTools = await this.listWorkflowTools({
      runId,
      resourceId,
      threadId,
      requestContext,
      methodType,
      ...observabilityContext,
      autoResumeSuspendedTools,
    });

    const workspaceTools = await this.listWorkspaceTools({
      runId,
      resourceId,
      threadId,
      requestContext,
      ...observabilityContext,
      mastraProxy,
      autoResumeSuspendedTools,
      backgroundTaskEnabled,
    });

    const configuredInputProcessors = inputProcessors ?? (await this.listConfiguredInputProcessors(requestContext));
    const hasOnDemandProcessor = hasOnDemandSkillDiscoveryProcessor(configuredInputProcessors);
    const hasSkillsProcessor = hasEagerSkillsProcessor(configuredInputProcessors);

    const skillTools = await this.listSkillTools({
      runId,
      resourceId,
      threadId,
      requestContext,
      ...observabilityContext,
      mastraProxy,
      autoResumeSuspendedTools,
      backgroundTaskEnabled,
      suppressEagerSkillTools: hasOnDemandProcessor && !hasSkillsProcessor,
    });

    const channelTools = await this.listChannelTools({
      runId,
      resourceId,
      threadId,
      requestContext,
      ...observabilityContext,
      mastraProxy,
      autoResumeSuspendedTools,
      backgroundTaskEnabled,
    });

    const browserTools = await this.listBrowserTools({
      runId,
      resourceId,
      threadId,
      requestContext,
      ...observabilityContext,
      autoResumeSuspendedTools,
      backgroundTaskEnabled,
    });

    const allTools = {
      ...assignedTools,
      ...memoryTools,
      ...toolsetTools,
      ...clientSideTools,
      ...agentTools,
      ...workflowTools,
      ...workspaceTools,
      ...skillTools,
      ...channelTools,
      ...browserTools,
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
          throw mastraError;
        }

        tools[newKey] = tools[key];
        delete tools[key];
      }
    }

    return tools;
  }

  async #runScorers({
    messageList,
    runId,
    requestContext,
    structuredOutput,
    overrideScorers,
    threadId,
    resourceId,
    ...observabilityContext
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
  } & ObservabilityContext) {
    let scorers: Record<string, { scorer: MastraScorer; sampling?: ScoringSamplingConfig }> = {};
    try {
      scorers = overrideScorers
        ? this.resolveOverrideScorerReferences(overrideScorers)
        : await this.listScorers({ requestContext });
    } catch (e) {
      this.logger.warn('Failed to get scorers', { agent: this.name, error: e });
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
          ...observabilityContext,
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
          this.logger.warn('Failed to get scorer', { agent: this.name, scorer: scorerObject.scorer, error });
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
    resolvedSelection?: ResolvedModelSelection,
  ): Promise<Array<AgentModelManagerConfig>> {
    const selection =
      resolvedSelection ??
      (await this.resolveModelSelection(
        this.model as DynamicArgument<MastraModelConfig | ModelWithRetries[], TRequestContext> | ModelFallbacks,
        requestContext,
      ));

    if (!Array.isArray(selection)) {
      const resolvedModel = await this.resolveModelConfig(selection, requestContext);
      this.assertSupportsPreparedModels(resolvedModel);

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
      selection.map(async modelConfig => {
        const model = await this.resolveModelConfig(modelConfig.model, requestContext);
        this.assertSupportsPreparedModels(model);

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
          throw mastraError;
        }

        // Extract headers from ModelRouterLanguageModel if available
        let routerHeaders: Record<string, string> | undefined;
        if (model instanceof ModelRouterLanguageModel) {
          routerHeaders = (model as any).config?.headers;
        }

        // Disabled entries are filtered out in getLLM(); skip resolving their dynamic
        // fields so a throwing or side-effecting resolver on an unused entry can't
        // break the whole fallback array.
        const isEnabled = modelConfig.enabled ?? true;
        const [resolvedModelSettings, resolvedProviderOptions, resolvedUserHeaders] = isEnabled
          ? await Promise.all([
              this.resolveFallbackDynamic(modelConfig.modelSettings, requestContext),
              this.resolveFallbackDynamic(modelConfig.providerOptions, requestContext),
              this.resolveFallbackDynamic(modelConfig.headers, requestContext),
            ])
          : [undefined, undefined, undefined];

        const mergedHeaders =
          routerHeaders || resolvedUserHeaders
            ? { ...(routerHeaders ?? {}), ...(resolvedUserHeaders ?? {}) }
            : undefined;

        return {
          id: modelId,
          model: model,
          maxRetries: modelConfig.maxRetries ?? 0,
          enabled: isEnabled,
          headers: mergedHeaders,
          modelSettings: resolvedModelSettings,
          providerOptions: resolvedProviderOptions,
        };
      }),
    );

    return models;
  }

  /** @internal */
  private async resolveFallbackDynamic<T>(
    value: DynamicArgument<T> | undefined,
    requestContext: RequestContext,
  ): Promise<T | undefined> {
    if (value === undefined) return undefined;
    if (typeof value === 'function') {
      return await (value as (args: { requestContext: RequestContext; mastra?: Mastra }) => Promise<T> | T)({
        requestContext,
        mastra: this.#mastra,
      });
    }
    return value;
  }

  /**
   * Loads the agentic-loop workflow snapshot for resume, or throws an actionable error.
   * Used by resumeStream and resumeGenerate to fail fast at the agent boundary.
   * @internal
   */
  async #loadAgenticLoopSnapshotOrThrow({ runId, method }: { runId: string; method: string }) {
    const workflowsStore = await this.#mastra?.getStorage()?.getStore('workflows');
    const existingSnapshot = await workflowsStore?.loadWorkflowSnapshot({
      workflowName: 'agentic-loop',
      runId,
    });

    if (!existingSnapshot) {
      const hasStorage = !!workflowsStore;
      throw new MastraError({
        id: 'AGENT_RESUME_NO_SNAPSHOT_FOUND',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text:
          `Agent "${this.name}" ${method}() could not find a suspended run for runId "${runId}". ` +
          (hasStorage
            ? `The run may have already completed, never suspended, or the runId is invalid. `
            : `No storage is configured on this Mastra instance, so workflow snapshots cannot be persisted. Register the agent on a Mastra instance with persistent storage (e.g. PostgreSQL, LibSQL). `) +
          `Ensure you are calling ${method}() only with a runId from a currently-suspended run.`,
        details: {
          runId,
          agentName: this.name,
          hasStorage,
        },
      });
    }

    return existingSnapshot;
  }

  /**
   * Executes the agent call, handling tools, memory, and streaming.
   * @internal
   */
  async #execute<OUTPUT>({ methodType, resumeContext, ...options }: InnerAgentExecutionOptions<OUTPUT>) {
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

    // Build version overrides by merging: Mastra defaults < requestContext < call-site
    const requestVersions = requestContext.get(MASTRA_VERSIONS_KEY) as VersionOverrides | undefined;
    let mergedVersions = mergeVersionOverrides(this.#mastra?.getVersionOverrides(), requestVersions);

    // Merge call-site version overrides on top (call-site wins over request + Mastra defaults)
    if (options.versions) {
      mergedVersions = mergeVersionOverrides(mergedVersions, options.versions);
    }

    if (mergedVersions) {
      requestContext.set(MASTRA_VERSIONS_KEY, mergedVersions);
    }

    // Resolve workspace early so we can get browser from it if needed
    const earlyWorkspace = await this.getWorkspace({ requestContext });

    // Inject browser context for BrowserContextProcessor
    // Check both agent's browser (SDK providers) and workspace's browser (CLI providers)
    const browser = this.#browser ?? earlyWorkspace?.browser;
    if (browser && !requestContext.has('browser')) {
      // Get threadId early for browser context - can come from requestContext, options, or snapshot
      // Normalize memory.thread which can be a string or { id, ... } object
      const memoryThread = options.memory?.thread;
      const memoryThreadId = typeof memoryThread === 'string' ? memoryThread : memoryThread?.id;
      const browserThreadId =
        (requestContext.get(MASTRA_THREAD_ID_KEY) as string | undefined) ||
        memoryThreadId ||
        snapshotMemoryInfo?.threadId;

      // Use thread-aware running check to avoid cross-thread state leakage
      // In thread scope, only report running if this specific thread has a session
      const isThreadRunning = browserThreadId
        ? browser.hasThreadSession(browserThreadId) && browser.isBrowserRunning(browserThreadId)
        : browser.isBrowserRunning();

      const browserCtx: BrowserContext = {
        provider: browser.provider,
        providerType: browser.providerType,
        sessionId: browser.getSessionId(browserThreadId),
        headless: browser.headless,
        currentUrl: isThreadRunning ? ((await browser.getCurrentUrl(browserThreadId)) ?? undefined) : undefined,
        // For CLI providers, include CDP URL so agent can pass it to CLI commands
        // Only expose CDP URL if the thread is actually running to avoid stale endpoints
        cdpUrl:
          browser.providerType === 'cli' && isThreadRunning
            ? (browser.getCdpUrl(browserThreadId) ?? undefined)
            : undefined,
      };
      requestContext.set('browser', browserCtx);
    }

    // Reserved keys from requestContext take precedence for security.
    // This allows middleware to securely set resourceId/threadId based on authenticated user,
    // preventing attackers from hijacking another user's memory by passing different values in the body.
    const resourceIdFromContext = requestContext.get(MASTRA_RESOURCE_ID_KEY) as string | undefined;
    const threadIdFromContext = requestContext.get(MASTRA_THREAD_ID_KEY) as string | undefined;

    const threadFromArgs = resolveThreadIdFromArgs({
      memory: {
        ...options.memory,
        thread: options.memory?.thread || snapshotMemoryInfo?.threadId,
      },
      overrideId: threadIdFromContext,
    });

    const resourceId = resourceIdFromContext || options.memory?.resource || snapshotMemoryInfo?.resourceId;
    const memoryConfig = options.memory?.options;

    const llm = (await this.getLLM({
      requestContext,
      model: options.model as DynamicArgument<MastraModelConfig, TRequestContext> | undefined,
    })) as MastraLLMVNext;

    const resolvedModel = llm.getModel();
    const isGatewayModel =
      typeof resolvedModel === 'object' &&
      resolvedModel !== null &&
      'gatewayId' in resolvedModel &&
      resolvedModel.gatewayId === 'mastra';
    if (resourceId && threadFromArgs && !this.hasOwnMemory() && !isGatewayModel) {
      this.logger.warn('No memory is configured but resourceId and threadId were passed in args', { agent: this.name });
    }

    // Apply null→undefined transform for OpenAI structured output validation.
    // OpenAI strict mode sends null for optional fields, but schemas like Zod's .optional()
    // reject null. The wrapper transforms null→undefined for non-required fields before
    // validation, working with any schema type (Zod, ArkType, JSON Schema, etc.).
    //
    // Skip when structuredOutput.model is provided because the StructuredOutputProcessor will
    // create its own inner agent call, which will apply its own transform.
    if ('structuredOutput' in options && options.structuredOutput?.schema && !options.structuredOutput?.model) {
      const structuredOutputModel = llm.getModel();
      const targetProvider = structuredOutputModel.provider;
      const targetModelId = structuredOutputModel.modelId;

      if (targetProvider.includes('openai') || targetModelId?.includes('openai')) {
        options = {
          ...options,
          structuredOutput: {
            ...options.structuredOutput,
            schema: wrapSchemaWithNullTransform(options.structuredOutput.schema as any) as any,
          },
        };
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
        // @deprecated — use entityVersionId (top-level span context field) instead.
        // Kept for backward compatibility during migration.
        ...(this.toRawConfig()?.resolvedVersionId
          ? { resolvedVersionId: this.toRawConfig()!.resolvedVersionId as string }
          : {}),
      },
      metadata: {
        runId,
        resourceId,
        threadId: threadFromArgs?.id,
        ...(this.toRawConfig()?.resolvedVersionId
          ? { entityVersionId: this.toRawConfig()!.resolvedVersionId as string }
          : {}),
      },
      tracingPolicy: this.#options?.tracingPolicy,
      tracingOptions: options.tracingOptions,
      tracingContext: options.tracingContext,
      requestContext,
      mastra: this.#mastra,
    });

    const memory = await this.getMemory({ requestContext });
    // Reuse early workspace (resolved earlier for browser context) to avoid
    // duplicate factory resolution which could create different instances
    const workspace = earlyWorkspace;

    const saveQueueManager = new SaveQueueManager({
      logger: this.logger,
      memory,
    });

    // Create a capabilities object with bound methods
    const capabilities = {
      agent: this,
      agentName: this.name,
      logger: this.logger,
      getMemory: this.getMemory.bind(this),
      getModel: this.getModel.bind(this),
      generateMessageId: this.#mastra?.generateId?.bind(this.#mastra) || (() => randomUUID()),
      mastra: this.#mastra,
      _agentNetworkAppend:
        '_agentNetworkAppend' in this
          ? Boolean((this as unknown as { _agentNetworkAppend: unknown })._agentNetworkAppend)
          : undefined,
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
      llmRequestInputProcessors: async ({
        requestContext,
        overrides,
      }: {
        requestContext: RequestContext;
        overrides?: InputProcessorOrWorkflow[];
      }) => this.listResolvedLLMRequestProcessors(requestContext, overrides),
      outputProcessors: async ({
        requestContext,
        overrides,
      }: {
        requestContext: RequestContext;
        overrides?: OutputProcessorOrWorkflow[];
      }) => this.listResolvedOutputProcessors(requestContext, overrides),
      errorProcessors: async ({
        requestContext,
        overrides,
      }: {
        requestContext: RequestContext;
        overrides?: ErrorProcessorOrWorkflow[];
      }) =>
        overrides ??
        (this.#errorProcessors
          ? typeof this.#errorProcessors === 'function'
            ? await this.#errorProcessors({ requestContext: requestContext as RequestContext<TRequestContext> })
            : this.#errorProcessors
          : []),
      llm,
    };

    // Create the workflow with all necessary context
    const executionWorkflow = createPrepareStreamWorkflow<OUTPUT>({
      capabilities: capabilities as AgentCapabilities,
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
      ...(options.disableBackgroundTasks
        ? {}
        : {
            backgroundTaskManager: this.#mastra?.backgroundTaskManager,
            agentBackgroundConfig: this.#backgroundTasks,
          }),
      skipBgTaskWait: options._skipBgTaskWait,
    });

    const run = await executionWorkflow.createRun();
    const observabilityContext = createObservabilityContext({ currentSpan: agentSpan });
    const result = await run.start({ ...observabilityContext });

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
    const observabilityContext = createObservabilityContext({ currentSpan: agentSpan });

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
    this.logger.debug('Post processing LLM response', {
      agent: this.name,
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

    // Add LLM response messages to the list
    // Prefer dbMessages (MastraDBMessage[] with original IDs) over response.messages
    // (ModelMessage[] without IDs) to avoid generating new IDs during format conversion
    let responseMessages: MessageInput[] | undefined = result.response.dbMessages?.length
      ? result.response.dbMessages
      : result.response.messages;
    if ((!responseMessages || responseMessages.length === 0) && result.object) {
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

    if (responseMessages?.length) {
      messageList.add(responseMessages, 'response');
    }

    if (memory && resourceId && thread && !readOnlyMemory) {
      try {
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
          minMessages,
        } = this.resolveTitleGenerationConfig(
          config?.generateTitle as
            | boolean
            | {
                model?: DynamicArgument<MastraModelConfig, TRequestContext>;
                instructions?: DynamicArgument<string>;
                minMessages?: number;
              }
            | undefined,
        );

        const uiMessages = messageList.get.all.ui();
        const messages = messageList.get.all.core();
        const requiredMessages = minMessages ?? 1;

        if (shouldGenerate && !thread.title && messages.length >= requiredMessages) {
          const userMessage = this.getMostRecentUserMessage(uiMessages);

          if (userMessage) {
            void this.genTitle(
              userMessage,
              requestContext,
              observabilityContext,
              titleModel,
              titleInstructions,
              uiMessages,
            ).then(
              async title => {
                if (title) {
                  await memory.createThread({
                    threadId: thread.id,
                    resourceId,
                    memoryConfig,
                    title,
                    metadata: thread.metadata,
                  });
                }
              },
              error => {
                this.logger.error('Error persisting generated title:', error);
              },
            );
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
        throw mastraError;
      }
    }

    await this.#runScorers({
      messageList,
      runId,
      requestContext,
      structuredOutput,
      overrideScorers,
      threadId,
      resourceId,
      ...observabilityContext,
    });

    agentSpan?.end({
      output: {
        text: result.text,
        object: result.object,
        files: result.files,
        ...(result.tripwire ? { tripwire: result.tripwire } : {}),
      },
      ...(result.tripwire
        ? {
            attributes: {
              tripwireAbort: {
                reason: result.tripwire.reason,
                processorId: result.tripwire.processorId,
                retry: result.tripwire.retry,
                metadata: result.tripwire.metadata,
              },
            },
          }
        : {}),
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
      onStepFinish: mergedOptions?.onStepFinish as NetworkOptions<OUTPUT>['onStepFinish'],
      onError: mergedOptions?.onError,
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
      onStepFinish: mergedOptions?.onStepFinish,
      onError: mergedOptions?.onError,
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

  async generate<
    OUTPUT extends StandardSchemaWithJSON<any, any>,
    T extends InferStandardSchemaOutput<OUTPUT> = InferStandardSchemaOutput<OUTPUT>,
  >(
    messages: MessageListInput,
    options: AgentExecutionOptionsBase<T> & {
      structuredOutput: PublicStructuredOutputOptions<T>;
    } & { model?: DynamicArgument<MastraModelConfig> },
  ): Promise<FullOutput<T>>;
  async generate<OUTPUT extends {}>(
    messages: MessageListInput,
    options: AgentExecutionOptionsBase<OUTPUT> & {
      structuredOutput: PublicStructuredOutputOptions<OUTPUT>;
    } & { model?: DynamicArgument<MastraModelConfig> },
  ): Promise<FullOutput<OUTPUT>>;
  async generate(
    messages: MessageListInput,
    options: AgentExecutionOptionsBase<unknown> & {
      structuredOutput?: never;
    } & { model?: DynamicArgument<MastraModelConfig> },
  ): Promise<FullOutput<TOutput>>;
  async generate<OUTPUT = TOutput>(messages: MessageListInput): Promise<FullOutput<OUTPUT>>;
  async generate<OUTPUT = TOutput>(
    messages: MessageListInput,
    options?: AgentExecutionOptionsBase<any> & {
      structuredOutput?: PublicStructuredOutputOptions<any>;
    } & { model?: DynamicArgument<MastraModelConfig> },
  ): Promise<FullOutput<OUTPUT>> {
    // Validate request context if schema is provided
    await this.#validateRequestContext(options?.requestContext);

    // FGA authorization check
    const fgaProvider = this.#mastra?.getServer()?.fga;
    if (fgaProvider) {
      const user = options?.requestContext?.get('user');
      if (user) {
        const { checkFGA } = await import(/* @vite-ignore */ '../auth/ee/fga-check');
        await checkFGA({
          fgaProvider,
          user,
          resource: { type: 'agent', id: this.id },
          permission: MastraFGAPermissions.AGENTS_EXECUTE,
        });
      }
    }

    const defaultOptions = await this.getDefaultOptions({
      requestContext: options?.requestContext,
    });
    const mergedOptions = deepMerge(
      defaultOptions as Record<string, unknown>,
      (options ?? {}) as Record<string, unknown>,
    ) as AgentExecutionOptions<any> & { model?: DynamicArgument<MastraModelConfig> };

    const llm = await this.getLLM({
      requestContext: mergedOptions.requestContext,
      model: mergedOptions.model as DynamicArgument<MastraModelConfig, TRequestContext> | undefined,
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
      structuredOutput: mergedOptions.structuredOutput
        ? {
            ...mergedOptions.structuredOutput,
            // Convert PublicSchema to StandardSchemaWithJSON at API boundary
            // This follows the same pattern as Tool/Workflow constructors
            schema: toStandardSchema(mergedOptions.structuredOutput.schema),
          }
        : undefined,
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

    if (error) {
      throw error;
    }

    return fullOutput;
  }

  async stream<
    OUTPUT extends StandardSchemaWithJSON<any, any>,
    T extends InferStandardSchemaOutput<OUTPUT> = InferStandardSchemaOutput<OUTPUT>,
  >(
    messages: MessageListInput,
    streamOptions: AgentExecutionOptionsBase<T> & {
      structuredOutput: PublicStructuredOutputOptions<T>;
    } & { model?: DynamicArgument<MastraModelConfig> },
  ): Promise<MastraModelOutput<T>>;
  async stream<OUTPUT extends {}>(
    messages: MessageListInput,
    streamOptions: AgentExecutionOptionsBase<OUTPUT> & {
      structuredOutput: PublicStructuredOutputOptions<OUTPUT>;
    } & { model?: DynamicArgument<MastraModelConfig> },
  ): Promise<MastraModelOutput<OUTPUT>>;
  async stream(
    messages: MessageListInput,
    streamOptions: AgentExecutionOptionsBase<unknown> & {
      structuredOutput?: never;
    } & { model?: DynamicArgument<MastraModelConfig> },
  ): Promise<MastraModelOutput<TOutput>>;
  async stream(messages: MessageListInput): Promise<MastraModelOutput<TOutput>>;
  async stream<OUTPUT = TOutput>(
    messages: MessageListInput,
    streamOptions?: AgentExecutionOptionsBase<any> & {
      structuredOutput?: PublicStructuredOutputOptions<any>;
    } & { model?: DynamicArgument<MastraModelConfig> },
  ): Promise<MastraModelOutput<OUTPUT>> {
    // Validate request context if schema is provided
    await this.#validateRequestContext(streamOptions?.requestContext);

    // FGA authorization check
    const streamFgaProvider = this.#mastra?.getServer()?.fga;
    if (streamFgaProvider) {
      const user = streamOptions?.requestContext?.get('user');
      if (user) {
        const { checkFGA } = await import('../auth/ee/fga-check');
        await checkFGA({
          fgaProvider: streamFgaProvider,
          user,
          resource: { type: 'agent', id: this.id },
          permission: MastraFGAPermissions.AGENTS_EXECUTE,
        });
      }
    }

    const defaultOptions = await this.getDefaultOptions({
      requestContext: streamOptions?.requestContext,
    });
    const mergedOptions = deepMerge(
      defaultOptions as Record<string, unknown>,
      (streamOptions ?? {}) as Record<string, unknown>,
    ) as AgentExecutionOptions<OUTPUT> & { model?: DynamicArgument<MastraModelConfig> };

    const llm = await this.getLLM({
      requestContext: mergedOptions.requestContext,
      model: mergedOptions.model as DynamicArgument<MastraModelConfig, TRequestContext> | undefined,
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
      structuredOutput: mergedOptions.structuredOutput
        ? {
            ...mergedOptions.structuredOutput,
            // Convert PublicSchema to StandardSchemaWithJSON at API boundary
            // This follows the same pattern as Tool/Workflow constructors
            schema: toStandardSchema(mergedOptions.structuredOutput.schema),
          }
        : undefined,
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
   * Streams the agent's response and keeps the stream open until all
   * background tasks dispatched during this turn (and any triggered by
   * follow-up turns) complete. When a background task finishes, its tool
   * result is injected into memory by the tool-call-step's `onResult` hook,
   * and this method re-enters the agentic loop via `agent.stream([], ...)`
   * so the LLM can process the result immediately — without waiting for a
   * new user message.
   *
   * Invariants:
   * - Only one inner LLM stream runs at a time (a completion arriving
   *   mid-turn is queued and processed after the current turn ends).
   * - When there are no running background tasks and no queued completions,
   *   the outer stream closes.
   * - If the agent has no memory configured, this falls through to a plain
   *   `stream()` call since continuation requires memory.
   *
   * Return shape: `streamUntilIdle` returns a `MastraModelOutput` that looks
   * like the one from `stream()` — *only* `fullStream` spans the initial
   * turn **and** any auto-continuations. Aggregate properties (`text`,
   * `toolCalls`, `toolResults`, `finishReason`, `messageList`,
   * `getFullOutput()`) still resolve against the **first turn's** internal
   * buffer. If you need an aggregate view across continuations, consume
   * `fullStream` yourself and accumulate — or follow up with `agent.generate`
   * once the stream closes.
   *
   * @example
   * ```typescript
   * const stream = await agent.streamUntilIdle('Research solana for me', {
   *   memory: { thread: 't1', resource: 'u1' },
   * });
   *
   * for await (const chunk of stream.fullStream) {
   *   // chunks from the initial turn AND any continuation turns
   *   // triggered by background task completions flow through here
   * }
   * ```
   */
  async streamUntilIdle<
    OUTPUT extends StandardSchemaWithJSON<any, any>,
    T extends InferStandardSchemaOutput<OUTPUT> = InferStandardSchemaOutput<OUTPUT>,
  >(
    messages: MessageListInput,
    streamOptions: AgentExecutionOptionsBase<T> & {
      structuredOutput: PublicStructuredOutputOptions<T>;
      maxIdleMs?: number;
    } & { model?: DynamicArgument<MastraModelConfig> },
  ): Promise<MastraModelOutput<T>>;
  async streamUntilIdle<OUTPUT extends {}>(
    messages: MessageListInput,
    streamOptions: AgentExecutionOptionsBase<OUTPUT> & {
      structuredOutput: PublicStructuredOutputOptions<OUTPUT>;
      maxIdleMs?: number;
    } & { model?: DynamicArgument<MastraModelConfig> },
  ): Promise<MastraModelOutput<OUTPUT>>;
  async streamUntilIdle(
    messages: MessageListInput,
    streamOptions: AgentExecutionOptionsBase<unknown> & {
      structuredOutput?: never;
      maxIdleMs?: number;
    } & { model?: DynamicArgument<MastraModelConfig> },
  ): Promise<MastraModelOutput<TOutput>>;
  async streamUntilIdle(messages: MessageListInput): Promise<MastraModelOutput<TOutput>>;
  async streamUntilIdle<OUTPUT = TOutput>(
    messages: MessageListInput,
    streamOptions?: AgentExecutionOptionsBase<any> & {
      structuredOutput?: PublicStructuredOutputOptions<any>;
      /** Close the outer stream after this many ms of idleness. Default: 5 minutes. */
      maxIdleMs?: number;
    } & { model?: DynamicArgument<MastraModelConfig> },
  ): Promise<MastraModelOutput<OUTPUT>> {
    return runStreamUntilIdle<OUTPUT>(this, messages, streamOptions, {
      activeStreams: this.#activeStreamUntilIdle,
      bgManager: this.#mastra?.backgroundTaskManager,
    });
  }

  /**
   * Resume-flavored counterpart to {@link streamUntilIdle}. Resumes a
   * previously suspended stream identified by `streamOptions.runId`, then
   * keeps the outer stream open across any continuations that background
   * task completions trigger — same idle-loop semantics as `streamUntilIdle`.
   *
   * Use this when (a) the suspended run produced a background task whose
   * completion should drive a follow-up turn, or (b) a tool dispatched as a
   * background task from inside the resume itself needs the outer stream to
   * stay open until it finishes.
   *
   * @example
   * ```typescript
   * const stream = await agent.resumeStreamUntilIdle(
   *   { approved: true },
   *   { runId: 'previous-run-id', memory: { thread: 't1', resource: 'u1' } },
   * );
   *
   * for await (const chunk of stream.fullStream) {
   *   // chunks from the resumed turn AND any continuation turns
   * }
   * ```
   */
  async resumeStreamUntilIdle<
    OUTPUT extends StandardSchemaWithJSON<any, any>,
    T extends InferStandardSchemaOutput<OUTPUT> = InferStandardSchemaOutput<OUTPUT>,
  >(
    resumeData: any,
    streamOptions: AgentExecutionOptionsBase<T> & {
      structuredOutput: PublicStructuredOutputOptions<T>;
      toolCallId?: string;
      /** Close the outer stream after this many ms of idleness. Default: 5 minutes. */
      maxIdleMs?: number;
    } & { model?: DynamicArgument<MastraModelConfig> },
  ): Promise<MastraModelOutput<T>>;
  async resumeStreamUntilIdle<OUTPUT extends {}>(
    resumeData: any,
    streamOptions: AgentExecutionOptionsBase<OUTPUT> & {
      structuredOutput: PublicStructuredOutputOptions<OUTPUT>;
      toolCallId?: string;
      maxIdleMs?: number;
    } & { model?: DynamicArgument<MastraModelConfig> },
  ): Promise<MastraModelOutput<OUTPUT>>;
  async resumeStreamUntilIdle(
    resumeData: any,
    streamOptions: AgentExecutionOptionsBase<unknown> & {
      structuredOutput?: never;
      toolCallId?: string;
      maxIdleMs?: number;
    } & { model?: DynamicArgument<MastraModelConfig> },
  ): Promise<MastraModelOutput<TOutput>>;
  async resumeStreamUntilIdle<OUTPUT = TOutput>(
    resumeData: any,
    streamOptions?: AgentExecutionOptionsBase<any> & {
      structuredOutput?: PublicStructuredOutputOptions<any>;
      toolCallId?: string;
      maxIdleMs?: number;
    } & { model?: DynamicArgument<MastraModelConfig> },
  ): Promise<MastraModelOutput<OUTPUT>> {
    return runResumeStreamUntilIdle<OUTPUT>(this, resumeData, streamOptions, {
      activeStreams: this.#activeStreamUntilIdle,
      bgManager: this.#mastra?.backgroundTaskManager,
    });
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
  async resumeStream<
    OUTPUT extends StandardSchemaWithJSON<any, any>,
    T extends InferStandardSchemaOutput<OUTPUT> = InferStandardSchemaOutput<OUTPUT>,
  >(
    resumeData: any,
    streamOptions: AgentExecutionOptionsBase<T> & {
      structuredOutput: PublicStructuredOutputOptions<T>;
      toolCallId?: string;
    } & { model?: DynamicArgument<MastraModelConfig> },
  ): Promise<MastraModelOutput<T>>;
  async resumeStream<OUTPUT extends {}>(
    resumeData: any,
    streamOptions: AgentExecutionOptionsBase<OUTPUT> & {
      structuredOutput: PublicStructuredOutputOptions<OUTPUT>;
      toolCallId?: string;
    } & { model?: DynamicArgument<MastraModelConfig> },
  ): Promise<MastraModelOutput<OUTPUT>>;
  async resumeStream(
    resumeData: any,
    streamOptions: AgentExecutionOptionsBase<unknown> & {
      structuredOutput?: never;
      toolCallId?: string;
    } & { model?: DynamicArgument<MastraModelConfig> },
  ): Promise<MastraModelOutput<TOutput>>;
  async resumeStream<OUTPUT = TOutput>(
    resumeData: any,
    streamOptions?: AgentExecutionOptionsBase<any> & {
      structuredOutput?: PublicStructuredOutputOptions<any>;
      toolCallId?: string;
    } & { model?: DynamicArgument<MastraModelConfig> },
  ): Promise<MastraModelOutput<OUTPUT>> {
    const defaultOptions = await this.getDefaultOptions({
      requestContext: streamOptions?.requestContext,
    });

    let mergedStreamOptions = deepMerge(
      defaultOptions as Record<string, unknown>,
      (streamOptions ?? {}) as Record<string, unknown>,
    ) as typeof defaultOptions & { model?: DynamicArgument<MastraModelConfig> };

    const llm = await this.getLLM({
      requestContext: mergedStreamOptions.requestContext,
      model: mergedStreamOptions.model as DynamicArgument<MastraModelConfig, TRequestContext> | undefined,
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

    const runId = streamOptions?.runId ?? '';
    const existingSnapshot = await this.#loadAgenticLoopSnapshotOrThrow({ runId, method: 'resumeStream' });

    const result = await this.#execute({
      ...mergedStreamOptions,
      structuredOutput: mergedStreamOptions.structuredOutput
        ? {
            ...mergedStreamOptions.structuredOutput,
            schema: toStandardSchema(mergedStreamOptions.structuredOutput.schema),
          }
        : undefined,
      messages: [],
      resumeContext: {
        resumeData,
        snapshot: existingSnapshot,
      },
      methodType: 'stream',
      // Use agent's maxProcessorRetries as default, allow options to override
      maxProcessorRetries: mergedStreamOptions.maxProcessorRetries ?? this.#maxProcessorRetries,
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
  async resumeGenerate<
    OUTPUT extends StandardSchemaWithJSON<any, any>,
    T extends InferStandardSchemaOutput<OUTPUT> = InferStandardSchemaOutput<OUTPUT>,
  >(
    resumeData: any,
    options: AgentExecutionOptionsBase<T> & {
      structuredOutput: PublicStructuredOutputOptions<T>;
      toolCallId?: string;
    } & { model?: DynamicArgument<MastraModelConfig> },
  ): Promise<FullOutput<T>>;
  async resumeGenerate<OUTPUT extends {}>(
    resumeData: any,
    options: AgentExecutionOptionsBase<OUTPUT> & {
      structuredOutput: PublicStructuredOutputOptions<OUTPUT>;
      toolCallId?: string;
    } & { model?: DynamicArgument<MastraModelConfig> },
  ): Promise<FullOutput<OUTPUT>>;
  async resumeGenerate(
    resumeData: any,
    options: AgentExecutionOptionsBase<unknown> & {
      structuredOutput?: never;
      toolCallId?: string;
    } & { model?: DynamicArgument<MastraModelConfig> },
  ): Promise<FullOutput<TOutput>>;
  async resumeGenerate<OUTPUT = TOutput>(
    resumeData: any,
    options?: AgentExecutionOptionsBase<any> & {
      structuredOutput?: PublicStructuredOutputOptions<any>;
      toolCallId?: string;
    } & { model?: DynamicArgument<MastraModelConfig> },
  ): Promise<FullOutput<OUTPUT>> {
    const defaultOptions = await this.getDefaultOptions({
      requestContext: options?.requestContext,
    });

    const mergedOptions = deepMerge(
      defaultOptions as Record<string, unknown>,
      (options ?? {}) as Record<string, unknown>,
    ) as typeof defaultOptions & { model?: DynamicArgument<MastraModelConfig> };

    const llm = await this.getLLM({
      requestContext: mergedOptions.requestContext,
      model: mergedOptions.model as DynamicArgument<MastraModelConfig, TRequestContext> | undefined,
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

    const runId = options?.runId ?? '';
    const existingSnapshot = await this.#loadAgenticLoopSnapshotOrThrow({ runId, method: 'resumeGenerate' });

    const result = await this.#execute({
      ...mergedOptions,
      structuredOutput: mergedOptions.structuredOutput
        ? {
            ...mergedOptions.structuredOutput,
            schema: toStandardSchema(mergedOptions.structuredOutput.schema),
          }
        : undefined,
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

    if (error) {
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
    // @ts-expect-error - the types here are wrong
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
    // @ts-expect-error - the types here are wrong
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
    // @ts-expect-error - the types here are wrong
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
    // @ts-expect-error - the types here are wrong
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
    args?: AgentGenerateOptions<undefined, undefined> & {
      output?: never;
      experimental_output?: never;
      model?: DynamicArgument<MastraModelConfig>;
    },
  ): Promise<GenerateTextResult<any, undefined>>;
  async generateLegacy<OUTPUT extends ZodSchema | JSONSchema7>(
    messages: MessageListInput,
    args?: AgentGenerateOptions<OUTPUT, undefined> & {
      output?: OUTPUT;
      experimental_output?: never;
      model?: DynamicArgument<MastraModelConfig>;
    },
  ): Promise<GenerateObjectResult<OUTPUT>>;
  async generateLegacy<EXPERIMENTAL_OUTPUT extends ZodSchema | JSONSchema7>(
    messages: MessageListInput,
    args?: AgentGenerateOptions<undefined, EXPERIMENTAL_OUTPUT> & {
      output?: never;
      experimental_output?: EXPERIMENTAL_OUTPUT;
      model?: DynamicArgument<MastraModelConfig>;
    },
  ): Promise<GenerateTextResult<any, EXPERIMENTAL_OUTPUT>>;
  async generateLegacy<
    OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
    EXPERIMENTAL_OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
  >(
    messages: MessageListInput,
    generateOptions: AgentGenerateOptions<OUTPUT, EXPERIMENTAL_OUTPUT> & {
      model?: DynamicArgument<MastraModelConfig>;
    } = {},
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
    args?: AgentStreamOptions<OUTPUT, EXPERIMENTAL_OUTPUT> & {
      output?: never;
      experimental_output?: never;
      model?: DynamicArgument<MastraModelConfig>;
    },
  ): Promise<StreamTextResult<any, OUTPUT>>;
  async streamLegacy<
    OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
    EXPERIMENTAL_OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
  >(
    messages: MessageListInput,
    args?: AgentStreamOptions<OUTPUT, EXPERIMENTAL_OUTPUT> & {
      output?: OUTPUT;
      experimental_output?: never;
      model?: DynamicArgument<MastraModelConfig>;
    },
  ): Promise<StreamObjectResult<OUTPUT extends ZodSchema | JSONSchema7 ? OUTPUT : never> & TracingProperties>;
  async streamLegacy<
    OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
    EXPERIMENTAL_OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
  >(
    messages: MessageListInput,
    args?: AgentStreamOptions<OUTPUT, EXPERIMENTAL_OUTPUT> & {
      output?: never;
      experimental_output?: EXPERIMENTAL_OUTPUT;
      model?: DynamicArgument<MastraModelConfig>;
    },
  ): Promise<
    StreamTextResult<any, EXPERIMENTAL_OUTPUT> & {
      partialObjectStream: StreamTextResult<any, EXPERIMENTAL_OUTPUT>['experimental_partialOutputStream'];
    }
  >;
  async streamLegacy<
    OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
    EXPERIMENTAL_OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
  >(
    messages: MessageListInput,
    streamOptions: AgentStreamOptions<OUTPUT, EXPERIMENTAL_OUTPUT> & {
      model?: DynamicArgument<MastraModelConfig>;
    } = {},
  ): Promise<
    | StreamTextResult<any, OUTPUT>
    | (StreamObjectResult<OUTPUT extends ZodSchema | JSONSchema7 ? OUTPUT : never> & TracingProperties)
  > {
    return this.getLegacyHandler().streamLegacy(messages, streamOptions) as Promise<
      | StreamTextResult<any, OUTPUT>
      | (StreamObjectResult<OUTPUT extends ZodSchema | JSONSchema7 ? OUTPUT : never> & TracingProperties)
    >;
  }

  /**
   * Resolves the configuration for title generation.
   * @internal
   */
  resolveTitleGenerationConfig(
    generateTitleConfig:
      | boolean
      | {
          model?: DynamicArgument<MastraModelConfig, TRequestContext>;
          instructions?: DynamicArgument<string>;
          minMessages?: number;
        }
      | undefined,
  ): {
    shouldGenerate: boolean;
    model?: DynamicArgument<MastraModelConfig, TRequestContext>;
    instructions?: DynamicArgument<string>;
    minMessages?: number;
  } {
    if (typeof generateTitleConfig === 'boolean') {
      return { shouldGenerate: generateTitleConfig };
    }

    if (typeof generateTitleConfig === 'object' && generateTitleConfig !== null) {
      return {
        shouldGenerate: true,
        model: generateTitleConfig.model,
        instructions: generateTitleConfig.instructions,
        minMessages: generateTitleConfig.minMessages,
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
