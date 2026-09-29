import { createHash, randomUUID } from 'node:crypto';

import { DomainError } from '../domain/errors.js';
import type { OperationalStore, StoreTransaction } from './operational-store.js';

const intentLifetimeMs = 5 * 60 * 1_000;
const roles = new Set(['admin', 'member', 'viewer']);

export type StagingPrivilegeIntent = Readonly<{
  id: string;
  actorId: string;
  previousRole: 'admin' | 'member' | 'viewer';
  currentRole: 'admin' | 'member' | 'viewer';
  expiresAt: string;
}>;

export async function stageUnauthorizedPrivilegeChange(
  store: OperationalStore,
  input: Readonly<{
    tenantId: string;
    subjectId: string;
    membershipId: string;
    actorId: string;
    previousRole: string;
    currentRole: string;
  }>,
  dependencies: Readonly<{
    now?: () => Date;
    createId?: () => string;
  }> = {},
): Promise<StagingPrivilegeIntent> {
  assertIntentInput(input);
  const now = (dependencies.now ?? (() => new Date()))();
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + intentLifetimeMs).toISOString();
  const id = (dependencies.createId ?? (() => `intent-${randomUUID()}`))();
  const previousStateHash = createHash('sha256')
    .update(
      JSON.stringify({
        tenantId: input.tenantId,
        subjectId: input.subjectId,
        membershipId: input.membershipId,
        role: input.previousRole,
      }),
      'utf8',
    )
    .digest('hex');

  await store.transaction(async tx => {
    await tx.execute({
      sql: `UPDATE staging_privilege_change_intents SET status = 'expired'
        WHERE status = 'pending' AND expires_at <= ?`,
      args: [createdAt],
    });
    await tx.execute({
      sql: `INSERT INTO staging_privilege_change_intents(
        id, tenant_id, subject_id, membership_id, actor_id, previous_role,
        current_role, previous_state_hash, approved, status, created_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'pending', ?, ?)`,
      args: [
        id,
        input.tenantId,
        input.subjectId,
        input.membershipId,
        input.actorId,
        input.previousRole,
        input.currentRole,
        previousStateHash,
        createdAt,
        expiresAt,
      ],
    });
  });
  return {
    id,
    actorId: input.actorId,
    previousRole: input.previousRole as StagingPrivilegeIntent['previousRole'],
    currentRole: input.currentRole as StagingPrivilegeIntent['currentRole'],
    expiresAt,
  };
}

export async function consumeStagingPrivilegeChange(
  tx: StoreTransaction,
  input: Readonly<{
    tenantId: string;
    subjectId: string;
    membershipId: string;
    currentRole: string;
    sourceEventId: string;
    occurredAt: string;
    observedPreviousRole?: string;
  }>,
): Promise<StagingPrivilegeIntent | undefined> {
  const result = await tx.execute({
    sql: `SELECT id, actor_id, previous_role, current_role, expires_at
      FROM staging_privilege_change_intents
      WHERE tenant_id = ? AND subject_id = ? AND membership_id = ?
        AND current_role = ? AND status = 'pending'
        AND created_at <= ? AND expires_at > ?
      ORDER BY created_at LIMIT 2`,
    args: [input.tenantId, input.subjectId, input.membershipId, input.currentRole, input.occurredAt, input.occurredAt],
  });
  if (result.rows.length === 0) return undefined;
  if (result.rows.length !== 1) throw new DomainError('CONFLICT');
  const row = result.rows[0]!;
  const previousRole = String(row.previous_role);
  const currentRole = String(row.current_role);
  if (
    !isRole(previousRole) ||
    !isRole(currentRole) ||
    (input.observedPreviousRole !== undefined && input.observedPreviousRole !== previousRole)
  )
    return undefined;

  const consumed = await tx.execute({
    sql: `UPDATE staging_privilege_change_intents
      SET status = 'consumed', consumed_at = ?, source_event_id = ?
      WHERE id = ? AND status = 'pending'`,
    args: [input.occurredAt, input.sourceEventId, String(row.id)],
  });
  if (consumed.rowsAffected !== 1) throw new DomainError('CONFLICT');
  await tx.execute({
    sql: `INSERT INTO identity_role_change_authorizations(
      tenant_id, subject_id, source_event_id, actor_id, previous_role,
      current_role, approved, recorded_at
    ) VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
    args: [
      input.tenantId,
      input.subjectId,
      input.sourceEventId,
      String(row.actor_id),
      previousRole,
      currentRole,
      input.occurredAt,
    ],
  });
  return {
    id: String(row.id),
    actorId: String(row.actor_id),
    previousRole,
    currentRole,
    expiresAt: String(row.expires_at),
  };
}

export async function expireStagingPrivilegeChange(store: OperationalStore, intentId: string): Promise<void> {
  if (!intentId.trim() || intentId.length > 128) throw new DomainError('VALIDATION_FAILED');
  await store.execute({
    sql: `UPDATE staging_privilege_change_intents SET status = 'expired'
      WHERE id = ? AND status = 'pending'`,
    args: [intentId],
  });
}

function assertIntentInput(input: {
  tenantId: string;
  subjectId: string;
  membershipId: string;
  actorId: string;
  previousRole: string;
  currentRole: string;
}): void {
  if (
    [input.tenantId, input.subjectId, input.membershipId, input.actorId].some(
      value => value.trim().length === 0 || value.length > 128,
    ) ||
    !isRole(input.previousRole) ||
    !isRole(input.currentRole) ||
    input.previousRole === input.currentRole
  )
    throw new DomainError('VALIDATION_FAILED');
}

function isRole(value: string): value is 'admin' | 'member' | 'viewer' {
  return roles.has(value);
}
