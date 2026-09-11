// AUTO-GENERATED from rhysbalevicius/integration-templates @ 15123cf72c67 — do not edit by hand.
import type { ProviderRegistration } from '../../registry.js';
import { createNeonTools } from './tools.js';

export const neonProvider: ProviderRegistration = {
  integrationId: 'neon',
  envVar: 'MASTRA_NEON_CONNECTION_ID',
  createTools: createNeonTools,
};

export { createNeonTools };
