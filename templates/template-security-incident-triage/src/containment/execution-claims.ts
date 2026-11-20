import type { OperationalStore } from '../db/operational-store.js';
import type { Clock } from '../domain/clock.js';
import { systemClock } from '../domain/clock.js';
import { DomainError } from '../domain/errors.js';
import type { IdGenerator } from '../domain/id-generator.js';
import { uuidGenerator } from '../domain/id-generator.js';

export type ActionClaim =
  | Readonly<{ state: 'replayed'; providerRef?: string }>
  | Readonly<{
      state: 'denied';
      reason: 'PREDECESSOR_INCOMPLETE' | 'RATE_LIMITED' | 'ACTION_IN_PROGRESS';
    }>
  | Readonly<{ state: 'claimed'; fenceToken: string; attempt: number }>;

export type GatewayAuditOutcome = 'invalid' | 'blocked' | 'expired' | 'rate_limited' | 'replayed';

export type GatewayAuditReason =
  | 'BINDING_INVALID'
  | 'MODE_BLOCKED'
  | 'APPROVAL_EXPIRED'
  | 'PREDECESSOR_INCOMPLETE'
  | 'RATE_LIMITED'
  | 'ALREADY_VERIFIED'
  | 'ACTION_IN_PROGRESS';

// Three normal provider attempts are followed by at most three fenced,
// read-only WorkOS readbacks.  The latter never call a remote mutation (the
// provider ledger returns `uncertain` to the identity adapter), which keeps
// eventual consistency recoverable without an unbounded retry loop.
const MAX_WORKOS_RECONCILIATION_ATTEMPTS = 3;

