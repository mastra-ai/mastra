import { createOpenAICompatible } from '@ai-sdk/openai-compatible-v5';
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MastraError } from '../../../error/index.js';
import { MastraModelGateway } from './base.js';
import type { ProviderConfig } from './base.js';
import { MASTRA_USER_AGENT } from './constants.js';

export class OctenGateway extends MastraModelGateway {
  readonly id = 'octen';
  readonly name = 'Octen AI Gateway';

  async fetchProviders(): Promise<Record<string, ProviderConfig>> {
    const config: ProviderConfig = {
      apiKeyEnvVar: 'OCTEN_API_KEY',
      // Octen supports OpenAI compatible headers, AI SDK uses Bearer token format automatically
      apiKeyHeader: 'Authorization',
      name: 'Octen',
      gateway: 'octen',
      models: [
        'anthropic/claude-sonnet-4.6',
        'anthropic/claude-opus-4.6',
        'anthropic/claude-haiku-4.5',
        'openai/gpt-5.4',
        'openai/gpt-oss-120b',
        'google/gemini-3.1-pro-preview',
        'google/gemini-3-flash-preview',
        'google/gemini-3.1-flash-lite-preview',
        'moonshotai/kimi-k2.5',
        'minimax/minimax-m2.5',
      ],
      docUrl: 'https://docs.octen.ai/api-reference/web-chat',
    };
    return { octen: config };
  }

  async buildUrl(_modelId: string, _envVars?: typeof process.env): Promise<string> {
    return 'https://api.octen.ai/v1';
  }

  async getApiKey(modelId: string): Promise<string> {
    const key = process.env['OCTEN_API_KEY'];
    if (!key) {
      throw new MastraError({
        id: 'OCTEN_GATEWAY_NO_TOKEN',
        domain: 'LLM',
        category: 'UNKNOWN',
        text: `Missing OCTEN_API_KEY environment variable required for octen model: ${modelId}`,
      });
    }
    return key;
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
    const baseURL = await this.buildUrl(modelId);
    const mastraHeaders = { 'User-Agent': MASTRA_USER_AGENT, ...headers };

    // Strip out provider prefixes just in case AI SDK acts up with router namespaces
    const cleanModelId = modelId;

    return createOpenAICompatible({
      name: 'octen',
      apiKey,
      baseURL,
      headers: mastraHeaders,
      fetch: async (url: RequestInfo | URL, options?: RequestInit) => {
        if (options && options.body && typeof options.body === 'string') {
          try {
            const parsedBody = JSON.parse(options.body);
            // Octen explicitly expects web_search to be "on" to activate RAG processing
            parsedBody.web_search = 'on';

            // Ensure the model includes the provider logic since octen natively expects it
            if (providerId && !String(parsedBody.model).includes(providerId)) {
              parsedBody.model = `${providerId}/${parsedBody.model}`;
            }

            options.body = JSON.stringify(parsedBody);
          } catch {
            // Ignore parse errors safely
          }
        }
        const response = await fetch(url, options as RequestInit);

        // Intercept response to normalize the `meta.usage` nested object so the AI SDK tracks it
        if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
          const clonedResponse = response.clone();
          try {
            const jsonText = await clonedResponse.text();
            const jsonObj = JSON.parse(jsonText);
            if (jsonObj.meta && jsonObj.meta.usage) {
              jsonObj.usage = jsonObj.meta.usage;
            }
            return new Response(JSON.stringify(jsonObj), {
              status: response.status,
              statusText: response.statusText,
              headers: response.headers,
            });
          } catch {
            // Unparseable JSON, return original
            return response;
          }
        }
        }

        return response;
      },
    }).chatModel(cleanModelId);
  }
}
