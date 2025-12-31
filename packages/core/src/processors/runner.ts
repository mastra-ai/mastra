import type { MastraDBMessage } from '../agent/message-list';
import { MessageList } from '../agent/message-list';
import { TripWire } from '../agent/trip-wire';
import { MastraError } from '../error';
import type { IMastraLogger } from '../logger';
import { SpanType } from '../observability';
import type { Span, TracingContext } from '../observability';
import type { RequestContext } from '../request-context';
import type { ChunkType, OutputSchema } from '../stream';
import type { MastraModelOutput } from '../stream/base/output';
import type { Processor } from './index';

/**
 * Implementation of processor state management
 */
export class ProcessorState<OUTPUT extends OutputSchema = undefined> {
  private accumulatedText = '';
  public customState: Record<string, any> = {};
  public streamParts: ChunkType<OUTPUT>[] = [];
  public span?: Span<SpanType.PROCESSOR_RUN>;

  constructor(options: { processorName: string; tracingContext?: TracingContext; processorIndex?: number }) {
    const { processorName, tracingContext, processorIndex } = options;
    const currentSpan = tracingContext?.currentSpan;

    // Find the AGENT_RUN span by walking up the parent chain
    const parentSpan = currentSpan?.findParent(SpanType.AGENT_RUN) || currentSpan?.parent || currentSpan;
    this.span = parentSpan?.createChildSpan({
      type: SpanType.PROCESSOR_RUN,
      name: `output processor: ${processorName}`,
      attributes: {
        processorName: processorName,
        processorType: 'output',
        processorIndex: processorIndex ?? 0,
      },
      input: {
        streamParts: [],
        state: {},
        totalChunks: 0,
      },
    });
  }

  // Internal methods for the runner
  addPart(part: ChunkType<OUTPUT>): void {
    // Extract text from text-delta chunks for accumulated text
    if (part.type === 'text-delta') {
      this.accumulatedText += part.payload.text;
    }
    this.streamParts.push(part);

    if (this.span) {
      this.span.input = {
        streamParts: this.streamParts,
        state: this.customState,
        totalChunks: this.streamParts.length,
        accumulatedText: this.accumulatedText,
      };
    }
  }
}

export class ProcessorRunner {
  public readonly inputProcessors: Processor[];
  public readonly outputProcessors: Processor[];
  private readonly logger: IMastraLogger;
  private readonly agentName: string;
  /**
   * Per-processor state that persists across all method calls within this request.
   * This is used to share state between processInput, processInputStep, processOutputResult, etc.
   * for the same processor within a single generate() call.
   */
  private readonly processorStates: Map<string, Record<string, unknown>> = new Map();

  constructor({
    inputProcessors,
    outputProcessors,
    logger,
    agentName,
  }: {
    inputProcessors?: Processor[];
    outputProcessors?: Processor[];
    logger: IMastraLogger;
    agentName: string;
  }) {
    this.inputProcessors = inputProcessors ?? [];
    this.outputProcessors = outputProcessors ?? [];
    this.logger = logger;
    this.agentName = agentName;
  }

  /**
   * Get or create per-processor state for the given processor ID.
   * This state persists across all method calls (processInput, processInputStep, processOutputResult)
   * for the same processor within this request.
   */
  private getProcessorState(processorId: string): Record<string, unknown> {
    let state = this.processorStates.get(processorId);
    if (!state) {
      state = {};
      this.processorStates.set(processorId, state);
    }
    return state;
  }

