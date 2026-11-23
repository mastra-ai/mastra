// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import type { ProviderRegistration } from '../../registry.js';
import { createSendgridTools } from './tools.js';

export const sendgridProvider: ProviderRegistration = {
  integrationId: 'sendgrid',
  envVar: 'MASTRA_SENDGRID_CONNECTION_ID',
  createTools: createSendgridTools,
};

export { createSendgridTools };
