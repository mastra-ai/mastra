// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import type { ProviderRegistration } from '../../registry.js';
import { createJiraTools } from './tools.js';

export const jiraProvider: ProviderRegistration = {
  integrationId: 'jira',
  envVar: 'MASTRA_JIRA_CONNECTION_ID',
  createTools: createJiraTools,
};

export { createJiraTools };
