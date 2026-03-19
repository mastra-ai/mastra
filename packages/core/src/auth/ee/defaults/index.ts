/**
 * Default implementations for EE authentication.
 *
 * @license Mastra Enterprise License - see ee/LICENSE
 */

// Roles
export {
  DEFAULT_ROLES,
  type Permission,
  type PermissionPattern,
  type RoleMapping,
  getDefaultRole,
  resolvePermissions,
  resolvePermissionsFromMapping,
  matchesPermission,
  hasPermission,
} from './roles';

// RBAC providers
export { StaticRBACProvider, type StaticRBACProviderOptions } from './rbac';
