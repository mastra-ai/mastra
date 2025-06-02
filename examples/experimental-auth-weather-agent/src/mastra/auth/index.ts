import { MastraAuthSupabase } from '@mastra/auth-supabase';
import { MastraJwtAuth } from '@mastra/auth';

export function getAuthProvider() {
  const provider = process.env.AUTH_PROVIDER?.toLowerCase();

  switch (provider) {
    case 'supabase':
      return new MastraAuthSupabase();
    case 'jwt':
    default:
      return new MastraJwtAuth();
  }
}

export const authConfig = getAuthProvider();
