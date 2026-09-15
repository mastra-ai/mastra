// AUTO-GENERATED from rhysbalevicius/integration-templates @ b9fc364318f7 — do not edit by hand.
import type { ProviderRegistration } from '../../registry.js';
import { createResendTools } from './tools.js';

export const resendProvider: ProviderRegistration = {
  integrationId: 'resend',
  envVar: 'MASTRA_RESEND_CONNECTION_ID',
  createTools: createResendTools,
};

export { createResendTools };
