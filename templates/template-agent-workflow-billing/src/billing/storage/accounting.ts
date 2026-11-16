import {
  reservationBudgetSchema,
  reservationRequestSchema,
  finalizationRequestSchema,
  workflowSuspensionTtlMs,
} from '../contracts/reservations.js';
import type { ReservationProtocol } from '../contracts/reservations.js';
import { randomUUID } from 'node:crypto';
import type { Row, Transaction } from '@libsql/client/node';
import { BillingError, accountSchema, parseInput, usageBindingSchema, usageEventSchema } from '../contracts/core.js';
import type { BillingProvider } from '../contracts/provider.js';
import type { CommercialSnapshot, UsageBinding } from '../contracts/core.js';
import { boundedJson, eligible, needsCommercialState, receiptSchema, reservation } from '../runtime/accounting.js';
import type {
  AdmissionIdentity,
  BillingResponse,
  ExecutorOutcome,
  Json,
  ResourceConfiguration,
} from '../runtime/accounting.js';
import { BillingDatabase } from './database.js';
import { OrganizationStorage } from './organizations.js';
import { accountFromRow } from './accounts.js';

export interface OperationClaim {
  readonly identity: AdmissionIdentity;
  readonly runtimeId: string;
  readonly resourceId: string;
  readonly operation: string;
  readonly key: string;
  readonly fingerprint: string;
}
type WorkflowLifecycle = { executionId: string; version: number };

async function requireRunningWorkflow(tx: Transaction, lifecycle?: WorkflowLifecycle) {
  if (!lifecycle) return;
  const current = (
    await tx.execute({
      sql: 'SELECT version, status FROM billing_workflow_runs WHERE id = ?',
      args: [lifecycle.executionId],
    })
  ).rows[0];
  if (current?.version !== BigInt(lifecycle.version) || current.status !== 'running')
    throw new BillingError('conflict');
}

export type Admission =
  | { readonly status: 'stale' }
  | { readonly status: 'admitted'; readonly executionId: string }
  | { readonly status: 'replayed'; readonly response: BillingResponse };

function response(row: Row, replayed: boolean): BillingResponse {
  const resource = JSON.parse(String(row.configuration)) as ResourceConfiguration;
  return {
    result: row.result === null ? null : boundedJson(JSON.parse(String(row.result))),
    billing: parseInput(receiptSchema, {
      executionId: row.id,
      workspaceId: row.workspace_id,
      policyVersion: resource.policy.version,
      executionStatus: row.status,
      settlementStatus: row.settlement,
      deliveryStatus: row.delivery_status ?? (row.has_event === 1n ? 'pending' : 'not_required'),
      observedUnits: row.observed_units === null ? null : Number(row.observed_units),
      billedUnits: row.billed_units === null ? null : Number(row.billed_units),
      replayed,
    }),
  };
}

async function executionRow(transaction: Transaction, id: string) {
  return (
    await transaction.execute({
      sql: 'SELECT e.*, EXISTS(SELECT 1 FROM billing_outbox o WHERE o.execution_id = e.id) AS has_event, (SELECT d.status FROM billing_delivery d JOIN billing_outbox o ON o.id = d.event_id WHERE o.execution_id = e.id) AS delivery_status FROM billing_executions e WHERE e.id = ?',
      args: [id],
    })
  ).rows[0];
}

export async function workflowReceipt(transaction: Transaction, identity: AdmissionIdentity, executionId: string) {
  const row = await executionRow(transaction, executionId);
  if (!row) return null;
  if (row.actor_id !== identity.actorId || row.workspace_id !== identity.workspaceId)
    throw new BillingError('forbidden');
  return response(row, true).billing;
}

async function activeReservation(transaction: Transaction, executionId: string) {
  const row = (
    await transaction.execute({
      sql: 'SELECT r.request, r.payload, r.reserve_state, r.terminal_request, r.segment_deadline, e.status, e.recovery_fenced FROM billing_remote_operations r JOIN billing_executions e ON e.id = r.execution_id WHERE r.execution_id = ?',
      args: [executionId],
    })
  ).rows[0];
  if (!row) return null;
  if (row.recovery_fenced === 1n) throw new BillingError('conflict');
  if (
    row.reserve_state !== 'reserved' ||
    row.terminal_request !== null ||
    !['running', 'uncertain'].includes(String(row.status))
  )
    throw new BillingError('state_unavailable');
  return row;
}

// For a resumed workflow the caller owns the same transaction as its version
// claim. Replays and competing keys must never reach this write.
export async function claimReservationSegment(
  transaction: Transaction,
  executionId: string,
  policy: ResourceConfiguration['policy'],
  operation: 'initial' | 'resume',
) {
  const remote = await activeReservation(transaction, executionId);
  if (!remote) return false;
  const request = reservationRequestSchema.parse(JSON.parse(String(remote.request)));
  const budget = policy.reservationBudget ?? reservationBudgetSchema.parse({});
  const now = Date.now();
  const configuredDeadline = now + budget.executionMs;
  if (now >= request.executionCutoff || (operation === 'resume' && configuredDeadline >= request.executionCutoff))
    throw new BillingError('state_unavailable');
  const deadline = Math.min(configuredDeadline, request.executionCutoff);
  await transaction.execute({
    sql: 'UPDATE billing_remote_operations SET segment_deadline = ? WHERE execution_id = ?',
    args: [deadline, executionId],
  });
  return true;
}

