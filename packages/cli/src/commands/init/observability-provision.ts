import * as p from '@clack/prompts';
import { authHeaders, MASTRA_PLATFORM_API_URL, platformFetch } from '../auth/client.js';
import { getToken } from '../auth/credentials.js';
import { resolveCurrentOrg } from '../auth/orgs.js';

interface ObservabilityProject {
  id: string;
  slug: string;
  name: string;
  organizationId: string;
}

interface CreateTokenResponse {
  token: { id: string; name: string };
  secret: string;
}

export interface ObservabilityProvisionResult {
  /** WorkOS organization API key (sk_*) used as MASTRA_PLATFORM_ACCESS_TOKEN. */
  token: string;
  /** Platform project id (UUID) used as MASTRA_PROJECT_ID. */
  projectId: string;
  /** Platform project slug. */
  projectSlug: string;
  /** Platform project name. */
  projectName: string;
  /** Organization display name for messaging. */
  orgName: string;
  /**
   * Spans endpoint override. Only set when the platform URL is non-default
   * (e.g., local dev or staging). When omitted, the MastraPlatformExporter
   * falls back to its built-in `https://observability.mastra.ai` default.
   */
  tracesEndpoint?: string;
}

const DEFAULT_PLATFORM_API_URL = 'https://platform.mastra.ai';

/**
 * Walk the user through enabling Mastra Observability for a freshly-scaffolded
 * project: log in (via the existing browser flow) if needed, pick or create a
 * platform project, mint a fresh org-scoped ingest token, and return what the
 * caller needs to write to `.env`.
 *
 * Defaults the project name to `defaultProjectName` (typically the package
 * name from `package.json`) when creating a new project.
 */
export async function provisionObservabilityProject({
  defaultProjectName,
  observabilityProject,
  mode = 'pick',
  token: providedToken,
  org,
}: {
  defaultProjectName?: string;
  /**
   * If supplied, skip the interactive picker. Matches an existing project by
   * name or slug; if no match, creates a new project with this name. Lets the
   * `create` / `init` commands run fully non-interactively.
   */
  observabilityProject?: string;
  /**
   * `'create'` (used by `create-mastra`) always provisions a new platform
   * project named after the local one — no project picker, no extra name prompt.
   * `'pick'` (used by `mastra init` in an existing project) lets the user
   * attach to an existing project or create a new one.
   */
  mode?: 'create' | 'pick';
  /** Platform auth token already acquired during the observability opt-in prompt. */
  token?: string;
  /** Organization already chosen during the observability auth prompt. */
  org?: { orgId: string; orgName: string };
} = {}): Promise<ObservabilityProvisionResult> {
  const token = providedToken ?? (await getToken());
  const { orgId, orgName } = org ?? (await resolveCurrentOrg(token, { forcePrompt: true }));

  let project: ObservabilityProject;
  if (observabilityProject) {
    const projects = await listProjects(token, orgId);
    const match = projects.find(proj => proj.name === observabilityProject || proj.slug === observabilityProject);
    if (match) {
      project = match;
    } else {
      project = await createProjectByName({ token, orgId, name: observabilityProject });
    }
  } else if (mode === 'create') {
    // Fresh scaffold: reuse the local project name; no picker, no re-prompt.
    if (!defaultProjectName) {
      throw new Error('defaultProjectName is required when mode is "create"');
    }
    project = await createProjectByName({ token, orgId, name: defaultProjectName });
  } else {
    const projects = await listProjects(token, orgId);
    if (projects.length === 0) {
      project = await createProject({ token, orgId, defaultName: defaultProjectName, orgName });
    } else {
      const choice = await p.select({
        message: `Select a project (in ${orgName})`,
        options: [
          ...projects.map(proj => ({ value: proj.id, label: proj.name, hint: proj.slug })),
          { value: '__new__', label: '+ Create new project' },
        ],
      });

      if (p.isCancel(choice)) {
        throw new Error('Cancelled');
      }

      if (choice === '__new__') {
        project = await createProject({ token, orgId, defaultName: defaultProjectName, orgName });
      } else {
        project = projects.find(proj => proj.id === choice)!;
      }
    }
  }

  const secret = await mintOrgToken({
    token,
    orgId,
    keyName: `mastra observability – ${project.name}`,
  });

  const result: ObservabilityProvisionResult = {
    token: secret,
    projectId: project.id,
    projectSlug: project.slug,
    projectName: project.name,
    orgName,
  };

  // Only emit a traces endpoint override when the user is pointed at a
  // non-default platform (local dev / staging). For prod, omit it so the
  // MastraPlatformExporter uses its built-in https://observability.mastra.ai default.
  if (MASTRA_PLATFORM_API_URL !== DEFAULT_PLATFORM_API_URL) {
    result.tracesEndpoint = deriveTracesEndpoint(MASTRA_PLATFORM_API_URL, project.id);
  }

  return result;
}

