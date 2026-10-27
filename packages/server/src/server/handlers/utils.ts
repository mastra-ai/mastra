import type { Mastra } from '@mastra/core';
import type { IFGAProvider, MastraFGAPermissionInput } from '@mastra/core/auth/ee';
import type { RequestContext } from '@mastra/core/di';
import { MastraMemory } from '@mastra/core/memory';
import type { Workflow } from '@mastra/core/workflows';
import {
  MASTRA_AUTH_MODE_KEY,
  MASTRA_RESOURCE_ID_KEY,
  MASTRA_THREAD_ID_KEY,
  isReservedRequestContextKey,
} from '../constants';
import { MastraFGAPermissions } from '../fga-permissions';
import { HTTPException } from '../http-exception';

/**
 * Resolves a workflow by id or registration key from the set Mastra exposes
 * publicly. Unlike `mastra.getWorkflowById`, this excludes hidden internal
 * workflows (e.g. a durable agent's backing loop), which must never be
 * runnable through HTTP routes.
 */
export function getPublicWorkflowById(mastra: Mastra, workflowId: string): Workflow | undefined {
  const workflows = mastra.listWorkflows();
  return (
    Object.values(workflows).find(workflow => workflow.id === workflowId) ??
    (Object.hasOwn(workflows, workflowId) ? workflows[workflowId] : undefined)
  );
}

/**
 * Resolves the FGA provider a handler should use for this request, following
 * the same auth-mode-aware selection as the route-level checks: Studio auth
 * requests use `studio.fga` when it is configured, and everything else uses
 * `server.fga`.
 *
 * Returns `undefined` when FGA is not configured at all. When FGA is
 * configured but no provider applies to this request (for example `studio.fga`
 * is set and the request used server auth), the request is denied rather than
 * treated as unrestricted.
 */
export function getHandlerFGAProvider(mastra: any, requestContext?: RequestContext): IFGAProvider | undefined {
  const studioFga = mastra?.getStudio?.()?.fga as IFGAProvider | undefined;
  const serverFga = mastra?.getServer?.()?.fga as IFGAProvider | undefined;

  if (requestContext?.get(MASTRA_AUTH_MODE_KEY) === 'studio' && studioFga) return studioFga;
  if (serverFga) return serverFga;
  if (studioFga) {
    throw new HTTPException(403, { message: 'Access denied: no FGA provider is configured for this request' });
  }
  return undefined;
}

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

const CREDENTIAL_HEADER_NAMES = new Set([
  'authorization',
  'proxy-authorization',
  'x-api-key',
  'api-key',
  'x-goog-api-key',
  'cookie',
]);

/**
 * Removes credential-bearing headers from client-supplied `modelSettings.headers`
 * so a caller's own auth (e.g. the app's bearer token) can never override the
 * provider credential configured on the server. Non-credential headers are kept.
 */
export function stripClientCredentialHeaders(body: Record<string, unknown>) {
  const modelSettings = body.modelSettings;
  if (!modelSettings || typeof modelSettings !== 'object') return;
  const headers = (modelSettings as { headers?: unknown }).headers;
  if (!headers || typeof headers !== 'object') return;

  const kept = Object.fromEntries(
    Object.entries(headers).filter(([name]) => !CREDENTIAL_HEADER_NAMES.has(name.toLowerCase())),
  );
  body.modelSettings = { ...modelSettings, headers: kept };
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

/**
 * Merges a body-supplied requestContext into the trusted server RequestContext.
 * The server context is authoritative: reserved keys are skipped and body values
 * only fill keys the server context has not already set.
 */
export function mergeBodyRequestContext(serverRequestContext: RequestContext, bodyRequestContext: unknown): void {
  if (!bodyRequestContext || typeof bodyRequestContext !== 'object') {
    return;
  }

  for (const [key, value] of Object.entries(bodyRequestContext)) {
    if (isReservedRequestContextKey(key)) continue;
    if (serverRequestContext.get(key) === undefined) {
      serverRequestContext.set(key, value);
    }
  }
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
 * Returns the resource id resolved from the request context alone (set via
 * `mapUserToResourceId` or the `x-resource-id` header), ignoring any
 * client-provided value. Its presence indicates a resource-scoped caller;
 * its absence indicates a privileged/service context.
 */
export function getContextResourceId(requestContext: RequestContext | undefined): string | undefined {
  return requestContext?.get(MASTRA_RESOURCE_ID_KEY) as string | undefined;
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
 * Applies the effective threadId to a client memory thread option. Object
 * threads keep their other fields (metadata, title, ...) so they reach thread
 * creation; a client-supplied resourceId is dropped because the server decides
 * the resource.
 */
export function applyEffectiveThreadId<T extends string | { id: string } | undefined>(
  thread: T,
  effectiveThreadId: string | undefined,
): T | string {
  if (!effectiveThreadId) return thread;
  if (thread && typeof thread === 'object') {
    const { resourceId: _resourceId, ...fields } = thread as { id: string; resourceId?: unknown };
    return { ...fields, id: effectiveThreadId } as T;
  }
  return effectiveThreadId;
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
  await validateThreadOwnership(thread, effectiveResourceId);

  const fgaProvider = getHandlerFGAProvider(mastra, requestContext);
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
 * Validates that a caller may act on a workflow run.
 *
 * Without `server.auth.mapUserToResourceId` there is no tenancy model, and only a mismatch
 * between two present resource ids is denied. With a mapper, a resource-scoped caller may only
 * act on runs it owns (an owner-less run is not its run). An unscoped caller is a
 * privileged/service context (see getContextResourceId), but that privilege is only granted when
 * an FGA provider authorizes the route; otherwise it is refused rather than granted implicitly,
 * as on the thread-transfer route.
 */
export async function validateRunOwnership(
  run: { resourceId?: string | null } | null | undefined,
  effectiveResourceId: string | undefined,
  mastra?: {
    getServer?: () => { auth?: unknown; fga?: unknown } | undefined;
    getStudio?: () => { fga?: unknown } | undefined;
  },
  requestContext?: RequestContext,
): Promise<void> {
  if (!run) return;
  const server = mastra?.getServer?.();
  const tenancy =
    typeof (server?.auth as { mapUserToResourceId?: unknown } | undefined)?.mapUserToResourceId === 'function';
  if (!tenancy) {
    if (effectiveResourceId && run.resourceId && run.resourceId !== effectiveResourceId) {
      throw new HTTPException(403, { message: 'Access denied: workflow run belongs to a different resource' });
    }
    return;
  }
  if (effectiveResourceId) {
    if (run.resourceId !== effectiveResourceId) {
      throw new HTTPException(403, { message: 'Access denied: workflow run belongs to a different resource' });
    }
    return;
  }
  if (!getHandlerFGAProvider(mastra, requestContext)) {
    throw new HTTPException(403, {
      message:
        'Access denied: unscoped workflow run access requires explicit authorization. Configure an FGA provider to authorize privileged run access.',
    });
  }
}
