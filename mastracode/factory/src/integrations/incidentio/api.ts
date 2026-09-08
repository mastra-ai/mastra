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

export interface IncidentioApiClientConfig {
  baseUrl: string;
  accessToken: string;
  fetchImpl?: typeof fetch;
}

export class IncidentioApiClient {
  readonly #baseUrl: string;
  readonly #accessToken: string;
  readonly #fetch: typeof fetch;

  constructor(config: IncidentioApiClientConfig) {
    const baseUrl = config.baseUrl.trim();
    const accessToken = config.accessToken.trim();
    if (!baseUrl || !accessToken) {
      throw new Error('IncidentioApiClient requires a base URL and access token.');
    }
    this.#baseUrl = baseUrl.replace(/\/+$/, '');
    this.#accessToken = accessToken;
    this.#fetch = config.fetchImpl ?? globalThis.fetch;
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

  async #request<T>(
    method: 'GET' | 'PUT',
    path: string,
    options: { query?: Record<string, string | number | undefined>; body?: unknown } = {},
  ): Promise<T> {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined) query.set(key, String(value));
    }

    let response: Response;
    try {
      response = await this.#fetch(`${this.#baseUrl}${path}${query.size > 0 ? `?${query.toString()}` : ''}`, {
        method,
        signal: AbortSignal.timeout(15_000),
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${this.#accessToken}`,
          ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes(this.#accessToken)) {
        const redacted = new Error(error.message.replaceAll(this.#accessToken, '[REDACTED]'));
        redacted.name = error.name;
        throw redacted;
      }
      throw error;
    }

    if (!response.ok) {
      let detail = `incident.io API request failed (${response.status})`;
      try {
        const body = (await response.clone().json()) as { message?: string; error?: string; detail?: string };
        detail = body.message ?? body.error ?? body.detail ?? detail;
      } catch {
        // Use the status-based message.
      }
      throw new IncidentioApiError(detail.replaceAll(this.#accessToken, '[REDACTED]'), response.status);
    }
    return (await response.json()) as T;
  }
}
