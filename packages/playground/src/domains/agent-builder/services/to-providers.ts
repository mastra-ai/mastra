import type { ListAgentsModelProvidersResponse, Provider } from '@mastra/client-js';

export type ListProvider = ListAgentsModelProvidersResponse['providers'][number] & {
  models: string[];
};

export function toProviders(providers: ListProvider[]): Provider[] {
  return providers.map(provider => {
    return {
      id: provider.id,
      name: provider.name,
      label: provider.label,
      description: provider.description,
      envVar: '',
      connected: false,
      models: provider.models || [],
    };
  });
}
