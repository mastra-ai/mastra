/**
 * Shared types for auth providers.
 */

import type { EEUser, StaticRBACProvider, RBACProvider } from '@mastra/core/ee';
import type { MastraAuthProvider } from '@mastra/core/server';

export interface AuthResult {
  mastraAuth: MastraAuthProvider<EEUser>;
  rbacProvider: StaticRBACProvider<EEUser> | RBACProvider<EEUser>;
  auth?: unknown; // Better Auth instance (only for better-auth provider)
}

export type AuthProviderType = 'simple' | 'better-auth' | 'workos';
