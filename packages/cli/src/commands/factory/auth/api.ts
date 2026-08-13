import { MASTRA_PLATFORM_API_URL, authHeaders, extractApiErrorDetail, platformFetch } from './client.js';

export interface Org {
  id: string;
  name: string;
  role: string | null;
  isCurrent: boolean;
}

export async function fetchOrgs(token: string): Promise<Org[]> {
  const response = await platformFetch(`${MASTRA_PLATFORM_API_URL}/v1/auth/orgs`, {
    headers: authHeaders(token),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => undefined);
    throw new Error(extractApiErrorDetail(body) ?? `Failed to fetch orgs: ${response.status}`);
  }
  const data = (await response.json()) as { organizations: Org[] };
  return data.organizations;
}
