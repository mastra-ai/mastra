// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import type { ProviderRegistration } from '../../registry.js';
import { createMicrosoftPowerpointTools } from './tools.js';

export const microsoftPowerpointProvider: ProviderRegistration = {
  integrationId: 'microsoft-powerpoint',
  envVar: 'MASTRA_MICROSOFT_POWERPOINT_CONNECTION_ID',
  createTools: createMicrosoftPowerpointTools,
};

export { createMicrosoftPowerpointTools };
