// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import type { ProviderRegistration } from '../../registry.js';
import { createZendeskTools } from './tools.js';

export const zendeskProvider: ProviderRegistration = {
  integrationId: 'zendesk',
  envVar: 'MASTRA_ZENDESK_CONNECTION_ID',
  createTools: createZendeskTools,
};

export { createZendeskTools };
