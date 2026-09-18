/** Browser-side helpers for the GitLab intake source. */

export const MASTRA_PROJECTS_URL = 'https://projects.mastra.ai';

export function openMastraPlatformIntegrations(): void {
  window.open(MASTRA_PROJECTS_URL, '_blank', 'noopener,noreferrer');
}

export const manageGitLabConnection = openMastraPlatformIntegrations;

export interface GitLabConnection {
  id: string;
  integrationId: string;
  status: 'active' | 'needs_reauth';
  accountLabel: string | null;
}

export interface GitLabStatus {
  enabled: boolean;
  configured: boolean;
  mode?: 'direct' | 'platform';
  connections?: GitLabConnection[];
  accounts?: string[];
  reauthRequired: boolean;
  reason?: 'missing_config' | 'auth_required' | 'organization_required' | 'not_connected' | 'ready';
}

export interface GitLabIssue {
  id: string;
  externalId: string;
  identifier: string;
  title: string;
  url: string;
  state: string;
  stateType: string;
  priority: string | null;
  assignee: string | null;
  assignees?: string[];
  author: string | null;
  source: string | null;
  sourceId: string | null;
  labels: string[];
  labelColors?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface GitLabIssueDetail extends GitLabIssue {
  description: string | null;
  comments: Array<{
    author: string | null;
    body: string;
    createdAt: string;
  }>;
}

export interface GitLabIssuePage {
  issues: GitLabIssue[];
  nextCursor: string | null;
}

export interface GitLabProject {
  id: string;
  name: string;
  projectId?: string;
  projectPath?: string;
  installationStorageId?: string;
  connectionId?: string | null;
  accountLabel?: string | null;
  defaultBranch?: string | null;
  sandboxProvider?: string;
  sandboxWorkdir?: string;
}

/** Provider-neutral repository pick used by Factory onboarding and linking. */
export interface GitLabRepository {
  provider: 'gitlab';
  /** Opaque Intake source id. */
  id: string;
  /** GitLab's numeric project id, kept as a string. */
  externalId: string;
  fullName: string;
  name: string;
  owner: string;
  defaultBranch: string;
  private: boolean;
  installationStorageId?: string;
  sandboxProvider: string;
  sandboxWorkdir: string;
}

export function gitLabProjectRepository(project: GitLabProject): GitLabRepository | null {
  if (!project.projectId || !project.sandboxProvider || !project.sandboxWorkdir) return null;
  const fullName = project.projectPath ?? project.name;
  const parts = fullName.split('/').filter(Boolean);
  return {
    provider: 'gitlab',
    id: project.id,
    externalId: project.projectId,
    fullName,
    name: parts.at(-1) ?? fullName,
    owner: parts.slice(0, -1).join('/'),
    defaultBranch: project.defaultBranch ?? 'main',
    private: true,
    installationStorageId: project.installationStorageId,
    sandboxProvider: project.sandboxProvider,
    sandboxWorkdir: project.sandboxWorkdir,
  };
}

export async function fetchGitLabStatus(baseUrl: string): Promise<GitLabStatus> {
  try {
    const res = await fetch(`${baseUrl}/web/gitlab/status`, {
      headers: { Accept: 'application/json' },
      credentials: 'include',
    });
    if (res.status === 401) {
      return { enabled: false, configured: false, reauthRequired: false, reason: 'auth_required' };
    }
    if (!res.ok) return { enabled: false, configured: false, reauthRequired: false };
    return (await res.json()) as GitLabStatus;
  } catch {
    return { enabled: false, configured: false, reauthRequired: false };
  }
}

async function getGitLabResource<T>(baseUrl: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    },
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
    const error = new Error(message);
    (error as { code?: string }).code = code;
    throw error;
  }
  return (await res.json()) as T;
}

export function isGitLabAuthError(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === 'gitlab_auth_failed';
}

export function isGitLabReauthRequired(status: GitLabStatus | undefined): boolean {
  return Boolean(
    status?.reauthRequired || status?.connections?.some(connection => connection.status === 'needs_reauth'),
  );
}

export async function fetchGitLabProjects(baseUrl: string): Promise<GitLabProject[]> {
  const { projects } = await getGitLabResource<{ projects: GitLabProject[] }>(baseUrl, '/web/gitlab/projects');
  return projects;
}

export async function registerGitLabRepository(
  baseUrl: string,
  sourceId: string,
): Promise<GitLabRepository & { installationStorageId: string }> {
  const { project } = await getGitLabResource<{ project: GitLabProject }>(
    baseUrl,
    '/web/gitlab/projects/registration',
    { method: 'POST', body: JSON.stringify({ sourceId }) },
  );
  const repository = gitLabProjectRepository(project);
  if (!repository?.installationStorageId) throw new Error('GitLab project registration returned no installation');
  return repository as GitLabRepository & { installationStorageId: string };
}

export async function listGitLabIssues(
  baseUrl: string,
  factoryProjectId: string,
  board: string,
  after?: string,
): Promise<GitLabIssuePage> {
  const params = new URLSearchParams({ factoryProjectId, board });
  if (after) params.set('after', after);
  return getGitLabResource<GitLabIssuePage>(baseUrl, '/web/gitlab/issues?' + params.toString());
}

export function getGitLabIssue(baseUrl: string, factoryProjectId: string, issueId: string): Promise<GitLabIssueDetail> {
  const params = new URLSearchParams({ factoryProjectId });
  return getGitLabResource(baseUrl, `/web/gitlab/issues/${encodeURIComponent(issueId)}?${params.toString()}`);
}
