import { beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const embed = vi.fn((values: string[]) =>
    (async function* () {
      yield values.map(() => [0.1, 0.2, 0.3]);
    })(),
  );

  return {
    embed,
    getCachedModel: vi.fn(async () => ({ embed })),
  };
});

vi.mock('./model-cache.js', () => ({
  getCachedModel: mocks.getCachedModel,
  warmupFastEmbedModels: vi.fn(async () => undefined),
}));

beforeEach(() => {
  mocks.embed.mockClear();
  mocks.getCachedModel.mockClear();
});

test('registers role specific multilingual e5 models on the v3 provider', async () => {
  const { fastembed } = await import('./index.js');

  expect(fastembed.multilingualE5LargeQuery.modelId).toBe('multilingual-e5-large-query');
  expect(fastembed.multilingualE5LargePassage.modelId).toBe('multilingual-e5-large-passage');
  for (const model of [fastembed.multilingualE5LargeQuery, fastembed.multilingualE5LargePassage]) {
    expect(model.specificationVersion).toBe('v3');
    expect(model.provider).toBe('fastembed');
  }
});

test('applies the query prefix and uses the multilingual model', async () => {
  const { fastembed } = await import('./index.js');

  const result = await fastembed.multilingualE5LargeQuery.doEmbed({ values: ['مرحبا', 'hello'] });

  expect(mocks.getCachedModel).toHaveBeenCalledWith('MLE5Large');
  expect(mocks.embed).toHaveBeenCalledWith(['query: مرحبا', 'query: hello']);
  expect(result.embeddings).toHaveLength(2);
  expect(result.warnings).toEqual([]);
});

test('applies the passage prefix', async () => {
  const { fastembed } = await import('./index.js');

  await fastembed.multilingualE5LargePassage.doEmbed({ values: ['مرحبا'] });

  expect(mocks.getCachedModel).toHaveBeenCalledWith('MLE5Large');
  expect(mocks.embed).toHaveBeenCalledWith(['passage: مرحبا']);
});

test('leaves bge model inputs unprefixed', async () => {
  const { fastembed } = await import('./index.js');

  await fastembed.small.doEmbed({ values: ['hello'] });

  expect(mocks.getCachedModel).toHaveBeenCalledWith('BGESmallENV15');
  expect(mocks.embed).toHaveBeenCalledWith(['hello']);
});
