import type { MastraFGAPermissionInput } from '@mastra/core/auth/ee';
import type { RequestContext } from '@mastra/core/di';
import { MastraMemory } from '@mastra/core/memory';
import { MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY, MASTRA_USER_KEY } from '../constants';
import { MastraFGAPermissions } from '../fga-permissions';
import { HTTPException } from '../http-exception';
import { hasAdminBypass } from './authorship';

// Validation helper
export function validateBody(body: Record<string, unknown>) {
  const errorResponse = Object.entries(body).reduce<Record<string, string>>((acc, [key, value]) => {
    if (!value) {
      acc[key] = `Argument "${key}" is required`;
    }
    return acc;
  }, {});

  if (Object.keys(errorResponse).length > 0) {
    throw new HTTPException(400, { message: Object.values(errorResponse)[0] });
  }
}

/**
 * sanitizes the body by removing disallowed keys.
 * @param body body to sanitize
 * @param disallowedKeys keys to remove from the body
 */
export function sanitizeBody(body: Record<string, unknown>, disallowedKeys: string[]) {
  for (const key of disallowedKeys) {
    if (key in body) {
      delete body[key];
    }
  }
}

export function parsePerPage(
  value: string | undefined,
  defaultValue: number = 100,
  max: number = 1000,
): number | false {
  const normalized = (value || '').trim().toLowerCase();
  // Handle explicit false to bypass pagination
  if (normalized === 'false') {
    return false;
  }
  const parsed = parseInt(value || String(defaultValue), 10);
  if (isNaN(parsed)) return defaultValue;
  return Math.min(max, Math.max(1, parsed));
}

/**
 * Parses filter query parameters into a key-value object.
 */
export function parseFilters(filters: string | string[] | undefined): Record<string, string> | undefined {
  if (!filters) return undefined;

  return Object.fromEntries(
    (Array.isArray(filters) ? filters : [filters]).map((attr: string) => {
      const [key, ...valueParts] = attr.split(':');
      const value = valueParts.join(':'); // ✅ Handles colons in values
      return [key, value];
    }),
  );
}

// ============================================================================
// Authorization Utilities
// ============================================================================

/**
 * Gets the effective resourceId, preferring the reserved key from requestContext
 * over client-provided values for security.
 */
export function getEffectiveResourceId(
  requestContext: RequestContext | undefined,
  clientResourceId: string | undefined,
): string | undefined {
  const contextResourceId = requestContext?.get(MASTRA_RESOURCE_ID_KEY) as string | undefined;
  return contextResourceId || clientResourceId;
}

/**
 * Ensures a memory request has a resolvable resource ID. The body's
 * `memory.resource` is optional so authenticated setups can rely on the
 * server-derived resource ID (MASTRA_RESOURCE_ID_KEY set via mapUserToResourceId).
 * When neither the body nor the request context provides one, reject with a
 * clear 400 instead of failing deep inside agent execution.
 */
export function requireEffectiveResourceId(
  effectiveResourceId: string | undefined,
): asserts effectiveResourceId is string {
  if (!effectiveResourceId) {
    throw new HTTPException(400, {
      message:
        'A resource ID is required when using memory. Provide memory.resource in the request body, or configure server auth with mapUserToResourceId to derive it from the authenticated user.',
    });
  }
}

/**
 * True when an auth provider ran and accepted the caller. `coreAuthMiddleware`
 * writes both `MASTRA_USER_KEY` and the legacy `user` key, so either is enough.
 */
export function hasAuthenticatedUser(requestContext: RequestContext | undefined): boolean {
  const user = requestContext?.get(MASTRA_USER_KEY) ?? requestContext?.get('user');
  return !!user && typeof user === 'object';
}

/**
 * Fails closed when an authenticated caller cannot be scoped to a resource.
 *
 * `getEffectiveResourceId` returns undefined when auth is configured without
 * `mapUserToResourceId` and the caller passes no `resourceId`. Handlers that
 * read that as "no filter" widen access to every resource, so any authenticated
 * user can list, read or mutate another user's threads — in auth-only mode
 * (no RBAC) the route layer has already granted full access by then.
 *
 * With no auth provider (local dev, Studio) there is no identity to scope to,
 * so behaviour is unchanged.
 */
export function requireResourceScope({
  mastra,
  requestContext,
  effectiveResourceId,
  resource = 'memory',
}: {
  mastra?: any;
  requestContext?: RequestContext;
  effectiveResourceId?: string;
  resource?: string;
}): void {
  if (effectiveResourceId) return;
  if (!hasAuthenticatedUser(requestContext)) return;
  // A configured FGA provider authorizes every thread individually, so an
  // unscoped request is still checked record by record.
  if (mastra?.getServer?.()?.fga) return;
  if (requestContext && hasAdminBypass(requestContext, resource)) return;

  throw new HTTPException(403, {
    message:
      'Access denied: request could not be scoped to a resource. Configure server auth with mapUserToResourceId, or pass an explicit resourceId.',
  });
}

/**
 * Gets the effective threadId, preferring the reserved key from requestContext
 * over client-provided values for security.
 */
export function getEffectiveThreadId(
  requestContext: RequestContext | undefined,
  clientThreadId: string | undefined,
): string | undefined {
  const contextThreadId = requestContext?.get(MASTRA_THREAD_ID_KEY) as string | undefined;
  return contextThreadId || clientThreadId;
}

/**
 * Validates that a thread belongs to the specified resourceId.
 * Throws 403 if the thread exists but belongs to a different resource.
 * Threads with no resourceId are accessible to all (shared threads).
 */
export async function validateThreadOwnership(
  thread: { resourceId?: string | null } | null | undefined,
  effectiveResourceId: string | undefined,
): Promise<void> {
  if (thread && effectiveResourceId && thread.resourceId && thread.resourceId !== effectiveResourceId) {
    throw new HTTPException(403, { message: 'Access denied: thread belongs to a different resource' });
  }
}

/**
 * Validates both coarse resource ownership and fine-grained thread access.
 * FGA enforcement is a no-op when no FGA provider is configured.
 */
export async function enforceThreadAccess({
  mastra,
  requestContext,
  threadId,
  thread,
  effectiveResourceId,
  permission = MastraFGAPermissions.MEMORY_READ,
}: {
  mastra: any;
  requestContext?: RequestContext;
  threadId: string;
  thread?: { resourceId?: string | null } | null;
  effectiveResourceId?: string;
  permission?: MastraFGAPermissionInput;
}): Promise<void> {
  requireResourceScope({ mastra, requestContext, effectiveResourceId });
  await validateThreadOwnership(thread, effectiveResourceId);

  const fgaProvider = mastra?.getServer?.()?.fga;
  if (!fgaProvider) {
    return;
  }

  const user = requestContext?.get('user');
  if (!user || typeof user !== 'object') {
    throw new HTTPException(403, { message: 'FGA authorization denied: authenticated user is required' });
  }

  await MastraMemory.checkThreadFGA({
    mastra,
    user: user as { id: string; [key: string]: unknown },
    threadId,
    resourceId: thread?.resourceId ?? effectiveResourceId,
    requestContext,
    permission,
  });
}

/**
 * Validates that a workflow run belongs to the specified resourceId.
 * Throws 403 if the run exists but belongs to a different resource.
 */
export async function validateRunOwnership(
  run: { resourceId?: string | null } | null | undefined,
  effectiveResourceId: string | undefined,
): Promise<void> {
  if (run && effectiveResourceId && run.resourceId && run.resourceId !== effectiveResourceId) {
    throw new HTTPException(403, { message: 'Access denied: workflow run belongs to a different resource' });
  }
}
