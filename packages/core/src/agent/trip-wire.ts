import { ReadableStream } from 'node:stream/web';
import type { MastraLanguageModel } from '../llm/model/shared.types';
import type { ObservabilityContext } from '../observability';
import { resolveObservabilityContext } from '../observability';
import { MastraModelOutput } from '../stream/base/output';
import { ChunkFrom } from '../stream/types';
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
  /**
   * What memory should keep for the turn the tripwire blocked.
   *
   * - `'none'` (default): roll back the messages this run already saved, so a blocked
   *   reply never reaches the thread or the next turn's model input.
   * - `'partial'`: keep them, so the work the run already did (the user message, completed
   *   tool steps, and the text a processor before the tripwire streamed) stays in the thread.
   *
   * Use `'partial'` when the run stopped for a reason the user should still see, such as a
   * guardrail that blocked the reply of a turn that already ran tools.
   */
  persist?: 'none' | 'partial';
}

/**
 * TripWire is a custom Error class for aborting processing with optional retry, metadata and persistence.
 *
 * When thrown from a processor, it signals that processing should stop.
 * The `options` field controls how the tripwire should be handled:
 * - `retry: true` - The agent will retry with the reason as feedback
 * - `metadata` - Strongly typed data about what triggered the tripwire
 * - `persist: 'partial'` - Keep the messages this run already saved instead of rolling them back
 */
export class TripWire<TMetadata = unknown> extends Error {
  public readonly options: TripWireOptions<TMetadata>;
  public readonly processorId?: string;

  constructor(reason: string, options: TripWireOptions<TMetadata> = {}, processorId?: string) {
    super(reason);
    this.name = 'TripWire';
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
  persist?: 'none' | 'partial';
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
          persist: tripwire.persist,
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
    messageId: globalThis.crypto.randomUUID(),
  });

  return modelOutput;
};
