import type { MastraMessageV2, MessageList } from '../agent/message-list';
import { TripWire } from '../agent/trip-wire';
import { AISpanType, type AISpan, type TracingContext } from '../ai-tracing';
import type { IMastraLogger } from '../logger';
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

  constructor(_processorName: string) {}

  // Internal methods for the runner
  addPart(part: ChunkType<OUTPUT>): void {
    // Extract text from text-delta chunks for accumulated text
    if (part.type === 'text-delta') {
      this.accumulatedText += part.payload.text;
    }
    this.streamParts.push(part);
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

  async runOutputProcessors(
    messageList: MessageList,
    tracingContext?: TracingContext,
    telemetry?: any,
  ): Promise<MessageList> {
    const responseMessages = messageList.clear.response.v2();

    let processableMessages: MastraMessageV2[] = [...responseMessages];

    const ctx: { messages: MastraMessageV2[]; abort: () => never } = {
      messages: processableMessages,
      abort: () => {
        throw new TripWire('Tripwire triggered');
      },
    };

    for (const [index, processor] of this.outputProcessors.entries()) {
      const abort = (reason?: string): never => {
        throw new TripWire(reason || `Tripwire triggered by ${processor.name}`);
      };

      ctx.abort = abort;

      // Use the processOutputResult method if available
      const processMethod = processor.processOutputResult?.bind(processor);

      if (!processMethod) {
        // Skip processors that don't implement processOutputResult
        continue;
      }

      const processorSpan = tracingContext?.currentSpan?.createChildSpan({
        type: AISpanType.PROCESSOR_RUN,
        name: `output processor: ${processor.name}`,
        attributes: {
          processorName: processor.name,
          processorType: 'output',
          processorIndex: index,
        },
        input: processableMessages,
      });

      if (!telemetry) {
        processableMessages = await processMethod({ messages: processableMessages, abort: ctx.abort, tracingContext: {currentSpan: processorSpan } });
      } else {
        await telemetry.traceMethod(
          async () => {
            processableMessages = await processMethod({
              messages: processableMessages,
              abort: ctx.abort,
              tracingContext,
            });
            return processableMessages;
          },
          {
            spanName: `agent.outputProcessor.${processor.name}`,
            attributes: {
              'processor.name': processor.name,
              'processor.index': index.toString(),
              'processor.total': this.outputProcessors.length.toString(),
            },
          },
        )();
      }
      processorSpan?.end({output: processableMessages});
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
      let processorSpan: AISpan<AISpanType.PROCESSOR_RUN> | undefined;

      for (const [index, processor] of this.outputProcessors.entries()) {
        try {
          if (processor.processOutputStream && processedPart) {
            // Get or create state for this processor
            let state = processorStates.get(processor.name);
            if (!state) {
              state = new ProcessorState<OUTPUT>(processor.name);
              processorStates.set(processor.name, state);
            }

            // Add the current part to accumulated text
            state.addPart(processedPart);

            // Question: instead, should we add the processorSpan to the processorState?
            // and append input & output to the span as it is generated?
            // and the close the span after all parts of the stream are completed?
            // then we would have multiple running spans running simultaneously for each processor
            // probably better than a TON of tiny spans (span per chunk per processor)
            // potentially even end the spans in runOutputProcessorsForStream?
            processorSpan = tracingContext?.currentSpan?.createChildSpan({
              type: AISpanType.PROCESSOR_RUN,
              name: `output processor: ${processor.name}`,
              attributes: {
                processorName: processor.name,
                processorType: 'output',
                processorIndex: index,
              },
              input: {
                part: processedPart as ChunkType,
                streamParts: state.streamParts as ChunkType[],
                state: state.customState,
              },
            });

            const result = await processor.processOutputStream({
              part: processedPart as ChunkType,
              streamParts: state.streamParts as ChunkType[],
              state: state.customState,
              abort: (reason?: string) => {
                throw new TripWire(reason || `Stream part blocked by ${processor.name}`);
              },
              tracingContext: {currentSpan: processorSpan },
            });

            // If result is null, or undefined, don't emit
            processedPart = result as ChunkType<OUTPUT> | null | undefined;
            processorSpan?.end({output: processedPart});
          }
        } catch (error) {
          processorSpan?.error({error: error as Error});
          if (error instanceof TripWire) {
            return { part: null, blocked: true, reason: error.message };
          }
          // Log error but continue with original part
          this.logger.error(`[Agent:${this.agentName}] - Output processor ${processor.name} failed:`, error);
        }
      }

      return { part: processedPart, blocked: false };
    } catch (error) {
      this.logger.error(`[Agent:${this.agentName}] - Stream part processing failed:`, error);
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
    telemetry?: any,
  ): Promise<MessageList> {
    const userMessages = messageList.clear.input.v2();

    let processableMessages: MastraMessageV2[] = [...userMessages];

    const ctx: { messages: MastraMessageV2[]; abort: () => never } = {
      messages: processableMessages,
      abort: () => {
        throw new TripWire('Tripwire triggered');
      },
    };

    for (const [index, processor] of this.inputProcessors.entries()) {
      const abort = (reason?: string): never => {
        throw new TripWire(reason || `Tripwire triggered by ${processor.name}`);
      };

      ctx.abort = abort;

      // Use the processInput method if available
      const processMethod = processor.processInput?.bind(processor);

      if (!processMethod) {
        // Skip processors that don't implement processInput
        continue;
      }

      const processorSpan = tracingContext?.currentSpan?.createChildSpan({
        type: AISpanType.PROCESSOR_RUN,
        name: `output processor: ${processor.name}`,
        attributes: {
          processorName: processor.name,
          processorType: 'input',
          processorIndex: index,
        },
        input: processableMessages,
      });

      if (!telemetry) {
        processableMessages = await processMethod({ messages: processableMessages, abort: ctx.abort, tracingContext });
      } else {
        await telemetry.traceMethod(
          async () => {
            processableMessages = await processMethod({
              messages: processableMessages,
              abort: ctx.abort,
              tracingContext,
            });
            return processableMessages;
          },
          {
            spanName: `agent.inputProcessor.${processor.name}`,
            attributes: {
              'processor.name': processor.name,
              'processor.index': index.toString(),
              'processor.total': this.inputProcessors.length.toString(),
            },
          },
        )();
      }
      processorSpan?.end({output: processableMessages});
    }

    if (processableMessages.length > 0) {
      messageList.add(processableMessages, 'user');
    }

    return messageList;
  }
}
