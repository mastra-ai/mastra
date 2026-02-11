/**
 * Composite auth provider - combines multiple auth providers.
 *
 * This demonstrates using CompositeAuth to layer:
 * 1. SimpleAuth for service tokens (API access)
 * 2. MastraCloudAuthProvider for user OAuth (SSO login)
 *
 * Request flow:
 * - Token auth: SimpleAuth checks first, then Cloud verifies
 * - SSO login: Cloud provides login URL and handles callback
 * - Sessions: Cloud manages session cookies
 *
 * Requires environment variables:
 * - MASTRA_PROJECT_ID: Cloud project ID
 * - MASTRA_CLOUD_URL: Cloud API base URL
 * - MASTRA_CALLBACK_URL: OAuth callback URL
 * - SERVICE_TOKEN: Optional service token for API access
 */

import { CompositeAuth, SimpleAuth } from '@mastra/core/server';
import type { AuthResult } from './types';

export async function initComposite(): Promise<AuthResult> {
  const { MastraCloudAuthProvider, MastraRBACCloud } = await import('@mastra/auth-cloud');

  // Service token auth for API/automation access
  const serviceTokens: Record<string, { id: string }> = {};
  if (process.env.SERVICE_TOKEN) {
    serviceTokens[process.env.SERVICE_TOKEN] = { id: 'service-api' };
  }

  const serviceAuth = new SimpleAuth({
    tokens: serviceTokens,
  });

  // Cloud auth for user OAuth SSO
  const cloudAuth = new MastraCloudAuthProvider({
    projectId: process.env.MASTRA_PROJECT_ID!,
    cloudBaseUrl: process.env.MASTRA_CLOUD_URL!,
    callbackUrl: process.env.MASTRA_CALLBACK_URL!,
  });

  // Composite combines both - service tokens checked first, then cloud OAuth
  const mastraAuth = new CompositeAuth([serviceAuth, cloudAuth]);

  // RBAC from cloud
  const rbacProvider = new MastraRBACCloud({
    roleMapping: {
      owner: ['*'],
      admin: ['*:read', '*:write', '*:execute'],
      api: ['*:read', '*:write', '*:execute'],
      member: ['*:read', '*:execute'],
      viewer: ['*:read'],
      _default: [],
    },
  });

  console.log('[Auth] Using Composite authentication (SimpleAuth + MastraCloudAuth)');
  return { mastraAuth, rbacProvider };
}
