import { extractApiErrorDetail, throwApiError } from '../auth/client.js';

export interface Project {
  id: string;
  name: string;
  slug: string | null;
  organizationId: string;
}

export interface Environment {
  id: string;
  projectId: string;
  name: string;
  slug: string;
  type: 'production' | 'staging' | 'preview';
  region: string | null;
  branch: string | null;
  instanceUrl: string | null;
  customServerUrl: string | null;
  observabilityProjectId: string | null;
  envVars: Record<string, string> | null;
  /**
   * Names of env vars injected at deploy time by managed platform resources
   * (e.g. an attached Turso database). Names only — values are secrets.
   * Absent on platforms that predate the field.
   */
  managedEnvVarNames?: string[];
  createdAt: string;
  updatedAt: string;
}

export type EnvironmentDeployStatus =
  | 'queued'
  | 'uploading'
  | 'starting'
  | 'building'
  | 'deploying'
  | 'running'
  | 'sleeping'
  | 'stopped'
  | 'failed'
  | 'crashed'
  | 'cancelled'
  | 'unknown';

export interface EnvironmentDeploy {
  id: string;
  projectId: string;
  organizationId: string;
  environmentId: string;
  projectName: string;
  environmentName: string;
  environmentSlug: string;
  region: string | null;
  status: EnvironmentDeployStatus;
  instanceUrl: string | null;
  error: string | null;
  errorCode: string | null;
  createdAt: string | null;
  githubBranch: string | null;
  githubCommitSha: string | null;
}

export async function fetchProjects(token: string, orgId: string): Promise<Project[]> {
  const resp = await fetch(`${getApiUrl()}/v1/projects`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'x-organization-id': orgId,
    },
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throwApiError('Failed to fetch projects', resp.status, extractApiErrorDetail(err));
  }

  const data = (await resp.json()) as { projects: Project[] };
  return data.projects;
}

export async function fetchEnvironments(token: string, orgId: string, projectId: string): Promise<Environment[]> {
  const resp = await fetch(`${getApiUrl()}/v1/projects/${projectId}/environments`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'x-organization-id': orgId,
    },
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throwApiError('Failed to fetch environments', resp.status, extractApiErrorDetail(err));
  }

  const data = (await resp.json()) as { environments: Environment[] };
  return data.environments;
}

export async function fetchEnvironmentDeploys(
  token: string,
  orgId: string,
  projectId: string,
): Promise<EnvironmentDeploy[]> {
  const resp = await fetch(`${getApiUrl()}/v1/projects/${projectId}/environment-deploys`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'x-organization-id': orgId,
    },
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throwApiError('Failed to fetch deploys', resp.status, extractApiErrorDetail(err));
  }

  const data = (await resp.json()) as { deploys: EnvironmentDeploy[] };
  return data.deploys;
}

export async function createEnvironment(
  token: string,
  orgId: string,
  projectId: string,
  env: { name: string; type: 'production' | 'staging' | 'preview'; region?: string },
): Promise<Environment> {
  const resp = await fetch(`${getApiUrl()}/v1/projects/${projectId}/environments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-organization-id': orgId,
    },
    body: JSON.stringify(env),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throwApiError('Failed to create environment', resp.status, extractApiErrorDetail(err));
  }

  const data = (await resp.json()) as { environment: Environment };
  return data.environment;
}

/**
 * Restart an environment's running service so saved env vars take effect
 * immediately. 409 means the environment has never been deployed.
 */
export async function restartEnvironment(
  token: string,
  orgId: string,
  projectId: string,
  envId: string,
): Promise<void> {
  const resp = await fetch(`${getApiUrl()}/v1/projects/${projectId}/environments/${envId}/restart`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'x-organization-id': orgId,
    },
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throwApiError('Failed to restart environment', resp.status, extractApiErrorDetail(err));
  }
}

export async function deleteEnvironment(token: string, orgId: string, projectId: string, envId: string): Promise<void> {
  const resp = await fetch(`${getApiUrl()}/v1/projects/${projectId}/environments/${envId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'x-organization-id': orgId,
    },
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throwApiError('Failed to delete environment', resp.status, extractApiErrorDetail(err));
  }
}

function getApiUrl(): string {
  return process.env.MASTRA_PLATFORM_API_URL || 'https://platform.mastra.ai';
}
