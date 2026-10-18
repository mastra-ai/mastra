// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import type { ProviderRegistration } from '../../registry.js';
import { createGoogleAnalyticsTools } from './tools.js';

export const googleAnalyticsProvider: ProviderRegistration = {
  integrationId: 'google-analytics',
  envVar: 'MASTRA_GOOGLE_ANALYTICS_CONNECTION_ID',
  createTools: createGoogleAnalyticsTools,
};

export { createGoogleAnalyticsTools };
