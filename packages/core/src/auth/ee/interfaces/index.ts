/**
 * EE Authentication Interfaces
 *
 * Enterprise interfaces for RBAC, ACL, and advanced authorization.
 *
 * @license Mastra Enterprise License - see ee/LICENSE
 * @packageDocumentation
 */

// EE User type
export type { EEUser } from './user';

// RBAC
export type { RoleDefinition, RoleMapping, IRBACProvider, IRBACManager } from './rbac';

// Permissions (generated from SERVER_ROUTES)
export type { Resource, Action, Permission, PermissionPattern, TypedRoleMapping } from './permissions.generated';
export {
  RESOURCES,
  ACTIONS,
  PERMISSIONS,
  PERMISSION_PATTERNS,
  isValidPermissionPattern,
  validatePermissions,
} from './permissions.generated';

// ACL
export type { ResourceIdentifier, ACLGrant, IACLProvider, IACLManager } from './acl';
