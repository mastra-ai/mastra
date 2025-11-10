import { createOpenAICompatible } from '@ai-sdk/openai-compatible-v5';
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MastraError } from '../../../error/index.js';
import { MastraModelGateway } from './base.js';
import type { ProviderConfig } from './base.js';

// Minimal Helicone gateway integration using OpenAI-compatible API
// Base URL provided by user: https://ai-gateway.helicone.ai

const HELICONE_BASE_URL = 'https://ai-gateway.helicone.ai';

export class HeliconeGateway extends MastraModelGateway {
  readonly name = 'helicone';
  readonly prefix = 'helicone';

  async fetchProviders(): Promise<Record<string, ProviderConfig>> {
    // Fetch model registry from Helicone public API and map to provider/model IDs
    // Endpoint: https://api.helicone.ai/v1/public/model-registry/models
    try {
      const res = await fetch('https://api.helicone.ai/v1/public/model-registry/models');
      if (!res.ok) {
        throw new Error(`Failed to fetch Helicone models: ${res.status} ${res.statusText}`);
      }
      const data = (await res.json()) as {
        models: Array<{
          id: string;
          author?: string | null;
          endpoints?: Array<{ provider?: string; providerSlug?: string }>;
        }>;
      };

      const models = new Set<string>();
      for (const m of data.models || []) {
        const modelId = m.id;
        const providers = (m.endpoints || []).map(e => e.providerSlug || e.provider).filter(Boolean) as string[];
        // Fallback to author if endpoints missing
        if (providers.length === 0 && m.author) providers.push(m.author);
        for (const p of providers) {
          models.add(`${p}/${modelId}`);
        }
      }

      const helicone: ProviderConfig = {
        url: HELICONE_BASE_URL,
        apiKeyEnvVar: 'HELICONE_API_KEY',
        apiKeyHeader: 'Authorization',
        name: 'Helicone',
        gateway: 'helicone',
        models: Array.from(models).sort(),
      };
      return { helicone };
    } catch (err) {
      // On failure, still return a minimal config so runtime can work with manual model IDs
      return {
        helicone: {
          url: HELICONE_BASE_URL,
          apiKeyEnvVar: 'HELICONE_API_KEY',
          apiKeyHeader: 'Authorization',
          name: 'Helicone',
          gateway: 'helicone',
          models: [],
        },
      };
    }
  }

  buildUrl(_routerId?: string, envVars?: Record<string, string>): string {
    // Allow override via HELICONE_BASE_URL, else default
    return envVars?.HELICONE_BASE_URL || process.env.HELICONE_BASE_URL || HELICONE_BASE_URL;
  }

  async getApiKey(modelId: string): Promise<string> {
    const apiKey = process.env['HELICONE_API_KEY'];
    if (!apiKey) {
      throw new MastraError({
        id: 'HELICONE_GATEWAY_NO_API_KEY',
        domain: 'LLM',
        category: 'UNKNOWN',
        text: `Missing HELICONE_API_KEY environment variable required for model: ${modelId}`,
      });
    }
    return apiKey;
  }

  async resolveLanguageModel({
    modelId,
    providerId,
    apiKey,
  }: {
    modelId: string;
    providerId: string;
    apiKey: string;
  }): Promise<LanguageModelV2> {
    const baseURL = this.buildUrl();
    // Helicone recommends OpenAI-compatible access across providers via base URL swap
    return createOpenAICompatible({ name: providerId, apiKey, baseURL, supportsStructuredOutputs: true }).chatModel(
      modelId,
    );
  }
}
