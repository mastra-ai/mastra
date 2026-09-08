export interface IncidentioActor {
  alert?: { id: string; title: string };
  api_key?: { id: string; name: string };
  user?: { id: string; name: string; email?: string };
  workflow?: { id: string; name: string };
}

export interface IncidentioIncident {
  id: string;
  reference: string;
  name: string;
  summary?: string;
  permalink?: string;
  visibility: string;
  mode: string;
  creator: IncidentioActor;
  incident_status: { id: string; name: string; category: string };
  incident_type?: { id: string; name: string };
  severity?: { id: string; name: string; rank: number };
  slack_channel_url?: string;
  postmortem_document_url?: string;
  created_at: string;
  updated_at: string;
}

export interface IncidentioFollowUp {
  id: string;
  incident_id: string;
  title: string;
  description?: string;
  status: 'outstanding' | 'completed' | 'deleted' | 'not_doing';
  creator: IncidentioActor;
  assignee?: { id: string; name: string } | null;
  assignee_team?: { id: string; name: string } | null;
  labels: string[];
  priority?: { id: string; name: string; rank: number } | null;
  category?: { id: string; name: string } | null;
  external_issue_reference?: { issue_name: string; issue_permalink: string; provider: string } | null;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface IncidentioPage<T> {
  items: T[];
  nextCursor: string | null;
}

export class IncidentioApiError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null) {
    super(message);
    this.name = 'IncidentioApiError';
    this.status = status;
  }
}

export type IncidentioRequest = <T>(
  method: 'GET' | 'PUT',
  path: string,
  options?: { query?: Record<string, string | number | undefined>; body?: unknown },
) => Promise<T>;

export class IncidentioApiClient {
  readonly #request: IncidentioRequest;

  constructor(request: IncidentioRequest) {
    this.#request = request;
  }

  async listIncidents(cursor?: string): Promise<IncidentioPage<IncidentioIncident>> {
    const result = await this.#request<{
      incidents: IncidentioIncident[];
      pagination_meta?: { after?: string | null };
    }>('GET', '/v2/incidents', {
      query: { page_size: 100, after: cursor, sort_by: 'created_at_newest_first' },
    });
    return { items: result.incidents, nextCursor: result.pagination_meta?.after ?? null };
  }

  async getIncident(id: string): Promise<IncidentioIncident> {
    const result = await this.#request<{ incident: IncidentioIncident }>(
      'GET',
      `/v2/incidents/${encodeURIComponent(id)}`,
    );
    return result.incident;
  }

  async listFollowUps(cursor?: string): Promise<IncidentioPage<IncidentioFollowUp>> {
    const result = await this.#request<{
      follow_ups: IncidentioFollowUp[];
      pagination_meta: { after?: string | null };
    }>('GET', '/v3/follow_ups', { query: { page_size: 100, after: cursor } });
    return { items: result.follow_ups, nextCursor: result.pagination_meta.after ?? null };
  }

  async getFollowUp(id: string): Promise<IncidentioFollowUp> {
    const result = await this.#request<{ follow_up: IncidentioFollowUp }>(
      'GET',
      `/v3/follow_ups/${encodeURIComponent(id)}`,
    );
    return result.follow_up;
  }

  async updateFollowUp(followUp: IncidentioFollowUp, status: IncidentioFollowUp['status']): Promise<IncidentioFollowUp> {
    const result = await this.#request<{ follow_up: IncidentioFollowUp }>(
      'PUT',
      `/v3/follow_ups/${encodeURIComponent(followUp.id)}`,
      { body: { title: followUp.title, status } },
    );
    return result.follow_up;
  }
}

export function createIncidentioFetchRequest(config: {
  apiKey: string;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}): IncidentioRequest {
  const baseUrl = (config.baseUrl ?? 'https://api.incident.io').replace(/\/+$/, '');
  const fetchImpl = config.fetchImpl ?? globalThis.fetch;

  return async <T>(
    method: 'GET' | 'PUT',
    path: string,
    options: { query?: Record<string, string | number | undefined>; body?: unknown } = {},
  ): Promise<T> => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined) query.set(key, String(value));
    }
    const response = await fetchImpl(`${baseUrl}${path}${query.size > 0 ? `?${query.toString()}` : ''}`, {
      method,
      signal: AbortSignal.timeout(15_000),
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${config.apiKey}`,
        ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    });
    if (!response.ok) {
      let detail = `incident.io API request failed (${response.status})`;
      try {
        const body = (await response.clone().json()) as { message?: string; error?: string; detail?: string };
        detail = body.message ?? body.error ?? body.detail ?? detail;
      } catch {
        // Use the status-based message.
      }
      throw new IncidentioApiError(detail, response.status);
    }
    return (await response.json()) as T;
  };
}
