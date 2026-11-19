// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import type { ProviderRegistration } from '../../registry.js';
import { createElevenlabsTools } from './tools.js';

export const elevenlabsProvider: ProviderRegistration = {
  integrationId: 'elevenlabs',
  envVar: 'MASTRA_ELEVENLABS_CONNECTION_ID',
  createTools: createElevenlabsTools,
};

export { createElevenlabsTools };
