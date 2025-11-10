import type { MastraDBMessage, MessageList } from '../agent/message-list';
import { TripWire } from '../agent/trip-wire';
import type { IMastraLogger } from '../logger';
import { SpanType } from '../observability';
import type { Span, TracingContext } from '../observability';
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

  async runOutputProcessors(messageList: MessageList, tracingContext?: TracingContext): Promise<MessageList> {
    const responseMessages = messageList.clear.response.db();

    let processableMessages: MastraDBMessage[] = [...responseMessages];

    const ctx: { messages: MastraDBMessage[]; abort: () => never } = {
      messages: processableMessages,
      abort: () => {
        throw new TripWire('Tripwire triggered');
      },
    };

    for (const [index, processor] of this.outputProcessors.entries()) {
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

      processableMessages = await processMethod({
        messages: processableMessages,
        abort: ctx.abort,
        tracingContext: { currentSpan: processorSpan },
      });

      processorSpan?.end({ output: processableMessages });
    }

    if (processableMessages.length > 0) {
      messageList.add(processableMessages, 'response');
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

  async runInputProcessors(messageList: MessageList, tracingContext?: TracingContext): Promise<MessageList> {
    const userMessages = messageList.clear.input.db();

    let processableMessages: MastraDBMessage[] = [...userMessages];

    const ctx: { messages: MastraDBMessage[]; abort: () => never } = {
      messages: processableMessages,
      abort: () => {
        throw new TripWire('Tripwire triggered');
      },
    };

    for (const [index, processor] of this.inputProcessors.entries()) {
      const abort = (reason?: string): never => {
        throw new TripWire(reason || `Tripwire triggered by ${processor.id}`);
      };

      ctx.abort = abort;

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

      processableMessages = await processMethod({
        messages: processableMessages,
        abort: ctx.abort,
        tracingContext: { currentSpan: processorSpan },
      });

      processorSpan?.end({ output: processableMessages });
    }

    if (processableMessages.length > 0) {
      // Separate system messages from other messages since they need different handling
      const systemMessages = processableMessages.filter(m => m.role === 'system');
      const nonSystemMessages = processableMessages.filter(m => m.role !== 'system');

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
        messageList.add(nonSystemMessages, 'input');
      }
    }

    return messageList;
  }
}
