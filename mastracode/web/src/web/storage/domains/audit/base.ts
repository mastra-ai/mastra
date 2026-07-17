/**
 * Factory audit events domain — the append-only "who did what, when" trail
 * behind the software factory.
 *
 * One `audit_events` row records a single audited mutation (work-item change,
 * stage move, run start, worktree create/delete, git action, intake config
 * change). Rows are append-only: there is no update/delete API, and the table
 * is the local source of truth even when the WorkOS Audit Logs mirror is
 * unavailable.
 *
 * Tenancy is **org-first**, like `work_items`: events are scoped by `org_id`
 * and (usually) `github_project_id`; `actor_id` records who acted but never
 * scopes reads.
 *
 * v1 action taxonomy (register these in the WorkOS dashboard under
 * Audit Logs → Events for the export mirror to accept them):
 *   - factory.work_item.created
 *   - factory.work_item.updated
 *   - factory.work_item.stage_moved
 *   - factory.work_item.deleted
 *   - factory.run.started
 *   - factory.worktree.created
 *   - factory.worktree.deleted
 *   - factory.triage.started
 *   - factory.git.commit
 *   - factory.git.push
 *   - factory.git.pr_opened
 *   - factory.intake.config_updated
 *
 * v1.1 adds agent-level actions (also register these in WorkOS):
 *   - factory.agent.commit
 *   - factory.agent.push
 *   - factory.agent.pr_opened
 *
 * Agent events carry `actor_type = 'agent'` with `actor_id = 'agent:<threadId>'`
 * and `metadata.startedBy = <userId>` chaining accountability back to the human
 * whose message drove the run.
 */

import type { FactoryStorageContext, FactoryStorageDomain } from '../../domain';

/** What an audit event acted on (WorkOS Audit Logs target shape). */
export interface AuditTarget {
  /** Target kind, e.g. 'work_item', 'worktree', 'issue', 'pull_request'. */
  type: string;
  /** Stable identifier of the target (row id, branch name, issue number...). */
  id: string;
  /** Human-readable label (work-item title, branch name...). */
  name?: string;
}

/** Who performed the audited action. */
export type AuditActorType = 'human' | 'agent';

/** Request context captured alongside the event. */
export interface AuditContext {
  /** Client IP (first hop of `x-forwarded-for`) when available. */
  location?: string;
  /** Request `user-agent` header when available. */
  userAgent?: string;
}

/** One persisted audit event. */
export interface AuditEventRow {
  id: string;
  /** Owning WorkOS organization id — the trail is org-wide. */
  orgId: string;
  /** WorkOS user id of whoever performed the action, or `agent:<threadId>`. */
  actorId: string;
  /** Whether a human or an agent (inside a run) performed the action. */
  actorType: AuditActorType;
  /** Dot-namespaced action, e.g. 'factory.work_item.stage_moved'. */
  action: string;
  /** What was acted on. */
  targets: AuditTarget[];
  /** Bounded event summary — never full payloads, never secrets. */
  metadata: Record<string, unknown>;
  /** Project the event is scoped to; null for org-level events. */
  githubProjectId: string | null;
  /** Request context (`x-forwarded-for` / `user-agent`). */
  context: AuditContext;
  occurredAt: Date;
}

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

/** A fully-normalized event ready to persist (id assigned by the backend). */
export type AuditEventInsert = Omit<AuditEventRow, 'id'>;

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

/** Metadata is a bounded summary — never full payloads, never secrets. */
const MAX_METADATA_JSON_LENGTH = 4096;

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

/** Truncate oversized metadata rather than dropping the whole event. */
export function boundAuditMetadata(metadata: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!metadata) return {};
  try {
    if (JSON.stringify(metadata).length <= MAX_METADATA_JSON_LENGTH) return metadata;
  } catch {
    return { truncated: true };
  }
  return { truncated: true };
}

/** Clamp a requested page size into `[1, MAX_PAGE_SIZE]`. */
export function clampAuditLimit(limit: number | undefined): number {
  return Math.min(Math.max(limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
}

/** Encode the `(occurredAt, id)` keyset cursor of a row. */
export function encodeAuditCursor(row: AuditEventRow): string {
  return `${row.occurredAt.toISOString()}_${row.id}`;
}

/** Decode a cursor back into its `(occurredAt, id)` parts, or `undefined`. */
export function decodeAuditCursor(cursor: string): { occurredAt: Date; id: string } | undefined {
  const sep = cursor.lastIndexOf('_');
  if (sep <= 0) return undefined;
  const occurredAt = new Date(cursor.slice(0, sep));
  const id = cursor.slice(sep + 1);
  if (Number.isNaN(occurredAt.getTime()) || !id) return undefined;
  return { occurredAt, id };
}

/**
 * Abstract audit event storage. `record()` normalizes inputs (defaults,
 * metadata bounding) identically across backends; each backend implements the
 * raw `insert` and the keyset-paginated `list`.
 */
export abstract class AuditStorage implements FactoryStorageDomain {
  readonly name = 'audit';

  abstract init(ctx: FactoryStorageContext): Promise<void>;

  /** Append one audit event. Throws on failure — swallow-on-failure lives in the caller. */
  record(input: RecordAuditEventInput): Promise<AuditEventRow> {
    return this.insert({
      orgId: input.orgId,
      actorId: input.actorId,
      actorType: input.actorType ?? 'human',
      action: input.action,
      targets: input.targets,
      metadata: boundAuditMetadata(input.metadata),
      githubProjectId: input.githubProjectId ?? null,
      context: input.context ?? {},
      occurredAt: input.occurredAt ?? new Date(),
    });
  }

  protected abstract insert(row: AuditEventInsert): Promise<AuditEventRow>;

  /** List an org's audit events newest-first with keyset pagination. */
  abstract list(input: ListAuditEventsInput): Promise<AuditEventPage>;
}
