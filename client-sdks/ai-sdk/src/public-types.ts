import type { InferUIMessageChunk, UIMessage } from '@mastra/core/ai';

export type { UIMessage };

/**
 * Adds the run's `traceId` to the options an AI SDK `messageMetadata` callback receives, so the callback can put it
 * in message metadata (e.g. `({ part, traceId }) => (part.type === 'start' ? { traceId } : undefined)`).
 * `traceId` is undefined when tracing is disabled.
 */
export type WithTraceId<T> = T extends (options: infer O) => infer R ? (options: O & { traceId?: string }) => R : T;

export type UIMessageStream<UI_MESSAGE extends UIMessage = UIMessage> = ReadableStream<InferUIMessageChunk<UI_MESSAGE>>;
