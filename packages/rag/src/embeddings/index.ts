import {
  embed as embedCore,
  embedMany as embedManyCore,
  EmbeddingOptions,
  EmbedManyResult,
  EmbedResult,
} from '@mastra/core';
import { Document as Chunk } from 'llamaindex';

function getText(input: Chunk | string): string {
  return input instanceof Chunk ? input.getText() : input;
}

// Keep existing embed signature for compatibility
export function embed(
  chunk: Chunk | string | Chunk[] | string[],
  options: EmbeddingOptions,
): Promise<EmbedResult<string> | EmbedManyResult<string>> {
  console.warn('embed is deprecated. Use embedSingle or embedMany instead.');
  if (Array.isArray(chunk)) {
    return embedMany(chunk, options);
  }
  return embedSingle(chunk, options);
}

// Added explicit return type as it was not being inferred correctly
export function embedSingle(chunk: Chunk | string, options: EmbeddingOptions): Promise<EmbedResult<string>> {
  return embedCore(getText(chunk), options);
}

// Added explicit return type as it was not being inferred correctly
export function embedMany(chunks: (Chunk | string)[], options: EmbeddingOptions): Promise<EmbedManyResult<string>> {
  return embedManyCore(chunks.map(getText), options);
}