// The caller owns the current initial workflow version in this transaction.
export async function finishUnstartedReservation(
  tx: Transaction,
  executionId: string,
  status: 'canceled' | 'failed',
): Promise<boolean> {
  const row = (
    await tx.execute({
      sql: `SELECT e.status, e.account_id, e.recovery_fenced, r.reserve_state, r.reserve_evidence, r.outcome_units, r.terminal_request,
          h.execution_id AS native_handoff
        FROM billing_executions e
        LEFT JOIN billing_remote_operations r ON r.execution_id = e.id
        LEFT JOIN billing_workflow_native_handoffs h ON h.execution_id = r.execution_id AND h.version = 1
        WHERE e.id = ?`,
      args: [executionId],
    })
  ).rows[0];
  if (!row) return status === 'canceled';
  if (
    row.native_handoff !== null ||
    row.recovery_fenced === 1n ||
    (row.reserve_state === 'reserved' && !row.reserve_evidence) ||
    (status === 'failed' && row.reserve_state !== 'reserved') ||
    row.terminal_request !== null ||
    row.outcome_units !== null ||
    !['running', 'uncertain'].includes(String(row.status)) ||
    (row.reserve_state === null && row.account_id !== null)
  )
    return false;
  if (row.reserve_state !== null)
    await tx.execute({
      sql: 'UPDATE billing_remote_operations SET outcome_units = 0 WHERE execution_id = ? AND outcome_units IS NULL',
      args: [executionId],
    });
  const noHold = row.reserve_state === null || row.reserve_state === 'denied';
  await tx.execute({
    sql: 'UPDATE billing_executions SET status = ?, settlement = ?, billed_units = ?, terminal_at = ?, recovery_fenced = 1 WHERE id = ?',
    args: [
      status,
      noHold ? 'released' : row.reserve_state === 'reserved' ? 'pending' : 'uncertain',
      noHold ? 0 : null,
      new Date().toISOString(),
      executionId,
    ],
  });
  return true;
}

export class AccountingStorage {
  private reservationDriver: { id: string; protocol: ReservationProtocol } | undefined;
  private financialCursor = '';
  useReservations(provider: Pick<BillingProvider, 'id' | 'reservations'>) {
    this.reservationDriver = provider.reservations ? { id: provider.id, protocol: provider.reservations } : undefined;
  }

