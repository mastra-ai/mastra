// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import type { ProviderRegistration } from '../../registry.js';
import { createGoogleAdsTools } from './tools.js';

export const googleAdsProvider: ProviderRegistration = {
  integrationId: 'google-ads',
  envVar: 'MASTRA_GOOGLE_ADS_CONNECTION_ID',
  createTools: createGoogleAdsTools,
};

export { createGoogleAdsTools };
