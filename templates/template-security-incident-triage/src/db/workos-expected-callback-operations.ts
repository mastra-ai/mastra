import { DomainError } from '../domain/errors.js';
import type { Alert } from '../schemas/alert.js';
import type { OperationalStore, StoreTransaction } from './operational-store.js';
import type { ProviderEffectBinding } from './provider-effect-operations.js';

const callbackWindowMs = 15 * 60 * 1_000;
const providerClockSkewMs = 30 * 1_000;

export type ExpectedWorkosMembershipCallback = Readonly<{
  idempotencyKey: string;
  tenantId: string;
  incidentId: string;
  subjectId: string;
  membershipId: string;
  expectedPreviousRole: string;
  expectedRole: string;
  planId: string;
  actionId: string;
}>;

/**
 * Arms the exact callback expected from an approved WorkOS role rollback.
 * This runs after the provider-effect fence is claimed and before the remote
 * mutation, closing the callback-before-readback race.
 */
export async function armExpectedWorkosMembershipCallback(
  store: OperationalStore,
  input: Readonly<{
    effect: ProviderEffectBinding;
    membershipId: string;
    expectedPreviousRole: string;
    expectedRole: string;
  }>,
): Promise<void> {
  if (
    input.effect.operation !== 'restore_previous_role' ||
    !isRole(input.expectedPreviousRole) ||
    !isRole(input.expectedRole) ||
    input.expectedPreviousRole === input.expectedRole ||
    !input.membershipId.trim()
  )
    throw new DomainError('VALIDATION_FAILED');

  const expiresAt = new Date(Date.parse(input.effect.now) + callbackWindowMs).toISOString();
  await store.transaction(async tx => {
    await tx.execute({
      sql: `UPDATE workos_expected_membership_callbacks SET status = 'expired'
        WHERE tenant_id = ? AND subject_id = ? AND membership_id = ?
          AND status = 'armed' AND expires_at < ?`,
      args: [input.effect.tenantId, input.effect.subjectId, input.membershipId, input.effect.now],
    });
    const ledger = await tx.execute({
      sql: `SELECT status FROM provider_effect_ledger
        WHERE provider = 'workos' AND idempotency_key = ?
          AND tenant_id = ? AND incident_id = ? AND operation = 'restore_previous_role'
          AND plan_id = ? AND action_id = ? AND target_id = ?`,
      args: [
        input.effect.idempotencyKey,
        input.effect.tenantId,
        input.effect.incidentId,
        input.effect.planId,
        input.effect.actionId,
        input.effect.targetId,
      ],
    });
    if (ledger.rows[0]?.status !== 'claimed') throw new DomainError('CONFLICT');

    const active = await tx.execute({
      sql: `SELECT idempotency_key FROM workos_expected_membership_callbacks
        WHERE tenant_id = ? AND subject_id = ? AND membership_id = ?
          AND status = 'armed'`,
      args: [input.effect.tenantId, input.effect.subjectId, input.membershipId],
    });
    if (active.rows[0] && active.rows[0].idempotency_key !== input.effect.idempotencyKey)
      throw new DomainError('CONFLICT');

    await tx.execute({
      sql: `INSERT OR IGNORE INTO workos_expected_membership_callbacks(
        provider, idempotency_key, tenant_id, incident_id, subject_id, membership_id,
        expected_previous_role, expected_role, plan_id, action_id, status, armed_at, expires_at
      ) VALUES ('workos', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'armed', ?, ?)`,
      args: [
        input.effect.idempotencyKey,
        input.effect.tenantId,
        input.effect.incidentId,
        input.effect.subjectId,
        input.membershipId,
        input.expectedPreviousRole,
        input.expectedRole,
        input.effect.planId,
        input.effect.actionId,
        input.effect.now,
        expiresAt,
      ],
    });
    const persisted = await tx.execute({
      sql: `SELECT tenant_id, incident_id, subject_id, membership_id,
          expected_previous_role, expected_role, plan_id, action_id, status
        FROM workos_expected_membership_callbacks
        WHERE provider = 'workos' AND idempotency_key = ?`,
      args: [input.effect.idempotencyKey],
    });
    const row = persisted.rows[0];
    if (
      !row ||
      row.tenant_id !== input.effect.tenantId ||
      row.incident_id !== input.effect.incidentId ||
      row.subject_id !== input.effect.subjectId ||
      row.membership_id !== input.membershipId ||
      row.expected_previous_role !== input.expectedPreviousRole ||
      row.expected_role !== input.expectedRole ||
      row.plan_id !== input.effect.planId ||
      row.action_id !== input.effect.actionId ||
      row.status !== 'armed'
    )
      throw new DomainError('CONFLICT');
  });
}

