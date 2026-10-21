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
  orgId: string;
  userId: string;
  /**
   * Memory resource the session runs under (the Factory for runs and Slack
   * sessions, the owner for user sessions). Only the single-session read reports it.
   */
  resourceId?: string;
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
  /** What the viewer may do with this session, computed by the server. */
  capabilities?: { recreateSandbox: boolean };
}

type FactoryUserSessionPayload = Omit<FactoryUserSession, 'title'> & { title?: string | null };

function normalizeUserSession({ title, ...session }: FactoryUserSessionPayload): FactoryUserSession {
  return { ...session, title: title ?? undefined };
}

/** Every session of the Factory the viewer can see, across all of its repositories and providers. */
export async function listUserSessions(
  baseUrl: string,
  factoryId: string,
  signal?: AbortSignal,
): Promise<FactoryUserSession[]> {
  const res = await fetch(`${baseUrl}/web/factory/projects/${encodeURIComponent(factoryId)}/sessions`, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
    signal,
  });
  const body = await readJsonOrThrow<{ sessions: FactoryUserSessionPayload[] }>(res, 'Failed to list sessions');
  return body.sessions.map(normalizeUserSession);
}

export type CreateUserSessionOptions = (
  | { branch: string; baseBranch?: string; sessionId?: never; title?: never }
  | { sessionId: string; title: string; branch?: never; baseBranch?: never }
) & {
  /** Defaults to `org`. A session someone opens for themselves with New session is created `private`. */
  visibility?: 'private' | 'org';
};

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

/** Destroy the session's sandbox (stopping any active run) so the next message boots a fresh one. */
export async function recreateSessionSandbox(
  baseUrl: string,
  sessionId: string,
): Promise<{ recreated: boolean; aborted: boolean }> {
  const res = await fetch(`${baseUrl}/web/user-sessions/${encodeURIComponent(sessionId)}/sandbox/recreate`, {
    method: 'POST',
    credentials: 'include',
  });
  const body: { recreated?: boolean; aborted?: boolean; error?: string } = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Failed to recreate sandbox (${res.status})`);
  return { recreated: body.recreated === true, aborted: body.aborted === true };
}

/** Start the session's sandbox without sending it a message. Resolves once it's running. */
export async function startSessionSandbox(baseUrl: string, sessionId: string): Promise<void> {
  const res = await fetch(`${baseUrl}/web/user-sessions/${encodeURIComponent(sessionId)}/sandbox/start`, {
    method: 'POST',
    credentials: 'include',
  });
  const body: { error?: string } = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Failed to start sandbox (${res.status})`);
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

export type UserSessionVisibility = FactoryUserSession['visibility'];

/** Owner-only: share a session with the organization or make it private again. */
export async function setUserSessionVisibility(
  baseUrl: string,
  sessionId: string,
  visibility: UserSessionVisibility,
): Promise<FactoryUserSession> {
  const res = await fetch(`${baseUrl}/web/user-sessions/${encodeURIComponent(sessionId)}/visibility`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ visibility }),
  });
  // The server explains refusals (a running session, a Factory run, storage still starting); show its words.
  if (!res.ok) {
    const reason = await res
      .json()
      .then((payload: { error?: unknown }) => (typeof payload.error === 'string' ? payload.error : null))
      .catch(() => null);
    if (reason) throw Object.assign(new Error(reason), { status: res.status });
  }
  const body = await readJsonOrThrow<{ session: FactoryUserSessionPayload }>(
    res,
    'Failed to change session visibility',
  );
  return normalizeUserSession(body.session);
}
