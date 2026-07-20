/**
 * Browser-side helpers for the GitHub App project flow.
 *
 * All requests go to the server's `/web/github/*` and `/auth/github/*`
 * routes, which are behind the WorkOS auth gate and scoped to the logged-in
 * user. The browser never sees installation tokens — those live only inside the
 * server and the cloud sandbox.
 *
 * Every helper takes the API base URL injected by `ApiConfigProvider` (empty
 * string when served same-origin) so a frontend dev server on another port
 * still reaches the Mastra server — same pattern as the shared API client.
 */

import type { GithubConnectedRepositoryPayload } from './factories';

export interface GithubInstallation {
  installationId: number;
  accountLogin: string | null;
  accountType: string | null;
}

/** Reason the GitHub feature is in its current state, returned by the server. */
export type GithubStatusReason =
  'missing_config' | 'auth_required' | 'organization_required' | 'not_connected' | 'ready';

/** Non-secret diagnostic snapshot of every GitHub feature gate. */
export interface GithubFeatureDiagnostics {
  githubAppConfigured: boolean;
  webAuthEnabled: boolean;
  appDbConfigured: boolean;
  stateSecretConfigured: boolean;
  sandboxEnabled: boolean;
  sandboxProvider: string;
  /** Names of missing required GitHub App env vars (non-secret names only). */
  missingGithubAppEnvVars: string[];
}

export interface GithubStatus {
  enabled: boolean;
  sandboxEnabled?: boolean;
  connected: boolean;
  installations: GithubInstallation[];
  /**
   * True when the status request failed because the user is not authenticated
   * (HTTP 401), as opposed to the feature being genuinely disabled. Lets the SPA
   * prompt re-login instead of silently hiding GitHub.
   */
  authRequired?: boolean;
  /** True when the user is signed in but has no WorkOS org (personal account). */
  organizationRequired?: boolean;
  /** Machine-readable reason for the current state; see {@link GithubStatusReason}. */
  reason?: GithubStatusReason;
  /** Non-secret feature-gate diagnostics from the server. */
  diagnostics?: GithubFeatureDiagnostics;
}

export interface GithubRepo {
  id: number;
  fullName: string;
  name: string;
  owner: string;
  defaultBranch: string;
  private: boolean;
  installationId: number;
}

/**
 * Read GitHub feature/connection status. Resolves to a disabled status on 404,
 * a network error, or when the feature is off, so the SPA can cleanly hide the
 * feature. A 401 is reported distinctly via `authRequired` so the SPA can prompt
 * re-login instead of treating the feature as disabled.
 */
export async function fetchGithubStatus(baseUrl: string): Promise<GithubStatus> {
  try {
    const res = await fetch(`${baseUrl}/web/github/status`, {
      headers: { Accept: 'application/json' },
      credentials: 'include',
    });
    if (res.status === 401) {
      return { enabled: false, connected: false, installations: [], authRequired: true, reason: 'auth_required' };
    }
    if (!res.ok) return { enabled: false, connected: false, installations: [] };
    return (await res.json()) as GithubStatus;
  } catch {
    return { enabled: false, connected: false, installations: [] };
  }
}

/** Begin the GitHub App install/connect flow (full-page redirect). */
export function connectGithub(baseUrl: string): void {
  window.location.assign(`${baseUrl}/auth/github/connect`);
}

/**
 * Open GitHub's installation page to add/remove accounts and repo access
 * (full-page redirect). Unlike {@link connectGithub}, this skips the OAuth
 * identify bounce — for an already-authorized user that bounce completes
 * instantly and invisibly, which would make the manage button a silent no-op.
 */
export function manageGithubConnection(baseUrl: string): void {
  window.location.assign(`${baseUrl}/auth/github/connect?manage=1`);
}

/** List repos across the user's installations, optionally filtered by query. */
export async function listGithubRepos(baseUrl: string, query?: string): Promise<GithubRepo[]> {
  const url = query ? `${baseUrl}/web/github/repos?q=${encodeURIComponent(query)}` : `${baseUrl}/web/github/repos`;
  const res = await fetch(url, { headers: { Accept: 'application/json' }, credentials: 'include' });
  if (!res.ok) throw new Error(`Failed to list repos (${res.status})`);
  const body = (await res.json()) as { repos: GithubRepo[] };
  return body.repos;
}

/**
 * Create a connected GitHub repository binding. The server persists a
 * `source_control_projects` row (no sandbox, no clone yet) and returns a temporary
 * repository DTO. The browser wraps it into a Factory with its own UUID.
 */
export async function listConnectedRepositories(baseUrl: string): Promise<GithubConnectedRepositoryPayload[]> {
  const res = await fetch(`${baseUrl}/web/github/repositories`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`Failed to list connected repositories (${res.status})`);
  return (await res.json()) as GithubConnectedRepositoryPayload[];
}

