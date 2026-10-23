// Vendored from @ai-sdk/ui-utils@1.2.11 (Apache-2.0, Copyright Vercel, Inc.) to avoid depending on
// @ai-sdk/provider-utils@2.x (GHSA-866g-f22w-33x8). Only the v4 data stream protocol pieces used by this package.
import { parseDataStreamPart } from './data-stream-parts';
import type { DataStreamPartType } from './data-stream-parts';

const NEWLINE = '\n'.charCodeAt(0);

// concatenates all the chunks into a single Uint8Array
function concatChunks(chunks: Uint8Array[], totalLength: number) {
  const concatenatedChunks = new Uint8Array(totalLength);

  let offset = 0;
  for (const chunk of chunks) {
    concatenatedChunks.set(chunk, offset);
    offset += chunk.length;
  }
  chunks.length = 0;

  return concatenatedChunks;
}

export async function processDataStream({
  stream,
  onTextPart,
  onReasoningPart,
  onReasoningSignaturePart,
  onRedactedReasoningPart,
  onSourcePart,
  onFilePart,
  onDataPart,
  onErrorPart,
  onToolCallStreamingStartPart,
  onToolCallDeltaPart,
  onToolCallPart,
  onToolResultPart,
  onMessageAnnotationsPart,
  onFinishMessagePart,
  onFinishStepPart,
  onStartStepPart,
}: {
  stream: ReadableStream<Uint8Array>;
  onTextPart?: (streamPart: (DataStreamPartType & { type: 'text' })['value']) => Promise<void> | void;
  onReasoningPart?: (streamPart: (DataStreamPartType & { type: 'reasoning' })['value']) => Promise<void> | void;
  onReasoningSignaturePart?: (
    streamPart: (DataStreamPartType & { type: 'reasoning_signature' })['value'],
  ) => Promise<void> | void;
  onRedactedReasoningPart?: (
    streamPart: (DataStreamPartType & { type: 'redacted_reasoning' })['value'],
  ) => Promise<void> | void;
  onFilePart?: (streamPart: (DataStreamPartType & { type: 'file' })['value']) => Promise<void> | void;
  onSourcePart?: (streamPart: (DataStreamPartType & { type: 'source' })['value']) => Promise<void> | void;
  onDataPart?: (streamPart: (DataStreamPartType & { type: 'data' })['value']) => Promise<void> | void;
  onErrorPart?: (streamPart: (DataStreamPartType & { type: 'error' })['value']) => Promise<void> | void;
  onToolCallStreamingStartPart?: (
    streamPart: (DataStreamPartType & {
      type: 'tool_call_streaming_start';
    })['value'],
  ) => Promise<void> | void;
  onToolCallDeltaPart?: (
    streamPart: (DataStreamPartType & { type: 'tool_call_delta' })['value'],
  ) => Promise<void> | void;
  onToolCallPart?: (streamPart: (DataStreamPartType & { type: 'tool_call' })['value']) => Promise<void> | void;
  onToolResultPart?: (streamPart: (DataStreamPartType & { type: 'tool_result' })['value']) => Promise<void> | void;
  onMessageAnnotationsPart?: (
    streamPart: (DataStreamPartType & {
      type: 'message_annotations';
    })['value'],
  ) => Promise<void> | void;
  onFinishMessagePart?: (
    streamPart: (DataStreamPartType & { type: 'finish_message' })['value'],
  ) => Promise<void> | void;
  onFinishStepPart?: (streamPart: (DataStreamPartType & { type: 'finish_step' })['value']) => Promise<void> | void;
  onStartStepPart?: (streamPart: (DataStreamPartType & { type: 'start_step' })['value']) => Promise<void> | void;
}): Promise<void> {
  // implementation note: this slightly more complex algorithm is required
  // to pass the tests in the edge environment.

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const chunks: Uint8Array[] = [];
  let totalLength = 0;

  while (true) {
    const { value } = await reader.read();

    if (value) {
      chunks.push(value);
      totalLength += value.length;
      if (value[value.length - 1] !== NEWLINE) {
        // if the last character is not a newline, we have not read the whole JSON value
        continue;
      }
    }

    if (chunks.length === 0) {
      break; // we have reached the end of the stream
    }

    const concatenatedChunks = concatChunks(chunks, totalLength);
    totalLength = 0;

    const streamParts = decoder
      .decode(concatenatedChunks, { stream: true })
      .split('\n')
      .filter(line => line !== '') // splitting leaves an empty string at the end
      .map(parseDataStreamPart);

    for (const { type, value } of streamParts) {
      switch (type) {
        case 'text':
          await onTextPart?.(value);
          break;
        case 'reasoning':
          await onReasoningPart?.(value);
          break;
        case 'reasoning_signature':
          await onReasoningSignaturePart?.(value);
          break;
        case 'redacted_reasoning':
          await onRedactedReasoningPart?.(value);
          break;
        case 'file':
          await onFilePart?.(value);
          break;
        case 'source':
          await onSourcePart?.(value);
          break;
        case 'data':
          await onDataPart?.(value);
          break;
        case 'error':
          await onErrorPart?.(value);
          break;
        case 'message_annotations':
          await onMessageAnnotationsPart?.(value);
          break;
        case 'tool_call_streaming_start':
          await onToolCallStreamingStartPart?.(value);
          break;
        case 'tool_call_delta':
          await onToolCallDeltaPart?.(value);
          break;
        case 'tool_call':
          await onToolCallPart?.(value);
          break;
        case 'tool_result':
          await onToolResultPart?.(value);
          break;
        case 'finish_message':
          await onFinishMessagePart?.(value);
          break;
        case 'finish_step':
          await onFinishStepPart?.(value);
          break;
        case 'start_step':
          await onStartStepPart?.(value);
          break;
        default: {
          const exhaustiveCheck: never = type;
          throw new Error(`Unknown stream part type: ${exhaustiveCheck}`);
        }
      }
    }
  }
}
