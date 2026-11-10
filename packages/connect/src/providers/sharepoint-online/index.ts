// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import type { ProviderRegistration } from '../../registry.js';
import { createSharepointOnlineTools } from './tools.js';

export const sharepointOnlineProvider: ProviderRegistration = {
  integrationId: 'sharepoint-online',
  envVar: 'MASTRA_SHAREPOINT_ONLINE_CONNECTION_ID',
  createTools: createSharepointOnlineTools,
};

export { createSharepointOnlineTools };
