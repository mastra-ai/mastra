import type { LanguageModelV2StreamPart } from '@ai-sdk/provider';
import type { RegisteredLogger } from '../../../logger';
import { MastraModelInput } from '../../base';
import type { ChunkType } from '../../types';
import { convertFullStreamChunkToMastra } from './transform';

export class AISDKV4InputStream extends MastraModelInput {
  constructor({ component, name }: { component: RegisteredLogger; name: string }) {
    super({ component, name });
  }

  async transform({
    runId,
    stream,
    controller,
  }: {
    runId: string;
    stream: ReadableStream<LanguageModelV2StreamPart>;
    controller: ReadableStreamDefaultController<ChunkType>;
  }) {
    // ReadableStream throws TS errors, if imported not imported. What an annoying thing.
    //@ts-ignore
    for await (const chunk of stream) {
      const transformedChunk = convertFullStreamChunkToMastra(chunk, { runId });
      if (transformedChunk) {
        controller.enqueue(transformedChunk);
      }
    }
  }
}
