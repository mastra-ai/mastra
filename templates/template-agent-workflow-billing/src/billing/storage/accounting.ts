import { randomUUID } from 'node:crypto';
import type { Row, Transaction } from '@libsql/client/node';
import { BillingError, parseInput, usageEventSchema } from '../contracts.js';
import type { CommercialSnapshot } from '../contracts.js';
import { boundedJson, eligible, needsCommercialState, receiptSchema, reservation } from '../accounting.js';
import type {
  AdmissionIdentity,
  BillingResponse,
  ExecutorOutcome,
  Json,
  ResourceConfiguration,
} from '../accounting.js';
import { BillingDatabase } from './database.js';
import { OrganizationStorage } from './organizations.js';

export interface OperationClaim {
  readonly identity: AdmissionIdentity;
  readonly runtimeId: string;
  readonly resourceId: string;
  readonly operation: string;
  readonly key: string;
  readonly fingerprint: string;
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
      deliveryStatus: row.has_event === 1n ? 'pending' : 'not_required',
      observedUnits: row.observed_units === null ? null : Number(row.observed_units),
      billedUnits: row.billed_units === null ? null : Number(row.billed_units),
      replayed,
    }),
  };
}

export class AccountingStorage {
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
    const row = (
      await transaction.execute({
        sql: 'SELECT e.*, EXISTS(SELECT 1 FROM billing_outbox o WHERE o.execution_id = e.id) AS has_event FROM billing_executions e WHERE e.id = ?',
        args: [id],
      })
    ).rows[0];
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
    // A claimed invocation is never dispatched again, including after restart.
    await transaction.execute({
      sql: "UPDATE billing_executions SET status = 'uncertain', settlement = CASE WHEN settlement = 'reserved' THEN 'uncertain' ELSE settlement END WHERE id = ? AND status = 'running' AND runtime_id != ?",
      args: [previous.execution_id, claim.runtimeId],
    });
    return response(await this.find(transaction, String(previous.execution_id)), true);
  }
  replay(claim: OperationClaim): Promise<BillingResponse | null> {
    return this.database.write(async transaction => {
      await this.authorize(transaction, claim.identity);
      return this.previous(transaction, claim);
    });
  }
  eventIds(accountId: string): Promise<string[]> {
    return this.database.write(async transaction =>
      (
        await transaction.execute({
          sql: 'SELECT o.id FROM billing_outbox o JOIN billing_ledger l ON l.execution_id = o.execution_id LEFT JOIN immutable_usage u ON u.id = o.id AND u.account_id = l.account_id AND u.payload = o.payload WHERE l.account_id = ? AND u.id IS NULL ORDER BY o.id LIMIT 1000',
          args: [accountId],
        })
      ).rows.map(row => String(row.id)),
    );
  }
  admit(
    claim: OperationClaim,
    resource: ResourceConfiguration,
    snapshot: CommercialSnapshot | null,
  ): Promise<Admission> {
    return this.database.write(async transaction => {
      await this.authorize(transaction, claim.identity);
      const previous = await this.previous(transaction, claim);
      if (previous) return { status: 'replayed', response: previous };
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
          account.provider !== snapshot.account.provider ||
          account.external_reference !== snapshot.account.externalReference
        )
          throw new BillingError('state_unavailable');
        if (String(account.version) !== snapshot.evidence?.version) return { status: 'stale' };
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
                sql: 'SELECT l.units, o.id, o.payload, u.payload AS reflected_payload FROM billing_ledger l JOIN billing_outbox o ON o.execution_id = l.execution_id LEFT JOIN immutable_usage u ON u.id = o.id AND u.account_id = l.account_id WHERE l.account_id = ? AND l.meter = ?',
                args: [accountId, charge.meter],
              })
            ).rows;
            // The local driver proves the exact immutable payload was reflected
            // in the same SQL/versioned snapshot; ingestion alone is insufficient.
            const held = holds.reduce((sum, row) => sum + BigInt(String(row.units)), 0n);
            const unreflected = debits.reduce(
              (sum, row) => sum + (row.payload === row.reflected_payload ? 0n : BigInt(String(row.units))),
              0n,
            );
            if (BigInt(meter.confirmedBalance!) - held - unreflected < BigInt(units))
              throw new BillingError('insufficient_credits');
          }
        }
      }
      const executionId = randomUUID();
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

  finish(executionId: string, outcome: ExecutorOutcome, result: Json | null): Promise<BillingResponse> {
    return this.database.write(async transaction => {
      const row = await this.find(transaction, executionId);
      if (!['running', 'uncertain'].includes(String(row.status))) return response(row, false);
      const resource = JSON.parse(String(row.configuration)) as ResourceConfiguration;
      const charge = resource.policy.charge;
      for (const observation of outcome.measurements ?? []) {
        const registered = resource.measurements.some(measure => measure.key === observation.measure);
        if (!registered) throw new BillingError('invalid_input');
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
      const unknown = outcome.status === 'uncertain';
      const overflow = charge.type === 'usage' && observed! > charge.maxUnits;
      const status = unknown
        ? 'uncertain'
        : overflow
          ? 'failed'
          : outcome.status === 'succeeded'
            ? 'completed'
            : outcome.status;
      const incomplete = status === 'completed' && charge.type === 'usage' && !outcome.measurementComplete;
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
        sql: 'UPDATE billing_executions SET status = ?, settlement = ?, observed_units = ?, billed_units = ?, result = ?, terminal_at = ? WHERE id = ? AND status IN (?, ?)',
        args: [
          status,
          settlement,
          observed,
          billed,
          result === null ? null : JSON.stringify(result),
          unknown ? null : now,
          executionId,
          'running',
          'uncertain',
        ],
      });
      if (terminal) {
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
            await transaction.execute({ sql: 'SELECT * FROM billing_accounts WHERE id = ?', args: [row.account_id] })
          ).rows[0];
          const event = parseInput(usageEventSchema, {
            id: `usage:${executionId}`,
            executionId,
            account: {
              id: account.id,
              workspaceId: account.workspace_id,
              provider: account.provider,
              externalReference: account.external_reference,
            },
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
        }
      }
      return response(await this.find(transaction, executionId), false);
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
