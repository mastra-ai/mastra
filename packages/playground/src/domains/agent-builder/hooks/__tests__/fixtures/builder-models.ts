import type { BuilderAvailableModelsResponse, Provider } from '@mastra/client-js';

/**
 * The full set of providers/models the picker knows about, before any policy
 * filtering. Used as the `providers`/`allModels` input to the hooks under test.
 */
export const allProviders: Provider[] = [
  { id: 'openai', name: 'OpenAI', envVar: 'OPENAI_API_KEY', connected: true, models: ['gpt-4o', 'gpt-4o-mini'] },
  {
    id: 'anthropic',
    name: 'Anthropic',
    envVar: 'ANTHROPIC_API_KEY',
    connected: true,
    models: ['claude-opus-4-7', 'claude-haiku-4-5'],
  },
  {
    id: 'acme/gateway',
    name: 'Acme Gateway',
    envVar: 'ACME_API_KEY',
    connected: false,
    models: ['acme-mini'],
  },
];

/** Build a typed `GET /editor/builder/models/available` response. */
export const availableModelsResponse = (providers: Provider[]): BuilderAvailableModelsResponse => ({ providers });
