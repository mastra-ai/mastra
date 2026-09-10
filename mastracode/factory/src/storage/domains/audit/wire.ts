import type { AuditActorType } from './actors.js';
import type { AuditEventRow, AuditTarget } from './base.js';

export interface WireAuditActor {
  id: string;
  name: string;
  avatarUrl?: string;
}

/** An `AuditEventRow` as the list route sends it: the date as ISO text, tenancy and request context left behind. */
export interface WireAuditEvent {
  id: string;
  actorId: string;
  actorType: AuditActorType;
  action: string;
  targets: AuditTarget[];
  metadata: Record<string, unknown>;
  occurredAt: string;
}

export interface WireAuditPage {
  events: WireAuditEvent[];
  actors: Record<string, WireAuditActor>;
  nextCursor?: string;
}

export function toWireAuditEvent(row: AuditEventRow): WireAuditEvent {
  return {
    id: row.id,
    actorId: row.actorId,
    actorType: row.actorType,
    action: row.action,
    targets: row.targets,
    metadata: row.metadata,
    occurredAt: row.occurredAt.toISOString(),
  };
}
