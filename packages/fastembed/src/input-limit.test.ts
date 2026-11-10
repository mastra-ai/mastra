import { expect, test, vi } from 'vitest';

vi.mock('./model-cache.js', () => ({
  getCachedModel: vi.fn(),
  warmupFastEmbedModels: vi.fn(async () => undefined),
}));

// @mastra/memory sizes semantic recall chunks from `maxInputTokens`. Without it, chunks of about
// 4096 tokens reach a 512-token model and everything past the window is dropped from the vector.
test('every model declares its 512-token window for memory chunking', async () => {
  const { fastembed } = await import('./index.js');

  const models = [
    fastembed,
    fastembed.small,
    fastembed.base,
    fastembed.multilingualE5LargeQuery,
    fastembed.multilingualE5LargePassage,
    fastembed.smallV2,
    fastembed.baseV2,
    fastembed.smallLegacy,
    fastembed.baseLegacy,
  ];
  for (const model of models) {
    expect((model as { maxInputTokens?: number }).maxInputTokens).toBe(512);
  }
});