  claimReservation(
    claim: OperationClaim,
    resource: ResourceConfiguration,
    lifecycle?: WorkflowLifecycle,
  ): Promise<Admission> {
    return this.database.write(async tx => {
      await this.authorize(tx, claim.identity);
      const prior = await this.previous(tx, claim);
      if (prior) return { status: 'replayed', response: prior };
      await requireRunningWorkflow(tx, lifecycle);
      const id = lifecycle?.executionId ?? randomUUID();
      await tx.execute({
        sql: 'INSERT INTO billing_runtimes VALUES (?, ?) ON CONFLICT DO NOTHING',
        args: [claim.runtimeId, process.pid],
      });
      await tx.execute({
        sql: "INSERT INTO billing_executions (id, actor_id, workspace_id, resource_id, operation, configuration, runtime_id, status, settlement, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'running', 'pending', ?)",
        args: [
          id,
          claim.identity.actorId,
          claim.identity.workspaceId,
          resource.id,
          claim.operation,
          JSON.stringify(resource),
          claim.runtimeId,
          new Date().toISOString(),
        ],
      });
      await tx.execute({
        sql: 'INSERT INTO billing_operations VALUES (?, ?, ?, ?, ?, ?, ?)',
        args: [
          claim.identity.actorId,
          claim.identity.workspaceId,
          resource.id,
          claim.operation,
          claim.key,
          claim.fingerprint,
          id,
        ],
      });
      return { status: 'admitted', executionId: id };
    });
  }
  async reserve(
    executionId: string,
    identity: AdmissionIdentity,
    snapshot: CommercialSnapshot,
    lifecycle?: WorkflowLifecycle,
  ) {
    const driver = this.reservationDriver;
    if (!driver || snapshot.account.provider !== driver.id) throw new BillingError('invalid_configuration');
    const { protocol } = driver;
    const payload = await this.database.write(async tx => {
      await this.authorize(tx, identity);
      const execution = await this.find(tx, executionId);
      if (
        execution.actor_id !== identity.actorId ||
        execution.workspace_id !== identity.workspaceId ||
        snapshot.account.workspaceId !== identity.workspaceId
      )
        throw new BillingError('forbidden');
      await requireRunningWorkflow(tx, lifecycle);
      if (execution.status !== 'running') throw new BillingError('conflict');
      const resource = JSON.parse(String(execution.configuration)) as ResourceConfiguration;
      eligible(resource.policy, snapshot, Date.now());
      const charge = resource.policy.charge;
      if (charge.type === 'none') throw new BillingError('invalid_configuration');
      const budget = resource.policy.reservationBudget ?? reservationBudgetSchema.parse({});
      const now = Date.now();
      const expiresAt = now + budget.lifetimeMs;
      const confirmationCutoff = expiresAt - budget.expiryMarginMs;
      const executionCutoff = confirmationCutoff - budget.finalizationMs;
      const request = reservationRequestSchema.parse({
        id: `reserve:${executionId}`,
        account: snapshot.account,
        meter: charge.meter,
        units: reservation(resource.policy),
        executionCutoff,
        confirmationCutoff,
        expiresAt,
      });
      const bytes = protocol.prepareReservation(request);
      if (!bytes || Buffer.byteLength(bytes) > 65536) throw new BillingError('state_unavailable');
      await tx.execute({
        sql: 'UPDATE billing_executions SET account_id = ? WHERE id = ?',
        args: [snapshot.account.id, executionId],
      });
      await tx.execute({
        sql: 'INSERT INTO billing_admitted_accounts VALUES (?, ?)',
        args: [executionId, JSON.stringify(snapshot.account)],
      });
      // Commit the immutable payload and its one-time reserve dispatch claim
      // together under the current workflow version, before any wire I/O.
      await tx.execute({
        sql: "INSERT INTO billing_remote_operations (execution_id, request, payload, reserve_state) VALUES (?, ?, ?, 'dispatched')",
        args: [executionId, JSON.stringify(request), bytes],
      });
      await tx.execute({
        sql: 'INSERT INTO billing_reservations VALUES (?, ?, ?, ?, 1)',
        args: [executionId, snapshot.account.id, charge.meter, request.units],
      });
      return bytes;
    });
    let result;
    try {
      result = await protocol.reserve(payload);
    } catch {
      result = { status: 'uncertain' as const };
    }
    const releaseCanceledHold = await this.database.write(async tx => {
      const acknowledged = result.status === 'reserved' || result.status === 'denied';
      const state = acknowledged && result.evidence ? result.status : 'uncertain';
      const updated = await tx.execute({
        sql: "UPDATE billing_remote_operations SET reserve_state = ?, reserve_evidence = ? WHERE execution_id = ? AND reserve_state = 'dispatched'",
        args: [state, result.evidence ?? null, executionId],
      });
      if (!updated.rowsAffected) return false;
      if (state === 'denied') {
        await tx.execute({
          sql: "UPDATE billing_executions SET status = CASE WHEN status = 'canceled' THEN status ELSE 'failed' END, settlement = 'released', billed_units = 0, terminal_at = COALESCE(terminal_at, ?) WHERE id = ?",
          args: [new Date().toISOString(), executionId],
        });
        await tx.execute({
          sql: "UPDATE billing_workflow_runs SET status = 'failed', owner = NULL WHERE id = ? AND status = 'running'",
          args: [executionId],
        });
        await tx.execute({
          sql: 'UPDATE billing_reservations SET active = 0 WHERE execution_id = ?',
          args: [executionId],
        });
        return false;
      }
      const receipt = await tx.execute({
        sql: "UPDATE billing_executions SET settlement = CASE WHEN status = 'canceled' AND ? = 'reserved' THEN 'pending' ELSE ? END WHERE id = ? RETURNING status",
        args: [state, state, executionId],
      });
      return state === 'reserved' && receipt.rows[0]?.status === 'canceled';
    });
    if (releaseCanceledHold) await this.settleReservation(executionId);
    return result.status === 'reserved' && Boolean(result.evidence);
  }
  async releaseAdmission(executionId: string, lifecycle?: WorkflowLifecycle) {
    const known = await this.database.write(
      async tx =>
        (
          await tx.execute({
            sql: "SELECT execution_id FROM billing_remote_operations WHERE execution_id = ? AND reserve_state = 'reserved' AND terminal_request IS NULL",
            args: [executionId],
          })
        ).rows.length === 1,
    );
    if (known)
      await this.finish(
        executionId,
        { status: 'failed', measurements: [], measurementComplete: false },
        null,
        lifecycle,
      );
    return known;
  }
  async uncertainAdmission(executionId: string) {
    await this.database.write(tx =>
      tx.execute({
        sql: "UPDATE billing_executions SET status = 'uncertain', settlement = 'uncertain' WHERE id = ? AND status = 'running'",
        args: [executionId],
      }),
    );
  }
  private async executionForSegment(
    tx: Transaction,
    identity: AdmissionIdentity,
    executionId: string,
    version?: number,
  ) {
    await this.authorize(tx, identity);
    const execution = await this.find(tx, executionId);
    if (execution.actor_id !== identity.actorId || execution.workspace_id !== identity.workspaceId)
      throw new BillingError('forbidden');
    await requireRunningWorkflow(tx, version === undefined ? undefined : { executionId, version });
    return execution;
  }

  beginSegment(identity: AdmissionIdentity, executionId: string, version?: number) {
    return this.database.write(async tx => {
      const execution = await this.executionForSegment(tx, identity, executionId, version);
      const resource = JSON.parse(String(execution.configuration)) as ResourceConfiguration;
      await claimReservationSegment(tx, executionId, resource.policy, 'initial');
    });
  }

  async validateReservationBinding(identity: AdmissionIdentity, executionId: string) {
    const driver = this.reservationDriver;
    if (!driver) return;
    await this.database.write(async tx => {
      const remote = (
        await tx.execute({
          sql: 'SELECT request, payload FROM billing_remote_operations WHERE execution_id = ?',
          args: [executionId],
        })
      ).rows[0];
      if (!remote) return;
      await this.executionForSegment(tx, identity, executionId);
      const request = reservationRequestSchema.parse(JSON.parse(String(remote.request)));
      if (request.account.provider !== driver.id) throw new BillingError('conflict');
      driver.protocol.validateBinding?.(String(remote.payload));
    });
  }

