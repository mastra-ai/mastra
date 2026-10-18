// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import type { ProviderRegistration } from '../../registry.js';
import { createNotionTools } from './tools.js';

export const notionProvider: ProviderRegistration = {
  integrationId: 'notion',
  envVar: 'MASTRA_NOTION_CONNECTION_ID',
  createTools: createNotionTools,
};

export { createNotionTools };
