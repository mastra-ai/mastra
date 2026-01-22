/**
 * Default implementations for EE authentication.
 */

// Roles
export {
  DEFAULT_ROLES,
  STUDIO_PERMISSIONS,
  type StudioPermission,
  type RoleMapping,
  getDefaultRole,
  resolvePermissions,
  resolvePermissionsFromMapping,
  matchesPermission,
  hasPermission,
} from './roles';

// Session providers
export { MemorySessionProvider, type MemorySessionProviderOptions } from './session';
export { CookieSessionProvider, type CookieSessionProviderOptions } from './session';

// RBAC providers
export { StaticRBACProvider, type StaticRBACProviderOptions } from './rbac';
