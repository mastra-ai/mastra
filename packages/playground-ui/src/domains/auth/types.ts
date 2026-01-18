/**
 * Auth domain types
 * These match the server schemas from packages/server/src/server/schemas/auth.ts
 */

export interface SSOConfig {
  provider: string;
  text: string;
  icon?: string;
  url: string;
}

export interface LoginConfig {
  type: 'sso' | 'credentials' | 'both';
  signUpEnabled?: boolean;
  sso?: SSOConfig;
}

export interface AuthenticatedUser {
  id: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
}

export interface CapabilityFlags {
  user: boolean;
  session: boolean;
  sso: boolean;
  credentials: boolean;
  rbac: boolean;
  acl: boolean;
  audit: boolean;
}

export interface UserAccess {
  roles: string[];
  permissions: string[];
}

export interface PublicAuthCapabilities {
  enabled: boolean;
  login: LoginConfig | null;
}

export interface AuthenticatedCapabilities extends PublicAuthCapabilities {
  user: AuthenticatedUser;
  capabilities: CapabilityFlags;
  access: UserAccess | null;
}

export type AuthCapabilities = PublicAuthCapabilities | AuthenticatedCapabilities;

// Type guard to check if capabilities are authenticated
export function isAuthenticated(capabilities: AuthCapabilities): capabilities is AuthenticatedCapabilities {
  return 'user' in capabilities;
}
