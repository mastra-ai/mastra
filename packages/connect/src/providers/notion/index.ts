// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import type { ProviderRegistration } from '../../registry.js';
import { createNotionTools } from './tools.js';

export const notionProvider: ProviderRegistration = {
  integrationId: 'notion',
  envVar: 'MASTRA_NOTION_CONNECTION_ID',
  createTools: createNotionTools,
};

export { createNotionTools };
