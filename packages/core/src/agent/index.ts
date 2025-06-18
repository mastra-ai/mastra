import { randomUUID } from 'crypto';
import type {
  CoreMessage,
  GenerateObjectResult,
  GenerateTextResult,
  StreamObjectResult,
  StreamTextResult,
  TextPart,
  UIMessage,
} from 'ai';
import deepEqual from 'fast-deep-equal';
import type { JSONSchema7 } from 'json-schema';
import type { z, ZodSchema } from 'zod';
import type { MastraPrimitives, MastraUnion } from '../action';
import { MastraBase } from '../base';
import { MastraError, ErrorDomain, ErrorCategory } from '../error';
import type { Metric } from '../eval';
import { AvailableHooks, executeHook } from '../hooks';
import type { GenerateReturn, StreamReturn } from '../llm';
import type { MastraLLMBase } from '../llm/model';
import { MastraLLM } from '../llm/model';
import { RegisteredLogger } from '../logger';
import type { Mastra } from '../mastra';
import type { MastraMemory } from '../memory/memory';
import type { MemoryConfig, StorageThreadType } from '../memory/types';
import { RuntimeContext } from '../runtime-context';
import { InstrumentClass } from '../telemetry';
import type { CoreTool } from '../tools/types';
import { makeCoreTool, createMastraProxy, ensureToolProperties } from '../utils';
import type { CompositeVoice } from '../voice';
import { DefaultVoice } from '../voice';
import type { Workflow } from '../workflows';
import { agentToStep, LegacyStep as Step } from '../workflows/legacy';
import { MessageList } from './message-list';
import type { MessageInput } from './message-list';
import type {
  AgentConfig,
  MastraLanguageModel,
  AgentGenerateOptions,
  AgentStreamOptions,
  AiMessageType,
  ToolsetsInput,
  ToolsInput,
  DynamicArgument,
  AgentMemoryOption,
} from './types';

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
  #memory?: MastraMemory;
  #workflows?: DynamicArgument<Record<string, Workflow>>;
  #defaultGenerateOptions: DynamicArgument<AgentGenerateOptions>;
  #defaultStreamOptions: DynamicArgument<AgentStreamOptions>;
  #tools: DynamicArgument<TTools>;
  /** @deprecated This property is deprecated. Use evals instead. */
  metrics: TMetrics;
  evals: TMetrics;
  #voice: CompositeVoice;

  constructor(config: AgentConfig<TAgentId, TTools, TMetrics>) {
    super({ component: RegisteredLogger.AGENT });

    this.name = config.name;
    this.id = config.name;

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

    this.#tools = config.tools || ({} as TTools);

    this.metrics = {} as TMetrics;
    this.evals = {} as TMetrics;

    if (config.mastra) {
      this.__registerMastra(config.mastra);
      this.__registerPrimitives({
        telemetry: config.mastra.getTelemetry(),
        logger: config.mastra.getLogger(),
      });
    }

    if (config.metrics) {
      this.logger.warn('The metrics property is deprecated. Please use evals instead to add evaluation metrics.');
      this.metrics = config.metrics;
      this.evals = config.metrics;
    }

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
  }

  public hasOwnMemory(): boolean {
    return Boolean(this.#memory);
  }

  public getMemory(): MastraMemory | undefined {
    const memory = this.#memory;

    if (memory && !memory.hasOwnStorage && this.#mastra) {
      const storage = this.#mastra.getStorage();

      if (storage) {
        memory.setStorage(storage);
      }
    }

    return memory;
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
      workflowRecord = await Promise.resolve(this.#workflows({ runtimeContext }));
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

    const result = this.#instructions({ runtimeContext });
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

    const result = this.#defaultGenerateOptions({ runtimeContext });
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

    const result = this.#defaultStreamOptions({ runtimeContext });
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

    const result = this.#tools({ runtimeContext });

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
  public getLLM({ runtimeContext = new RuntimeContext() }: { runtimeContext?: RuntimeContext } = {}):
    | MastraLLMBase
    | Promise<MastraLLMBase> {
    const model = this.getModel({ runtimeContext });

    return resolveMaybePromise(model, model => {
      const llm = new MastraLLM({ model, mastra: this.#mastra });

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

    const result = this.model({ runtimeContext });
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
  }: {
    message: string | MessageInput;
    runtimeContext?: RuntimeContext;
  }) {
    // need to use text, not object output or it will error for models that don't support structured output (eg Deepseek R1)
    const llm = await this.getLLM({ runtimeContext });

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

    const { text } = await llm.__text<{ title: string }>({
      runtimeContext,
      messages: [
        {
          role: 'system',
          content: `\n
    - you will generate a short title based on the first message a user begins a conversation with
    - ensure it is not more than 80 characters long
    - the title should be a summary of the user's message
    - do not use quotes or colons
    - the entire text you return will be used as the title`,
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

  getMostRecentUserMessage(messages: Array<UIMessage>) {
    const userMessages = messages.filter(message => message.role === 'user');
    return userMessages.at(-1);
  }

  async genTitle(userMessage: string | MessageInput | undefined, runtimeContext: RuntimeContext) {
    let title = `New Thread ${new Date().toISOString()}`;
    try {
      if (userMessage) {
        const normMessage = new MessageList().add(userMessage, 'user').get.all.ui().at(-1);
        if (normMessage) {
          title = await this.generateTitleFromUserMessage({
            message: normMessage,
            runtimeContext,
          });
        }
      }
    } catch (e) {
      this.logger.error('Error generating title:', e);
    }
    return title;
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
  }: {
    resourceId: string;
    threadId: string;
    thread?: StorageThreadType;
    memoryConfig?: MemoryConfig;
    userMessages?: CoreMessage[];
    systemMessage?: CoreMessage;
    runId?: string;
    messageList?: MessageList;
  }) {
    const memory = this.getMemory();
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
                .then(r => r.messagesV2),
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
    const memory = this.getMemory();
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

  private async getAssignedTools({
    runtimeContext,
    runId,
    resourceId,
    threadId,
    mastraProxy,
  }: {
    runId?: string;
    resourceId?: string;
    threadId?: string;
    runtimeContext: RuntimeContext;
    mastraProxy?: MastraUnion;
  }) {
    let toolsForRequest: Record<string, CoreTool> = {};

    this.logger.debug(`[Agents:${this.name}] - Assembling assigned tools`, { runId, threadId, resourceId });

    const memory = this.getMemory();

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

    const memory = this.getMemory();
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
    const memory = this.getMemory();
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
  }: {
    toolsets?: ToolsetsInput;
    clientTools?: ToolsInput;
    threadId?: string;
    resourceId?: string;
    runId?: string;
    runtimeContext: RuntimeContext;
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
  }: {
    instructions?: string;
    toolsets?: ToolsetsInput;
    clientTools?: ToolsInput;
    resourceId?: string;
    thread?: (Partial<StorageThreadType> & { id: string }) | undefined;
    memoryConfig?: MemoryConfig;
    context?: CoreMessage[];
    runId?: string;
    messages: string | string[] | CoreMessage[] | AiMessageType[];
    runtimeContext: RuntimeContext;
    generateMessageId: undefined | IDGenerator;
  }) {
    return {
      before: async () => {
        if (process.env.NODE_ENV !== 'test') {
          this.logger.debug(`[Agents:${this.name}] - Starting generation`, { runId });
        }

        const memory = this.getMemory();

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
          hasMemory: !!this.getMemory(),
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
        });

        const messageList = new MessageList({ threadId, resourceId, generateMessageId })
          .addSystem({
            role: 'system',
            content: instructions || `${this.instructions}.`,
          })
          .add(context || [], 'context');

        if (!memory || (!threadId && !resourceId)) {
          messageList.add(messages, 'user');
          return {
            messageObjects: messageList.get.all.prompt(),
            convertedTools,
            messageList,
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
            text: `A resourceId must be provided when passing a threadId and using Memory. Saw threadId ${threadId} but resourceId is ${resourceId}`,
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
          });
        }

        let [memoryMessages, memorySystemMessage, userContextMessage] =
          thread.id && memory
            ? await Promise.all([
                memory
                  .rememberMessages({
                    threadId: threadObject.id,
                    resourceId,
                    config: memoryConfig,
                    // The new user messages aren't in the list yet cause we add memory messages first to try to make sure ordering is correct (memory comes before new user messages)
                    vectorMessageSearch: new MessageList().add(messages, `user`).getLatestUserContent() || '',
                  })
                  .then(r => r.messagesV2),
                memory.getSystemMessage({ threadId: threadObject.id, memoryConfig }),
                memory.getUserContextMessage({ threadId: threadObject.id }),
              ])
            : [[], null, null];

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
          memorySystemMessage += `\nThe following messages were remembered from a different conversation:\n<remembered_from_other_conversation>\n${JSON.stringify(
            // get v1 since they're closer to CoreMessages (which get sent to the LLM) but also include timestamps
            new MessageList().add(resultsFromOtherThreads, 'memory').get.all.v1(),
          )}\n<end_remembered_from_other_conversation>`;
        }

        if (memorySystemMessage) {
          messageList.addSystem(memorySystemMessage, 'memory');
        }

        if (userContextMessage) {
          messageList.add(userContextMessage, 'context');
        }

        messageList
          .add(
            memoryMessages.filter(m => m.threadId === threadObject.id), // filter out messages from other threads. those are added to system message above
            'memory',
          )
          // add new user messages to the list AFTER remembered messages to make ordering more reliable
          .add(messages, 'user');

        const systemMessage =
          messageList
            .getSystemMessages()
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

        const processedList = new MessageList({ threadId: threadObject.id, resourceId })
          .addSystem(instructions || `${this.instructions}.`)
          .addSystem(memorySystemMessage)
          .add(context || [], 'context')
          .add(userContextMessage || [], 'context')
          .add(processedMemoryMessages, 'memory')
          .add(messageList.get.input.v2(), 'user')
          .get.all.prompt();

        return {
          convertedTools,
          thread: threadObject,
          messageList,
          // add old processed messages + new input messages
          messageObjects: processedList,
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
      }: {
        runId: string;
        result: Record<string, any>;
        thread: StorageThreadType | null | undefined;
        threadId?: string;
        memoryConfig: MemoryConfig | undefined;
        outputText: string;
        messageList: MessageList;
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
        const memory = this.getMemory();
        const thread = threadAfter || (threadId ? await memory?.getThreadById({ threadId }) : undefined);

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

            // renaming the thread doesn't need to block finishing the req
            void (async () => {
              if (!thread.title?.startsWith('New Thread')) {
                return;
              }

              const config = memory.getMergedThreadConfig(memoryConfig);
              const userMessage = this.getMostRecentUserMessage(messageList.get.all.ui());
              const title =
                config?.threads?.generateTitle && userMessage
                  ? await this.genTitle(userMessage, runtimeContext)
                  : undefined;
              if (!title) {
                return;
              }

              return memory.createThread({
                threadId: thread.id,
                resourceId,
                memoryConfig,
                title,
                metadata: thread.metadata,
              });
            })();

            await memory.saveMessages({
              messages: messageList.drainUnsavedMessages(),
              memoryConfig,
            });
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
        }

        if (Object.keys(this.evals || {}).length > 0) {
          const userInputMessages = messageList.get.all.ui().filter(m => m.role === 'user');
          const input = userInputMessages
            .map(message => (typeof message.content === 'string' ? message.content : ''))
            .join('\n');
          const runIdToUse = runId || crypto.randomUUID();
          for (const metric of Object.values(this.evals || {})) {
            executeHook(AvailableHooks.ON_GENERATION, {
              input,
              output: outputText,
              runId: runIdToUse,
              metric,
              agentName: this.name,
              instructions: instructions || this.instructions,
            });
          }
        }
      },
    };
  }

  async generate<
    OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
    EXPERIMENTAL_OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
  >(
    messages: string | string[] | CoreMessage[] | AiMessageType[],
    args?: AgentGenerateOptions<OUTPUT, EXPERIMENTAL_OUTPUT> & { output?: never; experimental_output?: never },
  ): Promise<GenerateTextResult<any, OUTPUT extends ZodSchema ? z.infer<OUTPUT> : unknown>>;
  async generate<
    OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
    EXPERIMENTAL_OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
  >(
    messages: string | string[] | CoreMessage[] | AiMessageType[],
    args?: AgentGenerateOptions<OUTPUT, EXPERIMENTAL_OUTPUT> & { output?: OUTPUT; experimental_output?: never },
  ): Promise<GenerateObjectResult<OUTPUT extends ZodSchema ? z.infer<OUTPUT> : unknown>>;
  async generate<
    OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
    EXPERIMENTAL_OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
  >(
    messages: string | string[] | CoreMessage[] | AiMessageType[],
    args?: AgentGenerateOptions<OUTPUT, EXPERIMENTAL_OUTPUT> & {
      output?: never;
      experimental_output?: EXPERIMENTAL_OUTPUT;
    },
  ): Promise<
    GenerateTextResult<any, OUTPUT extends ZodSchema ? z.infer<OUTPUT> : unknown> & {
      object: OUTPUT extends ZodSchema
        ? z.infer<OUTPUT>
        : EXPERIMENTAL_OUTPUT extends ZodSchema
          ? z.infer<EXPERIMENTAL_OUTPUT>
          : unknown;
    }
  >;
  async generate<
    OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
    EXPERIMENTAL_OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
  >(
    messages: string | string[] | CoreMessage[] | AiMessageType[],
    generateOptions: AgentGenerateOptions<OUTPUT, EXPERIMENTAL_OUTPUT> = {},
  ): Promise<
    | GenerateTextResult<any, OUTPUT extends ZodSchema ? z.infer<OUTPUT> : unknown>
    | GenerateObjectResult<OUTPUT extends ZodSchema ? z.infer<OUTPUT> : unknown>
  > {
    const defaultGenerateOptions = await this.getDefaultGenerateOptions({
      runtimeContext: generateOptions.runtimeContext,
    });
    const {
      context,
      memoryOptions: memoryConfigFromArgs,
      resourceId: resourceIdFromArgs,
      maxSteps,
      onStepFinish,
      output,
      toolsets,
      clientTools,
      temperature,
      toolChoice = 'auto',
      experimental_output,
      telemetry,
      runtimeContext = new RuntimeContext(),
      ...args
    }: AgentGenerateOptions<OUTPUT, EXPERIMENTAL_OUTPUT> = Object.assign({}, defaultGenerateOptions, generateOptions);
    const generateMessageId =
      `experimental_generateMessageId` in args && typeof args.experimental_generateMessageId === `function`
        ? (args.experimental_generateMessageId as IDGenerator)
        : undefined;

    const threadFromArgs = resolveThreadIdFromArgs({ ...args, ...generateOptions });
    const resourceId = args.memory?.resource || resourceIdFromArgs;
    const memoryConfig = args.memory?.options || memoryConfigFromArgs;
    const runId = args.runId || randomUUID();
    const instructions = args.instructions || (await this.getInstructions({ runtimeContext }));
    const llm = await this.getLLM({ runtimeContext });

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
    });

    const { thread, messageObjects, convertedTools, messageList } = await before();

    const threadId = thread?.id;

    if (!output && experimental_output) {
      const result = await llm.__text({
        messages: messageObjects,
        tools: convertedTools,
        onStepFinish: (result: any) => {
          return onStepFinish?.(result);
        },
        maxSteps: maxSteps,
        runId,
        temperature,
        toolChoice: toolChoice || 'auto',
        experimental_output,
        threadId,
        resourceId,
        memory: this.getMemory(),
        runtimeContext,
        telemetry,
        ...args,
      });

      const outputText = result.text;

      await after({
        result,
        threadId,
        thread,
        memoryConfig,
        outputText,
        runId,
        messageList,
      });

      const newResult = result as any;

      newResult.object = result.experimental_output;

      return newResult as unknown as GenerateReturn<OUTPUT extends ZodSchema ? z.infer<OUTPUT> : unknown>;
    }

    if (!output) {
      const result = await llm.__text({
        messages: messageObjects,
        tools: convertedTools,
        onStepFinish: (result: any) => {
          return onStepFinish?.(result);
        },
        maxSteps,
        runId,
        temperature,
        toolChoice,
        telemetry,
        threadId,
        resourceId,
        memory: this.getMemory(),
        runtimeContext,
        ...args,
      });

      const outputText = result.text;

      await after({
        result,
        thread,
        threadId,
        memoryConfig,
        outputText,
        runId,
        messageList,
      });

      return result as unknown as GenerateReturn<OUTPUT extends ZodSchema ? z.infer<OUTPUT> : unknown>;
    }

    const result = await llm.__textObject({
      messages: messageObjects,
      tools: convertedTools,
      structuredOutput: output,
      onStepFinish: (result: any) => {
        return onStepFinish?.(result);
      },
      maxSteps,
      runId,
      temperature,
      toolChoice,
      telemetry,
      memory: this.getMemory(),
      runtimeContext,
      ...args,
    });

    const outputText = JSON.stringify(result.object);

    await after({
      result,
      thread,
      threadId,
      memoryConfig,
      outputText,
      runId,
      messageList,
    });

    return result as unknown as GenerateReturn<OUTPUT extends ZodSchema ? z.infer<OUTPUT> : unknown>;
  }

  async stream<
    OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
    EXPERIMENTAL_OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
  >(
    messages: string | string[] | CoreMessage[] | AiMessageType[],
    args?: AgentStreamOptions<OUTPUT, EXPERIMENTAL_OUTPUT> & { output?: never; experimental_output?: never },
  ): Promise<StreamTextResult<any, OUTPUT extends ZodSchema ? z.infer<OUTPUT> : unknown>>;
  async stream<
    OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
    EXPERIMENTAL_OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
  >(
    messages: string | string[] | CoreMessage[] | AiMessageType[],
    args?: AgentStreamOptions<OUTPUT, EXPERIMENTAL_OUTPUT> & { output?: OUTPUT; experimental_output?: never },
  ): Promise<StreamObjectResult<any, OUTPUT extends ZodSchema ? z.infer<OUTPUT> : unknown, any>>;
  async stream<
    OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
    EXPERIMENTAL_OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
  >(
    messages: string | string[] | CoreMessage[] | AiMessageType[],
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
    messages: string | string[] | CoreMessage[] | AiMessageType[],
    streamOptions: AgentStreamOptions<OUTPUT, EXPERIMENTAL_OUTPUT> = {},
  ): Promise<
    | StreamTextResult<any, OUTPUT extends ZodSchema ? z.infer<OUTPUT> : unknown>
    | StreamObjectResult<any, OUTPUT extends ZodSchema ? z.infer<OUTPUT> : unknown, any>
  > {
    const defaultStreamOptions = await this.getDefaultStreamOptions({ runtimeContext: streamOptions.runtimeContext });
    const {
      context,
      memoryOptions: memoryConfigFromArgs,
      resourceId: resourceIdFromArgs,
      maxSteps,
      onFinish,
      onStepFinish,
      toolsets,
      clientTools,
      output,
      temperature,
      toolChoice = 'auto',
      experimental_output,
      telemetry,
      runtimeContext = new RuntimeContext(),
      ...args
    }: AgentStreamOptions<OUTPUT, EXPERIMENTAL_OUTPUT> = Object.assign({}, defaultStreamOptions, streamOptions);
    const generateMessageId =
      `experimental_generateMessageId` in args && typeof args.experimental_generateMessageId === `function`
        ? (args.experimental_generateMessageId as IDGenerator)
        : undefined;

    const threadFromArgs = resolveThreadIdFromArgs({ ...args, ...streamOptions });
    const resourceId = args.memory?.resource || resourceIdFromArgs;
    const memoryConfig = args.memory?.options || memoryConfigFromArgs;

    const runId = args.runId || randomUUID();
    const instructions = args.instructions || (await this.getInstructions({ runtimeContext }));
    const llm = await this.getLLM({ runtimeContext });

    const { before, after } = this.__primitive({
      instructions,
      messages,
      context,
      thread: threadFromArgs,
      memoryConfig,
      resourceId,
      runId,
      toolsets,
      clientTools,
      runtimeContext,
      generateMessageId,
    });

    const { thread, messageObjects, convertedTools, messageList } = await before();

    const threadId = thread?.id;

    if (!output && experimental_output) {
      this.logger.debug(`Starting agent ${this.name} llm stream call`, {
        runId,
      });

      const streamResult = await llm.__stream({
        messages: messageObjects,
        temperature,
        tools: convertedTools,
        onStepFinish: (result: any) => {
          return onStepFinish?.(result);
        },
        onFinish: async (result: any) => {
          try {
            const outputText = result.text;
            await after({
              result,
              thread,
              threadId,
              memoryConfig,
              outputText,
              runId,
              messageList,
            });
          } catch (e) {
            this.logger.error('Error saving memory on finish', {
              error: e,
              runId,
            });
          }
          await onFinish?.(result);
        },
        maxSteps,
        runId,
        toolChoice,
        experimental_output,
        telemetry,
        memory: this.getMemory(),
        runtimeContext,
        threadId: thread?.id,
        resourceId,
        ...args,
      });

      const newStreamResult = streamResult as any;
      newStreamResult.partialObjectStream = streamResult.experimental_partialOutputStream;
      return newStreamResult as unknown as StreamReturn<OUTPUT extends ZodSchema ? z.infer<OUTPUT> : unknown>;
    } else if (!output) {
      this.logger.debug(`Starting agent ${this.name} llm stream call`, {
        runId,
      });
      return llm.__stream({
        messages: messageObjects,
        temperature,
        tools: convertedTools,
        onStepFinish: (result: any) => {
          return onStepFinish?.(result);
        },
        onFinish: async (result: any) => {
          try {
            const outputText = result.text;
            await after({
              result,
              thread,
              threadId,
              memoryConfig,
              outputText,
              runId,
              messageList,
            });
          } catch (e) {
            this.logger.error('Error saving memory on finish', {
              error: e,
              runId,
            });
          }
          await onFinish?.(result);
        },
        maxSteps,
        runId,
        toolChoice,
        telemetry,
        memory: this.getMemory(),
        runtimeContext,
        threadId: thread?.id,
        resourceId,
        ...args,
      }) as unknown as StreamReturn<OUTPUT extends ZodSchema ? z.infer<OUTPUT> : unknown>;
    }

    this.logger.debug(`Starting agent ${this.name} llm streamObject call`, {
      runId,
    });

    return llm.__streamObject({
      messages: messageObjects,
      tools: convertedTools,
      temperature,
      structuredOutput: output,
      onStepFinish: (result: any) => {
        return onStepFinish?.(result);
      },
      onFinish: async (result: any) => {
        try {
          const outputText = JSON.stringify(result.object);
          await after({
            result,
            thread,
            threadId,
            memoryConfig,
            outputText,
            runId,
            messageList,
          });
        } catch (e) {
          this.logger.error('Error saving memory on finish', {
            error: e,
            runId,
          });
        }
        await onFinish?.(result);
      },
      runId,
      toolChoice,
      telemetry,
      memory: this.getMemory(),
      runtimeContext,
      threadId: thread?.id,
      resourceId,
      ...args,
    }) as unknown as StreamReturn<OUTPUT extends ZodSchema ? z.infer<OUTPUT> : unknown>;
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
}
