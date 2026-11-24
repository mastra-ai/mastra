// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import type { ProviderRegistration } from '../../registry.js';
import { createConfluenceTools } from './tools.js';

export const confluenceProvider: ProviderRegistration = {
  integrationId: 'confluence',
  envVar: 'MASTRA_CONFLUENCE_CONNECTION_ID',
  createTools: createConfluenceTools,
};

export { createConfluenceTools };
