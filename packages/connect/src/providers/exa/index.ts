// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import type { ProviderRegistration } from '../../registry.js';
import { createExaTools } from './tools.js';

export const exaProvider: ProviderRegistration = {
  integrationId: 'exa',
  envVar: 'MASTRA_EXA_CONNECTION_ID',
  createTools: createExaTools,
};

export { createExaTools };
