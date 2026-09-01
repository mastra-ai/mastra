import type { InferUIMessageChunk as InferUIMessageChunkV5, UIMessage as UIMessageV5 } from '@internal/ai-sdk-v5';
import type { InferUIMessageChunk as InferUIMessageChunkV6, UIMessage as UIMessageV6 } from '@internal/ai-v6';
import type { InferUIMessageChunk as InferUIMessageChunkV7, UIMessage as UIMessageV7 } from '@internal/ai-v7';

export type V5UIMessage = UIMessageV5;
export type V6UIMessage = UIMessageV6;
export type V7UIMessage = UIMessageV7;
export type SupportedUIMessage = V5UIMessage | V6UIMessage | V7UIMessage;
export type SupportedUIMessageStream = V5UIMessageStream | V6UIMessageStream | V7UIMessageStream;
export type V5UIMessageStream<UI_MESSAGE extends V5UIMessage = V5UIMessage> = ReadableStream<
  InferUIMessageChunkV5<UI_MESSAGE>
>;
export type V6UIMessageStream<UI_MESSAGE extends V6UIMessage = V6UIMessage> = ReadableStream<
  InferUIMessageChunkV6<UI_MESSAGE>
>;
export type V7UIMessageStream<UI_MESSAGE extends V7UIMessage = V7UIMessage> = ReadableStream<
  InferUIMessageChunkV7<UI_MESSAGE>
>;
