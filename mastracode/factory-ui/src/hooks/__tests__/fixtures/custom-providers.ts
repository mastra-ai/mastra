import type { CustomProviderInfo, CustomProvidersResponse } from '../../../api/types';

export const customProvider: CustomProviderInfo = {
  id: 'my-llm',
  name: 'My LLM',
  url: 'https://api.my-llm.test/v1',
  hasApiKey: true,
  models: ['my-llm/fast', 'my-llm/smart'],
};

export const customProvidersResponse: CustomProvidersResponse = {
  providers: [customProvider],
};
