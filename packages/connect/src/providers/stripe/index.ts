// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import type { ProviderRegistration } from '../../registry.js';
import { createStripeTools } from './tools.js';

export const stripeProvider: ProviderRegistration = {
  integrationId: 'stripe',
  envVar: 'MASTRA_STRIPE_CONNECTION_ID',
  createTools: createStripeTools,
};

export { createStripeTools };
