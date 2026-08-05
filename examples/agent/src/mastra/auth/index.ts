/**
 * Auth configuration for the example agent.
 *
 * Supports multiple authentication providers:
 * - simple: Token-based authentication for development/testing
 * - better-auth: Credentials-based authentication with SQLite
 * - workos: Enterprise SSO (SAML, OIDC)
 * - cloud: Mastra platform OAuth with PKCE
 * - composite: Combines SimpleAuth + MastraCloudAuth via CompositeAuth
 * - clerk: Clerk JWT-based authentication
 * - auth0-okta: Auth0 for authentication + Okta for RBAC (cross-provider)
 * - okta: Full Okta for both authentication and RBAC
 *
 * Set AUTH_PROVIDER environment variable to switch between providers.
 */

import type { AuthResult, AuthProviderType } from './types';

const AUTH_PROVIDER: AuthProviderType = process.env.AUTH_PROVIDER as AuthProviderType;

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
    case 'clerk': {
      const { initClerk } = await import('./clerk');
      return initClerk();
    }
    case 'cloud': {
      const { initCloud } = await import('./cloud');
      return initCloud();
    }
    case 'composite': {
      const { initComposite } = await import('./composite');
      return initComposite();
    }
    case 'auth0': {
      const { initAuth0 } = await import('./auth0');
      return initAuth0();
    }
    case 'auth0-okta': {
      const { initAuth0Okta } = await import('./auth0-okta');
      return initAuth0Okta();
    }
    case 'okta': {
      const { initOkta } = await import('./okta');
      return initOkta();
    }
    case 'studio': {
      const { initStudio } = await import('./studio');
      return initStudio();
    }
    case 'dual-workos': {
      const { initDualWorkOS } = await import('./dual-workos');
      return initDualWorkOS();
    }
    default:
      return {};
  }
}

const {
  mastraAuth,
  rbacProvider,
  fgaProvider,
  auth,
  // Dual auth providers
  studioAuth,
  studioRbac,
  studioFga,
  serverAuth,
  serverRbac,
  serverFga,
} = await initAuth();

export {
  mastraAuth,
  rbacProvider,
  fgaProvider,
  auth,
  studioAuth,
  studioRbac,
  studioFga,
  serverAuth,
  serverRbac,
  serverFga,
};
export type { AuthResult, AuthProviderType } from './types';
