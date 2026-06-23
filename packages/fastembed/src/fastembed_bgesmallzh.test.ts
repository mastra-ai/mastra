import { expect, test } from 'vitest';
import { FlagEmbedding, EmbeddingModel } from './fastembed.js';

test('BGESmallZH: init', async () => {
  const model = await FlagEmbedding.init({
    model: EmbeddingModel.BGESmallZH,
  });
  expect(model).toBeDefined();
}, 60_000);

test('BGESmallZH: embed single', async () => {
  const flagEmbedding = await FlagEmbedding.init({
    model: EmbeddingModel.BGESmallZH,
    maxLength: 512,
  });
  const embeddings = (await flagEmbedding.embed(['This is a test']).next()).value!;
  expect(embeddings).toBeDefined();
  expect(embeddings.length).toBe(1);
}, 60_000);

test('BGESmallZH: embed batch', async () => {
  const flagEmbedding = await FlagEmbedding.init({
    model: EmbeddingModel.BGESmallZH,
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
    expect(embeddings[0].length).toBe(512);
  }
}, 60_000);

test('BGESmallZH: embed small batch', async () => {
  const flagEmbedding = await FlagEmbedding.init({
    model: EmbeddingModel.BGESmallZH,
    maxLength: 512,
  });
  const embeddingsBatch = flagEmbedding.embed(
    ['This is a test', 'Some text', 'Some more test', 'This is a test', 'Some text', 'Some more test'],
    1,
  );
  for await (const embeddings of embeddingsBatch) {
    expect(embeddings).toBeDefined();
    expect(embeddings.length).toBe(1);
    expect(embeddings[0].length).toBe(512);
  }
}, 60_000);

test('BGESmallZH: queryEmbed', async () => {
  const flagEmbedding = await FlagEmbedding.init({
    model: EmbeddingModel.BGESmallZH,
    maxLength: 512,
  });
  const embeddings = await flagEmbedding.queryEmbed('This is a test');
  expect(embeddings).toBeDefined();
  expect(embeddings.length).toBe(512);
}, 60_000);

test('BGESmallZH: passageEmbed', async () => {
  const flagEmbedding = await FlagEmbedding.init({
    model: EmbeddingModel.BGESmallZH,
    maxLength: 512,
  });
  const embeddings = (await flagEmbedding.passageEmbed(['This is a test']).next()).value!;
  expect(embeddings).toBeDefined();
  expect(embeddings.length).toBe(1);
}, 60_000);

test('BGESmallZH: canonical values', async () => {
  const flagEmbedding = await FlagEmbedding.init({
    model: EmbeddingModel.BGESmallZH,
    maxLength: 512,
  });
  const expected = [-0.01023294, 0.07634465, 0.0691722, -0.04458365, -0.03160762];

  const embeddings = (await flagEmbedding.embed(['hello world']).next()).value!;
  expect(embeddings).toBeDefined();
  for (let i = 0; i < expected.length; i++) {
    expect(embeddings[0][i]).toBeCloseTo(expected[i], 3);
  }
}, 60_000);
