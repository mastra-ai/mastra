import { ReadableStream, TransformStream } from 'node:stream/web';
import type {
  LanguageModelV2,
  LanguageModelV2Middleware,
  LanguageModelV2Prompt,
  LanguageModelV2StreamPart,
} from '@ai-sdk/provider';
import { MessageList, TripWire, aiV5ModelMessageToV2PromptMessage } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/di';
import type { MemoryConfig, SemanticRecall as SemanticRecallConfig } from '@mastra/core/memory';
import { MessageHistory, SemanticRecall, WorkingMemory } from '@mastra/core/processors';
import type {
  InputProcessor,
  OutputProcessor,
  ProcessInputArgs,
  ProcessOutputResultArgs,
  ProcessOutputStreamArgs,
} from '@mastra/core/processors';
import type { MemoryStorage } from '@mastra/core/storage';
import { convertFullStreamChunkToMastra } from '@mastra/core/stream';
import type { ChunkType } from '@mastra/core/stream';
import type { MastraEmbeddingModel, MastraVector } from '@mastra/core/vector';
import { wrapLanguageModel } from 'ai';
import { toAISDKFinishReason } from './helpers';

/**
 * Memory context for processors that need thread/resource info
 */
export interface ProcessorMemoryContext {
  /** Thread ID for conversation persistence */
  threadId?: string;
  /** Resource ID (user/session identifier) */
  resourceId?: string;
  /** Memory configuration options */
  config?: MemoryConfig;
}

/**
 * Options for creating processor middleware
 */
export interface ProcessorMiddlewareOptions {
  /** Input processors to run before the LLM call */
  inputProcessors?: InputProcessor[];
  /** Output processors to run on the LLM response */
  outputProcessors?: OutputProcessor[];
  /** Memory context for processors that need thread/resource info */
  memory?: ProcessorMemoryContext;
}

/**
 * Semantic recall configuration with required vector and embedder.
 * Inherits JSDoc from SemanticRecall type in memory/types.ts.
 */
export type WithMastraSemanticRecallOptions = SemanticRecallConfig & {
  /** Vector store for semantic search (required) */
  vector: MastraVector;
  /** Embedder for generating query embeddings (required) */
  embedder: MastraEmbeddingModel<string>;
};

/**
 * Memory configuration for withMastra
 */
export interface WithMastraMemoryOptions {
  /** Storage adapter for message persistence (required) */
  storage: MemoryStorage;
  /** Thread ID for conversation persistence (required) */
  threadId: string;
  /** Resource ID (user/session identifier) */
  resourceId?: string;
  /** Number of recent messages to retrieve, or false to disable */
  lastMessages?: number | false;
  /** Semantic recall configuration (RAG-based memory retrieval) */
  semanticRecall?: WithMastraSemanticRecallOptions;
  /** Working memory configuration (persistent user data) */
  workingMemory?: MemoryConfig['workingMemory'];
  /** Read-only mode - prevents saving new messages */
  readOnly?: boolean;
}

/**
 * Options for withMastra wrapper
 */
export interface WithMastraOptions {
  /** Memory configuration - enables automatic message history persistence */
  memory?: WithMastraMemoryOptions;
  /** Input processors to run before the LLM call */
  inputProcessors?: InputProcessor[];
  /** Output processors to run on the LLM response */
  outputProcessors?: OutputProcessor[];
}

/**
 * Wraps a language model with Mastra capabilities including memory and processors.
 *
 * @example
 * ```typescript
 * // With message history (auto-creates MessageHistory processor)
 * import { openai } from '@ai-sdk/openai';
 * import { withMastra } from '@mastra/ai-sdk';
 * import { LibSQLStore } from '@mastra/libsql';
 *
 * const storage = new LibSQLStore({ url: 'file:memory.db' });
 * await storage.init();
 *
 * const model = withMastra(openai('gpt-4o'), {
 *   memory: {
 *     storage,
 *     threadId: 'thread-123',
 *     resourceId: 'user-456',
 *     lastMessages: 10,
 *   },
 * });
 *
 * const { text } = await generateText({ model, prompt: 'Hello' });
 * ```
 *
 * @example
 * ```typescript
 * // With semantic recall (RAG-based memory)
 * const model = withMastra(openai('gpt-4o'), {
 *   memory: {
 *     storage,
 *     threadId: 'thread-123',
 *     semanticRecall: {
 *       vector: pinecone,
 *       embedder: openai.embedding('text-embedding-3-small'),
 *       topK: 5,
 *       messageRange: 2, // Include 2 messages before/after each match
 *     },
 *   },
 * });
 * ```
 *
 * @example
 * ```typescript
 * // With working memory (persistent user data)
 * const model = withMastra(openai('gpt-4o'), {
 *   memory: {
 *     storage,
 *     threadId: 'thread-123',
 *     workingMemory: {
 *       enabled: true,
 *       template: '# User Profile\n- **Name**:\n- **Preferences**:',
 *     },
 *   },
 * });
 * ```
 *
 * @example
 * ```typescript
 * // With custom processors
 * const model = withMastra(openai('gpt-4o'), {
 *   inputProcessors: [myInputProcessor],
 *   outputProcessors: [myOutputProcessor],
 * });
 * ```
 */
