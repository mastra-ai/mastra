import type { LanguageModelV2StreamPart } from '@ai-sdk/provider-v5';
import { MastraBase } from '../../base';
import type { ChunkType, CreateStream, OnResult } from '../types';

/**
 * Check if a ReadableStreamDefaultController is open and can accept data.
 * After controller.close() or stream cancellation, desiredSize becomes 0 or null.
 * We treat both as closed states to prevent "Controller is already closed" errors.
 */
export function isControllerOpen(controller: ReadableStreamDefaultController<any>): boolean {
  return controller.desiredSize !== 0 && controller.desiredSize !== null;
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

  initialize({ runId, createStream, onResult }: { createStream: CreateStream; runId: string; onResult: OnResult }) {
    const self = this;

    const stream = new ReadableStream<ChunkType>({
      async start(controller) {
        try {
          const stream = await createStream();

          onResult({
            warnings: stream.warnings,
            request: stream.request,
            rawResponse: stream.rawResponse || stream.response || {},
          });

          await self.transform({
            runId,
            stream: stream.stream,
            controller,
          });

          if (isControllerOpen(controller)) {
            controller.close();
          }
        } catch (error) {
          if (isControllerOpen(controller)) {
            controller.error(error);
          }
        }
      },
    });

    return stream;
  }
}
