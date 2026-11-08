import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Row, Transaction } from '@libsql/client/node';
import { BillingError, identifierSchema, parseInput } from '../contracts.js';
import { boundedJson, fingerprint } from '../accounting.js';
import type { AdmissionIdentity, Json, ResourceConfiguration } from '../accounting.js';
import { BillingDatabase } from './database.js';
import { OrganizationStorage } from './organizations.js';

export type WorkflowStatus =
  | 'created'
  | 'running'
  | 'suspended'
  | 'canceling'
  | 'completed'
  | 'failed'
  | 'canceled'
  | 'uncertain';
export interface WorkflowRecord {
  readonly id: string;
  readonly resourceId: string;
  readonly configuration: ResourceConfiguration;
  readonly adapterVersion: string;
  readonly status: WorkflowStatus;
  readonly version: number;
  readonly owner: string | null;
  readonly expiresAt: number | null;
  readonly measurementComplete: boolean;
  readonly input: Json | null;
  readonly result: Json | null;
}
const decode = (row: Row): WorkflowRecord => ({
  id: String(row.id),
  resourceId: String(row.resource_id),
  configuration: JSON.parse(String(row.configuration)),
  adapterVersion: String(row.adapter_version),
  status: String(row.status) as WorkflowStatus,
  version: Number(row.version),
  owner: row.owner === null ? null : String(row.owner),
  expiresAt: row.expires_at === null ? null : Number(row.expires_at),
  measurementComplete: row.measurement_complete === 1n,
  input: row.input === null ? null : boundedJson(JSON.parse(String(row.input))),
  result: row.result === null ? null : boundedJson(JSON.parse(String(row.result))),
});

export interface ExpiryClaim extends WorkflowRecord {
  readonly expiry: { readonly token: string; readonly confirmedSuspended: boolean };
}

export class WorkflowStorage {
  private expiryCursor = '';
  private constructor(
    private readonly database: BillingDatabase,
    private readonly organizations: OrganizationStorage,
  ) {}
  static async open(options: { url: string }, organizations: OrganizationStorage) {
    return new WorkflowStorage(await BillingDatabase.open(options), organizations);
  }
  close() {
    this.database.close();
  }
  private async authorize(transaction: Transaction, identity: AdmissionIdentity) {
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
    if (identity.commercial) {
      const row = (
        await transaction.execute({
          sql: 'SELECT s.version, q.generation, q.synchronized_generation FROM commercial_state s JOIN billing_accounts a ON a.id = s.account_id LEFT JOIN billing_account_sync q ON q.account_id = a.id WHERE a.id = ? AND a.workspace_id = ?',
          args: [identity.commercial.accountId, identity.workspaceId],
        })
      ).rows[0];
      if (
        !row ||
        String(row.version) !== identity.commercial.revision ||
        row.generation !== row.synchronized_generation
      )
        throw new BillingError('state_unavailable');
    }
  }
  private async find(transaction: Transaction, id: string, identity?: AdmissionIdentity) {
    const row = (await transaction.execute({ sql: 'SELECT * FROM billing_workflow_runs WHERE id = ?', args: [id] }))
      .rows[0];
    if (!row || (identity && (row.actor_id !== identity.actorId || row.workspace_id !== identity.workspaceId)))
      throw new BillingError('forbidden');
    return decode(row);
  }
  create(identity: AdmissionIdentity, configuration: ResourceConfiguration, adapterVersion: string, key: string) {
    parseInput(identifierSchema, key);
    return this.database.write(async transaction => {
      await this.authorize(transaction, identity);
      const previous = (
        await transaction.execute({
          sql: "SELECT r.id FROM billing_workflow_runs r JOIN billing_workflow_operations o ON o.run_id = r.id WHERE r.actor_id = ? AND r.workspace_id = ? AND r.resource_id = ? AND o.operation = 'create' AND o.key = ?",
          args: [identity.actorId, identity.workspaceId, configuration.id, key],
        })
      ).rows[0];
      if (previous) return this.find(transaction, String(previous.id), identity);
      const id = randomUUID();
      await transaction.execute({
        sql: "INSERT INTO billing_workflow_runs (id, actor_id, workspace_id, resource_id, configuration, adapter_version, status, version, owner, expires_at, measurement_complete, input, result, created_at) VALUES (?, ?, ?, ?, ?, ?, 'created', 0, NULL, NULL, 1, NULL, NULL, ?)",
        args: [
          id,
          identity.actorId,
          identity.workspaceId,
          configuration.id,
          JSON.stringify(configuration),
          adapterVersion,
          new Date().toISOString(),
        ],
      });
      await transaction.execute({
        sql: "INSERT INTO billing_workflow_operations (run_id, operation, key, fingerprint, version) VALUES (?, 'create', ?, ?, 0)",
        args: [id, key, fingerprint(boundedJson({ resourceId: configuration.id }))],
      });
      return this.find(transaction, id, identity);
    });
  }
  read(identity: AdmissionIdentity, id: string) {
    parseInput(identifierSchema, id);
    return this.database.write(async transaction => {
      await this.authorize(transaction, identity);
      return this.find(transaction, id, identity);
    });
  }
  // Internal runtime lookup: public callers must pass through read/claim first.
  current(id: string) {
    return this.database.write(transaction => this.find(transaction, id));
  }

