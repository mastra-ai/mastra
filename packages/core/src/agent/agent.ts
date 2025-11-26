import { randomUUID } from 'crypto';
import type { WritableStream } from 'stream/web';
import { OpenAIReasoningSchemaCompatLayer, OpenAISchemaCompatLayer } from '@mastra/schema-compat';
import type { ModelInformation } from '@mastra/schema-compat';
import slugify from '@sindresorhus/slugify';
import type { CoreMessage, StreamObjectResult, TextPart, Tool, UIMessage } from 'ai';
import deepEqual from 'fast-deep-equal';
import type { JSONSchema7 } from 'json-schema';
import { z } from 'zod';
import type { ZodSchema } from 'zod';
import type { MastraPrimitives, MastraUnion } from '../action';
import { AISpanType, getOrCreateSpan, getValidTraceId } from '../ai-tracing';
import type { AISpan, TracingContext, TracingOptions, TracingProperties } from '../ai-tracing';
import { MastraBase } from '../base';
import { MastraError, ErrorDomain, ErrorCategory } from '../error';
import type { Metric } from '../eval';
import { AvailableHooks, executeHook } from '../hooks';
import { resolveModelConfig } from '../llm';
import { MastraLLMV1 } from '../llm/model';
import type {
  GenerateObjectWithMessagesArgs,
  GenerateTextWithMessagesArgs,
  GenerateReturn,
  GenerateObjectResult,
  GenerateTextResult,
  StreamTextWithMessagesArgs,
  StreamObjectWithMessagesArgs,
  StreamReturn,
  ToolSet,
  OriginalStreamTextOnFinishEventArg,
  OriginalStreamObjectOnFinishEventArg,
  StreamTextResult,
} from '../llm/model/base.types';
import { isV2Model } from '../llm/model/is-v2-model';
import { MastraLLMVNext } from '../llm/model/model.loop';
import type {
  TripwireProperties,
  MastraLanguageModel,
  MastraLanguageModelV2,
  MastraModelConfig,
} from '../llm/model/shared.types';
import { RegisteredLogger } from '../logger';
import { networkLoop } from '../loop/network';
import type { Mastra } from '../mastra';
import type { MastraMemory } from '../memory/memory';
import type { MemoryConfig, StorageThreadType } from '../memory/types';
import type { InputProcessor, OutputProcessor } from '../processors/index';
import { ProcessorRunner } from '../processors/runner';
import { RuntimeContext } from '../runtime-context';
import type {
  ScorerRunInputForAgent,
  ScorerRunOutputForAgent,
  MastraScorers,
  MastraScorer,
  ScoringSamplingConfig,
} from '../scores';
import { runScorer } from '../scores/hooks';
import type { AISDKV5OutputStream } from '../stream';
import type { MastraModelOutput } from '../stream/base/output';
import type { OutputSchema } from '../stream/base/schema';
import type { ChunkType } from '../stream/types';
import { InstrumentClass } from '../telemetry';
import { Telemetry } from '../telemetry/telemetry';
import { createTool } from '../tools';
import type { CoreTool } from '../tools/types';
import type { DynamicArgument } from '../types';
import { makeCoreTool, createMastraProxy, ensureToolProperties, isZodType } from '../utils';
import type { ToolOptions } from '../utils';
import type { CompositeVoice } from '../voice';
import { DefaultVoice } from '../voice';
import type { Workflow } from '../workflows';
import { agentToStep, LegacyStep as Step } from '../workflows/legacy';
import type {
  AgentExecutionOptions,
  DeprecatedOutputOptions,
  InnerAgentExecutionOptions,
  MultiPrimitiveExecutionOptions,
} from './agent.types';
import { MessageList } from './message-list';
import type { MessageInput, MessageListInput, UIMessageWithMetadata } from './message-list';
import { SaveQueueManager } from './save-queue';
import { TripWire } from './trip-wire';
import type {
  AgentConfig,
  AgentGenerateOptions,
  AgentStreamOptions,
  ToolsetsInput,
  ToolsInput,
  AgentMemoryOption,
  AgentModelManagerConfig,
  AgentCreateOptions,
  AgentExecuteOnFinishOptions,
  AgentInstructions,
  DynamicAgentInstructions,
  StructuredOutputOptions,
  AgentMethodType,
} from './types';
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

