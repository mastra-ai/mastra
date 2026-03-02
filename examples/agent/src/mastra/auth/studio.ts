/**
 * Studio auth provider - For deployed instances using shared API as auth proxy.
 * No API keys needed in the deployed instance.
 */

import { MastraAuthStudio, MastraRBACStudio } from '@mastra/auth-studio';
import type { RoleMapping } from '@mastra/core/auth/ee';

import type { AuthResult } from './types';

const roleMapping: RoleMapping = {
  owner: ['*'],
  admin: ['*:read', '*:write', '*:execute'],
  member: ['*:read', '*:execute'],
  viewer: ['*:read'],
  _default: [],
};

export function initStudio(): AuthResult {
  const mastraAuth = new MastraAuthStudio({
    sharedApiUrl: process.env.MASTRA_SHARED_API_URL,
    organizationId: process.env.MASTRA_ORGANIZATION_ID,
  });

  const rbacProvider = new MastraRBACStudio({
    roleMapping,
  });

  console.log('[Auth] Using MastraAuthStudio (shared API proxy) authentication');
  return { mastraAuth, rbacProvider };
}
