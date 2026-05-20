import { expect, test } from 'vitest';
import { SparseTextEmbedding, SparseEmbeddingModel } from './fastembed.js';

test('SpladePPEnV1: init', async () => {
  const model = await SparseTextEmbedding.init({
    model: SparseEmbeddingModel.SpladePPEnV1,
  });
  expect(model).toBeDefined();
}, 120_000);

test('SpladePPEnV1: embed single', async () => {
  const sparseEmbedding = await SparseTextEmbedding.init({
    model: SparseEmbeddingModel.SpladePPEnV1,
    maxLength: 512,
  });
  const embeddings = (await sparseEmbedding.embed(['This is a test']).next()).value!;

  expect(embeddings).toBeDefined();
  expect(embeddings.length).toBe(1);

  const sparseVector = embeddings[0];
  expect(Array.isArray(sparseVector.indices)).toBe(true);
  expect(Array.isArray(sparseVector.values)).toBe(true);
  expect(sparseVector.values.length).toBeGreaterThan(0);
  expect(sparseVector.indices.length).toBe(sparseVector.values.length);

  for (let i = 0; i < sparseVector.values.length; i++) {
    expect(typeof sparseVector.indices[i]).toBe('number');
    expect(typeof sparseVector.values[i]).toBe('number');
    expect(sparseVector.values[i]).toBeGreaterThan(0);
  }
}, 120_000);

test('SpladePPEnV1: embed batch', async () => {
  const sparseEmbedding = await SparseTextEmbedding.init({
    model: SparseEmbeddingModel.SpladePPEnV1,
    maxLength: 512,
  });

  const texts = ['This is a test', 'Some text', 'Some more test', 'This is a test', 'Some text', 'Some more test'];

  const embeddingsBatch = sparseEmbedding.embed(texts);

  for await (const embeddings of embeddingsBatch) {
    expect(embeddings).toBeDefined();
    expect(embeddings.length).toBe(texts.length);

    embeddings.forEach(sparseVector => {
      expect(Array.isArray(sparseVector.indices)).toBe(true);
      expect(Array.isArray(sparseVector.values)).toBe(true);
      expect(sparseVector.values.length).toBeGreaterThan(0);
    });
  }
}, 120_000);

test('SpladePPEnV1: embed small batch', async () => {
  const sparseEmbedding = await SparseTextEmbedding.init({
    model: SparseEmbeddingModel.SpladePPEnV1,
    maxLength: 512,
  });

  const texts = ['This is a test', 'Some text', 'Some more test', 'This is a test', 'Some text', 'Some more test'];

  const embeddingsBatch = sparseEmbedding.embed(texts, 1);

  for await (const embeddings of embeddingsBatch) {
    expect(embeddings).toBeDefined();
    expect(embeddings.length).toBe(1);
    expect(Array.isArray(embeddings[0].indices)).toBe(true);
    expect(Array.isArray(embeddings[0].values)).toBe(true);
    expect(embeddings[0].values.length).toBeGreaterThan(0);
  }
}, 120_000);

test('SpladePPEnV1: queryEmbed', async () => {
  const sparseEmbedding = await SparseTextEmbedding.init({
    model: SparseEmbeddingModel.SpladePPEnV1,
    maxLength: 512,
  });

  const embedding = await sparseEmbedding.queryEmbed('This is a test');

  expect(embedding).toBeDefined();
  expect(Array.isArray(embedding.indices)).toBe(true);
  expect(Array.isArray(embedding.values)).toBe(true);
  expect(embedding.values.length).toBeGreaterThan(0);
  expect(embedding.indices.length).toBe(embedding.values.length);
}, 120_000);

test('SpladePPEnV1: passageEmbed', async () => {
  const sparseEmbedding = await SparseTextEmbedding.init({
    model: SparseEmbeddingModel.SpladePPEnV1,
    maxLength: 512,
  });

  const embeddings = (await sparseEmbedding.passageEmbed(['This is a test']).next()).value!;

  expect(embeddings).toBeDefined();
  expect(embeddings.length).toBe(1);
  expect(Array.isArray(embeddings[0].indices)).toBe(true);
  expect(Array.isArray(embeddings[0].values)).toBe(true);
}, 120_000);

test('SpladePPEnV1: sparsity', async () => {
  const sparseEmbedding = await SparseTextEmbedding.init({
    model: SparseEmbeddingModel.SpladePPEnV1,
    maxLength: 512,
  });

  const embedding = await sparseEmbedding.queryEmbed('hello world');

  expect(embedding).toBeDefined();
  expect(embedding.values.length).toBeLessThan(1000);
  expect(embedding.values.length).toBeGreaterThan(10);
}, 120_000);
