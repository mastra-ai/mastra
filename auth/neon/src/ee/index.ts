/**
 * @mastra/auth-neon/ee
 *
 * Neon Auth features that require a Mastra Enterprise Edition license in production.
 * They work without a license in development.
 *
 * @see https://mastra.ai/docs/license
 */

export { MastraRBACNeon } from '../rbac-provider';
export type { MastraRBACNeonOptions, NeonRoleMappingOptions } from '../rbac-provider';
