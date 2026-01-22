/**
 * EE Authentication Interfaces
 *
 * These interfaces define the contracts for enterprise authentication features.
 * Implement these interfaces to enable advanced auth capabilities in Studio.
 *
 * @packageDocumentation
 */

// User awareness
export type { EEUser, IUserProvider } from './user';

// Session management
export type { Session, ISessionProvider } from './session';

// SSO
export type { SSOLoginConfig, SSOCallbackResult, ISSOProvider } from './sso';

// Credentials
export type { CredentialsResult, ICredentialsProvider } from './credentials';

// RBAC
export type { RoleDefinition, RoleMapping, IRBACProvider, IRBACManager } from './rbac';

// ACL
export type { ResourceIdentifier, ACLGrant, IACLProvider, IACLManager } from './acl';
