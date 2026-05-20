import { expect, test } from 'vitest';
import { FlagEmbedding, EmbeddingModel } from './fastembed.js';

test('MLE5Large: init', async () => {
  const model = await FlagEmbedding.init({
    model: EmbeddingModel.MLE5Large,
  });
  expect(model).toBeDefined();
}, 120_000);

test('MLE5Large: embed single', async () => {
  const flagEmbedding = await FlagEmbedding.init({
    model: EmbeddingModel.MLE5Large,
    maxLength: 512,
  });
  const embeddings = (await flagEmbedding.embed(['This is a test']).next()).value!;
  expect(embeddings).toBeDefined();
  expect(embeddings.length).toBe(1);
}, 120_000);

test('MLE5Large: embed batch', async () => {
  const flagEmbedding = await FlagEmbedding.init({
    model: EmbeddingModel.MLE5Large,
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
    expect(embeddings[0].length).toBe(1024);
  }
}, 120_000);

test('MLE5Large: embed small batch', async () => {
  const flagEmbedding = await FlagEmbedding.init({
    model: EmbeddingModel.MLE5Large,
    maxLength: 512,
  });
  const embeddingsBatch = flagEmbedding.embed(
    ['This is a test', 'Some text', 'Some more test', 'This is a test', 'Some text', 'Some more test'],
    1,
  );
  for await (const embeddings of embeddingsBatch) {
    expect(embeddings).toBeDefined();
    expect(embeddings.length).toBe(1);
    expect(embeddings[0].length).toBe(1024);
  }
}, 120_000);

test('MLE5Large: queryEmbed', async () => {
  const flagEmbedding = await FlagEmbedding.init({
    model: EmbeddingModel.MLE5Large,
    maxLength: 512,
  });
  const embeddings = await flagEmbedding.queryEmbed('This is a test');
  expect(embeddings).toBeDefined();
  expect(embeddings.length).toBe(1024);
}, 120_000);

test('MLE5Large: passageEmbed', async () => {
  const flagEmbedding = await FlagEmbedding.init({
    model: EmbeddingModel.MLE5Large,
    maxLength: 512,
  });
  const embeddings = (await flagEmbedding.passageEmbed(['This is a test']).next()).value!;
  expect(embeddings).toBeDefined();
  expect(embeddings.length).toBe(1);
}, 120_000);

test('MLE5Large: canonical values', async () => {
  const flagEmbedding = await FlagEmbedding.init({
    model: EmbeddingModel.MLE5Large,
    maxLength: 512,
  });
  const expected = [0.00961, 0.00443, 0.00658, -0.03532, 0.00703, -0.02878, -0.03671, 0.03482, 0.06343, -0.04731];

  const embeddings = (await flagEmbedding.embed(['hello world']).next()).value!;
  expect(embeddings).toBeDefined();
  for (let i = 0; i < expected.length; i++) {
    expect(embeddings[0][i]).toBeCloseTo(expected[i], 3);
  }
}, 120_000);
