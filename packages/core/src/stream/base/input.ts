import { isAbortError } from '@ai-sdk/provider-utils-v5';
import type { LanguageModelV2StreamPart } from '@ai-sdk/provider-v5';
import { MastraBase } from '../../base';
import { attachModelStreamTransport, ChunkFrom, readModelStreamTransport } from '../types';
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
    stream: ReadableStream<LanguageModelV2StreamPart | Record<string, unknown>>;
    controller: ReadableStreamDefaultController<ChunkType>;
  }): Promise<void>;

  initialize({
    runId,
    createStream,
    onResult,
    abortSignal,
  }: {
    createStream: CreateStream;
    runId: string;
    onResult: OnResult;
    abortSignal?: AbortSignal;
  }) {
    const self = this;

    let outputStream: ReadableStream<ChunkType>;
    outputStream = new ReadableStream<ChunkType>({
      async start(controller) {
        try {
          const stream = await createStream();
          attachModelStreamTransport(outputStream, readModelStreamTransport(stream));

          const initialChunks = onResult({
            warnings: stream.warnings,
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
            stream: stream.stream,
            controller,
          });

          safeClose(controller);
        } catch (error) {
          if (isAbortError(error) && abortSignal?.aborted) {
            safeEnqueue(controller, {
              type: 'error',
              runId,
              from: ChunkFrom.AGENT,
              payload: { error },
            } as ChunkType);
            safeClose(controller);
            return;
          }

          safeError(controller, error);
        }
      },
    });

    return outputStream;
  }
}
