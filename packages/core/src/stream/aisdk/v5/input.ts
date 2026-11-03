import type { LanguageModelV2StreamPart } from '@ai-sdk/provider-v5';
import type { IdGenerator } from '@internal/ai-sdk-v5';
import { generateId as defaultGenerateId } from '@internal/ai-sdk-v5';
import type { RegisteredLogger } from '../../../logger';
import { safeEnqueue, MastraModelInput } from '../../base';
import type { ChunkType } from '../../types';
import { CitationMarkupStreamSanitizer, stripCitationMarkupFromToolInput } from './citation-markup';
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

    // OpenAI citation markers (\uE200cite\uE202turn0search0\uE201) are stripped
    // from text, reasoning and tool inputs before anything downstream sees them.
    // Each delta kind gets its own sanitizer because providers reuse ids across kinds.
    const citationSanitizers = {
      'text-delta': new CitationMarkupStreamSanitizer(),
      'reasoning-delta': new CitationMarkupStreamSanitizer(),
      'tool-input-delta': new CitationMarkupStreamSanitizer({ json: true }),
    } as const;
    const endChunkDeltaTypes = {
      'text-end': 'text-delta',
      'reasoning-end': 'reasoning-delta',
      'tool-input-end': 'tool-input-delta',
    } as const;

    const emit = (rawChunk: StreamPart) => {
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
    };

    // Text held back by a sanitizer waiting for a marker to close is released
    // as a trailing delta before the part ends, or before the step finishes.
    const flushHeldDeltas = (type: keyof typeof citationSanitizers, id?: string) => {
      const held = id === undefined ? citationSanitizers[type].flushAll() : [[id, citationSanitizers[type].flush(id)]];
      for (const [heldId, delta] of held) {
        if (delta) emit({ type, id: heldId, delta } as StreamPart);
      }
    };
    const flushAllHeldDeltas = () => {
      for (const type of Object.keys(citationSanitizers) as Array<keyof typeof citationSanitizers>) {
        flushHeldDeltas(type);
      }
    };

    for await (const chunk of stream) {
      let rawChunk = chunk as StreamPart;

      // Clear ID map on new step so each step gets fresh UUIDs
      if ((rawChunk as { type: string }).type === 'stream-start') {
        idMap.clear();
      }

      switch (rawChunk.type) {
        case 'text-delta':
        case 'reasoning-delta':
        case 'tool-input-delta':
          rawChunk = { ...rawChunk, delta: citationSanitizers[rawChunk.type].push(rawChunk.id, rawChunk.delta) };
          break;
        case 'text-end':
        case 'reasoning-end':
        case 'tool-input-end':
          flushHeldDeltas(endChunkDeltaTypes[rawChunk.type], rawChunk.id);
          break;
        case 'tool-call':
          rawChunk = { ...rawChunk, input: stripCitationMarkupFromToolInput(rawChunk.input) };
          break;
        case 'finish':
        case 'error':
          flushAllHeldDeltas();
          break;
      }

      // A tool-input delta made empty by the sanitizer carries nothing; text and
      // reasoning deltas are left to the converter, which keeps empty deltas
      // that still carry provider metadata.
      if (rawChunk.type === 'tool-input-delta' && !rawChunk.delta) continue;

      emit(rawChunk);
    }

    flushAllHeldDeltas();
  }
}
