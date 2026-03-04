import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as gatewaysModule from './gateways/index';
import { ModelRouterLanguageModel } from './router';

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

  it('should propagate supportedUrls from the underlying model', async () => {
    const model = new ModelRouterLanguageModel('mistral/mistral-large-latest');

    // supportedUrls should be a PromiseLike (lazy resolution)
    expect(typeof (model.supportedUrls as any)?.then).toBe('function');

    const resolvedUrls = await model.supportedUrls;

    // Should have the same supportedUrls as the mock model
    expect(resolvedUrls).toEqual(mockMistralSupportedUrls);
  });

  it('should return empty object when API key resolution fails', async () => {
    mockGateway.getApiKey.mockRejectedValueOnce(new Error('API key not found'));

    const model = new ModelRouterLanguageModel('unknown/unknown-model');
    const resolvedUrls = await model.supportedUrls;

    // Should gracefully degrade, not throw
    expect(resolvedUrls).toEqual({});
  });

  it('should return empty object when model resolution fails', async () => {
    mockGateway.resolveLanguageModel.mockRejectedValueOnce(new Error('Model not found'));

    const model = new ModelRouterLanguageModel('unknown/unknown-model');
    const resolvedUrls = await model.supportedUrls;

    // Should gracefully degrade, not throw
    expect(resolvedUrls).toEqual({});
  });

  it('should return empty object when model has no supportedUrls', async () => {
    mockGateway.resolveLanguageModel.mockResolvedValueOnce({
      specificationVersion: 'v2',
      provider: 'custom',
      modelId: 'custom-model',
      supportedUrls: undefined,
      doGenerate: vi.fn(),
      doStream: vi.fn(),
    });

    const model = new ModelRouterLanguageModel('custom/custom-model');
    const resolvedUrls = await model.supportedUrls;

    expect(resolvedUrls).toEqual({});
  });

  it('should handle models where supportedUrls is a Promise', async () => {
    // AI SDK allows supportedUrls to be a PromiseLike
    mockGateway.resolveLanguageModel.mockResolvedValueOnce({
      ...mockMistralModel,
      supportedUrls: Promise.resolve(mockMistralSupportedUrls),
    });

    const model = new ModelRouterLanguageModel('mistral/mistral-large-latest');
    const resolvedUrls = await model.supportedUrls;

    expect(resolvedUrls).toEqual(mockMistralSupportedUrls);
  });

  it('should only resolve the underlying model once (caching)', async () => {
    const callCountBefore = mockGateway.resolveLanguageModel.mock.calls.length;

    const model = new ModelRouterLanguageModel('mistral/mistral-large-latest');

    // Access supportedUrls multiple times concurrently
    await Promise.all([model.supportedUrls, model.supportedUrls, model.supportedUrls]);

    // resolveLanguageModel should only be called once more (not 3 times)
    const callCountAfter = mockGateway.resolveLanguageModel.mock.calls.length;
    expect(callCountAfter - callCountBefore).toBe(1);
  });
});
