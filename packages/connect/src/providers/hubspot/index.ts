// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import type { ProviderRegistration } from '../../registry.js';
import { createHubspotTools } from './tools.js';

export const hubspotProvider: ProviderRegistration = {
  integrationId: 'hubspot',
  envVar: 'MASTRA_HUBSPOT_CONNECTION_ID',
  createTools: createHubspotTools,
};

export { createHubspotTools };
