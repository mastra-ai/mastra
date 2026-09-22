// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import type { ProviderRegistration } from '../../registry.js';
import { createAnthropicTools } from './tools.js';

export const anthropicProvider: ProviderRegistration = {
  integrationId: 'anthropic',
  envVar: 'MASTRA_ANTHROPIC_CONNECTION_ID',
  createTools: createAnthropicTools,
};

export { createAnthropicTools };
