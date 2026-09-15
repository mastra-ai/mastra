// AUTO-GENERATED from rhysbalevicius/integration-templates @ 06fb7396c6b2 — do not edit by hand.
import type { ProviderRegistration } from '../../registry.js';
import { createResendTools } from './tools.js';

export const resendProvider: ProviderRegistration = {
  integrationId: 'resend',
  envVar: 'MASTRA_RESEND_CONNECTION_ID',
  createTools: createResendTools,
};

export { createResendTools };
