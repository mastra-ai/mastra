/**
 * Browser-side helpers for Factory projects and the GitHub source-control flow:
 * creating named Factory projects, connecting GitHub installations, linking
 * repositories, and per-repository sandbox/git operations.
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

export const USER_SESSION_BRANCH_PREFIX = 'user/';

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
  factoryAuthEnabled: boolean;
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
  /**
   * Whether the signed-in user has personally authorized the GitHub App, so
   * issues/PRs they originate are authored as them instead of the App bot.
   * Absent on older servers that predate per-user connections.
   */
  userConnected?: boolean;
  /** GitHub username backing the personal connection, when connected. */
  userGithubUsername?: string | null;
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
  /** Storage UUID of the installation row backing this repo. */
  installationStorageId: string;
  /** Storage UUID of the repository row backing this repo. */
  repositoryStorageId: string;
  sandboxProvider: string;
  sandboxWorkdir: string;
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

function currentPageRedirectTo(): string {
  return encodeURIComponent(window.location.pathname);
}

/** Begin the GitHub App install/connect flow (full-page redirect). */
export function connectGithub(baseUrl: string): void {
  window.location.assign(`${baseUrl}/auth/github/connect?redirectTo=${currentPageRedirectTo()}`);
}

/**
 * Open GitHub's installation page to add/remove accounts and repo access
 * (full-page redirect). Unlike {@link connectGithub}, this skips the OAuth
 * identify bounce — for an already-authorized user that bounce completes
 * instantly and invisibly, which would make the manage button a silent no-op.
 */
export function manageGithubConnection(baseUrl: string): void {
  window.location.assign(`${baseUrl}/auth/github/connect?manage=1&redirectTo=${currentPageRedirectTo()}`);
}

/**
 * Begin the GitHub App *user authorization* flow for the signed-in user
 * (full-page redirect). Unlike {@link connectGithub} this never installs the
 * App into an account — it links the user's own GitHub identity so
 * factory-originated issues and PRs are authored as them. The flow returns to
 * the current path with `github_app_user_authorized=true`, and the fresh page
 * load refetches `/web/github/status`.
 */
export function connectUserGithub(baseUrl: string): void {
  window.location.assign(`${baseUrl}/auth/github/connect-user?redirectTo=${currentPageRedirectTo()}`);
}

/** `default` = the worker token every sandbox gets; `reviewer` = optional
 * token review-board sessions use so PR reviews come from another account. */
export type GithubPatKind = 'default' | 'reviewer';

export interface GithubPatStatus {
  configured: boolean;
  reviewerConfigured: boolean;
}

/**
 * Which GitHub Personal Access Tokens the org has configured for `gh` CLI
 * use in sandboxes. The tokens themselves never reach the browser.
 */
export async function fetchGithubPatStatus(baseUrl: string): Promise<GithubPatStatus> {
  const res = await fetch(`${baseUrl}/web/github/pat`, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Failed to load GitHub token status (${res.status})`);
  return (await res.json()) as GithubPatStatus;
}

/** Save an org GitHub PAT (used only for `gh` CLI auth in sandboxes). */
export async function saveGithubPat(baseUrl: string, token: string, kind: GithubPatKind = 'default'): Promise<void> {
  const res = await fetch(`${baseUrl}/web/github/pat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ token, kind }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => undefined)) as { error?: string } | undefined;
    throw new Error(body?.error ?? `Failed to save GitHub token (${res.status})`);
  }
}

