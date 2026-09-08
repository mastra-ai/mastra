/**
 * Browser-side helpers for factory user sessions — the conversations listed in
 * the sidebar. Their routes are mounted inside the server's GitHub integration
 * (`/web/github/projects/:id/sessions`, `/web/user-sessions/*`), but nothing
 * here is GitHub-specific.
 */
import { postRepositoryGitOp, readJsonOrThrow } from './http';

export const USER_SESSION_BRANCH_PREFIX = 'user/';

export interface FactoryUserSessionOwner {
  id: string;
  name: string;
  avatarUrl?: string;
}

export interface FactoryUserSession {
  id: string;
  sessionId: string;
  projectRepositoryId: string;
  orgId: string;
  userId: string;
  owner?: FactoryUserSessionOwner;
  visibility: 'org' | 'private';
  title?: string;
  branch: string;
  baseBranch: string;
  sandboxId: string | null;
  sandboxWorkdir: string | null;
  materializedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

type FactoryUserSessionPayload = Omit<FactoryUserSession, 'title'> & { title?: string | null };

function normalizeUserSession({ title, ...session }: FactoryUserSessionPayload): FactoryUserSession {
  return { ...session, title: title ?? undefined };
}

export async function listUserSessions(
  baseUrl: string,
  projectRepositoryId: string,
  signal?: AbortSignal,
): Promise<FactoryUserSession[]> {
  const res = await fetch(`${baseUrl}/web/github/projects/${encodeURIComponent(projectRepositoryId)}/sessions`, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
    signal,
  });
  const body = await readJsonOrThrow<{ sessions: FactoryUserSessionPayload[] }>(res, 'Failed to list sessions');
  return body.sessions.map(normalizeUserSession);
}

export type CreateUserSessionOptions =
  | { branch: string; baseBranch?: string; sessionId?: never; title?: never }
  | { sessionId: string; title: string; branch?: never; baseBranch?: never };

export async function createUserSession(
  baseUrl: string,
  projectRepositoryId: string,
  options: CreateUserSessionOptions,
): Promise<FactoryUserSession> {
  const result = await postRepositoryGitOp<{ session: FactoryUserSessionPayload }>(
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
