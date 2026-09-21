// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import type { ProviderRegistration } from '../../registry.js';
import { createSlackTools } from './tools.js';

export const slackProvider: ProviderRegistration = {
  integrationId: 'slack',
  envVar: 'MASTRA_SLACK_CONNECTION_ID',
  createTools: createSlackTools,
};

export { createSlackTools };