/** Remove an org GitHub PAT. */
export async function deleteGithubPat(baseUrl: string, kind: GithubPatKind = 'default'): Promise<void> {
  const res = await fetch(`${baseUrl}/web/github/pat?kind=${kind}`, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Failed to remove GitHub token (${res.status})`);
}

/** List repos across the user's installations, optionally filtered by query. */
export async function listGithubRepos(baseUrl: string, query?: string): Promise<GithubRepo[]> {
  const url = query ? `${baseUrl}/web/github/repos?q=${encodeURIComponent(query)}` : `${baseUrl}/web/github/repos`;
  const res = await fetch(url, { headers: { Accept: 'application/json' }, credentials: 'include' });
  if (!res.ok) throw new Error(`Failed to list repos (${res.status})`);
  const body = (await res.json()) as { repos: GithubRepo[] };
  return body.repos;
}

/** The GitHub source-control integration id registered on the server. */
const GITHUB_INTEGRATION_ID = 'github';

/** A Factory project row from `/web/factory/projects`. */
export interface FactoryProjectPayload {
  id: string;
  name: string;
  /** Org-wide default model for factory runs; null when unset. */
  defaultModelId?: string | null;
}

/** `{...projectRepository, repository}` payload from the Factory project routes. */
interface ProjectRepositoryPayload {
  id: string;
  branch: string | null;
  sandboxWorkdir: string;
  repository: { slug: string; defaultBranch: string } | null;
}

/** A source-control connection (with linked repos) from the Factory project routes. */
interface ProjectConnectionPayload {
  id: string;
  installationId: string;
  repositories: ProjectRepositoryPayload[];
}

/** Browser-shaped view of a repository linked to a Factory project. */
export interface LinkedRepositoryPayload {
  projectRepositoryId: string;
  slug: string;
  gitBranch?: string;
  sandboxWorkdir?: string;
}

/** A Factory project with its linked repositories flattened across connections. */
export interface FactoryProjectSnapshot extends FactoryProjectPayload {
  repositories: LinkedRepositoryPayload[];
}

export type FactoryProject = FactoryProjectSnapshot;

async function readJsonOrThrow<T>(res: Response, failure: string): Promise<T> {
  if (!res.ok) throw new Error(`${failure} (${res.status})`);
  return (await res.json()) as T;
}

function toLinkedRepositoryPayload(
  project: FactoryProjectPayload,
  link: ProjectRepositoryPayload,
): LinkedRepositoryPayload {
  return {
    projectRepositoryId: link.id,
    slug: link.repository?.slug ?? project.name,
    gitBranch: link.branch ?? link.repository?.defaultBranch,
    sandboxWorkdir: link.sandboxWorkdir,
  };
}

async function listProjectConnections(baseUrl: string, factoryProjectId: string): Promise<ProjectConnectionPayload[]> {
  const res = await fetch(
    `${baseUrl}/web/factory/projects/${encodeURIComponent(factoryProjectId)}/source-control-connections`,
    { credentials: 'include', headers: { Accept: 'application/json' } },
  );
  const { connections } = await readJsonOrThrow<{ connections: ProjectConnectionPayload[] }>(
    res,
    'Failed to list Factory repositories',
  );
  return connections;
}

/**
 * List the org's Factory projects with their linked repositories (flattened
 * across source-control connections). Resolves to `null` when the caller is
 * unauthenticated, org-less, or the feature is off, so hydration can keep the
 * local cache instead of wiping it.
 */
export async function listFactoryProjects(baseUrl: string): Promise<FactoryProjectSnapshot[] | null> {
  const res = await fetch(`${baseUrl}/web/factory/projects`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (res.status === 401 || res.status === 403 || res.status === 404) return null;
  const { projects } = await readJsonOrThrow<{ projects: FactoryProjectPayload[] }>(res, 'Failed to list Factories');
  return Promise.all(
    projects.map(async project => {
      const connections = await listProjectConnections(baseUrl, project.id);
      return {
        ...project,
        repositories: connections.flatMap(connection =>
          connection.repositories.map(link => toLinkedRepositoryPayload(project, link)),
        ),
      };
    }),
  );
}

/** Create a named Factory project. The name is user-chosen, not derived from a repo. */
export async function createFactoryProject(
  baseUrl: string,
  name: string,
  description?: string,
): Promise<FactoryProjectPayload> {
  const res = await fetch(`${baseUrl}/web/factory/projects`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(description ? { name, description } : { name }),
  });
  const { project } = await readJsonOrThrow<{ project: FactoryProjectPayload }>(res, 'Failed to create Factory');
  return project;
}

/** Fetch a single Factory project (includes its `defaultModelId`). */
export async function fetchFactoryProject(baseUrl: string, factoryProjectId: string): Promise<FactoryProjectPayload> {
  const res = await fetch(`${baseUrl}/web/factory/projects/${encodeURIComponent(factoryProjectId)}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  const { project } = await readJsonOrThrow<{ project: FactoryProjectPayload }>(res, 'Failed to load Factory');
  return project;
}

/** Set (or clear, with null) the Factory's default model for factory runs. */
export async function updateFactoryDefaultModel(
  baseUrl: string,
  factoryProjectId: string,
  defaultModelId: string | null,
): Promise<FactoryProjectPayload> {
  const res = await fetch(`${baseUrl}/web/factory/projects/${encodeURIComponent(factoryProjectId)}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'content-type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ defaultModelId }),
  });
  const { project } = await readJsonOrThrow<{ project: FactoryProjectPayload }>(
    res,
    'Failed to update Factory default model',
  );
  return project;
}

/**
 * Ensure the Factory project has a source-control connection for the given
 * GitHub installation, reusing an existing one when present. Returns the
 * connection id repositories are linked under.
 */
export async function connectInstallation(
  baseUrl: string,
  factoryProjectId: string,
  installationId: string,
): Promise<string> {
  const connections = await listProjectConnections(baseUrl, factoryProjectId);
  const existing = connections.find(connection => connection.installationId === installationId);
  if (existing) return existing.id;

  const res = await fetch(
    `${baseUrl}/web/factory/projects/${encodeURIComponent(factoryProjectId)}/source-control-connections`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ integrationId: GITHUB_INTEGRATION_ID, installationId }),
    },
  );
  const { connection } = await readJsonOrThrow<{ connection: { id: string } }>(
    res,
    'Failed to connect GitHub installation',
  );
  return connection.id;
}

/**
 * Link a GitHub repository to a Factory project under the given connection.
 * Returns the browser-shaped linked-repository payload.
 */
export async function linkRepository(
  baseUrl: string,
  factoryProjectId: string,
  connectionId: string,
  repo: GithubRepo,
): Promise<LinkedRepositoryPayload> {
  const res = await fetch(
    `${baseUrl}/web/factory/projects/${encodeURIComponent(factoryProjectId)}/source-control-connections/${encodeURIComponent(connectionId)}/repositories`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        repositoryId: repo.repositoryStorageId,
        branch: repo.defaultBranch,
        sandboxProvider: repo.sandboxProvider,
        sandboxWorkdir: repo.sandboxWorkdir,
      }),
    },
  );
  const { projectRepository } = await readJsonOrThrow<{ projectRepository: ProjectRepositoryPayload }>(
    res,
    'Failed to link GitHub repository',
  );
  return toLinkedRepositoryPayload({ id: factoryProjectId, name: repo.fullName }, projectRepository);
}

/**
 * Unlink a repository from its Factory project. Missing links are treated as
 * already removed so unlink stays idempotent.
 */
export async function unlinkRepository(
  baseUrl: string,
  factoryProjectId: string,
  projectRepositoryId: string,
): Promise<void> {
  const res = await fetch(
    `${baseUrl}/web/factory/projects/${encodeURIComponent(factoryProjectId)}/repositories/${encodeURIComponent(projectRepositoryId)}`,
    { method: 'DELETE', credentials: 'include', headers: { Accept: 'application/json' } },
  );
  if (!res.ok && res.status !== 404) throw new Error(`Failed to unlink repository (${res.status})`);
}

/**
 * Delete a Factory project. The server cascades over its source-control
 * connections (and their repository links). Missing projects are treated as
 * already deleted so removal stays idempotent.
 */
export async function deleteFactoryProject(baseUrl: string, factoryProjectId: string): Promise<void> {
  const res = await fetch(`${baseUrl}/web/factory/projects/${encodeURIComponent(factoryProjectId)}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok && res.status !== 404) throw new Error(`Failed to delete Factory (${res.status})`);
}

export interface MaterializeResult {
  resourceId: string;
  factoryProjectId: string;
  projectRepositoryId: string;
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
  projectRepositoryId: string,
  onProgress?: (event: PrepareProgress) => void,
): Promise<MaterializeResult> {
  const res = await fetch(`${baseUrl}/web/github/projects/${encodeURIComponent(projectRepositoryId)}/ensure`, {
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
  projectRepositoryId: string,
  action: string,
  payload: unknown,
): Promise<T> {
  const res = await fetch(`${baseUrl}/web/github/projects/${encodeURIComponent(projectRepositoryId)}/${action}`, {
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

export interface FactoryUserSession {
  id: string;
  sessionId: string;
  projectRepositoryId: string;
  orgId: string;
  userId: string;
  branch: string;
  baseBranch: string;
  sandboxId: string | null;
  sandboxWorkdir: string | null;
  materializedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function listUserSessions(baseUrl: string, projectRepositoryId: string): Promise<FactoryUserSession[]> {
  const res = await fetch(`${baseUrl}/web/github/projects/${encodeURIComponent(projectRepositoryId)}/sessions`, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Failed to list sessions (${res.status})`);
  return ((await res.json()) as { sessions: FactoryUserSession[] }).sessions;
}

export async function createUserSession(
  baseUrl: string,
  projectRepositoryId: string,
  branch: string,
  baseBranch?: string,
): Promise<FactoryUserSession> {
  const result = await postRepositoryGitOp<{ session: FactoryUserSession }>(baseUrl, projectRepositoryId, 'sessions', {
    branch,
    baseBranch,
  });
  return result.session;
}

export async function getUserSession(baseUrl: string, sessionId: string): Promise<FactoryUserSession> {
  const res = await fetch(`${baseUrl}/web/user-sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Failed to load session (${res.status})`);
  return ((await res.json()) as { session: FactoryUserSession }).session;
}

export async function deleteUserSession(baseUrl: string, sessionId: string): Promise<void> {
  const res = await fetch(`${baseUrl}/web/user-sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Failed to delete session (${res.status})`);
}

export interface CommitResult {
  committed: boolean;
}

/** Stage and commit all changes in a Factory session workspace. */
export async function commitChanges(
  baseUrl: string,
  projectRepositoryId: string,
  message: string,
  sessionId: string,
): Promise<CommitResult> {
  return postRepositoryGitOp<CommitResult>(baseUrl, projectRepositoryId, 'commit', { message, sessionId });
}

export interface PushResult {
  pushed: boolean;
  branch: string;
}

/** Push a Factory session branch back to GitHub (token minted server-side). */
export async function pushBranch(
  baseUrl: string,
  projectRepositoryId: string,
  branch: string,
  sessionId: string,
): Promise<PushResult> {
  return postRepositoryGitOp<PushResult>(baseUrl, projectRepositoryId, 'push', { branch, sessionId });
}

export interface PullRequestResult {
  url: string;
}

/** Open a pull request via the sandbox `gh` CLI. `base` defaults to the project default branch. */
export async function openPullRequest(
  baseUrl: string,
  projectRepositoryId: string,
  args: {
    branch: string;
    title: string;
    body?: string;
    base?: string;
    sessionId: string;
  },
): Promise<PullRequestResult> {
  return postRepositoryGitOp<PullRequestResult>(baseUrl, projectRepositoryId, 'pr', args);
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
export async function fetchRepositorySettings(
  baseUrl: string,
  projectRepositoryId: string,
): Promise<RepositorySettings> {
  const res = await fetch(`${baseUrl}/web/github/projects/${encodeURIComponent(projectRepositoryId)}/settings`, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Failed to load repository settings (${res.status})`);
  return (await res.json()) as RepositorySettings;
}

/** Persist a repository's setup command. Pass `null` (or blank) to clear it. */
export async function saveRepositorySettings(
  baseUrl: string,
  projectRepositoryId: string,
  settings: RepositorySettings,
): Promise<RepositorySettings> {
  return postRepositoryGitOp<RepositorySettings>(baseUrl, projectRepositoryId, 'settings', settings);
}
