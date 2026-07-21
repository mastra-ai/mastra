/**
 * The one public entry point for emitting Factory audit events from routes.
 *
 * `emitAudit(c, input)` resolves the actor from the request context, captures
 * request context (client IP / user-agent), appends the local `audit_events`
 * row (awaited, swallow-on-failure) and kicks off the fire-and-forget WorkOS
 * mirror. Call it AFTER the mutation succeeds; it never throws, so auditing
 * can never break the factory.
 */

import type { Context } from 'hono';

import { webAuthTenant } from '../auth';
import type { AuditContext, AuditTarget } from '../storage/domains/audit/base';
import { recordAuditEvent } from './store';
import { forwardToWorkOS } from './workos-sink';

export interface EmitAuditInput {
  /** Dot-namespaced action, e.g. 'factory.work_item.stage_moved'. */
  action: string;
  /** Project the event is scoped to; omit for org-level events. */
  projectId?: string;
  targets: AuditTarget[];
  /** Bounded event summary — never full payloads, never secrets. */
  metadata?: Record<string, unknown>;
}

/** Extract the audit request context from the incoming request headers. */
export function auditRequestContext(c: Context): AuditContext {
  const forwarded = c.req.header('x-forwarded-for');
  const location = forwarded?.split(',')[0]?.trim();
  const userAgent = c.req.header('user-agent');
  return {
    ...(location ? { location } : {}),
    ...(userAgent ? { userAgent } : {}),
  };
}

/**
 * Record an audit event for a successful mutation. Never throws. The local
 * insert is awaited (so tests can observe it); the WorkOS forward is
 * fire-and-forget.
 */
export async function emitAudit(c: Context, input: EmitAuditInput): Promise<void> {
  try {
    // Routes call emitAudit after resolveTenant/resolveOrgTenant succeeded, so
    // the tenant is already on the context; bail quietly if it somehow isn't.
    const tenant = webAuthTenant(c);
    if (!tenant?.orgId) return;

    const row = await recordAuditEvent({
      orgId: tenant.orgId,
      actorId: tenant.userId,
      action: input.action,
      targets: input.targets,
      metadata: input.metadata,
      githubProjectId: input.projectId,
      context: auditRequestContext(c),
    });
    if (row) void forwardToWorkOS(row);
  } catch (err) {
    console.warn('[Audit] Failed to emit audit event', {
      action: input.action,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
