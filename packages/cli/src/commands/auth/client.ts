import createClient from 'openapi-fetch';

import type { paths } from '../platform-api.js';

export const MASTRA_PLATFORM_API_URL = process.env.MASTRA_PLATFORM_API_URL || 'https://platform.staging.mastra.ai';

export const SESSION_EXPIRED_MESSAGE = 'Session expired. Run: mastra auth login';

/**
 * Throw a standardized error for API failures.
 * - 401: "Session expired" (authentication failed)
 * - Other: Show the server's error detail or fall back to status code
 */
export function throwApiError(message: string, status: number, detail?: string): never {
  if (status === 401) {
    throw new Error(SESSION_EXPIRED_MESSAGE);
  }
  if (detail) {
    throw new Error(detail);
  }
  throw new Error(`${message}: ${status}`);
}

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
    baseUrl: MASTRA_PLATFORM_API_URL,
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
