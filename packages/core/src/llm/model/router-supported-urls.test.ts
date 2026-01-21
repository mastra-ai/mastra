import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ModelRouterLanguageModel } from './router';
import * as gatewaysModule from './gateways/index';

/**
 * Test for GitHub Issue #12152: Mistral OCR with Mastra errors
 *
 * Problem: When using Mistral with PDF files via URL, the URL is downloaded
 * and raw bytes are sent to Mistral instead of the URL itself.
 *
 * Root cause: ModelRouterLanguageModel has hardcoded `supportedUrls = {}`,
 * which means it doesn't inherit the supportedUrls from the underlying model.
 *
 * The Mistral SDK defines:
 *   supportedUrls: { "application/pdf": [/^https:\/\/.*$/] }
 *
 * But ModelRouterLanguageModel ignores this, so Mastra downloads the PDF
 * instead of passing the URL directly to Mistral.
 */
describe('ModelRouterLanguageModel - supportedUrls propagation (Issue #12152)', () => {
  // Mock Mistral's supportedUrls (same as what the real Mistral SDK defines)
  const mockMistralSupportedUrls = {
    'application/pdf': [/^https:\/\/.*$/],
  };

  // Mock model that simulates Mistral's behavior
  const mockMistralModel = {
    specificationVersion: 'v2',
    provider: 'mistral',
    modelId: 'mistral-large-latest',
    supportedUrls: mockMistralSupportedUrls,
    doGenerate: vi.fn(),
    doStream: vi.fn(),
  };

  // Mock gateway
  const mockGateway = {
    id: 'models.dev',
    getApiKey: vi.fn().mockResolvedValue('mock-api-key'),
    resolveLanguageModel: vi.fn().mockResolvedValue(mockMistralModel),
  };

  beforeEach(() => {
    // Clear any cached model instances
    (ModelRouterLanguageModel as any).modelInstances?.clear?.();

    // Mock findGatewayForModel to return our mock gateway
    vi.spyOn(gatewaysModule, 'findGatewayForModel').mockReturnValue(mockGateway as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should expose supportedUrls from the underlying Mistral model', async () => {
    // Create a ModelRouterLanguageModel for Mistral
    const model = new ModelRouterLanguageModel('mistral/mistral-large-latest');

    // The fix: supportedUrls should now be a Promise that resolves to Mistral's supportedUrls
    const supportedUrls = model.supportedUrls;

    // supportedUrls should be a PromiseLike
    expect(typeof (supportedUrls as any)?.then).toBe('function');

    // Await the supportedUrls
    const resolvedUrls = await supportedUrls;

    // This is what we EXPECT: Mistral supports PDF URLs
    // The Mistral SDK defines: supportedUrls: { "application/pdf": [/^https:\/\/.*$/] }
    expect(resolvedUrls).toHaveProperty('application/pdf');
    expect(resolvedUrls['application/pdf']).toBeDefined();
    expect(resolvedUrls['application/pdf'].length).toBeGreaterThan(0);

    // Verify the pattern matches HTTPS URLs
    const pdfPatterns = resolvedUrls['application/pdf'];
    expect(pdfPatterns.some((pattern: RegExp) => pattern.test('https://example.com/document.pdf'))).toBe(true);
  });

  it('should NOT download PDF URLs when Mistral supports them natively', async () => {
    const model = new ModelRouterLanguageModel('mistral/mistral-large-latest');

    // Get the supportedUrls
    const resolvedUrls = await model.supportedUrls;

    // This URL should be supported by Mistral (not downloaded)
    const pdfUrl = 'https://storage.example.com/signed-url/document.pdf?token=abc123';

    // Check if the URL is supported
    const pdfPatterns = resolvedUrls['application/pdf'] || [];
    const isSupported = pdfPatterns.some((pattern: RegExp) => pattern.test(pdfUrl.toLowerCase()));

    // This SHOULD be true - Mistral supports HTTPS URLs for PDFs
    expect(isSupported).toBe(true);
  });

  it('should cache the supportedUrls promise to avoid multiple resolutions', async () => {
    const model = new ModelRouterLanguageModel('mistral/mistral-large-latest');

    // Call supportedUrls multiple times
    const promise1 = model.supportedUrls;
    const promise2 = model.supportedUrls;

    // Both should resolve to the same result
    const [result1, result2] = await Promise.all([promise1, promise2]);

    expect(result1).toEqual(result2);
    expect(result1).toHaveProperty('application/pdf');
  });

  it('should return empty object when API key resolution fails', async () => {
    // Mock gateway to throw an error when getting API key
    mockGateway.getApiKey.mockRejectedValueOnce(new Error('API key not found'));

    const model = new ModelRouterLanguageModel('unknown/unknown-model');

    // Should gracefully return empty object instead of throwing
    const resolvedUrls = await model.supportedUrls;

    expect(resolvedUrls).toEqual({});
  });

  it('should handle models that have supportedUrls as a Promise', async () => {
    // Some models might return supportedUrls as a Promise
    const mockModelWithPromiseSupportedUrls = {
      ...mockMistralModel,
      supportedUrls: Promise.resolve(mockMistralSupportedUrls),
    };
    mockGateway.resolveLanguageModel.mockResolvedValueOnce(mockModelWithPromiseSupportedUrls);

    const model = new ModelRouterLanguageModel('mistral/mistral-large-latest');
    const resolvedUrls = await model.supportedUrls;

    expect(resolvedUrls).toHaveProperty('application/pdf');
  });

  it('should NOT match URLs that do not fit the supportedUrls patterns', async () => {
    const model = new ModelRouterLanguageModel('mistral/mistral-large-latest');
    const resolvedUrls = await model.supportedUrls;

    // Mistral only supports HTTPS for PDFs, not HTTP
    const httpUrl = 'http://example.com/document.pdf';
    const pdfPatterns = resolvedUrls['application/pdf'] || [];
    const isHttpSupported = pdfPatterns.some((pattern: RegExp) => pattern.test(httpUrl));

    // HTTP should NOT be supported (Mistral pattern is /^https:\/\/.*$/)
    expect(isHttpSupported).toBe(false);

    // Image URLs should not match PDF patterns
    const imageUrl = 'https://example.com/image.png';
    const imagePatterns = resolvedUrls['image/*'] || resolvedUrls['image/png'] || [];
    expect(imagePatterns.length).toBe(0); // Mistral doesn't support images via URL
  });

  it('should return empty object when model has no supportedUrls defined', async () => {
    const mockModelWithoutSupportedUrls = {
      specificationVersion: 'v2',
      provider: 'custom',
      modelId: 'custom-model',
      supportedUrls: undefined,
      doGenerate: vi.fn(),
      doStream: vi.fn(),
    };
    mockGateway.resolveLanguageModel.mockResolvedValueOnce(mockModelWithoutSupportedUrls);

    const model = new ModelRouterLanguageModel('custom/custom-model');
    const resolvedUrls = await model.supportedUrls;

    expect(resolvedUrls).toEqual({});
  });

  it('should return empty object when model resolution fails', async () => {
    mockGateway.resolveLanguageModel.mockRejectedValueOnce(new Error('Model not found'));

    const model = new ModelRouterLanguageModel('unknown/unknown-model');
    const resolvedUrls = await model.supportedUrls;

    // Should gracefully return empty object instead of throwing
    expect(resolvedUrls).toEqual({});
  });

  it('should handle wildcard media types like image/*', async () => {
    // OpenAI/Anthropic use "image/*" pattern for all image types
    const mockOpenAISupportedUrls = {
      'image/*': [/^https?:\/\/.*$/],
    };
    const mockOpenAIModel = {
      specificationVersion: 'v2',
      provider: 'openai',
      modelId: 'gpt-4o',
      supportedUrls: mockOpenAISupportedUrls,
      doGenerate: vi.fn(),
      doStream: vi.fn(),
    };
    mockGateway.resolveLanguageModel.mockResolvedValueOnce(mockOpenAIModel);

    const model = new ModelRouterLanguageModel('openai/gpt-4o');
    const resolvedUrls = await model.supportedUrls;

    expect(resolvedUrls).toHaveProperty('image/*');

    // Should match both HTTP and HTTPS image URLs
    const imagePatterns = resolvedUrls['image/*'];
    expect(imagePatterns.some((pattern: RegExp) => pattern.test('https://example.com/image.png'))).toBe(true);
    expect(imagePatterns.some((pattern: RegExp) => pattern.test('http://example.com/image.jpg'))).toBe(true);
  });

  it('should respect HTTP vs HTTPS distinction across providers', async () => {
    // Mistral only supports HTTPS
    const model = new ModelRouterLanguageModel('mistral/mistral-large-latest');
    const mistralUrls = await model.supportedUrls;

    const pdfPatterns = mistralUrls['application/pdf'] || [];

    // HTTPS should be supported
    expect(pdfPatterns.some((pattern: RegExp) => pattern.test('https://example.com/doc.pdf'))).toBe(true);

    // HTTP should NOT be supported by Mistral
    expect(pdfPatterns.some((pattern: RegExp) => pattern.test('http://example.com/doc.pdf'))).toBe(false);
  });

  it('should handle OpenAI response models with both image and PDF support', async () => {
    // OpenAI response models support both images and PDFs
    const mockOpenAIResponseSupportedUrls = {
      'image/*': [/^https?:\/\/.*$/],
      'application/pdf': [/^https?:\/\/.*$/],
    };
    const mockOpenAIResponseModel = {
      specificationVersion: 'v2',
      provider: 'openai',
      modelId: 'gpt-4o',
      supportedUrls: mockOpenAIResponseSupportedUrls,
      doGenerate: vi.fn(),
      doStream: vi.fn(),
    };
    mockGateway.resolveLanguageModel.mockResolvedValueOnce(mockOpenAIResponseModel);

    const model = new ModelRouterLanguageModel('openai/gpt-4o');
    const resolvedUrls = await model.supportedUrls;

    // Should have both image and PDF support
    expect(resolvedUrls).toHaveProperty('image/*');
    expect(resolvedUrls).toHaveProperty('application/pdf');

    // Both should support HTTP and HTTPS
    expect(resolvedUrls['image/*'].some((p: RegExp) => p.test('https://example.com/img.png'))).toBe(true);
    expect(resolvedUrls['application/pdf'].some((p: RegExp) => p.test('https://example.com/doc.pdf'))).toBe(true);
  });
});
