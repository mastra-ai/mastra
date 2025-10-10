import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { ErrorDomain, ErrorCategory, MastraError } from '../../../error';
import { fetchWithRetry } from '../../../utils';
import { downloadFromUrl } from './download-assets';

vi.mock('../../../utils', () => ({
  fetchWithRetry: vi.fn(),
}));

// Helper constants and functions
const DEFAULT_RETRIES = 3;
const makeTestUrl = () => new URL('https://example.com/image.jpg');

const expectFetchCalledOnceWithGet = (url: URL, retries = DEFAULT_RETRIES) => {
  expect(fetchWithRetry).toHaveBeenCalledWith(url.toString(), { method: 'GET' }, retries);
};

const makeSuccessfulResponse = (data: Uint8Array, mediaType: string | null) => {
  const headers = { get: (name: string) => (name.toLowerCase() === 'content-type' ? mediaType : null) };
  return {
    ok: true,
    arrayBuffer: vi.fn().mockResolvedValue(data.buffer),
    headers,
  } as any;
};

describe('downloadFromUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.restoreAllMocks();
  });

  it('should return data and mediaType on successful download', async () => {
    // Arrange: Create mock binary data and successful response
    const testData = new Uint8Array([1, 2, 3, 4]);
    const testMediaType = 'image/jpeg';
    const testUrl = makeTestUrl();
    const response = makeSuccessfulResponse(testData, testMediaType);

    (fetchWithRetry as any).mockResolvedValue(response);

    // Act: Call downloadFromUrl with test parameters
    const result = await downloadFromUrl({
      url: testUrl,
      downloadRetries: DEFAULT_RETRIES,
    });

    // Assert: Verify returned data and mediaType
    expect(result.data).toEqual(testData);
    expect(result.mediaType).toBe(testMediaType);
    expectFetchCalledOnceWithGet(testUrl);
  });

  it('should return undefined mediaType when content-type header is missing', async () => {
    // Arrange: Create test URL and response with missing content-type
    const testData = new Uint8Array([1, 2, 3, 4]);
    const testUrl = makeTestUrl();
    const response = makeSuccessfulResponse(testData, null);

    (fetchWithRetry as any).mockResolvedValue(response);

    // Act: Call downloadFromUrl with test parameters
    const result = await downloadFromUrl({
      url: testUrl,
      downloadRetries: DEFAULT_RETRIES,
    });

    // Assert: Verify data matches and mediaType is undefined
    expect(result.data).toEqual(testData);
    expect(result.mediaType).toBeUndefined();
    expect(fetchWithRetry).toHaveBeenCalledWith(testUrl.toString(), { method: 'GET' }, DEFAULT_RETRIES);
  });

  it('should throw MastraError with id DOWNLOAD_ASSETS_FAILED, domain LLM, and category USER when response is not ok', async () => {
    // Arrange: Create failed response
    const testUrl = makeTestUrl();
    const response = { ok: false } as any;

    (fetchWithRetry as any).mockResolvedValue(response);

    // Assert rejection and error properties in a single assertion
    await expect(
      downloadFromUrl({
        url: testUrl,
        downloadRetries: DEFAULT_RETRIES,
      }),
    ).rejects.toMatchObject({
      id: 'DOWNLOAD_ASSETS_FAILED',
      domain: ErrorDomain.LLM,
      category: ErrorCategory.USER,
    });

    expectFetchCalledOnceWithGet(testUrl);
  });

  it('should wrap fetchWithRetry errors in MastraError', async () => {
    // Arrange: Create test URL and error
    const testUrl = makeTestUrl();
    const originalError = new Error('Network error');
    (fetchWithRetry as any).mockRejectedValue(originalError);

    // Act & Assert: Call downloadFromUrl and verify error properties
    try {
      await downloadFromUrl({
        url: testUrl,
        downloadRetries: DEFAULT_RETRIES,
      });
      fail('Expected downloadFromUrl to throw an error');
    } catch (error) {
      expect(error).toBeInstanceOf(MastraError);
      expect(error).toMatchObject({
        id: 'DOWNLOAD_ASSETS_FAILED',
        domain: ErrorDomain.LLM,
        category: ErrorCategory.USER,
      });
      expect(error.cause).toBe(originalError);
    }

    // Assert: Verify fetchWithRetry was called correctly
    expect(fetchWithRetry).toHaveBeenCalledWith(testUrl.toString(), { method: 'GET' }, DEFAULT_RETRIES);
  });
});
