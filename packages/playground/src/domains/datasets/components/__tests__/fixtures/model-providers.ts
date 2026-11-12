import type { BuilderSettingsResponse, ListAgentsModelProvidersResponse } from '@mastra/client-js';

/** Providers the experiment model picker offers, including a gateway provider stored with its prefix. */
export const modelProviders: ListAgentsModelProvidersResponse = {
  providers: [
    { id: 'openai', name: 'OpenAI', envVar: 'OPENAI_API_KEY', connected: true, models: ['gpt-4o', 'gpt-4o-mini'] },
    {
      id: 'anthropic',
      name: 'Anthropic',
      envVar: 'ANTHROPIC_API_KEY',
      connected: true,
      models: ['claude-opus-4-7', 'claude-haiku-4-5'],
    },
    { id: 'acme/gateway', name: 'Acme Gateway', envVar: 'ACME_API_KEY', connected: true, models: ['acme-mini'] },
  ],
};

/** No admin model policy: every provider and model is pickable. */
export const openModelPolicySettings: BuilderSettingsResponse = { enabled: false, modelPolicy: { active: false } };

/** An admin has hidden the model picker. */
export const lockedModelPolicySettings: BuilderSettingsResponse = {
  enabled: true,
  modelPolicy: { active: true, pickerVisible: false, default: { provider: 'openai', modelId: 'gpt-4o' } },
};
