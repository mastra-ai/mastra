/**
 * Best-effort mirror of local audit events into WorkOS Audit Logs.
 *
 * When WorkOS auth is configured, every locally-recorded audit event is also
 * forwarded to `workos.auditLogs.createEvent()` so enterprises get the WorkOS
 * Admin Portal viewer/export and SIEM log streams. Forwarding is
 * fire-and-forget: failures (including actions not yet registered in the
 * WorkOS dashboard under Audit Logs → Events) are logged with an `[Audit]`
 * prefix and dropped — the local `audit_events` table remains the source of
 * truth.
 */

import { getWorkOSProvider, isWorkOSAuth } from '../auth';
import type { AuditEventRow } from '../storage/domains/audit/base';

/** WorkOS requires a `context.location`; fall back when the request had none. */
const UNKNOWN_LOCATION = 'unknown';

/** Flatten metadata to the primitive record WorkOS accepts. */
function flattenMetadata(metadata: Record<string, unknown>): Record<string, string | number | boolean> {
  const flat: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      flat[key] = value;
    } else {
      try {
        flat[key] = JSON.stringify(value);
      } catch {
        // Unserializable value — drop the key rather than the event.
      }
    }
  }
  return flat;
}

/** Map a local audit row to the WorkOS `createEvent` payload. */
export function toWorkOSEvent(event: AuditEventRow): {
  action: string;
  occurredAt: Date;
  actor: { type: string; id: string };
  targets: Array<{ type: string; id: string; name?: string }>;
  context: { location: string; userAgent?: string };
  metadata: Record<string, string | number | boolean>;
} {
  return {
    action: event.action,
    occurredAt: event.occurredAt,
    actor: { type: event.actorType === 'agent' ? 'agent' : 'user', id: event.actorId },
    targets: event.targets.map(target => ({
      type: target.type,
      id: target.id,
      ...(target.name !== undefined ? { name: target.name } : {}),
    })),
    context: {
      location: event.context.location ?? UNKNOWN_LOCATION,
      ...(event.context.userAgent !== undefined ? { userAgent: event.context.userAgent } : {}),
    },
    metadata: flattenMetadata(event.metadata),
  };
}

/**
 * Forward one recorded audit event to WorkOS Audit Logs. Never throws; no-op
 * unless the active auth adapter is WorkOS (other providers have no WorkOS
 * client — the local `audit_events` table stays the source of truth).
 * Fire-and-forget — callers should not await this on the request path.
 */
export async function forwardToWorkOS(event: AuditEventRow): Promise<void> {
  if (!isWorkOSAuth()) return;
  try {
    const workos = getWorkOSProvider().getWorkOS();
    await workos.auditLogs.createEvent(event.orgId, toWorkOSEvent(event));
  } catch (err) {
    console.warn('[Audit] Failed to forward audit event to WorkOS', {
      action: event.action,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
