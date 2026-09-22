// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import type { ProviderRegistration } from '../../registry.js';
import { createLinearTools } from './tools.js';

export const linearProvider: ProviderRegistration = {
  integrationId: 'linear',
  envVar: 'MASTRA_LINEAR_CONNECTION_ID',
  createTools: createLinearTools,
};

export { createLinearTools };
