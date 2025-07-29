import { randomUUID } from 'crypto';
import type { ReadableStream, WritableStream } from 'stream/web';
import type { CoreMessage, StreamObjectResult, StreamTextResult, TextPart, Tool, UIMessage } from 'ai';
import deepEqual from 'fast-deep-equal';
import type { JSONSchema7 } from 'json-schema';
import type { ZodSchema, z } from 'zod';
import type { MastraPrimitives, MastraUnion } from '../action';
import { MastraBase } from '../base';
import { MastraError, ErrorDomain, ErrorCategory } from '../error';
import type { Metric } from '../eval';
import { AvailableHooks, executeHook } from '../hooks';
import { MastraLLM } from '../llm/model';
import type { MastraLLMBase } from '../llm/model';
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
  TripwireProperties,
} from '../llm/model/base.types';
import { RegisteredLogger } from '../logger';
import type { Mastra } from '../mastra';
import type { MastraMemory } from '../memory/memory';
import type { MemoryConfig, StorageThreadType } from '../memory/types';
import { RuntimeContext } from '../runtime-context';
import type { MastraScorers } from '../scores';
import { runScorer } from '../scores/hooks';
import { MastraAgentStream } from '../stream/MastraAgentStream';
import type { ChunkType } from '../stream/MastraAgentStream';
import { InstrumentClass } from '../telemetry';
import { Telemetry } from '../telemetry/telemetry';
import type { CoreTool } from '../tools/types';
import type { DynamicArgument } from '../types';
import { makeCoreTool, createMastraProxy, ensureToolProperties } from '../utils';
import type { CompositeVoice } from '../voice';
import { DefaultVoice } from '../voice';
import type { Workflow } from '../workflows';
import { agentToStep, LegacyStep as Step } from '../workflows/legacy';
import type { AgentVNextStreamOptions } from './agent.types';
import type { InputProcessor } from './input-processor';
import { runInputProcessors } from './input-processor/runner';
import { MessageList } from './message-list';
import type { MessageInput, UIMessageWithMetadata } from './message-list';
import { SaveQueueManager } from './save-queue';
import { TripWire } from './trip-wire';
import type {
  AgentConfig,
  MastraLanguageModel,
  AgentGenerateOptions,
  AgentStreamOptions,
  AiMessageType,
  ToolsetsInput,
  ToolsInput,
  AgentMemoryOption,
} from './types';
export type { ChunkType, MastraAgentStream } from '../stream/MastraAgentStream';
export * from './input-processor';
export { TripWire };
export { MessageList };
export * from './types';
type IDGenerator = () => string;

