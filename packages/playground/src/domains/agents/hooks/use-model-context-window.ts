import { useQuery } from '@tanstack/react-query';

interface ModelsDevModel {
  limit?: { context?: number; output?: number };
}

interface ModelsDevProvider {
  models?: Record<string, ModelsDevModel>;
}

type ModelsDevApi = Record<string, ModelsDevProvider>;

export const MODELS_DEV_API_URL = 'https://models.dev/api.json';

/**
 * Context window (max input tokens) for a provider/model pair.
 *
 * Mastra's model registry does not carry context window sizes, so this reads
 * the models.dev catalog (cached for the whole session). Returns `undefined`
 * while loading, offline, or for unknown models — callers must degrade
 * gracefully to an absolute token display.
 */
export function useModelContextWindow(provider?: string, modelId?: string): number | undefined {
  const { data } = useQuery({
    queryKey: ['models-dev-api'],
    queryFn: async (): Promise<ModelsDevApi> => {
      const res = await fetch(MODELS_DEV_API_URL);
      if (!res.ok) throw new Error(`models.dev responded with ${res.status}`);
      return res.json();
    },
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
    retry: false,
    enabled: Boolean(provider && modelId),
  });

  if (!data || !provider || !modelId) return undefined;
  return data[provider]?.models?.[modelId]?.limit?.context;
}
