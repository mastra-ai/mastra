/**
 * Auth configuration for the Agent Builder example.
 *
 * Set `AUTH_PROVIDER=workos` to enable WorkOS SSO. Leave unset to run
 * without authentication — everything works, but per-user features
 * (stars, preview mode, project ownership) fall back to shared state.
 */

import type { AuthProviderType, AuthResult } from './types';

const AUTH_PROVIDER = process.env.AUTH_PROVIDER as AuthProviderType;

async function initAuth(): Promise<AuthResult> {
  switch (AUTH_PROVIDER) {
    case 'workos': {
      const { initWorkOS } = await import('./workos');
      return initWorkOS();
    }
    default:
      console.log('[Auth] No AUTH_PROVIDER set — running without authentication');
      return {};
  }
}

const { mastraAuth, rbacProvider } = await initAuth();

export { mastraAuth, rbacProvider };
export type { AuthProviderType, AuthResult } from './types';
