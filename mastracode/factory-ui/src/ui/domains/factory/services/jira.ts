/**
 * Browser-side helpers for the Jira intake source.
 *
 * All requests go to the server's `/web/jira/*` routes, which sit behind the
 * WorkOS auth gate and are scoped to the caller's organization. The server
 * discovers the organization's Jira connections through Mastra Platform and
 * sends provider requests through the integrations v2 proxy.
 */

export type JiraStatusReason = 'missing_config' | 'auth_required' | 'organization_required' | 'not_connected' | 'ready';

export interface JiraStatus {
  enabled: boolean;
  /** True when the organization has at least one active Jira connection. */
  configured: boolean;
  /** First connected Jira Cloud site host, retained for older consumers. */
  site?: string | null;
  /** All connected Jira Cloud site hosts. */
  sites?: string[];
  connections?: Array<{
    id: string;
    integrationId: string;
    status: 'active' | 'needs_reauth';
    accountLabel: string | null;
  }>;
  reason?: JiraStatusReason;
}

export interface JiraIssue {
  id: string;
  /** Human key like `ENG-123`. */
  identifier: string;
  title: string;
  url: string;
  /** Workflow status name, e.g. `In Progress`. */
  state: string;
  /** Status category mapped to the shared state type, e.g. `unstarted` / `started`. */
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
  /** Short project key, e.g. `ENG`. */
  key: string;
  name: string;
  connectionId?: string | null;
  site?: string | null;
}

/**
 * Read Jira feature status. Degrades to a disabled status on 404 (server
 * without Platform integration support), a network error, or when the feature
 * is off — same contract as `fetchLinearStatus`, so consumers read
 * `data`, never `error`.
 */
export async function fetchJiraStatus(baseUrl: string): Promise<JiraStatus> {
  try {
    const res = await fetch(`${baseUrl}/web/jira/status`, {
      headers: { Accept: 'application/json' },
      credentials: 'include',
    });
    if (res.status === 401) {
      return { enabled: false, configured: false, reason: 'auth_required' };
    }
    if (!res.ok) return { enabled: false, configured: false };
    return (await res.json()) as JiraStatus;
  } catch {
    return { enabled: false, configured: false };
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
 * True when a connected Jira account rejected the proxied request. The user
 * can reconnect that account in Mastra Platform.
 */
export function isJiraAuthError(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === 'jira_auth_failed';
}

/**
 * List one cursor page of active issues for the viewed Factory. The server
 * intersects the caller's selected Jira projects with the org's intake source
 * bindings for `factoryProjectId`, so one Factory's board never receives
 * issues routed to another.
 */
export async function listJiraIssues(
  baseUrl: string,
  factoryProjectId: string,
  after?: string,
): Promise<JiraIssuePage> {
  const params = new URLSearchParams({ factoryProjectId });
  if (after) params.set('after', after);
  return getJiraResource<JiraIssuePage>(baseUrl, `/web/jira/issues?${params.toString()}`);
}

/** List the Jira site's projects (Settings intake-source picker). */
export async function listJiraProjects(baseUrl: string): Promise<JiraProject[]> {
  const { projects } = await getJiraResource<{ projects: JiraProject[] }>(baseUrl, '/web/jira/projects');
  return projects;
}
