// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import type { ProviderRegistration } from '../../registry.js';
import { createFirefliesTools } from './tools.js';

export const firefliesProvider: ProviderRegistration = {
  integrationId: 'fireflies',
  envVar: 'MASTRA_FIREFLIES_CONNECTION_ID',
  createTools: createFirefliesTools,
};

export { createFirefliesTools };
