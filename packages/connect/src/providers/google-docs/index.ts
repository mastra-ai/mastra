// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import type { ProviderRegistration } from '../../registry.js';
import { createGoogleDocsTools } from './tools.js';

export const googleDocsProvider: ProviderRegistration = {
  integrationId: 'google-docs',
  envVar: 'MASTRA_GOOGLE_DOCS_CONNECTION_ID',
  createTools: createGoogleDocsTools,
};

export { createGoogleDocsTools };
