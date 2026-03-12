import createClient from 'openapi-fetch';

import type { paths } from '../cloud-api.js';

export const MASTRA_CLOUD_API_URL = process.env.MASTRA_CLOUD_API_URL || 'https://platform.staging.mastra.ai';

/**
 * Create a typed API client with Bearer token + org ID headers.
 */
export function createApiClient(token: string, orgId?: string) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  if (orgId) {
    headers['x-organization-id'] = orgId;
  }

  return createClient<paths>({
    baseUrl: MASTRA_CLOUD_API_URL,
    headers,
  });
}

/**
 * Build auth headers for raw fetch calls (zip upload, SSE streaming, tokens).
 */
export function authHeaders(token: string, orgId?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  if (orgId) {
    headers['x-organization-id'] = orgId;
  }
  return headers;
}