  segmentDeadline(
    identity: AdmissionIdentity,
    executionId: string,
    version?: number,
    operation: 'check' | 'dispatch' = 'check',
  ): Promise<number | null> {
    return this.database.write(async tx => {
      await this.executionForSegment(tx, identity, executionId, version);
      const remote = await activeReservation(tx, executionId);
      if (!remote) return null;
      const request = reservationRequestSchema.parse(JSON.parse(String(remote.request)));
      const driver = this.reservationDriver;
      if (!driver || driver.id !== request.account.provider) throw new BillingError('conflict');
      driver.protocol.validateBinding?.(String(remote.payload));
      if (remote.segment_deadline === null) throw new BillingError('state_unavailable');
      const deadline = Number(remote.segment_deadline);
      if (operation === 'dispatch' && version === 1 && Date.now() < deadline) {
        const claim = await tx.execute({
          sql: 'INSERT INTO billing_workflow_dispatch_claims VALUES (?) ON CONFLICT DO NOTHING',
          args: [executionId],
        });
        if (!claim.rowsAffected) throw new BillingError('conflict');
      }
      return deadline;
    });
  }

  async recoverFinancial() {
    const driver = this.reservationDriver;
    if (!driver) return;
    const ids = await this.database.write(async tx =>
      (
        await tx.execute({
          sql: `SELECT r.execution_id FROM billing_remote_operations r
            JOIN billing_admitted_accounts a ON a.execution_id = r.execution_id
            WHERE json_extract(a.payload, '$.provider') = ? AND json_extract(r.request, '$.account.provider') = ?
              AND r.reserve_state = 'reserved' AND r.terminal_state = 'pending'
              AND (r.terminal_request IS NOT NULL OR r.outcome_units IS NOT NULL)
              AND r.execution_id > ? ORDER BY r.execution_id LIMIT 100`,
          args: [driver.id, driver.id, this.financialCursor],
        })
      ).rows.map(row => String(row.execution_id)),
    );
    // Advance even when evidence remains unavailable, then wrap at the end.
    for (const id of ids) {
      this.financialCursor = id;
      await this.settleReservation(id);
    }
    if (ids.length < 100) this.financialCursor = '';
  }
  async settleReservation(executionId: string) {
    const driver = this.reservationDriver;
    if (!driver) return;
    const { id, protocol } = driver;
    const claim = await this.database.write(async tx => {
      const row = (
        await tx.execute({
          sql: `SELECT r.* FROM billing_remote_operations r
            JOIN billing_admitted_accounts a ON a.execution_id = r.execution_id
            WHERE r.execution_id = ? AND json_extract(a.payload, '$.provider') = ?
              AND json_extract(r.request, '$.account.provider') = ?`,
          args: [executionId, id, id],
        })
      ).rows[0];
      if (!row || row.reserve_state !== 'reserved' || row.terminal_state !== 'pending') return null;
      if (row.terminal_request !== null) {
        // The exact mutation was already claimed before any wire I/O. Even if
        // its acknowledgement is missing after the cutoff, only look it up.
        const request = finalizationRequestSchema.parse(JSON.parse(String(row.terminal_request)));
        if (request.reservation.account.provider !== id) return null;
        return {
          request,
          payload: String(row.terminal_payload),
          dispatch: false,
        };
      }
      if (row.outcome_units === null) return null;
      const execution = await this.find(tx, executionId);
      if (!['completed', 'failed', 'canceled'].includes(String(execution.status))) return null;
      const reservation = reservationRequestSchema.parse(JSON.parse(String(row.request)));
      const confirm = execution.status === 'completed' && Date.now() < reservation.confirmationCutoff;
      const request = finalizationRequestSchema.parse({
        reservation,
        action: confirm ? 'confirm' : 'release',
        units: confirm ? Number(row.outcome_units) : 0,
      });
      let payload;
      try {
        payload = protocol.prepareFinalization(request, String(row.payload));
      } catch (error) {
        // A changed payer mapping cannot claim dispatch. Restoring the original
        // mapping makes the unchanged, known outcome recoverable.
        if (error instanceof BillingError && error.code === 'conflict') return null;
        throw error;
      }
      if (!payload || Buffer.byteLength(payload) > 65536) throw new BillingError('state_unavailable');
      // Choose the immutable financial request and its one-time dispatch claim
      // together. A failed transaction leaves only the durable compute outcome,
      // allowing recovery to choose release if confirmation time has run out.
      await tx.execute({
        sql: 'UPDATE billing_remote_operations SET terminal_request = ?, terminal_payload = ?, terminal_dispatched = 1 WHERE execution_id = ? AND terminal_request IS NULL AND terminal_dispatched = 0',
        args: [JSON.stringify(request), payload, executionId],
      });
      if (!confirm && execution.status === 'completed') {
        await tx.execute({ sql: "UPDATE billing_executions SET status = 'failed' WHERE id = ?", args: [executionId] });
        await tx.execute({
          sql: "UPDATE billing_workflow_runs SET status = 'failed' WHERE id = ? AND status = 'completed'",
          args: [executionId],
        });
      }
      return { request, payload, dispatch: true };
    });
    if (!claim) return;
    let result;
    try {
      result = await (claim.dispatch
        ? protocol.finalize(claim.payload)
        : protocol.reconcileFinalization(claim.payload));
    } catch {
      return;
    }
    const expected = claim.request.action === 'confirm' ? 'confirmed' : 'released';
    if (result.status !== expected || !result.evidence) return;
    await this.database.write(async tx => {
      const updated = await tx.execute({
        sql: "UPDATE billing_remote_operations SET terminal_state = ?, terminal_evidence = ? WHERE execution_id = ? AND terminal_payload = ? AND terminal_state = 'pending'",
        args: [expected, result.evidence!, executionId, claim.payload],
      });
      if (!updated.rowsAffected) return;
      const execution = await this.find(tx, executionId);
      await tx.execute({
        sql: 'UPDATE billing_executions SET settlement = ?, billed_units = ? WHERE id = ?',
        args: [expected === 'confirmed' ? 'settled' : 'released', claim.request.units, executionId],
      });
      await tx.execute({
        sql: 'UPDATE billing_reservations SET active = 0 WHERE execution_id = ?',
        args: [executionId],
      });
      // This ledger is an audit of the provider effect. No prepaid outbox event.
      await tx.execute({
        sql: 'INSERT INTO billing_ledger VALUES (?, ?, ?, ?, ?, ?)',
        args: [
          executionId,
          execution.account_id,
          claim.request.reservation.meter,
          claim.request.units,
          execution.status,
          new Date().toISOString(),
        ],
      });
    });
  }

