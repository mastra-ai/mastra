import { MastraBase } from '../../base';
import type { ChunkType, CreateStream, OnResult } from '../types';

export abstract class MastraModelInput extends MastraBase {
  abstract transform({
    runId,
    stream,
    controller,
  }: {
    runId: string;
    stream: ReadableStream<any>;
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

          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return stream;
  }
}
