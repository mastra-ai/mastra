import { describe, it, expect, beforeAll } from 'vitest';

/**
 * Integration tests for VoyageAI embeddings.
 *
 * These tests require a valid VOYAGE_API_KEY environment variable.
 * Tests are skipped if the API key is not available.
 */

const apiKey = process.env.VOYAGE_API_KEY;
const describeWithApiKey = apiKey ? describe : describe.skip;

describeWithApiKey('VoyageAI Integration Tests', () => {
  // Dynamic imports to avoid instantiation errors when no API key is present
  let voyage: Awaited<typeof import('../index')>['voyage'];
  let voyageEmbedding: Awaited<typeof import('../index')>['voyageEmbedding'];
  let voyageEmbeddingV2: Awaited<typeof import('../index')>['voyageEmbeddingV2'];
  let voyageMultimodalEmbedding: Awaited<typeof import('../index')>['voyageMultimodalEmbedding'];
  let voyageContextualizedEmbedding: Awaited<typeof import('../index')>['voyageContextualizedEmbedding'];
  let voyageReranker: Awaited<typeof import('../index')>['voyageReranker'];
  let createVoyageReranker: Awaited<typeof import('../index')>['createVoyageReranker'];

  beforeAll(async () => {
    const module = await import('../index');
    voyage = module.voyage;
    voyageEmbedding = module.voyageEmbedding;
    voyageEmbeddingV2 = module.voyageEmbeddingV2;
    voyageMultimodalEmbedding = module.voyageMultimodalEmbedding;
    voyageContextualizedEmbedding = module.voyageContextualizedEmbedding;
    voyageReranker = module.voyageReranker;
    createVoyageReranker = module.createVoyageReranker;
  });

  describe('Text Embeddings', () => {
    it('should generate real embeddings with default model', async () => {
      const result = await voyage.doEmbed({ values: ['Hello world'] });

      expect(result.embeddings).toHaveLength(1);
      expect(result.embeddings[0]).toBeInstanceOf(Array);
      expect(result.embeddings[0]!.length).toBeGreaterThan(0);
      // Default dimension is 1024
      expect(result.embeddings[0]!.length).toBe(1024);
    });

    it('should generate embeddings for multiple inputs', async () => {
      const result = await voyage.doEmbed({
        values: ['First text', 'Second text', 'Third text'],
      });

      expect(result.embeddings).toHaveLength(3);
      expect(result.embeddings.every(e => e.length === 1024)).toBe(true);
    });

    it('should support custom output dimensions', async () => {
      const model = voyageEmbedding({
        model: 'voyage-3.5',
        outputDimension: 256,
      });

      const result = await model.doEmbed({ values: ['Test dimension'] });

      expect(result.embeddings).toHaveLength(1);
      expect(result.embeddings[0]!.length).toBe(256);
    });

    it('should support input type for query optimization', async () => {
      const model = voyageEmbedding({
        model: 'voyage-3.5',
        inputType: 'query',
      });

      const result = await model.doEmbed({ values: ['What is machine learning?'] });

      expect(result.embeddings).toHaveLength(1);
      expect(result.embeddings[0]!.length).toBe(1024);
    });

    it('should support input type for document optimization', async () => {
      const model = voyageEmbedding({
        model: 'voyage-3.5',
        inputType: 'document',
      });

      const result = await model.doEmbed({
        values: ['Machine learning is a subset of artificial intelligence...'],
      });

      expect(result.embeddings).toHaveLength(1);
    });

    it('should work with code model', async () => {
      const result = await voyage.code.doEmbed({
        values: ['function hello() { console.log("Hello"); }'],
      });

      expect(result.embeddings).toHaveLength(1);
      expect(result.embeddings[0]!.length).toBe(1024);
    });

    it('should work with V2 model', async () => {
      const model = voyageEmbeddingV2('voyage-3.5');
      const result = await model.doEmbed({ values: ['Test V2'] });

      expect(result.embeddings).toHaveLength(1);
    });
  });

  describe('Pre-configured Models', () => {
    it('should have all pre-configured text models', async () => {
      // Test that all pre-configured models exist and have correct properties
      expect(voyage.large.modelId).toBe('voyage-3-large');
      expect(voyage.v35.modelId).toBe('voyage-3.5');
      expect(voyage.v35lite.modelId).toBe('voyage-3.5-lite');
      expect(voyage.code.modelId).toBe('voyage-code-3');
      expect(voyage.finance.modelId).toBe('voyage-finance-2');
      expect(voyage.law.modelId).toBe('voyage-law-2');
    });

    it('should have V2 versions of models', () => {
      expect(voyage.largeV2.specificationVersion).toBe('v2');
      expect(voyage.v35V2.specificationVersion).toBe('v2');
      expect(voyage.codeV2.specificationVersion).toBe('v2');
    });

    it('should have multimodal models', () => {
      expect(voyage.multimodal.modelId).toBe('voyage-multimodal-3.5');
      expect(voyage.multimodal3.modelId).toBe('voyage-multimodal-3');
      expect(voyage.multimodal35.modelId).toBe('voyage-multimodal-3.5');
    });

    it('should have contextualized model', () => {
      expect(voyage.contextualized.modelId).toBe('voyage-context-3');
      expect(voyage.context3.modelId).toBe('voyage-context-3');
    });
  });

  describe('Runtime Provider Options', () => {
    it('should allow runtime override of options', async () => {
      // Create model with default 1024 dimensions
      const model = voyageEmbedding('voyage-3.5');

      // Override to 512 dimensions at runtime
      const result = await model.doEmbed({
        values: ['Test runtime options'],
        providerOptions: {
          voyage: {
            outputDimension: 512,
          },
        },
      });

      expect(result.embeddings[0]!.length).toBe(512);
    });
  });

  // Multimodal tests require images, so they're more complex
  describe('Multimodal Embeddings', () => {
    it('should create multimodal model', () => {
      const model = voyageMultimodalEmbedding('voyage-multimodal-3.5');
      expect(model.modelId).toBe('voyage-multimodal-3.5');
    });

    // Actual multimodal embedding tests would require test images
    // which we skip in automated tests
  });

  describe('Contextualized Embeddings', () => {
    it('should create contextualized model', () => {
      const model = voyageContextualizedEmbedding('voyage-context-3');
      expect(model.modelId).toBe('voyage-context-3');
    });

    it('should embed document chunks with context', async () => {
      const model = voyageContextualizedEmbedding('voyage-context-3');

      const result = await model.doEmbed({
        values: [['This is the first paragraph of document one.', 'This is the second paragraph.']],
        inputType: 'document',
      });

      // Should return 2 embeddings (one per chunk)
      expect(result.embeddings).toHaveLength(2);
      expect(result.chunkCounts).toEqual([2]);
    });

    it('should embed query with contextualized model', async () => {
      const model = voyageContextualizedEmbedding('voyage-context-3');

      const embedding = await model.embedQuery('What is the main topic?');

      expect(embedding).toBeInstanceOf(Array);
      expect(embedding.length).toBe(1024);
    });

    it('should support custom dimensions for contextualized embeddings', async () => {
      const model = voyageContextualizedEmbedding({
        model: 'voyage-context-3',
        outputDimension: 512,
      });

      const result = await model.doEmbed({
        values: [['Single chunk for testing']],
        inputType: 'document',
      });

      expect(result.embeddings[0]!.length).toBe(512);
    });
  });

  describe('Reranker', () => {
    it('should create reranker with default model', () => {
      const reranker = voyageReranker('rerank-2.5');
      expect(reranker.modelId).toBe('rerank-2.5');
    });

    it('should have pre-configured reranker models', () => {
      expect(voyage.reranker.modelId).toBe('rerank-2.5');
      expect(voyage.reranker25.modelId).toBe('rerank-2.5');
      expect(voyage.reranker25lite.modelId).toBe('rerank-2.5-lite');
      expect(voyage.reranker2.modelId).toBe('rerank-2');
      expect(voyage.reranker2lite.modelId).toBe('rerank-2-lite');
    });

    it('should get relevance score for single document', async () => {
      const reranker = createVoyageReranker('rerank-2.5');

      const score = await reranker.getRelevanceScore(
        'What is the capital of France?',
        'Paris is the capital and largest city of France.',
      );

      expect(typeof score).toBe('number');
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should rerank multiple documents', async () => {
      const reranker = voyage.reranker;

      const results = await reranker.rerankDocuments(
        'What is machine learning?',
        [
          'Machine learning is a subset of artificial intelligence that enables systems to learn from data.',
          'The weather today is sunny with a high of 75 degrees.',
          'Deep learning is a type of machine learning based on neural networks.',
        ],
        2,
      );

      expect(results).toHaveLength(2);
      expect(results[0]!.score).toBeGreaterThan(results[1]!.score);
      // The ML-related documents should rank higher than the weather document
      expect(
        results.every(r => r.document !== 'The weather today is sunny with a high of 75 degrees.'),
      ).toBe(true);
    });

    it('should work with rerank-2.5-lite model', async () => {
      const reranker = createVoyageReranker('rerank-2.5-lite');

      const score = await reranker.getRelevanceScore(
        'Python programming',
        'Python is a high-level programming language known for its simplicity.',
      );

      expect(typeof score).toBe('number');
      expect(score).toBeGreaterThan(0);
    });

    it('should return documents in relevance order', async () => {
      const reranker = voyage.reranker;

      const documents = [
        'Cats are popular pets.',
        'Dogs are loyal companions.',
        'The capital of Japan is Tokyo.',
        'Birds can fly.',
      ];

      const results = await reranker.rerankDocuments('What is the capital of Japan?', documents);

      // Tokyo document should be first
      expect(results[0]!.document).toBe('The capital of Japan is Tokyo.');
      expect(results[0]!.score).toBeGreaterThan(0.5);
    });

    it('should have createReranker factory on voyage object', () => {
      const reranker = voyage.createReranker({ model: 'rerank-2', truncation: false });
      expect(reranker.modelId).toBe('rerank-2');
    });
  });
});
