import type { ObjectStreamPart, StreamObjectResult, TextStreamPart } from 'ai';
import type { MastraMessageV2, MessageList } from '../agent/message-list';
import { TripWire } from '../agent/trip-wire';
import type { StreamTextResult } from '../llm';
import type { IMastraLogger } from '../logger';
import type { Processor } from './index';

/**
 * Implementation of processor state management
 */
class ProcessorState {
  private accumulatedText = '';
  public customState: Record<string, any> = {};
  public allChunks: (TextStreamPart<any> | ObjectStreamPart<any>)[] = [];

  constructor(private readonly processorName: string) {}

  // Internal methods for the runner
  addChunk(chunk: TextStreamPart<any> | ObjectStreamPart<any>): void {
    // Extract text from text-delta chunks for accumulated text
    if (chunk.type === 'text-delta') {
      this.accumulatedText += chunk.textDelta;
    }
    this.allChunks.push(chunk);
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

  async runOutputProcessors(messageList: MessageList, telemetry?: any): Promise<MessageList> {
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

      if (!telemetry) {
        processableMessages = await processMethod({ messages: processableMessages, abort: ctx.abort });
      } else {
        await telemetry.traceMethod(
          async () => {
            processableMessages = await processMethod({ messages: processableMessages, abort: ctx.abort });
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
    }

    if (processableMessages.length > 0) {
      messageList.add(processableMessages, 'response');
    }

    return messageList;
  }

  /**
   * Process a stream part through all output processors with state management
   */
  async processPart(
    chunk: TextStreamPart<any> | ObjectStreamPart<any>,
    processorStates: Map<string, ProcessorState>,
  ): Promise<{
    chunk: TextStreamPart<any> | ObjectStreamPart<any> | null | undefined;
    blocked: boolean;
    reason?: string;
  }> {
    if (!this.outputProcessors.length) {
      return { chunk, blocked: false };
    }

    try {
      let processedChunk: TextStreamPart<any> | ObjectStreamPart<any> | null | undefined = chunk;

      for (const processor of this.outputProcessors) {
        try {
          if (processor.processOutputStream && processedChunk) {
            // Get or create state for this processor
            let state = processorStates.get(processor.name);
            if (!state) {
              state = new ProcessorState(processor.name);
              processorStates.set(processor.name, state);
            }

            // Add the current chunk to accumulated text
            state.addChunk(processedChunk);

            const result = await processor.processOutputStream({
              chunk: processedChunk,
              allChunks: state.allChunks,
              state: state.customState,
              abort: (reason?: string) => {
                throw new TripWire(reason || `Chunk blocked by ${processor.name}`);
              },
            });

            // If result is null, or undefined, don't emit
            processedChunk = result;
          }
        } catch (error) {
          if (error instanceof TripWire) {
            return { chunk: null, blocked: true, reason: error.message };
          }
          // Log error but continue with original chunk
          this.logger.error(`[Agent:${this.agentName}] - Output processor ${processor.name} failed:`, error);
        }
      }

      return { chunk: processedChunk, blocked: false };
    } catch (error) {
      this.logger.error(`[Agent:${this.agentName}] - Chunk processing failed:`, error);
      return { chunk, blocked: false };
    }
  }

  async runOutputProcessorsForStream(
    streamResult: StreamObjectResult<any, any, any> | StreamTextResult<any, any>,
  ): Promise<ReadableStream<any>> {
    return new ReadableStream({
      start: async controller => {
        const reader = streamResult.fullStream.getReader();
        const processorStates = new Map<string, ProcessorState>();

        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              controller.close();
              break;
            }

            // Process all chunks through output processors
            const { chunk: processedChunk, blocked, reason } = await this.processPart(value, processorStates);

            if (blocked) {
              // Log that chunk was blocked
              void this.logger.debug(`[Agent:${this.agentName}] - Chunk blocked by output processor`, {
                reason,
                originalChunk: value,
              });

              // Send tripwire chunk and close stream for abort
              controller.enqueue({
                type: 'tripwire',
                tripwireReason: reason || 'Output processor blocked content',
              });
              controller.close();
              break;
            } else if (processedChunk !== null) {
              // Send processed chunk only if it's not null (which indicates don't emit)
              controller.enqueue(processedChunk);
            }
            // If processedChunk is null, don't emit anything for this chunk
          }
        } catch (error) {
          controller.error(error);
        }
      },
    });
  }

  async runInputProcessors(messageList: MessageList, telemetry?: any): Promise<MessageList> {
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

      if (!telemetry) {
        processableMessages = await processMethod({ messages: processableMessages, abort: ctx.abort });
      } else {
        await telemetry.traceMethod(
          async () => {
            processableMessages = await processMethod({ messages: processableMessages, abort: ctx.abort });
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
    }

    if (processableMessages.length > 0) {
      messageList.add(processableMessages, 'user');
    }

    return messageList;
  }
}
