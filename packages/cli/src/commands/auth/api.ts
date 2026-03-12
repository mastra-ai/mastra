import { createApiClient } from './client.js';

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
    if (response.status === 401) {
      throw new Error('Session expired. Please run: mastra auth login');
    }
    throw new Error(`Failed to fetch orgs: ${response.status}`);
  }

  return data.organizations;
}
