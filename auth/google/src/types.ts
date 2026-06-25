/**
 * Shared types for Google Workspace authentication and RBAC.
 */

import type { EEUser, RoleMapping } from '@internal/auth/ee';
import type { MastraAuthProviderOptions } from '@internal/auth/provider';
import type { JWTPayload } from 'jose';

/**
 * Google user claims mapped to Mastra's enterprise user shape.
 */
export interface GoogleUser extends EEUser {
  /** Google Account subject identifier. */
  googleId: string;
  /** Verified ID token expiration time, when available. */
  expiresAt?: Date;
  /** Google Workspace or Cloud organization domain from the verified `hd` claim. */
  hostedDomain?: string;
  /** Whether Google reports the email address as verified. */
  emailVerified?: boolean;
  /** Optional Google Workspace group roles attached by a caller. */
  groups?: string[];
}

/**
 * Google Workspace Directory group returned by the Admin SDK Directory API.
 */
export interface GoogleWorkspaceGroup {
  /** Group unique ID. */
  id?: string;
  /** Primary group email address. */
  email: string;
  /** Display name. */
  name?: string;
  /** Optional description. */
  description?: string;
  /** Direct member count, returned as a string by the Directory API. */
  directMembersCount?: string;
}

/**
 * Maps verified Google ID token claims to GoogleUser format.
 */
export function mapGoogleClaimsToUser(payload: JWTPayload): GoogleUser {
  const googleId = (payload.sub as string) || '';
  const email = payload.email as string | undefined;
  const hostedDomain = payload.hd as string | undefined;
  const emailVerified = payload.email_verified as boolean | undefined;

  return {
    id: googleId,
    googleId,
    email,
    name:
      (payload.name as string) ||
      [payload.given_name, payload.family_name].filter(Boolean).join(' ') ||
      email ||
      undefined,
    avatarUrl: payload.picture as string | undefined,
    expiresAt: typeof payload.exp === 'number' ? new Date(payload.exp * 1000) : undefined,
    hostedDomain,
    emailVerified,
    groups: payload.groups as string[] | undefined,
    metadata: {
      googleId,
      hostedDomain,
      emailVerified,
      givenName: payload.given_name,
      familyName: payload.family_name,
    },
  };
}

/**
 * Session cookie configuration for MastraAuthGoogle.
 */
export interface GoogleSessionOptions {
  /** Cookie name for the session. Defaults to `google_session`. */
  cookieName?: string;
  /** Cookie max age in seconds. Defaults to 86400 (24 hours). */
  cookieMaxAge?: number;
  /**
   * Password for encrypting session cookies. Must be at least 32 characters.
   * Defaults to GOOGLE_COOKIE_PASSWORD.
   */
  cookiePassword?: string;
  /**
   * Set the Secure flag on session cookies.
   * Defaults to true when NODE_ENV=production, false otherwise.
   */
  secureCookies?: boolean;
}

/**
 * Options for MastraAuthGoogle.
 */
export interface MastraAuthGoogleOptions extends MastraAuthProviderOptions<GoogleUser> {
  /** Google OAuth client ID. Defaults to GOOGLE_CLIENT_ID. */
  clientId?: string;
  /** Google OAuth client secret. Defaults to GOOGLE_CLIENT_SECRET. Required for SSO. */
  clientSecret?: string;
  /** OAuth redirect URI for the SSO callback. Defaults to GOOGLE_REDIRECT_URI. */
  redirectUri?: string;
  /** OAuth scopes to request. Defaults to `['openid', 'profile', 'email']`. */
  scopes?: string[];
  /**
   * Allowed Google Workspace hosted domains.
   * Defaults to comma-separated GOOGLE_ALLOWED_DOMAINS.
   */
  allowedDomains?: string | string[];
  /**
   * Google OAuth hosted-domain login hint.
   * Defaults to GOOGLE_HOSTED_DOMAIN, or the single allowed domain when exactly one domain is configured.
   */
  hostedDomain?: string;
  /** Session configuration. */
  session?: GoogleSessionOptions;
}

/**
 * Service account configuration for Workspace Directory API access.
 */
export interface GoogleWorkspaceServiceAccount {
  /** Google service account email. */
  clientEmail: string;
  /** PEM-encoded private key. Supports escaped `\n` values from .env files. */
  privateKey: string;
  /** Optional private key ID. */
  privateKeyId?: string;
  /**
   * Google Workspace administrator user to impersonate with domain-wide delegation.
   * Required by most Admin SDK Directory API deployments.
   */
  subject?: string;
  /** OAuth scopes for the service account token. */
  scopes?: string[];
}

/**
 * Cache configuration for RBAC group lookups.
 */
export interface PermissionCacheOptions {
  /** Maximum number of users to cache. Defaults to 1000. */
  maxSize?: number;
  /** Time-to-live in milliseconds. Defaults to 60000. */
  ttlMs?: number;
}

/**
 * Options for MastraRBACGoogle.
 */
export interface MastraRBACGoogleOptions {
  /** Pre-obtained Workspace Directory API access token. */
  accessToken?: string;
  /** Callback that returns a Workspace Directory API access token. */
  getAccessToken?: () => Promise<string> | string;
  /** Service account credentials for domain-wide delegated Directory API access. */
  serviceAccount?: GoogleWorkspaceServiceAccount;
  /** Map Google Workspace group roles to Mastra permissions. */
  roleMapping: RoleMapping;
  /** Extract the Google Directory API userKey from any authenticated user object. Defaults to `user.email`. */
  getUserKey?: (user: unknown) => string | undefined;
  /** Map a Google Workspace group to one or more RBAC role IDs. Defaults to `[group.email]`. */
  mapGroupToRoles?: (group: GoogleWorkspaceGroup) => string[];
  /** Permission cache configuration. */
  cache?: PermissionCacheOptions;
}
