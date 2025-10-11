import type { MastraModelOutput, OutputSchema } from '@mastra/core/stream';
import type { InferUIMessageChunk, UIMessage } from 'ai';
import { AgentStreamToAISDKTransformer } from './transformers';

export type { WorkflowAiSDKType } from './transformers';

export function toAISdkFormat<TOutput extends OutputSchema>(
  stream: MastraModelOutput<TOutput>,
): ReadableStream<InferUIMessageChunk<UIMessage>> {
  return stream.fullStream.pipeThrough(AgentStreamToAISDKTransformer<any>()) as ReadableStream<
    InferUIMessageChunk<UIMessage>
  >;
}
