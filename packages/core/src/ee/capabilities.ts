/**
 * Capabilities detection and response building for EE authentication.
 */

import type { MastraAuthProvider } from '../server';
import type {
  EEUser,
  IUserProvider,
  ISSOProvider,
  IRBACProvider,
  IACLProvider,
  ISessionProvider,
  IAuditLogger,
} from './interfaces';
import { isEELicenseValid } from './license';

/**
 * Public capabilities response (no authentication required).
 * Contains just enough info to render the login page.
 */
export interface PublicAuthCapabilities {
  /** Whether auth is enabled */
  enabled: boolean;
  /** Login configuration (null if no auth or no SSO) */
  login: {
    /** Type of login available */
    type: 'sso' | 'credentials' | 'both';
    /** SSO configuration */
    sso?: {
      /** Provider name */
      provider: string;
      /** Button text */
      text: string;
      /** Icon URL */
      icon?: string;
      /** Login URL */
      url: string;
    };
  } | null;
}

/**
 * User info for authenticated response.
 */
export interface AuthenticatedUser {
  /** User ID */
  id: string;
  /** User email */
  email?: string;
  /** Display name */
  name?: string;
  /** Avatar URL */
  avatarUrl?: string;
}

/**
 * Capability flags indicating which EE features are available.
 */
export interface CapabilityFlags {
  /** IUserProvider is implemented and licensed */
  user: boolean;
  /** ISessionProvider is implemented and licensed */
  session: boolean;
  /** ISSOProvider is implemented and licensed */
  sso: boolean;
  /** IRBACProvider is implemented and licensed */
  rbac: boolean;
  /** IACLProvider is implemented and licensed */
  acl: boolean;
  /** IAuditLogger is implemented and licensed */
  audit: boolean;
}

/**
 * User's access (roles and permissions).
 */
export interface UserAccess {
  /** User's roles */
  roles: string[];
  /** User's resolved permissions */
  permissions: string[];
}

/**
 * Authenticated capabilities response.
 * Extends public capabilities with user context and feature flags.
 */
export interface AuthenticatedCapabilities extends PublicAuthCapabilities {
  /** Current authenticated user */
  user: AuthenticatedUser;
  /** Available EE capabilities */
  capabilities: CapabilityFlags;
  /** User's access (if RBAC available) */
  access: UserAccess | null;
}

/**
 * Type guard to check if response is authenticated.
 */
export function isAuthenticated(
  caps: PublicAuthCapabilities | AuthenticatedCapabilities,
): caps is AuthenticatedCapabilities {
  return 'user' in caps && caps.user !== null;
}

/**
 * Check if an auth provider implements a specific interface.
 */
function implementsInterface<T>(auth: unknown, method: keyof T): auth is T {
  return auth !== null && typeof auth === 'object' && method in auth;
}

/**
 * Check if auth provider is MastraCloudAuth (exempt from license requirement).
 */
function isMastraCloudAuth(auth: unknown): boolean {
  if (!auth || typeof auth !== 'object') return false;
  // Check for the MastraCloudAuth marker
  return 'isMastraCloudAuth' in auth && (auth as { isMastraCloudAuth: boolean }).isMastraCloudAuth === true;
}

/**
 * Build capabilities response based on auth configuration and request state.
 *
 * This function determines what capabilities are available and, if the user
 * is authenticated, includes their user info and access permissions.
 *
 * @param auth - Auth provider (or null if no auth configured)
 * @param request - Incoming HTTP request
 * @returns Capabilities response (public or authenticated)
 */
export async function buildCapabilities(
  auth: MastraAuthProvider | null,
  request: Request,
): Promise<PublicAuthCapabilities | AuthenticatedCapabilities> {
  // No auth configured - disabled
  if (!auth) {
    return { enabled: false, login: null };
  }

  // Determine if EE features are available
  const hasLicense = isEELicenseValid();
  const isCloud = isMastraCloudAuth(auth);
  const isLicensedOrCloud = hasLicense || isCloud;

  // Build login configuration (always public)
  let login: PublicAuthCapabilities['login'] = null;

  const hasSSO = implementsInterface<ISSOProvider>(auth, 'getLoginUrl') && isLicensedOrCloud;
  const hasCredentials = implementsInterface<IUserProvider>(auth, 'getCurrentUser') && isLicensedOrCloud;

  if (hasSSO && hasCredentials) {
    const ssoConfig = (auth as ISSOProvider).getLoginButtonConfig();
    login = {
      type: 'both',
      sso: {
        ...ssoConfig,
        url: '/api/auth/sso/login',
      },
    };
  } else if (hasSSO) {
    const ssoConfig = (auth as ISSOProvider).getLoginButtonConfig();
    login = {
      type: 'sso',
      sso: {
        ...ssoConfig,
        url: '/api/auth/sso/login',
      },
    };
  } else if (hasCredentials) {
    // Credentials-only auth (e.g., Better Auth with email/password)
    login = {
      type: 'credentials',
    };
  }

  // Try to get current user (requires session)
  let user: EEUser | null = null;
  if (implementsInterface<IUserProvider>(auth, 'getCurrentUser') && isLicensedOrCloud) {
    try {
      user = await auth.getCurrentUser(request);
    } catch {
      // Session invalid or expired
      user = null;
    }
  }

  // If no user, return public response only
  if (!user) {
    return { enabled: true, login };
  }

  // Build capability flags
  const capabilities: CapabilityFlags = {
    user: implementsInterface<IUserProvider>(auth, 'getCurrentUser') && isLicensedOrCloud,
    session: implementsInterface<ISessionProvider>(auth, 'createSession') && isLicensedOrCloud,
    sso: implementsInterface<ISSOProvider>(auth, 'getLoginUrl') && isLicensedOrCloud,
    rbac: implementsInterface<IRBACProvider>(auth, 'getRoles') && isLicensedOrCloud,
    acl: implementsInterface<IACLProvider>(auth, 'canAccess') && isLicensedOrCloud,
    audit: implementsInterface<IAuditLogger>(auth, 'log') && isLicensedOrCloud,
  };

  // Get roles/permissions if RBAC available
  let access: UserAccess | null = null;
  if (capabilities.rbac && implementsInterface<IRBACProvider>(auth, 'getRoles')) {
    try {
      access = {
        roles: await auth.getRoles(user),
        permissions: await auth.getPermissions(user),
      };
    } catch {
      // RBAC failed, continue without access info
      access = null;
    }
  }

  return {
    enabled: true,
    login,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
    },
    capabilities,
    access,
  };
}
