import * as p from '@clack/prompts';
import { authHeaders, MASTRA_PLATFORM_API_URL, platformFetch } from '../auth/client.js';
import { getToken } from '../auth/credentials.js';
import { resolveCurrentOrg } from '../auth/orgs.js';

interface ObserveProject {
  id: string;
  slug: string;
  name: string;
  organizationId: string;
}

interface CreateIngestKeyResponse {
  key: { id: string; projectId: string; name: string };
  secret: string;
  endpoint: string;
}

export interface ObserveProvisionResult {
  token: string;
  endpoint: string;
  projectName: string;
  projectSlug: string;
  orgName: string;
}

/**
 * Walk the user through enabling Mastra Observe for a freshly-scaffolded
 * project: log in (via the existing browser flow) if needed, pick or create a
 * platform project, mint a fresh ingest key, and return the token + endpoint
 * for the caller to write to `.env`.
 *
 * Defaults the project name to `defaultProjectName` (typically the package
 * name from `package.json`) when creating a new project.
 */
export async function provisionObserveProject({
  defaultProjectName,
}: {
  defaultProjectName?: string;
} = {}): Promise<ObserveProvisionResult> {
  const token = await getToken();
  const { orgId, orgName } = await resolveCurrentOrg(token);

  const projects = await listObserveProjects(token, orgId);

  let project: ObserveProject;
  if (projects.length === 0) {
    project = await createObserveProject({ token, orgId, defaultName: defaultProjectName, orgName });
  } else {
    const choice = await p.select({
      message: `Select an Observe project (in ${orgName})`,
      options: [
        ...projects.map(proj => ({ value: proj.id, label: proj.name, hint: proj.slug })),
        { value: '__new__', label: '+ Create new project' },
      ],
    });

    if (p.isCancel(choice)) {
      throw new Error('Cancelled');
    }

    if (choice === '__new__') {
      project = await createObserveProject({ token, orgId, defaultName: defaultProjectName, orgName });
    } else {
      project = projects.find(proj => proj.id === choice)!;
    }
  }

  const { secret, endpoint } = await createIngestKey({
    token,
    orgId,
    slug: project.slug,
    keyName: 'CLI init',
  });

  return {
    token: secret,
    endpoint,
    projectName: project.name,
    projectSlug: project.slug,
    orgName,
  };
}

async function listObserveProjects(token: string, orgId: string): Promise<ObserveProject[]> {
  const res = await platformFetch(`${MASTRA_PLATFORM_API_URL}/v1/projects`, {
    headers: authHeaders(token, orgId),
  });
  if (!res.ok) {
    throw new Error(`Failed to list projects (${res.status})`);
  }
  const body = (await res.json()) as { projects: ObserveProject[] };
  return body.projects;
}

async function createObserveProject({
  token,
  orgId,
  defaultName,
  orgName,
}: {
  token: string;
  orgId: string;
  defaultName?: string;
  orgName: string;
}): Promise<ObserveProject> {
  const name = await p.text({
    message: `New project name (in ${orgName})`,
    placeholder: defaultName ?? 'my-mastra-app',
    defaultValue: defaultName,
    validate: v => (!v || v.trim().length === 0 ? 'Name is required' : undefined),
  });

  if (p.isCancel(name)) {
    throw new Error('Cancelled');
  }

  const res = await platformFetch(`${MASTRA_PLATFORM_API_URL}/v1/projects`, {
    method: 'POST',
    headers: { ...authHeaders(token, orgId), 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name as string }),
  });
  if (!res.ok) {
    throw new Error(`Failed to create project (${res.status})`);
  }
  const body = (await res.json()) as { project: ObserveProject };
  return body.project;
}

async function createIngestKey({
  token,
  orgId,
  slug,
  keyName,
}: {
  token: string;
  orgId: string;
  slug: string;
  keyName: string;
}): Promise<CreateIngestKeyResponse> {
  const res = await platformFetch(`${MASTRA_PLATFORM_API_URL}/v1/projects/${encodeURIComponent(slug)}/ingest-keys`, {
    method: 'POST',
    headers: { ...authHeaders(token, orgId), 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: keyName }),
  });
  if (!res.ok) {
    throw new Error(`Failed to create ingest key (${res.status})`);
  }
  return (await res.json()) as CreateIngestKeyResponse;
}