export function withMastra(model: LanguageModelV2, options: WithMastraOptions = {}): LanguageModelV2 {
  const { memory, inputProcessors = [], outputProcessors = [] } = options;

  // Build the list of processors
  const allInputProcessors: InputProcessor[] = [...inputProcessors];
  const allOutputProcessors: OutputProcessor[] = [...outputProcessors];

  // Auto-create memory processors based on config
  if (memory) {
    const { storage, lastMessages, semanticRecall, workingMemory } = memory;

    // Add WorkingMemory processor if enabled (input processor only)
    const isWorkingMemoryEnabled = typeof workingMemory === 'object' && workingMemory.enabled !== false;

    if (isWorkingMemoryEnabled && typeof workingMemory === 'object') {
      // Convert string template to WorkingMemoryTemplate format
      let template: { format: 'markdown' | 'json'; content: string } | undefined;
      if (workingMemory.template) {
        template = {
          format: 'markdown',
          content: workingMemory.template,
        };
      }

      const workingMemoryProcessor = new WorkingMemory({
        storage,
        template,
        scope: workingMemory.scope,
        useVNext: 'version' in workingMemory && workingMemory.version === 'vnext',
      });

      // WorkingMemory is an input-only processor
      allInputProcessors.push(workingMemoryProcessor);
    }

    // Add MessageHistory processor if lastMessages is configured
    if (lastMessages !== false && lastMessages !== undefined) {
      const messageHistory = new MessageHistory({
        storage,
        lastMessages: typeof lastMessages === 'number' ? lastMessages : undefined,
      });

      allInputProcessors.push(messageHistory);
      allOutputProcessors.push(messageHistory);
    }

    // Add SemanticRecall processor if configured
    if (semanticRecall) {
      const { vector, embedder, indexName, ...semanticConfig } = semanticRecall;

      const semanticRecallProcessor = new SemanticRecall({
        storage,
        vector,
        embedder,
        indexName: indexName || 'memory_messages',
        ...semanticConfig,
      });

      allInputProcessors.push(semanticRecallProcessor);
      allOutputProcessors.push(semanticRecallProcessor);
    }
  }

  return wrapLanguageModel({
    model,
    middleware: createProcessorMiddleware({
      inputProcessors: allInputProcessors,
      outputProcessors: allOutputProcessors,
      memory: memory
        ? {
            threadId: memory.threadId,
            resourceId: memory.resourceId,
          }
        : undefined,
    }),
  });
}

/**
 * Internal state stored in providerOptions to pass state between middleware methods.
 * This ensures request isolation when middleware is reused across concurrent requests.
 */
interface ProcessorMiddlewareState {
  tripwire?: boolean;
  reason?: string;
  originalInputCount?: number;
}

interface TextPart {
  type: 'text';
  text: string;
}

/**
 * Creates AI SDK middleware that runs Mastra processors on input/output.
 * For a simpler API, use `withMastra` instead.
 *
 * @example
 * ```typescript
 * import { wrapLanguageModel, generateText } from 'ai';
 * import { openai } from '@ai-sdk/openai';
 * import { createProcessorMiddleware } from '@mastra/ai-sdk';
 *
 * const model = wrapLanguageModel({
 *   model: openai('gpt-4o'),
 *   middleware: createProcessorMiddleware({
 *     inputProcessors: [myProcessor],
 *     outputProcessors: [myProcessor],
 *   }),
 * });
 *
 * const { text } = await generateText({ model, prompt: 'Hello' });
 * ```
 */
