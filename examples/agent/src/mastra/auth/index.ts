/**
 * Auth configuration for the example agent.
 *
 * Supports multiple authentication providers:
 * - simple: Token-based authentication for development/testing
 * - better-auth: Credentials-based authentication with SQLite
 * - workos: Enterprise SSO (SAML, OIDC)
 * - cloud: Mastra Cloud OAuth with PKCE
 * - composite: Combines SimpleAuth + MastraCloudAuth via CompositeAuth
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
    case 'cloud': {
      const { initCloud } = await import('./cloud');
      return initCloud();
    }
    case 'composite': {
      const { initComposite } = await import('./composite');
      return initComposite();
    }
    case 'simple': {
      const { initSimpleAuth } = await import('./simple');
      return initSimpleAuth();
    }
    default:
      return {};
  }
}

const { mastraAuth, rbacProvider, auth } = await initAuth();

export { mastraAuth, rbacProvider, auth };
export type { AuthResult, AuthProviderType } from './types';
