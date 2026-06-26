import { matchesPermission } from '@mastra/core/auth/ee';
import type { RequestContext } from '@mastra/core/di';

import { MASTRA_RESOURCE_ID_KEY, MASTRA_USER_KEY, MASTRA_USER_PERMISSIONS_KEY } from '../constants';
import { HTTPException } from '../http-exception';

/**
 * Shape of a stored record that carries ownership + visibility metadata.
 * Used by `matchesAuthorFilter` and the access-assertion helpers.
 */
export type OwnedRecord = {
  authorId?: string | null;
  visibility?: 'private' | 'public';
};

/**
 * Returns the author id associated with the authenticated caller, or `null`
 * if auth is not configured / the caller cannot be resolved.
 *
 * Prefers `MASTRA_RESOURCE_ID_KEY` (set by `authConfig.mapUserToResourceId`)
 * and falls back to `user.id` on the authenticated user object.
 */
export function getCallerAuthorId(requestContext: RequestContext): string | null {
  const resourceId = requestContext.get(MASTRA_RESOURCE_ID_KEY);
  if (typeof resourceId === 'string' && resourceId.length > 0) {
    return resourceId;
  }

  const user = requestContext.get(MASTRA_USER_KEY);
  if (user && typeof user === 'object' && 'id' in user) {
    const id = (user as { id: unknown }).id;
    if (typeof id === 'string' && id.length > 0) {
      return id;
    }
  }

  return null;
}

/**
 * Returns the list of permission strings currently attached to the caller by
 * the RBAC provider. Returns an empty array when RBAC isn't configured.
 */
export function getCallerPermissions(requestContext: RequestContext): string[] {
  const raw = requestContext.get(MASTRA_USER_PERMISSIONS_KEY);
  if (Array.isArray(raw)) {
    return raw.filter((p): p is string => typeof p === 'string');
  }
  return [];
}

/**
 * True if the caller holds a wildcard permission that lets them manage a
 * resource they don't own (e.g. admins listing agents across tenants).
 *
 * Recognizes `*`, `<resource>:*`, and `<resource>:admin`.
 */
export function hasAdminBypass(requestContext: RequestContext, resource: string): boolean {
  const permissions = getCallerPermissions(requestContext);
  if (permissions.length === 0) return false;
  const wildcardAll = '*';
  const resourceWildcard = `${resource}:*`;
  const resourceAdmin = `${resource}:admin`;
  return permissions.some(p => p === wildcardAll || p === resourceWildcard || p === resourceAdmin);
}

/**
 * True if the caller holds a permission explicitly scoped to a specific
 * resource id — e.g. `agents:read:agent-123` or `agents:*:agent-123`.
 *
 * Broad grants without a resource-id segment (e.g. the role-default
 * `agents:execute`) are intentionally NOT treated as satisfying ownership
 * overrides. Those broad grants already gate route access at the
 * `requiresPermission` layer; giving them a second life as per-record
 * overrides would defeat the owner/visibility model.
 *
 * When called without `resourceId` (the legacy shape), falls back to the
 * original "any matching permission" behavior.
 */
export function hasScopedPermission(args: {
  requestContext: RequestContext;
  resource: string;
  action: string;
  resourceId?: string;
}): boolean {
  const { requestContext, resource, action, resourceId } = args;
  const permissions = getCallerPermissions(requestContext);
  if (permissions.length === 0) return false;

  if (!resourceId) {
    const required = `${resource}:${action}`;
    return permissions.some(p => matchesPermission(p, required));
  }

  const required = `${resource}:${action}:${resourceId}`;
  return permissions.some(p => {
    // Only honor grants that explicitly name a resource id. A granted
    // permission with just `<resource>:<action>` (no id segment) is
    // considered a broad role grant, not a per-record override.
    const parts = p.split(':');
    if (parts.length < 3) return false;
    return matchesPermission(p, required);
  });
}

export type AuthorFilter =
  | { kind: 'unrestricted' }
  | { kind: 'exact'; authorId: string }
  | { kind: 'ownedOrPublic'; callerAuthorId: string }
  | { kind: 'publicOnly' }
  | { kind: 'ownedOrPublicOthers'; callerAuthorId: string; queryAuthorId: string };

