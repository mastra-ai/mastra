// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import type { ProviderRegistration } from '../../registry.js';
import { createGoogleSheetTools } from './tools.js';

export const googleSheetProvider: ProviderRegistration = {
  integrationId: 'google-sheet',
  envVar: 'MASTRA_GOOGLE_SHEET_CONNECTION_ID',
  createTools: createGoogleSheetTools,
};

export { createGoogleSheetTools };
