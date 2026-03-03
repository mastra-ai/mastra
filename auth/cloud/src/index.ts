/**
 * @mastra/auth-cloud
 *
 * Mastra Cloud authentication with PKCE OAuth flow.
 *
 * This is the v2.0 rewrite implementing proper PKCE-based OAuth
 * with role information from the /verify endpoint.
 *
 * @packageDocumentation
 */

// Client class (main API)
export { MastraCloudAuth } from './client';
export type { MastraCloudAuthConfig } from './client';

// Server provider (extends MastraAuthProvider)
export { MastraCloudAuthProvider } from './auth-provider';
export type { MastraCloudAuthProviderOptions } from './auth-provider';

// Error types
export { AuthError } from './error';
export type { AuthErrorCode, AuthErrorOptions } from './error';

// Data types
export type { CloudUser, CloudSession, VerifyResponse, CallbackResult, LoginUrlResult } from './types';

// RBAC
export { MastraRBACCloud, type MastraRBACCloudOptions } from './rbac';
