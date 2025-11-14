import { describe, expect, beforeEach, it, vi } from 'vitest';
import { MastraClient } from '../client';

// Mock fetch globally
global.fetch = vi.fn();

describe('Vector Resource', () => {
  let client: MastraClient;
  const clientOptions = {
    baseUrl: 'http://localhost:4111',
    headers: {
      Authorization: 'Bearer test-key',
      'x-mastra-client-type': 'js',
    },
  };

  // Helper to mock successful API responses
  const mockFetchResponse = (data: any, options: { isStream?: boolean } = {}) => {
    if (options.isStream) {
      let contentType = 'text/event-stream';
      let responseBody: ReadableStream;

      if (data instanceof ReadableStream) {
        responseBody = data;
        contentType = 'audio/mp3';
      } else {
        responseBody = new ReadableStream({
          start(controller) {
            if (typeof data === 'string') {
              controller.enqueue(new TextEncoder().encode(data));
            } else if (typeof data === 'object' && data !== null) {
              controller.enqueue(new TextEncoder().encode(JSON.stringify(data)));
            } else {
              controller.enqueue(new TextEncoder().encode(String(data)));
            }
            controller.close();
          },
        });
      }

      const headers = new Headers();
      if (contentType === 'audio/mp3') {
        headers.set('Transfer-Encoding', 'chunked');
      }
      headers.set('Content-Type', contentType);

      (global.fetch as any).mockResolvedValueOnce(
        new Response(responseBody, {
          status: 200,
          statusText: 'OK',
          headers,
        }),
      );
    } else {
      const response = new Response(undefined, {
        status: 200,
        statusText: 'OK',
        headers: new Headers({
          'Content-Type': 'application/json',
        }),
      });
      response.json = () => Promise.resolve(data);
      (global.fetch as any).mockResolvedValueOnce(response);
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    client = new MastraClient(clientOptions);
  });

  const vectorName = 'test-vector';
  let vector: ReturnType<typeof client.getVector>;

  beforeEach(() => {
    vector = client.getVector(vectorName);
  });

  it('should get vector index details', async () => {
    const mockResponse = {
      dimension: 128,
      metric: 'cosine',
      count: 1000,
    };
    mockFetchResponse(mockResponse);

    const result = await vector.details('test-index');
    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      `${clientOptions.baseUrl}/api/vector/test-vector/indexes/test-index`,
      expect.objectContaining({
        headers: expect.objectContaining(clientOptions.headers),
      }),
    );
  });

  it('should delete vector index', async () => {
    mockFetchResponse({ success: true });
    const result = await vector.delete('test-index');
    expect(result).toEqual({ success: true });
    expect(global.fetch).toHaveBeenCalledWith(
      `${clientOptions.baseUrl}/api/vector/test-vector/indexes/test-index`,
      expect.objectContaining({
        method: 'DELETE',
        headers: expect.objectContaining(clientOptions.headers),
      }),
    );
  });

  it('should get all indexes', async () => {
    const mockResponse = { indexes: ['index1', 'index2'] };
    mockFetchResponse(mockResponse);
    const result = await vector.getIndexes();
    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      `${clientOptions.baseUrl}/api/vector/test-vector/indexes`,
      expect.objectContaining({
        headers: expect.objectContaining(clientOptions.headers),
      }),
    );
  });

  it('should create vector index with all parameters', async () => {
    mockFetchResponse({ success: true });
    const result = await vector.createIndex({
      indexName: 'test-index',
      dimension: 128,
      metric: 'cosine',
    });
    expect(result).toEqual({ success: true });
    expect(global.fetch).toHaveBeenCalledWith(
      `${clientOptions.baseUrl}/api/vector/test-vector/create-index`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining(clientOptions.headers),
        body: JSON.stringify({
          indexName: 'test-index',
          dimension: 128,
          metric: 'cosine',
        }),
      }),
    );
  });

  it('should upsert vectors with metadata and ids', async () => {
    const mockResponse = ['id1', 'id2'];
    mockFetchResponse(mockResponse);
    const result = await vector.upsert({
      indexName: 'test-index',
      vectors: [
        [1, 2],
        [3, 4],
      ],
      metadata: [{ label: 'a' }, { label: 'b' }],
      ids: ['id1', 'id2'],
    });
    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      `${clientOptions.baseUrl}/api/vector/test-vector/upsert`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining(clientOptions.headers),
        body: JSON.stringify({
          indexName: 'test-index',
          vectors: [
            [1, 2],
            [3, 4],
          ],
          metadata: [{ label: 'a' }, { label: 'b' }],
          ids: ['id1', 'id2'],
        }),
      }),
    );
  });

  it('should query vectors with all parameters', async () => {
    const mockResponse = {
      results: [
        {
          id: 'id1',
          score: 0.9,
          metadata: { label: 'a' },
          vector: [1, 2],
        },
      ],
    };
    mockFetchResponse(mockResponse);
    const result = await vector.query({
      indexName: 'test-index',
      queryVector: [1, 2],
      topK: 10,
      filter: { label: 'a' },
      includeVector: true,
    });
    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      `${clientOptions.baseUrl}/api/vector/test-vector/query`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining(clientOptions.headers),
        body: JSON.stringify({
          indexName: 'test-index',
          queryVector: [1, 2],
          topK: 10,
          filter: { label: 'a' },
          includeVector: true,
        }),
      }),
    );
  });
});
