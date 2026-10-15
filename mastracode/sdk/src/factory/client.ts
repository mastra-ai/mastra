import { MastraClient } from '@mastra/client-js';

import type { PlatformSession } from '../platform/index.js';

/** The agent controller every Factory serves its coding sessions under. */
export const FACTORY_CONTROLLER_ID = 'code';

const ORGANIZATION_ID_HEADER = 'X-Mastra-Organization-Id';

export interface FactoryAddress {
  url: string;
  session: PlatformSession;
}

export interface FactoryRepository {
  projectRepositoryId: string;
  slug: string;
  branch?: string;
}

export interface FactoryProject {
  id: string;
  name: string;
  repositories: FactoryRepository[];
}

export interface FactoryUserSession {
  sessionId: string;
  projectRepositoryId: string;
  title?: string;
  branch: string;
  updatedAt: string;
}

export function factoryHeaders({ session }: FactoryAddress): Record<string, string> {
  return { Authorization: `Bearer ${session.token}`, [ORGANIZATION_ID_HEADER]: session.orgId };
}

async function factoryFetch<T>(address: FactoryAddress, path: string, init?: { method?: string; body?: unknown }) {
  const res = await fetch(`${address.url.replace(/\/$/, '')}${path}`, {
    method: init?.method ?? 'GET',
    headers: {
      Accept: 'application/json',
      ...(init?.body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...factoryHeaders(address),
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new Error(
      `Factory request ${path} failed (${res.status})${body.message || body.error ? `: ${body.message ?? body.error}` : ''}`,
    );
  }
  return (await res.json()) as T;
}

interface ProjectConnectionPayload {
  repositories: Array<{
    id: string;
    branch: string | null;
    repository: { slug: string; defaultBranch: string } | null;
  }>;
}

/** List the org's Factory projects with their linked repositories. */
export async function listFactoryProjects(address: FactoryAddress): Promise<FactoryProject[]> {
  const { projects } = await factoryFetch<{ projects: Array<{ id: string; name: string }> }>(
    address,
    '/web/factory/projects',
  );
  return Promise.all(
    projects.map(async project => {
      const { connections } = await factoryFetch<{ connections: ProjectConnectionPayload[] }>(
        address,
        `/web/factory/projects/${encodeURIComponent(project.id)}/source-control-connections`,
      );
      return {
        id: project.id,
        name: project.name,
        repositories: connections.flatMap(connection =>
          connection.repositories.map(link => ({
            projectRepositoryId: link.id,
            slug: link.repository?.slug ?? project.name,
            branch: link.branch ?? link.repository?.defaultBranch,
          })),
        ),
      };
    }),
  );
}

/**
 * Create a Factory user session. Factory assigns the session ID and its
 * `user/session-<id>` branch, cut from the repository's default branch.
 */
export async function createFactoryUserSession(
  address: FactoryAddress,
  projectRepositoryId: string,
  title?: string,
): Promise<FactoryUserSession> {
  const { session } = await factoryFetch<{ session: FactoryUserSession & { title?: string | null } }>(
    address,
    `/web/source-control/projects/${encodeURIComponent(projectRepositoryId)}/sessions`,
    { method: 'POST', body: title ? { title } : {} },
  );
  return { ...session, title: session.title ?? undefined };
}

export function createFactoryClient(address: FactoryAddress): MastraClient {
  // Session commands are not idempotent; a silent retry would duplicate messages.
  return new MastraClient({ baseUrl: address.url.replace(/\/$/, ''), headers: factoryHeaders(address), retries: 0 });
}