export async function deleteConnectedRepository(baseUrl: string, projectId: string): Promise<void> {
  const res = await fetch(`${baseUrl}/web/github/repositories/${encodeURIComponent(projectId)}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Failed to delete connected repository (${res.status})`);
}

export async function createConnectedRepository(
  baseUrl: string,
  repo: GithubRepo,
): Promise<GithubConnectedRepositoryPayload> {
  const res = await fetch(`${baseUrl}/web/github/repositories`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      repoFullName: repo.fullName,
      repoId: repo.id,
      installationId: repo.installationId,
      defaultBranch: repo.defaultBranch,
    }),
  });
  if (!res.ok) throw new Error(`Failed to create connected repository (${res.status})`);
  const body = (await res.json()) as { repository: GithubConnectedRepositoryPayload };
  return body.repository;
}

export interface MaterializeResult {
  resourceId: string;
  githubProjectId: string;
  sandboxId: string;
  sandboxWorkdir: string;
}

/** A coarse-grained step of the server-side sandbox preparation. */
export interface PrepareProgress {
  phase: 'reattaching' | 'provisioning' | 'preparing-workspace' | 'cloning' | 'pulling' | 'finalizing' | 'done';
  message: string;
}

/**
 * Materialize a GitHub project into its cloud sandbox: provision/reattach the
 * sandbox and clone/pull the repo inside it. Streams live server-side progress
 * via SSE, invoking `onProgress` for each step so the UI can show the user what
 * is happening. Returns the resourceId used to open the project. Throws an Error
 * whose message carries the server's error code so the UI can surface
 * "sandbox not configured" distinctly.
 */
export async function ensureRepoMaterialized(
  baseUrl: string,
  githubProjectId: string,
  onProgress?: (event: PrepareProgress) => void,
): Promise<MaterializeResult> {
  const res = await fetch(`${baseUrl}/web/github/repositories/${encodeURIComponent(githubProjectId)}/ensure`, {
    method: 'POST',
    credentials: 'include',
    headers: { Accept: 'text/event-stream' },
  });

  // Non-2xx responses are sent as plain JSON (auth gate, 503, 404, etc.) rather
  // than as an SSE stream, so handle those before reading the event stream.
  if (!res.ok) {
    throw await ensureError(res);
  }

  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('text/event-stream') || !res.body) {
    // Server fell back to a single JSON response — read it directly.
    return (await res.json()) as MaterializeResult;
  }

  let result: MaterializeResult | undefined;
  let failure: (Error & { code?: string }) | undefined;

  await readSSE(res.body, (event, data) => {
    if (event === 'progress') {
      onProgress?.(JSON.parse(data) as PrepareProgress);
    } else if (event === 'done') {
      result = JSON.parse(data) as MaterializeResult;
    } else if (event === 'error') {
      const body = JSON.parse(data) as { error?: string; message?: string };
      failure = new Error(body.message ?? 'Failed to prepare repository') as Error & { code?: string };
      failure.code = body.error;
    }
  });

  if (failure) throw failure;
  if (!result) throw new Error('Sandbox preparation ended without a result.');
  return result;
}

/** Build an Error carrying the server's error code from a non-OK JSON response. */
async function ensureError(res: Response): Promise<Error & { code?: string }> {
  let code = `http_${res.status}`;
  let message = `Failed to prepare repository (${res.status})`;
  try {
    const body = (await res.json()) as { error?: string; message?: string };
    if (body.error) code = body.error;
    if (body.message) message = body.message;
  } catch {
    /* ignore non-JSON */
  }
  const err = new Error(message) as Error & { code?: string };
  err.code = code;
  return err;
}

/**
 * Minimal SSE reader over a fetch ReadableStream. Parses `event:`/`data:` frames
 * separated by blank lines and invokes `onEvent` for each. Defaults the event
 * name to `message` per the SSE spec.
 */
async function readSSE(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: string, data: string) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    // Normalize CRLF/CR to LF so frame and line splitting work regardless of
    // how the server terminates SSE lines (the spec allows \r\n, \r, or \n).
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n|\r/g, '\n');
    let sep: number;
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      let event = 'message';
      const dataLines: string[] = [];
      for (const line of frame.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''));
      }
      if (dataLines.length > 0) onEvent(event, dataLines.join('\n'));
    }
  }
}

/**
 * An error from a git write operation (worktree/commit/push/pr) that carries the
 * server's error code so the UI can distinguish actionable failures (e.g.
 * `authRequired` for a 401, `Invalid branch` for a 400) from generic failures.
 */
export interface GitOpError extends Error {
  code?: string;
  status?: number;
  authRequired?: boolean;
}

