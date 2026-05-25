import { expect, test } from 'vitest';
import { FlagEmbedding, EmbeddingModel } from './fastembed.js';

test('BGESmallEN: init', async () => {
  const model = await FlagEmbedding.init({
    model: EmbeddingModel.BGESmallEN,
  });
  expect(model).toBeDefined();
}, 60_000);

test('BGESmallEN: embed single', async () => {
  const flagEmbedding = await FlagEmbedding.init({
    model: EmbeddingModel.BGESmallEN,
    maxLength: 512,
  });
  const embeddings = (await flagEmbedding.embed(['This is a test']).next()).value!;
  expect(embeddings).toBeDefined();
  expect(embeddings.length).toBe(1);
}, 60_000);

test('BGESmallEN: embed batch', async () => {
  const flagEmbedding = await FlagEmbedding.init({
    model: EmbeddingModel.BGESmallEN,
    maxLength: 512,
  });
  const embeddingsBatch = flagEmbedding.embed([
    'This is a test',
    'Some text',
    'Some more test',
    'This is a test',
    'Some text',
    'Some more test',
  ]);
  for await (const embeddings of embeddingsBatch) {
    expect(embeddings).toBeDefined();
    expect(embeddings.length).toBe(6);
    expect(embeddings[0].length).toBe(384);
  }
}, 60_000);

test('BGESmallEN: embed small batch', async () => {
  const flagEmbedding = await FlagEmbedding.init({
    model: EmbeddingModel.BGESmallEN,
    maxLength: 512,
  });
  const embeddingsBatch = flagEmbedding.embed(
    ['This is a test', 'Some text', 'Some more test', 'This is a test', 'Some text', 'Some more test'],
    1,
  );
  for await (const embeddings of embeddingsBatch) {
    expect(embeddings).toBeDefined();
    expect(embeddings.length).toBe(1);
    expect(embeddings[0].length).toBe(384);
  }
}, 60_000);

test('BGESmallEN: queryEmbed', async () => {
  const flagEmbedding = await FlagEmbedding.init({
    model: EmbeddingModel.BGESmallEN,
    maxLength: 512,
  });
  const embeddings = await flagEmbedding.queryEmbed('This is a test');
  expect(embeddings).toBeDefined();
  expect(embeddings.length).toBe(384);
}, 60_000);

test('BGESmallEN: passageEmbed', async () => {
  const flagEmbedding = await FlagEmbedding.init({
    model: EmbeddingModel.BGESmallEN,
    maxLength: 512,
  });
  const embeddings = (await flagEmbedding.passageEmbed(['This is a test']).next()).value!;
  expect(embeddings).toBeDefined();
  expect(embeddings.length).toBe(1);
}, 60_000);

test('BGESmallEN: canonical values', async () => {
  const flagEmbedding = await FlagEmbedding.init({
    model: EmbeddingModel.BGESmallEN,
    maxLength: 512,
  });
  const expected = [-0.02313, -0.02552, 0.017357, -0.06393, -0.00061, 0.022123, -0.01472, 0.039255, 0.034447, 0.004598];

  const embeddings = (await flagEmbedding.embed(['hello world']).next()).value!;
  expect(embeddings).toBeDefined();
  for (let i = 0; i < expected.length; i++) {
    expect(embeddings[0][i]).toBeCloseTo(expected[i], 3);
  }
}, 60_000);
