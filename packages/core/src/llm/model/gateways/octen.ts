import { createOpenAICompatible } from '@ai-sdk/openai-compatible-v5';
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MastraError } from '../../../error/index.js';
import { MastraModelGateway } from './base.js';
import type { ProviderConfig } from './base.js';
import { MASTRA_USER_AGENT } from './constants.js';

/**
 * Gateway implementation for the Octen AI Web-chat API.
 * Handles fetching providers, building URLs, getting API keys, and resolving language models
 * via OpenAI protocol compatibility.
 */
export class OctenGateway extends MastraModelGateway {
  readonly id = 'octen';
  readonly name = 'Octen AI Gateway';

  /**
   * Fetches the supported LLM providers and their configurations from the Octen gateway.
   * @returns A promise that resolves to a record of provider configurations.
   */
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

  /**
   * Builds the base URL for the Octen AI API.
   * @param _modelId - The ID of the model being requested.
   * @param _envVars - Optional environment variables object.
   * @returns A promise that resolves to the root API v1 endpoint URL.
   */
  async buildUrl(_modelId: string, _envVars?: typeof process.env): Promise<string> {
    return 'https://api.octen.ai/v1';
  }

  /**
   * Retrieves the OCTEN_API_KEY from environment variables.
   * @param modelId - The model ID using the key.
   * @returns A promise that resolves to the active API key.
   * @throws {MastraError} If the OCTEN_API_KEY environment variable is not defined.
   */
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

  /**
   * Resolves the language model using the AI SDK's OpenAI compatibility layer.
   * Customizes fetch to append routing metadata explicitly expected by Octen.
   * @param params - The resolution parameters.
   * @param params.modelId - The model ID string.
   * @param params.providerId - The identifier of the specific provider.
   * @param params.apiKey - The API key used for the request.
   * @param params.headers - Optional additional headers.
   * @returns A promise resolving to an AI SDK LanguageModelV2 instance.
   */
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
            // Default to web search when caller did not specify a value
            if (parsedBody.web_search === undefined) {
              parsedBody.web_search = 'on';
            }

            // Ensure the model includes the provider logic since octen natively expects it
            if (providerId) {
              const currentModel = typeof parsedBody.model === 'string' ? parsedBody.model : cleanModelId;
              if (!currentModel.startsWith(`${providerId}/`)) {
                parsedBody.model = `${providerId}/${currentModel}`;
              }
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

        return response;
      },
    }).chatModel(cleanModelId);
  }
}
