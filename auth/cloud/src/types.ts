/**
 * Core types for Mastra Cloud authentication.
 *
 * These types define the data structures used throughout
 * the OAuth flow and session management.
 */

/**
 * Authenticated user from Mastra Cloud.
 */
export interface CloudUser {
  /** Unique user identifier (or 'api-token' for project API tokens) */
  id: string;
  /** User's email address (undefined for project API tokens) */
  email?: string;
  /** User's display name */
  name?: string;
  /** URL to user's avatar image */
  avatar?: string;
  /** User's role from /verify endpoint (not JWT claims) */
  role?: string;
}

/**
 * Session data stored for an authenticated user.
 */
export interface CloudSession {
  /** ID of the user this session belongs to */
  userId: string;
  /** Unix timestamp (ms) when session expires */
  expiresAt: number;
  /** Unix timestamp (ms) when session was created */
  createdAt: number;
}

/**
 * Response from the Cloud /verify endpoint.
 */
export interface VerifyResponse {
  /** Authenticated user information */
  user: CloudUser;
  /** User's role in the organization */
  role: string;
}

/**
 * Result from processing OAuth callback.
 */
export interface CallbackResult {
  /** Authenticated user information */
  user: CloudUser;
  /** Access token for API calls */
  accessToken: string;
  /** URL to redirect user to after login */
  returnTo: string;
  /** Cookies to set on response (session, clear PKCE, etc.) */
  cookies: string[];
}

/**
 * Result from generating login URL.
 */
export interface LoginUrlResult {
  /** Full authorization URL to redirect to */
  url: string;
  /** Cookies to set on response (PKCE state, etc.) */
  cookies: string[];
}
