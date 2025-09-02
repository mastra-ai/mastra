import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { RelevanceScoreProvider } from '../relevance-score-provider';
import { CohereRelevanceScorer } from '.';

describe('CohereRelevanceScorer', () => {
  const TEST_API_KEY = 'test-api-key';
  const TEST_MODEL = 'test-model';
  const TEST_QUERY = 'test query';
  const TEST_TEXT = 'test document text';

  let scorer: RelevanceScoreProvider;
  let lastRequest: { body: any; headers: any; url: string } | null = null;
  let originalFetch: typeof fetch;

  const invalidResponseCases = [
    {
      name: 'empty results array',
      responseData: { results: [] },
    },
    {
      name: 'missing relevance_score',
      responseData: { results: [{ index: 0 }] },
    },
  ];

  beforeEach(() => {
    lastRequest = null;
    scorer = new CohereRelevanceScorer(TEST_MODEL, TEST_API_KEY);

    originalFetch = global.fetch;
    const mockFetch = vi.fn().mockImplementation(async (url: string, options?: RequestInit) => {
      const body = options?.body ? JSON.parse(options.body as string) : null;
      const headers = options?.headers || {};

      lastRequest = { url, body, headers };

      return new Response(JSON.stringify({ results: [{ relevance_score: 0.95 }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalFetch) {
      global.fetch = originalFetch;
    }
  });

  it('should make an API call with the correct request body containing the query, documents array with the provided text, model, and top_n set to 1', async () => {
    // Arrange: prepare test query and text

    // Act: call the getRelevanceScore method
    await scorer.getRelevanceScore(TEST_QUERY, TEST_TEXT);

    // Assert: verify the request body parameters
    expect(lastRequest?.body).toEqual({
      query: TEST_QUERY,
      documents: [TEST_TEXT],
      model: TEST_MODEL,
      top_n: 1,
    });
  });

  it('should include the Authorization header with the API key in Bearer token format when making the API call', async () => {
    // Arrange: prepare test query and text

    // Act: call the getRelevanceScore method
    await scorer.getRelevanceScore(TEST_QUERY, TEST_TEXT);

    // Assert: verify the request headers
    expect(lastRequest?.headers).toMatchObject({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TEST_API_KEY}`,
    });
  });

  it('should return the relevance score from a successful API response', async () => {
    // Arrange: Set up mock response with successful data
    const mockResponse = {
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        results: [
          {
            relevance_score: 0.8,
          },
        ],
      }),
      text: vi.fn().mockResolvedValue(''),
    };

    const mockFetch = vi.fn().mockResolvedValue(mockResponse);
    vi.stubGlobal('fetch', mockFetch);

    // Act: Call getRelevanceScore with test inputs
    const score = await scorer.getRelevanceScore(TEST_QUERY, TEST_TEXT);

    // Assert: Verify returned score matches configured value
    expect(score).toBe(0.8);
    expect(mockFetch).toHaveBeenCalledWith('https://api.cohere.com/v2/rerank', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TEST_API_KEY}`,
      },
      body: JSON.stringify({
        query: TEST_QUERY,
        documents: [TEST_TEXT],
        model: TEST_MODEL,
        top_n: 1,
      }),
    });
  });

  it('should throw an error when the API returns a non-ok response', async () => {
    // Arrange: Set up mock response with error
    const mockResponse = {
      ok: false,
      status: 400,
      text: vi.fn().mockResolvedValue('Bad Request'),
    };

    const mockFetch = vi.fn().mockResolvedValue(mockResponse);
    vi.stubGlobal('fetch', mockFetch);

    // Act & Assert: Verify error is thrown
    await expect(scorer.getRelevanceScore(TEST_QUERY, TEST_TEXT)).rejects.toThrowError();
  });

  it.each(invalidResponseCases)('should throw error for malformed response data: $name', async ({ responseData }) => {
    // Arrange: Create CohereRelevanceScorer instance with test model
    const scorer = new CohereRelevanceScorer('test-model', 'test-api-key');

    // Mock fetch to return malformed response
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(responseData),
    });

    // Act & Assert: Verify getRelevanceScore throws error for malformed data
    await expect(scorer.getRelevanceScore('test query', 'test text')).rejects.toThrow();
  });
});
