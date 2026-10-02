// AUTO-GENERATED from NangoHQ/integration-templates @ 8b75595da34c — do not edit by hand.
import type { ProviderRegistration } from '../../registry.js';
import { createClerkTools } from './tools.js';

export const clerkProvider: ProviderRegistration = {
  integrationId: 'clerk',
  envVar: 'MASTRA_CLERK_CONNECTION_ID',
  createTools: createClerkTools,
};

export { createClerkTools };
