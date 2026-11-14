import type { ListAgentsModelProvidersResponse } from '@mastra/client-js';

export const openAiProviders = {
  providers: [
    {
      id: 'openai',
      name: 'OpenAI',
      envVar: 'OPENAI_API_KEY',
      connected: true,
      models: ['gpt-4o-mini', 'gpt-5'],
    },
  ],
} satisfies ListAgentsModelProvidersResponse;

export const gatewayProviders = {
  providers: [
    {
      id: 'acme/custom',
      name: 'Custom',
      envVar: 'ACME_API_KEY',
      connected: true,
      models: ['custom-small', 'custom-large'],
    },
  ],
} satisfies ListAgentsModelProvidersResponse;

export const prefixedGatewayProviders = {
  providers: [
    {
      id: 'private/ollama',
      name: 'Ollama',
      envVar: 'PRIVATE_API_KEY',
      connected: true,
      models: ['gpt-oss:20b', 'llama3:8b'],
    },
  ],
} satisfies ListAgentsModelProvidersResponse;
