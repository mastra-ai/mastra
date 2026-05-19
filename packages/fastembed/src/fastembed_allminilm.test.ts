import { expect, test } from 'vitest';
import { FlagEmbedding, EmbeddingModel } from './fastembed.js';

test('AllMiniLML6V2: init', async () => {
  const model = await FlagEmbedding.init({
    model: EmbeddingModel.AllMiniLML6V2,
  });
  expect(model).toBeDefined();
}, 60_000);

test('AllMiniLML6V2: embed single', async () => {
  const flagEmbedding = await FlagEmbedding.init({
    model: EmbeddingModel.AllMiniLML6V2,
    maxLength: 512,
  });
  const embeddings = (await flagEmbedding.embed(['This is a test']).next()).value!;
  expect(embeddings).toBeDefined();
  expect(embeddings.length).toBe(1);
}, 60_000);

test('AllMiniLML6V2: embed batch', async () => {
  const flagEmbedding = await FlagEmbedding.init({
    model: EmbeddingModel.AllMiniLML6V2,
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

test('AllMiniLML6V2: embed small batch', async () => {
  const flagEmbedding = await FlagEmbedding.init({
    model: EmbeddingModel.AllMiniLML6V2,
    maxLength: 512,
  });
  const embeddingsBatch = flagEmbedding.embed(['This is a test', 'Some text'], 1);
  for await (const embeddings of embeddingsBatch) {
    expect(embeddings).toBeDefined();
    expect(embeddings.length).toBe(1);
    expect(embeddings[0].length).toBe(384);
  }
}, 60_000);

test('AllMiniLML6V2: queryEmbed', async () => {
  const flagEmbedding = await FlagEmbedding.init({
    model: EmbeddingModel.AllMiniLML6V2,
    maxLength: 512,
  });
  const embeddings = await flagEmbedding.queryEmbed('This is a test');
  expect(embeddings).toBeDefined();
  expect(embeddings.length).toBe(384);
}, 60_000);

test('AllMiniLML6V2: passageEmbed', async () => {
  const flagEmbedding = await FlagEmbedding.init({
    model: EmbeddingModel.AllMiniLML6V2,
    maxLength: 512,
  });
  const embeddings = (await flagEmbedding.passageEmbed(['This is a test']).next()).value!;
  expect(embeddings).toBeDefined();
  expect(embeddings.length).toBe(1);
}, 60_000);

test('AllMiniLML6V2: canonical values', async () => {
  const flagEmbedding = await FlagEmbedding.init({
    model: EmbeddingModel.AllMiniLML6V2,
    maxLength: 512,
  });
  const expected = [0.02591, 0.00573, 0.01147, 0.03796, -0.0232, -0.0549, 0.01404, -0.0107, -0.0244, -0.01822];

  const embeddings = (await flagEmbedding.embed(['hello world']).next()).value!;
  expect(embeddings).toBeDefined();
  for (let i = 0; i < expected.length; i++) {
    expect(embeddings[0][i]).toBeCloseTo(expected[i], 3);
  }
}, 60_000);
