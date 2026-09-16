/** Browser-side helpers for the GitLab intake source. */

export interface GitLabConnection {
  id: string;
  integrationId: string;
  status: 'active' | 'needs_reauth';
  accountLabel: string | null;
}

export interface GitLabStatus {
  enabled: boolean;
  configured: boolean;
  connections?: GitLabConnection[];
  accounts?: string[];
  reauthRequired: boolean;
  reason?: 'missing_config' | 'auth_required' | 'organization_required' | 'not_connected' | 'ready';
}

export interface GitLabProject {
  id: string;
  name: string;
  connectionId?: string | null;
  accountLabel?: string | null;
  defaultBranch?: string | null;
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

async function getGitLabResource<T>(baseUrl: string, path: string): Promise<T> {
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
