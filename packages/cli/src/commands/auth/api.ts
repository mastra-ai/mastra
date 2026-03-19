import { createApiClient, throwApiError } from './client.js';

export interface Org {
  id: string;
  name: string;
  role: string | null;
  isCurrent: boolean;
}

export async function fetchOrgs(token: string): Promise<Org[]> {
  const client = createApiClient(token);
  const { data, error, response } = await client.GET('/v1/auth/orgs');

  if (error) {
    throwApiError('Failed to fetch orgs', response.status, error.detail);
  }

  return data.organizations;
}
