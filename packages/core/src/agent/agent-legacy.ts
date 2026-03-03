import { randomUUID } from 'node:crypto';
import type { WritableStream } from 'node:stream/web';
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
import type { MastraModelConfig, TripwireProperties } from '../llm/model/shared.types';
import type { Mastra } from '../mastra';
import type { MastraMemory } from '../memory/memory';
import type { MemoryConfig, StorageThreadType } from '../memory/types';
import type { ObservabilityContext, Span, TracingOptions, TracingProperties } from '../observability';
import {
  EntityType,
  SpanType,
  getOrCreateSpan,
  createObservabilityContext,
  resolveObservabilityContext,
} from '../observability';
import type { InputProcessorOrWorkflow, OutputProcessorOrWorkflow } from '../processors/index';
import { RequestContext, MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY } from '../request-context';
import type { ChunkType } from '../stream/types';
import type { CoreTool } from '../tools/types';
import type { DynamicArgument } from '../types';
import { MessageList } from './message-list';
import type { MastraDBMessage, MessageListInput, UIMessageWithMetadata } from './message-list/index';

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
  /** Get memory messages (deprecated - use input processors) */
  getMemoryMessages(args: {
    resourceId?: string;
    threadId: string;
    vectorMessageSearch: string;
    memoryConfig?: MemoryConfig;
    requestContext: RequestContext;
  }): Promise<{ messages: MastraDBMessage[] }>;
  /** Convert tools for LLM */
  convertTools(
    args: {
      toolsets?: ToolsetsInput;
      clientTools?: ToolsInput;
      threadId?: string;
      resourceId?: string;
      runId?: string;
      requestContext: RequestContext;
      writableStream?: WritableStream<ChunkType>;
      methodType: AgentMethodType;
      memoryConfig?: MemoryConfig;
    } & ObservabilityContext,
  ): Promise<Record<string, CoreTool>>;

  /** Run input processors */
  __runInputProcessors(
    args: {
      requestContext: RequestContext;
      messageList: MessageList;
      inputProcessorOverrides?: InputProcessorOrWorkflow[];
    } & ObservabilityContext,
  ): Promise<{
    messageList: MessageList;
    tripwire?: {
      reason: string;
      retry?: boolean;
      metadata?: unknown;
      processorId?: string;
    };
  }>;
  /** Run processInputStep phase on input processors (for legacy path compatibility) */
  __runProcessInputStep(
    args: Partial<ObservabilityContext> & {
      requestContext: RequestContext;
      messageList: MessageList;
      stepNumber?: number;
    },
  ): Promise<{
    messageList: MessageList;
    tripwire?: {
      reason: string;
      retry?: boolean;
      metadata?: unknown;
      processorId?: string;
    };
  }>;
  /** Get most recent user message */
  getMostRecentUserMessage(
    messages: Array<UIMessage | UIMessageWithMetadata>,
  ): UIMessage | UIMessageWithMetadata | undefined;
  /** Generate title for thread */
  genTitle(
    userMessage: UIMessage | UIMessageWithMetadata,
    requestContext: RequestContext,
    observabilityContext: ObservabilityContext,
    titleModel?: DynamicArgument<MastraModelConfig>,
    titleInstructions?: DynamicArgument<string>,
  ): Promise<string | undefined>;
  /** Resolve title generation config */
  resolveTitleGenerationConfig(
    generateTitleConfig:
      | boolean
      | { model: DynamicArgument<MastraModelConfig>; instructions?: DynamicArgument<string> }
      | undefined,
  ): {
    shouldGenerate: boolean;
    model?: DynamicArgument<MastraModelConfig>;
    instructions?: DynamicArgument<string>;
  };
  /** Save step messages */
  saveStepMessages(args: { result: any; messageList: MessageList; runId: string }): Promise<void>;
  /** Convert instructions to string */
  convertInstructionsToString(instructions: AgentInstructions): string;
  /** Options for tracing policy */
  tracingPolicy?: any;
  /** Agent network append flag */
  _agentNetworkAppend?: boolean;
  /** List resolved output processors */
  listResolvedOutputProcessors(requestContext?: RequestContext): Promise<OutputProcessorOrWorkflow[]>;
  /** Run output processors */
  __runOutputProcessors(
    args: {
      requestContext: RequestContext;
      messageList: MessageList;
      outputProcessorOverrides?: OutputProcessorOrWorkflow[];
    } & ObservabilityContext,
  ): Promise<{
    messageList: MessageList;
    tripwire?: {
      reason: string;
      retry?: boolean;
      metadata?: unknown;
      processorId?: string;
    };
  }>;
  /** Run scorers */
  runScorers(
    args: {
      messageList: MessageList;
      runId: string;
      requestContext: RequestContext;
      structuredOutput?: boolean;
      overrideScorers?: Record<string, any>;
      threadId?: string;
      resourceId?: string;
    } & ObservabilityContext,
  ): Promise<void>;
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
    writableStream,
    methodType,
    tracingOptions,
    ...rest
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
    writableStream?: WritableStream<ChunkType>;
    methodType: 'generate' | 'stream';
    tracingOptions?: TracingOptions;
  } & Partial<ObservabilityContext>) {
    const observabilityContext = resolveObservabilityContext(rest);
    return {
      before: async () => {
        if (process.env.NODE_ENV !== 'test') {
          this.capabilities.logger.debug(`[Agents:${this.capabilities.name}] - Starting generation`, { runId });
        }

        const agentSpan = getOrCreateSpan({
          type: SpanType.AGENT_RUN,
          name: `agent run: '${this.capabilities.id}'`,
          entityType: EntityType.AGENT,
          entityId: this.capabilities.id,
          entityName: this.capabilities.name,
          input: {
            messages,
          },
          attributes: {
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
          tracingContext: observabilityContext.tracingContext,
          requestContext,
          mastra: this.capabilities.mastra,
        });

        const innerObservabilityContext = createObservabilityContext({ currentSpan: agentSpan });

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
          ...innerObservabilityContext,
          writableStream,
          methodType: methodType === 'generate' ? 'generateLegacy' : 'streamLegacy',
          memoryConfig,
        });

        let messageList = new MessageList({
          threadId,
          resourceId,
          generateMessageId: this.capabilities.mastra?.generateId?.bind(this.capabilities.mastra),
          // @ts-expect-error Flag for agent network messages
          _agentNetworkAppend: this.capabilities._agentNetworkAppend,
        })
          .addSystem(instructions || (await this.capabilities.getInstructions({ requestContext })))
          .add(context || [], 'context');

        if (!memory || (!threadId && !resourceId)) {
          messageList.add(messages, 'user');
          const { tripwire } = await this.capabilities.__runInputProcessors({
            requestContext,
            ...innerObservabilityContext,
            messageList,
          });
          // Run processInputStep for step 0 (legacy path compatibility)
          if (!tripwire) {
            const inputStepResult = await this.capabilities.__runProcessInputStep({
              requestContext,
              ...innerObservabilityContext,
              messageList,
              stepNumber: 0,
            });
            if (inputStepResult.tripwire) {
              return {
                messageObjects: [],
                convertedTools,
                threadExists: false,
                thread: undefined,
                messageList,
                agentSpan,
                tripwire: inputStepResult.tripwire,
              };
            }
          }
          return {
            messageObjects: tripwire ? [] : messageList.get.all.prompt(),
            convertedTools,
            threadExists: false,
            thread: undefined,
            messageList,
            agentSpan,
            tripwire,
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
          // saveThread: true ensures the thread is persisted to the database immediately.
          // This is required because output processors (like MessageHistory) may call
          // saveMessages() before after(), and some storage backends (like PostgresStore)
          // validate that the thread exists before saving messages.
          threadObject = await memory.createThread({
            threadId,
            metadata: thread.metadata,
            title: thread.title,
            memoryConfig,
            resourceId,
            saveThread: true,
          });
        }

        // Set memory context in RequestContext for processors to access
        requestContext.set('MastraMemory', {
          thread: threadObject,
          resourceId,
          memoryConfig,
        });

        // Add new user messages to the list
        // Historical messages, semantic recall, and working memory will be added by input processors
        messageList.add(messages, 'user');

        const { messageList: processedMessageList, tripwire } = await this.capabilities.__runInputProcessors({
          requestContext,
          ...innerObservabilityContext,
          messageList,
        });
        messageList = processedMessageList;

        // Run processInputStep phase for step 0 (legacy path compatibility).
        // The v5 agentic loop runs this per-step in llm-execution-step, but the legacy
        // path doesn't have that loop. This is needed for processors like Observational Memory
        // that implement processInputStep (not processInput) to inject context.
        if (!tripwire) {
          const inputStepResult = await this.capabilities.__runProcessInputStep({
            requestContext,
            ...innerObservabilityContext,
            messageList,
            stepNumber: 0,
          });
          if (inputStepResult.tripwire) {
            return {
              convertedTools,
              thread: threadObject,
              messageList,
              messageObjects: [],
              agentSpan,
              tripwire: inputStepResult.tripwire,
              threadExists: !!existingThread,
            };
          }
        }

        // Messages are already processed by __runInputProcessors and __runProcessInputStep above
        // which includes memory processors (WorkingMemory, MessageHistory, OM, etc.)
        const processedList = messageList.get.all.prompt();

        return {
          convertedTools,
          thread: threadObject,
          messageList,
          // add old processed messages + new input messages
          messageObjects: processedList,
          agentSpan,
          tripwire,
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
          // @ts-expect-error Flag for agent network messages
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

            // Message saving is now handled by MessageHistory output processor
            // Only parallelize title generation if needed
            const promises: Promise<any>[] = [];

            // Add title generation to promises if needed
            const config = memory.getMergedThreadConfig(memoryConfig);
            const userMessage = this.capabilities.getMostRecentUserMessage(messageList.get.all.ui());

            const {
              shouldGenerate,
              model: titleModel,
              instructions: titleInstructions,
            } = this.capabilities.resolveTitleGenerationConfig(config?.generateTitle);

            if (shouldGenerate && !thread.title && userMessage) {
              const observabilityContext = createObservabilityContext({ currentSpan: agentSpan });
              promises.push(
                this.capabilities
                  .genTitle(userMessage, requestContext, observabilityContext, titleModel, titleInstructions)
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

            if (promises.length > 0) {
              await Promise.all(promises);
            }
          } catch (e) {
            // Message saving is handled by MessageHistory output processor
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
          ...createObservabilityContext({ currentSpan: agentSpan }),
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
      > & { runId: string } & TripwireProperties & { agentSpan?: Span<SpanType.AGENT_RUN> } & {
          messageList: MessageList;
        }
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
      tracingOptions,
      savePerStep,
      writableStream,
      ...args
    } = options;

    // Reserved keys from requestContext take precedence for security.
    // This allows middleware to securely set resourceId/threadId based on authenticated user,
    // preventing attackers from hijacking another user's memory by passing different values in the body.
    const resourceIdFromContext = requestContext.get(MASTRA_RESOURCE_ID_KEY) as string | undefined;
    const threadIdFromContext = requestContext.get(MASTRA_THREAD_ID_KEY) as string | undefined;

    const threadFromArgs = threadIdFromContext
      ? { id: threadIdFromContext }
      : resolveThreadIdFromArgs({ threadId: args.threadId, memory: args.memory });
    const resourceId = resourceIdFromContext || (args.memory as any)?.resource || resourceIdFromArgs;
    const memoryConfig = (args.memory as any)?.options || memoryConfigFromArgs;

    if (resourceId && threadFromArgs && !this.capabilities.hasOwnMemory()) {
      this.capabilities.logger.warn(
        `[Agent:${this.capabilities.name}] - No memory is configured but resourceId and threadId were passed in args. This will not work.`,
      );
    }
    const runId =
      args.runId ||
      this.capabilities.mastra?.generateId({
        idType: 'run',
        source: 'agent',
        entityId: this.capabilities.id,
        threadId: threadFromArgs?.id,
        resourceId,
      }) ||
      randomUUID();
    const instructions = args.instructions || (await this.capabilities.getInstructions({ requestContext }));
    const llm = await this.capabilities.getLLM({ requestContext });

    const memory = await this.capabilities.getMemory({ requestContext });

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
      writableStream,
      methodType,
      tracingOptions,
      ...resolveObservabilityContext(args as Partial<ObservabilityContext>),
    });

    let messageList: MessageList;
    let thread: StorageThreadType | null | undefined;
    let threadExists: boolean;
    let threadCreatedByStep = false;

    return {
      llm: llm as MastraLLMV1,
      before: async () => {
        const beforeResult = await before();
        const { messageObjects, convertedTools, agentSpan } = beforeResult;
        threadExists = beforeResult.threadExists || false;
        threadCreatedByStep = false;
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
              if (!threadExists && !threadCreatedByStep && memory && thread) {
                await memory.createThread({
                  threadId,
                  title: thread.title,
                  metadata: thread.metadata,
                  resourceId: thread.resourceId,
                  memoryConfig,
                });
                threadCreatedByStep = true;
              }

              await this.capabilities.saveStepMessages({
                result: props,
                messageList,
                runId,
              });
            }

            return onStepFinish?.({ ...props, runId });
          },
          tripwire: beforeResult.tripwire,
          ...args,
          agentSpan,
        } as any;

        return { ...result, messageList, requestContext };
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
      const specVersion = llm.getModel().specificationVersion;
      this.capabilities.logger.error(
        `Models with specificationVersion "${specVersion}" are not supported for generateLegacy. Please use generate() instead.`,
        {
          modelId: llm.getModel().modelId,
          specificationVersion: specVersion,
        },
      );

      throw new MastraError({
        id: 'AGENT_GENERATE_V2_MODEL_NOT_SUPPORTED',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        details: {
          modelId: llm.getModel().modelId,
          specificationVersion: specVersion,
        },
        text: `Models with specificationVersion "${specVersion}" are not supported for generateLegacy(). Please use generate() instead.`,
      });
    }

    const llmToUse = llm as MastraLLMV1;
    const beforeResult = await before();
    const { messageList, requestContext: contextWithMemory } = beforeResult;
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
        tripwire: beforeResult.tripwire,
        traceId,
      };

      return tripwireResult as unknown as OUTPUT extends undefined
        ? GenerateTextResult<any, EXPERIMENTAL_OUTPUT>
        : GenerateObjectResult<OUTPUT>;
    }

    const { experimental_output, output, agentSpan, ...llmOptions } = beforeResult;
    const observabilityContext = createObservabilityContext({ currentSpan: agentSpan });

    // Handle structuredOutput option by creating an StructuredOutputProcessor
    let finalOutputProcessors = mergedGenerateOptions.outputProcessors;

    if (!output || experimental_output) {
      const result = await llmToUse.__text<any, EXPERIMENTAL_OUTPUT>({
        ...llmOptions,
        ...observabilityContext,
        experimental_output,
      } as any);

      // Add the response to the full message list before running output processors
      messageList.add(
        {
          role: 'assistant',
          content: [{ type: 'text', text: result.text }],
        },
        'response',
      );

      const outputProcessorResult = await this.capabilities.__runOutputProcessors({
        requestContext: contextWithMemory || new RequestContext(),
        ...observabilityContext,
        outputProcessorOverrides: finalOutputProcessors,
        messageList, // Use the full message list with complete conversation history
      });

      // Handle tripwire for output processors
      if (outputProcessorResult.tripwire) {
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
          tripwire: outputProcessorResult.tripwire,
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
      ...observabilityContext,
      structuredOutput: output as NonNullable<OUTPUT>,
    });

    const outputText = JSON.stringify(result.object);

    // Add the response to the full message list before running output processors
    messageList.add(
      {
        role: 'assistant',
        content: [{ type: 'text', text: outputText }],
      },
      'response',
    );

    const outputProcessorResult = await this.capabilities.__runOutputProcessors({
      requestContext: contextWithMemory || new RequestContext(),
      ...observabilityContext,
      messageList, // Use the full message list with complete conversation history
    });

    // Handle tripwire for output processors
    if (outputProcessorResult.tripwire) {
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
        tripwire: outputProcessorResult.tripwire,
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
      const specVersion = llm.getModel().specificationVersion;
      this.capabilities.logger.error(
        `Models with specificationVersion "${specVersion}" are not supported for streamLegacy. Please use stream() instead.`,
        {
          modelId: llm.getModel().modelId,
          specificationVersion: specVersion,
        },
      );

      throw new MastraError({
        id: 'AGENT_STREAM_V2_MODEL_NOT_SUPPORTED',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        details: {
          modelId: llm.getModel().modelId,
          specificationVersion: specVersion,
        },
        text: `Models with specificationVersion "${specVersion}" are not supported for streamLegacy(). Please use stream() instead.`,
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
        tripwire: beforeResult.tripwire,
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

    const { onFinish, runId, output, experimental_output, agentSpan, messageList, requestContext, ...llmOptions } =
      beforeResult;
    const overrideScorers = mergedStreamOptions.scorers;
    const observabilityContext = createObservabilityContext({ currentSpan: agentSpan });

    if (!output || experimental_output) {
      this.capabilities.logger.debug(`Starting agent ${this.capabilities.name} llm stream call`, {
        runId,
      });

      const streamResult = llm.__stream({
        ...llmOptions,
        experimental_output,
        ...observabilityContext,
        requestContext,
        outputProcessors: await this.capabilities.listResolvedOutputProcessors(requestContext),
        onFinish: async result => {
          try {
            messageList.add(result.response.messages, 'response');

            // Run output processors to save messages
            await this.capabilities.__runOutputProcessors({
              requestContext,
              ...observabilityContext,
              messageList,
            });

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
      ...observabilityContext,
      requestContext,
      onFinish: async result => {
        try {
          // Add response messages to messageList
          // For streamObject, create a message from the structured output
          if (result.object) {
            const responseMessages = [
              {
                role: 'assistant' as const,
                content: [
                  {
                    type: 'text' as const,
                    text: JSON.stringify(result.object),
                  },
                ],
              },
            ];
            messageList.add(responseMessages as any, 'response');
          }

          // Run output processors to save messages
          await this.capabilities.__runOutputProcessors({
            requestContext,
            ...observabilityContext,
            messageList,
          });

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
