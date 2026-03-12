export const MASTRA_CLOUD_API_URL = process.env.MASTRA_CLOUD_API_URL || 'https://cloud.mastra.ai';

export function authHeaders(token: string, orgId?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  if (orgId) {
    headers['x-organization-id'] = orgId;
  }
  return headers;
}