/**
 * POST helper for the per-project git endpoints. Parses the server's JSON body,
 * surfacing `error`/`message` codes on failure (and `authRequired` for 401) so
 * callers can react without re-implementing the parsing dance each time.
 */
async function postRepositoryGitOp<T>(
  baseUrl: string,
  githubProjectId: string,
  action: string,
  payload: unknown,
): Promise<T> {
  const res = await fetch(`${baseUrl}/web/github/repositories/${encodeURIComponent(githubProjectId)}/${action}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload ?? {}),
  });
  if (!res.ok) {
    let code = `http_${res.status}`;
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string; message?: string };
      if (body.error) code = body.error;
      if (body.message) message = body.message;
      else if (body.error) message = body.error;
    } catch {
      /* ignore non-JSON */
    }
    const err = new Error(message) as GitOpError;
    err.code = code;
    err.status = res.status;
    if (res.status === 401) err.authRequired = true;
    throw err;
  }
  return (await res.json()) as T;
}

export interface WorktreeResult {
  worktreePath: string;
  branch: string;
  baseBranch: string;
  resourceId: string;
}

/**
 * Create (or reuse) a git worktree + feature branch for a unit of work inside
 * the project's cloud sandbox. `baseBranch` defaults to the project's default
 * branch server-side when omitted.
 */
export async function createWorktree(
  baseUrl: string,
  githubProjectId: string,
  branch: string,
  baseBranch?: string,
): Promise<WorktreeResult> {
  return postRepositoryGitOp<WorktreeResult>(baseUrl, githubProjectId, 'worktree', { branch, baseBranch });
}

export interface DeleteWorktreeResult {
  removed: boolean;
  branch: string;
  worktreePath: string;
}

/**
 * Delete a worktree's checkout (and local feature branch) from the project's
 * sandbox and drop its persisted row. Destructive: any uncommitted work in the
 * checkout is discarded, so callers must confirm with the user first.
 */
export async function deleteWorktree(
  baseUrl: string,
  githubProjectId: string,
  branch: string,
): Promise<DeleteWorktreeResult> {
  return postRepositoryGitOp<DeleteWorktreeResult>(baseUrl, githubProjectId, 'worktree/delete', { branch });
}

export interface CommitResult {
  committed: boolean;
}

/**
 * Stage all changes and commit them inside the given worktree. `worktreePath`
 * is validated server-side against persisted worktrees; omit it to commit on the
 * base checkout. Resolves with `committed: false` when there was nothing to commit.
 */
export async function commitChanges(
  baseUrl: string,
  githubProjectId: string,
  message: string,
  worktreePath?: string,
): Promise<CommitResult> {
  return postRepositoryGitOp<CommitResult>(baseUrl, githubProjectId, 'commit', { message, worktreePath });
}

export interface PushResult {
  pushed: boolean;
  branch: string;
}

/** Push a branch back to GitHub from inside the sandbox (token minted server-side). */
export async function pushBranch(
  baseUrl: string,
  githubProjectId: string,
  branch: string,
  worktreePath?: string,
): Promise<PushResult> {
  return postRepositoryGitOp<PushResult>(baseUrl, githubProjectId, 'push', { branch, worktreePath });
}

export interface PullRequestResult {
  url: string;
}

/** Open a pull request via the sandbox `gh` CLI. `base` defaults to the project default branch. */
export async function openPullRequest(
  baseUrl: string,
  githubProjectId: string,
  args: {
    branch: string;
    title: string;
    body?: string;
    base?: string;
    worktreePath?: string;
    sessionId?: string;
    threadId?: string;
  },
): Promise<PullRequestResult> {
  return postRepositoryGitOp<PullRequestResult>(baseUrl, githubProjectId, 'pr', args);
}

/** Per-repository settings persisted on the server. */
export interface RepositorySettings {
  /**
   * Shell command run inside every freshly created worktree before any agent
   * execution (e.g. `pnpm i && pnpm build`). `null` when no setup step is
   * configured.
   */
  setupCommand: string | null;
}

/** Read a repository's settings (currently just the worktree setup command). */
export async function fetchRepositorySettings(baseUrl: string, githubProjectId: string): Promise<RepositorySettings> {
  const res = await fetch(`${baseUrl}/web/github/repositories/${encodeURIComponent(githubProjectId)}/settings`, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Failed to load repository settings (${res.status})`);
  return (await res.json()) as RepositorySettings;
}

/** Persist a repository's setup command. Pass `null` (or blank) to clear it. */
export async function saveRepositorySettings(
  baseUrl: string,
  githubProjectId: string,
  settings: RepositorySettings,
): Promise<RepositorySettings> {
  return postRepositoryGitOp<RepositorySettings>(baseUrl, githubProjectId, 'settings', settings);
}
