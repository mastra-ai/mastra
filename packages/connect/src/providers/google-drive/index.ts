// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import type { ProviderRegistration } from '../../registry.js';
import { createGoogleDriveTools } from './tools.js';

export const googleDriveProvider: ProviderRegistration = {
  integrationId: 'google-drive',
  envVar: 'MASTRA_GOOGLE_DRIVE_CONNECTION_ID',
  createTools: createGoogleDriveTools,
};

export { createGoogleDriveTools };
