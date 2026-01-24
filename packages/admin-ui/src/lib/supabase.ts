import { createClient, SupabaseClient, Session, User } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const isDevMode = import.meta.env.VITE_DEV_MODE === 'true';

// Dev mode mock user and session
const DEV_USER: User = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'demo@example.com',
  app_metadata: {},
  user_metadata: { name: 'Demo User' },
  aud: 'authenticated',
  created_at: new Date().toISOString(),
};

const DEV_SESSION: Session = {
  access_token: 'dev-token',
  refresh_token: 'dev-refresh-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: DEV_USER,
};

// Mock Supabase client for dev mode
class DevSupabaseClient {
  auth = {
    getSession: async () => ({ data: { session: DEV_SESSION }, error: null }),
    onAuthStateChange: (callback: (event: string, session: Session | null) => void) => {
      // Immediately fire with dev session
      setTimeout(() => callback('SIGNED_IN', DEV_SESSION), 0);
      return { data: { subscription: { unsubscribe: () => {} } } };
    },
    signInWithPassword: async () => ({ data: { session: DEV_SESSION, user: DEV_USER }, error: null }),
    signUp: async () => ({ data: { session: DEV_SESSION, user: DEV_USER }, error: null }),
    signOut: async () => ({ error: null }),
    resetPasswordForEmail: async () => ({ error: null }),
  };
}

let supabase: SupabaseClient | DevSupabaseClient;

if (isDevMode) {
  console.log('[Dev Mode] Using mock Supabase client');
  supabase = new DevSupabaseClient() as unknown as SupabaseClient;
} else {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables. Set VITE_DEV_MODE=true for development without Supabase.');
  }
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

export { supabase };
export type { Session, User };
