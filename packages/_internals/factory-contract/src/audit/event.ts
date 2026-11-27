import type { AuditActorType } from './actors.js';

/** What an audit event acted on (WorkOS Audit Logs target shape). */
export interface AuditTarget {
  /** Target kind, e.g. 'work_item', 'worktree', 'issue', 'pull_request'. */
  type: string;
  /** Stable identifier of the target (row id, branch name, issue number...). */
  id: string;
  /** Human-readable label (work-item title, branch name...). */
  name?: string;
}

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
  /** Factory project the event is scoped to; null for org-level events. */
  factoryProjectId: string | null;
  /** Project-repository link affected by a repository-specific action. */
  projectRepositoryId: string | null;
  /** Request context (`x-forwarded-for` / `user-agent`). */
  context: AuditContext;
  occurredAt: Date;
}
