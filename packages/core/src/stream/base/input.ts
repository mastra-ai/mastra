import type { LanguageModelV4StreamPart } from '@ai-sdk/provider';
import { MastraBase } from '../../base';
import { attachModelStreamTransport, readModelStreamTransport } from '../types';
import type { ChunkType, CreateStream, OnResult } from '../types';

/**
 * Safely enqueue a chunk into a ReadableStreamDefaultController.
 * Returns true if the enqueue succeeded, false if the controller was already closed/errored.
 *
 * Prefer this over checking desiredSize before enqueue, because desiredSize === 0
 * indicates backpressure (queue full, stream still open) — not closure.
 * Guarding on desiredSize would silently drop chunks under normal backpressure.
 */
export function safeEnqueue<T>(controller: ReadableStreamDefaultController<T>, chunk: T): boolean {
  try {
    controller.enqueue(chunk);
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely close a ReadableStreamDefaultController.
 * Returns true if the close succeeded, false if the controller was already closed/errored.
 */
export function safeClose(controller: ReadableStreamDefaultController<any>): boolean {
  try {
    controller.close();
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely signal an error on a ReadableStreamDefaultController.
 * Returns true if the error succeeded, false if the controller was already closed/errored.
 */
export function safeError(controller: ReadableStreamDefaultController<any>, error: unknown): boolean {
  try {
    controller.error(error);
    return true;
  } catch {
    return false;
  }
}

export abstract class MastraModelInput extends MastraBase {
  abstract transform({
    runId,
    stream,
    controller,
  }: {
    runId: string;
    stream: ReadableStream<LanguageModelV4StreamPart | Record<string, unknown>>;
    controller: ReadableStreamDefaultController<ChunkType>;
  }): Promise<void>;

  initialize({ runId, createStream, onResult }: { createStream: CreateStream; runId: string; onResult: OnResult }) {
    const self = this;

    let outputStream: ReadableStream<ChunkType>;
    outputStream = new ReadableStream<ChunkType>({
      async start(controller) {
        try {
          const stream = await createStream();
          attachModelStreamTransport(outputStream, readModelStreamTransport(stream));

          // Spec-v4 providers report call warnings in the leading `stream-start` part,
          // not on the doStream result, so read it before building the step result.
          const reader = stream.stream.getReader();
          const first = await reader.read();
          const firstPart = first.done ? undefined : first.value;
          const streamStartWarnings =
            firstPart && (firstPart as { type?: unknown }).type === 'stream-start'
              ? ((firstPart as { warnings?: unknown[] }).warnings ?? [])
              : [];
          const modelStream = new ReadableStream<LanguageModelV4StreamPart | Record<string, unknown>>({
            start(c) {
              if (first.done) c.close();
              else c.enqueue(first.value);
            },
            async pull(c) {
              const next = await reader.read();
              if (next.done) c.close();
              else c.enqueue(next.value);
            },
            cancel(reason) {
              return reader.cancel(reason);
            },
          });

          const initialChunks = onResult({
            warnings: streamStartWarnings.length ? streamStartWarnings : stream.warnings,
            request: stream.request,
            rawResponse: stream.rawResponse || stream.response || {},
          });
          if (initialChunks) {
            for (const chunk of Array.isArray(initialChunks) ? initialChunks : [initialChunks]) {
              controller.enqueue(chunk);
            }
          }

          await self.transform({
            runId,
            stream: modelStream,
            controller,
          });

          safeClose(controller);
        } catch (error) {
          safeError(controller, error);
        }
      },
    });

    return outputStream;
  }
}
