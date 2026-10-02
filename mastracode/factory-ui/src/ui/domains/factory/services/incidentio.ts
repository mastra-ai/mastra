/**
 * Browser-side helpers for the incident.io intake source.
 *
 * All requests go to the server's `/web/incidentio/*` and `/web/intake/*`
 * routes, which sit behind the auth gate and scope stored intake selections to
 * the caller's organization.
 */

export interface IncidentioSource {
  id: string;
  name: string;
  type: string;
  metadata?: Record<string, unknown>;
}

export interface IncidentioStatus {
  enabled: boolean;
  configured: boolean;
  /** Credential mode: a deployment-configured API key or Platform-managed connections. */
  mode?: 'api-key' | 'platform';
  reason?: 'missing_config' | 'auth_required' | 'organization_required' | 'ready';
}

export interface IncidentioIssue {
  /** Prefixed item reference, e.g. `incidentio:follow-up:<ulid>`. */
  id: string;
  /** Human reference like `INC-42` when available, else the item reference. */
  identifier: string;
  title: string;
  url: string;
  author?: string | null;
  state: string;
  stateType: string;
  priorityLabel: string;
  assignee: string | null;
  /** Reference of the incident this follow-up belongs to, when available. */
  incident: string | null;
  labels: string[];
  createdAt: string;
  updatedAt: string;
  /** incident.io source the follow-up was read from; matches an intake binding's `sourceId`. */
  sourceId?: string | null;
}

export interface IncidentioIssueDetail {
  identifier: string;
  title: string;
  url: string;
  description: string | null;
}

export interface IncidentioIssuePage {
  issues: IncidentioIssue[];
  nextCursor: string | null;
}

interface IntakeSourceResponse {
  sources?: Array<IncidentioSource & { integrationId: string }>;
}

async function requestJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { Accept: 'application/json' }, credentials: 'include' });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { error?: string; message?: string };
      if (body.message) message = body.message;
      else if (body.error) message = body.error;
    } catch {
      /* ignore non-JSON */
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

/**
 * Read incident.io feature status. The endpoint's explicit answers — success
 * payloads and 401 (mapped to `auth_required`) — resolve as data. Transient
 * failures (network, other HTTP errors, malformed JSON) throw so React Query
 * retains the last successful status instead of replacing it with a
 * "successful" disabled result that would silently collapse the intake feed.
 */
export async function fetchIncidentioStatus(baseUrl: string): Promise<IncidentioStatus> {
  const res = await fetch(`${baseUrl}/web/incidentio/status`, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  if (res.status === 401) return { enabled: false, configured: false, reason: 'auth_required' };
  if (!res.ok) throw new Error(`incident.io status request failed (${res.status})`);
  return (await res.json()) as IncidentioStatus;
}

/**
 * List one cursor page of follow-ups for the viewed Factory. The server
 * intersects the caller's selected incident.io sources with the org's intake
 * source bindings for `factoryProjectId`, so one Factory's board never
 * receives follow-ups routed to another.
 */
export async function listIncidentioIssues(
  baseUrl: string,
  factoryProjectId: string,
  after?: string,
): Promise<IncidentioIssuePage> {
  const params = new URLSearchParams({ factoryProjectId });
  if (after) params.set('after', after);
  return requestJson<IncidentioIssuePage>(`${baseUrl}/web/incidentio/issues?${params.toString()}`);
}

/** Fetch a follow-up's description for the card details panel. */
export async function getIncidentioIssue(
  baseUrl: string,
  factoryProjectId: string,
  issueRef: string,
): Promise<IncidentioIssueDetail> {
  const params = new URLSearchParams({ factoryProjectId, issueRef });
  const { issue } = await requestJson<{ issue: IncidentioIssueDetail }>(
    `${baseUrl}/web/incidentio/issues/detail?${params.toString()}`,
  );
  return issue;
}

export async function listIncidentioFollowUpSources(baseUrl: string): Promise<IncidentioSource[]> {
  const response = await requestJson<IntakeSourceResponse>(`${baseUrl}/web/intake/sources`);
  return (response.sources ?? []).filter(
    source => source.integrationId === 'incidentio' && source.type === 'follow-up',
  );
}
