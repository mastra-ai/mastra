export interface IncidentioSource {
  id: string;
  name: string;
  type: string;
  metadata?: Record<string, unknown>;
}

interface IntakeSourceResponse {
  sources?: Array<IncidentioSource & { integrationId: string }>;
}

async function requestJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { Accept: 'application/json' }, credentials: 'include' });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json() as Promise<T>;
}

export async function listIncidentioFollowUpSources(baseUrl: string): Promise<IncidentioSource[]> {
  const response = await requestJson<IntakeSourceResponse>(`${baseUrl}/web/intake/sources`);
  return (response.sources ?? []).filter(
    source => source.integrationId === 'incidentio' && source.type === 'follow-up',
  );
}