  private constructor(
    private readonly database: BillingDatabase,
    private readonly organizations: OrganizationStorage,
  ) {}
  static async open(options: { url: string }, organizations: OrganizationStorage): Promise<AccountingStorage> {
    return new AccountingStorage(await BillingDatabase.open(options), organizations);
  }
  close(): void {
    this.database.close();
  }

  private async authorize(transaction: Transaction, identity: AdmissionIdentity): Promise<void> {
    if (identity.validUntil !== null && identity.validUntil <= Date.now()) throw new BillingError('unauthenticated');
    if (identity.credentialHash !== null) {
      const row = (
        await transaction.execute({
          sql: 'SELECT active FROM local_credentials WHERE hash = ? AND identity_id = ?',
          args: [identity.credentialHash, identity.actorId],
        })
      ).rows[0];
      if (row?.active !== 1n) throw new BillingError('unauthenticated');
    }
    await this.organizations.authorizeInTransaction(transaction, identity.actorId, identity.workspaceId, 'execute');
  }
  private async find(transaction: Transaction, id: string): Promise<Row> {
    const row = await executionRow(transaction, id);
    if (!row) throw new BillingError('forbidden');
    return row;
  }
  private async previous(transaction: Transaction, claim: OperationClaim): Promise<BillingResponse | null> {
    const previous = (
      await transaction.execute({
        sql: 'SELECT fingerprint, execution_id FROM billing_operations WHERE actor_id = ? AND workspace_id = ? AND resource_id = ? AND operation = ? AND key = ?',
        args: [claim.identity.actorId, claim.identity.workspaceId, claim.resourceId, claim.operation, claim.key],
      })
    ).rows[0];
    if (!previous) return null;
    if (previous.fingerprint !== claim.fingerprint) throw new BillingError('conflict');
    // Replay cannot establish owner death. Recovery checks liveness and fences
    // interrupted owners; a duplicate request only reads the durable result.
    return response(await this.find(transaction, String(previous.execution_id)), true);
  }
  replay(claim: OperationClaim): Promise<BillingResponse | null> {
    return this.database.write(async transaction => {
      await this.authorize(transaction, claim.identity);
      return this.previous(transaction, claim);
    });
  }
  admittedAccount(identity: AdmissionIdentity, executionId: string) {
    return this.database.write(async transaction => {
      await this.authorize(transaction, identity);
      const execution = await this.find(transaction, executionId);
      if (execution.actor_id !== identity.actorId || execution.workspace_id !== identity.workspaceId)
        throw new BillingError('forbidden');
      const admitted = (
        await transaction.execute({
          sql: 'SELECT payload FROM billing_admitted_accounts WHERE execution_id = ?',
          args: [executionId],
        })
      ).rows[0];
      if (!admitted) throw new BillingError('state_unavailable');
      const account = parseInput(accountSchema, JSON.parse(String(admitted.payload)));
      if (account.id !== execution.account_id || account.workspaceId !== identity.workspaceId)
        throw new BillingError('state_unavailable');
      return account;
    });
  }

