/**
 * Browser-side helpers for the Linear intake source.
 *
 * All requests go to the server's `/web/linear/*` routes, which sit behind the
 * WorkOS auth gate and are scoped to the caller's organization. A self-managed
 * server connects through its own `/auth/linear/*` OAuth routes; a Platform
 * server connects through Mastra Connect (`platformConnect.ts`). The Linear
 * token never reaches the browser — the server talks to Linear's GraphQL API on
 * the org's behalf.
 */

import { RequestError } from './request';

export type LinearStatusReason =
  | 'missing_config'
  | 'auth_required'
  | 'organization_required'
  | 'not_connected'
  | 'ready'
  | 'unavailable'
  | 'migration_required';

/** Platform servers move workspaces from the platform's legacy Linear tokens onto Mastra Connect. */
export interface LinearMigrationStatus {
  /** Workspaces are still waiting to move. */
  required: boolean;
  /** Linear workspace ids still waiting. */
  pending: string[];
  /** Workspaces the platform couldn't move, with why. */
  skipped: Array<{ linearWorkspaceId: string; reason: string }>;
  lastError?: { message: string; at: string } | null;
}

/** A Connect connection that can't be reconnected in place: it needs a fresh connect. */
export interface LinearFreshConnect {
  connectionId: string;
  accountLabel: string | null;
  linearWorkspaceId: string | null;
}

export interface LinearStatus {
  mode?: 'platform';
  /** Includes previously authorized workspaces whose connection has stopped working. */
  workspaces?: LinearWorkspaceConnection[];
  enabled: boolean;
  connected: boolean;
  workspace: { name: string | null; urlKey: string | null } | null;
  reason?: LinearStatusReason;
  /** Platform servers only. */
  migration?: LinearMigrationStatus;
  /** Platform servers only: connections Linear revoked, which only a fresh connect restores. */
  requiresFreshConnect?: LinearFreshConnect[];
}

export interface LinearWorkspaceConnection {
  id: string;
  name: string;
  urlKey: string | null;
  connected: boolean;
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
  creator?: string | null;
  team: string | null;
  /** Selected intake source (project or team); matches an intake binding's `sourceId`. */
  sourceId?: string | null;
  /** Actual Linear project, even when the issue was routed through a team. */
  projectId?: string | null;
  labels: string[];
  createdAt: string;
  updatedAt: string;
}

export interface LinearIssueDetail {
  identifier: string;
  title: string;
  url: string;
  description: string | null;
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
    if (res.status === 404) return { enabled: false, connected: false, workspace: null };
    if (!res.ok) return { enabled: false, connected: false, workspace: null, reason: 'unavailable' };
    return (await res.json()) as LinearStatus;
  } catch {
    return { enabled: false, connected: false, workspace: null, reason: 'unavailable' };
  }
}

/** Begin a self-managed server's Linear OAuth connect flow (full-page redirect). */
export function connectLinear(baseUrl: string, workspaceId?: string): void {
  const params = new URLSearchParams({ return_to: `${window.location.pathname}${window.location.search}` });
  if (workspaceId) params.set('workspace_id', workspaceId);
  window.location.assign(`${baseUrl}/auth/linear/connect?${params}`);
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
    const err = new RequestError(message, res.status);
    (err as RequestError & { code?: string }).code = code;
    throw err;
  }
  return (await res.json()) as T;
}

export interface LinearMigrateResult {
  migration: LinearMigrationStatus;
}

/**
 * Retry moving the org's legacy Linear workspaces onto Mastra Connect. The
 * server does this on its own; this is the organization admin's manual retry.
 */
export async function migrateLinearWorkspaces(baseUrl: string): Promise<LinearMigrateResult> {
  const res = await fetch(`${baseUrl}/web/integrations/platform/linear/migrate`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  const body = (await res.json().catch(() => ({}))) as LinearMigrateResult & { error?: string; message?: string };
  if (!res.ok) {
    throw new RequestError(body.message ?? body.error ?? `Request failed (${res.status})`, res.status);
  }
  return body;
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

export async function getLinearIssue(
  baseUrl: string,
  factoryProjectId: string,
  identifier: string,
  issueId?: string,
): Promise<LinearIssueDetail> {
  const params = new URLSearchParams({ factoryProjectId });
  if (issueId) params.set('issueId', issueId);
  return getLinearResource<LinearIssueDetail>(
    baseUrl,
    `/web/linear/issues/${encodeURIComponent(identifier)}?${params.toString()}`,
  );
}

export interface LinearWorkspaceListingError {
  workspaceId: string;
  name: string;
}

export interface LinearProjectListing {
  projects: LinearProject[];
  /** Workspaces that failed to list while others succeeded; absent on direct-OAuth and older servers. */
  workspaceErrors?: LinearWorkspaceListingError[];
}

/** List the connected workspaces' projects (Settings intake-source picker). */
export function listLinearProjects(baseUrl: string): Promise<LinearProjectListing> {
  return getLinearResource<LinearProjectListing>(baseUrl, '/web/linear/projects');
}

/** A Linear team, selectable as an intake source in its own right. */
export interface LinearTeam {
  id: string;
  /** Short team key, e.g. `ENG`. */
  key: string;
  name: string;
  /** Opaque backend-generated intake source id. */
  sourceId?: string;
  /** Present when a backend spans more than one Linear workspace. */
  workspaceId?: string;
}

export interface LinearTeamListing {
  teams: LinearTeam[];
  workspaceErrors?: LinearWorkspaceListingError[];
}

/** List the connected workspaces' teams (Settings intake-source picker). */
export function listLinearTeams(baseUrl: string): Promise<LinearTeamListing> {
  return getLinearResource<LinearTeamListing>(baseUrl, '/web/linear/teams');
}

/**
 * Resolve the opaque intake source id for a whole Linear team. New backends
 * provide it explicitly; the raw-id form preserves older self-managed DTOs.
 */
export const LINEAR_TEAM_SOURCE_PREFIX = 'linear-team:';

export function linearTeamSourceId(team: Pick<LinearTeam, 'id' | 'sourceId'>): string {
  return team.sourceId ?? `${LINEAR_TEAM_SOURCE_PREFIX}${team.id}`;
}

/**
 * Workspace a platform-managed Linear source belongs to. Those source IDs are
 * `linear-project:` / `linear-team:` followed by base64url JSON carrying
 * `workspaceId`; any other shape yields `null`.
 */
export function linearSourceWorkspaceId(sourceId: string): string | null {
  const encoded = /^linear-(?:project|team):(.+)$/.exec(sourceId)?.[1];
  if (!encoded) return null;
  try {
    const value: unknown = JSON.parse(atob(encoded.replace(/-/g, '+').replace(/_/g, '/')));
    if (value && typeof value === 'object' && 'workspaceId' in value && typeof value.workspaceId === 'string') {
      return value.workspaceId || null;
    }
    return null;
  } catch {
    return null;
  }
}

export function isLinearTeamSourceId(sourceId: string): boolean {
  return sourceId.startsWith(LINEAR_TEAM_SOURCE_PREFIX);
}
