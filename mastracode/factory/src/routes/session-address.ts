import type { Context } from 'hono';

import type { SourceControlStorageHandle } from '../storage/domains/source-control/base.js';
import type { RouteAuth } from './route.js';

export const MAX_RESOURCE_ID_LENGTH = 512;
export const MAX_SCOPE_LENGTH = 2048;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** The address a client uses to point a request at one agent-controller session. */
export interface SessionCommandAddress {
  resourceId: string;
  projectRepositoryId?: string;
  scope?: string;
}

export interface SessionAuthorizationResult {
  allowed: boolean;
  status?: 400 | 401 | 403;
  code?: 'invalid_request' | 'unauthorized' | 'session_forbidden';
  message?: string;
}

export const SESSION_FORBIDDEN: SessionAuthorizationResult = {
  allowed: false,
  status: 403,
  code: 'session_forbidden',
  message: 'Session access denied.',
};

export interface SessionAddressAuthorizerDeps {
  auth: RouteAuth;
  sourceControlStorage?: Pick<
    SourceControlStorageHandle,
    'projectRepositories' | 'connections' | 'worktrees' | 'sessions'
  >;
  ensureSourceControlReady?: () => Promise<void>;
}

/**
 * Authorize an authenticated caller's claim on a session address.
 *
 * Order of proofs:
 * 1. Personal sessions are keyed by the WorkOS user id — always allowed.
 * 2. A stored source-control session row with this id is authoritative: same
 *    org, owner-only when private, no scope requirement.
 * 3. Otherwise fall back to the shared repository/connection/worktree proof,
 *    which needs an explicit `projectRepositoryId` and `scope`.
 *
 * Malformed addresses stay `invalid_request`; every other denial is the
 * published `403 session_forbidden`.
 */
export async function authorizeSessionAddress(
  deps: SessionAddressAuthorizerDeps,
  context: Context,
  address: SessionCommandAddress,
  options: { invalidRequestMessage?: string } = {},
): Promise<SessionAuthorizationResult> {
  const { auth, sourceControlStorage: storage, ensureSourceControlReady } = deps;
  if (!auth.enabled()) return { allowed: true };

  await auth.ensureUser(context);
  const tenant = auth.tenant(context);
  if (!tenant) {
    return { allowed: false, status: 401, code: 'unauthorized', message: 'Authentication required.' };
  }

  if (address.resourceId === tenant.userId) return { allowed: true };

  if (!UUID_RE.test(address.resourceId) || !address.projectRepositoryId || !UUID_RE.test(address.projectRepositoryId)) {
    return {
      allowed: false,
      status: 400,
      code: 'invalid_request',
      message: options.invalidRequestMessage ?? 'Invalid session address.',
    };
  }
  if (!tenant.orgId) return SESSION_FORBIDDEN;
  if (!storage) return SESSION_FORBIDDEN;
  if (ensureSourceControlReady) {
    try {
      await ensureSourceControlReady();
    } catch {
      return SESSION_FORBIDDEN;
    }
  }

  // A stored user-session row is the authoritative record for SPA chats: the
  // address is authorized against it without any worktree-scope requirement.
  const stored = await storage.sessions.getBySessionId(address.resourceId);
  if (stored) {
    if (stored.projectRepositoryId !== address.projectRepositoryId) return SESSION_FORBIDDEN;
    if (stored.orgId !== tenant.orgId) return SESSION_FORBIDDEN;
    if (stored.visibility === 'private' && stored.userId !== tenant.userId) return SESSION_FORBIDDEN;
    return { allowed: true };
  }

  // No stored row (e.g. server/webhook-created addresses): require the shared
  // Factory repository → connection → worktree proof.
  if (!address.scope) return SESSION_FORBIDDEN;
  const projectRepository = await storage.projectRepositories.get({
    orgId: tenant.orgId,
    id: address.projectRepositoryId,
  });
  if (!projectRepository) return SESSION_FORBIDDEN;
  const connection = await storage.connections.get({ orgId: tenant.orgId, id: projectRepository.connectionId });
  if (!connection || connection.factoryProjectId !== address.resourceId) return SESSION_FORBIDDEN;
  const worktree = await storage.worktrees.findByPath({
    projectRepositoryId: address.projectRepositoryId,
    userId: tenant.userId,
    worktreePath: address.scope,
  });
  return worktree ? { allowed: true } : SESSION_FORBIDDEN;
}
