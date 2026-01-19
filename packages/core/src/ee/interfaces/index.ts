/**
 * EE Authentication Interfaces
 *
 * These interfaces define the contracts for enterprise authentication features.
 * Implement these interfaces to enable advanced auth capabilities in Studio.
 *
 * @packageDocumentation
 */

export type { EEUser, IUserProvider } from './user.js';
export type { Session, ISessionProvider } from './session.js';
export type { ISSOProvider, SSOLoginConfig, SSOCallbackResult, SSOTokens } from './sso.js';
export type { ICredentialsProvider, CredentialsResult } from './credentials.js';
export type { IRBACProvider, RoleMapping, Role } from './rbac.js';
export type { IACLProvider, IACLManager, ResourceIdentifier, ACLGrant } from './acl.js';
export type {
  IAuditLogger,
  AuditEvent,
  AuditActor,
  AuditActorType,
  AuditOutcome,
  AuditResource,
  AuditFilter,
  AuditExportFormat,
} from './audit.js';
