// AUTO-GENERATED from NangoHQ/integration-templates @ 792329abc442 — do not edit by hand.
import type { ProviderRegistration } from '../../registry.js';
import { createWorkosTools } from './tools.js';

export const workosProvider: ProviderRegistration = {
  integrationId: 'workos',
  envVar: 'MASTRA_WORKOS_CONNECTION_ID',
  createTools: createWorkosTools,
};

export { createWorkosTools };
