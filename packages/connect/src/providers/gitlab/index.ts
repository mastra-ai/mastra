// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import type { ProviderRegistration } from '../../registry.js';
import { createGitlabTools } from './tools.js';

export const gitlabProvider: ProviderRegistration = {
  integrationId: 'gitlab',
  envVar: 'MASTRA_GITLAB_CONNECTION_ID',
  createTools: createGitlabTools,
};

export { createGitlabTools };
