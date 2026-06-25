import type { LanguageModelV1StreamPart } from '@internal/ai-sdk-v4';
import type { RegisteredLogger } from '../../../logger';
import { safeEnqueue, MastraModelInput } from '../../base';
import type { ChunkType, TextStreamPartType } from '../../types';
import { convertFullStreamChunkToMastra } from './transform';

function isTextDeltaChunk(chunk: ChunkType): chunk is Extract<ChunkType, { type: 'text-delta' }> {
  return chunk.type === 'text-delta';
}

function annotateTextDeltaChunk<T extends Extract<ChunkType, { type: 'text-delta' }>>(
  chunk: T,
  textStreamPartType: TextStreamPartType,
): T {
  chunk.payload.textStreamPartType = textStreamPartType;
  return chunk;
}

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
    stream: ReadableStream<LanguageModelV1StreamPart>;
    controller: ReadableStreamDefaultController<ChunkType>;
  }) {
    let currentStepTextChunks: Extract<ChunkType, { type: 'text-delta' }>[] = [];
    let currentStepHasToolCall = false;

    const enqueueTextChunks = (textStreamPartType: TextStreamPartType) => {
      for (const textChunk of currentStepTextChunks) {
        safeEnqueue(controller, annotateTextDeltaChunk(textChunk, textStreamPartType));
      }
      currentStepTextChunks = [];
    };

    for await (const chunk of stream) {
      const transformedChunk = convertFullStreamChunkToMastra(chunk, { runId });
      if (transformedChunk) {
        if (isTextDeltaChunk(transformedChunk)) {
          currentStepTextChunks.push(transformedChunk);
          continue;
        }

        if (transformedChunk.type === 'tool-call') {
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
