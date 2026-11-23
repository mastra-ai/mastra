import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { BillingError, parseInput, usageEventSchema } from '../contracts/core.js';
import type { BillingProvider } from '../contracts/provider.js';
import type { UsageDelivery } from '../contracts/core.js';
import { BillingDatabase } from './database.js';
import { finishUnstartedReservation } from './accounting.js';

export const deliveryQueueQuery =
  "SELECT d.*, o.payload FROM billing_delivery d JOIN billing_outbox o ON o.id = d.event_id WHERE d.status IN ('pending', 'retrying', 'uncertain') AND d.next_attempt <= ? AND (d.lease_until IS NULL OR d.lease_until <= ?) ORDER BY d.created_at, d.event_id LIMIT ?";

const bounds = z.strictObject({
  batchSize: z.number().int().min(1).max(100),
  leaseMs: z.number().int().min(100).max(300000),
});
export interface DeliveryClaim {
  readonly id: string;
  readonly token: string;
  readonly payload: string;
  readonly attempts: number;
}
// Persist the schedule; jitter prevents all recovered records retrying in lockstep.
export const retryDelay = (attempts: number) =>
  Math.min(3600000, 1000 * 2 ** Math.min(attempts - 1, 12)) + Math.floor(Math.random() * 250);

function processHasExited(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return false;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'ESRCH';
  }
}

export class RecoveryStorage {
  private recoveryCursor = '';
  private constructor(private readonly database: BillingDatabase) {}
  static async open(options: { url: string }) {
    return new RecoveryStorage(await BillingDatabase.open(options));
  }
  close() {
    this.database.close();
  }

  claimDeliveries(options: { batchSize: number; leaseMs: number }): Promise<DeliveryClaim[]> {
    const { batchSize, leaseMs } = parseInput(bounds, options);
    return this.database.write(async tx => {
      const now = Date.now();
      const rows = (
        await tx.execute({
          sql: deliveryQueueQuery,
          args: [now, now, batchSize],
        })
      ).rows;
      const claims: DeliveryClaim[] = [];
      for (const row of rows) {
        const token = randomUUID();
        await tx.execute({
          sql: 'UPDATE billing_delivery SET lease_token = ?, lease_until = ?, attempts = attempts + 1 WHERE event_id = ?',
          args: [token, now + leaseMs, row.event_id],
        });
        claims.push({
          id: String(row.event_id),
          token,
          payload: String(row.payload),
          attempts: Number(row.attempts) + 1,
        });
      }
      return claims;
    });
  }
  completeDelivery(claim: DeliveryClaim, result: UsageDelivery): Promise<boolean> {
    const accepted = result.status === 'accepted' || result.status === 'duplicate';
    if (accepted && result.eventId !== claim.id) throw new BillingError('conflict');
    const status = accepted
      ? 'accepted'
      : result.status === 'permanent_failure'
        ? 'failed'
        : result.status === 'uncertain'
          ? 'uncertain'
          : 'retrying';
    return this.database.write(async tx => {
      const result = await tx.execute({
        sql: 'UPDATE billing_delivery SET status = ?, next_attempt = ?, lease_token = NULL, lease_until = NULL, last_error = ? WHERE event_id = ? AND lease_token = ? AND lease_until > ?',
        args: [
          status,
          accepted || status === 'failed' ? 0 : Date.now() + retryDelay(claim.attempts),
          accepted ? null : status === 'failed' ? 'provider_rejected' : 'provider_unavailable',
          claim.id,
          claim.token,
          Date.now(),
        ],
      });
      return result.rowsAffected === 1;
    });
  }
  async deliver(provider: BillingProvider, claim: DeliveryClaim) {
    let result: UsageDelivery;
    try {
      result = await provider.reportUsage(parseInput(usageEventSchema, JSON.parse(claim.payload)));
    } catch {
      result = { status: 'uncertain', code: 'provider_unavailable' };
    }
    return this.completeDelivery(claim, result);
  }

