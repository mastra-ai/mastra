/**
 * Browser-side helpers for factory user sessions — the conversations listed in
 * the sidebar. Listing is per Factory; creation goes through a repository link,
 * which resolves its source-control provider; individual-session routes resolve
 * the provider from the durable session row.
 */
import { postSourceControlRepositoryOp, readJsonOrThrow } from './http';

export const USER_SESSION_BRANCH_PREFIX = 'user/';
export const SLACK_SESSION_BRANCH_PREFIX = 'slack/';

export interface FactoryUserSessionOwner {
  id: string;
  name: string;
  avatarUrl?: string;
}

export interface FactoryUserSession {
  id: string;
  sessionId: string;
  projectRepositoryId: string;
  userId: string;
  owner?: FactoryUserSessionOwner;
  visibility: 'org' | 'private';
  title?: string;
  branch: string;
  baseBranch: string;
  materializedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

type FactoryUserSessionPayload = Omit<FactoryUserSession, 'title'> & { title?: string | null };

function normalizeUserSession({ title, ...session }: FactoryUserSessionPayload): FactoryUserSession {
  return { ...session, title: title ?? undefined };
}

/** The compact list; a server that predates it answers with `{ sessions }` carrying inline owners. */
interface SessionListPayload {
  sessions: FactoryUserSessionPayload[];
  owners?: Record<string, Omit<FactoryUserSessionOwner, 'id'>>;
  total?: number;
  syncedAt?: string;
}

export interface UserSessionList {
  sessions: FactoryUserSession[];
  /** How many sessions the viewer can see in total; with `updatedSince`, `sessions` holds only the changed ones. */
  total: number;
  /** Server time of this read; pass it back as `updatedSince` to fetch only what changed since. */
  syncedAt?: string;
}

/**
 * The Factory's sessions the viewer can see, across all of its repositories and
 * providers. With `updatedSince`, only sessions updated since then are returned.
 */
export async function listUserSessions(
  baseUrl: string,
  factoryId: string,
  options: { signal?: AbortSignal; updatedSince?: string } = {},
): Promise<UserSessionList> {
  const params = new URLSearchParams({ compact: '1' });
  if (options.updatedSince) params.set('updatedSince', options.updatedSince);
  const res = await fetch(`${baseUrl}/web/factory/projects/${encodeURIComponent(factoryId)}/sessions?${params}`, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
    signal: options.signal,
  });
  const body = await readJsonOrThrow<SessionListPayload>(res, 'Failed to list sessions');
  return {
    sessions: body.sessions.map(session => {
      const owner = body.owners?.[session.userId];
      return normalizeUserSession(owner ? { ...session, owner: { id: session.userId, ...owner } } : session);
    }),
    total: body.total ?? body.sessions.length,
    syncedAt: body.syncedAt,
  };
}

export type CreateUserSessionOptions =
  | { branch: string; baseBranch?: string; sessionId?: never; title?: never }
  | { sessionId: string; title: string; branch?: never; baseBranch?: never };

export async function createUserSession(
  baseUrl: string,
  projectRepositoryId: string,
  options: CreateUserSessionOptions,
): Promise<FactoryUserSession> {
  const result = await postSourceControlRepositoryOp<{ session: FactoryUserSessionPayload }>(
    baseUrl,
    projectRepositoryId,
    'sessions',
    options,
  );
  return normalizeUserSession(result.session);
}

export async function getUserSession(baseUrl: string, sessionId: string): Promise<FactoryUserSession> {
  const res = await fetch(`${baseUrl}/web/user-sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  const body = await readJsonOrThrow<{ session: FactoryUserSessionPayload }>(res, 'Failed to load session');
  return normalizeUserSession(body.session);
}

export async function deleteUserSession(baseUrl: string, sessionId: string): Promise<void> {
  const res = await fetch(`${baseUrl}/web/user-sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok && res.status !== 404) throw new Error(`Failed to delete session (${res.status})`);
}

/** Ask the title model to re-name a session's conversation. Resolves to the new title. */
export async function regenerateSessionTitle(baseUrl: string, sessionId: string): Promise<string> {
  const res = await fetch(`${baseUrl}/web/user-sessions/${encodeURIComponent(sessionId)}/title`, {
    method: 'POST',
    credentials: 'include',
  });
  const body: { title?: string; error?: string } = await res.json().catch(() => ({}));
  if (!res.ok || !body.title) throw new Error(body.error ?? `Failed to rename session (${res.status})`);
  return body.title;
}
