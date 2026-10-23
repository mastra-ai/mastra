// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import type { ProviderRegistration } from '../../registry.js';
import { createGithubTools } from './tools.js';

export const githubProvider: ProviderRegistration = {
  integrationId: 'github',
  envVar: 'MASTRA_GITHUB_CONNECTION_ID',
  createTools: createGithubTools,
};

export { createGithubTools };
