import type { EEUser, IRBACProvider, StaticRBACProvider } from '@mastra/core/auth/ee';
import type { MastraAuthProvider } from '@mastra/core/server';

export interface AuthResult {
  mastraAuth?: MastraAuthProvider<EEUser>;
  rbacProvider?: StaticRBACProvider<EEUser> | IRBACProvider<EEUser>;
}

export type AuthProviderType = 'workos' | undefined;
