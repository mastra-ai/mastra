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

export class WorkflowStorage {
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
  overdue(now = Date.now()) {
    return this.database.write(async transaction =>
      (
        await transaction.execute({
          sql: "SELECT * FROM billing_workflow_runs WHERE status = 'suspended' AND expires_at <= ? ORDER BY expires_at LIMIT 100",
          args: [now],
        })
      ).rows.map(decode),
    );
  }
  claimExpiry(id: string, now = Date.now()) {
    return this.database.write(async transaction => {
      const record = await this.find(transaction, id);
      if (record.status !== 'suspended' || record.expiresAt === null || record.expiresAt > now) return null;
      await transaction.execute({
        sql: "UPDATE billing_workflow_runs SET status = 'canceling', version = version + 1, owner = NULL, expires_at = NULL WHERE id = ? AND version = ? AND status = 'suspended'",
        args: [id, record.version],
      });
      return this.find(transaction, id);
    });
  }
}
