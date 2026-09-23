// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import type { ProviderRegistration } from '../../registry.js';
import { createGoogleCalendarTools } from './tools.js';

export const googleCalendarProvider: ProviderRegistration = {
  integrationId: 'google-calendar',
  envVar: 'MASTRA_GOOGLE_CALENDAR_CONNECTION_ID',
  createTools: createGoogleCalendarTools,
};

export { createGoogleCalendarTools };
