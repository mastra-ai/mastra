import { MastraAuthBetterAuth } from '@mastra/auth-better-auth';
import { MastraAuthWorkos } from '@mastra/auth-workos';
import type { IMastraAuthProvider } from '@mastra/core/server';

interface WebAuthProviderConfig {
  disabled: boolean;
  studioConfigured: boolean;
  workosConfigured: boolean;
  workosRedirectUri: string | undefined;
  betterAuthSecret: string | undefined;
  betterAuthSignUpEnabled: boolean;
}

/** Applies the documented auth-provider precedence for the web deployment. */
export function createWebAuthProvider({
  disabled,
  studioConfigured,
  workosConfigured,
  workosRedirectUri,
  betterAuthSecret,
  betterAuthSignUpEnabled,
}: WebAuthProviderConfig): IMastraAuthProvider | null | undefined {
  if (disabled) return null;
  if (studioConfigured) return undefined;
  if (workosConfigured) {
    return new MastraAuthWorkos({ redirectUri: workosRedirectUri, fetchMemberships: true });
  }
  if (betterAuthSecret) {
    return new MastraAuthBetterAuth({ secret: betterAuthSecret, signUpEnabled: betterAuthSignUpEnabled });
  }
  return undefined;
}