  async recoverInterrupted() {
    const candidates = await this.database.write(
      async tx =>
        (
          await tx.execute({
            sql: `SELECT e.id, e.runtime_id, r.pid, w.owner AS workflow_owner, w.version AS workflow_version, o.pid AS workflow_pid, 0 AS orphan
              FROM billing_executions e LEFT JOIN billing_runtimes r ON r.id = e.runtime_id
              LEFT JOIN billing_workflow_runs w ON w.id = e.id LEFT JOIN billing_runtimes o ON o.id = w.owner
              WHERE e.status IN ('running', 'uncertain') AND e.recovery_fenced = 0
              AND (w.status IS NULL OR (w.status <> 'suspended' AND NOT EXISTS (SELECT 1 FROM billing_expiry_recovery x WHERE x.run_id = w.id)))
              AND e.id > ?
              UNION ALL SELECT w.id, w.owner AS runtime_id, r.pid, w.owner, w.version, r.pid, 1 AS orphan
              FROM billing_workflow_runs w LEFT JOIN billing_runtimes r ON r.id = w.owner
              WHERE w.status IN ('running', 'canceling') AND NOT EXISTS (SELECT 1 FROM billing_executions e WHERE e.id = w.id)
              AND NOT EXISTS (SELECT 1 FROM billing_expiry_recovery x WHERE x.run_id = w.id) AND w.id > ? ORDER BY 1 LIMIT 100`,
            args: [this.recoveryCursor, this.recoveryCursor],
          })
        ).rows,
    );
    this.recoveryCursor = candidates.length === 100 ? String(candidates.at(-1)!.id) : '';
    let recovered = 0;
    for (const candidate of candidates) {
      // PID liveness is deliberately conservative. Expired time is never proof
      // of termination; a reused/live PID retains the hold for manual review.
      if (candidate.pid === null || !processHasExited(Number(candidate.pid))) continue;
      if (
        candidate.workflow_pid !== null &&
        candidate.workflow_pid !== candidate.pid &&
        !processHasExited(Number(candidate.workflow_pid))
      )
        continue;
      recovered += await this.database.write(async tx => {
        if (candidate.orphan === 1n)
          return (
            await tx.execute({
              sql: "UPDATE billing_workflow_runs SET status = 'uncertain', version = version + 1, owner = NULL, expires_at = NULL WHERE id = ? AND owner = ? AND status IN ('running', 'canceling') AND NOT EXISTS (SELECT 1 FROM billing_executions e WHERE e.id = billing_workflow_runs.id) AND NOT EXISTS (SELECT 1 FROM billing_expiry_recovery x WHERE x.run_id = billing_workflow_runs.id)",
              args: [candidate.id, candidate.runtime_id],
            })
          ).rowsAffected;
        const current = (
          await tx.execute({
            sql: `SELECT w.status, w.version, w.owner
              FROM billing_executions e LEFT JOIN billing_workflow_runs w ON w.id = e.id
              WHERE e.id = ? AND e.runtime_id = ? AND e.status IN ('running', 'uncertain') AND e.recovery_fenced = 0
              AND (w.status IS NULL OR (w.status <> 'suspended' AND NOT EXISTS (SELECT 1 FROM billing_expiry_recovery x WHERE x.run_id = w.id)))`,
            args: [candidate.id, candidate.runtime_id],
          })
        ).rows[0];
        if (!current || current.owner !== candidate.workflow_owner || current.version !== candidate.workflow_version)
          return 0;
        // Positive reservation evidence and the absence of a native handoff
        // prove this initial attempt can release. The original driver settles
        // it through ordinary financial recovery outside this transaction.
        const unstarted =
          current.status === 'running' &&
          current.version === 1n &&
          candidate.workflow_pid !== null &&
          (await finishUnstartedReservation(tx, String(candidate.id), 'failed'));
        if (!unstarted)
          await tx.execute({
            sql: "UPDATE billing_executions SET status = 'uncertain', settlement = CASE WHEN settlement = 'reserved' THEN 'uncertain' ELSE settlement END, recovery_fenced = 1 WHERE id = ?",
            args: [candidate.id],
          });
        await tx.execute({
          sql: "UPDATE billing_workflow_runs SET status = ?, version = version + 1, owner = NULL, expires_at = NULL WHERE id = ? AND status IN ('running', 'canceling')",
          args: [unstarted ? 'failed' : 'uncertain', candidate.id],
        });
        return 1;
      });
    }
    return recovered;
  }
  metrics() {
    return this.database.write(async tx => {
      const deliveries = (
        await tx.execute(
          'SELECT status, COUNT(*) AS count, MIN(created_at) AS oldest FROM billing_delivery GROUP BY status',
        )
      ).rows;
      return {
        deliveries: deliveries.map(row => ({
          status: String(row.status),
          count: Number(row.count),
          oldestAgeMs: Date.now() - Number(row.oldest),
        })),
      };
    });
  }
}
