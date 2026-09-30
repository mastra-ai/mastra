import { useQuery } from '@tanstack/react-query';

import type { Provider } from './cast';
import { modelsFrom, PROVIDERS } from './cast';

type RegistryModels = Record<string, string[]>;

async function loadRegistryModels(): Promise<RegistryModels> {
  const registry = await import('../../../../../../packages/core/src/llm/model/provider-registry.json');
  return Object.fromEntries(
    Object.entries(registry.default.providers).map(([provider, entry]) => [
      provider,
      entry.models.map(model => `${provider}/${model}`),
    ]),
  );
}

export function useProviderModels(): (provider: Provider) => string[] {
  const { data } = useQuery({
    queryKey: ['storyboard', 'provider-registry'],
    queryFn: loadRegistryModels,
    staleTime: Infinity,
  });
  return provider => (PROVIDERS.includes(provider) ? modelsFrom(provider) : (data?.[provider] ?? []));
}
