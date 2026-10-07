// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import type { ProviderRegistration } from '../../registry.js';
import { createOneDriveTools } from './tools.js';

export const oneDriveProvider: ProviderRegistration = {
  integrationId: 'one-drive',
  envVar: 'MASTRA_ONE_DRIVE_CONNECTION_ID',
  createTools: createOneDriveTools,
};

export { createOneDriveTools };
