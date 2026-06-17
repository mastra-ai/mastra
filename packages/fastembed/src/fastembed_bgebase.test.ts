import { expect, test } from 'vitest';
import { FlagEmbedding, EmbeddingModel } from './fastembed.js';

test('BGEBaseEN: init', async () => {
  const model = await FlagEmbedding.init({
    model: EmbeddingModel.BGEBaseEN,
  });
  expect(model).toBeDefined();
}, 60_000);

test('BGEBaseEN: embed single', async () => {
  const flagEmbedding = await FlagEmbedding.init({
    model: EmbeddingModel.BGEBaseEN,
    maxLength: 512,
  });
  const embeddings = (await flagEmbedding.embed(['This is a test']).next()).value!;
  expect(embeddings).toBeDefined();
  expect(embeddings.length).toBe(1);
}, 60_000);

test('BGEBaseEN: embed batch', async () => {
  const flagEmbedding = await FlagEmbedding.init({
    model: EmbeddingModel.BGEBaseEN,
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
    expect(embeddings[0].length).toBe(768);
  }
}, 60_000);

test('BGEBaseEN: embed small batch', async () => {
  const flagEmbedding = await FlagEmbedding.init({
    model: EmbeddingModel.BGEBaseEN,
    maxLength: 512,
  });
  const embeddingsBatch = flagEmbedding.embed(
    ['This is a test', 'Some text', 'Some more test', 'This is a test', 'Some text', 'Some more test'],
    1,
  );
  for await (const embeddings of embeddingsBatch) {
    expect(embeddings).toBeDefined();
    expect(embeddings.length).toBe(1);
    expect(embeddings[0].length).toBe(768);
  }
}, 60_000);

test('BGEBaseEN: queryEmbed', async () => {
  const flagEmbedding = await FlagEmbedding.init({
    model: EmbeddingModel.BGEBaseEN,
    maxLength: 512,
  });
  const embeddings = await flagEmbedding.queryEmbed('This is a test');
  expect(embeddings).toBeDefined();
  expect(embeddings.length).toBe(768);
}, 60_000);

test('BGEBaseEN: passageEmbed', async () => {
  const flagEmbedding = await FlagEmbedding.init({
    model: EmbeddingModel.BGEBaseEN,
    maxLength: 512,
  });
  const embeddings = (await flagEmbedding.passageEmbed(['This is a test']).next()).value!;
  expect(embeddings).toBeDefined();
  expect(embeddings.length).toBe(1);
}, 60_000);

test('BGEBaseEN: canonical values', async () => {
  const flagEmbedding = await FlagEmbedding.init({
    model: EmbeddingModel.BGEBaseEN,
    maxLength: 512,
  });
  const expected = [0.0114, 0.03722, 0.02941, 0.0123, 0.03451, 0.00876, 0.02356, 0.05414, -0.0294, -0.0547];

  const embeddings = (await flagEmbedding.embed(['hello world']).next()).value!;
  expect(embeddings).toBeDefined();
  for (let i = 0; i < expected.length; i++) {
    expect(embeddings[0][i]).toBeCloseTo(expected[i], 3);
  }
}, 60_000);
