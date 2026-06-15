/**
 * Shared types for auth providers.
 */

import type { EEUser, StaticRBACProvider, IRBACProvider, IFGAProvider } from '@mastra/core/auth/ee';
import type { MastraAuthProvider } from '@mastra/core/server';

export interface AuthResult {
  mastraAuth?: MastraAuthProvider<EEUser>;
  rbacProvider?: StaticRBACProvider<EEUser> | IRBACProvider<EEUser>;
  fgaProvider?: IFGAProvider<EEUser>;
  auth?: unknown; // Better Auth instance (only for better-auth provider)
  // Dual auth support - separate providers for Studio vs Server
  studioAuth?: MastraAuthProvider<EEUser>;
  studioRbac?: StaticRBACProvider<EEUser> | IRBACProvider<EEUser>;
  studioFga?: IFGAProvider<EEUser>;
  serverAuth?: MastraAuthProvider<EEUser>;
  serverRbac?: StaticRBACProvider<EEUser> | IRBACProvider<EEUser>;
  serverFga?: IFGAProvider<EEUser>;
}

export type AuthProviderType =
  | 'simple'
  | 'better-auth'
  | 'clerk'
  | 'workos'
  | 'cloud'
  | 'composite'
  | 'auth0'
  | 'auth0-okta'
  | 'okta'
  | 'studio'
  | 'dual-workos';
