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
});
