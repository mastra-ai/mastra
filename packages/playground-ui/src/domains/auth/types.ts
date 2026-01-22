/**
 * Auth types for EE authentication in playground-ui.
 *
 * These types mirror the server schemas from @mastra/server.
 */

/**
 * SSO configuration for login
 */
export type SSOConfig = {
  provider: string;
  text: string;
  icon?: string;
  url: string;
};

/**
 * Login configuration
 */
export type LoginConfig = {
  type: 'sso' | 'credentials' | 'both';
  /** Whether sign-up is enabled (defaults to true) */
  signUpEnabled?: boolean;
  sso?: SSOConfig;
} | null;

/**
 * Public capabilities (unauthenticated)
 */
export type PublicAuthCapabilities = {
  enabled: boolean;
  login: LoginConfig;
};

/**
 * Authenticated user information
 */
export type AuthenticatedUser = {
  id: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
};

/**
 * Capability flags
 */
export type CapabilityFlags = {
  user: boolean;
  session: boolean;
  sso: boolean;
  rbac: boolean;
  acl: boolean;
};

/**
 * User access information
 */
export type UserAccess = {
  roles: string[];
  permissions: string[];
} | null;

/**
 * Authenticated capabilities (extends public)
 */
export type AuthenticatedCapabilities = PublicAuthCapabilities & {
  user: AuthenticatedUser;
  capabilities: CapabilityFlags;
  access: UserAccess;
};

/**
 * Auth capabilities response (union of public and authenticated)
 */
export type AuthCapabilities = PublicAuthCapabilities | AuthenticatedCapabilities;

/**
 * Current user response (may be null if not authenticated)
 */
export type CurrentUser = {
  id: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
  roles?: string[];
  permissions?: string[];
} | null;

/**
 * SSO login response
 */
export type SSOLoginResponse = {
  url: string;
};

/**
 * SSO callback response
 */
export type SSOCallbackResponse = {
  success: boolean;
  user?: AuthenticatedUser;
  redirectTo?: string;
};

/**
 * Logout response
 */
export type LogoutResponse = {
  success: boolean;
  redirectTo?: string;
};

/**
 * Type guard to check if capabilities include authenticated user
 */
export function isAuthenticated(capabilities: AuthCapabilities): capabilities is AuthenticatedCapabilities {
  return 'user' in capabilities && capabilities.user !== undefined;
}
