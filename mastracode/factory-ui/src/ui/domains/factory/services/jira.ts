/**
 * Browser-side helpers for the Jira intake source.
 *
 * All requests go to the server's `/web/jira/*` routes, which sit behind the
 * host auth gate and are scoped to the caller's organization. Jira credentials
 * are deployment-global env config (`JIRA_BASE_URL` / `JIRA_EMAIL` /
 * `JIRA_API_TOKEN`) — there is no per-org connect flow, so unlike Linear this
 * service has no OAuth redirect helper; the disabled state points the operator
 * at the env vars instead.
 */

export type JiraStatusReason = 'missing_config' | 'auth_required' | 'organization_required' | 'ready';

export interface JiraStatus {
  enabled: boolean;
  /** True when the deployment has the complete `JIRA_*` env group. */
  configured: boolean;
  /** Jira site host, e.g. `mycompany.atlassian.net`. */
  site: string | null;
  reason?: JiraStatusReason;
}

export interface JiraIssue {
  id: string;
  /** Human key like `ENG-123`. */
  identifier: string;
  title: string;
  url: string;
  /** Status name, e.g. `In Progress`. */
  state: string;
  /** Status-category-derived type: `unstarted` / `started` / `completed`. */
  stateType: string;
  priorityLabel: string;
  assignee: string | null;
  /** Jira project key, e.g. `ENG`. */
  project: string | null;
  labels: string[];
  createdAt: string;
  updatedAt: string;
}

export interface JiraIssuePage {
  issues: JiraIssue[];
  /** Opaque cursor for the next page, or `null` on the last page. */
  nextCursor: string | null;
}

export interface JiraProject {
  id: string;
  name: string;
  /** Short project key, e.g. `ENG`. */
  key: string | null;
}

/**
 * Read Jira feature status. Degrades to a disabled status on 404 (routes not
 * mounted — env group absent), a network error, or when the feature is off —
 * same contract as `fetchLinearStatus`, so consumers read `data`, never
 * `error`.
 */
export async function fetchJiraStatus(baseUrl: string): Promise<JiraStatus> {
  try {
    const res = await fetch(`${baseUrl}/web/jira/status`, {
      headers: { Accept: 'application/json' },
      credentials: 'include',
    });
    if (res.status === 401) {
      return { enabled: false, configured: false, site: null, reason: 'auth_required' };
    }
    if (!res.ok) return { enabled: false, configured: false, site: null };
    return (await res.json()) as JiraStatus;
  } catch {
    return { enabled: false, configured: false, site: null };
  }
}

/** GET helper for the read-only Jira endpoints; throws server messages. */
async function getJiraResource<T>(baseUrl: string, path: string): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    let code: string | undefined;
    try {
      const body = (await res.json()) as { error?: string; message?: string };
      code = body.error;
      if (body.message) message = body.message;
      else if (body.error) message = body.error;
    } catch {
      /* ignore non-JSON */
    }
    const err = new Error(message);
    (err as { code?: string }).code = code;
    throw err;
  }
  return (await res.json()) as T;
}

/**
 * True when the server reported that Jira rejected the deployment's
 * credentials (revoked/expired API token) — the operator must fix the
 * `JIRA_*` env vars.
 */
export function isJiraAuthError(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === 'jira_auth_failed';
}

/** List one cursor page of the selected projects' active issues. */
export async function listJiraIssues(baseUrl: string, after?: string): Promise<JiraIssuePage> {
  const params = new URLSearchParams();
  if (after) params.set('after', after);
  const query = params.toString();
  return getJiraResource<JiraIssuePage>(baseUrl, `/web/jira/issues${query ? `?${query}` : ''}`);
}

/** List the site's projects (Settings intake-source picker). */
export async function listJiraProjects(baseUrl: string): Promise<JiraProject[]> {
  const { projects } = await getJiraResource<{ projects: JiraProject[] }>(baseUrl, '/web/jira/projects');
  return projects;
}
