/**
 * Supabase authentication provider for Studio login.
 *
 * Supports both credentials (email/password) and SSO (OAuth 2.1 Server) login.
 *
 * Required environment variables:
 * - SUPABASE_URL: Your Supabase project URL
 * - SUPABASE_ANON_KEY: Your Supabase anonymous/public key
 * - SUPABASE_COOKIE_PASSWORD: Min 32 chars for session encryption
 *
 * Optional (for SSO via Supabase OAuth Server):
 * - SUPABASE_OAUTH_CLIENT_ID: OAuth app client ID from Supabase dashboard
 * - SUPABASE_OAUTH_CLIENT_SECRET: OAuth app client secret
 *
 * Optional:
 * - SUPABASE_SERVICE_ROLE_KEY: For admin user lookup via Supabase Admin API
 */
import { MastraAuthSupabase } from '@mastra/auth-supabase';
import type { AuthResult } from './types';

export function initSupabase(): AuthResult {
  const mastraAuth = new MastraAuthSupabase({
    session: {
      cookiePassword: process.env.SUPABASE_COOKIE_PASSWORD,
    },
    sso: {
      oauthClientId: process.env.SUPABASE_OAUTH_CLIENT_ID,
      oauthClientSecret: process.env.SUPABASE_OAUTH_CLIENT_SECRET,
    },
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });

  return { mastraAuth };
}
