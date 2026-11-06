/**
 * @mastra/auth-workos/ee
 *
 * WorkOS features that require a Mastra Enterprise Edition license in production.
 * They work without a license in development.
 *
 * @see https://mastra.ai/docs/license
 */

export { MastraRBACWorkos } from '../rbac-provider';
export { MastraFGAWorkos, WorkOSFGAMembershipResolutionError, WorkOSFGAResourceNotFoundError } from '../fga-provider';
export type {
  MastraRBACWorkosOptions,
  PermissionCacheOptions,
  MastraFGAWorkosOptions,
  MastraFGAPermissionMapping,
} from '../types';