  eventIds(accountId: string): Promise<string[]> {
    return this.database.write(async transaction =>
      (
        await transaction.execute({
          sql: 'SELECT event_id AS id FROM billing_unreflected_debits WHERE account_id = ? ORDER BY event_id LIMIT 1000',
          args: [accountId],
        })
      ).rows.map(row => String(row.id)),
    );
  }
  admit(
    claim: OperationClaim,
    resource: ResourceConfiguration,
    snapshot: CommercialSnapshot | null,
    lifecycle?: WorkflowLifecycle,
    usageBinding?: UsageBinding,
  ): Promise<Admission> {
    return this.database.write(async transaction => {
      await this.authorize(transaction, claim.identity);
      const previous = await this.previous(transaction, claim);
      if (previous) return { status: 'replayed', response: previous };
      await requireRunningWorkflow(transaction, lifecycle);
      let accountId: string | null = null;
      const charge = resource.policy.charge;
      const units = reservation(resource.policy);
      if (needsCommercialState(resource.policy)) {
        if (!snapshot || snapshot.account.workspaceId !== claim.identity.workspaceId)
          throw new BillingError('state_unavailable');
        eligible(resource.policy, snapshot, Date.now());
        const account = (
          await transaction.execute({
            sql: 'SELECT a.*, s.version FROM billing_accounts a JOIN commercial_state s ON s.account_id = a.id WHERE a.id = ?',
            args: [snapshot.account.id],
          })
        ).rows[0];
        if (
          !account ||
          account.workspace_id !== snapshot.account.workspaceId ||
          accountFromRow(account).provider !== snapshot.account.provider ||
          account.external_reference !== snapshot.account.externalReference
        )
          throw new BillingError('state_unavailable');
        if (
          snapshot.prepaidAuthority !== 'provider-reservations' &&
          String(account.version) !== snapshot.evidence?.version
        )
          return { status: 'stale' };
        accountId = String(account.id);
        if (charge.type !== 'none') {
          const meter = snapshot.meters.find(meter => meter.key === charge.meter)!;
          const funding = charge.type === 'credits' ? 'prepaid' : charge.funding;
          if (funding === 'prepaid') {
            const holds = (
              await transaction.execute({
                sql: 'SELECT units FROM billing_reservations WHERE account_id = ? AND meter = ? AND active = 1',
                args: [accountId, charge.meter],
              })
            ).rows;
            const debits = (
              await transaction.execute({
                sql: 'SELECT units FROM billing_unreflected_debits WHERE account_id = ? AND meter = ?',
                args: [accountId, charge.meter],
              })
            ).rows;
            // Indexed pending debits retain their hold until immutable reflection
            // matches both the original account and the exact outbox payload.
            const held = holds.reduce((sum, row) => sum + BigInt(String(row.units)), 0n);
            const unreflected = debits.reduce((sum, row) => sum + BigInt(String(row.units)), 0n);
            if (BigInt(meter.confirmedBalance!) - held - unreflected < BigInt(units))
              throw new BillingError('insufficient_credits');
          }
        }
      }
      const executionId = lifecycle?.executionId ?? randomUUID();
      await transaction.execute({
        sql: 'INSERT INTO billing_runtimes VALUES (?, ?) ON CONFLICT DO NOTHING',
        args: [claim.runtimeId, process.pid],
      });
      await transaction.execute({
        sql: 'INSERT INTO billing_executions (id, actor_id, workspace_id, account_id, resource_id, operation, configuration, runtime_id, status, settlement, observed_units, billed_units, result, created_at, terminal_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, NULL)',
        args: [
          executionId,
          claim.identity.actorId,
          claim.identity.workspaceId,
          accountId,
          resource.id,
          claim.operation,
          JSON.stringify(resource),
          claim.runtimeId,
          'running',
          units === 0 ? 'not_required' : 'reserved',
          new Date().toISOString(),
        ],
      });
      if (snapshot)
        await transaction.execute({
          sql: 'INSERT INTO billing_admitted_accounts VALUES (?, ?)',
          args: [executionId, JSON.stringify(snapshot.account)],
        });
      if (charge.type !== 'none') {
        const binding = parseInput(usageBindingSchema, usageBinding);
        if (binding.provider !== snapshot?.account.provider || binding.meter !== charge.meter)
          throw new BillingError('state_unavailable');
        await transaction.execute({
          sql: 'INSERT INTO billing_usage_bindings (execution_id, payload, evidence) VALUES (?, ?, NULL)',
          args: [executionId, JSON.stringify(binding)],
        });
      }
      await transaction.execute({
        sql: 'INSERT INTO billing_operations (actor_id, workspace_id, resource_id, operation, key, fingerprint, execution_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        args: [
          claim.identity.actorId,
          claim.identity.workspaceId,
          resource.id,
          claim.operation,
          claim.key,
          claim.fingerprint,
          executionId,
        ],
      });
      if (charge.type !== 'none')
        await transaction.execute({
          sql: 'INSERT INTO billing_reservations (execution_id, account_id, meter, units, active) VALUES (?, ?, ?, ?, 1)',
          args: [executionId, accountId, charge.meter, units],
        });
      return { status: 'admitted', executionId };
    });
  }

  hasExecution(executionId: string): Promise<boolean> {
    return this.database.write(
      async transaction =>
        (await transaction.execute({ sql: 'SELECT id FROM billing_executions WHERE id = ?', args: [executionId] })).rows
          .length === 1,
    );
  }

  capture(executionId: string, observations: NonNullable<ExecutorOutcome['measurements']>): Promise<void> {
    return this.database.write(async transaction => {
      const row = await this.find(transaction, executionId);
      if (row.recovery_fenced === 1n || !['running', 'uncertain'].includes(String(row.status))) return;
      const resource = JSON.parse(String(row.configuration)) as ResourceConfiguration;
      await this.recordMeasurements(transaction, executionId, resource, observations);
    });
  }

  private async recordMeasurements(
    transaction: Transaction,
    executionId: string,
    resource: ResourceConfiguration,
    observations: NonNullable<ExecutorOutcome['measurements']>,
  ): Promise<void> {
    for (const observation of observations) {
      if (!resource.measurements.some(measure => measure.key === observation.measure))
        throw new BillingError('invalid_input');
      const previous = (
        await transaction.execute({
          sql: 'SELECT measure, units FROM billing_measurements WHERE execution_id = ? AND id = ?',
          args: [executionId, observation.id],
        })
      ).rows[0];
      if (previous && (previous.measure !== observation.measure || previous.units !== BigInt(observation.units)))
        throw new BillingError('conflict');
      if (!previous)
        await transaction.execute({
          sql: 'INSERT INTO billing_measurements (execution_id, id, measure, units) VALUES (?, ?, ?, ?)',
          args: [executionId, observation.id, observation.measure, observation.units],
        });
    }
  }

  async finish(
    executionId: string,
    outcome: ExecutorOutcome,
    result: Json | null,
    lifecycle?: { executionId: string; version: number; expiryToken?: string },
  ): Promise<BillingResponse> {
    const completion = await this.database.write(async transaction => {
      const row = await this.find(transaction, executionId);
      if (row.recovery_fenced === 1n || !['running', 'uncertain'].includes(String(row.status)))
        return response(row, false);
      const resource = JSON.parse(String(row.configuration)) as ResourceConfiguration;
      const charge = resource.policy.charge;
      if (lifecycle) {
        const current = (
          await transaction.execute({
            sql: 'SELECT version, status FROM billing_workflow_runs WHERE id = ?',
            args: [lifecycle.executionId],
          })
        ).rows[0];
        if (
          !current ||
          current.version !== BigInt(lifecycle.version) ||
          !['running', 'canceling'].includes(String(current.status))
        )
          return response(row, false);
      }
      if (lifecycle) {
        const expiry = (
          await transaction.execute({
            sql: 'SELECT * FROM billing_expiry_recovery WHERE run_id = ?',
            args: [executionId],
          })
        ).rows[0];
        if (
          (expiry || lifecycle.expiryToken) &&
          (!expiry ||
            !lifecycle.expiryToken ||
            expiry.lease_token !== lifecycle.expiryToken ||
            Number(expiry.lease_until) <= Date.now() ||
            (outcome.status === 'canceled' && expiry.confirmed_suspended !== 1n))
        )
          return response(row, false);
      }
      await this.recordMeasurements(transaction, executionId, resource, outcome.measurements ?? []);
      const measurements =
        charge.type === 'usage'
          ? (
              await transaction.execute({
                sql: 'SELECT units FROM billing_measurements WHERE execution_id = ? AND measure = ?',
                args: [executionId, charge.measure],
              })
            ).rows
          : null;
      const measured =
        measurements === null ? null : measurements.reduce((sum, row) => sum + BigInt(String(row.units)), 0n);
      if (measured !== null && measured > BigInt(Number.MAX_SAFE_INTEGER)) throw new BillingError('invalid_input');
      const observed =
        measured === null || (measurements!.length === 0 && !outcome.measurementComplete) ? null : Number(measured);
      const remote = (
        await transaction.execute({
          sql: 'SELECT * FROM billing_remote_operations WHERE execution_id = ?',
          args: [executionId],
        })
      ).rows[0];
      const remoteRequest = remote ? reservationRequestSchema.parse(JSON.parse(String(remote.request))) : null;
      const cutoff =
        remoteRequest !== null &&
        (Date.now() >= remoteRequest.executionCutoff ||
          (remote?.segment_deadline !== null && Date.now() >= Number(remote?.segment_deadline)));
      if (
        !cutoff &&
        outcome.status === 'suspended' &&
        !(charge.type === 'usage' && observed !== null && observed > charge.maxUnits)
      ) {
        if (!lifecycle) throw new BillingError('invalid_input');
        await transaction.execute({
          sql: 'UPDATE billing_executions SET observed_units = ? WHERE id = ?',
          args: [observed, executionId],
        });
        await transaction.execute({
          sql: "UPDATE billing_workflow_runs SET status = 'suspended', owner = NULL, expires_at = ?, measurement_complete = CASE WHEN ? = 1 THEN measurement_complete ELSE 0 END, result = ? WHERE id = ? AND version = ?",
          args: [
            Math.min(
              Date.now() + workflowSuspensionTtlMs(resource.policy),
              remoteRequest
                ? remoteRequest.executionCutoff -
                    (resource.policy.reservationBudget ?? reservationBudgetSchema.parse({})).executionMs
                : Infinity,
            ),
            outcome.measurementComplete ? 1 : 0,
            result === null ? null : JSON.stringify(result),
            lifecycle.executionId,
            lifecycle.version,
          ],
        });
        return response(await this.find(transaction, executionId), false);
      }
      const timedOut = outcome.status === 'timed_out';
      // An active cutoff makes an acknowledged hold releasable even when
      // downstream termination is unconfirmed. Late writes remain fenced.
      const expiredHold = timedOut && remote?.reserve_state === 'reserved';
      const unknown =
        outcome.status === 'uncertain' || (timedOut && !expiredHold) || (outcome.status === 'suspended' && !cutoff);
      const overflow = charge.type === 'usage' && observed! > charge.maxUnits;
      const status = unknown
        ? 'uncertain'
        : expiredHold || overflow || cutoff
          ? 'failed'
          : outcome.status === 'succeeded'
            ? 'completed'
            : outcome.status;
      const workflowComplete = lifecycle
        ? (
            await transaction.execute({
              sql: 'SELECT measurement_complete FROM billing_workflow_runs WHERE id = ?',
              args: [lifecycle.executionId],
            })
          ).rows[0]?.measurement_complete === 1n
        : true;
      const incomplete =
        status === 'completed' && charge.type === 'usage' && (!outcome.measurementComplete || !workflowComplete);
      const finalStatus = incomplete ? 'uncertain' : status;
      const terminal = !unknown && !incomplete;
      const billed = !terminal
        ? null
        : status !== 'completed' || charge.type === 'none'
          ? 0
          : charge.type === 'usage'
            ? observed!
            : charge.units;
      const settlement = unknown
        ? charge.type === 'none'
          ? 'not_required'
          : 'uncertain'
        : incomplete
          ? 'pending'
          : charge.type === 'none'
            ? 'not_required'
            : status === 'completed'
              ? 'settled'
              : 'released';
      const now = new Date().toISOString();
      await transaction.execute({
        sql: 'UPDATE billing_executions SET status = ?, settlement = ?, observed_units = ?, billed_units = ?, result = ?, terminal_at = ?, recovery_fenced = CASE WHEN ? = 1 THEN 1 ELSE recovery_fenced END WHERE id = ? AND status IN (?, ?)',
        args: [
          finalStatus,
          settlement,
          observed,
          billed,
          result === null ? null : JSON.stringify(result),
          terminal ? now : null,
          timedOut ? 1 : 0,
          executionId,
          'running',
          'uncertain',
        ],
      });
      if (terminal && remoteRequest) {
        // Record trustworthy completion independently of financial dispatch.
        // This quantity is a success candidate, never a confirmed billed value.
        await transaction.execute({
          sql: 'UPDATE billing_remote_operations SET outcome_units = ? WHERE execution_id = ? AND outcome_units IS NULL',
          args: [billed, executionId],
        });
        await transaction.execute({
          sql: "UPDATE billing_executions SET settlement = 'pending', billed_units = NULL WHERE id = ?",
          args: [executionId],
        });
      }
      if (terminal && !remoteRequest) {
        await transaction.execute({
          sql: 'UPDATE billing_reservations SET active = 0 WHERE execution_id = ? AND active = 1',
          args: [executionId],
        });
        await transaction.execute({
          sql: 'INSERT INTO billing_ledger (execution_id, account_id, meter, units, outcome, occurred_at) VALUES (?, ?, ?, ?, ?, ?)',
          args: [executionId, row.account_id, charge.type === 'none' ? null : charge.meter, billed!, status, now],
        });
        if (billed! > 0 && charge.type !== 'none') {
          const account = (
            await transaction.execute({
              sql: 'SELECT payload FROM billing_admitted_accounts WHERE execution_id = ?',
              args: [executionId],
            })
          ).rows[0];
          if (!account) throw new BillingError('state_unavailable');
          const event = parseInput(usageEventSchema, {
            id: `usage:${executionId}`,
            executionId,
            account: JSON.parse(String(account.payload)),
            policyVersion: resource.policy.version,
            meter: charge.meter,
            units: billed,
            occurredAt: now,
            metadata: { resourceId: resource.id, resourceKind: resource.kind },
          });
          await transaction.execute({
            sql: 'INSERT INTO billing_outbox (id, execution_id, payload) VALUES (?, ?, ?)',
            args: [event.id, executionId, JSON.stringify(event)],
          });
          await transaction.execute({
            sql: "INSERT INTO billing_delivery (event_id, status, created_at) VALUES (?, 'pending', ?)",
            args: [event.id, Date.now()],
          });
        }
      }
      if (lifecycle)
        await transaction.execute({
          sql: 'UPDATE billing_workflow_runs SET status = ?, owner = NULL, expires_at = NULL, measurement_complete = CASE WHEN ? = 1 THEN measurement_complete ELSE 0 END, result = ? WHERE id = ? AND version = ?',
          args: [
            finalStatus,
            outcome.measurementComplete ? 1 : 0,
            result === null ? null : JSON.stringify(result),
            lifecycle.executionId,
            lifecycle.version,
          ],
        });
      return response(await this.find(transaction, executionId), false);
    });
    await this.settleReservation(executionId);
    return this.database.write(async tx => response(await this.find(tx, executionId), completion.billing.replayed));
  }
  readRequest(identity: AdmissionIdentity, resourceId: string, key: string): Promise<BillingResponse | null> {
    return this.database.write(async tx => {
      await this.authorize(tx, identity);
      const row = (
        await tx.execute({
          sql: "SELECT execution_id FROM billing_operations WHERE actor_id = ? AND workspace_id = ? AND resource_id = ? AND operation = 'generate' AND key = ?",
          args: [identity.actorId, identity.workspaceId, resourceId, key],
        })
      ).rows[0];
      return row ? response(await this.find(tx, String(row.execution_id)), true) : null;
    });
  }
  read(identity: AdmissionIdentity, executionId: string): Promise<BillingResponse> {
    return this.database.write(async transaction => {
      await this.authorize(transaction, identity);
      const row = await this.find(transaction, executionId);
      if (row.actor_id !== identity.actorId || row.workspace_id !== identity.workspaceId)
        throw new BillingError('forbidden');
      return response(row, true);
    });
  }
}
