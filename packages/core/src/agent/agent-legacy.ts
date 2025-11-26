import { randomUUID } from 'crypto';
import type { WritableStream } from 'stream/web';
import type { CoreMessage, UIMessage, Tool } from '@internal/ai-sdk-v4';
import deepEqual from 'fast-deep-equal';
import type { JSONSchema7 } from 'json-schema';
import type { z, ZodSchema } from 'zod';
import { MastraError, ErrorDomain, ErrorCategory } from '../error';
import type { MastraLLMV1 } from '../llm/model';
import type {
  GenerateObjectResult,
  GenerateTextResult,
  StreamObjectResult,
  StreamTextResult,
  GenerateReturn,
  StreamReturn,
  ToolSet,
  StreamTextWithMessagesArgs,
  StreamObjectWithMessagesArgs,
} from '../llm/model/base.types';
import type { MastraLanguageModel, TripwireProperties } from '../llm/model/shared.types';
import type { Mastra } from '../mastra';
import type { MastraMemory } from '../memory/memory';
import type { MemoryConfig, StorageThreadType } from '../memory/types';
import type { Span, TracingContext, TracingOptions, TracingProperties } from '../observability';
import { SpanType, getOrCreateSpan } from '../observability';
import type { InputProcessor, OutputProcessor } from '../processors/index';
import { RequestContext } from '../request-context';
import type { ChunkType } from '../stream/types';
import type { CoreTool } from '../tools/types';
import type { DynamicArgument } from '../types';
import type { MessageListInput, MastraDBMessage, UIMessageWithMetadata } from './message-list';
import { MessageList } from './message-list';
import { SaveQueueManager } from './save-queue';
import type {
  AgentGenerateOptions,
  AgentStreamOptions,
  AgentInstructions,
  ToolsetsInput,
  ToolsInput,
  AgentMethodType,
} from './types';
import { resolveThreadIdFromArgs } from './utils';

/**
 * Interface for accessing Agent methods needed by the legacy handler.
 * This allows the legacy handler to work with Agent without directly accessing private members.
 */
// Helper to resolve threadId from args (supports both new and old API)

export interface AgentLegacyCapabilities {
  /** Logger instance */
  logger: {
    debug: (message: string, meta?: any) => void;
    error: (message: string, meta?: any) => void;
    warn: (message: string, meta?: any) => void;
  };
  /** Agent name for logging */
  name: string;
  /** Agent ID */
  id: string;
  /** Mastra instance for generating IDs */
  mastra?: Mastra;
  /** Get default generate options for legacy */
  getDefaultGenerateOptionsLegacy(options: {
    requestContext?: RequestContext;
  }): AgentGenerateOptions | Promise<AgentGenerateOptions>;
  /** Get default stream options for legacy */
  getDefaultStreamOptionsLegacy(options: {
    requestContext?: RequestContext;
  }): AgentStreamOptions | Promise<AgentStreamOptions>;
  /** Check if agent has own memory */
  hasOwnMemory(): boolean;
  /** Get instructions */
  getInstructions(options: { requestContext: RequestContext }): Promise<AgentInstructions>;
  /** Get LLM instance */
  getLLM(options: { requestContext: RequestContext }): Promise<MastraLLMV1>;
  /** Get memory instance */
  getMemory(options: { requestContext: RequestContext }): Promise<MastraMemory | undefined>;
  /** Convert tools for LLM */
  convertTools(args: {
    toolsets?: ToolsetsInput;
    clientTools?: ToolsInput;
    threadId?: string;
    resourceId?: string;
    runId?: string;
    requestContext: RequestContext;
    tracingContext?: TracingContext;
    writableStream?: WritableStream<ChunkType>;
    methodType: AgentMethodType;
  }): Promise<Record<string, CoreTool>>;
  /** Get memory messages */
  getMemoryMessages(args: {
    resourceId?: string;
    threadId: string;
    vectorMessageSearch: string;
    memoryConfig?: MemoryConfig;
    requestContext: RequestContext;
  }): Promise<{ messages: MastraDBMessage[] }>;
  /** Run input processors */
  __runInputProcessors(args: {
    requestContext: RequestContext;
    tracingContext: TracingContext;
    messageList: MessageList;
    inputProcessorOverrides?: InputProcessor[];
  }): Promise<{
    messageList: MessageList;
    tripwireTriggered: boolean;
    tripwireReason: string;
  }>;
  /** Get most recent user message */
  getMostRecentUserMessage(
    messages: Array<UIMessage | UIMessageWithMetadata>,
  ): UIMessage | UIMessageWithMetadata | undefined;
  /** Generate title for thread */
  genTitle(
    userMessage: UIMessage | UIMessageWithMetadata,
    requestContext: RequestContext,
    tracingContext: TracingContext,
    titleModel?: DynamicArgument<MastraLanguageModel>,
    titleInstructions?: DynamicArgument<string>,
  ): Promise<string | undefined>;
  /** Resolve title generation config */
  resolveTitleGenerationConfig(
    generateTitleConfig:
      | boolean
      | { model: DynamicArgument<MastraLanguageModel>; instructions?: DynamicArgument<string> }
      | undefined,
  ): {
    shouldGenerate: boolean;
    model?: DynamicArgument<MastraLanguageModel>;
    instructions?: DynamicArgument<string>;
  };
  /** Save step messages */
  saveStepMessages(args: {
    saveQueueManager: SaveQueueManager;
    result: any;
    messageList: MessageList;
    threadId?: string;
    memoryConfig?: MemoryConfig;
    runId: string;
  }): Promise<void>;
  /** Convert instructions to string */
  convertInstructionsToString(instructions: AgentInstructions): string;
  /** Options for tracing policy */
  tracingPolicy?: any;
  /** Agent network append flag */
  _agentNetworkAppend?: boolean;
  /** List resolved output processors */
  listResolvedOutputProcessors(requestContext?: RequestContext): Promise<OutputProcessor[]>;
  /** Run output processors */
  __runOutputProcessors(args: {
    requestContext: RequestContext;
    tracingContext: TracingContext;
    messageList: MessageList;
    outputProcessorOverrides?: OutputProcessor[];
  }): Promise<{
    messageList: MessageList;
    tripwireTriggered: boolean;
    tripwireReason: string;
  }>;
  /** Run scorers */
  runScorers(args: {
    messageList: MessageList;
    runId: string;
    requestContext: RequestContext;
    structuredOutput?: boolean;
    overrideScorers?: Record<string, any>;
    threadId?: string;
    resourceId?: string;
    tracingContext: TracingContext;
  }): Promise<void>;
}

