// AUTO-GENERATED from NangoHQ/integration-templates @ <SHA> — do not edit by hand.
// Side-effect: registers the linear provider with the PROVIDERS registry on import.
import { PROVIDERS } from '../../registry.js';
import { createLinearTools } from './tools.js';

PROVIDERS.push({
  integrationId: 'linear',
  envVar: 'MASTRA_LINEAR_CONNECTION_ID',
  createTools: createLinearTools,
});

export { createLinearTools };
