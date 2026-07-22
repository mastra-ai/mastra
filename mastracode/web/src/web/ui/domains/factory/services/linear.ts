/**
 * Browser-side helpers for the Linear intake source.
 *
 * All requests go to the server's `/web/linear/*` and `/auth/linear/*` routes,
 * which sit behind the WorkOS auth gate and are scoped to the caller's
 * organization. The Linear OAuth token never reaches the browser — the server
 * talks to Linear's GraphQL API on the org's behalf.
 */

export type LinearStatusReason =
  'missing_config' | 'auth_required' | 'organization_required' | 'not_connected' | 'ready';

export interface LinearStatus {
  enabled: boolean;
  connected: boolean;
  workspace: { name: string | null; urlKey: string | null } | null;
  reason?: LinearStatusReason;
}

export interface LinearIssue {
  id: string;
  /** Human key like `ENG-123`. */
  identifier: string;
  title: string;
  url: string;
  /** Workflow state name, e.g. `In Progress`. */
  state: string;
  /** Workflow state type, e.g. `backlog` / `unstarted` / `started` / `triage`. */
  stateType: string;
  priorityLabel: string;
  assignee: string | null;
  team: string | null;
  labels: string[];
  createdAt: string;
  updatedAt: string;
}

export interface LinearIssuePage {
  issues: LinearIssue[];
  /** Opaque cursor for the next page, or `null` on the last page. */
  nextCursor: string | null;
}

export interface LinearProjectTeam {
  id: string;
  /** Short team key, e.g. `ENG`. */
  key: string;
  name: string;
}

export interface LinearProject {
  id: string;
  name: string;
  /** Project state, e.g. `planned` / `started` / `paused` / `completed`. */
  state: string;
  /** Teams the project belongs to (the Settings picker groups by these). */
  teams: LinearProjectTeam[];
}

/**
 * Read Linear feature/connection status. Degrades to a disabled status on 404,
 * a network error, or when the feature is off — same contract as
 * `fetchGithubStatus`, so consumers read `data`, never `error`.
 */
export async function fetchLinearStatus(baseUrl: string): Promise<LinearStatus> {
  try {
    const res = await fetch(`${baseUrl}/web/linear/status`, {
      headers: { Accept: 'application/json' },
      credentials: 'include',
    });
    if (res.status === 401) {
      return { enabled: false, connected: false, workspace: null, reason: 'auth_required' };
    }
    if (!res.ok) return { enabled: false, connected: false, workspace: null };
    return (await res.json()) as LinearStatus;
  } catch {
    return { enabled: false, connected: false, workspace: null };
  }
}

/** Begin the Linear OAuth connect flow (full-page redirect). */
export function connectLinear(baseUrl: string): void {
  window.location.assign(`${baseUrl}/auth/linear/connect`);
}

/** GET helper for the read-only Linear endpoints; throws server messages. */
async function getLinearResource<T>(baseUrl: string, path: string): Promise<T> {
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
 * True when the server reported that the org's Linear authorization is no
 * longer valid (expired/revoked token) and OAuth must be redone.
 */
export function isLinearReauthError(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === 'linear_reauth_required';
}

/** List one cursor page of the workspace's active issues. */
export async function listLinearIssues(
  baseUrl: string,
  factoryProjectId: string,
  after?: string,
): Promise<LinearIssuePage> {
  const params = new URLSearchParams({ factoryProjectId });
  if (after) params.set('after', after);
  return getLinearResource<LinearIssuePage>(baseUrl, `/web/linear/issues?${params.toString()}`);
}

/** List the connected workspace's projects (Settings intake-source picker). */
export async function listLinearProjects(baseUrl: string): Promise<LinearProject[]> {
  const { projects } = await getLinearResource<{ projects: LinearProject[] }>(baseUrl, '/web/linear/projects');
  return projects;
}
