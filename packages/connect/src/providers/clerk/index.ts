// AUTO-GENERATED from NangoHQ/integration-templates @ 23df553a789b — do not edit by hand.
import type { ProviderRegistration } from '../../registry.js';
import { createClerkTools } from './tools.js';

export const clerkProvider: ProviderRegistration = {
  integrationId: 'clerk',
  envVar: 'MASTRA_CLERK_CONNECTION_ID',
  createTools: createClerkTools,
};

export { createClerkTools };
