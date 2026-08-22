import type { MastraFGAPermissionInput } from '@mastra/core/auth/ee';
import type { RequestContext } from '@mastra/core/di';
import { MastraMemory } from '@mastra/core/memory';
import { MASTRA_AUTH_MODE_KEY, MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY, MASTRA_USER_KEY } from '../constants';
import { MastraFGAPermissions } from '../fga-permissions';
import { HTTPException } from '../http-exception';

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
 * Whether the current request must carry a server-derived memory resource scope.
 *
 * Memory routes historically treated "no resource ID" as "no restriction", which
 * let any authenticated caller enumerate and read every resource's threads when
 * `auth.mapUserToResourceId` was not configured. Authenticated requests now have
 * to be scoped unless the deployment opts out.
 *
 * The scope requirement is skipped when:
 * - `server.memory.requireResourceScope` is explicitly `false` (opt-out),
 * - an FGA provider is configured (those paths already filter fail-closed),
 * - the request was authenticated by studio auth (operator surface),
 * - the request is unauthenticated (no auth configured, e.g. local development).
 *
 * The authenticated check reads the reserved user key, which is only set by the
 * auth middleware after successful authentication. `MASTRA_IS_STUDIO_KEY` is
 * deliberately not used here: it is derived from a client-supplied header and
 * would be trivially spoofable.
 */
export function requiresMemoryResourceScope(mastra: any, requestContext: RequestContext | undefined): boolean {
  const serverConfig = mastra?.getServer?.();
  if (serverConfig?.memory?.requireResourceScope === false) {
    return false;
  }
  if (serverConfig?.fga) {
    return false;
  }
  if (requestContext?.get(MASTRA_AUTH_MODE_KEY) === 'studio') {
    return false;
  }
  // `user` is the legacy alias the auth middleware writes alongside MASTRA_USER_KEY.
  return requestContext?.get(MASTRA_USER_KEY) !== undefined || requestContext?.get('user') !== undefined;
}

/**
 * Resolves the resource ID used to scope a memory request.
 *
 * When a scope is required, the client-supplied value is ignored entirely: the
 * scope must be server-derived, otherwise a caller could simply pass another
 * user's resource ID to pass the ownership check.
 */
export function resolveMemoryResourceId({
  mastra,
  requestContext,
  clientResourceId,
}: {
  mastra: any;
  requestContext: RequestContext | undefined;
  clientResourceId: string | undefined;
}): string | undefined {
  const contextResourceId = requestContext?.get(MASTRA_RESOURCE_ID_KEY) as string | undefined;
  if (contextResourceId) {
    return contextResourceId;
  }
  return requiresMemoryResourceScope(mastra, requestContext) ? undefined : clientResourceId;
}

/**
 * Fails closed when an authenticated request has no resolvable memory scope.
 */
export function assertMemoryResourceScope(
  mastra: any,
  requestContext: RequestContext | undefined,
  effectiveResourceId: string | undefined,
): void {
  if (effectiveResourceId) {
    return;
  }
  if (!requiresMemoryResourceScope(mastra, requestContext)) {
    return;
  }
  throw new HTTPException(403, {
    message:
      'Memory access requires a resource scope. Configure server auth with mapUserToResourceId so the server can derive the resource ID for the authenticated user, or set server.memory.requireResourceScope to false to allow unscoped memory access.',
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
 *
 * When `scope` is provided and the request requires a server-derived resource
 * scope, an owned thread is denied if no scope could be resolved, instead of
 * granting access to every resource's threads.
 */
export async function validateThreadOwnership(
  thread: { resourceId?: string | null } | null | undefined,
  effectiveResourceId: string | undefined,
  scope?: { mastra: any; requestContext?: RequestContext },
): Promise<void> {
  if (!thread?.resourceId) {
    return;
  }
  if (!effectiveResourceId) {
    if (scope) {
      assertMemoryResourceScope(scope.mastra, scope.requestContext, effectiveResourceId);
    }
    return;
  }
  if (thread.resourceId !== effectiveResourceId) {
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
  await validateThreadOwnership(thread, effectiveResourceId, { mastra, requestContext });

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
