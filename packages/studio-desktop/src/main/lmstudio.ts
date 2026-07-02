import type { LocalModelProviderId } from '../shared/model-presets';
import { LOCAL_MODEL_PRESETS } from '../shared/model-presets';
import type { ProbeModelsResult } from '../shared/types';
import { DEFAULT_MODEL_URL } from './defaults';
import { toModelsEndpoint, toOllamaTagsEndpoint } from './url';

interface OpenAIModelList {
  data?: Array<{ id?: unknown }>;
}

interface OllamaModelList {
  models?: Array<{ model?: unknown; name?: unknown }>;
}

interface ProbeLocalModelsInput {
  apiKey?: string;
  modelUrl?: string;
  providerId?: LocalModelProviderId;
  providerName?: string;
}

export async function probeLmStudioModels(
  modelUrl = DEFAULT_MODEL_URL,
  apiKey?: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ProbeModelsResult> {
  return probeOpenAICompatibleModels(modelUrl, 'LM Studio', apiKey, fetchImpl);
}

export async function probeLocalModels(
  { apiKey, modelUrl = DEFAULT_MODEL_URL, providerId, providerName }: ProbeLocalModelsInput,
  fetchImpl: typeof fetch = fetch,
): Promise<ProbeModelsResult> {
  if (providerId === 'ollama') {
    return probeOllamaModels(modelUrl || LOCAL_MODEL_PRESETS.ollama.modelUrl, fetchImpl);
  }

  return probeOpenAICompatibleModels(modelUrl, providerName, apiKey, fetchImpl);
}

export async function probeOpenAICompatibleModels(
  modelUrl = DEFAULT_MODEL_URL,
  providerName = 'OpenAI-compatible server',
  apiKey?: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ProbeModelsResult> {
  const targetUrl = modelUrl.trim() || DEFAULT_MODEL_URL;
  const label = providerName.trim() || 'OpenAI-compatible server';
  const token = apiKey?.trim();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token && token !== 'not-needed' && token !== 'ollama') {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetchImpl(toModelsEndpoint(targetUrl), {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      return {
        ok: false,
        modelUrl: targetUrl,
        models: [],
        error: `${label} returned HTTP ${response.status}`,
      };
    }

    const body = (await response.json()) as OpenAIModelList;
    if (!Array.isArray(body.data)) {
      return {
        ok: false,
        modelUrl: targetUrl,
        models: [],
        error: `${label} returned an invalid model list`,
      };
    }

    const models = body.data.flatMap(item => (typeof item.id === 'string' && item.id.trim() ? [item.id] : []));
    return {
      ok: true,
      modelUrl: targetUrl,
      models,
      error: models.length === 0 ? `${label} did not report any loaded models` : undefined,
    };
  } catch (error) {
    return {
      ok: false,
      modelUrl: targetUrl,
      models: [],
      error: error instanceof Error ? error.message : `Unable to reach ${label}`,
    };
  }
}

export async function probeOllamaModels(
  modelUrl = LOCAL_MODEL_PRESETS.ollama.modelUrl,
  fetchImpl: typeof fetch = fetch,
): Promise<ProbeModelsResult> {
  const targetUrl = modelUrl.trim() || LOCAL_MODEL_PRESETS.ollama.modelUrl;

  try {
    const response = await fetchImpl(toOllamaTagsEndpoint(targetUrl), {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      return {
        ok: false,
        modelUrl: targetUrl,
        models: [],
        error: `Ollama returned HTTP ${response.status}`,
      };
    }

    const body = (await response.json()) as OllamaModelList;
    if (!Array.isArray(body.models)) {
      return {
        ok: false,
        modelUrl: targetUrl,
        models: [],
        error: 'Ollama returned an invalid model list',
      };
    }

    const models = body.models.flatMap(item => {
      const model = typeof item.model === 'string' ? item.model : item.name;
      return typeof model === 'string' && model.trim() ? [model] : [];
    });

    return {
      ok: true,
      modelUrl: targetUrl,
      models,
      error: models.length === 0 ? 'Ollama did not report any local models' : undefined,
    };
  } catch (error) {
    return {
      ok: false,
      modelUrl: targetUrl,
      models: [],
      error: error instanceof Error ? error.message : 'Unable to reach Ollama',
    };
  }
}
