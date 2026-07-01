/**
 * Browser-side helpers for the GitHub App project flow.
 *
 * All requests go to the server's `/api/web/github/*` and `/auth/github/*`
 * routes, which are behind the WorkOS auth gate and scoped to the logged-in
 * user. The browser never sees installation tokens — those live only inside the
 * server and the cloud sandbox.
 */

import type { Project } from './projects';

export interface GithubInstallation {
  installationId: number;
  accountLogin: string | null;
  accountType: string | null;
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
export async function fetchGithubStatus(): Promise<GithubStatus> {
  try {
    const res = await fetch('/api/web/github/status', { headers: { Accept: 'application/json' } });
    if (res.status === 401) {
      return { enabled: false, connected: false, installations: [], authRequired: true };
    }
    if (!res.ok) return { enabled: false, connected: false, installations: [] };
    return (await res.json()) as GithubStatus;
  } catch {
    return { enabled: false, connected: false, installations: [] };
  }
}

/** Begin the GitHub App install/connect flow (full-page redirect). */
export function connectGithub(): void {
  window.location.assign('/auth/github/connect');
}

/** List repos across the user's installations, optionally filtered by query. */
export async function listGithubRepos(query?: string): Promise<GithubRepo[]> {
  const url = query ? `/api/web/github/repos?q=${encodeURIComponent(query)}` : '/api/web/github/repos';
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Failed to list repos (${res.status})`);
  const body = (await res.json()) as { repos: GithubRepo[] };
  return body.repos;
}

/**
 * Create a project from a repo. The server persists a `github_projects` row
 * (no sandbox, no clone yet) and returns a `Project` payload of `source: github`.
 */
export async function createProjectFromRepo(repo: GithubRepo): Promise<Project> {
  const res = await fetch('/api/web/github/projects', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      repoFullName: repo.fullName,
      repoId: repo.id,
      installationId: repo.installationId,
      defaultBranch: repo.defaultBranch,
    }),
  });
  if (!res.ok) throw new Error(`Failed to create project (${res.status})`);
  const body = (await res.json()) as { project: Project };
  return body.project;
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
  githubProjectId: string,
  onProgress?: (event: PrepareProgress) => void,
): Promise<MaterializeResult> {
  const res = await fetch(`/api/web/github/projects/${encodeURIComponent(githubProjectId)}/ensure`, {
    method: 'POST',
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
      failure = new Error(body.message ?? 'Failed to prepare project') as Error & { code?: string };
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
  let message = `Failed to prepare project (${res.status})`;
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
async function postProjectGitOp<T>(githubProjectId: string, action: string, payload: unknown): Promise<T> {
  const res = await fetch(`/api/web/github/projects/${encodeURIComponent(githubProjectId)}/${action}`, {
    method: 'POST',
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
  githubProjectId: string,
  branch: string,
  baseBranch?: string,
): Promise<WorktreeResult> {
  return postProjectGitOp<WorktreeResult>(githubProjectId, 'worktree', { branch, baseBranch });
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
  githubProjectId: string,
  message: string,
  worktreePath?: string,
): Promise<CommitResult> {
  return postProjectGitOp<CommitResult>(githubProjectId, 'commit', { message, worktreePath });
}

export interface PushResult {
  pushed: boolean;
  branch: string;
}

/** Push a branch back to GitHub from inside the sandbox (token minted server-side). */
export async function pushBranch(githubProjectId: string, branch: string, worktreePath?: string): Promise<PushResult> {
  return postProjectGitOp<PushResult>(githubProjectId, 'push', { branch, worktreePath });
}

export interface PullRequestResult {
  url: string;
}

/** Open a pull request via the sandbox `gh` CLI. `base` defaults to the project default branch. */
export async function openPullRequest(
  githubProjectId: string,
  args: { branch: string; title: string; body?: string; base?: string; worktreePath?: string },
): Promise<PullRequestResult> {
  return postProjectGitOp<PullRequestResult>(githubProjectId, 'pr', args);
}
