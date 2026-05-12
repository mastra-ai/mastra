import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  VoyageTextEmbeddingModelV2,
  VoyageTextEmbeddingModelV3,
  createVoyageTextEmbedding,
  createVoyageTextEmbeddingV2,
} from '../text-embedding';

// Mock functions
const mockEmbed = vi.fn();
const mockTokenize = vi.fn();
const mockConstructor = vi.fn();

// Mock the voyageai module
vi.mock('voyageai', () => {
  return {
    VoyageAIClient: class MockVoyageAIClient {
      constructor(opts: any) { mockConstructor(opts); }
      embed = mockEmbed;
      tokenize = mockTokenize;
    },
  };
});

describe('VoyageTextEmbeddingModelV2', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, VOYAGE_API_KEY: 'test-api-key' };
    // Default tokenize mock: returns 5 tokens per text
    mockTokenize.mockImplementation((texts: string[]) =>
      Promise.resolve(texts.map(() => ({ tokens: ['a', 'b', 'c', 'd', 'e'], ids: [1, 2, 3, 4, 5] }))),
    );
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should create model with default config', () => {
    const model = new VoyageTextEmbeddingModelV2({ model: 'voyage-3.5' });

    expect(model.specificationVersion).toBe('v2');
    expect(model.provider).toBe('voyage');
    expect(model.modelId).toBe('voyage-3.5');
    expect(model.maxEmbeddingsPerCall).toBe(1000);
    expect(model.supportsParallelCalls).toBe(true);
  });

  it('should use API key from config over environment', () => {
    const model = new VoyageTextEmbeddingModelV2({
      model: 'voyage-3.5',
      apiKey: 'custom-key',
    });

    expect(model.modelId).toBe('voyage-3.5');
    expect(mockConstructor).toHaveBeenCalledWith({ apiKey: 'custom-key' });
  });

  it('should throw error if no API key is available', () => {
    delete process.env.VOYAGE_API_KEY;

    expect(() => new VoyageTextEmbeddingModelV2({ model: 'voyage-3.5' })).toThrow(
      'VoyageAI API key is required',
    );
  });

  it('should generate embeddings', async () => {
    mockEmbed.mockResolvedValue({
      data: [
        { embedding: [0.1, 0.2, 0.3], index: 0 },
        { embedding: [0.4, 0.5, 0.6], index: 1 },
      ],
      model: 'voyage-3.5',
      usage: { total_tokens: 10 },
    });

    const model = new VoyageTextEmbeddingModelV2({ model: 'voyage-3.5' });
    const result = await model.doEmbed({ values: ['hello', 'world'] });

    expect(result.embeddings).toHaveLength(2);
    expect(result.embeddings[0]).toEqual([0.1, 0.2, 0.3]);
    expect(result.embeddings[1]).toEqual([0.4, 0.5, 0.6]);
  });

  it('should pass VoyageAI-specific options to SDK', async () => {
    mockEmbed.mockResolvedValue({
      data: [{ embedding: [0.1], index: 0 }],
    });

    const model = new VoyageTextEmbeddingModelV2({
      model: 'voyage-3.5',
      inputType: 'query',
      outputDimension: 512,
      outputDtype: 'float',
      truncation: false,
    });

    await model.doEmbed({ values: ['test'] });

    expect(mockEmbed).toHaveBeenCalledWith(
      expect.objectContaining({
        input: ['test'],
        model: 'voyage-3.5',
        inputType: 'query',
        outputDimension: 512,
        outputDtype: 'float',
        truncation: false,
      }),
    );
  });

  it('should allow providerOptions to override config', async () => {
    mockEmbed.mockResolvedValue({
      data: [{ embedding: [0.1], index: 0 }],
    });

    const model = new VoyageTextEmbeddingModelV2({
      model: 'voyage-3.5',
      inputType: 'document',
      outputDimension: 1024,
    });

    await model.doEmbed({
      values: ['test'],
      providerOptions: {
        voyage: {
          inputType: 'query',
          outputDimension: 256,
        },
      },
    });

    expect(mockEmbed).toHaveBeenCalledWith(
      expect.objectContaining({
        inputType: 'query',
        outputDimension: 256,
      }),
    );
  });

  it('should sort embeddings by index', async () => {
    mockEmbed.mockResolvedValue({
      data: [
        { embedding: [0.3], index: 2 },
        { embedding: [0.1], index: 0 },
        { embedding: [0.2], index: 1 },
      ],
    });

    const model = new VoyageTextEmbeddingModelV2({ model: 'voyage-3.5' });
    const result = await model.doEmbed({ values: ['a', 'b', 'c'] });

    expect(result.embeddings).toEqual([[0.1], [0.2], [0.3]]);
  });

  it('should split into multiple batches when tokens exceed model limit', async () => {
    // Each text has 200000 tokens, voyage-3.5 limit is 320000
    // So 2 texts = 400000 tokens > 320000, needs 2 batches
    mockTokenize.mockImplementation((texts: string[]) =>
      Promise.resolve(texts.map(() => ({ tokens: new Array(200000), ids: new Array(200000) }))),
    );

    mockEmbed
      .mockResolvedValueOnce({
        data: [{ embedding: [0.1], index: 0 }],
      })
      .mockResolvedValueOnce({
        data: [{ embedding: [0.2], index: 0 }],
      });

    const model = new VoyageTextEmbeddingModelV2({ model: 'voyage-3.5' });
    const result = await model.doEmbed({ values: ['text1', 'text2'] });

    expect(mockEmbed).toHaveBeenCalledTimes(2);
    expect(result.embeddings).toEqual([[0.1], [0.2]]);
  });

  it('should send all texts in one batch when tokens are within limit', async () => {
    // Each text has 100 tokens, voyage-3.5 limit is 320000
    mockTokenize.mockImplementation((texts: string[]) =>
      Promise.resolve(texts.map(() => ({ tokens: new Array(100), ids: new Array(100) }))),
    );

    mockEmbed.mockResolvedValue({
      data: [
        { embedding: [0.1], index: 0 },
        { embedding: [0.2], index: 1 },
      ],
    });

    const model = new VoyageTextEmbeddingModelV2({ model: 'voyage-3.5' });
    const result = await model.doEmbed({ values: ['text1', 'text2'] });

    expect(mockEmbed).toHaveBeenCalledTimes(1);
    expect(result.embeddings).toEqual([[0.1], [0.2]]);
  });
});

