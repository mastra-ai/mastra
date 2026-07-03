import type { BuilderSettingsResponse, ListAgentsModelProvidersResponse } from '@mastra/client-js';

export const serverProviderRegistry: ListAgentsModelProvidersResponse = {
  providers: [
    {
      connected: false,
      envVar: 'OPENAI_API_KEY',
      id: 'openai',
      models: ['gpt-4o-mini'],
      name: 'OpenAI',
    },
    {
      connected: false,
      envVar: 'ANTHROPIC_API_KEY',
      id: 'anthropic',
      models: ['claude-opus-4-7'],
      name: 'Anthropic',
    },
  ],
};

export const desktopLocalOnlyBuilderSettings: BuilderSettingsResponse = {
  enabled: true,
  modelPolicy: {
    active: true,
    allowed: [{ provider: 'ollama', modelId: 'glm-ocr:latest' }],
    default: { provider: 'ollama', modelId: 'glm-ocr:latest' },
    pickerVisible: true,
  },
};
