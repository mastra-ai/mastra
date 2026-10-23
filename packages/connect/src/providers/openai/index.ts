// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import type { ProviderRegistration } from '../../registry.js';
import { createOpenaiTools } from './tools.js';

export const openaiProvider: ProviderRegistration = {
  integrationId: 'openai',
  envVar: 'MASTRA_OPENAI_CONNECTION_ID',
  createTools: createOpenaiTools,
};

export { createOpenaiTools };
