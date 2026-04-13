import { randomUUID } from 'node:crypto';
import { ReadableStream } from 'node:stream/web';
import type { MastraLanguageModel } from '../llm/model/shared.types';
import type { ObservabilityContext } from '../observability';
import { resolveObservabilityContext } from '../observability';
import { ChunkFrom, MastraModelOutput } from '../stream';
import type { ChunkType } from '../stream/types';
import type { InnerAgentExecutionOptions } from './agent.types';
import type { MessageList } from './message-list';

/**
 * Options for TripWire that control how the tripwire should be handled
 */
export interface TripWireOptions<TMetadata = unknown> {
  /**
   * If true, the agent should retry with the tripwire reason as feedback.
   * The failed response will be added to message history along with the reason.
   */
  retry?: boolean;
  /**
   * Strongly typed metadata from the processor.
   * This allows processors to pass structured information about what triggered the tripwire.
   */
  metadata?: TMetadata;
}

/**
 * TripWire is a custom Error class for aborting processing with optional retry and metadata.
 *
 * When thrown from a processor, it signals that processing should stop.
 * The `options` field controls how the tripwire should be handled:
 * - `retry: true` - The agent will retry with the reason as feedback
 * - `metadata` - Strongly typed data about what triggered the tripwire
 */
export class TripWire<TMetadata = unknown> extends Error {
  public readonly options: TripWireOptions<TMetadata>;
  public readonly processorId?: string;

  constructor(reason: string, options: TripWireOptions<TMetadata> = {}, processorId?: string) {
    super(reason);
    this.options = options;
    this.processorId = processorId;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Tripwire data passed to getModelOutputForTripwire
 */
export interface TripwireData<TMetadata = unknown> {
  reason: string;
  retry?: boolean;
  metadata?: TMetadata;
  processorId?: string;
}

export const getModelOutputForTripwire = async <OUTPUT = undefined, TMetadata = unknown>({
  tripwire,
  runId,
  options,
  model,
  messageList,
  ...rest
}: {
  tripwire: TripwireData<TMetadata>;
  runId: string;
  options: InnerAgentExecutionOptions<OUTPUT>;
  model: MastraLanguageModel;
  messageList: MessageList;
} & ObservabilityContext) => {
  const observabilityContext = resolveObservabilityContext(rest);
  const tripwireStream = new ReadableStream<ChunkType<OUTPUT>>({
    start(controller) {
      controller.enqueue({
        type: 'tripwire',
        runId,
        from: ChunkFrom.AGENT,
        payload: {
          reason: tripwire.reason || '',
          retry: tripwire.retry,
          metadata: tripwire.metadata,
          processorId: tripwire.processorId,
        },
      });
      controller.close();
    },
  });

  const modelOutput = new MastraModelOutput<OUTPUT>({
    model: {
      modelId: model.modelId,
      provider: model.provider,
      version: model.specificationVersion,
    },
    stream: tripwireStream,
    messageList,
    options: {
      runId,
      structuredOutput: options.structuredOutput,
      ...observabilityContext,
      onFinish: options.onFinish as any, // Fix these types after the types PR is merged
      onStepFinish: options.onStepFinish as any,
      returnScorerData: options.returnScorerData,
      requestContext: options.requestContext,
    },
    messageId: randomUUID(),
  });

  return modelOutput;
};
