// AUTO-GENERATED from rhysbalevicius/integration-templates @ 9629ccfaefd5 — do not edit by hand.
import type { ProviderRegistration } from '../../registry.js';
import { createNeonTools } from './tools.js';

export const neonProvider: ProviderRegistration = {
  integrationId: 'neon',
  envVar: 'MASTRA_NEON_CONNECTION_ID',
  createTools: createNeonTools,
};

export { createNeonTools };