async function listProjects(token: string, orgId: string): Promise<ObservabilityProject[]> {
  const res = await platformFetch(`${MASTRA_PLATFORM_API_URL}/v1/studio/projects`, {
    headers: authHeaders(token, orgId),
  });
  if (!res.ok) {
    throw new Error(`Failed to list projects (${res.status})`);
  }
  const body = (await res.json()) as { projects: ObservabilityProject[] };
  return body.projects;
}

async function createProject({
  token,
  orgId,
  defaultName,
  orgName,
}: {
  token: string;
  orgId: string;
  defaultName?: string;
  orgName: string;
}): Promise<ObservabilityProject> {
  const name = await p.text({
    message: `New project name (in ${orgName})`,
    placeholder: defaultName ?? 'my-mastra-app',
    defaultValue: defaultName,
    validate: v => (!v || v.trim().length === 0 ? 'Name is required' : undefined),
  });

  if (p.isCancel(name)) {
    throw new Error('Cancelled');
  }

  return createProjectByName({ token, orgId, name: name as string });
}

async function createProjectByName({
  token,
  orgId,
  name,
}: {
  token: string;
  orgId: string;
  name: string;
}): Promise<ObservabilityProject> {
  // Create as observability-only: no Studio or Server runtime attached. The first
  // `mastra studio deploy` / `mastra server deploy` flips the matching flag
  // on the platform side.
  const res = await platformFetch(`${MASTRA_PLATFORM_API_URL}/v1/studio/projects`, {
    method: 'POST',
    headers: { ...authHeaders(token, orgId), 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, studioEnabled: false, serverEnabled: false }),
  });
  if (!res.ok) {
    throw new Error(`Failed to create project (${res.status})`);
  }
  const body = (await res.json()) as { project: ObservabilityProject };
  return body.project;
}

async function mintOrgToken({
  token,
  orgId,
  keyName,
}: {
  token: string;
  orgId: string;
  keyName: string;
}): Promise<string> {
  const res = await platformFetch(`${MASTRA_PLATFORM_API_URL}/v1/auth/tokens`, {
    method: 'POST',
    headers: { ...authHeaders(token, orgId), 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: keyName }),
  });
  if (!res.ok) {
    throw new Error(`Failed to create access token (${res.status})`);
  }
  const body = (await res.json()) as CreateTokenResponse;
  return body.secret;
}

/**
 * Derive a per-project spans endpoint matching the mobs-collector route
 * `POST /projects/:projectId/ai/spans/publish`. Only used when a non-default
 * platform URL is in play; production usage relies on the
 * MastraPlatformExporter's own default base.
 */
function deriveTracesEndpoint(platformUrl: string, projectId: string): string {
  // Strip a trailing /v1 (or any other path) — we want the host root.
  const url = new URL(platformUrl);
  return `${url.origin}/projects/${projectId}/ai/spans/publish`;
}
