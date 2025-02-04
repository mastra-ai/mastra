import { embed as baseEmbed, embedMany as baseEmbedMany } from './index';
import { EmbeddingOptions } from './types';

export * from './index';

export async function embed(value: string, embedding: EmbeddingOptions) {
  console.warn('Please import "embed" from "@mastra/core/embeddings" instead of "@mastra/core"');

  return baseEmbed(value, embedding);
}

export async function embedMany(value: string[], embedding: EmbeddingOptions) {
  console.warn('Please import "embedMany" from "@mastra/core/embeddings" instead of "@mastra/core"');

  return baseEmbedMany(value, embedding);
}