export function createProcessorMiddleware(options: ProcessorMiddlewareOptions): LanguageModelV2Middleware {
  const { inputProcessors = [], outputProcessors = [], memory } = options;

  // Create RequestContext with memory info if provided
  const requestContext = new RequestContext();
  if (memory) {
    requestContext.set('MastraMemory', {
      thread: memory.threadId ? { id: memory.threadId } : undefined,
      resourceId: memory.resourceId,
      memoryConfig: memory.config,
    });
  }

  return {
    middlewareVersion: 'v2',

    /**
     * Transform params runs input processors (processInput)
     */
    async transformParams({ params }) {
      // Create a real MessageList with memory context
      const messageList = new MessageList({
        threadId: memory?.threadId,
        resourceId: memory?.resourceId,
      });

      // Add AI SDK prompt messages to the message list
      // MessageList.add() auto-detects AI SDK v5 messages and converts them
      for (const msg of params.prompt) {
        if (msg.role === 'system') {
          messageList.addSystem(msg.content);
        } else {
          // MessageList.add() handles AI SDK ModelMessage format automatically
          messageList.add(msg, 'input');
        }
      }

      const originalInputCount = params.prompt.filter(msg => msg.role !== 'system').length;

      // Run each input processor
      for (const processor of inputProcessors) {
        if (processor.processInput) {
          try {
            // Processors modify messageList in place. Array returns are supported
            // but the messageList reference takes precedence for preserving source info.
            await processor.processInput({
              messages: messageList.get.input.db(),
              systemMessages: messageList.getAllSystemMessages(),
              messageList,
              requestContext,
              abort: (reason?: string): never => {
                throw new TripWire(reason || 'Aborted by processor');
              },
            } as ProcessInputArgs);
          } catch (error) {
            if (error instanceof TripWire) {
              // Store tripwire in providerOptions for wrapGenerate/wrapStream to handle
              return {
                ...params,
                providerOptions: {
                  ...params.providerOptions,
                  mastraProcessors: {
                    tripwire: true,
                    reason: error.message,
                  } satisfies ProcessorMiddlewareState,
                },
              };
            }
            throw error;
          }
        }
      }

      // Convert back to AI SDK prompt format using built-in MessageList methods
      // get.all.aiV5.prompt() returns ModelMessage[], then convert to LanguageModelV2Prompt
      const newPrompt: LanguageModelV2Prompt = messageList.get.all.aiV5.prompt().map(aiV5ModelMessageToV2PromptMessage);

      return {
        ...params,
        prompt: newPrompt,
        providerOptions: {
          ...params.providerOptions,
          mastraProcessors: {
            ...(params.providerOptions?.mastraProcessors as ProcessorMiddlewareState | undefined),
            originalInputCount,
          } satisfies ProcessorMiddlewareState,
        },
      };
    },

    /**
     * Wrap generate for non-streaming output processing
     */
    async wrapGenerate({ doGenerate, params }) {
      // Check for tripwire from transformParams
      const processorState = params.providerOptions?.mastraProcessors as ProcessorMiddlewareState | undefined;
      if (processorState?.tripwire) {
        const reason = processorState.reason || 'Blocked by processor';
        return {
          content: [{ type: 'text' as const, text: reason }],
          finishReason: 'stop' as const,
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
          warnings: [{ type: 'other' as const, message: `Tripwire: ${reason}` }],
        };
      }

      const result = await doGenerate();

      if (!outputProcessors.length) return result;

      // Create a fresh MessageList for output processing
      // The transformed prompt from transformParams contains all input messages
      const messageList = new MessageList({
        threadId: memory?.threadId,
        resourceId: memory?.resourceId,
      });

      // Processors may prepend historical messages to the prompt. Tag those as 'memory'
      // so output processors don't re-persist them.
      const originalInputCount =
        processorState?.originalInputCount ?? params.prompt.filter(m => m.role !== 'system').length;
      const nonSystemTotal = params.prompt.filter(m => m.role !== 'system').length;
      const memoryCount = nonSystemTotal - originalInputCount;

      let nonSystemIndex = 0;
      for (const msg of params.prompt) {
        if (msg.role === 'system') {
          messageList.addSystem(msg.content);
        } else {
          messageList.add(msg, nonSystemIndex < memoryCount ? 'memory' : 'input');
          nonSystemIndex++;
        }
      }

      // Extract text from result and add as response
      const textContent = result.content
        .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
        .map(c => c.text)
        .join('');

      const responseMessage: MastraDBMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: {
          format: 2,
          parts: [{ type: 'text', text: textContent }],
        },
        createdAt: new Date(),
        ...(memory?.threadId && { threadId: memory.threadId }),
        ...(memory?.resourceId && { resourceId: memory.resourceId }),
      };

      messageList.add(responseMessage, 'response');

      // Run output processors (processOutputResult)
      for (const processor of outputProcessors) {
        if (processor.processOutputResult) {
          try {
            await processor.processOutputResult({
              messages: messageList.get.all.db(),
              messageList,
              requestContext,
              abort: (reason?: string): never => {
                throw new TripWire(reason || 'Aborted by processor');
              },
            } as ProcessOutputResultArgs);
          } catch (error) {
            if (error instanceof TripWire) {
              return {
                content: [{ type: 'text' as const, text: error.message }],
                finishReason: 'stop' as const,
                usage: result.usage,
                warnings: [{ type: 'other' as const, message: `Output blocked: ${error.message}` }],
              };
            }
            throw error;
          }
        }
      }

      // Get processed text from response messages only
      const processedText = messageList.get.response
        .db()
        .map(m => extractTextFromMastraMessage(m))
        .join('');

      return {
        ...result,
        content: [{ type: 'text' as const, text: processedText }],
      };
    },

    /**
     * Wrap stream for streaming output processing
     */
    async wrapStream({ doStream, params }) {
      // Check for tripwire from transformParams
      const processorState = params.providerOptions?.mastraProcessors as ProcessorMiddlewareState | undefined;
      if (processorState?.tripwire) {
        const reason = processorState.reason || 'Blocked by processor';
        return {
          stream: createBlockedStream(reason),
        };
      }

      const { stream, ...rest } = await doStream();

      if (!outputProcessors.length) return { stream, ...rest };

      // Transform stream through output processors
      const processorStates = new Map<string, { streamParts: ChunkType[]; customState: Record<string, unknown> }>();
      const runId = crypto.randomUUID();

      const transformedStream = stream.pipeThrough(
        new TransformStream<LanguageModelV2StreamPart, LanguageModelV2StreamPart>({
          async transform(chunk, controller) {
            // Convert to Mastra chunk format
            let mastraChunk: ChunkType | undefined = convertFullStreamChunkToMastra(
              chunk as Parameters<typeof convertFullStreamChunkToMastra>[0],
              { runId },
            );

            if (!mastraChunk) {
              controller.enqueue(chunk);
              return;
            }

            // Run through each output processor's processOutputStream
            for (const processor of outputProcessors) {
              if (processor.processOutputStream && mastraChunk) {
                let state = processorStates.get(processor.id);
                if (!state) {
                  state = { streamParts: [], customState: {} };
                  processorStates.set(processor.id, state);
                }
                state.streamParts.push(mastraChunk);

                try {
                  const result = await processor.processOutputStream({
                    part: mastraChunk,
                    streamParts: state.streamParts,
                    state: state.customState,
                    requestContext,
                    abort: (reason?: string): never => {
                      throw new TripWire(reason || 'Aborted by processor');
                    },
                  } as ProcessOutputStreamArgs);

                  // If result is null/undefined, filter out this chunk
                  if (result === null || result === undefined) {
                    mastraChunk = undefined;
                  } else {
                    mastraChunk = result;
                  }
                } catch (error) {
                  if (error instanceof TripWire) {
                    // Emit error and close stream
                    controller.enqueue({
                      type: 'error',
                      error: new Error(error.message),
                    });
                    controller.terminate();
                    return;
                  }
                  throw error;
                }
              }
            }

            // Convert back to AI SDK format and enqueue if not filtered
            if (mastraChunk) {
              const aiChunk = convertMastraChunkToAISDKStreamPart(mastraChunk);
              if (aiChunk) {
                controller.enqueue(aiChunk);
              }
            }
          },
        }),
      );

      return { stream: transformedStream, ...rest };
    },
  };
}

