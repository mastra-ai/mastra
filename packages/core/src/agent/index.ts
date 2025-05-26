import { randomUUID } from 'crypto';
import type {
  AssistantContent,
  CoreAssistantMessage,
  CoreMessage,
  CoreToolMessage,
  CoreUserMessage,
  GenerateObjectResult,
  GenerateTextResult,
  StreamObjectResult,
  StreamTextResult,
  TextPart,
  ToolCallPart,
  UserContent,
} from 'ai';
import type { JSONSchema7 } from 'json-schema';
import type { z, ZodSchema } from 'zod';
import type { MastraPrimitives, MastraUnion } from '../action';
import { MastraBase } from '../base';
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
import { makeCoreTool, createMastraProxy, ensureToolProperties, ensureAllMessagesAreCoreMessages } from '../utils';
import type { CompositeVoice } from '../voice';
import { DefaultVoice } from '../voice';
import type { Workflow } from '../workflows';
import { agentToStep, LegacyStep as Step } from '../workflows/legacy';
import type {
  AgentConfig,
  MastraLanguageModel,
  AgentGenerateOptions,
  AgentStreamOptions,
  AiMessageType,
  ToolsetsInput,
  ToolsInput,
  DynamicArgument,
} from './types';

export * from './types';

function resolveMaybePromise<T, R = void>(value: T | Promise<T>, cb: (value: T) => R) {
  if (value instanceof Promise) {
    return value.then(cb);
  }

  return cb(value);
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
  #defaultGenerateOptions: AgentGenerateOptions;
  #defaultStreamOptions: AgentStreamOptions;
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
      throw new Error(`LanguageModel is required to create an Agent. Please provide the 'model'.`);
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
      throw new Error('Voice is not compatible when instructions are a function. Please use getVoice() instead.');
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
      throw new Error(
        'Instructions are not compatible when instructions are a function. Please use getInstructions() instead.',
      );
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
        this.logger.error(`[Agent:${this.name}] - Function-based instructions returned empty value`);
        throw new Error(
          'Instructions are required to use an Agent. The function-based instructions returned an empty value.',
        );
      }

      return instructions;
    });
  }

  public getDescription(): string {
    return this.#description ?? '';
  }

  get tools() {
    this.logger.warn('The tools property is deprecated. Please use getTools() instead.');

    if (typeof this.#tools === 'function') {
      throw new Error('Tools are not compatible when tools are a function. Please use getTools() instead.');
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
        this.logger.error(`[Agent:${this.name}] - Function-based tools returned empty value`);
        throw new Error(
          'Tools are required when using a function to provide them. The function returned an empty value.',
        );
      }

      return ensureToolProperties(tools) as TTools;
    });
  }

  get llm() {
    this.logger.warn('The llm property is deprecated. Please use getLLM() instead.');

    if (typeof this.model === 'function') {
      throw new Error('LLM is not compatible when model is a function. Please use getLLM() instead.');
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
        this.logger.error(`[Agent:${this.name}] - No model provided`);
        throw new Error('Model is required to use an Agent.');
      }

      return this.model;
    }

    const result = this.model({ runtimeContext });
    return resolveMaybePromise(result, model => {
      if (!model) {
        this.logger.error(`[Agent:${this.name}] - Function-based model returned empty value`);
        throw new Error('Model is required to use an Agent. The function-based model returned an empty value.');
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
    message: CoreUserMessage;
    runtimeContext?: RuntimeContext;
  }) {
    // need to use text, not object output or it will error for models that don't support structured output (eg Deepseek R1)
    const llm = await this.getLLM({ runtimeContext });

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
          content: JSON.stringify(message),
        },
      ],
    });

    // Strip out any r1 think tags if present
    const cleanedText = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    return cleanedText;
  }

  getMostRecentUserMessage(messages: Array<CoreMessage>) {
    const userMessages = messages.filter(message => message.role === 'user');
    return userMessages.at(-1);
  }

  async genTitle(userMessage: CoreUserMessage | undefined) {
    let title = `New Thread ${new Date().toISOString()}`;
    try {
      if (userMessage) {
        title = await this.generateTitleFromUserMessage({
          message: userMessage,
        });
      }
    } catch (e) {
      console.error('Error generating title:', e);
    }
    return title;
  }

  async fetchMemory({
    threadId,
    thread: passedThread,
    memoryConfig,
    resourceId,
    userMessages,
    systemMessage,
    runId,
  }: {
    resourceId: string;
    threadId: string;
    thread?: StorageThreadType;
    memoryConfig?: MemoryConfig;
    userMessages: CoreMessage[];
    systemMessage: CoreMessage;
    time?: Date;
    keyword?: string;
    runId?: string;
  }) {
    const memory = this.getMemory();
    if (memory) {
      const thread = passedThread ?? (await memory.getThreadById({ threadId }));

      if (!thread) {
        return { threadId: threadId || '', messages: userMessages };
      }

      const newMessages = ensureAllMessagesAreCoreMessages(userMessages);

      const now = Date.now();
      const messages = newMessages.map((u, index) => {
        return {
          id: this.getMemory()?.generateId()!,
          createdAt: new Date(now + index),
          threadId: threadId,
          ...u,
          content: u.content as UserContent | AssistantContent,
          role: u.role as 'user' | 'assistant',
          type: 'text' as 'text' | 'tool-call' | 'tool-result',
        };
      });

      const [memoryMessages, memorySystemMessage] =
        threadId && memory
          ? await Promise.all([
              memory
                .rememberMessages({
                  threadId,
                  resourceId,
                  config: memoryConfig,
                  systemMessage,
                  vectorMessageSearch: messages
                    .slice(-1)
                    .map(m => {
                      if (typeof m === `string`) {
                        return m;
                      }
                      return m?.content || ``;
                    })
                    .join(`\n`),
                })
                .then(r => r.messages),
              memory.getSystemMessage({ threadId, memoryConfig }),
            ])
          : [[], null];

      this.logger.debug('Saved messages to memory', {
        threadId,
        runId,
      });

      const processedMessages = memory.processMessages({
        messages: this.sanitizeResponseMessages(memoryMessages),
        newMessages,
        systemMessage: typeof systemMessage?.content === `string` ? systemMessage.content : undefined,
        memorySystemMessage: memorySystemMessage ?? ``,
      });

      return {
        threadId: thread.id,
        messages: [
          memorySystemMessage
            ? {
                role: 'system' as const,
                content: memorySystemMessage,
              }
            : null,
          ...processedMessages,
          ...newMessages,
        ].filter((message): message is NonNullable<typeof message> => Boolean(message)),
      };
    }

    return { threadId: threadId || '', messages: userMessages };
  }

  private getResponseMessages({
    messages,
    threadId,
    resourceId,
    now,
    experimental_generateMessageId,
  }: {
    messages: (CoreMessage | CoreAssistantMessage)[];
    threadId: string;
    resourceId: string;
    now: number;
    experimental_generateMessageId: any;
  }) {
    if (!messages) return [];
    const messagesArray = Array.isArray(messages) ? messages : [messages];

    return this.sanitizeResponseMessages(messagesArray).map((message: CoreMessage | CoreAssistantMessage, index) => {
      const messageId = (`id` in message && message.id) || experimental_generateMessageId?.() || randomUUID();
      let toolCallIds: string[] | undefined;
      let toolCallArgs: Record<string, unknown>[] | undefined;
      let toolNames: string[] | undefined;
      let type: 'text' | 'tool-call' | 'tool-result' = 'text';

      if (message.role === 'tool') {
        toolCallIds = (message as CoreToolMessage).content.map(content => content.toolCallId);
        type = 'tool-result';
      }
      if (message.role === 'assistant') {
        const assistantContent = (message as CoreAssistantMessage).content as Array<TextPart | ToolCallPart>;

        const assistantToolCalls = assistantContent
          .map(content => {
            if (content.type === 'tool-call') {
              return {
                toolCallId: content.toolCallId,
                toolArgs: content.args,
                toolName: content.toolName,
              };
            }
            return undefined;
          })
          ?.filter(Boolean) as Array<{
          toolCallId: string;
          toolArgs: Record<string, unknown>;
          toolName: string;
        }>;

        toolCallIds = assistantToolCalls?.map(toolCall => toolCall.toolCallId);

        toolCallArgs = assistantToolCalls?.map(toolCall => toolCall.toolArgs);
        toolNames = assistantToolCalls?.map(toolCall => toolCall.toolName);
        type = assistantContent?.[0]?.type as 'text' | 'tool-call' | 'tool-result';
      }

      return {
        id: messageId,
        threadId: threadId,
        resourceId: resourceId,
        role: message.role as any,
        content: message.content as any,
        createdAt: new Date(now + index), // use Date.now() + index to make sure every message is atleast one millisecond apart
        toolCallIds: toolCallIds?.length ? toolCallIds : undefined,
        toolCallArgs: toolCallArgs?.length ? toolCallArgs : undefined,
        toolNames: toolNames?.length ? toolNames : undefined,
        type,
      };
    });
  }

  sanitizeResponseMessages(messages: Array<CoreMessage>): Array<CoreMessage> {
    let toolResultIds: Array<string> = [];
    let toolCallIds: Array<string> = [];

    for (const message of messages) {
      if (!Array.isArray(message.content)) continue;

      if (message.role === 'tool') {
        for (const content of message.content) {
          if (content.type === 'tool-result') {
            toolResultIds.push(content.toolCallId);
          }
        }
      } else if (message.role === 'assistant' || message.role === 'user') {
        for (const content of message.content) {
          if (typeof content !== `string`) {
            if (content.type === `tool-call`) {
              toolCallIds.push(content.toolCallId);
            }
          }
        }
      }
    }

    const messagesBySanitizedContent = messages.map(message => {
      if (message.role !== 'assistant' && message.role !== `tool` && message.role !== `user`) return message;

      if (!Array.isArray(message.content)) {
        return message;
      }

      const sanitizedContent = message.content.filter(content => {
        if (content.type === `tool-call`) {
          return toolResultIds.includes(content.toolCallId);
        }
        if (content.type === `text`) {
          return content.text.trim() !== ``;
        }
        if (content.type === `tool-result`) {
          return toolCallIds.includes(content.toolCallId);
        }
        return true;
      });

      return {
        ...message,
        content: sanitizedContent,
      };
    });

    return messagesBySanitizedContent.filter(message => {
      if (typeof message.content === `string`) {
        if (message.role === 'assistant') {
          return true;
        }
        return message.content !== '';
      }

      if (Array.isArray(message.content)) {
        return (
          message.content.length &&
          message.content.every(c => {
            if (c.type === `text`) {
              return c.text && c.text !== '';
            }
            return true;
          })
        );
      }

      return true;
    }) as Array<CoreMessage>;
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
                        this.logger.error(`[Agent:${this.name}] - Failed memory tool execution`, {
                          error: err,
                          runId,
                          threadId,
                          resourceId,
                        });
                        throw err;
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
                this.logger.error(`[Agent:${this.name}] - Failed workflow tool execution`, {
                  error: err,
                  runId,
                  threadId,
                  resourceId,
                });
                throw err;
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

  async preExecute({
    resourceId,
    runId,
    threadId,
    thread,
    memoryConfig,
    messages,
    systemMessage,
  }: {
    runId?: string;
    threadId: string;
    thread?: StorageThreadType;
    memoryConfig?: MemoryConfig;
    messages: CoreMessage[];
    resourceId: string;
    systemMessage: CoreMessage;
  }) {
    let coreMessages: CoreMessage[] = [];
    let threadIdToUse = threadId;

    this.logger.debug(`Saving user messages in memory for agent ${this.name}`, { runId });
    const saveMessageResponse = await this.fetchMemory({
      threadId,
      thread,
      resourceId,
      userMessages: messages,
      memoryConfig,
      systemMessage,
    });

    coreMessages = saveMessageResponse.messages;
    threadIdToUse = saveMessageResponse.threadId;
    return { coreMessages, threadIdToUse };
  }

  __primitive({
    instructions,
    messages,
    context,
    threadId,
    memoryConfig,
    resourceId,
    runId,
    toolsets,
    clientTools,
    runtimeContext,
  }: {
    instructions?: string;
    toolsets?: ToolsetsInput;
    clientTools?: ToolsInput;
    resourceId?: string;
    threadId?: string;
    memoryConfig?: MemoryConfig;
    context?: CoreMessage[];
    runId?: string;
    messages: CoreMessage[];
    runtimeContext: RuntimeContext;
  }) {
    return {
      before: async () => {
        if (process.env.NODE_ENV !== 'test') {
          this.logger.debug(`[Agents:${this.name}] - Starting generation`, { runId });
        }

        const systemMessage: CoreMessage = {
          role: 'system',
          content: instructions || `${this.instructions}.`,
        };

        let coreMessages = messages;
        let threadIdToUse = threadId;
        let thread: StorageThreadType | null | undefined;

        const memory = this.getMemory();

        if (threadId && memory && !resourceId) {
          throw new Error(
            `A resourceId must be provided when passing a threadId and using Memory. Saw threadId ${threadId} but resourceId is ${resourceId}`,
          );
        }

        if (memory && resourceId) {
          this.logger.debug(
            `[Agent:${this.name}] - Memory persistence enabled: store=${this.getMemory()?.constructor.name}, resourceId=${resourceId}`,
            {
              runId,
              resourceId,
              threadId: threadIdToUse,
              memoryStore: this.getMemory()?.constructor.name,
            },
          );

          thread = threadIdToUse ? await memory.getThreadById({ threadId: threadIdToUse }) : undefined;

          if (!thread) {
            thread = await memory.createThread({
              threadId: threadIdToUse,
              resourceId,
              memoryConfig,
            });
          }
          threadIdToUse = thread.id;

          const preExecuteResult = await this.preExecute({
            resourceId,
            runId,
            threadId: threadIdToUse,
            thread,
            memoryConfig,
            messages,
            systemMessage,
          });

          coreMessages = preExecuteResult.coreMessages;
          threadIdToUse = preExecuteResult.threadIdToUse;
        }

        let convertedTools: Record<string, CoreTool> | undefined;

        const reasons = [];
        if (toolsets && Object.keys(toolsets || {}).length > 0) {
          reasons.push(`toolsets present (${Object.keys(toolsets || {}).length} tools)`);
        }
        if (this.getMemory() && resourceId) {
          reasons.push('memory and resourceId available');
        }
        this.logger.debug(`[Agent:${this.name}] - Enhancing tools: ${reasons.join(', ')}`, {
          runId,
          toolsets: toolsets ? Object.keys(toolsets) : undefined,
          clientTools: clientTools ? Object.keys(clientTools) : undefined,
          hasMemory: !!this.getMemory(),
          hasResourceId: !!resourceId,
        });

        convertedTools = await this.convertTools({
          toolsets,
          clientTools,
          threadId: threadIdToUse,
          resourceId,
          runId,
          runtimeContext,
        });

        const messageObjects = [systemMessage, ...(context || []), ...coreMessages];

        return { messageObjects, convertedTools, threadId: threadIdToUse as string, thread };
      },
      after: async ({
        result,
        thread: threadAfter,
        threadId,
        memoryConfig,
        outputText,
        runId,
        experimental_generateMessageId,
      }: {
        runId: string;
        result: Record<string, any>;
        thread: StorageThreadType | null | undefined;
        threadId: string;
        memoryConfig: MemoryConfig | undefined;
        outputText: string;
        experimental_generateMessageId: any;
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
            const userMessage = this.getMostRecentUserMessage(messages);
            const now = Date.now();
            const threadMessages = this.sanitizeResponseMessages(ensureAllMessagesAreCoreMessages(messages)).map(
              (u, index) => {
                return {
                  id:
                    (`id` in u && u.id) || experimental_generateMessageId
                      ? experimental_generateMessageId()
                      : this.getMemory()?.generateId()!,
                  createdAt: new Date(now + index),
                  threadId: thread.id,
                  resourceId: resourceId,
                  ...u,
                  content: u.content as UserContent | AssistantContent,
                  role: u.role as 'user' | 'assistant',
                  type: 'text' as 'text' | 'tool-call' | 'tool-result',
                };
              },
            );
            const dateResponseMessagesFrom = (threadMessages.at(-1)?.createdAt?.getTime?.() || Date.now()) + 1;

            // renaming the thread doesn't need to block finishing the req
            void (async () => {
              if (!thread.title?.startsWith('New Thread')) {
                return;
              }

              const config = memory.getMergedThreadConfig(memoryConfig);
              const title = config?.threads?.generateTitle ? await this.genTitle(userMessage) : undefined;
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
            let responseMessages = result.response.messages;
            if (!responseMessages && result.object) {
              responseMessages = [
                {
                  role: 'assistant',
                  content: [
                    {
                      type: 'text',
                      text: outputText,
                    },
                  ],
                },
              ];
            }
            await memory.saveMessages({
              messages: [
                ...threadMessages,
                ...this.getResponseMessages({
                  threadId,
                  resourceId,
                  messages: responseMessages,
                  now: dateResponseMessagesFrom,
                  experimental_generateMessageId,
                }),
              ],
              memoryConfig,
            });
          } catch (e) {
            const message = e instanceof Error ? e.message : JSON.stringify(e);
            this.logger.error('Error saving response', {
              error: message,
              runId,
              result: resToLog,
              threadId,
            });
          }
        }

        if (Object.keys(this.evals || {}).length > 0) {
          const input = messages.map(message => message.content).join('\n');
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

  async generate<Z extends ZodSchema | JSONSchema7 | undefined = undefined>(
    messages: string | string[] | CoreMessage[] | AiMessageType[],
    args?: AgentGenerateOptions<Z> & { output?: never; experimental_output?: never },
  ): Promise<GenerateTextResult<any, Z extends ZodSchema ? z.infer<Z> : unknown>>;
  async generate<Z extends ZodSchema | JSONSchema7 | undefined = undefined>(
    messages: string | string[] | CoreMessage[] | AiMessageType[],
    args?: AgentGenerateOptions<Z> & { output?: Z; experimental_output?: never },
  ): Promise<GenerateObjectResult<Z extends ZodSchema ? z.infer<Z> : unknown>>;
  async generate<Z extends ZodSchema | JSONSchema7 | undefined = undefined>(
    messages: string | string[] | CoreMessage[] | AiMessageType[],
    args?: AgentGenerateOptions<Z> & { output?: never; experimental_output?: Z },
  ): Promise<
    GenerateTextResult<any, Z extends ZodSchema ? z.infer<Z> : unknown> & {
      object: Z extends ZodSchema ? z.infer<Z> : unknown;
    }
  >;
  async generate<Z extends ZodSchema | JSONSchema7 | undefined = undefined>(
    messages: string | string[] | CoreMessage[] | AiMessageType[],
    generateOptions: AgentGenerateOptions<Z> = {},
  ): Promise<
    | GenerateTextResult<any, Z extends ZodSchema ? z.infer<Z> : unknown>
    | GenerateObjectResult<Z extends ZodSchema ? z.infer<Z> : unknown>
  > {
    const {
      instructions,
      context,
      threadId: threadIdInFn,
      memoryOptions,
      resourceId,
      maxSteps,
      onStepFinish,
      runId,
      output,
      toolsets,
      clientTools,
      temperature,
      toolChoice = 'auto',
      experimental_output,
      telemetry,
      runtimeContext = new RuntimeContext(),
      ...rest
    }: AgentGenerateOptions<Z> = Object.assign({}, this.#defaultGenerateOptions, generateOptions);

    let messagesToUse: CoreMessage[] = [];

    if (typeof messages === `string`) {
      messagesToUse = [
        {
          role: 'user',
          content: messages,
        },
      ];
    } else if (Array.isArray(messages)) {
      messagesToUse = messages.map(message => {
        if (typeof message === `string`) {
          return {
            role: 'user',
            content: message,
          };
        }
        return message as CoreMessage;
      });
    } else {
      messagesToUse = [messages];
    }

    const runIdToUse = runId || randomUUID();
    const instructionsToUse = instructions || (await this.getInstructions({ runtimeContext }));
    const llm = await this.getLLM({ runtimeContext });

    const { before, after } = this.__primitive({
      instructions: instructionsToUse,
      messages: messagesToUse,
      context,
      threadId: threadIdInFn,
      memoryConfig: memoryOptions,
      resourceId,
      runId: runIdToUse,
      toolsets,
      clientTools,
      runtimeContext,
    });

    const { threadId, thread, messageObjects, convertedTools } = await before();

    if (!output && experimental_output) {
      const result = await llm.__text({
        messages: messageObjects,
        tools: convertedTools,
        onStepFinish: (result: any) => {
          return onStepFinish?.(result);
        },
        maxSteps: maxSteps,
        runId: runIdToUse,
        temperature,
        toolChoice: toolChoice || 'auto',
        experimental_output,
        threadId,
        resourceId,
        memory: this.getMemory(),
        runtimeContext,
        ...rest,
      });

      const outputText = result.text;

      await after({
        result,
        threadId,
        thread,
        memoryConfig: memoryOptions,
        outputText,
        runId: runIdToUse,
        experimental_generateMessageId:
          `experimental_generateMessageId` in rest ? rest.experimental_generateMessageId : undefined,
      });

      const newResult = result as any;

      newResult.object = result.experimental_output;

      return newResult as unknown as GenerateReturn<Z>;
    }

    if (!output) {
      const result = await llm.__text({
        messages: messageObjects,
        tools: convertedTools,
        onStepFinish: (result: any) => {
          return onStepFinish?.(result);
        },
        maxSteps,
        runId: runIdToUse,
        temperature,
        toolChoice,
        telemetry,
        threadId,
        resourceId,
        memory: this.getMemory(),
        runtimeContext,
        ...rest,
      });

      const outputText = result.text;

      await after({
        result,
        thread,
        threadId,
        memoryConfig: memoryOptions,
        outputText,
        runId: runIdToUse,
        experimental_generateMessageId:
          `experimental_generateMessageId` in rest ? rest.experimental_generateMessageId : undefined,
      });

      return result as unknown as GenerateReturn<Z>;
    }

    const result = await llm.__textObject({
      messages: messageObjects,
      tools: convertedTools,
      structuredOutput: output,
      onStepFinish: (result: any) => {
        return onStepFinish?.(result);
      },
      maxSteps,
      runId: runIdToUse,
      temperature,
      toolChoice,
      telemetry,
      memory: this.getMemory(),
      runtimeContext,
      ...rest,
    });

    const outputText = JSON.stringify(result.object);

    await after({
      result,
      thread,
      threadId,
      memoryConfig: memoryOptions,
      outputText,
      runId: runIdToUse,
      experimental_generateMessageId:
        `experimental_generateMessageId` in rest ? rest.experimental_generateMessageId : undefined,
    });

    return result as unknown as GenerateReturn<Z>;
  }

  async stream<Z extends ZodSchema | JSONSchema7 | undefined = undefined>(
    messages: string | string[] | CoreMessage[] | AiMessageType[],
    args?: AgentStreamOptions<Z> & { output?: never; experimental_output?: never },
  ): Promise<StreamTextResult<any, Z extends ZodSchema ? z.infer<Z> : unknown>>;
  async stream<Z extends ZodSchema | JSONSchema7 | undefined = undefined>(
    messages: string | string[] | CoreMessage[] | AiMessageType[],
    args?: AgentStreamOptions<Z> & { output?: Z; experimental_output?: never },
  ): Promise<StreamObjectResult<any, Z extends ZodSchema ? z.infer<Z> : unknown, any>>;
  async stream<Z extends ZodSchema | JSONSchema7 | undefined = undefined>(
    messages: string | string[] | CoreMessage[] | AiMessageType[],
    args?: AgentStreamOptions<Z> & { output?: never; experimental_output?: Z },
  ): Promise<
    StreamTextResult<any, Z extends ZodSchema ? z.infer<Z> : unknown> & {
      partialObjectStream: StreamTextResult<
        any,
        Z extends ZodSchema ? z.infer<Z> : unknown
      >['experimental_partialOutputStream'];
    }
  >;
  async stream<Z extends ZodSchema | JSONSchema7 | undefined = undefined>(
    messages: string | string[] | CoreMessage[] | AiMessageType[],
    streamOptions: AgentStreamOptions<Z> = {},
  ): Promise<
    | StreamTextResult<any, Z extends ZodSchema ? z.infer<Z> : unknown>
    | StreamObjectResult<any, Z extends ZodSchema ? z.infer<Z> : unknown, any>
  > {
    const {
      instructions,
      context,
      threadId: threadIdInFn,
      memoryOptions,
      resourceId,
      maxSteps,
      onFinish,
      onStepFinish,
      runId,
      toolsets,
      clientTools,
      output,
      temperature,
      toolChoice = 'auto',
      experimental_output,
      telemetry,
      runtimeContext = new RuntimeContext(),
      ...rest
    }: AgentStreamOptions<Z> = Object.assign({}, this.#defaultStreamOptions, streamOptions);
    const runIdToUse = runId || randomUUID();
    const instructionsToUse = instructions || (await this.getInstructions({ runtimeContext }));
    const llm = await this.getLLM({ runtimeContext });

    let messagesToUse: CoreMessage[] = [];

    if (typeof messages === `string`) {
      messagesToUse = [
        {
          role: 'user',
          content: messages,
        },
      ];
    } else {
      messagesToUse = messages.map(message => {
        if (typeof message === `string`) {
          return {
            role: 'user',
            content: message,
          };
        }
        return message as CoreMessage;
      });
    }

    const { before, after } = this.__primitive({
      instructions: instructionsToUse,
      messages: messagesToUse,
      context,
      threadId: threadIdInFn,
      memoryConfig: memoryOptions,
      resourceId,
      runId: runIdToUse,
      toolsets,
      clientTools,
      runtimeContext,
    });

    const { threadId, thread, messageObjects, convertedTools } = await before();

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
              memoryConfig: memoryOptions,
              outputText,
              runId: runIdToUse,
              experimental_generateMessageId:
                `experimental_generateMessageId` in rest ? rest.experimental_generateMessageId : undefined,
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
        runId: runIdToUse,
        toolChoice,
        experimental_output,
        memory: this.getMemory(),
        runtimeContext,
        ...rest,
      });

      const newStreamResult = streamResult as any;
      newStreamResult.partialObjectStream = streamResult.experimental_partialOutputStream;
      return newStreamResult as unknown as StreamReturn<Z>;
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
              memoryConfig: memoryOptions,
              outputText,
              runId: runIdToUse,
              experimental_generateMessageId:
                `experimental_generateMessageId` in rest ? rest.experimental_generateMessageId : undefined,
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
        runId: runIdToUse,
        toolChoice,
        telemetry,
        memory: this.getMemory(),
        runtimeContext,
        ...rest,
      }) as unknown as StreamReturn<Z>;
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
            memoryConfig: memoryOptions,
            outputText,
            runId: runIdToUse,
            experimental_generateMessageId:
              `experimental_generateMessageId` in rest ? rest.experimental_generateMessageId : undefined,
          });
        } catch (e) {
          this.logger.error('Error saving memory on finish', {
            error: e,
            runId,
          });
        }
        await onFinish?.(result);
      },
      runId: runIdToUse,
      toolChoice,
      telemetry,
      memory: this.getMemory(),
      runtimeContext,
      ...rest,
    }) as unknown as StreamReturn<Z>;
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
      throw new Error('No voice provider configured');
    }

    this.logger.warn('Warning: agent.speak() is deprecated. Please use agent.voice.speak() instead.');

    try {
      return this.voice.speak(input, options);
    } catch (e) {
      this.logger.error('Error during agent speak', {
        error: e,
      });
      throw e;
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
      throw new Error('No voice provider configured');
    }

    this.logger.warn('Warning: agent.listen() is deprecated. Please use agent.voice.listen() instead');

    try {
      return this.voice.listen(audioStream, options);
    } catch (e) {
      this.logger.error('Error during agent listen', {
        error: e,
      });
      throw e;
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
      throw new Error('No voice provider configured');
    }

    this.logger.warn('Warning: agent.getSpeakers() is deprecated. Please use agent.voice.getSpeakers() instead.');

    try {
      return await this.voice.getSpeakers();
    } catch (e) {
      this.logger.error('Error during agent getSpeakers', {
        error: e,
      });
      throw e;
    }
  }

  toStep(): Step<TAgentId, z.ZodObject<{ prompt: z.ZodString }>, z.ZodObject<{ text: z.ZodString }>, any> {
    const x = agentToStep(this);
    return new Step(x);
  }
}