/** Resolves an already-consumed WorkOS delivery before stream ordering checks. */
export async function findConsumedWorkosMembershipCallback(
  tx: StoreTransaction,
  input: Readonly<{ alert: Alert; membershipId: string; stateHash: string }>,
): Promise<ExpectedWorkosMembershipCallback | undefined> {
  const result = await tx.execute({
    sql: `SELECT * FROM workos_expected_membership_callbacks
      WHERE provider = 'workos' AND source_event_id = ?`,
    args: [input.alert.sourceEventId],
  });
  const row = result.rows[0];
  if (!row) return undefined;
  if (
    row.status !== 'consumed' ||
    row.tenant_id !== input.alert.tenantId ||
    row.subject_id !== input.alert.subjectId ||
    row.membership_id !== input.membershipId ||
    row.observed_state_hash !== input.stateHash ||
    row.observed_at !== input.alert.occurredAt
  )
    throw new DomainError('CONFLICT');
  return callbackFromRow(row);
}

/** Finds, but does not yet consume, the one exact in-flight rollback callback. */
export async function findExpectedWorkosMembershipCallback(
  tx: StoreTransaction,
  input: Readonly<{
    alert: Alert;
    membershipId: string;
    observedPreviousRole?: string;
    observedRole: string;
    observedStatus: string;
  }>,
): Promise<ExpectedWorkosMembershipCallback | undefined> {
  if (!input.observedPreviousRole || input.observedStatus !== 'active') return undefined;
  await tx.execute({
    sql: `UPDATE workos_expected_membership_callbacks SET status = 'expired'
      WHERE provider = 'workos' AND tenant_id = ? AND subject_id = ?
        AND membership_id = ? AND status = 'armed' AND expires_at < ?`,
    args: [input.alert.tenantId, input.alert.subjectId, input.membershipId, input.alert.occurredAt],
  });
  const result = await tx.execute({
    sql: `SELECT expected.*, ledger.status AS effect_status
      FROM workos_expected_membership_callbacks expected
      JOIN provider_effect_ledger ledger
        ON ledger.provider = expected.provider
          AND ledger.idempotency_key = expected.idempotency_key
      WHERE expected.provider = 'workos' AND expected.tenant_id = ?
        AND expected.subject_id = ? AND expected.membership_id = ?
        AND expected.expected_previous_role = ? AND expected.expected_role = ?
        AND expected.status = 'armed'
        AND ledger.operation = 'restore_previous_role'
        AND ledger.status IN ('claimed','succeeded','uncertain')`,
    args: [
      input.alert.tenantId,
      input.alert.subjectId,
      input.membershipId,
      input.observedPreviousRole,
      input.observedRole,
    ],
  });
  const row = result.rows[0];
  if (!row) return undefined;
  const occurredAt = Date.parse(input.alert.occurredAt);
  const armedAt = Date.parse(String(row.armed_at));
  const expiresAt = Date.parse(String(row.expires_at));
  if (occurredAt < armedAt - providerClockSkewMs || occurredAt > expiresAt) return undefined;
  return callbackFromRow(row);
}

export async function consumeExpectedWorkosMembershipCallback(
  tx: StoreTransaction,
  input: Readonly<{
    callback: ExpectedWorkosMembershipCallback;
    sourceEventId: string;
    stateHash: string;
    observedAt: string;
  }>,
): Promise<void> {
  const consumed = await tx.execute({
    sql: `UPDATE workos_expected_membership_callbacks
      SET status = 'consumed', source_event_id = ?, observed_state_hash = ?,
        observed_at = ?, consumed_at = ?
      WHERE provider = 'workos' AND idempotency_key = ? AND status = 'armed'`,
    args: [
      input.sourceEventId,
      input.stateHash,
      input.observedAt,
      new Date().toISOString(),
      input.callback.idempotencyKey,
    ],
  });
  if (consumed.rowsAffected !== 1) throw new DomainError('CONFLICT');
}

function callbackFromRow(row: Record<string, unknown>): ExpectedWorkosMembershipCallback {
  return {
    idempotencyKey: String(row.idempotency_key),
    tenantId: String(row.tenant_id),
    incidentId: String(row.incident_id),
    subjectId: String(row.subject_id),
    membershipId: String(row.membership_id),
    expectedPreviousRole: String(row.expected_previous_role),
    expectedRole: String(row.expected_role),
    planId: String(row.plan_id),
    actionId: String(row.action_id),
  };
}

function isRole(value: unknown): value is 'admin' | 'member' | 'viewer' {
  return value === 'admin' || value === 'member' || value === 'viewer';
}
