// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import type { ProviderRegistration } from '../../registry.js';
import { createPosthogTools } from './tools.js';

export const posthogProvider: ProviderRegistration = {
  integrationId: 'posthog',
  envVar: 'MASTRA_POSTHOG_CONNECTION_ID',
  createTools: createPosthogTools,
};

export { createPosthogTools };
