/**
 * Auth configuration for the example agent.
 *
 * Supports three authentication providers:
 * - SimpleAuth: Token-based authentication for development/testing
 * - Better Auth: Credentials-based authentication with SQLite
 * - WorkOS: Enterprise SSO (SAML, OIDC)
 *
 * Set AUTH_PROVIDER environment variable to switch between providers.
 */

import type { AuthResult, AuthProviderType } from './types';

const AUTH_PROVIDER: AuthProviderType = (process.env.AUTH_PROVIDER as AuthProviderType) || 'simple';

async function initAuth(): Promise<AuthResult> {
  switch (AUTH_PROVIDER) {
    case 'simple': {
      const { initSimpleAuth } = await import('./simple');
      return initSimpleAuth();
    }
    case 'better-auth': {
      const { initBetterAuth } = await import('./better-auth');
      return initBetterAuth();
    }
    case 'workos': {
      const { initWorkOS } = await import('./workos');
      return initWorkOS();
    }
    default: {
      console.warn(`[Auth] Unknown provider "${AUTH_PROVIDER}", falling back to SimpleAuth`);
      const { initSimpleAuth } = await import('./simple');
      return initSimpleAuth();
    }
  }
}

const { mastraAuth, rbacProvider, auth } = await initAuth();

export { mastraAuth, rbacProvider, auth };
export type { AuthResult, AuthProviderType } from './types';
