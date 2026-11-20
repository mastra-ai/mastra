// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import type { ProviderRegistration } from '../../registry.js';
import { createMicrosoftTeamsTools } from './tools.js';

export const microsoftTeamsProvider: ProviderRegistration = {
  integrationId: 'microsoft-teams',
  envVar: 'MASTRA_MICROSOFT_TEAMS_CONNECTION_ID',
  createTools: createMicrosoftTeamsTools,
};

export { createMicrosoftTeamsTools };
