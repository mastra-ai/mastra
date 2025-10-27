import { randomUUID } from 'crypto';
import { ReadableStream } from 'stream/web';
import type { MastraLanguageModel } from '../llm/model/shared.types';
import type { TracingContext } from '../observability';
import { ChunkFrom, MastraModelOutput } from '../stream';
import type { OutputSchema } from '../stream/base/schema';
import type { ChunkType } from '../stream/types';
import type { InnerAgentExecutionOptions } from './agent.types';
import type { MessageList } from './message-list';

export class TripWire extends Error {
  constructor(reason: string) {
    super(reason);

    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export const getModelOutputForTripwire = async <
  OUTPUT extends OutputSchema | undefined = undefined,
  FORMAT extends 'aisdk' | 'mastra' | undefined = undefined,
>({
  tripwireReason,
  runId,
  tracingContext,
  options,
  model,
  messageList,
}: {
  tripwireReason: string;
  runId: string;
  tracingContext: TracingContext;
  options: InnerAgentExecutionOptions<OUTPUT, FORMAT>;
  model: MastraLanguageModel;
  messageList: MessageList;
}) => {
  const tripwireStream = new ReadableStream<ChunkType<OUTPUT>>({
    start(controller) {
      controller.enqueue({
        type: 'tripwire',
        runId,
        from: ChunkFrom.AGENT,
        payload: {
          tripwireReason: tripwireReason || '',
        },
      });
      controller.close();
    },
  });

  const modelOutput = new MastraModelOutput<OUTPUT>({
    model: {
      modelId: model.modelId,
      provider: model.provider,
      version: model.specificationVersion || 'v2',
    },
    stream: tripwireStream,
    messageList,
    options: {
      runId,
      structuredOutput: options.structuredOutput,
      tracingContext,
      onFinish: options.onFinish as any, // Fix these types after the types PR is merged
      onStepFinish: options.onStepFinish as any,
      returnScorerData: options.returnScorerData,
    },
    messageId: randomUUID(),
  });

  return modelOutput;
};
