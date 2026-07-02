import { createOpenAICompatible } from '@ai-sdk/openai-compatible-v5';
import { MastraModelGateway } from '@mastra/core/llm';
import type { GatewayLanguageModel, ProviderConfig } from '@mastra/core/llm';

const localModelApiKeyPlaceholder = 'not-needed';

type LocalProvider = {
  id: string;
  name: string;
};

function cleanUrl(value: string | undefined, fallback: string) {
  const url = value?.trim();
  return url && url.length > 0 ? url : fallback;
}

function cleanModelId(value: string | undefined, fallback: string) {
  const modelId = value?.trim();
  return modelId && modelId.length > 0 ? modelId : fallback;
}

function cleanApiKey(value: string | undefined) {
  const apiKey = value?.trim();
  return apiKey && apiKey.length > 0 ? apiKey : localModelApiKeyPlaceholder;
}

function localProviderForUrl(modelUrl: string): LocalProvider {
  const normalized = modelUrl.replace(/\/$/, '').toLowerCase();
  if (normalized === 'http://localhost:11434/v1' || normalized === 'http://127.0.0.1:11434/v1') {
    return { id: 'ollama', name: 'Ollama Local' };
  }
  if (normalized === 'http://localhost:1234/v1' || normalized === 'http://127.0.0.1:1234/v1') {
    return { id: 'lmstudio', name: 'LM Studio Local' };
  }
  return { id: 'local', name: 'Local Model Server' };
}

export function getDesktopModelConfig() {
  const url = cleanUrl(process.env.MASTRA_DESKTOP_MODEL_URL, 'http://localhost:1234/v1');
  const provider = localProviderForUrl(url);
  return {
    apiKey: cleanApiKey(process.env.MASTRA_DESKTOP_MODEL_API_KEY),
    modelId: cleanModelId(process.env.MASTRA_DESKTOP_MODEL_ID, 'lmstudio/openai/gpt-oss-20b'),
    providerId: provider.id,
    providerName: provider.name,
    url,
  };
}

export class DesktopLocalModelGateway extends MastraModelGateway {
  readonly id = 'desktop-local';
  readonly name = 'Mastra Studio Desktop local model gateway';

  handlesModel(modelId: string): boolean {
    const { providerId } = getDesktopModelConfig();
    return modelId.startsWith(`${providerId}/`);
  }

  async fetchProviders(): Promise<Record<string, ProviderConfig>> {
    return {};
  }

  buildUrl(): string {
    return getDesktopModelConfig().url;
  }

  async getApiKey(): Promise<string> {
    return getDesktopModelConfig().apiKey;
  }

  resolveAuth() {
    return { apiKey: getDesktopModelConfig().apiKey };
  }

  resolveLanguageModel({
    apiKey,
    headers,
    modelId,
    providerId,
  }: {
    modelId: string;
    providerId: string;
    apiKey: string;
    headers?: Record<string, string>;
  }): GatewayLanguageModel {
    return createOpenAICompatible({
      name: providerId,
      apiKey,
      baseURL: getDesktopModelConfig().url,
      headers,
      supportsStructuredOutputs: true,
    }).chatModel(modelId);
  }
}
