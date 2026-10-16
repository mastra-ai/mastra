import { MastraClient } from '@mastra/client-js';

import { getPlatformSession } from '../platform/index.js';
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
  const res = await refreshingFetch(address)(`${address.url.replace(/\/$/, '')}${path}`, {
    method: init?.method ?? 'GET',
    headers: {
      Accept: 'application/json',
      ...(init?.body !== undefined ? { 'content-type': 'application/json' } : {}),
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

/**
 * Platform access tokens expire while a long-lived TUI is open. On a 401,
 * refresh the session and replay the request once with the new token; a
 * rejected request never ran, so the replay cannot duplicate a command.
 */
export function refreshingFetch(
  address: FactoryAddress,
  refresh: () => Promise<PlatformSession | null> = getPlatformSession,
  baseFetch: typeof fetch = fetch,
): typeof fetch {
  const withAuth = (init: RequestInit | undefined) => {
    const headers = new Headers(init?.headers);
    for (const [key, value] of Object.entries(factoryHeaders(address))) headers.set(key, value);
    return { ...init, headers };
  };
  // Concurrent 401s share one refresh so the token is not rotated repeatedly.
  let refreshing: Promise<PlatformSession | null> | undefined;
  return async (input, init) => {
    const sentToken = address.session.token;
    const res = await baseFetch(input, withAuth(init));
    if (res.status !== 401) return res;
    if (address.session.token === sentToken) {
      refreshing ??= refresh().finally(() => {
        refreshing = undefined;
      });
      const session = await refreshing;
      if (!session || session.token === sentToken) return res;
      address.session = session;
    }
    return baseFetch(input, withAuth(init));
  };
}

export function createFactoryClient(address: FactoryAddress): MastraClient {
  // Session commands are not idempotent; a silent retry would duplicate messages.
  return new MastraClient({ baseUrl: address.url.replace(/\/$/, ''), retries: 0, fetch: refreshingFetch(address) });
}
