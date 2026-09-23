// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import type { ProviderRegistration } from '../../registry.js';
import { createSupabaseTools } from './tools.js';

export const supabaseProvider: ProviderRegistration = {
  integrationId: 'supabase',
  envVar: 'MASTRA_SUPABASE_CONNECTION_ID',
  createTools: createSupabaseTools,
};

export { createSupabaseTools };
