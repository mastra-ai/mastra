// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import type { ProviderRegistration } from '../../registry.js';
import { createMicrosoftWordTools } from './tools.js';

export const microsoftWordProvider: ProviderRegistration = {
  integrationId: 'microsoft-word',
  envVar: 'MASTRA_MICROSOFT_WORD_CONNECTION_ID',
  createTools: createMicrosoftWordTools,
};

export { createMicrosoftWordTools };
