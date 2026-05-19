import type { ListAgentsModelProvidersResponse, Provider } from '@mastra/client-js';

export function toProviders(providers: ListAgentsModelProvidersResponse['providers']): Provider[] {
  return providers.map(provider => {
    return {
      id: provider.id,
      name: provider.name,
      label: provider.label,
      description: provider.description,
      envVar: '',
      connected: false,
      models: [],
    };
  });
}
