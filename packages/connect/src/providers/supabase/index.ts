// AUTO-GENERATED from NangoHQ/integration-templates @ 56c9369bd7c6 — do not edit by hand.
import type { ProviderRegistration } from '../../registry.js';
import { createSupabaseTools } from './tools.js';

export const supabaseProvider: ProviderRegistration = {
  integrationId: 'supabase',
  envVar: 'MASTRA_SUPABASE_CONNECTION_ID',
  createTools: createSupabaseTools,
};

export { createSupabaseTools };
