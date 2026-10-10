// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import type { ProviderRegistration } from '../../registry.js';
import { createOutlookTools } from './tools.js';

export const outlookProvider: ProviderRegistration = {
  integrationId: 'outlook',
  envVar: 'MASTRA_OUTLOOK_CONNECTION_ID',
  createTools: createOutlookTools,
};

export { createOutlookTools };
