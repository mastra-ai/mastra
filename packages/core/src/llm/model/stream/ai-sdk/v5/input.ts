import type { ReadableStream } from 'stream/web';
import type { RegisteredLogger } from '../../../../../logger';
import type { ChunkType } from '../../../../../stream/types';
import { MastraModelInput } from '../../base/input';
import { convertFullStreamChunkToMastra } from './transforms';

export class AISDKV5InputStream extends MastraModelInput {
  constructor({ component, name }: { component: RegisteredLogger; name: string }) {
    super({ component, name });
  }

  async transform({
    runId,
    stream,
    controller,
  }: {
    runId: string;
    stream: ReadableStream<any>;
    controller: ReadableStreamDefaultController<ChunkType>;
  }) {
    for await (const chunk of stream) {
      const transformedChunk = convertFullStreamChunkToMastra(chunk, { runId });
      if (transformedChunk) {
        controller.enqueue(transformedChunk);
      }
    }
  }
}