function resolveMaybePromise<T, R = void>(value: T | Promise<T>, cb: (value: T) => R) {
  if (value instanceof Promise) {
    return value.then(cb);
  }

  return cb(value);
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

@InstrumentClass({
  prefix: 'agent',
  excludeMethods: [
    'hasOwnMemory',
    'getMemory',
    '__primitive',
    '__registerMastra',
    '__registerPrimitives',
    '__runInputProcessors',
    '__setTools',
    '__setLogger',
    '__setTelemetry',
    'log',
    'getModel',
    'getInstructions',
    'getTools',
    'getLLM',
    'getWorkflows',
    'getDefaultGenerateOptions',
    'getDefaultStreamOptions',
    'getDescription',
  ],
})
export class Agent<
  TAgentId extends string = string,
  TTools extends ToolsInput = ToolsInput,
  TMetrics extends Record<string, Metric> = Record<string, Metric>,
> extends MastraBase {
  public id: TAgentId;
  public name: TAgentId;
  #instructions: DynamicArgument<string>;
  readonly #description?: string;
  readonly model?: DynamicArgument<MastraLanguageModel>;
  #mastra?: Mastra;
  #memory?: DynamicArgument<MastraMemory>;
  #workflows?: DynamicArgument<Record<string, Workflow>>;
  #defaultGenerateOptions: DynamicArgument<AgentGenerateOptions>;
  #defaultStreamOptions: DynamicArgument<AgentStreamOptions>;
  #defaultVNextStreamOptions: DynamicArgument<AgentVNextStreamOptions<any, any>>;
  #tools: DynamicArgument<TTools>;
  evals: TMetrics;
  #scorers: DynamicArgument<MastraScorers>;
  #voice: CompositeVoice;
  #inputProcessors?: DynamicArgument<InputProcessor[]>;

  // This flag is for agent network messages. We should change the agent network formatting and remove this flag after.
  private _agentNetworkAppend = false;

  constructor(config: AgentConfig<TAgentId, TTools, TMetrics>) {
    super({ component: RegisteredLogger.AGENT });

    this.name = config.name;
    this.id = config.id ?? config.name;

    this.#instructions = config.instructions;
    this.#description = config.description;

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

    this.model = config.model;

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

    // @ts-ignore Flag for agent network messages
    this._agentNetworkAppend = config._agentNetworkAppend || false;
  }

  public hasOwnMemory(): boolean {
    return Boolean(this.#memory);
  }

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

    if (resolvedMemory && !resolvedMemory.hasOwnStorage && this.#mastra) {
      const storage = this.#mastra.getStorage();
      if (storage) {
        resolvedMemory.setStorage(storage);
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

  public async getWorkflows({
    runtimeContext = new RuntimeContext(),
  }: { runtimeContext?: RuntimeContext } = {}): Promise<Record<string, Workflow>> {
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

  public async getVoice({ runtimeContext }: { runtimeContext?: RuntimeContext } = {}) {
    if (this.#voice) {
      const voice = this.#voice;
      voice?.addTools(await this.getTools({ runtimeContext }));
      voice?.addInstructions(await this.getInstructions({ runtimeContext }));
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

    return this.#instructions;
  }

  public getInstructions({ runtimeContext = new RuntimeContext() }: { runtimeContext?: RuntimeContext } = {}):
    | string
    | Promise<string> {
    if (typeof this.#instructions === 'string') {
      return this.#instructions;
    }

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

  public getDescription(): string {
    return this.#description ?? '';
  }

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

  public getDefaultVNextStreamOptions<
    Output extends ZodSchema | undefined,
    StructuredOutput extends ZodSchema | undefined,
  >({ runtimeContext = new RuntimeContext() }: { runtimeContext?: RuntimeContext } = {}):
    | AgentVNextStreamOptions<Output, StructuredOutput>
    | Promise<AgentVNextStreamOptions<Output, StructuredOutput>> {
    if (typeof this.#defaultVNextStreamOptions !== 'function') {
      return this.#defaultVNextStreamOptions as AgentVNextStreamOptions<Output, StructuredOutput>;
    }

    const result = this.#defaultVNextStreamOptions({ runtimeContext, mastra: this.#mastra }) as
      | AgentVNextStreamOptions<Output, StructuredOutput>
      | Promise<AgentVNextStreamOptions<Output, StructuredOutput>>;
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

      return options;
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
   * Gets or creates an LLM instance based on the current model
   * @param options Options for getting the LLM
   * @returns A promise that resolves to the LLM instance
   */
  public getLLM({
    runtimeContext = new RuntimeContext(),
    model,
  }: {
    runtimeContext?: RuntimeContext;
    model?: MastraLanguageModel | DynamicArgument<MastraLanguageModel>;
  } = {}): MastraLLMBase | Promise<MastraLLMBase> {
    // If model is provided, resolve it; otherwise use the agent's model
    const modelToUse = model
      ? typeof model === 'function'
        ? model({ runtimeContext, mastra: this.#mastra })
        : model
      : this.getModel({ runtimeContext });

    return resolveMaybePromise(modelToUse, resolvedModel => {
      const llm = new MastraLLM({ model: resolvedModel, mastra: this.#mastra });

      // Apply stored primitives if available
      if (this.#primitives) {
        llm.__registerPrimitives(this.#primitives);
      }

      if (this.#mastra) {
        llm.__registerMastra(this.#mastra);
      }

      return llm;
    });
  }

  /**
   * Gets the model, resolving it if it's a function
   * @param options Options for getting the model
   * @returns A promise that resolves to the model
   */
  public getModel({ runtimeContext = new RuntimeContext() }: { runtimeContext?: RuntimeContext } = {}):
    | MastraLanguageModel
    | Promise<MastraLanguageModel> {
    if (typeof this.model !== 'function') {
      if (!this.model) {
        const mastraError = new MastraError({
          id: 'AGENT_GET_MODEL_MISSING_MODEL_INSTANCE',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          details: {
            agentName: this.name,
          },
          text: `[Agent:${this.name}] - No model provided`,
        });
        this.logger.trackException(mastraError);
        this.logger.error(mastraError.toString());
        throw mastraError;
      }

      return this.model;
    }

    const result = this.model({ runtimeContext, mastra: this.#mastra });
    return resolveMaybePromise(result, model => {
      if (!model) {
        const mastraError = new MastraError({
          id: 'AGENT_GET_MODEL_FUNCTION_EMPTY_RETURN',
          domain: ErrorDomain.AGENT,
          category: ErrorCategory.USER,
          details: {
            agentName: this.name,
          },
          text: `[Agent:${this.name}] - Function-based model returned empty value`,
        });
        this.logger.trackException(mastraError);
        this.logger.error(mastraError.toString());
        throw mastraError;
      }

      return model;
    });
  }

  __updateInstructions(newInstructions: string) {
    this.#instructions = newInstructions;
    this.logger.debug(`[Agents:${this.name}] Instructions updated.`, { model: this.model, name: this.name });
  }

  #primitives?: MastraPrimitives;

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

  __registerMastra(mastra: Mastra) {
    this.#mastra = mastra;
    // Mastra will be passed to the LLM when it's created in getLLM()
  }

  /**
   * Set the concrete tools for the agent
   * @param tools
   */
  __setTools(tools: TTools) {
    this.#tools = tools;
    this.logger.debug(`[Agents:${this.name}] Tools set for agent ${this.name}`, { model: this.model, name: this.name });
  }

  async generateTitleFromUserMessage({
    message,
    runtimeContext = new RuntimeContext(),
    model,
    instructions,
  }: {
    message: string | MessageInput;
    runtimeContext?: RuntimeContext;
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

    const { text } = await llm.__text({
      runtimeContext,
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

      const processedMemoryMessages = memory.processMessages({
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

  private async getMemoryTools({
    runId,
    resourceId,
    threadId,
    runtimeContext,
    mastraProxy,
  }: {
    runId?: string;
    resourceId?: string;
    threadId?: string;
    runtimeContext: RuntimeContext;
    mastraProxy?: MastraUnion;
  }) {
    let convertedMemoryTools: Record<string, CoreTool> = {};
    // Get memory tools if available
    const memory = await this.getMemory({ runtimeContext });
    const memoryTools = memory?.getTools?.();

    if (memoryTools) {
      const memoryToolEntries = await Promise.all(
        Object.entries(memoryTools).map(async ([k, tool]) => {
          return [
            k,
            {
              description: tool.description,
              parameters: tool.parameters,
              execute:
                typeof tool?.execute === 'function'
                  ? async (args: any, options: any) => {
                      try {
                        this.logger.debug(`[Agent:${this.name}] - Executing memory tool ${k}`, {
                          name: k,
                          description: tool.description,
                          args,
                          runId,
                          threadId,
                          resourceId,
                        });
                        return (
                          tool?.execute?.(
                            {
                              context: args,
                              mastra: mastraProxy as MastraUnion | undefined,
                              memory,
                              runId,
                              threadId,
                              resourceId,
                              logger: this.logger,
                              agentName: this.name,
                              runtimeContext,
                            },
                            options,
                          ) ?? undefined
                        );
                      } catch (err) {
                        const mastraError = new MastraError(
                          {
                            id: 'AGENT_MEMORY_TOOL_EXECUTION_FAILED',
                            domain: ErrorDomain.AGENT,
                            category: ErrorCategory.USER,
                            details: {
                              agentName: this.name,
                              runId: runId || '',
                              threadId: threadId || '',
                              resourceId: resourceId || '',
                            },
                            text: `[Agent:${this.name}] - Failed memory tool execution`,
                          },
                          err,
                        );
                        this.logger.trackException(mastraError);
                        this.logger.error(mastraError.toString());
                        throw mastraError;
                      }
                    }
                  : undefined,
            },
          ] as [string, CoreTool];
        }),
      );

      convertedMemoryTools = Object.fromEntries(
        memoryToolEntries.filter((entry): entry is [string, CoreTool] => Boolean(entry)),
      );
    }
    return convertedMemoryTools;
  }

  private async __runInputProcessors({
    runtimeContext,
    messageList,
  }: {
    runtimeContext: RuntimeContext;
    messageList: MessageList;
  }): Promise<{
    messageList: MessageList;
    tripwireTriggered: boolean;
    tripwireReason: string;
  }> {
    let tripwireTriggered = false;
    let tripwireReason = '';

    if (this.#inputProcessors) {
      const processors =
        typeof this.#inputProcessors === 'function'
          ? await this.#inputProcessors({ runtimeContext })
          : this.#inputProcessors;

      // Create traced version of runInputProcessors similar to workflow _runStep pattern
      const tracedRunInputProcessors = (processors: any[], messageList: MessageList) => {
        const telemetry = this.#mastra?.getTelemetry();
        if (!telemetry) {
          return runInputProcessors(processors, messageList, undefined);
        }

        return telemetry.traceMethod(
          async (data: { processors: any[]; messageList: MessageList }) => {
            return runInputProcessors(data.processors, data.messageList, telemetry);
          },
          {
            spanName: `agent.${this.name}.inputProcessors`,
            attributes: {
              'agent.name': this.name,
              'inputProcessors.count': processors.length.toString(),
              'inputProcessors.names': processors.map(p => p.name).join(','),
            },
          },
        )({ processors, messageList });
      };

      try {
        messageList = await tracedRunInputProcessors(processors, messageList);
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

  private async getAssignedTools({
    runtimeContext,
    runId,
    resourceId,
    threadId,
    mastraProxy,
    writableStream,
  }: {
    runId?: string;
    resourceId?: string;
    threadId?: string;
    runtimeContext: RuntimeContext;
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

        const options = {
          name: k,
          runId,
          threadId,
          resourceId,
          logger: this.logger,
          mastra: mastraProxy as MastraUnion | undefined,
          memory,
          agentName: this.name,
          runtimeContext,
          model: typeof this.model === 'function' ? await this.getModel({ runtimeContext }) : this.model,
          writableStream,
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

  private async getToolsets({
    runId,
    threadId,
    resourceId,
    toolsets,
    runtimeContext,
    mastraProxy,
  }: {
    runId?: string;
    threadId?: string;
    resourceId?: string;
    toolsets: ToolsetsInput;
    runtimeContext: RuntimeContext;
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
          const options = {
            name: toolName,
            runId,
            threadId,
            resourceId,
            logger: this.logger,
            mastra: mastraProxy as MastraUnion | undefined,
            memory,
            agentName: this.name,
            runtimeContext,
            model: typeof this.model === 'function' ? await this.getModel({ runtimeContext }) : this.model,
          };
          const convertedToCoreTool = makeCoreTool(toolObj, options, 'toolset');
          toolsForRequest[toolName] = convertedToCoreTool;
        }
      }
    }

    return toolsForRequest;
  }

  private async getClientTools({
    runId,
    threadId,
    resourceId,
    runtimeContext,
    mastraProxy,
    clientTools,
  }: {
    runId?: string;
    threadId?: string;
    resourceId?: string;
    runtimeContext: RuntimeContext;
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
        const options = {
          name: toolName,
          runId,
          threadId,
          resourceId,
          logger: this.logger,
          mastra: mastraProxy as MastraUnion | undefined,
          memory,
          agentName: this.name,
          runtimeContext,
          model: typeof this.model === 'function' ? await this.getModel({ runtimeContext }) : this.model,
        };
        const convertedToCoreTool = makeCoreTool(rest, options, 'client-tool');
        toolsForRequest[toolName] = convertedToCoreTool;
      }
    }

    return toolsForRequest;
  }

  private async getWorkflowTools({
    runId,
    threadId,
    resourceId,
    runtimeContext,
  }: {
    runId?: string;
    threadId?: string;
    resourceId?: string;
    runtimeContext: RuntimeContext;
  }) {
    let convertedWorkflowTools: Record<string, CoreTool> = {};
    const workflows = await this.getWorkflows({ runtimeContext });
    if (Object.keys(workflows).length > 0) {
      convertedWorkflowTools = Object.entries(workflows).reduce(
        (memo, [workflowName, workflow]) => {
          memo[workflowName] = {
            description: workflow.description || `Workflow: ${workflowName}`,
            parameters: workflow.inputSchema || { type: 'object', properties: {} },
            execute: async (args: any) => {
              try {
                this.logger.debug(`[Agent:${this.name}] - Executing workflow as tool ${workflowName}`, {
                  name: workflowName,
                  description: workflow.description,
                  args,
                  runId,
                  threadId,
                  resourceId,
                });

                const run = workflow.createRun();

                const result = await run.start({
                  inputData: args,
                  runtimeContext,
                });
                return result;
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
          };
          return memo;
        },
        {} as Record<string, CoreTool>,
      );
    }

    return convertedWorkflowTools;
  }

  private async convertTools({
    toolsets,
    clientTools,
    threadId,
    resourceId,
    runId,
    runtimeContext,
    writableStream,
  }: {
    toolsets?: ToolsetsInput;
    clientTools?: ToolsInput;
    threadId?: string;
    resourceId?: string;
    runId?: string;
    runtimeContext: RuntimeContext;
    writableStream?: WritableStream<ChunkType>;
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
      mastraProxy,
      writableStream,
    });

    const memoryTools = await this.getMemoryTools({
      runId,
      resourceId,
      threadId,
      runtimeContext,
      mastraProxy,
    });

    const toolsetTools = await this.getToolsets({
      runId,
      resourceId,
      threadId,
      runtimeContext,
      mastraProxy,
      toolsets: toolsets!,
    });

    const clientsideTools = await this.getClientTools({
      runId,
      resourceId,
      threadId,
      runtimeContext,
      mastraProxy,
      clientTools: clientTools!,
    });

    const workflowTools = await this.getWorkflowTools({
      runId,
      resourceId,
      threadId,
      runtimeContext,
    });

    return {
      ...assignedTools,
      ...memoryTools,
      ...toolsetTools,
      ...clientsideTools,
      ...workflowTools,
    };
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
    generateMessageId,
    saveQueueManager,
    writableStream,
  }: {
    instructions: string;
    toolsets?: ToolsetsInput;
    clientTools?: ToolsInput;
    resourceId?: string;
    thread?: (Partial<StorageThreadType> & { id: string }) | undefined;
    memoryConfig?: MemoryConfig;
    context?: CoreMessage[];
    runId?: string;
    messages: string | string[] | CoreMessage[] | AiMessageType[] | UIMessageWithMetadata[];
    runtimeContext: RuntimeContext;
    generateMessageId: undefined | IDGenerator;
    saveQueueManager: SaveQueueManager;
    writableStream?: WritableStream<ChunkType>;
  }) {
    return {
      before: async () => {
        if (process.env.NODE_ENV !== 'test') {
          this.logger.debug(`[Agents:${this.name}] - Starting generation`, { runId });
        }

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
          writableStream,
        });

        const messageList = new MessageList({
          threadId,
          resourceId,
          generateMessageId,
          // @ts-ignore Flag for agent network messages
          _agentNetworkAppend: this._agentNetworkAppend,
        })
          .addSystem({
            role: 'system',
            content: instructions || `${this.instructions}.`,
          })
          .add(context || [], 'context');

        if (!memory || (!threadId && !resourceId)) {
          messageList.add(messages, 'user');
          const { tripwireTriggered, tripwireReason } = await this.__runInputProcessors({
            runtimeContext,
            messageList,
          });
          return {
            messageObjects: messageList.get.all.prompt(),
            convertedTools,
            threadExists: false,
            thread: undefined,
            messageList,
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

        let [memoryMessages, memorySystemMessage] = existingThread
          ? await Promise.all([
              this.getMemoryMessages({
                resourceId,
                threadId: threadObject.id,
                vectorMessageSearch: new MessageList().add(messages, `user`).getLatestUserContent() || '',
                memoryConfig,
                runtimeContext,
              }),
              memory.getSystemMessage({ threadId: threadObject.id, resourceId, memoryConfig }),
            ])
          : [[], null];

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
          messageList,
        });

        const systemMessage =
          [...messageList.getSystemMessages(), ...messageList.getSystemMessages('memory')]
            ?.map(m => m.content)
            ?.join(`\n`) ?? undefined;

        const processedMemoryMessages = memory.processMessages({
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
          generateMessageId: this.#mastra?.generateId.bind(this.#mastra),
          // @ts-ignore Flag for agent network messages
          _agentNetworkAppend: this._agentNetworkAppend,
        })
          .addSystem(instructions || `${this.instructions}.`)
          .addSystem(memorySystemMessage)
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
        toolCallsCollection,
        structuredOutput = false,
      }: {
        runId: string;
        result: Record<string, any>;
        thread: StorageThreadType | null | undefined;
        threadId?: string;
        memoryConfig: MemoryConfig | undefined;
        outputText: string;
        messageList: MessageList;
        threadExists: boolean;
        toolCallsCollection: Map<string, any>;
        structuredOutput?: boolean;
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
                  this.genTitle(userMessage, runtimeContext, titleModel, titleInstructions).then(title => {
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
        }

        const outputForScoring = {
          text: result?.text,
          object: result?.object,
          usage: result?.usage,
          toolCalls: Array.from(toolCallsCollection.values()),
        };

        await this.#runScorers({
          messageList,
          runId,
          outputText,
          output: outputForScoring,
          instructions,
          runtimeContext,
          structuredOutput,
        });
      },
    };
  }

  async #runScorers({
    messageList,
    runId,
    outputText,
    output,
    instructions,
    runtimeContext,
    structuredOutput,
  }: {
    messageList: MessageList;
    runId: string;
    output: Record<string, any>;
    outputText: string;
    instructions: string;
    runtimeContext: RuntimeContext;
    structuredOutput?: boolean;
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
          instructions: instructions,
        });
      }
    }

    const scorers = await this.getScorers({ runtimeContext });

    if (Object.keys(scorers || {}).length > 0) {
      for (const [id, scorerObject] of Object.entries(scorers)) {
        runScorer({
          scorerId: id,
          scorerObject: scorerObject,
          runId,
          input: userInputMessages,
          output,
          runtimeContext,
          entity: {
            id: this.id,
            name: this.name,
          },
          source: 'LIVE',
          entityType: 'AGENT',
          structuredOutput: !!structuredOutput,
        });
      }
    }
  }

  private prepareLLMOptions<
    Tools extends ToolSet,
    Output extends ZodSchema | JSONSchema7 | undefined = undefined,
    ExperimentalOutput extends ZodSchema | JSONSchema7 | undefined = undefined,
  >(
    messages: string | string[] | CoreMessage[] | AiMessageType[] | UIMessageWithMetadata[],
    options: AgentGenerateOptions<Output, ExperimentalOutput>,
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
      > & { runId: string } & TripwireProperties
    >;
    after: (args: {
      result: GenerateReturn<any, Output, ExperimentalOutput>;
      outputText: string;
      structuredOutput?: boolean;
    }) => Promise<void>;
    llm: MastraLLMBase;
  }>;
  private prepareLLMOptions<
    Tools extends ToolSet,
    Output extends ZodSchema | JSONSchema7 | undefined = undefined,
    ExperimentalOutput extends ZodSchema | JSONSchema7 | undefined = undefined,
  >(
    messages: string | string[] | CoreMessage[] | AiMessageType[] | UIMessageWithMetadata[],
    options: AgentStreamOptions<Output, ExperimentalOutput>,
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
      > & { runId: string } & TripwireProperties
    >;
    after: (args: {
      result: OriginalStreamTextOnFinishEventArg<any> | OriginalStreamObjectOnFinishEventArg<ExperimentalOutput>;
      outputText: string;
      structuredOutput?: boolean;
    }) => Promise<void>;
    llm: MastraLLMBase;
  }>;
  private async prepareLLMOptions<
    Tools extends ToolSet,
    Output extends ZodSchema | JSONSchema7 | undefined = undefined,
    ExperimentalOutput extends ZodSchema | JSONSchema7 | undefined = undefined,
  >(
    messages: string | string[] | CoreMessage[] | AiMessageType[] | UIMessageWithMetadata[],
    options: (AgentGenerateOptions<Output, ExperimentalOutput> | AgentStreamOptions<Output, ExperimentalOutput>) & {
      writableStream?: WritableStream<ChunkType>;
    },
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
          > & { runId: string } & TripwireProperties
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
          > & { runId: string } & TripwireProperties
        >);
    after:
      | ((args: { result: GenerateReturn<any, Output, ExperimentalOutput>; outputText: string }) => Promise<void>)
      | ((args: {
          result: OriginalStreamTextOnFinishEventArg<any> | OriginalStreamObjectOnFinishEventArg<ExperimentalOutput>;
          outputText: string;
        }) => Promise<void>);
    llm: MastraLLMBase;
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
      savePerStep,
      writableStream,
      ...args
    } = options;

    const generateMessageId =
      `experimental_generateMessageId` in args && typeof args.experimental_generateMessageId === `function`
        ? (args.experimental_generateMessageId as IDGenerator)
        : undefined;

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
      generateMessageId,
      saveQueueManager,
      writableStream,
    });

    let messageList: MessageList;
    let thread: StorageThreadType | null | undefined;
    let threadExists: boolean;

    const toolCallsCollection = new Map();
    return {
      llm,
      before: async () => {
        const beforeResult = await before();
        const { messageObjects, convertedTools } = beforeResult;
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

            if (props.finishReason === 'tool-calls') {
              for (const toolCall of props.toolCalls) {
                toolCallsCollection.set(toolCall.toolCallId, toolCall);
              }
            }

            return onStepFinish?.({ ...props, runId });
          },
          ...(beforeResult.tripwire && {
            tripwire: beforeResult.tripwire,
            tripwireReason: beforeResult.tripwireReason,
          }),
          ...args,
        } as any;

        return result;
      },
      after: async ({
        result,
        outputText,
        structuredOutput = false,
      }:
        | { result: GenerateReturn<any, Output, ExperimentalOutput>; outputText: string; structuredOutput?: boolean }
        | {
            result: StreamReturn<any, Output, ExperimentalOutput>;
            outputText: string;
            structuredOutput?: boolean;
          }) => {
        await after({
          result,
          outputText,
          threadId: thread?.id,
          thread,
          memoryConfig,
          runId,
          messageList,
          toolCallsCollection,
          structuredOutput,
          threadExists,
        });
      },
    };
  }

  async generate(
    messages: string | string[] | CoreMessage[] | AiMessageType[] | UIMessageWithMetadata[],
    args?: AgentGenerateOptions<undefined, undefined> & { output?: never; experimental_output?: never },
  ): Promise<GenerateTextResult<any, undefined>>;
  async generate<OUTPUT extends ZodSchema | JSONSchema7>(
    messages: string | string[] | CoreMessage[] | AiMessageType[] | UIMessageWithMetadata[],
    args?: AgentGenerateOptions<OUTPUT, undefined> & { output?: OUTPUT; experimental_output?: never },
  ): Promise<GenerateObjectResult<OUTPUT>>;
  async generate<EXPERIMENTAL_OUTPUT extends ZodSchema | JSONSchema7>(
    messages: string | string[] | CoreMessage[] | AiMessageType[] | UIMessageWithMetadata[],
    args?: AgentGenerateOptions<undefined, EXPERIMENTAL_OUTPUT> & {
      output?: never;
      experimental_output?: EXPERIMENTAL_OUTPUT;
    },
  ): Promise<GenerateTextResult<any, EXPERIMENTAL_OUTPUT>>;
  async generate<
    OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
    EXPERIMENTAL_OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
  >(
    messages: string | string[] | CoreMessage[] | AiMessageType[] | UIMessageWithMetadata[],
    generateOptions: AgentGenerateOptions<OUTPUT, EXPERIMENTAL_OUTPUT> = {},
  ): Promise<OUTPUT extends undefined ? GenerateTextResult<any, EXPERIMENTAL_OUTPUT> : GenerateObjectResult<OUTPUT>> {
    const defaultGenerateOptions = await this.getDefaultGenerateOptions({
      runtimeContext: generateOptions.runtimeContext,
    });
    const mergedGenerateOptions: AgentGenerateOptions<OUTPUT, EXPERIMENTAL_OUTPUT> = {
      ...defaultGenerateOptions,
      ...generateOptions,
    };

    const { llm, before, after } = await this.prepareLLMOptions(messages, mergedGenerateOptions);
    const beforeResult = await before();

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
      };

      return tripwireResult as unknown as OUTPUT extends undefined
        ? GenerateTextResult<any, EXPERIMENTAL_OUTPUT>
        : GenerateObjectResult<OUTPUT>;
    }

    const { experimental_output, output, ...llmOptions } = beforeResult;

    if (!output || experimental_output) {
      const result = await llm.__text({
        ...llmOptions,
        experimental_output,
      });

      await after({
        result: result as unknown as OUTPUT extends undefined
          ? GenerateTextResult<any, EXPERIMENTAL_OUTPUT>
          : GenerateObjectResult<OUTPUT>,
        outputText: result.text,
      });

      return result as unknown as OUTPUT extends undefined
        ? GenerateTextResult<any, EXPERIMENTAL_OUTPUT>
        : GenerateObjectResult<OUTPUT>;
    }

    const result = await llm.__textObject<NonNullable<OUTPUT>>({
      ...llmOptions,
      structuredOutput: output as NonNullable<OUTPUT>,
    });

    const outputText = JSON.stringify(result.object);

    await after({
      result: result as unknown as OUTPUT extends undefined
        ? GenerateTextResult<any, EXPERIMENTAL_OUTPUT>
        : GenerateObjectResult<OUTPUT>,
      outputText,
      structuredOutput: true,
    });

    return result as unknown as OUTPUT extends undefined
      ? GenerateTextResult<any, EXPERIMENTAL_OUTPUT>
      : GenerateObjectResult<OUTPUT>;
  }
  async stream<
    OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
    EXPERIMENTAL_OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
  >(
    messages: string | string[] | CoreMessage[] | AiMessageType[] | UIMessageWithMetadata[],
    args?: AgentStreamOptions<OUTPUT, EXPERIMENTAL_OUTPUT> & { output?: never; experimental_output?: never },
  ): Promise<StreamTextResult<any, OUTPUT extends ZodSchema ? z.infer<OUTPUT> : unknown>>;
  async stream<
    OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
    EXPERIMENTAL_OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
  >(
    messages: string | string[] | CoreMessage[] | AiMessageType[] | UIMessageWithMetadata[],
    args?: AgentStreamOptions<OUTPUT, EXPERIMENTAL_OUTPUT> & { output?: OUTPUT; experimental_output?: never },
  ): Promise<StreamObjectResult<any, OUTPUT extends ZodSchema ? z.infer<OUTPUT> : unknown, any>>;
  async stream<
    OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
    EXPERIMENTAL_OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
  >(
    messages: string | string[] | CoreMessage[] | AiMessageType[] | UIMessageWithMetadata[],
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
  async stream<
    OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
    EXPERIMENTAL_OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
  >(
    messages: string | string[] | CoreMessage[] | AiMessageType[] | UIMessageWithMetadata[],
    streamOptions: AgentStreamOptions<OUTPUT, EXPERIMENTAL_OUTPUT> = {},
  ): Promise<
    | StreamTextResult<any, OUTPUT extends ZodSchema ? z.infer<OUTPUT> : unknown>
    | StreamObjectResult<any, OUTPUT extends ZodSchema ? z.infer<OUTPUT> : unknown, any>
  > {
    const defaultStreamOptions = await this.getDefaultStreamOptions({ runtimeContext: streamOptions.runtimeContext });

    const mergedStreamOptions: AgentStreamOptions<OUTPUT, EXPERIMENTAL_OUTPUT> = {
      ...defaultStreamOptions,
      ...streamOptions,
    };

    const { llm, before, after } = await this.prepareLLMOptions(messages, mergedStreamOptions);
    const beforeResult = await before();

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
        | StreamObjectResult<any, OUTPUT extends ZodSchema ? z.infer<OUTPUT> : unknown, any>;
    }

    const { onFinish, runId, output, experimental_output, ...llmOptions } = beforeResult;

    if (!output || experimental_output) {
      this.logger.debug(`Starting agent ${this.name} llm stream call`, {
        runId,
      });

      const streamResult = llm.__stream({
        ...llmOptions,
        onFinish: async result => {
          try {
            const outputText = result.text;
            await after({
              result,
              outputText,
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
        experimental_output,
      });

      return streamResult as
        | StreamTextResult<any, OUTPUT extends ZodSchema ? z.infer<OUTPUT> : unknown>
        | StreamObjectResult<any, OUTPUT extends ZodSchema ? z.infer<OUTPUT> : unknown, any>;
    }

    this.logger.debug(`Starting agent ${this.name} llm streamObject call`, {
      runId,
    });

    return llm.__streamObject({
      ...llmOptions,
      onFinish: async result => {
        try {
          const outputText = JSON.stringify(result.object);
          await after({
            result,
            outputText,
            structuredOutput: true,
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
  }

  streamVNext<
    Output extends ZodSchema | undefined = undefined,
    StructuredOutput extends ZodSchema | undefined = undefined,
  >(
    messages: string | string[] | CoreMessage[] | AiMessageType[] | UIMessageWithMetadata[],
    streamOptions?: AgentVNextStreamOptions<Output, StructuredOutput>,
  ): MastraAgentStream<
    Output extends ZodSchema
      ? z.infer<Output>
      : StructuredOutput extends ZodSchema
        ? z.infer<StructuredOutput>
        : unknown
  > {
    type ResolvedOutput = Output extends ZodSchema
      ? z.infer<Output>
      : StructuredOutput extends ZodSchema
        ? z.infer<StructuredOutput>
        : unknown;
    const defaultStreamOptionsPromise = this.getDefaultVNextStreamOptions<Output, StructuredOutput>({
      runtimeContext: streamOptions?.runtimeContext,
    });

    return new MastraAgentStream<
      Output extends ZodSchema
        ? z.infer<Output>
        : StructuredOutput extends ZodSchema
          ? z.infer<StructuredOutput>
          : unknown
    >({
      getOptions: async () => {
        const defaultStreamOptions = await defaultStreamOptionsPromise;

        return {
          runId: defaultStreamOptions.runId!,
        };
      },
      createStream: async (writer: WritableStream<ChunkType>, onResult: (result: ResolvedOutput) => void) => {
        const defaultStreamOptions = await defaultStreamOptionsPromise;
        const mergedStreamOptions: AgentVNextStreamOptions<Output, StructuredOutput> & {
          writableStream: WritableStream<ChunkType>;
        } = {
          ...defaultStreamOptions,
          ...streamOptions,
          writableStream: writer,
        };

        const { llm, before, after } = await this.prepareLLMOptions(messages, mergedStreamOptions);
        const { onFinish, runId, output, experimental_output, ...llmOptions } = await before();

        if (output) {
          const streamResult = llm.__streamObject({
            ...llmOptions,
            onFinish: async result => {
              onResult(result.object as ResolvedOutput);
              try {
                const outputText = JSON.stringify(result.object);
                await after({
                  result,
                  outputText,
                  structuredOutput: true,
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

          return streamResult.fullStream as unknown as ReadableStream<any>;
        } else {
          const streamResult = llm.__stream({
            ...llmOptions,
            onFinish: async result => {
              onResult(result.text as ResolvedOutput);
              try {
                const outputText = result.text;
                await after({
                  result,
                  outputText,
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
            experimental_output,
          });

          return streamResult.fullStream as unknown as ReadableStream<any>;
        }
      },
    });
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

  toStep(): Step<TAgentId, z.ZodObject<{ prompt: z.ZodString }>, z.ZodObject<{ text: z.ZodString }>, any> {
    const x = agentToStep(this);
    return new Step(x);
  }

  /**
   * Resolves the configuration for title generation.
   * @private
   */
  private resolveTitleGenerationConfig(
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
   * @private
   */
  private async resolveTitleInstructions(
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
