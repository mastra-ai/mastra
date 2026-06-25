import type { LanguageModelV2StreamPart } from '@ai-sdk/provider-v5';
import type { IdGenerator } from '@internal/ai-sdk-v5';
import { generateId as defaultGenerateId } from '@internal/ai-sdk-v5';
import type { RegisteredLogger } from '../../../logger';
import { safeEnqueue, MastraModelInput } from '../../base';
import type { ChunkType, TextStreamPartType } from '../../types';
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

function isTextChunk(
  chunk: ChunkType,
): chunk is Extract<ChunkType, { type: 'text-start' | 'text-delta' | 'text-end' }> {
  return chunk.type === 'text-start' || chunk.type === 'text-delta' || chunk.type === 'text-end';
}

function annotateTextChunk<T extends Extract<ChunkType, { type: 'text-start' | 'text-delta' | 'text-end' }>>(
  chunk: T,
  textStreamPartType: TextStreamPartType,
): T {
  chunk.payload.textStreamPartType = textStreamPartType;
  return chunk;
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
    let currentStepTextChunks: Extract<ChunkType, { type: 'text-start' | 'text-delta' | 'text-end' }>[] = [];
    let currentStepHasToolCall = false;

    const enqueueTextChunks = (textStreamPartType: TextStreamPartType) => {
      for (const textChunk of currentStepTextChunks) {
        safeEnqueue(controller, annotateTextChunk(textChunk, textStreamPartType));
      }
      currentStepTextChunks = [];
    };

    for await (const chunk of stream) {
      const rawChunk = chunk as StreamPart;

      // Clear ID map on new step so each step gets fresh UUIDs
      if ((rawChunk as { type: string }).type === 'stream-start') {
        idMap.clear();
        enqueueTextChunks(currentStepHasToolCall ? 'narration' : 'final-answer');
        currentStepHasToolCall = false;
      }

      const transformedChunk = convertFullStreamChunkToMastra(rawChunk, { runId });

      if (transformedChunk) {
        // Replace numeric IDs with unique IDs for text chunks
        if (isTextChunk(transformedChunk) && transformedChunk.payload?.id && isNumericId(transformedChunk.payload.id)) {
          const originalId = transformedChunk.payload.id;
          if (!idMap.has(originalId)) {
            idMap.set(originalId, this.#generateId());
          }
          transformedChunk.payload.id = idMap.get(originalId)!;
        }

        if (isTextChunk(transformedChunk)) {
          currentStepTextChunks.push(transformedChunk);
          continue;
        }

        if (transformedChunk.type === 'tool-call' || transformedChunk.type === 'tool-call-input-streaming-start') {
          currentStepHasToolCall = true;
        }

        if (transformedChunk.type === 'step-finish' || transformedChunk.type === 'finish') {
          enqueueTextChunks(currentStepHasToolCall ? 'narration' : 'final-answer');
        }

        safeEnqueue(controller, transformedChunk);

        if (transformedChunk.type === 'step-finish') {
          currentStepHasToolCall = false;
        }
      }
    }

    enqueueTextChunks(currentStepHasToolCall ? 'narration' : 'final-answer');
  }
}
