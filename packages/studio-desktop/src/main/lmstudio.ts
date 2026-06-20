import type { ProbeModelsResult } from '../shared/types';
import { DEFAULT_MODEL_URL } from './defaults';
import { toModelsEndpoint } from './url';

interface OpenAIModelList {
  data?: Array<{ id?: unknown }>;
}

export async function probeLmStudioModels(
  modelUrl = DEFAULT_MODEL_URL,
  fetchImpl: typeof fetch = fetch,
): Promise<ProbeModelsResult> {
  const targetUrl = modelUrl.trim() || DEFAULT_MODEL_URL;

  try {
    const response = await fetchImpl(toModelsEndpoint(targetUrl), {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      return {
        ok: false,
        modelUrl: targetUrl,
        models: [],
        error: `LM Studio returned HTTP ${response.status}`,
      };
    }

    const body = (await response.json()) as OpenAIModelList;
    if (!Array.isArray(body.data)) {
      return {
        ok: false,
        modelUrl: targetUrl,
        models: [],
        error: 'LM Studio returned an invalid model list',
      };
    }

    const models = body.data.flatMap(item => (typeof item.id === 'string' && item.id.trim() ? [item.id] : []));
    return {
      ok: true,
      modelUrl: targetUrl,
      models,
      error: models.length === 0 ? 'LM Studio did not report any loaded models' : undefined,
    };
  } catch (error) {
    return {
      ok: false,
      modelUrl: targetUrl,
      models: [],
      error: error instanceof Error ? error.message : 'Unable to reach LM Studio',
    };
  }
}
