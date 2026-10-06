/**
 * Shared types for the generic OpenID Connect integration.
 */

import type { EEUser } from '@internal/auth/ee';
import type { MastraAuthProviderOptions } from '@internal/auth/provider';
import type { JWTPayload } from 'jose';
import type { ServerMetadata } from 'openid-client';

// ============================================================================
// User Types
// ============================================================================

/**
 * User built from standard OpenID Connect claims.
 */
export interface OidcUser extends EEUser {
  /** The `sub` claim — the provider's stable identifier for the user */
  sub: string;
  /** Groups from the `groups` claim, when the provider sends one */
  groups?: string[];
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}

/**
 * Maps standard OpenID Connect claims to an {@link OidcUser}.
 *
 * Only claims defined by the OIDC core spec are read, so this works with any
 * compliant provider. Pass `mapClaims` to the provider to read custom claims.
 *
 * @param payload - Verified ID token or access token payload
 * @returns The mapped user
 */
export function mapOidcClaimsToUser(payload: JWTPayload): OidcUser {
  const sub = asString(payload.sub) ?? '';
  const email = asString(payload.email);
  const fullName = [asString(payload.given_name), asString(payload.family_name)].filter(Boolean).join(' ');

  return {
    id: sub,
    sub,
    email,
    name: asString(payload.name) ?? (fullName || asString(payload.preferred_username) || email),
    avatarUrl: asString(payload.picture),
    groups: Array.isArray(payload.groups)
      ? payload.groups.filter((g): g is string => typeof g === 'string')
      : undefined,
    metadata: {
      emailVerified: payload.email_verified,
      preferredUsername: payload.preferred_username,
    },
  };
}

// ============================================================================
// Options
// ============================================================================

/**
 * Client authentication method used at the token endpoint.
 */
export type OidcTokenEndpointAuthMethod = 'client_secret_post' | 'client_secret_basic' | 'none';

/**
 * Session cookie configuration for {@link MastraAuthOidc}.
 */
export interface OidcSessionOptions {
  /** Cookie name (default: 'oidc_session') */
  cookieName?: string;
  /** Cookie max age in seconds (default: 86400 = 24 hours) */
  cookieMaxAge?: number;
  /**
   * Password for encrypting session cookies. Must be at least 32 characters.
   * Defaults to the OIDC_COOKIE_PASSWORD env var.
   */
  cookiePassword?: string;
  /**
   * Set the `Secure` flag on session cookies.
   * Defaults to true when NODE_ENV=production, false otherwise.
   */
  secureCookies?: boolean;
}

/**
 * Options for {@link MastraAuthOidc}.
 */
export interface MastraAuthOidcOptions extends MastraAuthProviderOptions<OidcUser> {
  /**
   * Issuer URL of the OpenID Provider, e.g. `https://id.example.com/realms/acme`.
   * Endpoints are discovered from `{issuer}/.well-known/openid-configuration`.
   * Defaults to the OIDC_ISSUER env var.
   */
  issuer?: string;
  /** OAuth client ID. Defaults to the OIDC_CLIENT_ID env var. */
  clientId?: string;
  /**
   * OAuth client secret. Defaults to the OIDC_CLIENT_SECRET env var.
   * Setting it enables the SSO login flow.
   */
  clientSecret?: string;
  /**
   * Redirect URI registered with the provider for the SSO callback.
   * Defaults to the OIDC_REDIRECT_URI env var.
   */
  redirectUri?: string;
  /**
   * Expected `aud` claim when verifying Bearer tokens. Defaults to the
   * OIDC_AUDIENCE env var, then to the client ID (the ID token audience).
   * Pass an array to accept more than one.
   */
  audience?: string | string[];
  /**
   * Scopes to request during login.
   * Defaults to the OIDC_SCOPES env var (comma or space separated),
   * then to `['openid', 'profile', 'email']`.
   */
  scopes?: string[];
  /**
   * Authorization Server Metadata to use instead of running discovery. Provide
   * this for providers that publish no discovery document.
   */
  serverMetadata?: ServerMetadata;
  /**
   * Client authentication method at the token endpoint
   * (default: `'client_secret_post'`).
   */
  tokenEndpointAuthMethod?: OidcTokenEndpointAuthMethod;
  /**
   * Allow plain HTTP requests to the provider. Only for local development or a
   * trusted private network; tokens and secrets travel in clear text.
   */
  allowInsecureRequests?: boolean;
  /**
   * Display name of the identity provider, used for the Studio login button
   * (default: 'SSO').
   */
  label?: string;
  /** Map verified token claims to a user. Defaults to {@link mapOidcClaimsToUser}. */
  mapClaims?: (payload: JWTPayload) => OidcUser;
  /** Session cookie configuration. */
  session?: OidcSessionOptions;
}

export type { ServerMetadata };
