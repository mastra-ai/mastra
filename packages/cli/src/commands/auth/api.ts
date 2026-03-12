import { MASTRA_CLOUD_API_URL, authHeaders } from './client.js';

export interface Org {
  id: string;
  name: string;
  role: string | null;
  isCurrent: boolean;
}

export async function fetchOrgs(token: string): Promise<Org[]> {
  const resp = await fetch(`${MASTRA_CLOUD_API_URL}/v1/auth/orgs`, {
    headers: authHeaders(token),
  });

  if (!resp.ok) {
    if (resp.status === 401) {
      throw new Error('Session expired. Please run: mastra auth login');
    }
    throw new Error(`Failed to fetch orgs: ${resp.status}`);
  }

  const data = (await resp.json()) as { organizations: Org[] };
  return data.organizations;
}