/**
 * Resolves the filter to apply when listing owner-scoped records.
 *
 * Behavior matrix:
 * - Admin bypass + no query overrides           → `unrestricted`.
 * - Admin bypass + `authorId=X`                 → `exact` (all of X's rows).
 * - `visibility=public` (any caller)            → `publicOnly` (aggregate public rows across owners).
 * - `authorId=X`, caller === X                  → `exact` (all of caller's rows).
 * - `authorId=X`, caller !== X (non-admin)      → `ownedOrPublicOthers` (only X's public rows).
 * - No caller (auth off)                        → `unrestricted` (or `exact` if query supplied).
 * - Default                                     → `ownedOrPublic` (caller's rows + legacy unowned + any public rows).
 */
export function resolveAuthorFilter(args: {
  requestContext: RequestContext;
  resource: string;
  queryAuthorId?: string;
  queryVisibility?: 'public';
}): AuthorFilter {
  const { requestContext, resource, queryAuthorId, queryVisibility } = args;
  const callerAuthorId = getCallerAuthorId(requestContext);
  const bypass = hasAdminBypass(requestContext, resource);

  if (queryVisibility === 'public' && !queryAuthorId) {
    return { kind: 'publicOnly' };
  }

  if (bypass) {
    return queryAuthorId ? { kind: 'exact', authorId: queryAuthorId } : { kind: 'unrestricted' };
  }

  // Auth isn't configured (no caller) → treat as unrestricted. The route's
  // `requiresAuth`/`requiresPermission` is what gates access in that mode.
  if (!callerAuthorId) {
    return queryAuthorId ? { kind: 'exact', authorId: queryAuthorId } : { kind: 'unrestricted' };
  }

  if (queryAuthorId) {
    if (queryAuthorId === callerAuthorId) {
      return { kind: 'exact', authorId: callerAuthorId };
    }
    // Non-owner asking about another user: only that user's public rows are visible.
    return { kind: 'ownedOrPublicOthers', callerAuthorId, queryAuthorId };
  }

  return { kind: 'ownedOrPublic', callerAuthorId };
}

/**
 * Returns `true` if the record is visible to the caller given the resolved
 * filter. See `resolveAuthorFilter` for the filter semantics.
 *
 * Legacy rows with `authorId == null` are treated as public (visible to all).
 */
export function matchesAuthorFilter(record: OwnedRecord, filter: AuthorFilter): boolean {
  const owner = record.authorId ?? null;
  const isPublic = record.visibility === 'public';

  switch (filter.kind) {
    case 'unrestricted':
      return true;
    case 'exact':
      return owner === filter.authorId;
    case 'ownedOrPublic':
      return owner === null || owner === filter.callerAuthorId || isPublic;
    case 'publicOnly':
      return owner === null || isPublic;
    case 'ownedOrPublicOthers':
      // Filtering by another author's rows: only expose their public ones.
      // Legacy unowned rows match if the query is for `null`; here the query
      // is always for a concrete id, so unowned rows don't match.
      return owner === filter.queryAuthorId && isPublic;
  }
}

/**
 * Asserts the caller has read access to the record. Throws 404 if not.
 *
 * Read access is granted when:
 * - The record has no owner (legacy/public), OR
 * - The record is marked `visibility: 'public'`, OR
 * - The caller owns the record, OR
 * - The caller has admin bypass (`*`, `<resource>:*`, `<resource>:admin`), OR
 * - The caller holds `<resource>:read` or `<resource>:read:<resourceId>`.
 */
export function assertReadAccess(args: {
  requestContext: RequestContext;
  resource: string;
  resourceId?: string;
  record: OwnedRecord;
}): void {
  const { requestContext, resource, resourceId, record } = args;
  const owner = record.authorId ?? null;

  if (owner === null) return;
  if (record.visibility === 'public') return;
  if (hasAdminBypass(requestContext, resource)) return;

  const callerAuthorId = getCallerAuthorId(requestContext);
  // No authenticated user on the request context means auth is not configured
  // (single-user/dev mode). When auth IS configured, coreAuthMiddleware
  // rejects unauthenticated requests with 401 before they reach handlers,
  // so an absent user here genuinely means no auth provider.
  if (!callerAuthorId && !requestContext.get(MASTRA_USER_KEY)) return;
  if (callerAuthorId === owner) return;

  if (hasScopedPermission({ requestContext, resource, action: 'read', resourceId })) {
    return;
  }

  throw new HTTPException(404, { message: 'Not found' });
}

