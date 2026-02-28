/**
 * Authentication Interfaces
 *
 * These interfaces define the contracts for authentication features.
 * For enterprise features (RBAC, ACL), see `@mastra/core/auth/ee`.
 *
 * @packageDocumentation
 */

// User
export type { User, EEUser, IUserProvider } from './user';

// Session management
export type { Session, ISessionProvider } from './session';

// SSO
export type { SSOLoginConfig, SSOCallbackResult, ISSOProvider } from './sso';

// Credentials
export type { CredentialsResult, ICredentialsProvider } from './credentials';
