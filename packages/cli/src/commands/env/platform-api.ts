import { throwApiError } from '../auth/client.js';

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

export async function fetchProjects(token: string, orgId: string): Promise<Project[]> {
  const resp = await fetch(`${getApiUrl()}/v1/projects`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'x-organization-id': orgId,
    },
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throwApiError('Failed to fetch projects', resp.status, (err as { detail?: string }).detail);
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
    throwApiError('Failed to fetch environments', resp.status, (err as { detail?: string }).detail);
  }

  const data = (await resp.json()) as { environments: Environment[] };
  return data.environments;
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
    throwApiError('Failed to create environment', resp.status, (err as { detail?: string }).detail);
  }

  const data = (await resp.json()) as { environment: Environment };
  return data.environment;
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
    throwApiError('Failed to delete environment', resp.status, (err as { detail?: string }).detail);
  }
}

function getApiUrl(): string {
  return process.env.MASTRA_PLATFORM_API_URL || 'https://platform.mastra.ai';
}