/**
 * Creates a blocked stream that returns a message and closes
 */
function createBlockedStream(reason: string): ReadableStream<LanguageModelV2StreamPart> {
  return new ReadableStream({
    start(controller) {
      const id = crypto.randomUUID();
      controller.enqueue({
        type: 'text-start',
        id,
      });
      controller.enqueue({
        type: 'text-delta',
        id,
        delta: reason,
      });
      controller.enqueue({
        type: 'text-end',
        id,
      });
      controller.enqueue({
        type: 'finish',
        finishReason: 'stop',
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      });
      controller.close();
    },
  });
}

/**
 * Extract text content from a Mastra message
 */
function extractTextFromMastraMessage(msg: MastraDBMessage): string {
  const content = msg.content;

  if (typeof content === 'string') {
    return content;
  }

  if (content?.parts) {
    return content.parts
      .filter((p): p is TextPart => p.type === 'text' && 'text' in p)
      .map(p => p.text)
      .join('');
  }

  return '';
}

/**
 * Convert Mastra chunk back to AI SDK LanguageModelV2StreamPart (provider-level stream format)
 */
function convertMastraChunkToAISDKStreamPart(chunk: ChunkType): LanguageModelV2StreamPart | null {
  switch (chunk.type) {
    // Text streaming
    case 'text-start':
      return {
        type: 'text-start',
        id: chunk.payload.id || crypto.randomUUID(),
        providerMetadata: chunk.payload.providerMetadata,
      };

    case 'text-delta':
      return {
        type: 'text-delta',
        id: chunk.payload.id || crypto.randomUUID(),
        delta: chunk.payload.text,
        providerMetadata: chunk.payload.providerMetadata,
      };

    case 'text-end':
      return {
        type: 'text-end',
        id: chunk.payload.id || crypto.randomUUID(),
        providerMetadata: chunk.payload.providerMetadata,
      };

    // Reasoning streaming
    case 'reasoning-start':
      return {
        type: 'reasoning-start',
        id: chunk.payload.id || crypto.randomUUID(),
        providerMetadata: chunk.payload.providerMetadata,
      };

    case 'reasoning-delta':
      return {
        type: 'reasoning-delta',
        id: chunk.payload.id || crypto.randomUUID(),
        delta: chunk.payload.text,
        providerMetadata: chunk.payload.providerMetadata,
      };

    case 'reasoning-end':
      return {
        type: 'reasoning-end',
        id: chunk.payload.id || crypto.randomUUID(),
        providerMetadata: chunk.payload.providerMetadata,
      };

    // Tool call (complete)
    case 'tool-call':
      return {
        type: 'tool-call',
        toolCallId: chunk.payload.toolCallId,
        toolName: chunk.payload.toolName,
        input: JSON.stringify(chunk.payload.args),
        providerExecuted: chunk.payload.providerExecuted,
        providerMetadata: chunk.payload.providerMetadata,
      };

    // Tool call input streaming
    case 'tool-call-input-streaming-start':
      return {
        type: 'tool-input-start',
        id: chunk.payload.toolCallId,
        toolName: chunk.payload.toolName,
        providerExecuted: chunk.payload.providerExecuted,
        providerMetadata: chunk.payload.providerMetadata,
      };

    case 'tool-call-delta':
      return {
        type: 'tool-input-delta',
        id: chunk.payload.toolCallId,
        delta: chunk.payload.argsTextDelta,
        providerMetadata: chunk.payload.providerMetadata,
      };

    case 'tool-call-input-streaming-end':
      return {
        type: 'tool-input-end',
        id: chunk.payload.toolCallId,
        providerMetadata: chunk.payload.providerMetadata,
      };

    // Tool result
    case 'tool-result':
      return {
        type: 'tool-result',
        toolCallId: chunk.payload.toolCallId,
        toolName: chunk.payload.toolName,
        result: { type: 'json', value: chunk.payload.result },
        isError: chunk.payload.isError,
        providerExecuted: chunk.payload.providerExecuted,
        providerMetadata: chunk.payload.providerMetadata,
      } as LanguageModelV2StreamPart;

    // Source (citations)
    case 'source':
      if (chunk.payload.sourceType === 'url') {
        return {
          type: 'source',
          sourceType: 'url',
          id: chunk.payload.id,
          url: chunk.payload.url!,
          title: chunk.payload.title,
          providerMetadata: chunk.payload.providerMetadata,
        } as LanguageModelV2StreamPart;
      } else {
        return {
          type: 'source',
          sourceType: 'document',
          id: chunk.payload.id,
          mediaType: chunk.payload.mimeType!,
          title: chunk.payload.title,
          filename: chunk.payload.filename,
          providerMetadata: chunk.payload.providerMetadata,
        } as LanguageModelV2StreamPart;
      }

    // File output
    case 'file':
      return {
        type: 'file',
        data: chunk.payload.data || chunk.payload.base64,
        mediaType: chunk.payload.mimeType,
      } as LanguageModelV2StreamPart;

    // Response metadata
    case 'response-metadata':
      return {
        type: 'response-metadata',
        ...chunk.payload,
      } as LanguageModelV2StreamPart;

    // Raw provider data
    case 'raw':
      return {
        type: 'raw',
        rawValue: chunk.payload,
      } as LanguageModelV2StreamPart;

    // Finish
    case 'finish': {
      const usage = chunk.payload.output?.usage;
      return {
        type: 'finish',
        finishReason: toAISDKFinishReason(chunk.payload.stepResult?.reason || 'stop'),
        usage: usage
          ? {
              inputTokens: usage.inputTokens || 0,
              outputTokens: usage.outputTokens || 0,
              totalTokens: usage.totalTokens || 0,
            }
          : { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        providerMetadata: chunk.payload.metadata?.providerMetadata,
      };
    }

    // Error
    case 'error':
      return {
        type: 'error',
        error: chunk.payload.error || chunk.payload,
      };

    default:
      // Pass through unknown chunk types
      return null;
  }
}