/**
 * Asserts the caller has execute access to the record. Throws 404 if not.
 *
 * Execute access is granted when:
 * - The record has no owner (legacy/public), OR
 * - The record is marked `visibility: 'public'`, OR
 * - The caller owns the record, OR
 * - The caller has admin bypass (`*`, `<resource>:*`, `<resource>:admin`), OR
 * - The caller holds `<resource>:execute` / `<resource>:execute:<resourceId>`, OR
 * - The caller holds `<resource>:read` / `<resource>:read:<resourceId>`
 *   (read implies the ability to consume/chat with the resource).
 */
export function assertExecuteAccess(args: {
  requestContext: RequestContext;
  resource: string;
  resourceId?: string;
  record: OwnedRecord;
}): void {
  const { requestContext, resource, resourceId, record } = args;
  const owner = record.authorId ?? null;

  if (owner === null) return;
  if (record.visibility === 'public') return;
  if (hasAdminBypass(requestContext, resource)) return;

  const callerAuthorId = getCallerAuthorId(requestContext);
  if (!callerAuthorId && !requestContext.get(MASTRA_USER_KEY)) return; // No auth configured (see assertReadAccess)
  if (callerAuthorId === owner) return;

  if (hasScopedPermission({ requestContext, resource, action: 'execute', resourceId })) {
    return;
  }
  if (hasScopedPermission({ requestContext, resource, action: 'read', resourceId })) {
    return;
  }

  throw new HTTPException(404, { message: 'Not found' });
}

/**
 * Asserts the caller has write access (edit or delete) to the record.
 * Throws 404 if not.
 *
 * Write access is granted when:
 * - The record has no owner (legacy), OR
 * - The caller owns the record, OR
 * - The caller has admin bypass, OR
 * - The caller holds `<resource>:<action>` or `<resource>:<action>:<resourceId>`.
 *
 * `visibility: 'public'` alone does NOT grant write access.
 */
export function assertWriteAccess(args: {
  requestContext: RequestContext;
  resource: string;
  resourceId?: string;
  action: 'edit' | 'delete' | 'write';
  record: OwnedRecord;
}): void {
  const { requestContext, resource, resourceId, action, record } = args;
  const owner = record.authorId ?? null;

  if (owner === null) return;
  if (hasAdminBypass(requestContext, resource)) return;

  const callerAuthorId = getCallerAuthorId(requestContext);
  if (!callerAuthorId && !requestContext.get(MASTRA_USER_KEY)) return; // No auth configured (see assertReadAccess)
  if (callerAuthorId === owner) return;

  if (hasScopedPermission({ requestContext, resource, action, resourceId })) {
    return;
  }

  throw new HTTPException(404, { message: 'Not found' });
}

/**
 * Asserts the caller has share access to the record. Throws 404 if not.
 *
 * Share access controls who can change a record's audience/visibility
 * (e.g. flipping `private` ↔ `public`). It is intentionally separate from
 * `write`: a caller with only `<resource>:write` MUST NOT be able to flip
 * visibility — that would let any editor expose private records.
 *
 * Share access is granted when:
 * - The record has no owner (legacy), OR
 * - The caller owns the record (creators can share their own records), OR
 * - The caller has admin bypass (`*`, `<resource>:*`, `<resource>:admin`), OR
 * - The caller holds `<resource>:share` / `<resource>:share:<resourceId>`
 *   (or any pattern that matches it, e.g. `*:share`).
 *
 * `visibility: 'public'` does NOT grant share access — being readable doesn't
 * imply the right to change who else can read.
 */
export function assertShareAccess(args: {
  requestContext: RequestContext;
  resource: string;
  resourceId?: string;
  record: OwnedRecord;
}): void {
  const { requestContext, resource, resourceId, record } = args;
  const owner = record.authorId ?? null;

  if (owner === null) return;
  if (hasAdminBypass(requestContext, resource)) return;

  const callerAuthorId = getCallerAuthorId(requestContext);
  if (!callerAuthorId && !requestContext.get(MASTRA_USER_KEY)) return; // No auth configured (see assertReadAccess)
  if (callerAuthorId === owner) return;

  if (hasScopedPermission({ requestContext, resource, action: 'share', resourceId })) {
    return;
  }

  throw new HTTPException(404, { message: 'Not found' });
}

/**
 * Alias for `assertWriteAccess` with `action: 'edit'`. Prefer `assertWriteAccess`
 * in new code so the action is explicit.
 */
export function assertOwnership(args: {
  requestContext: RequestContext;
  resource: string;
  resourceId?: string;
  record: OwnedRecord;
}): void {
  assertWriteAccess({ ...args, action: 'edit' });
}
