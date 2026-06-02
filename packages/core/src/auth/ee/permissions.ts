/**
 * @mastra/core/auth/ee/permissions
 *
 * Browser-safe Enterprise permission constants and types.
 * This code is licensed under the Mastra Enterprise License - see ee/LICENSE.
 *
 * @license Mastra Enterprise License - see ee/LICENSE
 * @packageDocumentation
 */

export type {
  Resource,
  Action,
  Permission,
  PermissionPattern,
  MastraFGAPermission,
  MastraFGAPermissionInput,
  TypedRoleMapping,
} from './interfaces/permissions.generated';

export {
  RESOURCES,
  ACTIONS,
  PERMISSIONS,
  PERMISSION_PATTERNS,
  MastraFGAPermissions,
  isValidPermissionPattern,
  validatePermissions,
} from './interfaces/permissions.generated';