  async runOutputProcessors(
    messageList: MessageList,
    tracingContext?: TracingContext,
    requestContext?: RequestContext,
  ): Promise<MessageList> {
    for (const [index, processor] of this.outputProcessors.entries()) {
      const allNewMessages = messageList.get.response.db();
      let processableMessages: MastraDBMessage[] = [...allNewMessages];
      const idsBeforeProcessing = processableMessages.map(m => m.id);
      const check = messageList.makeMessageSourceChecker();

      const ctx: { messages: MastraDBMessage[]; abort: () => never } = {
        messages: processableMessages,
        abort: () => {
          throw new TripWire('Tripwire triggered');
        },
      };

      const abort = (reason?: string): never => {
        throw new TripWire(reason || `Tripwire triggered by ${processor.id}`);
      };

      ctx.abort = abort;

      // Use the processOutputResult method if available
      const processMethod = processor.processOutputResult?.bind(processor);

      if (!processMethod) {
        // Skip processors that don't implement processOutputResult
        continue;
      }

      const currentSpan = tracingContext?.currentSpan;
      const parentSpan = currentSpan?.findParent(SpanType.AGENT_RUN) || currentSpan?.parent || currentSpan;
      const processorSpan = parentSpan?.createChildSpan({
        type: SpanType.PROCESSOR_RUN,
        name: `output processor: ${processor.id}`,
        attributes: {
          processorName: processor.name ?? processor.id,
          processorType: 'output',
          processorIndex: index,
        },
        input: processableMessages,
      });

      // Start recording MessageList mutations for this processor
      messageList.startRecording();

      // Get per-processor state that persists across all method calls within this request
      const processorState = this.getProcessorState(processor.id);

      const result = await processMethod({
        messages: processableMessages,
        messageList,
        state: processorState,
        abort: ctx.abort,
        tracingContext: { currentSpan: processorSpan },
        requestContext,
      });

      // Stop recording and get mutations for this processor
      const mutations = messageList.stopRecording();

      // Handle the new return type - MessageList or MastraDBMessage[]
      if (result instanceof MessageList) {
        if (result !== messageList) {
          throw new MastraError({
            category: 'USER',
            domain: 'AGENT',
            id: 'PROCESSOR_RETURNED_EXTERNAL_MESSAGE_LIST',
            text: `Processor ${processor.id} returned a MessageList instance other than the one that was passed in as an argument. New external message list instances are not supported. Use the messageList argument instead.`,
          });
        }
        if (mutations.length > 0) {
          processableMessages = result.get.response.db();
        }
      } else {
        if (result) {
          const deletedIds = idsBeforeProcessing.filter(i => !result.some(m => m.id === i));
          if (deletedIds.length) {
            messageList.removeByIds(deletedIds);
          }
          processableMessages = result || [];
          for (const message of result) {
            messageList.removeByIds([message.id]);
            messageList.add(message, check.getSource(message) || 'response');
          }
        }
      }

      processorSpan?.end({
        output: processableMessages,
        attributes: mutations.length > 0 ? { messageListMutations: mutations } : undefined,
      });
    }

    return messageList;
  }

  /**
   * Process a stream part through all output processors with state management
   */
  async processPart<OUTPUT extends OutputSchema>(
    part: ChunkType<OUTPUT>,
    processorStates: Map<string, ProcessorState<OUTPUT>>,
    tracingContext?: TracingContext,
    requestContext?: RequestContext,
    messageList?: MessageList,
  ): Promise<{
    part: ChunkType<OUTPUT> | null | undefined;
    blocked: boolean;
    reason?: string;
  }> {
    if (!this.outputProcessors.length) {
      return { part, blocked: false };
    }

    try {
      let processedPart: ChunkType<OUTPUT> | null | undefined = part;
      const isFinishChunk = part.type === 'finish';

      for (const [index, processor] of this.outputProcessors.entries()) {
        try {
          if (processor.processOutputStream && processedPart) {
            // Get or create state for this processor
            let state = processorStates.get(processor.id);
            if (!state) {
              state = new ProcessorState<OUTPUT>({
                processorName: processor.name ?? processor.id,
                tracingContext,
                processorIndex: index,
              });
              processorStates.set(processor.id, state);
            }

            // Add the current part to accumulated text
            state.addPart(processedPart);

            const result = await processor.processOutputStream({
              part: processedPart as ChunkType,
              streamParts: state.streamParts as ChunkType[],
              state: state.customState,
              abort: (reason?: string) => {
                throw new TripWire(reason || `Stream part blocked by ${processor.id}`);
              },
              tracingContext: { currentSpan: state.span },
              requestContext,
              messageList,
            });

            if (state.span && !state.span.isEvent) {
              state.span.output = result;
            }

            // If result is null, or undefined, don't emit
            processedPart = result as ChunkType<OUTPUT> | null | undefined;
          }
        } catch (error) {
          if (error instanceof TripWire) {
            // End span with blocked metadata
            const state = processorStates.get(processor.id);
            state?.span?.end({
              metadata: { blocked: true, reason: error.message },
            });
            return { part: null, blocked: true, reason: error.message };
          }
          // End span with error
          const state = processorStates.get(processor.id);
          state?.span?.error({ error: error as Error, endSpan: true });
          // Log error but continue with original part
          this.logger.error(`[Agent:${this.agentName}] - Output processor ${processor.id} failed:`, error);
        }
      }

      // If this was a finish chunk, end all processor spans AFTER processing
      if (isFinishChunk) {
        for (const state of processorStates.values()) {
          if (state.span) {
            // Preserve the existing output (last processed part) and add metadata
            const finalOutput = {
              ...state.span.output,
              totalChunks: state.streamParts.length,
              finalState: state.customState,
            };
            state.span.end({ output: finalOutput });
          }
        }
      }

      return { part: processedPart, blocked: false };
    } catch (error) {
      this.logger.error(`[Agent:${this.agentName}] - Stream part processing failed:`, error);
      // End all spans on fatal error
      for (const state of processorStates.values()) {
        state.span?.error({ error: error as Error, endSpan: true });
      }
      return { part, blocked: false };
    }
  }

