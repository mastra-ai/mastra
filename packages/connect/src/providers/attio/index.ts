// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import type { ProviderRegistration } from '../../registry.js';
import { createAttioTools } from './tools.js';

export const attioProvider: ProviderRegistration = {
  integrationId: 'attio',
  envVar: 'MASTRA_ATTIO_CONNECTION_ID',
  createTools: createAttioTools,
};

export { createAttioTools };
