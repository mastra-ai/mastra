/**
 * Shared types for auth providers.
 */

import type { EEUser, StaticRBACProvider, IRBACProvider } from '@mastra/core/auth/ee';
import type { MastraAuthProvider } from '@mastra/core/server';

export interface AuthResult {
  mastraAuth?: MastraAuthProvider<EEUser>;
  rbacProvider?: StaticRBACProvider<EEUser> | IRBACProvider<EEUser>;
  auth?: unknown; // Better Auth instance (only for better-auth provider)
}

export type AuthProviderType =
  | 'simple'
  | 'better-auth'
  | 'workos'
  | 'cloud'
  | 'composite'
  | 'auth0-okta'
  | 'okta'
  | 'studio';
