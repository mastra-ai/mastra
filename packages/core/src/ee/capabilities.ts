/**
 * Authentication Capabilities Detection
 *
 * This module provides functions for detecting and building capability responses
 * for both public (unauthenticated) and authenticated contexts.
 *
 * @packageDocumentation
 */

import type { EEUser } from './interfaces/user.js';
import type { SSOLoginConfig } from './interfaces/sso.js';
import type { MastraAuthProvider, CapabilityFlags } from './auth-provider.js';
import { isEELicenseValid } from './license.js';

/**
 * Login configuration for the capabilities API
 */
export interface LoginConfig {
  /** Login type: SSO only, credentials only, or both */
  type: 'sso' | 'credentials' | 'both';
  /** Whether sign up is enabled for credentials login */
  signUpEnabled?: boolean;
  /** SSO provider configuration (if SSO is available) */
  sso?: SSOLoginConfig;
}

/**
 * Public authentication capabilities available without authentication.
 * This is used to render the login page and determine available auth methods.
 */
export interface PublicAuthCapabilities {
  /** Whether authentication is enabled */
  enabled: boolean;
  /** Login configuration (available auth methods) */
  login?: LoginConfig;
}

/**
 * User access information (roles and permissions)
 */
export interface UserAccess {
  /** User's roles */
  roles: string[];
  /** User's effective permissions */
  permissions: string[];
}

/**
 * Authenticated capabilities available after successful authentication.
 * Extends public capabilities with user context and feature flags.
 */
export interface AuthenticatedCapabilities extends PublicAuthCapabilities {
  /** Authenticated user information */
  user: EEUser;
  /** Feature capability flags */
  capabilities: CapabilityFlags;
  /** User's access context (roles and permissions) */
  access?: UserAccess;
}

/**
 * Build public capabilities from an auth provider.
 *
 * This function determines what authentication methods are available
 * and returns configuration suitable for rendering a login page.
 *
 * License check is integrated - if no valid license and provider is not
 * Mastra Cloud Auth, capabilities will be disabled.
 *
 * @param provider - The auth provider to inspect
 * @returns Public capabilities
 */
export function buildPublicCapabilities<TUser extends EEUser>(
  provider: MastraAuthProvider<TUser>,
): PublicAuthCapabilities {
  // Check license validity (bypass for Mastra Cloud Auth)
  if (!provider.isMastraCloudAuth && !isEELicenseValid()) {
    return {
      enabled: false,
    };
  }

  const hasSso = !!provider.sso;
  const hasCredentials = !!provider.credentials;

  // If no auth methods available, auth is disabled
  if (!hasSso && !hasCredentials) {
    return {
      enabled: false,
    };
  }

  // Determine login type
  let loginType: LoginConfig['type'];
  if (hasSso && hasCredentials) {
    loginType = 'both';
  } else if (hasSso) {
    loginType = 'sso';
  } else {
    loginType = 'credentials';
  }

  // Build login config
  const login: LoginConfig = {
    type: loginType,
  };

  // Add SSO configuration if available
  if (hasSso && provider.sso) {
    login.sso = provider.sso.getLoginButtonConfig();
  }

  // Add credentials configuration if available
  if (hasCredentials && provider.credentials) {
    login.signUpEnabled = provider.credentials.isSignUpEnabled?.() ?? true;
  }

  return {
    enabled: true,
    login,
  };
}

/**
 * Build authenticated capabilities from an auth provider and user.
 *
 * This function extends public capabilities with user context, feature flags,
 * and access information (roles and permissions).
 *
 * @param provider - The auth provider to inspect
 * @param user - The authenticated user
 * @returns Authenticated capabilities
 */
export async function buildAuthenticatedCapabilities<TUser extends EEUser>(
  provider: MastraAuthProvider<TUser>,
  user: TUser,
): Promise<AuthenticatedCapabilities> {
  // Start with public capabilities
  const publicCapabilities = buildPublicCapabilities(provider);

  // Build capability flags
  const capabilities: CapabilityFlags = {
    user: !!provider.user,
    session: !!provider.session,
    sso: !!provider.sso,
    credentials: !!provider.credentials,
    rbac: !!provider.rbac,
    acl: !!provider.acl,
    audit: !!provider.audit,
  };

  // Build user access (roles and permissions) if RBAC is available
  let access: UserAccess | undefined;
  if (provider.rbac) {
    const roles = await provider.rbac.getRoles(user);
    const permissions = await provider.rbac.getPermissions(user);
    access = { roles, permissions };
  }

  return {
    ...publicCapabilities,
    user,
    capabilities,
    access,
  };
}

/**
 * Build capabilities response based on auth configuration and request state.
 *
 * This unified function handles both public (unauthenticated) and authenticated cases.
 * If a user is authenticated (determined by calling getCurrentUser), returns full
 * authenticated capabilities. Otherwise, returns public capabilities only.
 *
 * @param provider - The auth provider (or null if auth not configured)
 * @param request - The incoming HTTP request
 * @returns Public or authenticated capabilities
 */
export async function buildCapabilities<TUser extends EEUser>(
  provider: MastraAuthProvider<TUser> | null,
  request: Request,
): Promise<PublicAuthCapabilities | AuthenticatedCapabilities> {
  // No provider means auth is not configured
  if (!provider) {
    return {
      enabled: false,
    };
  }

  // Try to get current user if user provider is available
  let user: TUser | null = null;
  if (provider.user) {
    try {
      user = await provider.user.getCurrentUser(request);
    } catch {
      // User not authenticated or session invalid
      user = null;
    }
  }

  // If no user, return public capabilities only
  if (!user) {
    return buildPublicCapabilities(provider);
  }

  // User is authenticated, return full capabilities
  return buildAuthenticatedCapabilities(provider, user);
}
