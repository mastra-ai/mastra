import { createOpenAICompatible } from '@ai-sdk/openai-compatible-v5';
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import { MastraModelGateway } from '../llm/model/gateways/base';
import type { ProviderConfig } from '../llm/model/gateways/base';
import { Mastra } from '../mastra';
import { createScorer } from './base';

/**
 * Test gateway that simulates a custom enterprise gateway.
 * This is the type of gateway users would create internally.
 */
class CustomEnterpriseGateway extends MastraModelGateway {
  readonly id = 'enterprise';
  readonly name = 'Enterprise Gateway';

  async fetchProviders(): Promise<Record<string, ProviderConfig>> {
    return {
      'internal-llm': {
        name: 'Internal LLM Provider',
        models: ['fast-model', 'quality-model'],
        apiKeyEnvVar: 'ENTERPRISE_API_KEY',
        gateway: 'enterprise',
        url: 'https://internal-llm.enterprise.com/v1',
      },
    };
  }

  buildUrl(_modelId: string): string {
    return 'https://internal-llm.enterprise.com/v1';
  }

  async getApiKey(_modelId: string): Promise<string> {
    return process.env.ENTERPRISE_API_KEY || 'enterprise-test-key';
  }

  async resolveLanguageModel({
    modelId,
    providerId,
    apiKey,
    headers,
  }: {
    modelId: string;
    providerId: string;
    apiKey: string;
    headers?: Record<string, string>;
  }): Promise<LanguageModelV2> {
    const baseURL = this.buildUrl(`${providerId}/${modelId}`);
    return createOpenAICompatible({
      name: providerId,
      apiKey,
      baseURL,
      headers,
      supportsStructuredOutputs: true,
    }).chatModel(modelId);
  }
}

describe('Scorer Custom Gateway Integration - Issue #10745', () => {
  beforeEach(() => {
    process.env.ENTERPRISE_API_KEY = 'test-enterprise-key-123';
  });

  /**
   * This test demonstrates the bug reported in GitHub issue #10745.
   *
   * When a scorer uses a model string like 'enterprise/internal-llm/fast-model',
   * it should resolve using the custom gateway registered with Mastra.
   *
   * Currently this FAILS because:
   * 1. The scorer's executePromptStep calls resolveModelConfig(modelConfig) without passing the Mastra instance
   * 2. Without the Mastra instance, resolveModelConfig cannot access custom gateways
   * 3. The model resolution falls back to default gateways only
   *
   * Expected behavior: When a scorer is registered with Mastra (via addScorer),
   * it should have access to the Mastra instance's custom gateways.
   */
  it('should use custom gateway when scorer is registered with Mastra', async () => {
    // Setup: Create custom gateway and register with Mastra
    const customGateway = new CustomEnterpriseGateway();
    const mastra = new Mastra({
      gateways: {
        enterprise: customGateway,
      },
    });

    // Create a scorer that uses a model from the custom gateway
    // The model string 'enterprise/internal-llm/fast-model' should resolve via the custom gateway
    const scorer = createScorer({
      id: 'enterprise-quality-scorer',
      description: 'Scores using enterprise internal LLM',
      judge: {
        // This model string should be resolved using the custom gateway
        model: 'enterprise/internal-llm/fast-model',
        instructions: 'You are a quality scorer. Return a score between 0 and 1.',
      },
    })
      .analyze({
        description: 'Analyze the response quality',
        outputSchema: z.object({
          quality: z.number(),
          hasErrors: z.boolean(),
        }),
        createPrompt: ({ run }) => {
          return `Analyze this response for quality: ${JSON.stringify(run.output)}`;
        },
      })
      .generateScore(({ results }) => {
        const quality = results.analyzeStepResult?.quality ?? 0;
        return quality;
      });

    // Register scorer with Mastra - this should make custom gateways available
    mastra.addScorer(scorer, 'qualityScorer');

    // Get the scorer back from Mastra
    const registeredScorer = mastra.getScorer('qualityScorer');
    expect(registeredScorer).toBeDefined();

    // The actual test: When we run the scorer, it should be able to resolve
    // the model 'enterprise/internal-llm/fast-model' using the custom gateway.
    //
    // Currently this will throw an error like:
    // "Gateway with ID enterprise not found" or similar because the scorer
    // doesn't have access to the Mastra instance's custom gateways.
    //
    // After the fix, this should either:
    // 1. Successfully resolve the model (in a real scenario with working API)
    // 2. Fail at the API call level, not at gateway resolution level

    // After the fix, the scorer should be able to resolve the model using the custom gateway.
    // The error we get should be from the API level (network/connection error), NOT from
    // gateway resolution (which was the bug).
    try {
      await registeredScorer.run({
        input: [{ role: 'user', content: 'Hello' }],
        output: { text: 'Hi there!' },
      });
      // If we get here without any error, the test passes
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // After the fix, we should NOT see gateway resolution errors.
      // These patterns indicate the bug is still present:
      const isGatewayResolutionError =
        errorMessage.includes('Gateway with ID') ||
        errorMessage.includes('Could not find config for provider enterprise') ||
        errorMessage.includes('Invalid model configuration');

      // If we see a gateway resolution error, the fix didn't work
      expect(isGatewayResolutionError).toBe(false);

      // Network/API errors are expected since we're hitting a mock endpoint
      // that doesn't actually exist - this is fine, it means gateway resolution worked!
      console.log('Expected error (API/network level - gateway resolution worked!):', errorMessage);
    }
  });

  /**
   * Verify that the scorer has __registerMastra method after the fix.
   */
  it('should verify scorer has __registerMastra method', () => {
    const scorer = createScorer({
      id: 'test-scorer',
      description: 'Test scorer',
    }).generateScore(() => 1);

    // After the fix, MastraScorer should have __registerMastra method
    const hasRegisterMastra = '__registerMastra' in scorer;

    expect(hasRegisterMastra).toBe(true);
  });
});