describe('VoyageTextEmbeddingModelV3', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.VOYAGE_API_KEY = 'test-api-key';
    mockTokenize.mockImplementation((texts: string[]) =>
      Promise.resolve(texts.map(() => ({ tokens: ['a'], ids: [1] }))),
    );
  });

  it('should have v3 specification version', () => {
    const model = new VoyageTextEmbeddingModelV3({ model: 'voyage-3.5' });

    expect(model.specificationVersion).toBe('v3');
    expect(model.provider).toBe('voyage');
    expect(model.modelId).toBe('voyage-3.5');
  });

  it('should return warnings array in result', async () => {
    mockEmbed.mockResolvedValue({
      data: [{ embedding: [0.1, 0.2], index: 0 }],
    });

    const model = new VoyageTextEmbeddingModelV3({ model: 'voyage-3.5' });
    const result = await model.doEmbed({ values: ['test'] });

    expect(result.embeddings).toHaveLength(1);
    expect(result.warnings).toEqual([]);
  });
});

describe('Factory functions', () => {
  beforeEach(() => {
    process.env.VOYAGE_API_KEY = 'test-api-key';
  });

  it('createVoyageTextEmbedding should create V3 model from string', () => {
    const model = createVoyageTextEmbedding('voyage-3-large');

    expect(model.specificationVersion).toBe('v3');
    expect(model.modelId).toBe('voyage-3-large');
  });

  it('createVoyageTextEmbedding should create V3 model from config', () => {
    const model = createVoyageTextEmbedding({
      model: 'voyage-code-3',
      inputType: 'document',
    });

    expect(model.specificationVersion).toBe('v3');
    expect(model.modelId).toBe('voyage-code-3');
  });

  it('createVoyageTextEmbeddingV2 should create V2 model', () => {
    const model = createVoyageTextEmbeddingV2('voyage-3.5');

    expect(model.specificationVersion).toBe('v2');
    expect(model.modelId).toBe('voyage-3.5');
  });
});