  async runOutputProcessorsForStream<OUTPUT extends OutputSchema = undefined>(
    streamResult: MastraModelOutput<OUTPUT>,
    tracingContext?: TracingContext,
  ): Promise<ReadableStream<any>> {
    return new ReadableStream({
      start: async controller => {
        const reader = streamResult.fullStream.getReader();
        const processorStates = new Map<string, ProcessorState<OUTPUT>>();

        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              controller.close();
              break;
            }

            // Process all stream parts through output processors
            const {
              part: processedPart,
              blocked,
              reason,
            } = await this.processPart(value, processorStates, tracingContext);

            if (blocked) {
              // Log that part was blocked
              void this.logger.debug(`[Agent:${this.agentName}] - Stream part blocked by output processor`, {
                reason,
                originalPart: value,
              });

              // Send tripwire part and close stream for abort
              controller.enqueue({
                type: 'tripwire',
                tripwireReason: reason || 'Output processor blocked content',
              });
              controller.close();
              break;
            } else if (processedPart !== null) {
              // Send processed part only if it's not null (which indicates don't emit)
              controller.enqueue(processedPart);
            }
            // If processedPart is null, don't emit anything for this part
          }
        } catch (error) {
          controller.error(error);
        }
      },
    });
  }

  async runInputProcessors(
    messageList: MessageList,
    tracingContext?: TracingContext,
    requestContext?: RequestContext,
  ): Promise<MessageList> {
    for (const [index, processor] of this.inputProcessors.entries()) {
      let processableMessages: MastraDBMessage[] = messageList.get.input.db();
      const inputIds = processableMessages.map(m => m.id);
      const check = messageList.makeMessageSourceChecker();

      const ctx: { messages: MastraDBMessage[]; abort: () => never } = {
        messages: processableMessages,
        abort: (reason?: string): never => {
          throw new TripWire(reason || `Tripwire triggered by ${processor.id}`);
        },
      };

      // Use the processInput method if available
      const processMethod = processor.processInput?.bind(processor);

      if (!processMethod) {
        // Skip processors that don't implement processInput
        continue;
      }

      const currentSpan = tracingContext?.currentSpan;
      const parentSpan = currentSpan?.findParent(SpanType.AGENT_RUN) || currentSpan?.parent || currentSpan;
      const processorSpan = parentSpan?.createChildSpan({
        type: SpanType.PROCESSOR_RUN,
        name: `input processor: ${processor.id}`,
        attributes: {
          processorName: processor.name ?? processor.id,
          processorType: 'input',
          processorIndex: index,
        },
        input: processableMessages,
      });

      // Start recording MessageList mutations for this processor
      messageList.startRecording();

      // Get all system messages to pass to the processor
      const currentSystemMessages = messageList.getAllSystemMessages();

      // Get per-processor state that persists across all method calls within this request
      const processorState = this.getProcessorState(processor.id);

      const result = await processMethod({
        messages: processableMessages,
        systemMessages: currentSystemMessages,
        state: processorState,
        abort: ctx.abort,
        tracingContext: { currentSpan: processorSpan },
        messageList,
        requestContext,
      });

      // Handle MessageList, MastraDBMessage[], or { messages, systemMessages } return types
      let mutations: Array<{
        type: 'add' | 'addSystem' | 'removeByIds' | 'clear';
        source?: string;
        count?: number;
        ids?: string[];
        text?: string;
        tag?: string;
        message?: any;
      }>;

      if (result instanceof MessageList) {
        if (result !== messageList) {
          throw new MastraError({
            category: 'USER',
            domain: 'AGENT',
            id: 'PROCESSOR_RETURNED_EXTERNAL_MESSAGE_LIST',
            text: `Processor ${processor.id} returned a MessageList instance other than the one that was passed in as an argument. New external message list instances are not supported. Use the messageList argument instead.`,
          });
        }
        // Stop recording and capture mutations
        mutations = messageList.stopRecording();
        if (mutations.length > 0) {
          // Processor returned a MessageList - it has been modified in place
          // Update processableMessages to reflect ALL current messages for next processor
          processableMessages = messageList.get.input.db();
        }
      } else if (this.isProcessInputResultWithSystemMessages(result)) {
        // Processor returned { messages, systemMessages } - handle both
        mutations = messageList.stopRecording();

        // Replace system messages with the modified ones
        messageList.replaceAllSystemMessages(result.systemMessages);

        // Handle regular messages
        const regularMessages = result.messages;
        if (regularMessages) {
          const deletedIds = inputIds.filter(i => !regularMessages.some(m => m.id === i));
          if (deletedIds.length) {
            messageList.removeByIds(deletedIds);
          }

          // Separate any new system messages from other messages (backward compat)
          const newSystemMessages = regularMessages.filter(m => m.role === 'system');
          const nonSystemMessages = regularMessages.filter(m => m.role !== 'system');

          // Add any new system messages from the messages array
          for (const sysMsg of newSystemMessages) {
            const systemText =
              (sysMsg.content.content as string | undefined) ??
              sysMsg.content.parts?.map(p => (p.type === 'text' ? p.text : '')).join('\n') ??
              '';
            messageList.addSystem(systemText);
          }

          // Add non-system messages normally
          if (nonSystemMessages.length > 0) {
            for (const message of nonSystemMessages) {
              messageList.removeByIds([message.id]);
              messageList.add(message, check.getSource(message) || 'input');
            }
          }
        }

        processableMessages = messageList.get.input.db();
      } else {
        // Processor returned an array - stop recording before clear/add (that's just internal plumbing)
        mutations = messageList.stopRecording();

        if (result) {
          // Clear and re-add since processor worked with array. clear all messages, the new result array is all messages in the list (new input but also any messages added by other processors, memory for ex)
          const deletedIds = inputIds.filter(i => !result.some(m => m.id === i));
          if (deletedIds.length) {
            messageList.removeByIds(deletedIds);
          }

          // Separate system messages from other messages since they need different handling
          const systemMessages = result.filter(m => m.role === 'system');
          const nonSystemMessages = result.filter(m => m.role !== 'system');

          // Add system messages using addSystem
          for (const sysMsg of systemMessages) {
            const systemText =
              (sysMsg.content.content as string | undefined) ??
              sysMsg.content.parts?.map(p => (p.type === 'text' ? p.text : '')).join('\n') ??
              '';
            messageList.addSystem(systemText);
          }

          // Add non-system messages normally
          if (nonSystemMessages.length > 0) {
            for (const message of nonSystemMessages) {
              messageList.removeByIds([message.id]);
              messageList.add(message, check.getSource(message) || 'input');
            }
          }

          // Use messageList.get.input.db() for consistency with MessageList return type
          processableMessages = messageList.get.input.db();
        }
      }

      processorSpan?.end({
        output: processableMessages,
        attributes: mutations.length > 0 ? { messageListMutations: mutations } : undefined,
      });
    }

    return messageList;
  }

  /**
   * Run processInputStep for all processors that implement it.
   * Called at each step of the agentic loop, before the LLM is invoked.
   *
   * Unlike processInput which runs once at the start, this runs at every step
   * (including tool call continuations). This is useful for:
   * - Transforming message types between steps (e.g., AI SDK 'reasoning' -> Anthropic 'thinking')
   * - Modifying messages based on step context
   * - Implementing per-step message transformations
   *
   * @param args.messages - The current messages to be sent to the LLM (MastraDBMessage format)
   * @param args.messageList - MessageList instance for managing message sources
   * @param args.stepNumber - The current step number (0-indexed)
   * @param args.tracingContext - Optional tracing context for observability
   * @param args.requestContext - Optional runtime context with execution metadata
   *
   * @returns The processed MessageList
   */
  async runProcessInputStep(args: {
    messages: MastraDBMessage[];
    messageList: MessageList;
    stepNumber: number;
    tracingContext?: TracingContext;
    requestContext?: RequestContext;
  }): Promise<MessageList> {
    const { messageList, stepNumber, tracingContext, requestContext } = args;

    // Run through all input processors that have processInputStep
    for (const [index, processor] of this.inputProcessors.entries()) {
      const processMethod = processor.processInputStep?.bind(processor);

      if (!processMethod) {
        // Skip processors that don't implement processInputStep
        continue;
      }

      const processableMessages: MastraDBMessage[] = messageList.get.all.db();
      const idsBeforeProcessing = processableMessages.map(m => m.id);
      const check = messageList.makeMessageSourceChecker();

      const abort = (reason?: string): never => {
        throw new TripWire(reason || `Tripwire triggered by ${processor.id}`);
      };

      const currentSpan = tracingContext?.currentSpan;
      const parentSpan = currentSpan?.findParent(SpanType.AGENT_RUN) || currentSpan?.parent || currentSpan;
      const processorSpan = parentSpan?.createChildSpan({
        type: SpanType.PROCESSOR_RUN,
        name: `input step processor: ${processor.id}`,
        attributes: {
          processorName: processor.name ?? processor.id,
          processorType: 'input',
          processorIndex: index,
        },
        input: { messages: processableMessages, stepNumber },
      });

      // Start recording MessageList mutations for this processor
      messageList.startRecording();

      // Get all system messages to pass to the processor
      const currentSystemMessages = messageList.getAllSystemMessages();

      try {
        // Get per-processor state that persists across all method calls within this request
        const processorState = this.getProcessorState(processor.id);

        const result = await processMethod({
          messages: processableMessages,
          messageList,
          stepNumber,
          systemMessages: currentSystemMessages,
          state: processorState,
          abort,
          tracingContext: { currentSpan: processorSpan },
          requestContext,
        });

        // Stop recording and get mutations for this processor
        const mutations = messageList.stopRecording();

        // Handle the return type - MessageList or MastraDBMessage[]
        if (result instanceof MessageList) {
          if (result !== messageList) {
            throw new MastraError({
              category: 'USER',
              domain: 'AGENT',
              id: 'PROCESSOR_RETURNED_EXTERNAL_MESSAGE_LIST',
              text: `Processor ${processor.id} returned a MessageList instance other than the one that was passed in as an argument. New external message list instances are not supported. Use the messageList argument instead.`,
            });
          }
          // Processor returned the same messageList - mutations have been applied
        } else if (result) {
          // Processor returned an array - apply changes to messageList
          const deletedIds = idsBeforeProcessing.filter(i => !result.some(m => m.id === i));
          if (deletedIds.length) {
            messageList.removeByIds(deletedIds);
          }

          // Re-add messages with correct sources
          for (const message of result) {
            messageList.removeByIds([message.id]);
            if (message.role === 'system') {
              const systemText =
                (message.content.content as string | undefined) ??
                message.content.parts?.map(p => (p.type === 'text' ? p.text : '')).join('\n') ??
                '';
              messageList.addSystem(systemText);
            } else {
              messageList.add(message, check.getSource(message) || 'input');
            }
          }
        }

        processorSpan?.end({
          output: messageList.get.all.db(),
          attributes: mutations.length > 0 ? { messageListMutations: mutations } : undefined,
        });
      } catch (error) {
        // Stop recording on error
        messageList.stopRecording();

        if (error instanceof TripWire) {
          processorSpan?.end({
            metadata: { blocked: true, reason: error.message },
          });
          throw error;
        }
        processorSpan?.error({ error: error as Error, endSpan: true });
        this.logger.error(`[Agent:${this.agentName}] - Input step processor ${processor.id} failed:`, error);
        throw error;
      }
    }

    return messageList;
  }

  /**
   * Type guard to check if result is { messages, systemMessages }
   */
  private isProcessInputResultWithSystemMessages(
    result: unknown,
  ): result is { messages: MastraDBMessage[]; systemMessages: unknown[] } {
    return (
      result !== null &&
      typeof result === 'object' &&
      'messages' in result &&
      'systemMessages' in result &&
      Array.isArray((result as any).messages) &&
      Array.isArray((result as any).systemMessages)
    );
  }
}