export async function auditGatewayAttempt(
  store: OperationalStore,
  input: Readonly<{
    tenantId: string;
    incidentId: string;
    planId: string;
    approvalId: string;
    actionId: string;
    outcome: GatewayAuditOutcome;
    reasonCode: GatewayAuditReason;
  }>,
  dependencies: Readonly<{ clock?: Clock; ids?: IdGenerator }> = {},
): Promise<void> {
  const ids = dependencies.ids ?? uuidGenerator;
  const clock = dependencies.clock ?? systemClock;
  await store.execute({
    sql: `INSERT INTO containment_gateway_audit(
      id, claimed_tenant_id, claimed_incident_id, claimed_plan_id,
      claimed_approval_id, claimed_action_id, outcome, reason_code, occurred_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      ids.next(),
      input.tenantId,
      input.incidentId,
      input.planId,
      input.approvalId,
      input.actionId,
      input.outcome,
      input.reasonCode,
      clock.now(),
    ],
  });
}

export async function claimContainmentAction(
  store: OperationalStore,
  input: Readonly<{
    tenantId: string;
    incidentId: string;
    planId: string;
    approvalId: string;
    actionId: string;
    idempotencyKey: string;
    ownerId: string;
    leaseMs: number;
    rateLimit: number;
  }>,
  dependencies: Readonly<{ clock?: Clock; ids?: IdGenerator }> = {},
): Promise<ActionClaim> {
  const clock = dependencies.clock ?? systemClock;
  const ids = dependencies.ids ?? uuidGenerator;
  const now = clock.now();
  const leaseExpiresAt = new Date(Date.parse(now) + input.leaseMs).toISOString();
  return store.transaction(async tx => {
    const completed = await tx.execute({
      sql: `SELECT provider_ref FROM containment_action_attempts
        WHERE tenant_id = ? AND plan_id = ? AND action_id = ?
          AND status = 'completed' AND verification = 'verified'
        ORDER BY attempt DESC LIMIT 1`,
      args: [input.tenantId, input.planId, input.actionId],
    });
    if (completed.rows[0]) {
      await tx.execute({
        sql: `INSERT INTO containment_gateway_audit(
          id, claimed_tenant_id, claimed_incident_id, claimed_plan_id,
          claimed_approval_id, claimed_action_id, outcome, reason_code, occurred_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'replayed', 'ALREADY_VERIFIED', ?)`,
        args: [ids.next(), input.tenantId, input.incidentId, input.planId, input.approvalId, input.actionId, now],
      });
      return {
        state: 'replayed' as const,
        ...(completed.rows[0].provider_ref ? { providerRef: String(completed.rows[0].provider_ref) } : {}),
      };
    }
    const latest = await tx.execute({
      sql: `SELECT * FROM containment_action_attempts
        WHERE tenant_id = ? AND plan_id = ? AND action_id = ?
        ORDER BY attempt DESC LIMIT 1`,
      args: [input.tenantId, input.planId, input.actionId],
    });
    const row = latest.rows[0];
    const uncertainWorkOs = await tx.execute({
      sql: `SELECT idempotency_key FROM provider_effect_ledger
        WHERE provider = 'workos' AND idempotency_key = ? AND tenant_id = ?
          AND incident_id = ? AND plan_id = ? AND action_id = ?
          AND status = 'uncertain'`,
      args: [input.idempotencyKey, input.tenantId, input.incidentId, input.planId, input.actionId],
    });
    if (
      Number(row?.attempt ?? 0) >= 3 + MAX_WORKOS_RECONCILIATION_ATTEMPTS &&
      uncertainWorkOs.rows[0] &&
      !(row?.status === 'executing' && String(row.lease_expires_at) > now)
    ) {
      // This is a terminal, auditable bound.  It does not use a new fence and
      // cannot dispatch a second WorkOS mutation; operators can investigate a
      // failed ledger entry rather than an indefinitely pending effect.
      if (row?.status === 'executing') {
        const expiredAttempt = await tx.execute({
          sql: `UPDATE containment_action_attempts
            SET status = 'failed', finished_at = ?, error_code = 'PROVIDER_FAILED',
              verification = 'not_run'
            WHERE id = ? AND status = 'executing' AND fence_token = ?
              AND lease_expires_at <= ?`,
          args: [now, String(row.id), String(row.fence_token), now],
        });
        if (expiredAttempt.rowsAffected !== 1) throw new DomainError('CONFLICT');
      }
      const action = await tx.execute({
        sql: `UPDATE containment_actions SET status = 'failed'
          WHERE tenant_id = ? AND incident_id = ? AND plan_id = ? AND action_id = ?
            AND status ${row?.status === 'executing' ? "= 'executing'" : "IN ('timed_out','failed')"}`,
        args: [input.tenantId, input.incidentId, input.planId, input.actionId],
      });
      if (action.rowsAffected !== 1) throw new DomainError('CONFLICT');
      const ledger = await tx.execute({
        sql: `UPDATE provider_effect_ledger SET status = 'failed', completed_at = ?
          WHERE provider = 'workos' AND idempotency_key = ? AND status = 'uncertain'`,
        args: [now, input.idempotencyKey],
      });
      if (ledger.rowsAffected !== 1) throw new DomainError('CONFLICT');
      await tx.execute({
        sql: `INSERT INTO containment_gateway_audit(
          id, claimed_tenant_id, claimed_incident_id, claimed_plan_id,
          claimed_approval_id, claimed_action_id, outcome, reason_code, occurred_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'rate_limited', 'RATE_LIMITED', ?)`,
        args: [ids.next(), input.tenantId, input.incidentId, input.planId, input.approvalId, input.actionId, now],
      });
      return { state: 'denied' as const, reason: 'RATE_LIMITED' as const };
    }
    // Attempt budgets cap mutations. A persisted ambiguous WorkOS effect gets
    // one or more fenced *read-only* reconciliation entries so eventual
    // consistency can converge after the normal budget is exhausted.
    if (Number(row?.attempt ?? 0) >= 3 && !uncertainWorkOs.rows[0]) {
      await tx.execute({
        sql: `INSERT INTO containment_gateway_audit(
          id, claimed_tenant_id, claimed_incident_id, claimed_plan_id,
          claimed_approval_id, claimed_action_id, outcome, reason_code, occurred_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'rate_limited', 'RATE_LIMITED', ?)`,
        args: [ids.next(), input.tenantId, input.incidentId, input.planId, input.approvalId, input.actionId, now],
      });
      return { state: 'denied' as const, reason: 'RATE_LIMITED' as const };
    }
    if (row?.status === 'executing') {
      if (String(row.lease_expires_at) > now) {
        await tx.execute({
          sql: `INSERT INTO containment_gateway_audit(
            id, claimed_tenant_id, claimed_incident_id, claimed_plan_id,
            claimed_approval_id, claimed_action_id, outcome, reason_code, occurred_at
          ) VALUES (?, ?, ?, ?, ?, ?, 'replayed', 'ACTION_IN_PROGRESS', ?)`,
          args: [ids.next(), input.tenantId, input.incidentId, input.planId, input.approvalId, input.actionId, now],
        });
        return {
          state: 'denied' as const,
          reason: 'ACTION_IN_PROGRESS' as const,
        };
      }
      const durableEffect = await tx.execute({
        sql: `SELECT provider_ref FROM local_containment_effects
          WHERE tenant_id = ? AND incident_id = ? AND plan_id = ? AND action_id = ?
            AND attempt = ? AND fence_token = ?`,
        args: [
          input.tenantId,
          input.incidentId,
          input.planId,
          input.actionId,
          Number(row.attempt),
          String(row.fence_token),
        ],
      });
      if (durableEffect.rows[0]?.provider_ref) {
        const providerRef = String(durableEffect.rows[0].provider_ref);
        const reconciledAttempt = await tx.execute({
          sql: `UPDATE containment_action_attempts
            SET status = 'completed', finished_at = ?, provider_ref = ?,
              verification = 'verified'
            WHERE id = ? AND status = 'executing' AND fence_token = ?`,
          args: [now, providerRef, String(row.id), String(row.fence_token)],
        });
        if (reconciledAttempt.rowsAffected !== 1) {
          throw new DomainError('CONFLICT');
        }
        const reconciledAction = await tx.execute({
          sql: `UPDATE containment_actions SET status = 'completed', result_ref = ?
            WHERE tenant_id = ? AND incident_id = ? AND plan_id = ? AND action_id = ?
              AND status = 'executing'`,
          args: [providerRef, input.tenantId, input.incidentId, input.planId, input.actionId],
        });
        if (reconciledAction.rowsAffected !== 1) {
          throw new DomainError('CONFLICT');
        }
        await tx.execute({
          sql: `INSERT INTO containment_gateway_audit(
            id, claimed_tenant_id, claimed_incident_id, claimed_plan_id,
            claimed_approval_id, claimed_action_id, outcome, reason_code, occurred_at
          ) VALUES (?, ?, ?, ?, ?, ?, 'replayed', 'ALREADY_VERIFIED', ?)`,
          args: [ids.next(), input.tenantId, input.incidentId, input.planId, input.approvalId, input.actionId, now],
        });
        return { state: 'replayed' as const, providerRef };
      }
      const fenced = await tx.execute({
        sql: `UPDATE containment_action_attempts
          SET status = 'failed', finished_at = ?, error_code = 'PROVIDER_FAILED',
            verification = 'not_run'
          WHERE id = ? AND status = 'executing' AND fence_token = ?`,
        args: [now, String(row.id), String(row.fence_token)],
      });
      if (fenced.rowsAffected !== 1) throw new DomainError('CONFLICT');
      const actionFenced = await tx.execute({
        sql: `UPDATE containment_actions SET status = 'failed'
          WHERE tenant_id = ? AND incident_id = ? AND plan_id = ? AND action_id = ?
            AND status = 'executing'`,
        args: [input.tenantId, input.incidentId, input.planId, input.actionId],
      });
      if (actionFenced.rowsAffected !== 1) throw new DomainError('CONFLICT');
    }
    const order = await tx.execute({
      sql: `SELECT current.ordinal, current.action_type,
        (SELECT count(*) FROM containment_actions predecessor
          WHERE predecessor.tenant_id = current.tenant_id
            AND predecessor.incident_id = current.incident_id
            AND predecessor.plan_id = current.plan_id
            AND predecessor.ordinal < current.ordinal
            AND predecessor.status != 'completed') AS incomplete
        FROM containment_actions current
        WHERE current.tenant_id = ? AND current.incident_id = ?
          AND current.plan_id = ? AND current.action_id = ?`,
      args: [input.tenantId, input.incidentId, input.planId, input.actionId],
    });
    const authorizedAction = order.rows[0];
    if (!authorizedAction || Number(authorizedAction.incomplete) > 0) {
      await tx.execute({
        sql: `INSERT INTO containment_gateway_audit(
          id, claimed_tenant_id, claimed_incident_id, claimed_plan_id,
          claimed_approval_id, claimed_action_id, outcome, reason_code, occurred_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'blocked', 'PREDECESSOR_INCOMPLETE', ?)`,
        args: [ids.next(), input.tenantId, input.incidentId, input.planId, input.approvalId, input.actionId, now],
      });
      return {
        state: 'denied' as const,
        reason: 'PREDECESSOR_INCOMPLETE' as const,
      };
    }
    const recent = await tx.execute({
      sql: `SELECT count(*) AS count FROM containment_action_attempts attempt
        JOIN containment_actions action
          ON action.tenant_id = attempt.tenant_id
          AND action.incident_id = attempt.incident_id
          AND action.plan_id = attempt.plan_id
          AND action.action_id = attempt.action_id
        WHERE attempt.tenant_id = ? AND action.action_type = ?
          AND attempt.started_at >= ?`,
      args: [input.tenantId, String(authorizedAction.action_type), new Date(Date.parse(now) - 60_000).toISOString()],
    });
    if (Number(recent.rows[0]?.count) >= input.rateLimit) {
      await tx.execute({
        sql: `INSERT INTO containment_gateway_audit(
          id, claimed_tenant_id, claimed_incident_id, claimed_plan_id,
          claimed_approval_id, claimed_action_id, outcome, reason_code, occurred_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'rate_limited', 'RATE_LIMITED', ?)`,
        args: [ids.next(), input.tenantId, input.incidentId, input.planId, input.approvalId, input.actionId, now],
      });
      return { state: 'denied' as const, reason: 'RATE_LIMITED' as const };
    }
    const attempt = Number(row?.attempt ?? 0) + 1;
    const fenceToken = ids.next();
    await tx.execute({
      sql: `INSERT INTO containment_action_attempts(
        id, tenant_id, incident_id, plan_id, approval_id, action_id,
        idempotency_key, attempt, owner_id, fence_token, status, started_at,
        lease_expires_at, verification
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'executing', ?, ?, 'not_run')`,
      args: [
        ids.next(),
        input.tenantId,
        input.incidentId,
        input.planId,
        input.approvalId,
        input.actionId,
        input.idempotencyKey,
        attempt,
        input.ownerId,
        fenceToken,
        now,
        leaseExpiresAt,
      ],
    });
    const action = await tx.execute({
      sql: `UPDATE containment_actions SET status = 'executing'
        WHERE tenant_id = ? AND incident_id = ? AND plan_id = ? AND action_id = ?
          AND status IN ('pending','failed','blocked','timed_out')`,
      args: [input.tenantId, input.incidentId, input.planId, input.actionId],
    });
    if (action.rowsAffected !== 1) throw new DomainError('CONFLICT');
    return { state: 'claimed', fenceToken, attempt };
  });
}

export async function finishContainmentAction(
  store: OperationalStore,
  input: Readonly<{
    tenantId: string;
    planId: string;
    actionId: string;
    fenceToken: string;
    status: 'completed' | 'blocked' | 'failed' | 'timed_out';
    verification: 'verified' | 'not_verified' | 'not_run';
    providerRef?: string;
    errorCode?: string;
  }>,
  dependencies: Readonly<{ clock?: Clock }> = {},
): Promise<void> {
  const now = (dependencies.clock ?? systemClock).now();
  await store.transaction(async tx => {
    const finished = await tx.execute({
      sql: `UPDATE containment_action_attempts SET status = ?, finished_at = ?,
        error_code = ?, provider_ref = ?, verification = ?
        WHERE tenant_id = ? AND plan_id = ? AND action_id = ?
          AND fence_token = ? AND status = 'executing'`,
      args: [
        input.status,
        now,
        input.errorCode ?? null,
        input.providerRef ?? null,
        input.verification,
        input.tenantId,
        input.planId,
        input.actionId,
        input.fenceToken,
      ],
    });
    if (finished.rowsAffected !== 1) throw new DomainError('CONFLICT');
    const action = await tx.execute({
      sql: `UPDATE containment_actions SET status = ?, result_ref = ?
        WHERE tenant_id = ? AND plan_id = ? AND action_id = ? AND status = 'executing'`,
      args: [input.status, input.providerRef ?? null, input.tenantId, input.planId, input.actionId],
    });
    if (action.rowsAffected !== 1) throw new DomainError('CONFLICT');
  });
}
