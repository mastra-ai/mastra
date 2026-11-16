import type { ArtifactPersistence } from '../contracts/artifacts.js';
import type { Transaction } from '@libsql/client/node';
import type { z } from 'zod';
import { BillingError, parseInput } from '../contracts/core.js';
import type { AdmissionIdentity } from '../runtime/accounting.js';
import type { ExecutionScope } from '../runtime/execution-scope.js';
import { BillingDatabase } from './database.js';

/** Durable artifact claims protected by the current billing execution and identity. */
export class ExecutionArtifacts implements ArtifactPersistence {
  private database: Promise<BillingDatabase> | undefined;
  constructor(private readonly databaseUrl: string) {}
  private async sql<T>(work: (tx: Transaction) => Promise<T>) {
    this.database ??= BillingDatabase.open({ url: this.databaseUrl }).catch(error => {
      this.database = undefined;
      throw error;
    });
    return (await this.database).write(work);
  }
  private async owned(tx: Transaction, identity: AdmissionIdentity) {
    if (identity.validUntil !== null && identity.validUntil <= Date.now()) throw new BillingError('unauthenticated');
    const member = (
      await tx.execute({
        sql: `SELECT i.active FROM memberships m JOIN identities i ON i.id = m.identity_id
      WHERE m.workspace_id = ? AND m.identity_id = ?`,
        args: [identity.workspaceId, identity.actorId],
      })
    ).rows[0];
    if (member?.active !== 1n) throw new BillingError('forbidden');
    if (identity.credentialHash !== null) {
      const credential = (
        await tx.execute({
          sql: 'SELECT active FROM local_credentials WHERE hash = ? AND identity_id = ?',
          args: [identity.credentialHash, identity.actorId],
        })
      ).rows[0];
      if (credential?.active !== 1n) throw new BillingError('unauthenticated');
    }
  }
  private async active(tx: Transaction, scope: ExecutionScope) {
    const { collector } = scope;
    await this.owned(tx, collector.identity);
    const row = (
      await tx.execute({
        sql: `SELECT e.*, r.reserve_state, r.segment_deadline, r.terminal_request FROM billing_executions e
      JOIN billing_remote_operations r ON r.execution_id = e.id WHERE e.id = ?`,
        args: [collector.executionId],
      })
    ).rows[0];
    if (
      !row ||
      row.actor_id !== collector.identity.actorId ||
      row.workspace_id !== collector.identity.workspaceId ||
      row.status !== 'running' ||
      row.recovery_fenced !== 0n ||
      row.reserve_state !== 'reserved' ||
      row.terminal_request !== null ||
      row.segment_deadline === null ||
      Number(row.segment_deadline) <= Date.now()
    )
      throw new BillingError('state_unavailable');
    if (collector.workflowVersion !== undefined) {
      const workflow = (
        await tx.execute({
          sql: 'SELECT version, status FROM billing_workflow_runs WHERE id = ?',
          args: [collector.executionId],
        })
      ).rows[0];
      if (workflow?.version !== BigInt(collector.workflowVersion) || workflow.status !== 'running')
        throw new BillingError('state_unavailable');
    }
    if (!collector.artifactSlots || scope.slot >= collector.artifactSlots) throw new BillingError('conflict');
    return row;
  }

  /** Claim a slot once; uncertain dispatches never authorize another provider call. */
  async claim<T>(scope: ExecutionScope, identity: string, schema: z.ZodType<T>): Promise<T | null> {
    return this.sql(async tx => {
      await this.active(tx, scope);
      const slot = (
        await tx.execute({
          sql: 'SELECT * FROM image_slots WHERE execution_id = ? AND slot = ?',
          args: [scope.collector.executionId, scope.slot],
        })
      ).rows[0];
      if (slot) {
        if (slot.identity !== identity) throw new BillingError('conflict');
        if (slot.state !== 'completed') throw new BillingError('state_unavailable');
        const row = (
          await tx.execute({ sql: 'SELECT metadata FROM image_artifacts WHERE id = ?', args: [slot.artifact_id] })
        ).rows[0];
        if (!row) throw new BillingError('state_unavailable');
        return parseInput(schema, JSON.parse(String(row.metadata)));
      }
      await tx.execute({
        sql: "INSERT INTO image_slots VALUES (?, ?, ?, 'dispatched', NULL)",
        args: [scope.collector.executionId, scope.slot, identity],
      });
      return null;
    });
  }
  /** Publish only while the owning execution, reservation and workflow segment remain active. */
  async complete<T extends { id: string }>(scope: ExecutionScope, metadata: object, schema: z.ZodType<T>): Promise<T> {
    return this.sql(async tx => {
      const execution = await this.active(tx, scope);
      const artifact = parseInput(schema, {
        ...metadata,
        executionId: scope.collector.executionId,
        accountId: execution.account_id,
        workspaceId: scope.collector.identity.workspaceId,
        creatorId: scope.collector.identity.actorId,
      });
      await tx.execute({
        sql: 'INSERT INTO image_artifacts VALUES (?, ?, ?, ?)',
        args: [artifact.id, scope.collector.executionId, scope.slot, JSON.stringify(artifact)],
      });
      const publication = await tx.execute({
        sql: "UPDATE image_slots SET state = 'completed', artifact_id = ? WHERE execution_id = ? AND slot = ? AND state = 'dispatched'",
        args: [artifact.id, scope.collector.executionId, scope.slot],
      });
      if (publication.rowsAffected !== 1) throw new BillingError('state_unavailable');
      return artifact;
    });
  }
  /** Fence a dispatched slot after failure, including a lost response. */
  async uncertain(scope: ExecutionScope): Promise<void> {
    await this.sql(tx =>
      tx.execute({
        sql: "UPDATE image_slots SET state = 'uncertain' WHERE execution_id = ? AND slot = ? AND state = 'dispatched'",
        args: [scope.collector.executionId, scope.slot],
      }),
    );
  }
  /** Resolve a completed slot for the active execution before confirming its output. */
  async completed<T>(scope: ExecutionScope, schema: z.ZodType<T>): Promise<T> {
    return this.sql(async tx => {
      await this.active(tx, scope);
      const row = (
        await tx.execute({
          sql: `SELECT a.metadata FROM image_slots s JOIN image_artifacts a ON a.id = s.artifact_id
        WHERE s.execution_id = ? AND s.slot = ? AND s.state = 'completed'`,
          args: [scope.collector.executionId, scope.slot],
        })
      ).rows[0];
      if (!row) throw new BillingError('state_unavailable');
      return parseInput(schema, JSON.parse(String(row.metadata)));
    });
  }
  /** Authorize downloads against live membership and the positively settled execution. */
  async read<T>(identity: AdmissionIdentity, id: string, schema: z.ZodType<T>): Promise<T> {
    return this.sql(async tx => {
      await this.owned(tx, identity);
      const row = (
        await tx.execute({
          sql: `SELECT a.metadata FROM image_artifacts a JOIN billing_executions e ON e.id = a.execution_id
        WHERE a.id = ? AND e.actor_id = ? AND e.workspace_id = ? AND e.status = 'completed' AND e.settlement IN ('settled', 'not_required')`,
          args: [id, identity.actorId, identity.workspaceId],
        })
      ).rows[0];
      if (!row) throw new BillingError('forbidden');
      return parseInput(schema, JSON.parse(String(row.metadata)));
    });
  }
}
