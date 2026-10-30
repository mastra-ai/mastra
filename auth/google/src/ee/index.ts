/**
 * @mastra/auth-google/ee
 *
 * Google Workspace features that require a Mastra Enterprise Edition license in production.
 * They work without a license in development.
 *
 * @see https://mastra.ai/docs/license
 */

export { MastraRBACGoogle } from '../rbac-provider';
export type { MastraRBACGoogleOptions, PermissionCacheOptions } from '../types';
