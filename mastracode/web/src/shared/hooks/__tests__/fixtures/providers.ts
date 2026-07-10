import type { ProviderInfo, ProvidersResponse } from '../../../api/types';

export const openaiProvider: ProviderInfo = {
  provider: 'openai',
  source: 'stored',
};

export const anthropicProviderNoKey: ProviderInfo = {
  provider: 'anthropic',
  source: 'none',
};

export const providersResponse: ProvidersResponse = {
  credentialManagementEnabled: true,
  providers: [openaiProvider, anthropicProviderNoKey],
};
