import { createHash } from 'node:crypto';

import type { IMastraLogger } from '@internal/core/logger';

/**
 * Tenancy-scoped storage operations silently no-op on mismatch by design:
 * getters return `null`, deletes affect zero rows. That's the correct security
 * posture — a thrown error would leak existence via timing/text.
 *
 * It also means operators can't tell from the caller's return value whether
 * "id didn't exist" or "id belonged to another tenant." These helpers emit a
 * debug-level log at the storage layer so an operator can grep for silent
 * tenancy misses when a scoped call is behaving unexpectedly.
 *
 * PII handling: the id and tenancy pair are never logged verbatim. We hash
 * them into an opaque 8-char correlation token that lets an operator group
 * requests from the same caller without reconstructing the tenancy.
 */

const TOKEN_LEN = 8;

/**
 * True when `filters` has at least one tenancy dimension set. Adapters use this
 * to gate the debug log so unscoped reads/deletes don't emit noise on legit
 * 404s.
 */
export function isTenancyScoped(filters: { organizationId?: string; projectId?: string } | undefined): boolean {
  return !!filters && (filters.organizationId !== undefined || filters.projectId !== undefined);
}

/**
 * Hash `(id, organizationId, projectId)` into an opaque 8-char correlation
 * token. Not cryptographically strong — the goal is grouping, not secrecy.
 */
function tenancyToken(id: string, organizationId: string | undefined, projectId: string | undefined): string {
  return createHash('sha256')
    .update(`${id}:${organizationId ?? ''}:${projectId ?? ''}`)
    .digest('hex')
    .slice(0, TOKEN_LEN);
}

/**
 * Log a scoped read that returned null. Call only when `filters` was set and
 * the scoped SELECT did not match a row.
 */
export function logTenancyReadMiss(
  logger: IMastraLogger,
  op: string,
  table: string,
  args: { id: string; organizationId?: string; projectId?: string },
): void {
  logger.debug('tenancy: scoped read miss', {
    op,
    table,
    token: tenancyToken(args.id, args.organizationId, args.projectId),
  });
}

/**
 * Log a scoped delete that affected zero rows. Call only when `filters` was
 * set and the scoped DML did not delete a row.
 */
export function logTenancyDeleteNoOp(
  logger: IMastraLogger,
  op: string,
  table: string,
  args: { id: string; organizationId?: string; projectId?: string },
): void {
  logger.debug('tenancy: scoped delete no-op', {
    op,
    table,
    token: tenancyToken(args.id, args.organizationId, args.projectId),
  });
}
