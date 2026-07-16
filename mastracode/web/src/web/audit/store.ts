/**
 * Persistence for Factory audit events.
 *
 * `recordAuditEvent` is deliberately swallow-on-failure: auditing must never
 * break the mutation it observes, so insert errors are logged with an
 * `[Audit]` prefix and dropped. Reads are cursor-paginated newest-first.
 */

import { and, desc, eq, inArray, lt, or } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

import { getAppDb } from '../github/db';
import { ensureAuditDbReady } from './db';
import { auditEvents } from './schema';
import type { AuditActorType, AuditContext, AuditEventRow, AuditTarget } from './schema';

/** Metadata is a bounded summary — never full payloads, never secrets. */
const MAX_METADATA_JSON_LENGTH = 4096;

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

export interface RecordAuditEventInput {
  orgId: string;
  actorId: string;
  /** Who performed the action; defaults to 'human'. */
  actorType?: AuditActorType;
  /** Dot-namespaced action, e.g. 'factory.work_item.stage_moved'. */
  action: string;
  targets: AuditTarget[];
  metadata?: Record<string, unknown>;
  githubProjectId?: string;
  context?: AuditContext;
  occurredAt?: Date;
}

/** Truncate oversized metadata rather than dropping the whole event. */
function boundMetadata(metadata: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!metadata) return {};
  try {
    if (JSON.stringify(metadata).length <= MAX_METADATA_JSON_LENGTH) return metadata;
  } catch {
    return { truncated: true };
  }
  return { truncated: true };
}

/**
 * Append one audit event. Failures are logged and swallowed — auditing never
 * breaks the factory. Returns the inserted row, or `null` on failure.
 */
export async function recordAuditEvent(input: RecordAuditEventInput): Promise<AuditEventRow | null> {
  try {
    await ensureAuditDbReady();
    const [inserted] = await getAppDb()
      .insert(auditEvents)
      .values({
        orgId: input.orgId,
        actorId: input.actorId,
        actorType: input.actorType ?? 'human',
        action: input.action,
        targets: input.targets,
        metadata: boundMetadata(input.metadata),
        githubProjectId: input.githubProjectId ?? null,
        context: input.context ?? {},
        occurredAt: input.occurredAt ?? new Date(),
      })
      .returning();
    return inserted ?? null;
  } catch (err) {
    console.warn('[Audit] Failed to record audit event', {
      action: input.action,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export interface ListAuditEventsInput {
  orgId: string;
  githubProjectId?: string;
  /** Restrict to these actions (exact match). */
  actions?: string[];
  actorId?: string;
  /** Opaque cursor from a previous page (`nextCursor`). */
  before?: string;
  limit?: number;
}

export interface AuditEventPage {
  events: AuditEventRow[];
  /** Pass back as `before` to fetch the next (older) page; absent at the end. */
  nextCursor?: string;
}

/** Encode the `(occurredAt, id)` keyset cursor of a row. */
function encodeCursor(row: AuditEventRow): string {
  return `${row.occurredAt.toISOString()}_${row.id}`;
}

/** Decode a cursor back into its `(occurredAt, id)` parts, or `undefined`. */
function decodeCursor(cursor: string): { occurredAt: Date; id: string } | undefined {
  const sep = cursor.lastIndexOf('_');
  if (sep <= 0) return undefined;
  const occurredAt = new Date(cursor.slice(0, sep));
  const id = cursor.slice(sep + 1);
  if (Number.isNaN(occurredAt.getTime()) || !id) return undefined;
  return { occurredAt, id };
}

/** List an org's audit events newest-first with keyset pagination. */
export async function listAuditEvents(input: ListAuditEventsInput): Promise<AuditEventPage> {
  await ensureAuditDbReady();
  const limit = Math.min(Math.max(input.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);

  const conditions: (SQL | undefined)[] = [eq(auditEvents.orgId, input.orgId)];
  if (input.githubProjectId) conditions.push(eq(auditEvents.githubProjectId, input.githubProjectId));
  if (input.actions && input.actions.length > 0) conditions.push(inArray(auditEvents.action, input.actions));
  if (input.actorId) conditions.push(eq(auditEvents.actorId, input.actorId));

  if (input.before) {
    const cursor = decodeCursor(input.before);
    if (cursor) {
      conditions.push(
        or(
          lt(auditEvents.occurredAt, cursor.occurredAt),
          and(eq(auditEvents.occurredAt, cursor.occurredAt), lt(auditEvents.id, cursor.id)),
        ),
      );
    }
  }

  const rows = await getAppDb()
    .select()
    .from(auditEvents)
    .where(and(...conditions))
    .orderBy(desc(auditEvents.occurredAt), desc(auditEvents.id))
    .limit(limit + 1);

  const events = rows.slice(0, limit);
  const hasMore = rows.length > limit;
  const last = events[events.length - 1];
  return {
    events,
    ...(hasMore && last ? { nextCursor: encodeCursor(last) } : {}),
  };
}
