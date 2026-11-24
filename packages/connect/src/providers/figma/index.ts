// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import type { ProviderRegistration } from '../../registry.js';
import { createFigmaTools } from './tools.js';

export const figmaProvider: ProviderRegistration = {
  integrationId: 'figma',
  envVar: 'MASTRA_FIGMA_CONNECTION_ID',
  createTools: createFigmaTools,
};

export { createFigmaTools };