  claim(
    identity: AdmissionIdentity,
    id: string,
    operation: 'start' | 'resume' | 'cancel',
    key: string,
    input: Json,
    owner: string,
  ) {
    parseInput(identifierSchema, key);
    const signature = fingerprint(input);
    return this.database.write(async transaction => {
      await this.authorize(transaction, identity);
      const record = await this.find(transaction, id, identity);
      const previous = (
        await transaction.execute({
          sql: 'SELECT fingerprint FROM billing_workflow_operations WHERE run_id = ? AND operation = ? AND key = ?',
          args: [id, operation, key],
        })
      ).rows[0];
      if (previous) {
        if (previous.fingerprint !== signature) throw new BillingError('conflict');
        return { claimed: false as const, record };
      }
      if (operation === 'start' && record.status !== 'created') throw new BillingError('conflict');
      if (
        operation === 'resume' &&
        (record.status !== 'suspended' || record.expiresAt === null || record.expiresAt <= Date.now())
      )
        throw new BillingError('conflict');
      if (
        operation === 'cancel' &&
        ['completed', 'failed', 'canceled', 'uncertain', 'canceling'].includes(record.status)
      )
        return { claimed: false as const, record };
      if (operation === 'resume') {
        const suspended =
          record.result !== null && typeof record.result === 'object' && !Array.isArray(record.result)
            ? record.result.suspendedSteps
            : undefined;
        const step = input !== null && typeof input === 'object' && !Array.isArray(input) ? input.step : undefined;
        const valid = z
          .object({ suspended: z.array(identifierSchema), step: identifierSchema })
          .refine(value => value.suspended.includes(value.step))
          .safeParse({ suspended, step });
        if (!valid.success) throw new BillingError('invalid_input');
      }
      await transaction.execute({
        sql: 'INSERT INTO billing_runtimes VALUES (?, ?) ON CONFLICT DO NOTHING',
        args: [owner, process.pid],
      });
      await transaction.execute({
        sql: "UPDATE billing_executions SET runtime_id = ? WHERE id = ? AND status IN ('running', 'uncertain') AND recovery_fenced = 0",
        args: [owner, id],
      });
      const next = record.version + 1;
      await transaction.execute({
        sql: 'INSERT INTO billing_workflow_operations (run_id, operation, key, fingerprint, version) VALUES (?, ?, ?, ?, ?)',
        args: [id, operation, key, signature, next],
      });
      await transaction.execute({
        sql: 'UPDATE billing_workflow_runs SET status = ?, version = ?, owner = ?, expires_at = NULL, input = CASE WHEN ? = ? THEN ? ELSE input END WHERE id = ? AND version = ?',
        args: [
          operation === 'cancel' ? 'canceling' : 'running',
          next,
          owner,
          operation,
          'start',
          JSON.stringify(input),
          id,
          record.version,
        ],
      });
      return { claimed: true as const, record: await this.find(transaction, id, identity), previous: record };
    });
  }
  transition(id: string, version: number, status: WorkflowStatus, result: Json | null = null) {
    return this.database.write(async transaction => {
      await transaction.execute({
        sql: 'UPDATE billing_workflow_runs SET status = ?, result = ?, owner = NULL, expires_at = NULL WHERE id = ? AND version = ?',
        args: [status, result === null ? null : JSON.stringify(result), id, version],
      });
      return this.find(transaction, id);
    });
  }
  incomplete(id: string) {
    return this.database.write(async transaction => {
      await transaction.execute({
        sql: 'UPDATE billing_workflow_runs SET measurement_complete = 0 WHERE id = ?',
        args: [id],
      });
    });
  }
  async overdue(now = Date.now()) {
    const rows = await this.database.write(
      async transaction =>
        (
          await transaction.execute({
            sql: "SELECT w.* FROM billing_workflow_runs w LEFT JOIN billing_expiry_recovery e ON e.run_id = w.id WHERE ((w.status = 'suspended' AND w.expires_at <= ?) OR (w.status IN ('canceling', 'uncertain') AND e.run_id IS NOT NULL AND e.next_attempt <= ? AND (e.lease_until IS NULL OR e.lease_until <= ?))) AND w.id > ? ORDER BY w.id LIMIT 100",
            args: [now, Date.now(), Date.now(), this.expiryCursor],
          })
        ).rows,
    );
    // Progress also past incompatible definitions, which cannot safely be
    // claimed or modified merely to move them out of the first batch.
    this.expiryCursor = rows.length === 100 ? String(rows.at(-1)!.id) : '';
    return rows.map(decode);
  }
  claimExpiry(id: string, now = Date.now(), leaseMs = 60000): Promise<ExpiryClaim | null> {
    parseInput(z.number().int().min(100).max(300000), leaseMs);
    return this.database.write(async transaction => {
      const record = await this.find(transaction, id);
      const intent = (
        await transaction.execute({ sql: 'SELECT * FROM billing_expiry_recovery WHERE run_id = ?', args: [id] })
      ).rows[0];
      if (!intent && (record.status !== 'suspended' || record.expiresAt === null || record.expiresAt > now))
        return null;
      if (
        intent &&
        (!['canceling', 'uncertain'].includes(record.status) ||
          Number(intent.next_attempt) > Date.now() ||
          (intent.lease_until !== null && Number(intent.lease_until) > Date.now()))
      )
        return null;
      const token = randomUUID();
      if (!intent)
        await transaction.execute({ sql: 'INSERT INTO billing_expiry_recovery (run_id) VALUES (?)', args: [id] });
      await transaction.execute({
        sql: 'UPDATE billing_expiry_recovery SET lease_token = ?, lease_until = ? WHERE run_id = ?',
        args: [token, Date.now() + leaseMs, id],
      });
      await transaction.execute({
        sql: "UPDATE billing_workflow_runs SET status = 'canceling', version = version + 1, owner = NULL, expires_at = NULL WHERE id = ? AND version = ?",
        args: [id, record.version],
      });
      return {
        ...(await this.find(transaction, id)),
        expiry: { token, confirmedSuspended: intent?.confirmed_suspended === 1n },
      };
    });
  }
  confirmExpiredSuspension(claim: ExpiryClaim) {
    return this.database.write(
      async transaction =>
        (
          await transaction.execute({
            sql: "UPDATE billing_expiry_recovery SET confirmed_suspended = 1 WHERE run_id = ? AND lease_token = ? AND lease_until > ? AND EXISTS (SELECT 1 FROM billing_workflow_runs w WHERE w.id = run_id AND w.version = ? AND w.status = 'canceling' AND w.owner IS NULL)",
            args: [claim.id, claim.expiry.token, Date.now(), claim.version],
          })
        ).rowsAffected === 1,
    );
  }
  releaseExpiry(claim: ExpiryClaim, retry = true) {
    return this.database.write(async transaction =>
      transaction.execute({
        sql: 'UPDATE billing_expiry_recovery SET lease_token = NULL, lease_until = NULL, next_attempt = ? WHERE run_id = ? AND lease_token = ? AND EXISTS (SELECT 1 FROM billing_workflow_runs w WHERE w.id = run_id AND w.version = ?)',
        args: [retry ? Date.now() + 30000 : 0, claim.id, claim.expiry.token, claim.version],
      }),
    );
  }
}
