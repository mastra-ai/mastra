import { TransformStream } from 'node:stream/web';
import type { ReadableStream } from 'node:stream/web';
import type { ChunkType } from '../../stream/types';
import { STEP_CONTENT_CHUNK_TYPES } from './step-content-chunk-types';

/**
 * The first provider chunk that starts a response worth keeping. Until one arrives a
 * model request has produced only reasoning or metadata, and a queued signal may cancel it.
 */
export function startsResponseContent(chunk: { type: string }): boolean {
  if (chunk.type === 'reasoning-delta') return false;
  return (
    STEP_CONTENT_CHUNK_TYPES.has(chunk.type) ||
    chunk.type === 'text-start' ||
    chunk.type === 'text-end' ||
    chunk.type === 'tool-call-input-streaming-start' ||
    chunk.type === 'tool-call-input-streaming-end' ||
    chunk.type === 'tool-error'
  );
}

/**
 * Reads a provider stream before output processors can hold or drop its chunks: reports
 * the first response content, and ends the stream cleanly when `interruption` aborts so
 * in-flight processing finishes normally.
 */
export function watchInterruptibleStream<OUTPUT>(
  stream: ReadableStream<ChunkType<OUTPUT>>,
  interruption: AbortSignal,
  onResponseContent: () => void,
): ReadableStream<ChunkType<OUTPUT>> {
  return stream.pipeThrough(
    new TransformStream<ChunkType<OUTPUT>, ChunkType<OUTPUT>>({
      start(controller) {
        interruption.addEventListener('abort', () => controller.terminate(), { once: true });
      },
      transform(chunk, controller) {
        if (startsResponseContent(chunk)) onResponseContent();
        controller.enqueue(chunk);
      },
    }),
  );
}

/** Tracks reasoning blocks a client has seen open, so an interruption closes exactly those. */
export function trackOpenReasoning(chunk: { type: string; payload?: unknown }, openReasoningIds: Set<string>): void {
  const id = (chunk.payload as { id?: string } | undefined)?.id;
  if (id === undefined) return;
  if (chunk.type === 'reasoning-start') openReasoningIds.add(id);
  else if (chunk.type === 'reasoning-end') openReasoningIds.delete(id);
}
