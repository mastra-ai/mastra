// Import auth providers
import { MastraAuthFirebase } from '@mastra/auth-firebase';
import { MastraAuthSupabase } from '@mastra/auth-supabase';
import { MastraAuthWorkos } from '@mastra/auth-workos';
import { MastraAuthClerk } from '@mastra/auth-clerk';
import { MastraAuthAuth0 } from '@mastra/auth-auth0';

// Get the configured auth provider based on environment
export function getAuthProvider() {
  const provider = process.env.AUTH_PROVIDER?.toLowerCase() || 'supabase';

  switch (provider) {
    case 'firebase':
      return new MastraAuthFirebase();
    case 'workos':
      return new MastraAuthWorkos();
    case 'clerk':
      return new MastraAuthClerk();
    case 'auth0':
      return new MastraAuthAuth0();
    case 'supabase':
    default:
      return new MastraAuthSupabase(); // Default to Supabase
  }
}

export const authConfig = getAuthProvider();
