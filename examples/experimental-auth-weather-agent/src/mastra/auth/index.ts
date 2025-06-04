// Import auth providers
import { MastraAuthFirebase } from '@mastra/auth-firebase';
import { MastraAuthSupabase } from '@mastra/auth-supabase';
import { MastraAuthAuth0 } from '@mastra/auth-auth0';
import { MastraAuthWorkos } from '@mastra/auth-workos';
import { MastraAuthClerk } from '@mastra/auth-clerk';
import { MastraJwtAuth } from '@mastra/auth';

// Get the configured auth provider based on environment
export function getAuthProvider() {
  const provider = process.env.AUTH_PROVIDER?.toLowerCase();

  switch (provider) {
    case 'auth0':
      return new MastraAuthAuth0();
    case 'firebase':
      return new MastraAuthFirebase();
    case 'supabase':
      return new MastraAuthSupabase();
    case 'workos':
      return new MastraAuthWorkos();
    case 'clerk':
      return new MastraAuthClerk();
    case 'jwt':
    default:
      return new MastraJwtAuth();
  }
}

export const authConfig = getAuthProvider();
