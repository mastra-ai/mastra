import type { LanguageModelV2StreamPart } from '@ai-sdk/provider-v5';
import type { IdGenerator } from '@internal/ai-sdk-v5';
import { generateId as defaultGenerateId } from '@internal/ai-sdk-v5';
import type { RegisteredLogger } from '../../../logger';
import { safeEnqueue, MastraModelInput } from '../../base';
import type { ChunkType } from '../../types';
import { convertFullStreamChunkToMastra } from './transform';
import type { StreamPart } from './transform';

/**
 * Checks if an ID is a simple numeric string (e.g., "0", "1", "2").
 * Anthropic and Google providers use these indices which reset per LLM call,
 * while OpenAI uses UUIDs that are already unique.
 */
function isNumericId(id: string): boolean {
  return /^\d+$/.test(id);
}

export class AISDKV5InputStream extends MastraModelInput {
  #generateId: IdGenerator;

  constructor({
    component,
    name,
    generateId,
  }: {
    component: RegisteredLogger;
    name: string;
    generateId?: IdGenerator;
  }) {
    super({ component, name });
    this.#generateId = generateId ?? defaultGenerateId;
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
    // Map numeric IDs to unique IDs for uniqueness across steps.
    // Workaround for @ai-sdk/anthropic and @ai-sdk/google duplicate IDs bug:
    // These providers use numeric indices ("0", "1", etc.) that reset per LLM call.
    // See: https://github.com/mastra-ai/mastra/issues/9909
    const idMap = new Map<string, string>();

    // ReadableStream throws TS errors, if imported not imported. What an annoying thing.
    // @ts-expect-error - ReadableStream async iteration
    for await (const chunk of stream) {
      const rawChunk = chunk as StreamPart;

      // Clear ID map on new step so each step gets fresh UUIDs
      if ((rawChunk as { type: string }).type === 'stream-start') {
        idMap.clear();
      }

      const transformedChunk = convertFullStreamChunkToMastra(rawChunk, { runId });

      if (transformedChunk) {
        // Replace numeric IDs with unique IDs for text chunks
        if (
          (transformedChunk.type === 'text-start' ||
            transformedChunk.type === 'text-delta' ||
            transformedChunk.type === 'text-end') &&
          transformedChunk.payload?.id &&
          isNumericId(transformedChunk.payload.id)
        ) {
          const originalId = transformedChunk.payload.id;
          if (!idMap.has(originalId)) {
            idMap.set(originalId, this.#generateId());
          }
          transformedChunk.payload.id = idMap.get(originalId)!;
        }

        safeEnqueue(controller, transformedChunk);
      }
    }
  }
}
