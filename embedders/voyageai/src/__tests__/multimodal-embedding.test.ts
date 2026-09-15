import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VoyageMultimodalEmbeddingModel } from '../multimodal-embedding';

const mockMultimodalEmbed = vi.fn();
const mockConstructor = vi.fn();

vi.mock('voyageai', () => {
  return {
    VoyageAIClient: class MockVoyageAIClient {
      constructor(opts: any) {
        mockConstructor(opts);
      }
      multimodalEmbed = mockMultimodalEmbed;
    },
  };
});

const originalEnv = process.env;

describe('VoyageMultimodalEmbeddingModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, VOYAGE_API_KEY: 'test-api-key' };
    mockMultimodalEmbed.mockResolvedValue({ data: [{ index: 0, embedding: [0.1, 0.2, 0.3] }] });
  });
  afterEach(() => {
    process.env = originalEnv;
  });

  it('wraps each input as an object with a content array (not a bare array)', async () => {
    const model = new VoyageMultimodalEmbeddingModel({ model: 'voyage-multimodal-3.5' });
    await model.doEmbed({ values: [{ content: [{ type: 'text', text: 'a photo of a cat' }] }] });

    const sent = mockMultimodalEmbed.mock.calls[0][0];
    expect(sent.inputs).toEqual([{ content: [{ type: 'text', text: 'a photo of a cat' }] }]);
  });

  it('serializes text content as a typed object, never a bare string', async () => {
    const model = new VoyageMultimodalEmbeddingModel({ model: 'voyage-multimodal-3.5' });
    await model.doEmbed({ values: [{ content: [{ type: 'text', text: 'hello' }] }] });

    const sent = mockMultimodalEmbed.mock.calls[0][0];
    const firstContent = sent.inputs[0].content[0];
    expect(typeof firstContent).toBe('object');
    expect(firstContent).toMatchObject({ type: 'text', text: 'hello' });
  });

  it('passes baseUrl through to the VoyageAIClient when provided', () => {
    new VoyageMultimodalEmbeddingModel({
      model: 'voyage-multimodal-3.5',
      apiKey: 'custom-key',
      baseUrl: 'https://ai.mongodb.com/v1',
    });
    expect(mockConstructor).toHaveBeenCalledWith({ apiKey: 'custom-key', baseUrl: 'https://ai.mongodb.com/v1' });
  });

  it('omits baseUrl from client options when not provided', () => {
    new VoyageMultimodalEmbeddingModel({ model: 'voyage-multimodal-3.5', apiKey: 'custom-key' });
    expect(mockConstructor).toHaveBeenCalledWith({ apiKey: 'custom-key' });
  });
});
