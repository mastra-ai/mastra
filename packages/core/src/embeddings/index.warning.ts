import { embed as baseEmbed } from './index';
import { EmbeddingOptions } from './types';

export * from './index';

export async function embed(value: string, embeddingOptions: EmbeddingOptions) {
  console.warn('Please import from "@mastra/core/embeddings" instead of "@mastra/core"');

  return baseEmbed(value, embeddingOptions);
}
