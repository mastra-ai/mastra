/**
 * @mastra/auth-okta/ee
 *
 * Okta features that require a Mastra Enterprise Edition license in production.
 * They work without a license in development.
 *
 * @see https://mastra.ai/docs/license
 */

export { MastraRBACOkta } from '../rbac-provider';
export type { MastraRBACOktaOptions, PermissionCacheOptions } from '../types';
