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
 * Read GitHub feature/connection status. Resolves to a disabled status on 404
 * or any error so the SPA can cleanly hide the feature when it's not configured.
 */
export async function fetchGithubStatus(): Promise<GithubStatus> {
  try {
    const res = await fetch('/api/web/github/status', { headers: { Accept: 'application/json' } });
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

/**
 * Materialize a GitHub project into its cloud sandbox: provision/reattach the
 * sandbox and clone/pull the repo inside it. Returns the resourceId used to open
 * the project. Throws an Error whose message carries the server's error code so
 * the UI can surface "sandbox not configured" distinctly.
 */
export async function ensureRepoMaterialized(githubProjectId: string): Promise<MaterializeResult> {
  const res = await fetch(`/api/web/github/projects/${encodeURIComponent(githubProjectId)}/ensure`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
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
    throw err;
  }
  return (await res.json()) as MaterializeResult;
}