/**
 * Handler class for legacy Agent functionality (v1 models).
 * Encapsulates all legacy-specific streaming and generation logic.
 */
export class AgentLegacyHandler {
  constructor(private capabilities: AgentLegacyCapabilities) {}

  /**
   * Prepares message list and tools before LLM execution and handles memory persistence after.
   * This is the legacy version that only works with v1 models.
   * @internal
   */
  private __primitive({
    instructions,
    messages,
    context,
    thread,
    memoryConfig,
    resourceId,
    runId,
    toolsets,
    clientTools,
    requestContext,
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
    requestContext: RequestContext;
    saveQueueManager: SaveQueueManager;
    writableStream?: WritableStream<ChunkType>;
    methodType: 'generate' | 'stream';
    tracingContext?: TracingContext;
    tracingOptions?: TracingOptions;
  }) {
    return {
      before: async () => {
        if (process.env.NODE_ENV !== 'test') {
          this.capabilities.logger.debug(`[Agents:${this.capabilities.name}] - Starting generation`, { runId });
        }

        const agentSpan = getOrCreateSpan({
          type: SpanType.AGENT_RUN,
          name: `agent run: '${this.capabilities.id}'`,
          input: {
            messages,
          },
          attributes: {
            agentId: this.capabilities.id,
            instructions: this.capabilities.convertInstructionsToString(instructions),
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
          tracingPolicy: this.capabilities.tracingPolicy,
          tracingOptions,
          tracingContext,
          requestContext,
          mastra: this.capabilities.mastra,
        });

        const innerTracingContext: TracingContext = { currentSpan: agentSpan };

        const memory = await this.capabilities.getMemory({ requestContext });

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
        this.capabilities.logger.debug(`[Agent:${this.capabilities.name}] - Enhancing tools: ${toolEnhancements}`, {
          runId,
          toolsets: toolsets ? Object.keys(toolsets) : undefined,
          clientTools: clientTools ? Object.keys(clientTools) : undefined,
          hasMemory: !!memory,
          hasResourceId: !!resourceId,
        });

        const threadId = thread?.id;

        const convertedTools = await this.capabilities.convertTools({
          toolsets,
          clientTools,
          threadId,
          resourceId,
          runId,
          requestContext,
          tracingContext: innerTracingContext,
          writableStream,
          methodType: methodType === 'generate' ? 'generateLegacy' : 'streamLegacy',
        });

        const messageList = new MessageList({
          threadId,
          resourceId,
          generateMessageId: this.capabilities.mastra?.generateId?.bind(this.capabilities.mastra),
          // @ts-ignore Flag for agent network messages
          _agentNetworkAppend: this.capabilities._agentNetworkAppend,
        })
          .addSystem(instructions || (await this.capabilities.getInstructions({ requestContext })))
          .add(context || [], 'context');

        if (!memory || (!threadId && !resourceId)) {
          messageList.add(messages, 'user');
          const { tripwireTriggered, tripwireReason } = await this.capabilities.__runInputProcessors({
            requestContext,
            tracingContext: innerTracingContext,
            messageList,
          });
          return {
            messageObjects: tripwireTriggered ? [] : messageList.get.all.prompt(),
            convertedTools,
            threadExists: false,
            thread: undefined,
            messageList,
            agentSpan,
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
              agentName: this.capabilities.name,
              threadId: threadId || '',
              resourceId: resourceId || '',
            },
            text: `A resourceId and a threadId must be provided when using Memory. Saw threadId "${threadId}" and resourceId "${resourceId}"`,
          });
          (this.capabilities.logger as any).trackException(mastraError);
          this.capabilities.logger.error(mastraError.toString());
          agentSpan?.error({ error: mastraError });
          throw mastraError;
        }
        const store = memory.constructor.name;
        this.capabilities.logger.debug(
          `[Agent:${this.capabilities.name}] - Memory persistence enabled: store=${store}, resourceId=${resourceId}`,
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
          (typeof config?.semanticRecall === 'object' && config?.semanticRecall?.scope !== 'thread') ||
          config?.semanticRecall === true;
        let [memoryResult, memorySystemMessage] = await Promise.all([
          existingThread || hasResourceScopeSemanticRecall
            ? this.capabilities.getMemoryMessages({
                resourceId,
                threadId: threadObject.id,
                vectorMessageSearch: new MessageList().add(messages, `user`).getLatestUserContent() || '',
                memoryConfig,
                requestContext,
              })
            : { messages: [] },
          memory.getSystemMessage({ threadId: threadObject.id, resourceId, memoryConfig }),
        ]);

        const memoryMessages = memoryResult.messages;

        this.capabilities.logger.debug('Fetched messages from memory', {
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
            memoryMessages.filter((m: MastraDBMessage) => m.threadId === threadObject.id), // filter out messages from other threads. those are added to system message above
            'memory',
          )
          // add new user messages to the list AFTER remembered messages to make ordering more reliable
          .add(messages, 'user');

        const { tripwireTriggered, tripwireReason } = await this.capabilities.__runInputProcessors({
          requestContext,
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
          generateMessageId: this.capabilities.mastra?.generateId?.bind(this.capabilities.mastra),
          // @ts-ignore Flag for agent network messages
          _agentNetworkAppend: this.capabilities._agentNetworkAppend,
        })
          .addSystem(instructions || (await this.capabilities.getInstructions({ requestContext })))
          .addSystem(memorySystemMessage)
          .addSystem(systemMessages)
          .add(context || [], 'context')
          .add(processedMemoryMessages, 'memory')
          .add(messageList.get.input.db(), 'user')
          .get.all.prompt();

        return {
          convertedTools,
          thread: threadObject,
          messageList,
          // add old processed messages + new input messages
          messageObjects: processedList,
          agentSpan,
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
        agentSpan,
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
        overrideScorers?: Record<string, any>;
        agentSpan?: Span<SpanType.AGENT_RUN>;
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

        this.capabilities.logger.debug(`[Agent:${this.capabilities.name}] - Post processing LLM response`, {
          runId,
          result: resToLog,
          threadId,
        });

        const messageListResponses = new MessageList({
          threadId,
          resourceId,
          generateMessageId: this.capabilities.mastra?.generateId?.bind(this.capabilities.mastra),
          // @ts-ignore Flag for agent network messages
          _agentNetworkAppend: this.capabilities._agentNetworkAppend,
        })
          .add(result.response.messages, 'response')
          .get.all.core();

        const usedWorkingMemory = messageListResponses?.some(
          m => m.role === 'tool' && m?.content?.some(c => c?.toolName === 'updateWorkingMemory'),
        );
        // working memory updates the thread, so we need to get the latest thread if we used it
        const memory = await this.capabilities.getMemory({ requestContext });
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
              const userMessage = this.capabilities.getMostRecentUserMessage(messageList.get.all.ui());

              const {
                shouldGenerate,
                model: titleModel,
                instructions: titleInstructions,
              } = this.capabilities.resolveTitleGenerationConfig(config?.generateTitle);

              if (shouldGenerate && userMessage) {
                promises.push(
                  this.capabilities
                    .genTitle(userMessage, requestContext, { currentSpan: agentSpan }, titleModel, titleInstructions)
                    .then(title => {
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
              agentSpan?.error({ error: e });
              throw e;
            }
            const mastraError = new MastraError(
              {
                id: 'AGENT_MEMORY_PERSIST_RESPONSE_MESSAGES_FAILED',
                domain: ErrorDomain.AGENT,
                category: ErrorCategory.SYSTEM,
                details: {
                  agentName: this.capabilities.name,
                  runId: runId || '',
                  threadId: threadId || '',
                  result: JSON.stringify(resToLog),
                },
              },
              e,
            );
            (this.capabilities.logger as any).trackException(mastraError);
            this.capabilities.logger.error(mastraError.toString());
            agentSpan?.error({ error: mastraError });
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

        await this.capabilities.runScorers({
          messageList,
          runId,
          requestContext,
          structuredOutput,
          overrideScorers,
          threadId,
          resourceId,
          tracingContext: { currentSpan: agentSpan },
        });

        const scoringData: {
          input: any;
          output: any;
        } = {
          input: {
            inputMessages: messageList.getPersisted.input.ui(),
            rememberedMessages: messageList.getPersisted.remembered.ui(),
            systemMessages: messageList.getSystemMessages(),
            taggedSystemMessages: messageList.getPersisted.taggedSystemMessages,
          },
          output: messageList.getPersisted.response.ui(),
        };

        agentSpan?.end({
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

  /**
   * Prepares options and handlers for LLM text/object generation or streaming.
   * This is the legacy version that only works with v1 models.
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
    } & Record<string, any>,
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
      > & { runId: string } & TripwireProperties & { agentSpan?: Span<SpanType.AGENT_RUN> }
    >;
    after: (args: {
      result: GenerateReturn<any, Output, ExperimentalOutput> | StreamReturn<any, Output, ExperimentalOutput>;
      outputText: string;
      structuredOutput?: boolean;
      agentSpan?: Span<SpanType.AGENT_RUN>;
      overrideScorers?: Record<string, any> | Record<string, { scorer: string; sampling?: any }>;
    }) => Promise<{
      scoringData: {
        input: any;
        output: any;
      };
    }>;
    llm: MastraLLMV1;
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
      requestContext = new RequestContext(),
      tracingContext,
      tracingOptions,
      savePerStep,
      writableStream,
      ...args
    } = options;

    const threadFromArgs = resolveThreadIdFromArgs({ threadId: args.threadId, memory: args.memory });
    const resourceId = (args.memory as any)?.resource || resourceIdFromArgs;
    const memoryConfig = (args.memory as any)?.options || memoryConfigFromArgs;

    if (resourceId && threadFromArgs && !this.capabilities.hasOwnMemory()) {
      this.capabilities.logger.warn(
        `[Agent:${this.capabilities.name}] - No memory is configured but resourceId and threadId were passed in args. This will not work.`,
      );
    }
    const runId = args.runId || this.capabilities.mastra?.generateId() || randomUUID();
    const instructions = args.instructions || (await this.capabilities.getInstructions({ requestContext }));
    const llm = await this.capabilities.getLLM({ requestContext });

    const memory = await this.capabilities.getMemory({ requestContext });
    const saveQueueManager = new SaveQueueManager({
      logger: this.capabilities.logger as any,
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
      requestContext,
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
      llm: llm as MastraLLMV1,
      before: async () => {
        const beforeResult = await before();
        const { messageObjects, convertedTools, agentSpan } = beforeResult;
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
          requestContext,
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

              await this.capabilities.saveStepMessages({
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
          agentSpan,
        } as any;

        return result;
      },
      after: async ({
        result,
        outputText,
        structuredOutput = false,
        agentSpan,
        overrideScorers,
      }: {
        result: GenerateReturn<any, Output, ExperimentalOutput> | StreamReturn<any, Output, ExperimentalOutput>;
        outputText: string;
        structuredOutput?: boolean;
        agentSpan?: Span<SpanType.AGENT_RUN>;
        overrideScorers?: Record<string, any>;
      }) => {
        const afterResult = await after({
          result: result as any,
          outputText,
          threadId: thread?.id,
          thread,
          memoryConfig,
          runId,
          messageList,
          structuredOutput,
          threadExists,
          agentSpan,
          overrideScorers,
        });
        return afterResult;
      },
    };
  }

  /**
   * Legacy implementation of generate method using AI SDK v4 models.
   * Use this method if you need to continue using AI SDK v4 models.
   */
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
        text: 'This method does not support structured output. Please use generate() instead.',
      });
    }

    const defaultGenerateOptionsLegacy = await Promise.resolve(
      this.capabilities.getDefaultGenerateOptionsLegacy({
        requestContext: generateOptions.requestContext,
      }),
    );

    const mergedGenerateOptions: AgentGenerateOptions<OUTPUT, EXPERIMENTAL_OUTPUT> = {
      ...defaultGenerateOptionsLegacy,
      ...generateOptions,
      experimental_generateMessageId:
        defaultGenerateOptionsLegacy.experimental_generateMessageId ||
        this.capabilities.mastra?.generateId?.bind(this.capabilities.mastra),
    };

    const { llm, before, after } = await this.prepareLLMOptions(messages, mergedGenerateOptions as any, 'generate');

    if (llm.getModel().specificationVersion !== 'v1') {
      this.capabilities.logger.error('V2 models are not supported for generateLegacy. Please use generate instead.', {
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

    const llmToUse = llm as MastraLLMV1;
    const beforeResult = await before();
    const traceId = beforeResult.agentSpan?.externalTraceId;

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

    const { experimental_output, output, agentSpan, ...llmOptions } = beforeResult;
    const tracingContext: TracingContext = { currentSpan: agentSpan };

    // Handle structuredOutput option by creating an StructuredOutputProcessor
    let finalOutputProcessors = mergedGenerateOptions.outputProcessors;

    if (!output || experimental_output) {
      const result = await llmToUse.__text<any, EXPERIMENTAL_OUTPUT>({
        ...llmOptions,
        tracingContext,
        experimental_output,
      } as any);

      const outputProcessorResult = await this.capabilities.__runOutputProcessors({
        requestContext: mergedGenerateOptions.requestContext || new RequestContext(),
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
        .db()
        .map(msg => msg.content.parts.map(part => (part.type === 'text' ? part.text : '')).join(''))
        .join('');

      // Update the result text with processed output
      (result as any).text = newText;

      // If there are output processors, check for structured data in message metadata
      if (finalOutputProcessors && finalOutputProcessors.length > 0) {
        // First check if any output processor provided structured data via metadata
        const messages = outputProcessorResult.messageList.get.response.db();
        this.capabilities.logger.debug(
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

        this.capabilities.logger.debug('Messages with structured data:', messagesWithStructuredData.length);

        if (messagesWithStructuredData[0] && messagesWithStructuredData[0].content.metadata?.structuredOutput) {
          // Use structured data from processor metadata for result.object
          (result as any).object = messagesWithStructuredData[0].content.metadata.structuredOutput;
          this.capabilities.logger.debug('Using structured data from processor metadata for result.object');
        } else {
          // Fallback: try to parse text as JSON (original behavior)
          try {
            const processedOutput = JSON.parse(newText);
            (result as any).object = processedOutput;
            this.capabilities.logger.debug('Using fallback JSON parsing for result.object');
          } catch (error) {
            this.capabilities.logger.warn('Failed to parse processed output as JSON, updating text only', { error });
          }
        }
      }

      const overrideScorers = mergedGenerateOptions.scorers;
      const afterResult = await after({
        result: result as any,
        outputText: newText,
        agentSpan,
        ...(overrideScorers ? { overrideScorers } : {}),
      });

      if (generateOptions.returnScorerData) {
        result.scoringData = afterResult.scoringData;
      }

      result.traceId = traceId;

      return result as any;
    }

    const result = await llmToUse.__textObject<NonNullable<OUTPUT>>({
      ...llmOptions,
      tracingContext,
      structuredOutput: output as NonNullable<OUTPUT>,
    });

    const outputText = JSON.stringify(result.object);

    const outputProcessorResult = await this.capabilities.__runOutputProcessors({
      requestContext: mergedGenerateOptions.requestContext || new RequestContext(),
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
      .db()
      .map(msg => msg.content.parts.map(part => (part.type === 'text' ? part.text : '')).join(''))
      .join('');

    // Try to parse the processed text as JSON for structured output
    try {
      const processedOutput = JSON.parse(newText);
      (result as any).object = processedOutput;
    } catch (error) {
      this.capabilities.logger.warn('Failed to parse processed output as JSON, keeping original object', { error });
    }

    const overrideScorers = mergedGenerateOptions.scorers;
    const afterResult = await after({
      result: result as any,
      outputText: newText,
      structuredOutput: true,
      agentSpan,
      ...(overrideScorers ? { overrideScorers } : {}),
    });

    if (generateOptions.returnScorerData) {
      result.scoringData = afterResult.scoringData;
    }

    result.traceId = traceId;

    return result as any;
  }

  /**
   * Legacy implementation of stream method using AI SDK v4 models.
   * Use this method if you need to continue using AI SDK v4 models.
   */
  async streamLegacy<
    OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
    EXPERIMENTAL_OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
  >(
    messages: MessageListInput,
    streamOptions: AgentStreamOptions<OUTPUT, EXPERIMENTAL_OUTPUT> = {},
  ): Promise<
    | StreamTextResult<any, OUTPUT extends ZodSchema ? z.infer<OUTPUT> : unknown>
    | (StreamObjectResult<OUTPUT extends ZodSchema ? OUTPUT : never> & TracingProperties)
  > {
    const defaultStreamOptionsLegacy = await Promise.resolve(
      this.capabilities.getDefaultStreamOptionsLegacy({
        requestContext: streamOptions.requestContext,
      }),
    );

    const mergedStreamOptions: AgentStreamOptions<OUTPUT, EXPERIMENTAL_OUTPUT> = {
      ...defaultStreamOptionsLegacy,
      ...streamOptions,
      experimental_generateMessageId:
        defaultStreamOptionsLegacy.experimental_generateMessageId ||
        this.capabilities.mastra?.generateId?.bind(this.capabilities.mastra),
    };

    const { llm, before, after } = await this.prepareLLMOptions(messages, mergedStreamOptions as any, 'stream');

    if (llm.getModel().specificationVersion !== 'v1') {
      this.capabilities.logger.error('V2 models are not supported for streamLegacy. Please use stream instead.', {
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
    const traceId = beforeResult.agentSpan?.externalTraceId;

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
        | (StreamObjectResult<OUTPUT extends ZodSchema ? OUTPUT : never> & TracingProperties);
    }

    const { onFinish, runId, output, experimental_output, agentSpan, ...llmOptions } = beforeResult;
    const overrideScorers = mergedStreamOptions.scorers;
    const tracingContext: TracingContext = { currentSpan: agentSpan };

    if (!output || experimental_output) {
      this.capabilities.logger.debug(`Starting agent ${this.capabilities.name} llm stream call`, {
        runId,
      });

      const streamResult = llm.__stream({
        ...llmOptions,
        experimental_output,
        tracingContext,
        outputProcessors: await this.capabilities.listResolvedOutputProcessors(mergedStreamOptions.requestContext),
        onFinish: async result => {
          try {
            const outputText = result.text;
            await after({
              result: result as any,
              outputText,
              agentSpan,
              ...(overrideScorers ? { overrideScorers } : {}),
            });
          } catch (e) {
            this.capabilities.logger.error('Error saving memory on finish', {
              error: e,
              runId,
            });
          }
          await onFinish?.({ ...result, runId } as any);
        },
        runId,
      });

      streamResult.traceId = traceId;

      return streamResult as unknown as
        | StreamTextResult<any, OUTPUT extends ZodSchema ? z.infer<OUTPUT> : unknown>
        | (StreamObjectResult<OUTPUT extends ZodSchema ? OUTPUT : never> & TracingProperties);
    }

    this.capabilities.logger.debug(`Starting agent ${this.capabilities.name} llm streamObject call`, {
      runId,
    });

    const streamObjectResult = llm.__streamObject({
      ...llmOptions,
      tracingContext,
      onFinish: async result => {
        try {
          const outputText = JSON.stringify(result.object);
          await after({
            result: result as any,
            outputText,
            structuredOutput: true,
            agentSpan,
            ...(overrideScorers ? { overrideScorers } : {}),
          });
        } catch (e) {
          this.capabilities.logger.error('Error saving memory on finish', {
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

    return streamObjectResult as StreamObjectResult<OUTPUT extends ZodSchema ? OUTPUT : never> & TracingProperties;
  }
}
