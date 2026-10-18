// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import type { ProviderRegistration } from '../../registry.js';
import { createSnowflakeTools } from './tools.js';

export const snowflakeProvider: ProviderRegistration = {
  integrationId: 'snowflake',
  envVar: 'MASTRA_SNOWFLAKE_CONNECTION_ID',
  createTools: createSnowflakeTools,
};

export { createSnowflakeTools };