// Helper to resolve threadId from args (supports both new and old API)
function resolveThreadIdFromArgs(args: {
  memory?: AgentMemoryOption;
  threadId?: string;
}): (Partial<StorageThreadType> & { id: string }) | undefined {
  if (args?.memory?.thread) {
    if (typeof args.memory.thread === 'string') return { id: args.memory.thread };
    if (typeof args.memory.thread === 'object' && args.memory.thread.id) return args.memory.thread;
  }
  if (args?.threadId) return { id: args.threadId };
  return undefined;
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
 *   name: 'my-agent',
 *   instructions: 'You are a helpful assistant',
 *   model: 'openai/gpt-5',
 *   tools: {
 *     calculator: calculatorTool,
 *   },
 *   memory: new Memory(),
 * });
 * ```
 */
@InstrumentClass({
  prefix: 'agent',
  excludeMethods: [
    'hasOwnMemory',
    'getMemory',
    '__primitive',
    '__registerMastra',
    '__registerPrimitives',
    '__runInputProcessors',
    '__runOutputProcessors',
    '_wrapToolsWithAITracing',
    'getProcessorRunner',
    '__setTools',
    '__setLogger',
    '__setTelemetry',
    'log',
    'listAgents',
    'getModel',
    'getInstructions',
    'getTools',
    'getLLM',
    'getWorkflows',
    'getDefaultGenerateOptions',
    'getDefaultStreamOptions',
    'getDescription',
    'getScorers',
    'getVoice',
  ],
})
export class Agent<
  TAgentId extends string = string,
  TTools extends ToolsInput = ToolsInput,
  TMetrics extends Record<string, Metric> = Record<string, Metric>,
> extends MastraBase {
  public id: TAgentId;
  public name: TAgentId;
  #instructions: DynamicAgentInstructions;
  readonly #description?: string;
  model: DynamicArgument<MastraModelConfig> | ModelFallbacks;
  #originalModel: DynamicArgument<MastraModelConfig> | ModelFallbacks;
  maxRetries?: number;
  #mastra?: Mastra;
  #memory?: DynamicArgument<MastraMemory>;
  #workflows?: DynamicArgument<Record<string, Workflow<any, any, any, any, any, any>>>;
  #defaultGenerateOptions: DynamicArgument<AgentGenerateOptions>;
  #defaultStreamOptions: DynamicArgument<AgentStreamOptions>;
  #defaultVNextStreamOptions: DynamicArgument<AgentExecutionOptions & DeprecatedOutputOptions>;
  #tools: DynamicArgument<TTools>;
  evals: TMetrics;
  #scorers: DynamicArgument<MastraScorers>;
  #agents: DynamicArgument<Record<string, Agent>>;
  #voice: CompositeVoice;
  #inputProcessors?: DynamicArgument<InputProcessor[]>;
  #outputProcessors?: DynamicArgument<OutputProcessor[]>;
  readonly #options?: AgentCreateOptions;

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
   *   name: 'weatherAgent',
   *   instructions: 'You help users with weather information',
   *   model: 'openai/gpt-5',
   *   tools: { getWeather },
   *   memory: new Memory(),
   *   maxRetries: 2,
   * });
   * ```
   */
  constructor(config: AgentConfig<TAgentId, TTools, TMetrics>) {
    super({ component: RegisteredLogger.AGENT });

    this.name = config.name;
    this.id = config.id ?? config.name;

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

    this.#defaultGenerateOptions = config.defaultGenerateOptions || {};
    this.#defaultStreamOptions = config.defaultStreamOptions || {};
    this.#defaultVNextStreamOptions = config.defaultVNextStreamOptions || {};

    this.#tools = config.tools || ({} as TTools);

    this.evals = {} as TMetrics;

    if (config.mastra) {
      this.__registerMastra(config.mastra);
      this.__registerPrimitives({
        telemetry: config.mastra.getTelemetry(),
        logger: config.mastra.getLogger(),
      });
    }

    this.#scorers = config.scorers || ({} as MastraScorers);

    this.#agents = config.agents || ({} as Record<string, Agent>);

    if (config.evals) {
      this.evals = config.evals;
    }

    if (config.memory) {
      this.#memory = config.memory;
    }

    if (config.voice) {
      this.#voice = config.voice;
      if (typeof config.tools !== 'function') {
        this.#voice?.addTools(this.tools);
      }
      if (typeof config.instructions === 'string') {
        this.#voice?.addInstructions(config.instructions);
      }
    } else {
      this.#voice = new DefaultVoice();
    }

    if (config.inputProcessors) {
      this.#inputProcessors = config.inputProcessors;
    }

    if (config.outputProcessors) {
      this.#outputProcessors = config.outputProcessors;
    }

    // @ts-ignore Flag for agent network messages
    this._agentNetworkAppend = config._agentNetworkAppend || false;
  }

  getMastraInstance() {
    return this.#mastra;
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
  public listAgents({ runtimeContext = new RuntimeContext() }: { runtimeContext?: RuntimeContext } = {}) {
    const agentsToUse = this.#agents
      ? typeof this.#agents === 'function'
        ? this.#agents({ runtimeContext })
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

      return agents;
    });
  }

  /**
   * Creates and returns a ProcessorRunner with resolved input/output processors.
   * @internal
   */
  private async getProcessorRunner({
    runtimeContext,
    inputProcessorOverrides,
    outputProcessorOverrides,
  }: {
    runtimeContext: RuntimeContext;
    inputProcessorOverrides?: InputProcessor[];
    outputProcessorOverrides?: OutputProcessor[];
  }): Promise<ProcessorRunner> {
    // Use overrides if provided, otherwise fall back to agent's default processors
    const inputProcessors =
      inputProcessorOverrides ??
      (this.#inputProcessors
        ? typeof this.#inputProcessors === 'function'
          ? await this.#inputProcessors({ runtimeContext })
          : this.#inputProcessors
        : []);

    const outputProcessors =
      outputProcessorOverrides ??
      (this.#outputProcessors
        ? typeof this.#outputProcessors === 'function'
          ? await this.#outputProcessors({ runtimeContext })
          : this.#outputProcessors
        : []);

    this.logger.debug('outputProcessors', outputProcessors);

    return new ProcessorRunner({
      inputProcessors,
      outputProcessors,
      logger: this.logger,
      agentName: this.name,
    });
  }

  /**
   * Resolves and returns output processors from agent configuration.
   * @internal
   */
  private async getResolvedOutputProcessors(runtimeContext?: RuntimeContext): Promise<OutputProcessor[]> {
    if (!this.#outputProcessors) {
      return [];
    }

    if (typeof this.#outputProcessors === 'function') {
      return await this.#outputProcessors({ runtimeContext: runtimeContext || new RuntimeContext() });
    }

    return this.#outputProcessors;
  }

  /**
   * Resolves and returns input processors from agent configuration.
   * @internal
   */
  private async getResolvedInputProcessors(runtimeContext?: RuntimeContext): Promise<InputProcessor[]> {
    if (!this.#inputProcessors) {
      return [];
    }

    if (typeof this.#inputProcessors === 'function') {
      return await this.#inputProcessors({ runtimeContext: runtimeContext || new RuntimeContext() });
    }

    return this.#inputProcessors;
  }

  /**
   * Returns the input processors for this agent, resolving function-based processors if necessary.
   */
  public async getInputProcessors(runtimeContext?: RuntimeContext): Promise<InputProcessor[]> {
    return this.getResolvedInputProcessors(runtimeContext);
  }

  /**
   * Returns the output processors for this agent, resolving function-based processors if necessary.
   */
  public async getOutputProcessors(runtimeContext?: RuntimeContext): Promise<OutputProcessor[]> {
    return this.getResolvedOutputProcessors(runtimeContext);
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
  public async getMemory({ runtimeContext = new RuntimeContext() }: { runtimeContext?: RuntimeContext } = {}): Promise<
    MastraMemory | undefined
  > {
    if (!this.#memory) {
      return undefined;
    }

    let resolvedMemory: MastraMemory;

    if (typeof this.#memory !== 'function') {
      resolvedMemory = this.#memory;
    } else {
      const result = this.#memory({ runtimeContext, mastra: this.#mastra });
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
   * Gets the workflows configured for this agent, resolving function-based workflows if necessary.
   * Workflows are step-based execution flows that can be triggered by the agent.
   *
   * @example
   * ```typescript
   * const workflows = await agent.getWorkflows();
   * const workflow = workflows['myWorkflow'];
   * ```
   */
  public async getWorkflows({
    runtimeContext = new RuntimeContext(),
  }: { runtimeContext?: RuntimeContext } = {}): Promise<Record<string, Workflow<any, any, any, any, any, any>>> {
    let workflowRecord;
    if (typeof this.#workflows === 'function') {
      workflowRecord = await Promise.resolve(this.#workflows({ runtimeContext, mastra: this.#mastra }));
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

  async getScorers({
    runtimeContext = new RuntimeContext(),
  }: { runtimeContext?: RuntimeContext } = {}): Promise<MastraScorers> {
    if (typeof this.#scorers !== 'function') {
      return this.#scorers;
    }

    const result = this.#scorers({ runtimeContext, mastra: this.#mastra });
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
  public async getVoice({ runtimeContext }: { runtimeContext?: RuntimeContext } = {}) {
    if (this.#voice) {
      const voice = this.#voice;
      voice?.addTools(await this.getTools({ runtimeContext }));
      const instructions = await this.getInstructions({ runtimeContext });
      voice?.addInstructions(this.#convertInstructionsToString(instructions));
      return voice;
    } else {
      return new DefaultVoice();
    }
  }

  get instructions() {
    this.logger.warn('The instructions property is deprecated. Please use getInstructions() instead.');

    if (typeof this.#instructions === 'function') {
      const mastraError = new MastraError({
        id: 'AGENT_INSTRUCTIONS_INCOMPATIBLE_WITH_FUNCTION_INSTRUCTIONS',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        details: {
          agentName: this.name,
        },
        text: 'Instructions are not compatible when instructions are a function. Please use getInstructions() instead.',
      });
      this.logger.trackException(mastraError);
      this.logger.error(mastraError.toString());
      throw mastraError;
    }

    // Throw error for non-string instructions to force migration
    if (typeof this.#instructions !== 'string') {
      const mastraError = new MastraError({
        id: 'AGENT_INSTRUCTIONS_MUST_BE_STRING_FOR_DEPRECATED_GETTER',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        details: {
          agentName: this.name,
          instructionsType: Array.isArray(this.#instructions) ? 'array' : 'object',
        },
        text: 'The instructions getter is deprecated and only supports string instructions. For non-string instructions, please use getInstructions() instead.',
      });
      this.logger.trackException(mastraError);
      this.logger.error(mastraError.toString());
      throw mastraError;
    }

    return this.#instructions;
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
  public getInstructions({ runtimeContext = new RuntimeContext() }: { runtimeContext?: RuntimeContext } = {}):
    | AgentInstructions
    | Promise<AgentInstructions> {
    if (typeof this.#instructions === 'function') {
      const result = this.#instructions({ runtimeContext, mastra: this.#mastra });
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
   * Used for legacy methods that expect string instructions (e.g., voice, telemetry)
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
   * Gets the default generate options for this agent, resolving function-based options if necessary.
   * These options are used as defaults when calling `generate()` without explicit options.
   *
   * @example
   * ```typescript
   * const options = await agent.getDefaultGenerateOptions();
   * console.log(options.maxSteps); // 5
   * ```
   */
  public getDefaultGenerateOptions({
    runtimeContext = new RuntimeContext(),
  }: { runtimeContext?: RuntimeContext } = {}): AgentGenerateOptions | Promise<AgentGenerateOptions> {
    if (typeof this.#defaultGenerateOptions !== 'function') {
      return this.#defaultGenerateOptions;
    }

    const result = this.#defaultGenerateOptions({ runtimeContext, mastra: this.#mastra });
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
   * Gets the default stream options for this agent, resolving function-based options if necessary.
   * These options are used as defaults when calling `stream()` without explicit options.
   *
   * @example
   * ```typescript
   * const options = await agent.getDefaultStreamOptions();
   * console.log(options.temperature); // 0.7
   * ```
   */
  public getDefaultStreamOptions({ runtimeContext = new RuntimeContext() }: { runtimeContext?: RuntimeContext } = {}):
    | AgentStreamOptions
    | Promise<AgentStreamOptions> {
    if (typeof this.#defaultStreamOptions !== 'function') {
      return this.#defaultStreamOptions;
    }

    const result = this.#defaultStreamOptions({ runtimeContext, mastra: this.#mastra });
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
   * Gets the default VNext stream options for this agent, resolving function-based options if necessary.
   * These options are used as defaults when calling `streamVNext()` or `generateVNext()` without explicit options.
   *
   * @example
   * ```typescript
   * const options = await agent.getDefaultVNextStreamOptions();
   * console.log(options.maxSteps); // 5
   * ```
   */
  public getDefaultVNextStreamOptions<OUTPUT extends OutputSchema = undefined>({
    runtimeContext = new RuntimeContext(),
  }: { runtimeContext?: RuntimeContext } = {}): AgentExecutionOptions<OUTPUT> | Promise<AgentExecutionOptions<OUTPUT>> {
    if (typeof this.#defaultVNextStreamOptions !== 'function') {
      if (this.#defaultVNextStreamOptions.output && this.#defaultVNextStreamOptions.structuredOutput) {
        throw new MastraError({
          id: 'AGENT_GET_DEFAULT_VNEXT_STREAM_OPTIONS_OUTPUT_AND_STRUCTURED_OUTPUT_PROVIDED',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          text: 'output and structuredOutput cannot be provided at the same time',
        });
      }

      const { output, ...defaultVNextStreamOptions } = this.#defaultVNextStreamOptions;
      return {
        ...(output ? { structuredOutput: { schema: output } } : {}),
        ...defaultVNextStreamOptions,
      } as AgentExecutionOptions<OUTPUT>;
    }

    const result = this.#defaultVNextStreamOptions({ runtimeContext, mastra: this.#mastra }) as
      | (AgentExecutionOptions<OUTPUT> & DeprecatedOutputOptions<OUTPUT>)
      | Promise<AgentExecutionOptions<OUTPUT> & DeprecatedOutputOptions<OUTPUT>>;

    return resolveMaybePromise(result, options => {
      if (!options) {
        const mastraError = new MastraError({
          id: 'AGENT_GET_DEFAULT_VNEXT_STREAM_OPTIONS_FUNCTION_EMPTY_RETURN',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          details: {
            agentName: this.name,
          },
          text: `[Agent:${this.name}] - Function-based default vnext stream options returned empty value`,
        });
        this.logger.trackException(mastraError);
        this.logger.error(mastraError.toString());
        throw mastraError;
      }

      if (options.output && options.structuredOutput) {
        throw new MastraError({
          id: 'AGENT_GET_DEFAULT_VNEXT_STREAM_OPTIONS_OUTPUT_AND_STRUCTURED_OUTPUT_PROVIDED',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          text: 'output and structuredOutput cannot be provided at the same time',
        });
      }

      const { output, ...restOptions } = options;

      return {
        ...(output ? { structuredOutput: { schema: output } } : {}),
        ...restOptions,
      } as AgentExecutionOptions<OUTPUT>;
    });
  }

  get tools() {
    this.logger.warn('The tools property is deprecated. Please use getTools() instead.');

    if (typeof this.#tools === 'function') {
      const mastraError = new MastraError({
        id: 'AGENT_GET_TOOLS_FUNCTION_INCOMPATIBLE_WITH_TOOL_FUNCTION_TYPE',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        details: {
          agentName: this.name,
        },
        text: 'Tools are not compatible when tools are a function. Please use getTools() instead.',
      });
      this.logger.trackException(mastraError);
      this.logger.error(mastraError.toString());
      throw mastraError;
    }

    return ensureToolProperties(this.#tools) as TTools;
  }

  /**
   * Gets the tools configured for this agent, resolving function-based tools if necessary.
   * Tools extend the agent's capabilities, allowing it to perform specific actions or access external systems.
   *
   * @example
   * ```typescript
   * const tools = await agent.getTools();
   * console.log(Object.keys(tools)); // ['calculator', 'weather']
   * ```
   */
  public getTools({ runtimeContext = new RuntimeContext() }: { runtimeContext?: RuntimeContext } = {}):
    | TTools
    | Promise<TTools> {
    if (typeof this.#tools !== 'function') {
      return ensureToolProperties(this.#tools) as TTools;
    }

    const result = this.#tools({ runtimeContext, mastra: this.#mastra });

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

  get llm() {
    this.logger.warn('The llm property is deprecated. Please use getLLM() instead.');

    if (typeof this.model === 'function') {
      const mastraError = new MastraError({
        id: 'AGENT_LLM_GETTER_INCOMPATIBLE_WITH_FUNCTION_MODEL',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        details: {
          agentName: this.name,
        },
        text: 'LLM is not compatible when model is a function. Please use getLLM() instead.',
      });
      this.logger.trackException(mastraError);
      this.logger.error(mastraError.toString());
      throw mastraError;
    }

    return this.getLLM();
  }

  /**
   * Gets or creates an LLM instance based on the provided or configured model.
   * The LLM wraps the language model with additional capabilities like telemetry and error handling.
   *
   * @example
   * ```typescript
   * const llm = await agent.getLLM();
   * // Use with custom model
   * const customLlm = await agent.getLLM({ model: 'openai/gpt-5' });
   * ```
   */
  public getLLM({
    runtimeContext = new RuntimeContext(),
    model,
  }: {
    runtimeContext?: RuntimeContext;
    model?: DynamicArgument<MastraModelConfig>;
  } = {}): MastraLLM | Promise<MastraLLM> {
    // If model is provided, resolve it; otherwise use the agent's model
    const modelToUse = this.getModel({ modelConfig: model, runtimeContext });

    return resolveMaybePromise(modelToUse, resolvedModel => {
      let llm: MastraLLM | Promise<MastraLLM>;
      if (resolvedModel.specificationVersion === 'v2') {
        const modelsPromise =
          Array.isArray(this.model) && !model
            ? this.prepareModels(runtimeContext)
            : this.prepareModels(runtimeContext, resolvedModel);

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
    runtimeContext: RuntimeContext,
  ): Promise<MastraLanguageModel> {
    try {
      return await resolveModelConfig(modelConfig, runtimeContext, this.#mastra);
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
    runtimeContext = new RuntimeContext(),
    modelConfig = this.model,
  }: { runtimeContext?: RuntimeContext; modelConfig?: Agent['model'] } = {}):
    | MastraLanguageModel
    | Promise<MastraLanguageModel> {
    if (!Array.isArray(modelConfig)) return this.resolveModelConfig(modelConfig, runtimeContext);

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
    return this.resolveModelConfig(modelConfig[0].model, runtimeContext);
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
    runtimeContext: RuntimeContext = new RuntimeContext(),
  ): Promise<Array<AgentModelManagerConfig> | null> {
    if (!Array.isArray(this.model)) {
      return null;
    }
    return this.prepareModels(runtimeContext);
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
      return aIndex - bIndex;
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
   * Registers telemetry and logger primitives with the agent.
   * @internal
   */
  __registerPrimitives(p: MastraPrimitives) {
    if (p.telemetry) {
      this.__setTelemetry(p.telemetry);
    }

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
    // Mastra will be passed to the LLM when it's created in getLLM()
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
    runtimeContext = new RuntimeContext(),
    tracingContext,
    model,
    instructions,
  }: {
    message: string | MessageInput;
    runtimeContext?: RuntimeContext;
    tracingContext: TracingContext;
    model?: DynamicArgument<MastraLanguageModel>;
    instructions?: DynamicArgument<string>;
  }) {
    // need to use text, not object output or it will error for models that don't support structured output (eg Deepseek R1)
    const llm = await this.getLLM({ runtimeContext, model });

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
    const systemInstructions = await this.resolveTitleInstructions(runtimeContext, instructions);

    let text = '';

    if (llm.getModel().specificationVersion === 'v2') {
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
        runtimeContext,
        tracingContext,
        messageList,
        agentId: this.id,
      });

      text = await result.text;
    } else {
      const result = await (llm as MastraLLMV1).__text({
        runtimeContext,
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
    runtimeContext: RuntimeContext,
    tracingContext: TracingContext,
    model?: DynamicArgument<MastraLanguageModel>,
    instructions?: DynamicArgument<string>,
  ) {
    try {
      if (userMessage) {
        const normMessage = new MessageList().add(userMessage, 'user').get.all.ui().at(-1);
        if (normMessage) {
          return await this.generateTitleFromUserMessage({
            message: normMessage,
            runtimeContext,
            tracingContext,
            model,
            instructions,
          });
        }
      }
      // If no user message, return a default title for new threads
      return `New Thread ${new Date().toISOString()}`;
    } catch (e) {
      this.logger.error('Error generating title:', e);
      // Return undefined on error so existing title is preserved
      return undefined;
    }
  }

  public __setMemory(memory: DynamicArgument<MastraMemory>) {
    this.#memory = memory;
  }

  /* @deprecated use agent.getMemory() and query memory directly */
  async fetchMemory({
    threadId,
    thread: passedThread,
    memoryConfig,
    resourceId,
    runId,
    userMessages,
    systemMessage,
    messageList = new MessageList({ threadId, resourceId }),
    runtimeContext = new RuntimeContext(),
  }: {
    resourceId: string;
    threadId: string;
    thread?: StorageThreadType;
    memoryConfig?: MemoryConfig;
    userMessages?: CoreMessage[];
    systemMessage?: CoreMessage;
    runId?: string;
    messageList?: MessageList;
    runtimeContext?: RuntimeContext;
  }) {
    const memory = await this.getMemory({ runtimeContext });
    if (memory) {
      const thread = passedThread ?? (await memory.getThreadById({ threadId }));

      if (!thread) {
        // If no thread, nothing to fetch from memory.
        // The messageList already contains the current user messages and system message.
        return { threadId: threadId || '', messages: userMessages || [] };
      }

      if (userMessages && userMessages.length > 0) {
        messageList.add(userMessages, 'memory');
      }

      if (systemMessage?.role === 'system') {
        messageList.addSystem(systemMessage, 'memory');
      }

      const [memoryMessages, memorySystemMessage] =
        threadId && memory
          ? await Promise.all([
              memory
                .rememberMessages({
                  threadId,
                  resourceId,
                  config: memoryConfig,
                  vectorMessageSearch: messageList.getLatestUserContent() || '',
                })
                .then((r: any) => r.messagesV2),
              memory.getSystemMessage({ threadId, memoryConfig }),
            ])
          : [[], null];

      this.logger.debug('Fetched messages from memory', {
        threadId,
        runId,
        fetchedCount: memoryMessages.length,
      });

      if (memorySystemMessage) {
        messageList.addSystem(memorySystemMessage, 'memory');
      }

      messageList.add(memoryMessages, 'memory');

      const systemMessages =
        messageList
          .getSystemMessages()
          ?.map(m => m.content)
          ?.join(`\n`) ?? undefined;

      const newMessages = messageList.get.input.v1() as CoreMessage[];

      const processedMemoryMessages = await memory.processMessages({
        // these will be processed
        messages: messageList.get.remembered.v1() as CoreMessage[],
        // these are here for inspecting but shouldn't be returned by the processor
        // - ex TokenLimiter needs to measure all tokens even though it's only processing remembered messages
        newMessages,
        systemMessage: systemMessages,
        memorySystemMessage: memorySystemMessage || undefined,
      });

      const returnList = new MessageList()
        .addSystem(systemMessages)
        .add(processedMemoryMessages, 'memory')
        .add(newMessages, 'user');

      return {
        threadId: thread.id,
        messages: returnList.get.all.prompt(),
      };
    }

    return { threadId: threadId || '', messages: userMessages || [] };
  }

  /**
   * Retrieves and converts memory tools to CoreTool format.
   * @internal
   */
  private async getMemoryTools({
    runId,
    resourceId,
    threadId,
    runtimeContext,
    tracingContext,
    mastraProxy,
  }: {
    runId?: string;
    resourceId?: string;
    threadId?: string;
    runtimeContext: RuntimeContext;
    tracingContext?: TracingContext;
    mastraProxy?: MastraUnion;
  }) {
    let convertedMemoryTools: Record<string, CoreTool> = {};

    if (this._agentNetworkAppend) {
      this.logger.debug(`[Agent:${this.name}] - Skipping memory tools (agent network context)`, { runId });
      return convertedMemoryTools;
    }

    // Get memory tools if available
    const memory = await this.getMemory({ runtimeContext });
    const memoryTools = memory?.getTools?.();

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
          runtimeContext,
          tracingContext,
          model: await this.getModel({ runtimeContext }),
          tracingPolicy: this.#options?.tracingPolicy,
        };
        const convertedToCoreTool = makeCoreTool(toolObj, options);
        convertedMemoryTools[toolName] = convertedToCoreTool;
      }
    }
    return convertedMemoryTools;
  }

  /**
   * Executes input processors on the message list before LLM processing.
   * @internal
   */
  private async __runInputProcessors({
    runtimeContext,
    tracingContext,
    messageList,
    inputProcessorOverrides,
  }: {
    runtimeContext: RuntimeContext;
    tracingContext: TracingContext;
    messageList: MessageList;
    inputProcessorOverrides?: InputProcessor[];
  }): Promise<{
    messageList: MessageList;
    tripwireTriggered: boolean;
    tripwireReason: string;
  }> {
    let tripwireTriggered = false;
    let tripwireReason = '';

    if (inputProcessorOverrides?.length || this.#inputProcessors) {
      const runner = await this.getProcessorRunner({
        runtimeContext,
        inputProcessorOverrides,
      });
      // Create traced version of runInputProcessors similar to workflow _runStep pattern
      const tracedRunInputProcessors = (messageList: MessageList, tracingContext: TracingContext) => {
        const telemetry = this.#mastra?.getTelemetry();
        if (!telemetry) {
          return runner.runInputProcessors(messageList, tracingContext, undefined);
        }

        return telemetry.traceMethod(
          async (data: { messageList: MessageList }) => {
            return runner.runInputProcessors(data.messageList, tracingContext, telemetry);
          },
          {
            spanName: `agent.${this.name}.inputProcessors`,
            attributes: {
              'agent.name': this.name,
              'inputProcessors.count': runner.inputProcessors.length.toString(),
              'inputProcessors.names': runner.inputProcessors.map(p => p.name).join(','),
            },
          },
        )({ messageList });
      };

      try {
        messageList = await tracedRunInputProcessors(messageList, tracingContext);
      } catch (error) {
        if (error instanceof TripWire) {
          tripwireTriggered = true;
          tripwireReason = error.message;
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
      tripwireTriggered,
      tripwireReason,
    };
  }

  /**
   * Executes output processors on the message list after LLM processing.
   * @internal
   */
  private async __runOutputProcessors({
    runtimeContext,
    tracingContext,
    messageList,
    outputProcessorOverrides,
  }: {
    runtimeContext: RuntimeContext;
    tracingContext: TracingContext;
    messageList: MessageList;
    outputProcessorOverrides?: OutputProcessor[];
  }): Promise<{
    messageList: MessageList;
    tripwireTriggered: boolean;
    tripwireReason: string;
  }> {
    let tripwireTriggered = false;
    let tripwireReason = '';

    if (outputProcessorOverrides?.length || this.#outputProcessors) {
      const runner = await this.getProcessorRunner({
        runtimeContext,
        outputProcessorOverrides,
      });

      // Create traced version of runOutputProcessors similar to workflow _runStep pattern
      const tracedRunOutputProcessors = (messageList: MessageList, tracingContext: TracingContext) => {
        const telemetry = this.#mastra?.getTelemetry();
        if (!telemetry) {
          return runner.runOutputProcessors(messageList, tracingContext, undefined);
        }

        return telemetry.traceMethod(
          async (data: { messageList: MessageList }) => {
            return runner.runOutputProcessors(data.messageList, tracingContext, telemetry);
          },
          {
            spanName: `agent.${this.name}.outputProcessors`,
            attributes: {
              'agent.name': this.name,
              'outputProcessors.count': runner.outputProcessors.length.toString(),
              'outputProcessors.names': runner.outputProcessors.map(p => p.name).join(','),
            },
          },
        )({ messageList });
      };

      try {
        messageList = await tracedRunOutputProcessors(messageList, tracingContext);
      } catch (e) {
        if (e instanceof TripWire) {
          tripwireTriggered = true;
          tripwireReason = e.message;
          this.logger.debug(`[Agent:${this.name}] - Output processor tripwire triggered: ${e.message}`);
        } else {
          throw e;
        }
      }
    }

    return {
      messageList,
      tripwireTriggered,
      tripwireReason,
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
    runtimeContext,
  }: {
    resourceId?: string;
    threadId: string;
    vectorMessageSearch: string;
    memoryConfig?: MemoryConfig;
    runtimeContext: RuntimeContext;
  }) {
    const memory = await this.getMemory({ runtimeContext });
    if (!memory) {
      return [];
    }
    return memory
      .rememberMessages({
        threadId,
        resourceId,
        config: memoryConfig,
        // The new user messages aren't in the list yet cause we add memory messages first to try to make sure ordering is correct (memory comes before new user messages)
        vectorMessageSearch,
      })
      .then(r => r.messagesV2);
  }

  /**
   * Retrieves and converts assigned tools to CoreTool format.
   * @internal
   */
  private async getAssignedTools({
    runId,
    resourceId,
    threadId,
    runtimeContext,
    tracingContext,
    mastraProxy,
    writableStream,
  }: {
    runId?: string;
    resourceId?: string;
    threadId?: string;
    runtimeContext: RuntimeContext;
    tracingContext?: TracingContext;
    mastraProxy?: MastraUnion;
    writableStream?: WritableStream<ChunkType>;
  }) {
    let toolsForRequest: Record<string, CoreTool> = {};

    this.logger.debug(`[Agents:${this.name}] - Assembling assigned tools`, { runId, threadId, resourceId });

    const memory = await this.getMemory({ runtimeContext });

    // Mastra tools passed into the Agent

    const assignedTools = await this.getTools({ runtimeContext });

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
          runtimeContext,
          tracingContext,
          model: await this.getModel({ runtimeContext }),
          writableStream,
          tracingPolicy: this.#options?.tracingPolicy,
          requireApproval: (tool as any).requireApproval,
        };
        return [k, makeCoreTool(tool, options)];
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
  private async getToolsets({
    runId,
    threadId,
    resourceId,
    toolsets,
    runtimeContext,
    tracingContext,
    mastraProxy,
  }: {
    runId?: string;
    threadId?: string;
    resourceId?: string;
    toolsets: ToolsetsInput;
    runtimeContext: RuntimeContext;
    tracingContext?: TracingContext;
    mastraProxy?: MastraUnion;
  }) {
    let toolsForRequest: Record<string, CoreTool> = {};

    const memory = await this.getMemory({ runtimeContext });
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
            runtimeContext,
            tracingContext,
            model: await this.getModel({ runtimeContext }),
            tracingPolicy: this.#options?.tracingPolicy,
          };
          const convertedToCoreTool = makeCoreTool(toolObj, options, 'toolset');
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
  private async getClientTools({
    runId,
    threadId,
    resourceId,
    runtimeContext,
    tracingContext,
    mastraProxy,
    clientTools,
  }: {
    runId?: string;
    threadId?: string;
    resourceId?: string;
    runtimeContext: RuntimeContext;
    tracingContext?: TracingContext;
    mastraProxy?: MastraUnion;
    clientTools?: ToolsInput;
  }) {
    let toolsForRequest: Record<string, CoreTool> = {};
    const memory = await this.getMemory({ runtimeContext });
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
          runtimeContext,
          tracingContext,
          model: await this.getModel({ runtimeContext }),
          tracingPolicy: this.#options?.tracingPolicy,
        };
        const convertedToCoreTool = makeCoreTool(rest, options, 'client-tool');
        toolsForRequest[toolName] = convertedToCoreTool;
      }
    }

    return toolsForRequest;
  }

  /**
   * Retrieves and converts agent tools to CoreTool format.
   * @internal
   */
  private async getAgentTools({
    runId,
    threadId,
    resourceId,
    runtimeContext,
    tracingContext,
    methodType,
  }: {
    runId?: string;
    threadId?: string;
    resourceId?: string;
    runtimeContext: RuntimeContext;
    tracingContext?: TracingContext;
    methodType: AgentMethodType;
  }) {
    const convertedAgentTools: Record<string, CoreTool> = {};
    const agents = await this.listAgents({ runtimeContext });

    if (Object.keys(agents).length > 0) {
      for (const [agentName, agent] of Object.entries(agents)) {
        const agentInputSchema = z.object({
          prompt: z.string().describe('The prompt to send to the agent'),
        });

        const agentOutputSchema = z.object({
          text: z.string().describe('The response from the agent'),
          subAgentThreadId: z.string().describe('The thread ID of the agent').optional(),
          subAgentResourceId: z.string().describe('The resource ID of the agent').optional(),
        });

        const modelVersion = (await agent.getModel()).specificationVersion;

        const toolObj = createTool({
          id: `agent-${agentName}`,
          description: `Agent: ${agentName}`,
          inputSchema: agentInputSchema,
          outputSchema: agentOutputSchema,
          mastra: this.#mastra,
          // manually wrap agent tools with ai tracing, so that we can pass the
          // current tool span onto the agent to maintain continuity of the trace
          execute: async ({ context, writer, tracingContext: innerTracingContext }) => {
            try {
              this.logger.debug(`[Agent:${this.name}] - Executing agent as tool ${agentName}`, {
                name: agentName,
                args: context,
                runId,
                threadId,
                resourceId,
              });

              let result: any;

              if ((methodType === 'generate' || methodType === 'generateLegacy') && modelVersion === 'v2') {
                const generateResult = await agent.generate((context as any).prompt, {
                  runtimeContext,
                  tracingContext: innerTracingContext,
                });
                result = { text: generateResult.text };
              } else if ((methodType === 'generate' || methodType === 'generateLegacy') && modelVersion === 'v1') {
                const generateResult = await agent.generateLegacy((context as any).prompt, {
                  runtimeContext,
                  tracingContext: innerTracingContext,
                });
                result = { text: generateResult.text };
              } else if ((methodType === 'stream' || methodType === 'streamLegacy') && modelVersion === 'v2') {
                if (!agent.hasOwnMemory() && this.#memory) {
                  agent.__setMemory(this.#memory);
                }
                const subAgentThreadId = randomUUID();
                const subAgentResourceId = `${slugify(this.id)}-${agentName}`;

                const streamResult = await agent.stream((context as any).prompt, {
                  runtimeContext,
                  tracingContext: innerTracingContext,
                  ...(resourceId && threadId
                    ? {
                        memory: {
                          resource: subAgentResourceId,
                          thread: subAgentThreadId,
                        },
                      }
                    : {}),
                });

                // Collect full text
                let fullText = '';
                for await (const chunk of streamResult.fullStream) {
                  if (writer) {
                    // Data chunks from writer.custom() should bubble up directly without wrapping
                    if (chunk.type.startsWith('data-')) {
                      // Write data chunks directly to original stream to bubble up
                      await writer.custom(chunk as any);
                    } else {
                      await writer.write(chunk);
                    }
                  }

                  if (chunk.type === 'text-delta') {
                    fullText += chunk.payload.text;
                  }
                }

                result = { text: fullText, subAgentThreadId, subAgentResourceId };
              } else {
                // streamLegacy
                const streamResult = await agent.streamLegacy((context as any).prompt, {
                  runtimeContext,
                  tracingContext: innerTracingContext,
                });

                let fullText = '';
                for await (const chunk of streamResult.fullStream) {
                  if (writer) {
                    // Data chunks from writer.custom() should bubble up directly without wrapping
                    if (chunk.type.startsWith('data-')) {
                      // Write data chunks directly to original stream to bubble up
                      await writer.custom(chunk as any);
                    } else {
                      await writer.write(chunk);
                    }
                  }

                  if (chunk.type === 'text-delta') {
                    fullText += chunk.textDelta;
                  }
                }

                result = { text: fullText };
              }

              return result;
            } catch (err) {
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
          memory: await this.getMemory({ runtimeContext }),
          agentName: this.name,
          runtimeContext,
          model: await this.getModel({ runtimeContext }),
          tracingContext,
          tracingPolicy: this.#options?.tracingPolicy,
        };

        convertedAgentTools[`agent-${agentName}`] = makeCoreTool(toolObj, options);
      }
    }

    return convertedAgentTools;
  }

  /**
   * Retrieves and converts workflow tools to CoreTool format.
   * @internal
   */
  private async getWorkflowTools({
    runId,
    threadId,
    resourceId,
    runtimeContext,
    tracingContext,
    methodType,
  }: {
    runId?: string;
    threadId?: string;
    resourceId?: string;
    runtimeContext: RuntimeContext;
    tracingContext?: TracingContext;
    methodType: AgentMethodType;
  }) {
    const convertedWorkflowTools: Record<string, CoreTool> = {};
    const workflows = await this.getWorkflows({ runtimeContext });
    if (Object.keys(workflows).length > 0) {
      for (const [workflowName, workflow] of Object.entries(workflows)) {
        const toolObj = createTool({
          id: `workflow-${workflowName}`,
          description: workflow.description || `Workflow: ${workflowName}`,
          inputSchema: workflow.inputSchema,
          outputSchema: workflow.outputSchema,
          mastra: this.#mastra,
          // manually wrap workflow tools with ai tracing, so that we can pass the
          // current tool span onto the workflow to maintain continuity of the trace
          execute: async ({ context, writer, tracingContext: innerTracingContext }) => {
            try {
              this.logger.debug(`[Agent:${this.name}] - Executing workflow as tool ${workflowName}`, {
                name: workflowName,
                description: workflow.description,
                args: context,
                runId,
                threadId,
                resourceId,
              });

              const run = await workflow.createRunAsync();

              let result: any;
              if (methodType === 'generate' || methodType === 'generateLegacy') {
                result = await run.start({
                  inputData: context,
                  runtimeContext,
                  tracingContext: innerTracingContext,
                });
              } else if (methodType === 'streamLegacy') {
                const streamResult = run.streamLegacy({
                  inputData: context,
                  runtimeContext,
                  tracingContext: innerTracingContext,
                });

                if (writer) {
                  await streamResult.stream.pipeTo(writer);
                } else {
                  for await (const _chunk of streamResult.stream) {
                    // complete the stream
                  }
                }

                result = await streamResult.getWorkflowState();
              } else if (methodType === 'stream') {
                // TODO: add support for format
                const streamResult = run.stream({
                  inputData: context,
                  runtimeContext,
                  tracingContext: innerTracingContext,
                });

                if (writer) {
                  await streamResult.fullStream.pipeTo(writer);
                }

                result = await streamResult.result;
              }

              return { result, runId: run.runId };
            } catch (err) {
              const mastraError = new MastraError(
                {
                  id: 'AGENT_WORKFLOW_TOOL_EXECUTION_FAILED',
                  domain: ErrorDomain.AGENT,
                  category: ErrorCategory.USER,
                  details: {
                    agentName: this.name,
                    runId: runId || '',
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
          memory: await this.getMemory({ runtimeContext }),
          agentName: this.name,
          runtimeContext,
          model: await this.getModel({ runtimeContext }),
          tracingContext,
          tracingPolicy: this.#options?.tracingPolicy,
        };

        convertedWorkflowTools[`workflow-${workflowName}`] = makeCoreTool(toolObj, options);
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
    runtimeContext,
    tracingContext,
    writableStream,
    methodType,
  }: {
    toolsets?: ToolsetsInput;
    clientTools?: ToolsInput;
    threadId?: string;
    resourceId?: string;
    runId?: string;
    runtimeContext: RuntimeContext;
    tracingContext?: TracingContext;
    writableStream?: WritableStream<ChunkType>;
    methodType: AgentMethodType;
  }): Promise<Record<string, CoreTool>> {
    let mastraProxy = undefined;
    const logger = this.logger;

    if (this.#mastra) {
      mastraProxy = createMastraProxy({ mastra: this.#mastra, logger });
    }

    const assignedTools = await this.getAssignedTools({
      runId,
      resourceId,
      threadId,
      runtimeContext,
      tracingContext,
      mastraProxy,
      writableStream,
    });

    const memoryTools = await this.getMemoryTools({
      runId,
      resourceId,
      threadId,
      runtimeContext,
      tracingContext,
      mastraProxy,
    });

    const toolsetTools = await this.getToolsets({
      runId,
      resourceId,
      threadId,
      runtimeContext,
      tracingContext,
      mastraProxy,
      toolsets: toolsets!,
    });

    const clientSideTools = await this.getClientTools({
      runId,
      resourceId,
      threadId,
      runtimeContext,
      tracingContext,
      mastraProxy,
      clientTools: clientTools!,
    });

    const agentTools = await this.getAgentTools({
      runId,
      resourceId,
      threadId,
      runtimeContext,
      methodType,
      tracingContext,
    });

    const workflowTools = await this.getWorkflowTools({
      runId,
      resourceId,
      threadId,
      runtimeContext,
      methodType,
      tracingContext,
    });

    return this.formatTools({
      ...assignedTools,
      ...memoryTools,
      ...toolsetTools,
      ...clientSideTools,
      ...agentTools,
      ...workflowTools,
    });
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
    saveQueueManager,
    result,
    messageList,
    threadId,
    memoryConfig,
    runId,
  }: {
    saveQueueManager: SaveQueueManager;
    result: any;
    messageList: MessageList;
    threadId?: string;
    memoryConfig?: MemoryConfig;
    runId?: string;
  }) {
    try {
      messageList.add(result.response.messages, 'response');
      await saveQueueManager.batchMessages(messageList, threadId, memoryConfig);
    } catch (e) {
      await saveQueueManager.flushMessages(messageList, threadId, memoryConfig);
      this.logger.error('Error saving memory on step finish', {
        error: e,
        runId,
      });
      throw e;
    }
  }

  /**
   * Prepares message list and tools before LLM execution and handles memory persistence after.
   * @internal
   */
  __primitive({
    instructions,
    messages,
    context,
    thread,
    memoryConfig,
    resourceId,
    runId,
    toolsets,
    clientTools,
    runtimeContext,
    saveQueueManager,
    writableStream,
    methodType,
    tracingContext,
    tracingOptions,
  }: {
    instructions: AgentInstructions;
    toolsets?: ToolsetsInput;
    clientTools?: ToolsInput;
    resourceId?: string;
    thread?: (Partial<StorageThreadType> & { id: string }) | undefined;
    memoryConfig?: MemoryConfig;
    context?: CoreMessage[];
    runId?: string;
    messages: MessageListInput;
    runtimeContext: RuntimeContext;
    saveQueueManager: SaveQueueManager;
    writableStream?: WritableStream<ChunkType>;
    methodType: 'generate' | 'stream';
    tracingContext?: TracingContext;
    tracingOptions?: TracingOptions;
  }) {
    return {
      before: async () => {
        if (process.env.NODE_ENV !== 'test') {
          this.logger.debug(`[Agents:${this.name}] - Starting generation`, { runId });
        }

        const agentAISpan = getOrCreateSpan({
          type: AISpanType.AGENT_RUN,
          name: `agent run: '${this.id}'`,
          input: {
            messages,
          },
          attributes: {
            agentId: this.id,
            instructions: this.#convertInstructionsToString(instructions),
            availableTools: [
              ...(toolsets ? Object.keys(toolsets) : []),
              ...(clientTools ? Object.keys(clientTools) : []),
            ],
          },
          metadata: {
            runId,
            resourceId,
            threadId: thread ? thread.id : undefined,
          },
          tracingPolicy: this.#options?.tracingPolicy,
          tracingOptions,
          tracingContext,
          runtimeContext,
        });

        const innerTracingContext: TracingContext = { currentSpan: agentAISpan };

        const memory = await this.getMemory({ runtimeContext });

        const toolEnhancements = [
          // toolsets
          toolsets && Object.keys(toolsets || {}).length > 0
            ? `toolsets present (${Object.keys(toolsets || {}).length} tools)`
            : undefined,

          // memory tools
          memory && resourceId ? 'memory and resourceId available' : undefined,
        ]
          .filter(Boolean)
          .join(', ');
        this.logger.debug(`[Agent:${this.name}] - Enhancing tools: ${toolEnhancements}`, {
          runId,
          toolsets: toolsets ? Object.keys(toolsets) : undefined,
          clientTools: clientTools ? Object.keys(clientTools) : undefined,
          hasMemory: !!memory,
          hasResourceId: !!resourceId,
        });

        const threadId = thread?.id;

        const convertedTools = await this.convertTools({
          toolsets,
          clientTools,
          threadId,
          resourceId,
          runId,
          runtimeContext,
          tracingContext: innerTracingContext,
          writableStream,
          methodType,
        });

        const messageList = new MessageList({
          threadId,
          resourceId,
          generateMessageId: this.#mastra?.generateId?.bind(this.#mastra),
          // @ts-ignore Flag for agent network messages
          _agentNetworkAppend: this._agentNetworkAppend,
        })
          .addSystem(instructions || (await this.getInstructions({ runtimeContext })))
          .add(context || [], 'context');

        if (!memory || (!threadId && !resourceId)) {
          messageList.add(messages, 'user');
          const { tripwireTriggered, tripwireReason } = await this.__runInputProcessors({
            runtimeContext,
            tracingContext: innerTracingContext,
            messageList,
          });
          return {
            messageObjects: tripwireTriggered ? [] : messageList.get.all.prompt(),
            convertedTools,
            threadExists: false,
            thread: undefined,
            messageList,
            agentAISpan,
            ...(tripwireTriggered && {
              tripwire: true,
              tripwireReason,
            }),
          };
        }
        if (!threadId || !resourceId) {
          const mastraError = new MastraError({
            id: 'AGENT_MEMORY_MISSING_RESOURCE_ID',
            domain: ErrorDomain.AGENT,
            category: ErrorCategory.USER,
            details: {
              agentName: this.name,
              threadId: threadId || '',
              resourceId: resourceId || '',
            },
            text: `A resourceId and a threadId must be provided when using Memory. Saw threadId "${threadId}" and resourceId "${resourceId}"`,
          });
          this.logger.trackException(mastraError);
          this.logger.error(mastraError.toString());
          agentAISpan?.error({ error: mastraError });
          throw mastraError;
        }
        const store = memory.constructor.name;
        this.logger.debug(
          `[Agent:${this.name}] - Memory persistence enabled: store=${store}, resourceId=${resourceId}`,
          {
            runId,
            resourceId,
            threadId,
            memoryStore: store,
          },
        );

        let threadObject: StorageThreadType | undefined = undefined;
        const existingThread = await memory.getThreadById({ threadId });
        if (existingThread) {
          if (
            (!existingThread.metadata && thread.metadata) ||
            (thread.metadata && !deepEqual(existingThread.metadata, thread.metadata))
          ) {
            threadObject = await memory.saveThread({
              thread: { ...existingThread, metadata: thread.metadata },
              memoryConfig,
            });
          } else {
            threadObject = existingThread;
          }
        } else {
          threadObject = await memory.createThread({
            threadId,
            metadata: thread.metadata,
            title: thread.title,
            memoryConfig,
            resourceId,
            saveThread: false,
          });
        }

        const config = memory.getMergedThreadConfig(memoryConfig || {});
        const hasResourceScopeSemanticRecall =
          typeof config?.semanticRecall === 'object' && config?.semanticRecall?.scope === 'resource';
        let [memoryMessages, memorySystemMessage] = await Promise.all([
          existingThread || hasResourceScopeSemanticRecall
            ? this.getMemoryMessages({
                resourceId,
                threadId: threadObject.id,
                vectorMessageSearch: new MessageList().add(messages, `user`).getLatestUserContent() || '',
                memoryConfig,
                runtimeContext,
              })
            : [],
          memory.getSystemMessage({ threadId: threadObject.id, resourceId, memoryConfig }),
        ]);

        this.logger.debug('Fetched messages from memory', {
          threadId: threadObject.id,
          runId,
          fetchedCount: memoryMessages.length,
        });

        // So the agent doesn't get confused and start replying directly to messages
        // that were added via semanticRecall from a different conversation,
        // we need to pull those out and add to the system message.
        const resultsFromOtherThreads = memoryMessages.filter(m => m.threadId !== threadObject.id);
        if (resultsFromOtherThreads.length && !memorySystemMessage) {
          memorySystemMessage = ``;
        }
        if (resultsFromOtherThreads.length) {
          memorySystemMessage += `\nThe following messages were remembered from a different conversation:\n<remembered_from_other_conversation>\n${(() => {
            let result = ``;

            const messages = new MessageList().add(resultsFromOtherThreads, 'memory').get.all.v1();
            let lastYmd: string | null = null;
            for (const msg of messages) {
              const date = msg.createdAt;
              const year = date.getUTCFullYear();
              const month = date.toLocaleString('default', { month: 'short' });
              const day = date.getUTCDate();
              const ymd = `${year}, ${month}, ${day}`;
              const utcHour = date.getUTCHours();
              const utcMinute = date.getUTCMinutes();
              const hour12 = utcHour % 12 || 12;
              const ampm = utcHour < 12 ? 'AM' : 'PM';
              const timeofday = `${hour12}:${utcMinute < 10 ? '0' : ''}${utcMinute} ${ampm}`;

              if (!lastYmd || lastYmd !== ymd) {
                result += `\nthe following messages are from ${ymd}\n`;
              }
              result += `
  Message ${msg.threadId && msg.threadId !== threadObject.id ? 'from previous conversation' : ''} at ${timeofday}: ${JSON.stringify(msg)}`;

              lastYmd = ymd;
            }
            return result;
          })()}\n<end_remembered_from_other_conversation>`;
        }

        if (memorySystemMessage) {
          messageList.addSystem(memorySystemMessage, 'memory');
        }

        messageList
          .add(
            memoryMessages.filter(m => m.threadId === threadObject.id), // filter out messages from other threads. those are added to system message above
            'memory',
          )
          // add new user messages to the list AFTER remembered messages to make ordering more reliable
          .add(messages, 'user');

        const { tripwireTriggered, tripwireReason } = await this.__runInputProcessors({
          runtimeContext,
          tracingContext: innerTracingContext,
          messageList,
        });

        const systemMessages = messageList.getSystemMessages();

        const systemMessage =
          [...systemMessages, ...messageList.getSystemMessages('memory')]?.map(m => m.content)?.join(`\n`) ?? undefined;

        const processedMemoryMessages = await memory.processMessages({
          // these will be processed
          messages: messageList.get.remembered.v1() as CoreMessage[],
          // these are here for inspecting but shouldn't be returned by the processor
          // - ex TokenLimiter needs to measure all tokens even though it's only processing remembered messages
          newMessages: messageList.get.input.v1() as CoreMessage[],
          systemMessage,
          memorySystemMessage: memorySystemMessage || undefined,
        });

        const processedList = new MessageList({
          threadId: threadObject.id,
          resourceId,
          generateMessageId: this.#mastra?.generateId?.bind(this.#mastra),
          // @ts-ignore Flag for agent network messages
          _agentNetworkAppend: this._agentNetworkAppend,
        })
          .addSystem(instructions || (await this.getInstructions({ runtimeContext })))
          .addSystem(memorySystemMessage)
          .addSystem(systemMessages)
          .add(context || [], 'context')
          .add(processedMemoryMessages, 'memory')
          .add(messageList.get.input.v2(), 'user')
          .get.all.prompt();

        return {
          convertedTools,
          thread: threadObject,
          messageList,
          // add old processed messages + new input messages
          messageObjects: processedList,
          agentAISpan,
          ...(tripwireTriggered && {
            tripwire: true,
            tripwireReason,
          }),
          threadExists: !!existingThread,
        };
      },
      after: async ({
        result,
        thread: threadAfter,
        threadId,
        memoryConfig,
        outputText,
        runId,
        messageList,
        threadExists,
        structuredOutput = false,
        overrideScorers,
        agentAISpan,
      }: {
        runId: string;
        result: Record<string, any>;
        thread: StorageThreadType | null | undefined;
        threadId?: string;
        memoryConfig: MemoryConfig | undefined;
        outputText: string;
        messageList: MessageList;
        threadExists: boolean;
        structuredOutput?: boolean;
        overrideScorers?: MastraScorers;
        agentAISpan?: AISpan<AISpanType.AGENT_RUN>;
      }) => {
        const resToLog = {
          text: result?.text,
          object: result?.object,
          toolResults: result?.toolResults,
          toolCalls: result?.toolCalls,
          usage: result?.usage,
          steps: result?.steps?.map((s: any) => {
            return {
              stepType: s?.stepType,
              text: result?.text,
              object: result?.object,
              toolResults: result?.toolResults,
              toolCalls: result?.toolCalls,
              usage: result?.usage,
            };
          }),
        };

        this.logger.debug(`[Agent:${this.name}] - Post processing LLM response`, {
          runId,
          result: resToLog,
          threadId,
        });

        const messageListResponses = new MessageList({
          threadId,
          resourceId,
          generateMessageId: this.#mastra?.generateId?.bind(this.#mastra),
          // @ts-ignore Flag for agent network messages
          _agentNetworkAppend: this._agentNetworkAppend,
        })
          .add(result.response.messages, 'response')
          .get.all.core();

        const usedWorkingMemory = messageListResponses?.some(
          m => m.role === 'tool' && m?.content?.some(c => c?.toolName === 'updateWorkingMemory'),
        );
        // working memory updates the thread, so we need to get the latest thread if we used it
        const memory = await this.getMemory({ runtimeContext });
        const thread = usedWorkingMemory
          ? threadId
            ? await memory?.getThreadById({ threadId })
            : undefined
          : threadAfter;

        if (memory && resourceId && thread) {
          try {
            // Add LLM response messages to the list
            let responseMessages = result.response.messages;
            if (!responseMessages && result.object) {
              responseMessages = [
                {
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

            // Parallelize title generation and message saving
            const promises: Promise<any>[] = [saveQueueManager.flushMessages(messageList, threadId, memoryConfig)];

            // Add title generation to promises if needed
            if (thread.title?.startsWith('New Thread')) {
              const config = memory.getMergedThreadConfig(memoryConfig);
              const userMessage = this.getMostRecentUserMessage(messageList.get.all.ui());

              const {
                shouldGenerate,
                model: titleModel,
                instructions: titleInstructions,
              } = this.resolveTitleGenerationConfig(config?.threads?.generateTitle);

              if (shouldGenerate && userMessage) {
                promises.push(
                  this.genTitle(
                    userMessage,
                    runtimeContext,
                    { currentSpan: agentAISpan },
                    titleModel,
                    titleInstructions,
                  ).then(title => {
                    if (title) {
                      return memory.createThread({
                        threadId: thread.id,
                        resourceId,
                        memoryConfig,
                        title,
                        metadata: thread.metadata,
                      });
                    }
                  }),
                );
              }
            }

            await Promise.all(promises);
          } catch (e) {
            await saveQueueManager.flushMessages(messageList, threadId, memoryConfig);
            if (e instanceof MastraError) {
              agentAISpan?.error({ error: e });
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
            agentAISpan?.error({ error: mastraError });
            throw mastraError;
          }
        } else {
          let responseMessages = result.response.messages;
          if (!responseMessages && result.object) {
            responseMessages = [
              {
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
          outputText,
          instructions,
          runtimeContext,
          structuredOutput,
          overrideScorers,
          threadId,
          resourceId,
          tracingContext: { currentSpan: agentAISpan },
        });

        const scoringData: {
          input: Omit<ScorerRunInputForAgent, 'runId'>;
          output: ScorerRunOutputForAgent;
        } = {
          input: {
            inputMessages: messageList.getPersisted.input.ui(),
            rememberedMessages: messageList.getPersisted.remembered.ui(),
            systemMessages: messageList.getSystemMessages(),
            taggedSystemMessages: messageList.getPersisted.taggedSystemMessages,
          },
          output: messageList.getPersisted.response.ui(),
        };

        agentAISpan?.end({
          output: {
            text: result?.text,
            object: result?.object,
            files: result?.files,
          },
        });

        return {
          scoringData,
        };
      },
    };
  }

  async #runScorers({
    messageList,
    runId,
    outputText,
    instructions,
    runtimeContext,
    structuredOutput,
    overrideScorers,
    threadId,
    resourceId,
    tracingContext,
  }: {
    messageList: MessageList;
    runId: string;
    outputText: string;
    instructions: AgentInstructions;
    runtimeContext: RuntimeContext;
    structuredOutput?: boolean;
    overrideScorers?:
      | MastraScorers
      | Record<string, { scorer: MastraScorer['name']; sampling?: ScoringSamplingConfig }>;
    threadId?: string;
    resourceId?: string;
    tracingContext: TracingContext;
  }) {
    const agentName = this.name;
    const userInputMessages = messageList.get.all.ui().filter(m => m.role === 'user');
    const input = userInputMessages
      .map(message => (typeof message.content === 'string' ? message.content : ''))
      .join('\n');
    const runIdToUse = runId || this.#mastra?.generateId() || randomUUID();

    if (Object.keys(this.evals || {}).length > 0) {
      for (const metric of Object.values(this.evals || {})) {
        executeHook(AvailableHooks.ON_GENERATION, {
          input,
          output: outputText,
          runId: runIdToUse,
          metric,
          agentName,
          instructions: this.#convertInstructionsToString(instructions),
        });
      }
    }

    let scorers: Record<string, { scorer: MastraScorer; sampling?: ScoringSamplingConfig }> = {};
    try {
      scorers = overrideScorers
        ? this.resolveOverrideScorerReferences(overrideScorers)
        : await this.getScorers({ runtimeContext });
    } catch (e) {
      this.logger.warn(`[Agent:${this.name}] - Failed to get scorers: ${e}`);
      return;
    }

    const scorerInput: ScorerRunInputForAgent = {
      inputMessages: messageList.getPersisted.input.ui(),
      rememberedMessages: messageList.getPersisted.remembered.ui(),
      systemMessages: messageList.getSystemMessages(),
      taggedSystemMessages: messageList.getPersisted.taggedSystemMessages,
    };

    const scorerOutput: ScorerRunOutputForAgent = messageList.getPersisted.response.ui();

    if (Object.keys(scorers || {}).length > 0) {
      for (const [_id, scorerObject] of Object.entries(scorers)) {
        runScorer({
          scorerId: overrideScorers ? scorerObject.scorer.name : scorerObject.scorer.name,
          scorerObject: scorerObject,
          runId,
          input: scorerInput,
          output: scorerOutput,
          runtimeContext,
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

          const scorer = this.#mastra.getScorerByName(scorerObject.scorer);
          result[id] = { scorer, sampling: scorerObject.sampling };
        } catch (error) {
          this.logger.warn(`[Agent:${this.name}] - Failed to get scorer ${scorerObject.scorer}: ${error}`);
        }
      } else {
        result[id] = scorerObject;
      }
    }

    if (Object.keys(result).length === 0) {
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
   * Prepares options and handlers for LLM text/object generation or streaming.
   * @internal
   */
  private prepareLLMOptions<
    Tools extends ToolSet,
    Output extends ZodSchema | JSONSchema7 | undefined = undefined,
    ExperimentalOutput extends ZodSchema | JSONSchema7 | undefined = undefined,
  >(
    messages: MessageListInput,
    options: AgentGenerateOptions<Output, ExperimentalOutput>,
    methodType: 'generate' | 'stream',
  ): Promise<{
    before: () => Promise<
      Omit<
        Output extends undefined
          ? GenerateTextWithMessagesArgs<Tools, ExperimentalOutput>
          : Omit<GenerateObjectWithMessagesArgs<NonNullable<Output>>, 'structuredOutput'> & {
              output?: Output;
              experimental_output?: never;
            },
        'runId'
      > & { runId: string } & TripwireProperties & { agentAISpan?: AISpan<AISpanType.AGENT_RUN> }
    >;
    after: (args: {
      result: GenerateReturn<any, Output, ExperimentalOutput>;
      outputText: string;
      structuredOutput?: boolean;
      agentAISpan?: AISpan<AISpanType.AGENT_RUN>;
      overrideScorers?:
        | MastraScorers
        | Record<string, { scorer: MastraScorer['name']; sampling?: ScoringSamplingConfig }>;
    }) => Promise<{
      scoringData: {
        input: Omit<ScorerRunInputForAgent, 'runId'>;
        output: ScorerRunOutputForAgent;
      };
    }>;
    llm: MastraLLM;
  }>;
  /**
   * @internal
   */
  private prepareLLMOptions<
    Tools extends ToolSet,
    Output extends ZodSchema | JSONSchema7 | undefined = undefined,
    ExperimentalOutput extends ZodSchema | JSONSchema7 | undefined = undefined,
  >(
    messages: MessageListInput,
    options: AgentStreamOptions<Output, ExperimentalOutput>,
    methodType: 'generate' | 'stream',
  ): Promise<{
    before: () => Promise<
      Omit<
        Output extends undefined
          ? StreamTextWithMessagesArgs<Tools, ExperimentalOutput>
          : Omit<StreamObjectWithMessagesArgs<NonNullable<Output>>, 'structuredOutput'> & {
              output?: Output;
              experimental_output?: never;
            },
        'runId'
      > & { runId: string } & TripwireProperties & { agentAISpan?: AISpan<AISpanType.AGENT_RUN> }
    >;
    after: (args: {
      result: OriginalStreamTextOnFinishEventArg<any> | OriginalStreamObjectOnFinishEventArg<ExperimentalOutput>;
      outputText: string;
      structuredOutput?: boolean;
      agentAISpan?: AISpan<AISpanType.AGENT_RUN>;
      overrideScorers?:
        | MastraScorers
        | Record<string, { scorer: MastraScorer['name']; sampling?: ScoringSamplingConfig }>;
    }) => Promise<{
      scoringData: {
        input: Omit<ScorerRunInputForAgent, 'runId'>;
        output: ScorerRunOutputForAgent;
      };
    }>;
    llm: MastraLLMV1;
  }>;
  /**
   * @internal
   */
  private async prepareLLMOptions<
    Tools extends ToolSet,
    Output extends ZodSchema | JSONSchema7 | undefined = undefined,
    ExperimentalOutput extends ZodSchema | JSONSchema7 | undefined = undefined,
  >(
    messages: MessageListInput,
    options: (AgentGenerateOptions<Output, ExperimentalOutput> | AgentStreamOptions<Output, ExperimentalOutput>) & {
      writableStream?: WritableStream<ChunkType>;
    },
    methodType: 'generate' | 'stream',
  ): Promise<{
    before:
      | (() => Promise<
          Omit<
            Output extends undefined
              ? StreamTextWithMessagesArgs<Tools, ExperimentalOutput>
              : Omit<StreamObjectWithMessagesArgs<NonNullable<Output>>, 'structuredOutput'> & {
                  output?: Output;
                  experimental_output?: never;
                },
            'runId'
          > & { runId: string } & TripwireProperties & { agentAISpan?: AISpan<AISpanType.AGENT_RUN> }
        >)
      | (() => Promise<
          Omit<
            Output extends undefined
              ? GenerateTextWithMessagesArgs<Tools, ExperimentalOutput>
              : Omit<GenerateObjectWithMessagesArgs<NonNullable<Output>>, 'structuredOutput'> & {
                  output?: Output;
                  experimental_output?: never;
                },
            'runId'
          > & { runId: string } & TripwireProperties & { agentAISpan?: AISpan<AISpanType.AGENT_RUN> }
        >);
    after:
      | ((args: {
          result: GenerateReturn<any, Output, ExperimentalOutput>;
          outputText: string;
          agentAISpan?: AISpan<AISpanType.AGENT_RUN>;
          overrideScorers?: MastraScorers;
        }) => Promise<{
          scoringData: {
            input: Omit<ScorerRunInputForAgent, 'runId'>;
            output: ScorerRunOutputForAgent;
          };
        }>)
      | ((args: {
          agentAISpan?: AISpan<AISpanType.AGENT_RUN>;
          result: OriginalStreamTextOnFinishEventArg<any> | OriginalStreamObjectOnFinishEventArg<ExperimentalOutput>;
          outputText: string;
          structuredOutput?: boolean;
          overrideScorers?: MastraScorers;
        }) => Promise<{
          scoringData: {
            input: Omit<ScorerRunInputForAgent, 'runId'>;
            output: ScorerRunOutputForAgent;
          };
        }>);
    llm: MastraLLM;
  }> {
    const {
      context,
      memoryOptions: memoryConfigFromArgs,
      resourceId: resourceIdFromArgs,
      maxSteps,
      onStepFinish,
      toolsets,
      clientTools,
      temperature,
      toolChoice = 'auto',
      runtimeContext = new RuntimeContext(),
      tracingContext,
      tracingOptions,
      savePerStep,
      writableStream,
      ...args
    } = options;

    // Currently not being used, but should be kept around for now in case it's needed later
    // const generateMessageId =
    //   `experimental_generateMessageId` in args && typeof args.experimental_generateMessageId === `function`
    //     ? (args.experimental_generateMessageId as IDGenerator)
    //     : undefined;

    const threadFromArgs = resolveThreadIdFromArgs({ threadId: args.threadId, memory: args.memory });
    const resourceId = args.memory?.resource || resourceIdFromArgs;
    const memoryConfig = args.memory?.options || memoryConfigFromArgs;

    if (resourceId && threadFromArgs && !this.hasOwnMemory()) {
      this.logger.warn(
        `[Agent:${this.name}] - No memory is configured but resourceId and threadId were passed in args. This will not work.`,
      );
    }
    const runId = args.runId || this.#mastra?.generateId() || randomUUID();
    const instructions = args.instructions || (await this.getInstructions({ runtimeContext }));
    const llm = await this.getLLM({ runtimeContext });

    // Set thread ID and resource ID context for telemetry
    const activeSpan = Telemetry.getActiveSpan();
    const baggageEntries: Record<string, { value: string }> = {};

    if (threadFromArgs?.id) {
      if (activeSpan) {
        activeSpan.setAttribute('threadId', threadFromArgs.id);
      }
      baggageEntries.threadId = { value: threadFromArgs.id };
    }

    if (resourceId) {
      if (activeSpan) {
        activeSpan.setAttribute('resourceId', resourceId);
      }
      baggageEntries.resourceId = { value: resourceId };
    }

    if (Object.keys(baggageEntries).length > 0) {
      Telemetry.setBaggage(baggageEntries);
    }

    const memory = await this.getMemory({ runtimeContext });
    const saveQueueManager = new SaveQueueManager({
      logger: this.logger,
      memory,
    });

    const { before, after } = this.__primitive({
      messages,
      instructions,
      context,
      thread: threadFromArgs,
      memoryConfig,
      resourceId,
      runId,
      toolsets,
      clientTools,
      runtimeContext,
      saveQueueManager,
      writableStream,
      methodType,
      tracingContext,
      tracingOptions,
    });

    let messageList: MessageList;
    let thread: StorageThreadType | null | undefined;
    let threadExists: boolean;

    return {
      llm,
      before: async () => {
        const beforeResult = await before();
        const { messageObjects, convertedTools, agentAISpan } = beforeResult;
        threadExists = beforeResult.threadExists || false;
        messageList = beforeResult.messageList;
        thread = beforeResult.thread;

        const threadId = thread?.id;

        // can't type this properly sadly :(
        const result = {
          ...options,
          messages: messageObjects,
          tools: convertedTools as Record<string, Tool>,
          runId,
          temperature,
          toolChoice,
          threadId,
          resourceId,
          runtimeContext,
          onStepFinish: async (props: any) => {
            if (savePerStep) {
              if (!threadExists && memory && thread) {
                await memory.createThread({
                  threadId,
                  title: thread.title,
                  metadata: thread.metadata,
                  resourceId: thread.resourceId,
                  memoryConfig,
                });
                threadExists = true;
              }

              await this.saveStepMessages({
                saveQueueManager,
                result: props,
                messageList,
                threadId,
                memoryConfig,
                runId,
              });
            }

            return onStepFinish?.({ ...props, runId });
          },
          ...(beforeResult.tripwire && {
            tripwire: beforeResult.tripwire,
            tripwireReason: beforeResult.tripwireReason,
          }),
          ...args,
          agentAISpan,
        } as any;

        return result;
      },
      after: async ({
        result,
        outputText,
        structuredOutput = false,
        agentAISpan,
        overrideScorers,
      }:
        | {
            result: GenerateReturn<any, Output, ExperimentalOutput>;
            outputText: string;
            structuredOutput?: boolean;
            agentAISpan?: AISpan<AISpanType.AGENT_RUN>;
            overrideScorers?: MastraScorers;
          }
        | {
            result: StreamReturn<any, Output, ExperimentalOutput>;
            outputText: string;
            structuredOutput?: boolean;
            agentAISpan?: AISpan<AISpanType.AGENT_RUN>;
            overrideScorers?: MastraScorers;
          }) => {
        const afterResult = await after({
          result,
          outputText,
          threadId: thread?.id,
          thread,
          memoryConfig,
          runId,
          messageList,
          structuredOutput,
          threadExists,
          agentAISpan,
          overrideScorers,
        });
        return afterResult;
      },
    };
  }

  /**
   * Resolves and prepares model configurations for the LLM.
   * @internal
   */
  private async prepareModels(
    runtimeContext: RuntimeContext,
    model?: DynamicArgument<MastraLanguageModel> | ModelFallbacks,
  ): Promise<Array<AgentModelManagerConfig>> {
    if (model || !Array.isArray(this.model)) {
      const modelToUse = model ?? this.model;
      const resolvedModel =
        typeof modelToUse === 'function' ? await modelToUse({ runtimeContext, mastra: this.#mastra }) : modelToUse;

      if ((resolvedModel as MastraLanguageModel)?.specificationVersion !== 'v2') {
        const mastraError = new MastraError({
          id: 'AGENT_PREPARE_MODELS_INCOMPATIBLE_WITH_MODEL_ARRAY_V1',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          details: {
            agentName: this.name,
          },
          text: `[Agent:${this.name}] - Only v2 models are allowed when an array of models is provided`,
        });
        this.logger.trackException(mastraError);
        this.logger.error(mastraError.toString());
        throw mastraError;
      }

      return [
        {
          id: 'main',
          // TODO fix type check
          model: resolvedModel as MastraLanguageModelV2,
          maxRetries: this.maxRetries ?? 0,
          enabled: true,
        },
      ];
    }

    const models = await Promise.all(
      this.model.map(async modelConfig => {
        const model = await this.resolveModelConfig(modelConfig.model, runtimeContext);

        if (!isV2Model(model)) {
          const mastraError = new MastraError({
            id: 'AGENT_PREPARE_MODELS_INCOMPATIBLE_WITH_MODEL_ARRAY_V1',
            domain: ErrorDomain.AGENT,
            category: ErrorCategory.USER,
            details: {
              agentName: this.name,
            },
            text: `[Agent:${this.name}] - Only v2 models are allowed when an array of models is provided`,
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

        return {
          id: modelId,
          model: model,
          maxRetries: modelConfig.maxRetries ?? 0,
          enabled: modelConfig.enabled ?? true,
        };
      }),
    );

    return models;
  }
  /**
   * Merges telemetry wrapper with default onFinish callback when needed
   * @internal
   */
  #mergeOnFinishWithTelemetry(streamOptions: any, defaultStreamOptions: any) {
    let finalOnFinish = streamOptions?.onFinish || defaultStreamOptions.onFinish;

    if (
      streamOptions?.onFinish &&
      streamOptions.onFinish.__hasOriginalOnFinish === false &&
      defaultStreamOptions.onFinish
    ) {
      // Create composite callback: telemetry wrapper + default callback
      const telemetryWrapper = streamOptions.onFinish;
      const defaultCallback = defaultStreamOptions.onFinish;

      finalOnFinish = async (data: any) => {
        // Call telemetry wrapper first (for span attributes, etc.)
        await telemetryWrapper(data);
        // Then call the default callback
        await defaultCallback(data);
      };
    }

    return finalOnFinish;
  }

  /**
   * Executes the agent with VNext execution model, handling tools, memory, and streaming.
   * @internal
   */
  async #execute<
    OUTPUT extends OutputSchema | undefined = undefined,
    FORMAT extends 'aisdk' | 'mastra' | undefined = undefined,
  >({ methodType, format = 'mastra', resumeContext, ...options }: InnerAgentExecutionOptions<OUTPUT, FORMAT>) {
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
    const runtimeContext = options.runtimeContext || new RuntimeContext();
    const threadFromArgs = resolveThreadIdFromArgs({
      threadId: options.threadId || snapshotMemoryInfo?.threadId,
      memory: options.memory,
    });

    const resourceId = options.memory?.resource || options.resourceId || snapshotMemoryInfo?.resourceId;
    const memoryConfig = options.memory?.options;

    if (resourceId && threadFromArgs && !this.hasOwnMemory()) {
      this.logger.warn(
        `[Agent:${this.name}] - No memory is configured but resourceId and threadId were passed in args. This will not work.`,
      );
    }

    const llm = (await this.getLLM({ runtimeContext, model: options.model })) as MastraLLMVNext;

    const runId = options.runId || this.#mastra?.generateId() || randomUUID();
    const instructions = options.instructions || (await this.getInstructions({ runtimeContext }));

    // Set AI Tracing context
    // Note this span is ended at the end of #executeOnFinish
    const agentAISpan = getOrCreateSpan({
      type: AISpanType.AGENT_RUN,
      name: `agent run: '${this.id}'`,
      input: options.messages,
      attributes: {
        agentId: this.id,
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
      runtimeContext,
    });

    // Set Telemetry context
    // Set thread ID and resource ID context for telemetry
    const activeSpan = Telemetry.getActiveSpan();
    const baggageEntries: Record<string, { value: string }> = {};

    if (threadFromArgs?.id) {
      if (activeSpan) {
        activeSpan.setAttribute('threadId', threadFromArgs.id);
      }
      baggageEntries.threadId = { value: threadFromArgs.id };
    }

    if (resourceId) {
      if (activeSpan) {
        activeSpan.setAttribute('resourceId', resourceId);
      }
      baggageEntries.resourceId = { value: resourceId };
    }

    if (Object.keys(baggageEntries).length > 0) {
      Telemetry.setBaggage(baggageEntries);
    }

    const memory = await this.getMemory({ runtimeContext });

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
      outputProcessors: this.#outputProcessors,
      llm,
      getTelemetry: this.#mastra?.getTelemetry?.bind(this.#mastra),
    };

    // Create the workflow with all necessary context
    const executionWorkflow = createPrepareStreamWorkflow({
      capabilities,
      options: { ...options, methodType },
      threadFromArgs,
      resourceId,
      runId,
      runtimeContext,
      agentAISpan: agentAISpan!,
      methodType,
      format: format as FORMAT,
      instructions,
      memoryConfig,
      memory,
      saveQueueManager,
      returnScorerData: options.returnScorerData,
      requireToolApproval: options.requireToolApproval,
      resumeContext,
      agentId: this.id,
      toolCallId: options.toolCallId,
    });

    const run = await executionWorkflow.createRunAsync();
    const result = await run.start({ tracingContext: { currentSpan: agentAISpan } });

    return result;
  }

  /**
   * Handles post-execution tasks including memory persistence and title generation.
   * @internal
   */
  async #executeOnFinish({
    result,
    instructions,
    readOnlyMemory,
    thread: threadAfter,
    threadId,
    resourceId,
    memoryConfig,
    outputText,
    runtimeContext,
    agentAISpan,
    runId,
    messageList,
    threadExists,
    structuredOutput = false,
    saveQueueManager,
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
    const memory = await this.getMemory({ runtimeContext });
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

        // Parallelize title generation and message saving
        const promises: Promise<any>[] = [saveQueueManager.flushMessages(messageList, threadId, memoryConfig)];

        // Add title generation to promises if needed
        if (thread.title?.startsWith('New Thread')) {
          const config = memory.getMergedThreadConfig(memoryConfig);
          const userMessage = this.getMostRecentUserMessage(messageList.get.all.ui());

          const {
            shouldGenerate,
            model: titleModel,
            instructions: titleInstructions,
          } = this.resolveTitleGenerationConfig(config.threads?.generateTitle);

          if (shouldGenerate && userMessage) {
            promises.push(
              this.genTitle(
                userMessage,
                runtimeContext,
                { currentSpan: agentAISpan },
                titleModel,
                titleInstructions,
              ).then(title => {
                if (title) {
                  return memory.createThread({
                    threadId: thread.id,
                    resourceId,
                    memoryConfig,
                    title,
                    metadata: thread.metadata,
                  });
                }
              }),
            );
          }
        }

        await Promise.all(promises);
      } catch (e) {
        await saveQueueManager.flushMessages(messageList, threadId, memoryConfig);
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
      outputText,
      instructions,
      runtimeContext,
      structuredOutput,
      overrideScorers,
      tracingContext: { currentSpan: agentAISpan },
    });

    agentAISpan?.end({
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
  async network(messages: MessageListInput, options?: MultiPrimitiveExecutionOptions) {
    const runId = options?.runId || this.#mastra?.generateId() || randomUUID();
    const runtimeContextToUse = options?.runtimeContext || new RuntimeContext();

    return await networkLoop({
      networkName: this.name,
      runtimeContext: runtimeContextToUse,
      runId,
      routingAgent: this,
      routingAgentOptions: {
        telemetry: options?.telemetry,
        modelSettings: options?.modelSettings,
        memory: options?.memory,
      },
      generateId: () => this.#mastra?.generateId() || randomUUID(),
      maxIterations: options?.maxSteps || 1,
      messages,
      threadId: typeof options?.memory?.thread === 'string' ? options?.memory?.thread : options?.memory?.thread?.id,
      resourceId: options?.memory?.resource,
    });
  }

  /**
   * @deprecated `generateVNext()` has been renamed to `generate()`. Please use `generate()` instead.
   */
  async generateVNext<OUTPUT extends OutputSchema = undefined, FORMAT extends 'aisdk' | 'mastra' = 'mastra'>(
    _messages: MessageListInput,
    _options?: AgentExecutionOptions<OUTPUT, FORMAT>,
  ): Promise<
    FORMAT extends 'aisdk'
      ? Awaited<ReturnType<AISDKV5OutputStream<OUTPUT>['getFullOutput']>>
      : Awaited<ReturnType<MastraModelOutput<OUTPUT>['getFullOutput']>>
  > {
    throw new MastraError({
      id: 'AGENT_GENERATE_VNEXT_DEPRECATED',
      domain: ErrorDomain.AGENT,
      category: ErrorCategory.USER,
      text: 'generateVNext has been renamed to generate. Please use generate instead.',
    });
  }

  async generate<OUTPUT extends OutputSchema = undefined, FORMAT extends 'aisdk' | 'mastra' = 'mastra'>(
    messages: MessageListInput,
    options?: AgentExecutionOptions<OUTPUT, FORMAT> & DeprecatedOutputOptions<OUTPUT>,
  ): Promise<
    FORMAT extends 'aisdk'
      ? Awaited<ReturnType<AISDKV5OutputStream<OUTPUT>['getFullOutput']>>
      : Awaited<ReturnType<MastraModelOutput<OUTPUT>['getFullOutput']>>
  > {
    if (options?.structuredOutput?.schema && options?.output) {
      throw new MastraError({
        id: 'AGENT_GENERATE_STRUCTURED_OUTPUT_AND_OUTPUT_PROVIDED',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: 'structuredOutput and output cannot be provided at the same time to agent.generate',
      });
    }
    // Deprecated `output` option now just maps to structuredOutput.schema
    // Create a new options object to avoid mutating the input parameter
    const normalizedOptions = options?.output
      ? {
          structuredOutput: {
            schema: options.output as OUTPUT extends OutputSchema ? OUTPUT : never,
            ...options.structuredOutput,
          },
          ...options,
          output: undefined,
        }
      : options;

    const result = await this.stream(messages, normalizedOptions);
    const fullOutput = await result.getFullOutput();

    const error = fullOutput.error;

    if (fullOutput.finishReason === 'error' && error) {
      throw error;
    }

    // Warning already logged in stream() method
    return fullOutput as FORMAT extends 'aisdk'
      ? Awaited<ReturnType<AISDKV5OutputStream<OUTPUT>['getFullOutput']>>
      : Awaited<ReturnType<MastraModelOutput<OUTPUT>['getFullOutput']>>;
  }

  /**
   * @deprecated `streamVNext()` has been renamed to `stream()`. Please use `stream()` instead.
   */
  async streamVNext<OUTPUT extends OutputSchema = undefined, FORMAT extends 'mastra' | 'aisdk' | undefined = undefined>(
    _messages: MessageListInput,
    _streamOptions?: AgentExecutionOptions<OUTPUT, FORMAT>,
  ): Promise<FORMAT extends 'aisdk' ? AISDKV5OutputStream<OUTPUT> : MastraModelOutput<OUTPUT>> {
    throw new MastraError({
      id: 'AGENT_STREAM_VNEXT_DEPRECATED',
      domain: ErrorDomain.AGENT,
      category: ErrorCategory.USER,
      text: 'streamVNext has been renamed to stream. Please use stream instead.',
    });
  }

  async stream<OUTPUT extends OutputSchema = undefined, FORMAT extends 'mastra' | 'aisdk' | undefined = undefined>(
    messages: MessageListInput,
    streamOptions?: AgentExecutionOptions<OUTPUT, FORMAT> & DeprecatedOutputOptions<OUTPUT>,
  ): Promise<FORMAT extends 'aisdk' ? AISDKV5OutputStream<OUTPUT> : MastraModelOutput<OUTPUT>> {
    const defaultStreamOptions = await this.getDefaultVNextStreamOptions<OUTPUT>({
      runtimeContext: streamOptions?.runtimeContext,
    });
    if (streamOptions?.structuredOutput?.schema && streamOptions?.output) {
      throw new MastraError({
        id: 'AGENT_STREAM_STRUCTURED_OUTPUT_AND_OUTPUT_PROVIDED',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: 'structuredOutput and output cannot be provided at the same time to agent.stream',
      });
    }

    const baseStreamOptions = {
      ...defaultStreamOptions,
      ...(streamOptions ?? {}),
      onFinish: this.#mergeOnFinishWithTelemetry(streamOptions, defaultStreamOptions),
    };

    // Deprecated `output` option now just maps to structuredOutput.schema
    // Create a new options object to avoid mutating
    const mergedStreamOptions = baseStreamOptions.output
      ? {
          structuredOutput: {
            schema: baseStreamOptions.output,
            ...baseStreamOptions.structuredOutput,
          } as StructuredOutputOptions<OUTPUT extends OutputSchema ? OUTPUT : never>,
          ...baseStreamOptions,
          output: undefined,
        }
      : baseStreamOptions;

    const llm = await this.getLLM({
      runtimeContext: mergedStreamOptions.runtimeContext,
    });

    const modelInfo = llm.getModel();

    // Apply OpenAI schema compatibility layer automatically for OpenAI models
    // In direct mode, use the main model; in processor mode, use structuredOutput.model
    if (
      'structuredOutput' in mergedStreamOptions &&
      mergedStreamOptions.structuredOutput &&
      mergedStreamOptions.structuredOutput.schema
    ) {
      let structuredOutputModel = llm.getModel();
      if (mergedStreamOptions.structuredOutput?.model) {
        structuredOutputModel = (await this.resolveModelConfig(
          mergedStreamOptions.structuredOutput?.model,
          mergedStreamOptions.runtimeContext || new RuntimeContext(),
        )) as MastraLanguageModelV2;
      }

      const targetProvider = structuredOutputModel.provider;
      const targetModelId = structuredOutputModel.modelId;
      // Only transform Zod schemas for OpenAI models, OpenAI is the most common and there is a huge issue that so many users run into
      // We transform all .optional() to .nullable().transform(v => v === null ? undefined : v)
      // OpenAI can't handle optional fields, we turn them to nullable and then transform the data received back so the types match the users schema
      if (targetProvider.includes('openai') || targetModelId.includes('openai')) {
        if (isZodType(mergedStreamOptions.structuredOutput.schema) && targetModelId) {
          const modelInfo: ModelInformation = {
            provider: targetProvider,
            modelId: targetModelId,
            supportsStructuredOutputs: false, // Set to false to enable transform
          };

          const isReasoningModel = /^o[1-5]/.test(targetModelId);
          const compatLayer = isReasoningModel
            ? new OpenAIReasoningSchemaCompatLayer(modelInfo)
            : new OpenAISchemaCompatLayer(modelInfo);

          if (compatLayer.shouldApply() && mergedStreamOptions.structuredOutput.schema) {
            mergedStreamOptions.structuredOutput.schema = compatLayer.processZodType(
              mergedStreamOptions.structuredOutput.schema,
            ) as OUTPUT extends OutputSchema ? OUTPUT : never;
          }
        }
      }
    }

    if (modelInfo.specificationVersion !== 'v2') {
      const modelId = modelInfo.modelId || 'unknown';
      const provider = modelInfo.provider || 'unknown';

      throw new MastraError({
        id: 'AGENT_STREAM_V1_MODEL_NOT_SUPPORTED',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `Agent \"${this.name}\" is using AI SDK v4 model (${provider}:${modelId}) which is not compatible with stream(). Please use AI SDK v5 models or call the streamLegacy() method instead. See https://mastra.ai/en/docs/streaming/overview for more information.`,
        details: {
          agentName: this.name,
          modelId,
          provider,
          specificationVersion: modelInfo.specificationVersion,
        },
      });
    }

    const executeOptions = {
      ...mergedStreamOptions,
      messages,
      methodType: 'stream',
    } as InnerAgentExecutionOptions<OUTPUT, FORMAT>;

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

    if (streamOptions?.format === 'aisdk') {
      this.logger.warn(
        'The `format: "aisdk"` is deprecated in stream/generate options. Use the @mastra/ai-sdk package instead. See https://mastra.ai/en/docs/frameworks/agentic-uis/ai-sdk#streaming',
      );
    }
    return result.result as FORMAT extends 'aisdk' ? AISDKV5OutputStream<OUTPUT> : MastraModelOutput<OUTPUT>;
  }

  /**
   * Resumes a previously suspended VNext stream execution.
   * Used to continue execution after a suspension point (e.g., tool approval, workflow suspend).
   *
   * @example
   * ```typescript
   * // Resume after suspension
   * const stream = await agent.resumeStreamVNext(
   *   { approved: true },
   *   { runId: 'previous-run-id' }
   * );
   * ```
   */
  async resumeStream<
    OUTPUT extends OutputSchema | undefined = undefined,
    FORMAT extends 'mastra' | 'aisdk' | undefined = undefined,
  >(
    resumeData: any,
    streamOptions?: AgentExecutionOptions<OUTPUT, FORMAT> & { toolCallId?: string },
  ): Promise<FORMAT extends 'aisdk' ? AISDKV5OutputStream<OUTPUT> : MastraModelOutput<OUTPUT>> {
    const defaultStreamOptions = await this.getDefaultVNextStreamOptions({
      runtimeContext: streamOptions?.runtimeContext,
    });

    let mergedStreamOptions = {
      ...defaultStreamOptions,
      ...streamOptions,
      onFinish: this.#mergeOnFinishWithTelemetry(streamOptions, defaultStreamOptions),
    };

    const llm = await this.getLLM({
      runtimeContext: mergedStreamOptions.runtimeContext,
    });

    if (llm.getModel().specificationVersion !== 'v2') {
      throw new MastraError({
        id: 'AGENT_STREAM_VNEXT_V1_MODEL_NOT_SUPPORTED',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: 'V1 models are not supported for stream. Please use streamLegacy instead.',
      });
    }

    const existingSnapshot = await this.#mastra?.getStorage()?.loadWorkflowSnapshot({
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
    } as InnerAgentExecutionOptions<OUTPUT, FORMAT>);

    if (result.status !== 'success') {
      if (result.status === 'failed') {
        throw new MastraError(
          {
            id: 'AGENT_STREAM_VNEXT_FAILED',
            domain: ErrorDomain.AGENT,
            category: ErrorCategory.USER,
          },
          // pass original error to preserve stack trace
          result.error,
        );
      }
      throw new MastraError({
        id: 'AGENT_STREAM_VNEXT_UNKNOWN_ERROR',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: 'An unknown error occurred while streaming',
      });
    }

    return result.result as unknown as FORMAT extends 'aisdk' ? AISDKV5OutputStream<OUTPUT> : MastraModelOutput<OUTPUT>;
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
  async approveToolCall<
    OUTPUT extends OutputSchema | undefined = undefined,
    FORMAT extends 'mastra' | 'aisdk' | undefined = undefined,
  >(
    options: AgentExecutionOptions<OUTPUT, FORMAT> & { runId: string; toolCallId?: string },
  ): Promise<FORMAT extends 'aisdk' ? AISDKV5OutputStream<OUTPUT> : MastraModelOutput<OUTPUT>> {
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
  async declineToolCall<
    OUTPUT extends OutputSchema | undefined = undefined,
    FORMAT extends 'mastra' | 'aisdk' | undefined = undefined,
  >(
    options: AgentExecutionOptions<OUTPUT, FORMAT> & { runId: string; toolCallId?: string },
  ): Promise<FORMAT extends 'aisdk' ? AISDKV5OutputStream<OUTPUT> : MastraModelOutput<OUTPUT>> {
    return this.resumeStream({ approved: false }, options);
  }

  /**
   * Legacy implementation of generate method using AI SDK v4 models.
   * Use this method if you need to continue using AI SDK v4 models after `generate()` switches to VNext.
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
    if ('structuredOutput' in generateOptions && generateOptions.structuredOutput) {
      throw new MastraError({
        id: 'AGENT_GENERATE_LEGACY_STRUCTURED_OUTPUT_NOT_SUPPORTED',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: 'This method does not support structured output. Please use generateVNext instead.',
      });
    }
    const defaultGenerateOptions = await this.getDefaultGenerateOptions({
      runtimeContext: generateOptions.runtimeContext,
    });
    const mergedGenerateOptions: AgentGenerateOptions<OUTPUT, EXPERIMENTAL_OUTPUT> = {
      ...defaultGenerateOptions,
      ...generateOptions,
      experimental_generateMessageId:
        defaultGenerateOptions.experimental_generateMessageId || this.#mastra?.generateId?.bind(this.#mastra),
    };

    const { llm, before, after } = await this.prepareLLMOptions(messages, mergedGenerateOptions, 'generate');

    if (llm.getModel().specificationVersion !== 'v1') {
      this.logger.error('V2 models are not supported for generateLegacy. Please use generate instead.', {
        modelId: llm.getModel().modelId,
      });

      throw new MastraError({
        id: 'AGENT_GENERATE_V2_MODEL_NOT_SUPPORTED',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        details: {
          modelId: llm.getModel().modelId,
        },
        text: 'V2 models are not supported for generateLegacy. Please use generate instead.',
      });
    }

    let llmToUse = llm as MastraLLMV1;

    const beforeResult = await before();
    const traceId = getValidTraceId(beforeResult.agentAISpan);

    // Check for tripwire and return early if triggered
    if (beforeResult.tripwire) {
      const tripwireResult = {
        text: '',
        object: undefined,
        usage: { totalTokens: 0, promptTokens: 0, completionTokens: 0 },
        finishReason: 'other',
        response: {
          id: randomUUID(),
          timestamp: new Date(),
          modelId: 'tripwire',
          messages: [],
        },
        responseMessages: [],
        toolCalls: [],
        toolResults: [],
        warnings: undefined,
        request: {
          body: JSON.stringify({ messages: [] }),
        },
        experimental_output: undefined,
        steps: undefined,
        experimental_providerMetadata: undefined,
        tripwire: true,
        tripwireReason: beforeResult.tripwireReason,
        traceId,
      };

      return tripwireResult as unknown as OUTPUT extends undefined
        ? GenerateTextResult<any, EXPERIMENTAL_OUTPUT>
        : GenerateObjectResult<OUTPUT>;
    }

    const { experimental_output, output, agentAISpan, ...llmOptions } = beforeResult;

    const tracingContext: TracingContext = { currentSpan: agentAISpan };

    // Handle structuredOutput option by creating an StructuredOutputProcessor
    let finalOutputProcessors = mergedGenerateOptions.outputProcessors;

    if (!output || experimental_output) {
      const result = await llmToUse.__text<any, EXPERIMENTAL_OUTPUT>({
        ...llmOptions,
        tracingContext,
        experimental_output,
      });

      const outputProcessorResult = await this.__runOutputProcessors({
        runtimeContext: mergedGenerateOptions.runtimeContext || new RuntimeContext(),
        tracingContext,
        outputProcessorOverrides: finalOutputProcessors,
        messageList: new MessageList({
          threadId: llmOptions.threadId || '',
          resourceId: llmOptions.resourceId || '',
        }).add(
          {
            role: 'assistant',
            content: [{ type: 'text', text: result.text }],
          },
          'response',
        ),
      });

      // Handle tripwire for output processors
      if (outputProcessorResult.tripwireTriggered) {
        const tripwireResult = {
          text: '',
          object: undefined,
          usage: { totalTokens: 0, promptTokens: 0, completionTokens: 0 },
          finishReason: 'other',
          response: {
            id: randomUUID(),
            timestamp: new Date(),
            modelId: 'tripwire',
            messages: [],
          },
          responseMessages: [],
          toolCalls: [],
          toolResults: [],
          warnings: undefined,
          request: {
            body: JSON.stringify({ messages: [] }),
          },
          experimental_output: undefined,
          steps: undefined,
          experimental_providerMetadata: undefined,
          tripwire: true,
          tripwireReason: outputProcessorResult.tripwireReason,
          traceId,
        };

        return tripwireResult as unknown as OUTPUT extends undefined
          ? GenerateTextResult<any, EXPERIMENTAL_OUTPUT>
          : GenerateObjectResult<OUTPUT>;
      }

      const newText = outputProcessorResult.messageList.get.response
        .v2()
        .map(msg => msg.content.parts.map(part => (part.type === 'text' ? part.text : '')).join(''))
        .join('');

      // Update the result text with processed output
      (result as any).text = newText;

      // If there are output processors, check for structured data in message metadata
      if (finalOutputProcessors && finalOutputProcessors.length > 0) {
        // First check if any output processor provided structured data via metadata
        const messages = outputProcessorResult.messageList.get.response.v2();
        this.logger.debug(
          'Checking messages for experimentalOutput metadata:',
          messages.map(m => ({
            role: m.role,
            hasContentMetadata: !!m.content.metadata,
            contentMetadata: m.content.metadata,
          })),
        );

        const messagesWithStructuredData = messages.filter(
          msg => msg.content.metadata && msg.content.metadata.structuredOutput,
        );

        this.logger.debug('Messages with structured data:', messagesWithStructuredData.length);

        if (messagesWithStructuredData[0] && messagesWithStructuredData[0].content.metadata?.structuredOutput) {
          // Use structured data from processor metadata for result.object
          (result as any).object = messagesWithStructuredData[0].content.metadata.structuredOutput;
          this.logger.debug('Using structured data from processor metadata for result.object');
        } else {
          // Fallback: try to parse text as JSON (original behavior)
          try {
            const processedOutput = JSON.parse(newText);
            (result as any).object = processedOutput;
            this.logger.debug('Using fallback JSON parsing for result.object');
          } catch (error) {
            this.logger.warn('Failed to parse processed output as JSON, updating text only', { error });
          }
        }
      }

      const overrideScorers = mergedGenerateOptions.scorers;
      const afterResult = await after({
        result: result as unknown as OUTPUT extends undefined
          ? GenerateTextResult<any, EXPERIMENTAL_OUTPUT>
          : GenerateObjectResult<OUTPUT>,
        outputText: newText,
        agentAISpan,
        ...(overrideScorers ? { overrideScorers } : {}),
      });

      if (generateOptions.returnScorerData) {
        result.scoringData = afterResult.scoringData;
      }

      result.traceId = traceId;

      return result as unknown as OUTPUT extends undefined
        ? GenerateTextResult<any, EXPERIMENTAL_OUTPUT>
        : GenerateObjectResult<OUTPUT>;
    }

    const result = await llmToUse.__textObject<NonNullable<OUTPUT>>({
      ...llmOptions,
      tracingContext,
      structuredOutput: output as NonNullable<OUTPUT>,
    });

    const outputText = JSON.stringify(result.object);

    const outputProcessorResult = await this.__runOutputProcessors({
      runtimeContext: mergedGenerateOptions.runtimeContext || new RuntimeContext(),
      tracingContext,
      messageList: new MessageList({
        threadId: llmOptions.threadId || '',
        resourceId: llmOptions.resourceId || '',
      }).add(
        {
          role: 'assistant',
          content: [{ type: 'text', text: outputText }],
        },
        'response',
      ),
    });

    // Handle tripwire for output processors
    if (outputProcessorResult.tripwireTriggered) {
      const tripwireResult = {
        text: '',
        object: undefined,
        usage: { totalTokens: 0, promptTokens: 0, completionTokens: 0 },
        finishReason: 'other',
        response: {
          id: randomUUID(),
          timestamp: new Date(),
          modelId: 'tripwire',
          messages: [],
        },
        responseMessages: [],
        toolCalls: [],
        toolResults: [],
        warnings: undefined,
        request: {
          body: JSON.stringify({ messages: [] }),
        },
        experimental_output: undefined,
        steps: undefined,
        experimental_providerMetadata: undefined,
        tripwire: true,
        tripwireReason: outputProcessorResult.tripwireReason,
        traceId,
      };

      return tripwireResult as unknown as OUTPUT extends undefined
        ? GenerateTextResult<any, EXPERIMENTAL_OUTPUT>
        : GenerateObjectResult<OUTPUT>;
    }

    const newText = outputProcessorResult.messageList.get.response
      .v2()
      .map(msg => msg.content.parts.map(part => (part.type === 'text' ? part.text : '')).join(''))
      .join('');

    // Parse the processed text and update the result object
    try {
      const processedObject = JSON.parse(newText);
      (result as any).object = processedObject;
    } catch (error) {
      this.logger.warn('Failed to parse processed output as JSON, keeping original result', { error });
    }

    const afterResult = await after({
      result: result as unknown as OUTPUT extends undefined
        ? GenerateTextResult<any, EXPERIMENTAL_OUTPUT>
        : GenerateObjectResult<OUTPUT>,
      outputText: newText,
      ...(generateOptions.scorers ? { overrideScorers: generateOptions.scorers } : {}),
      structuredOutput: true,
      agentAISpan,
    });

    if (generateOptions.returnScorerData) {
      result.scoringData = afterResult.scoringData;
    }

    result.traceId = traceId;

    return result as unknown as OUTPUT extends undefined
      ? GenerateTextResult<any, EXPERIMENTAL_OUTPUT>
      : GenerateObjectResult<OUTPUT>;
  }

  /**
   * Legacy implementation of stream method using AI SDK v4 models.
   * Use this method if you need to continue using AI SDK v4 models after `stream()` switches to VNext.
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
    const defaultStreamOptions = await this.getDefaultStreamOptions({ runtimeContext: streamOptions.runtimeContext });

    const mergedStreamOptions: AgentStreamOptions<OUTPUT, EXPERIMENTAL_OUTPUT> = {
      ...defaultStreamOptions,
      ...streamOptions,
      onFinish: this.#mergeOnFinishWithTelemetry(streamOptions, defaultStreamOptions),
      experimental_generateMessageId:
        defaultStreamOptions.experimental_generateMessageId || this.#mastra?.generateId?.bind(this.#mastra),
    };

    const { llm, before, after } = await this.prepareLLMOptions(messages, mergedStreamOptions, 'stream');

    if (llm.getModel().specificationVersion !== 'v1') {
      this.logger.error('V2 models are not supported for streamLegacy. Please use stream instead.', {
        modelId: llm.getModel().modelId,
      });

      throw new MastraError({
        id: 'AGENT_STREAM_V2_MODEL_NOT_SUPPORTED',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        details: {
          modelId: llm.getModel().modelId,
        },
        text: 'V2 models are not supported for streamLegacy. Please use stream instead.',
      });
    }

    const beforeResult = await before();
    const traceId = getValidTraceId(beforeResult.agentAISpan);

    // Check for tripwire and return early if triggered
    if (beforeResult.tripwire) {
      // Return a promise that resolves immediately with empty result
      const emptyResult = {
        textStream: (async function* () {
          // Empty async generator - yields nothing
        })(),
        fullStream: Promise.resolve('').then(() => {
          const emptyStream = new (globalThis as any).ReadableStream({
            start(controller: any) {
              controller.close();
            },
          });
          return emptyStream;
        }),
        text: Promise.resolve(''),
        usage: Promise.resolve({ totalTokens: 0, promptTokens: 0, completionTokens: 0 }),
        finishReason: Promise.resolve('other'),
        tripwire: true,
        tripwireReason: beforeResult.tripwireReason,
        response: {
          id: randomUUID(),
          timestamp: new Date(),
          modelId: 'tripwire',
          messages: [],
        },
        toolCalls: Promise.resolve([]),
        toolResults: Promise.resolve([]),
        warnings: Promise.resolve(undefined),
        request: {
          body: JSON.stringify({ messages: [] }),
        },
        experimental_output: undefined,
        steps: undefined,
        experimental_providerMetadata: undefined,
        traceId,
        toAIStream: () =>
          Promise.resolve('').then(() => {
            const emptyStream = new (globalThis as any).ReadableStream({
              start(controller: any) {
                controller.close();
              },
            });
            return emptyStream;
          }),
        get experimental_partialOutputStream() {
          return (async function* () {
            // Empty async generator for partial output stream
          })();
        },
        pipeDataStreamToResponse: () => Promise.resolve(),
        pipeTextStreamToResponse: () => Promise.resolve(),
        toDataStreamResponse: () => new Response('', { status: 200, headers: { 'Content-Type': 'text/plain' } }),
        toTextStreamResponse: () => new Response('', { status: 200, headers: { 'Content-Type': 'text/plain' } }),
      };

      return emptyResult as unknown as
        | StreamTextResult<any, OUTPUT extends ZodSchema ? z.infer<OUTPUT> : unknown>
        | (StreamObjectResult<any, OUTPUT extends ZodSchema ? z.infer<OUTPUT> : unknown, any> & TracingProperties);
    }

    const { onFinish, runId, output, experimental_output, agentAISpan, ...llmOptions } = beforeResult;

    const overrideScorers = mergedStreamOptions.scorers;
    const tracingContext: TracingContext = { currentSpan: agentAISpan };

    if (!output || experimental_output) {
      this.logger.debug(`Starting agent ${this.name} llm stream call`, {
        runId,
      });

      const streamResult = llm.__stream({
        ...llmOptions,
        experimental_output,
        tracingContext,
        outputProcessors: await this.getResolvedOutputProcessors(mergedStreamOptions.runtimeContext),
        onFinish: async result => {
          try {
            const outputText = result.text;
            await after({
              result,
              outputText,
              agentAISpan,
              ...(overrideScorers ? { overrideScorers } : {}),
            });
          } catch (e) {
            this.logger.error('Error saving memory on finish', {
              error: e,
              runId,
            });
          }
          await onFinish?.({ ...result, runId } as any);
        },
        runId,
      });

      streamResult.traceId = traceId;

      return streamResult as
        | StreamTextResult<any, OUTPUT extends ZodSchema ? z.infer<OUTPUT> : unknown>
        | (StreamObjectResult<any, OUTPUT extends ZodSchema ? z.infer<OUTPUT> : unknown, any> & TracingProperties);
    }

    this.logger.debug(`Starting agent ${this.name} llm streamObject call`, {
      runId,
    });

    const streamObjectResult = llm.__streamObject({
      ...llmOptions,
      tracingContext,
      onFinish: async result => {
        try {
          const outputText = JSON.stringify(result.object);
          await after({
            result,
            outputText,
            structuredOutput: true,
            agentAISpan,
            ...(overrideScorers ? { overrideScorers } : {}),
          });
        } catch (e) {
          this.logger.error('Error saving memory on finish', {
            error: e,
            runId,
          });
        }
        await onFinish?.({ ...result, runId } as any);
      },
      runId,
      structuredOutput: output,
    });

    (streamObjectResult as any).traceId = traceId;

    return streamObjectResult as StreamObjectResult<any, OUTPUT extends ZodSchema ? z.infer<OUTPUT> : unknown, any> &
      TracingProperties;
  }

  /**
   * Convert text to speech using the configured voice provider
   * @param input Text or text stream to convert to speech
   * @param options Speech options including speaker and provider-specific options
   * @returns Audio stream
   * @deprecated Use agent.voice.speak() instead
   */
  async speak(
    input: string | NodeJS.ReadableStream,
    options?: {
      speaker?: string;
      [key: string]: any;
    },
  ): Promise<NodeJS.ReadableStream | void> {
    if (!this.voice) {
      const mastraError = new MastraError({
        id: 'AGENT_SPEAK_METHOD_VOICE_NOT_CONFIGURED',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        details: {
          agentName: this.name,
        },
        text: 'No voice provider configured',
      });
      this.logger.trackException(mastraError);
      this.logger.error(mastraError.toString());
      throw mastraError;
    }

    this.logger.warn('Warning: agent.speak() is deprecated. Please use agent.voice.speak() instead.');

    try {
      return this.voice.speak(input, options);
    } catch (e: unknown) {
      let err;
      if (e instanceof MastraError) {
        err = e;
      } else {
        err = new MastraError(
          {
            id: 'AGENT_SPEAK_METHOD_ERROR',
            domain: ErrorDomain.AGENT,
            category: ErrorCategory.UNKNOWN,
            details: {
              agentName: this.name,
            },
            text: 'Error during agent speak',
          },
          e,
        );
      }
      this.logger.trackException(err);
      this.logger.error(err.toString());
      throw err;
    }
  }

  /**
   * Convert speech to text using the configured voice provider
   * @param audioStream Audio stream to transcribe
   * @param options Provider-specific transcription options
   * @returns Text or text stream
   * @deprecated Use agent.voice.listen() instead
   */
  async listen(
    audioStream: NodeJS.ReadableStream,
    options?: {
      [key: string]: any;
    },
  ): Promise<string | NodeJS.ReadableStream | void> {
    if (!this.voice) {
      const mastraError = new MastraError({
        id: 'AGENT_LISTEN_METHOD_VOICE_NOT_CONFIGURED',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        details: {
          agentName: this.name,
        },
        text: 'No voice provider configured',
      });
      this.logger.trackException(mastraError);
      this.logger.error(mastraError.toString());
      throw mastraError;
    }
    this.logger.warn('Warning: agent.listen() is deprecated. Please use agent.voice.listen() instead');

    try {
      return this.voice.listen(audioStream, options);
    } catch (e: unknown) {
      let err;
      if (e instanceof MastraError) {
        err = e;
      } else {
        err = new MastraError(
          {
            id: 'AGENT_LISTEN_METHOD_ERROR',
            domain: ErrorDomain.AGENT,
            category: ErrorCategory.UNKNOWN,
            details: {
              agentName: this.name,
            },
            text: 'Error during agent listen',
          },
          e,
        );
      }
      this.logger.trackException(err);
      this.logger.error(err.toString());
      throw err;
    }
  }

  /**
   * Get a list of available speakers from the configured voice provider
   * @throws {Error} If no voice provider is configured
   * @returns {Promise<Array<{voiceId: string}>>} List of available speakers
   * @deprecated Use agent.voice.getSpeakers() instead
   */
  async getSpeakers() {
    if (!this.voice) {
      const mastraError = new MastraError({
        id: 'AGENT_SPEAKERS_METHOD_VOICE_NOT_CONFIGURED',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        details: {
          agentName: this.name,
        },
        text: 'No voice provider configured',
      });
      this.logger.trackException(mastraError);
      this.logger.error(mastraError.toString());
      throw mastraError;
    }

    this.logger.warn('Warning: agent.getSpeakers() is deprecated. Please use agent.voice.getSpeakers() instead.');

    try {
      return await this.voice.getSpeakers();
    } catch (e: unknown) {
      let err;
      if (e instanceof MastraError) {
        err = e;
      } else {
        err = new MastraError(
          {
            id: 'AGENT_GET_SPEAKERS_METHOD_ERROR',
            domain: ErrorDomain.AGENT,
            category: ErrorCategory.UNKNOWN,
            details: {
              agentName: this.name,
            },
            text: 'Error during agent getSpeakers',
          },
          e,
        );
      }
      this.logger.trackException(err);
      this.logger.error(err.toString());
      throw err;
    }
  }

  /**
   * Converts the agent to a workflow step for use in legacy workflows.
   * The step accepts a prompt and returns text output.
   *
   * @deprecated Use agent directly in workflows instead
   *
   * @example
   * ```typescript
   * const agentStep = agent.toStep();
   * const workflow = new Workflow({
   *   steps: {
   *     analyze: agentStep
   *   }
   * });
   * ```
   */
  toStep(): Step<TAgentId, z.ZodObject<{ prompt: z.ZodString }>, z.ZodObject<{ text: z.ZodString }>, any> {
    const x = agentToStep(this);
    return new Step(x);
  }

  /**
   * Resolves the configuration for title generation.
   * @internal
   */
  resolveTitleGenerationConfig(
    generateTitleConfig:
      | boolean
      | { model: DynamicArgument<MastraLanguageModel>; instructions?: DynamicArgument<string> }
      | undefined,
  ): {
    shouldGenerate: boolean;
    model?: DynamicArgument<MastraLanguageModel>;
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
    runtimeContext: RuntimeContext,
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
      const result = instructions({ runtimeContext, mastra: this.#mastra });
      return resolveMaybePromise(result, resolvedInstructions => {
        return resolvedInstructions || DEFAULT_TITLE_INSTRUCTIONS;
      });
    }
  }
}
