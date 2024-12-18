import { embed as embedCore, EmbeddingOptions } from '@mastra/core';
import { Document as Chunk } from 'llamaindex';

export const embed = (chunk: Chunk | string | string[] | Chunk[], options: EmbeddingOptions) => {
  let value: string | string[];

  if (Array.isArray(chunk)) {
    value = chunk.map(chunk => (typeof chunk === 'string' ? chunk : chunk.getText()));
  } else if (chunk instanceof Chunk) {
    value = chunk.getText();
  } else {
    value = chunk;
  }

  return embedCore(value, options);
};
