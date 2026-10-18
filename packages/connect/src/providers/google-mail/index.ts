// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import type { ProviderRegistration } from '../../registry.js';
import { createGoogleMailTools } from './tools.js';

export const googleMailProvider: ProviderRegistration = {
  integrationId: 'google-mail',
  envVar: 'MASTRA_GOOGLE_MAIL_CONNECTION_ID',
  createTools: createGoogleMailTools,
};

export { createGoogleMailTools };
