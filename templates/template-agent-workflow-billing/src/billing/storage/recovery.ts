import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { BillingError, parseInput, usageEventSchema, identifierSchema, timestampSchema } from '../contracts.js';
import type { BillingProvider, ProviderAccount, ProviderNotification, UsageDelivery } from '../contracts.js';
import { BillingDatabase } from './database.js';
import { accountFromRow } from './accounts.js';

const bounds = z.strictObject({
  batchSize: z.number().int().min(1).max(100),
  leaseMs: z.number().int().min(100).max(300000),
});
const notificationSchema = z.strictObject({
  id: identifierSchema,
  digest: z.string().regex(/^[a-f0-9]{64}$/),
  type: z.string().min(1).max(128),
  accountReference: z.string().min(1).max(256).nullable(),
  occurredAt: timestampSchema,
});
export interface DeliveryClaim {
  readonly id: string;
  readonly token: string;
  readonly payload: string;
  readonly attempts: number;
}
export interface SynchronizationClaim {
  readonly account: ProviderAccount;
  readonly token: string;
  readonly attempts: number;
}
// Persist the schedule; jitter prevents all recovered records retrying in lockstep.
export const retryDelay = (attempts: number) =>
  Math.min(3600000, 1000 * 2 ** Math.min(attempts - 1, 12)) + Math.floor(Math.random() * 250);

export class RecoveryStorage {
  private recoveryCursor = '';
  private constructor(private readonly database: BillingDatabase) {}
  static async open(options: { url: string }) {
    return new RecoveryStorage(await BillingDatabase.open(options));
  }
  close() {
    this.database.close();
  }

  enqueue(input: Exclude<ProviderNotification, { status: 'unsupported' }>, provider: string) {
    parseInput(identifierSchema, provider);
    const notification = parseInput(notificationSchema, {
      id: input.id,
      digest: input.digest,
      type: input.type,
      accountReference: input.accountReference,
      occurredAt: input.occurredAt,
    });
    return this.database.write(async tx => {
      const previous = (
        await tx.execute({
          sql: 'SELECT digest FROM billing_inbox WHERE id = ? AND provider = ?',
          args: [notification.id, provider],
        })
      ).rows[0];
      if (previous) {
        if (previous.digest !== notification.digest) throw new BillingError('conflict');
        return { duplicate: true };
      }
      const accounts =
        notification.accountReference === null
          ? []
          : (
              await tx.execute({
                sql: 'SELECT a.id FROM billing_accounts a JOIN billing_provider_links p ON p.account_id = a.id WHERE p.provider = ? AND (p.customer_id = ? OR p.external_reference = ?) LIMIT 2',
                args: [provider, notification.accountReference, notification.accountReference],
              })
            ).rows;
      if (accounts.length > 1) throw new BillingError('conflict');
      const account = accounts[0];
      let generation: bigint | null = null;
      if (account) {
        await tx.execute({
          sql: 'INSERT INTO billing_account_sync (account_id) VALUES (?) ON CONFLICT DO NOTHING',
          args: [account.id],
        });
        await tx.execute({
          sql: 'UPDATE billing_account_sync SET generation = generation + 1, next_attempt = 0 WHERE account_id = ?',
          args: [account.id],
        });
        generation = (
          await tx.execute({
            sql: 'SELECT generation FROM billing_account_sync WHERE account_id = ?',
            args: [account.id],
          })
        ).rows[0].generation as bigint;
        // An earlier source read can no longer apply or authorize admission.
        await tx.execute({
          sql: 'UPDATE commercial_state SET version = version + 1 WHERE account_id = ?',
          args: [account.id],
        });
      }
      await tx.execute({
        sql: 'INSERT INTO billing_inbox VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        args: [
          notification.id,
          notification.digest,
          notification.type,
          account?.id ?? null,
          notification.occurredAt,
          Date.now(),
          generation,
          account ? 'pending' : 'ignored',
          provider,
        ],
      });
      return { duplicate: false };
    });
  }

  claimDeliveries(options: { batchSize: number; leaseMs: number }): Promise<DeliveryClaim[]> {
    const { batchSize, leaseMs } = parseInput(bounds, options);
    return this.database.write(async tx => {
      const now = Date.now();
      const rows = (
        await tx.execute({
          sql: "SELECT d.*, o.payload FROM billing_delivery d JOIN billing_outbox o ON o.id = d.event_id WHERE d.status IN ('pending', 'retrying', 'uncertain') AND d.next_attempt <= ? AND (d.lease_until IS NULL OR d.lease_until <= ?) ORDER BY d.created_at, d.event_id LIMIT ?",
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
  claimSynchronizations(options: { batchSize: number; leaseMs: number }): Promise<SynchronizationClaim[]> {
    const { batchSize, leaseMs } = parseInput(bounds, options);
    return this.database.write(async tx => {
      const now = Date.now();
      const rows = (
        await tx.execute({
          sql: 'SELECT a.*, s.attempts FROM billing_account_sync s JOIN billing_accounts a ON a.id = s.account_id WHERE s.generation > s.synchronized_generation AND s.next_attempt <= ? AND (s.lease_until IS NULL OR s.lease_until <= ?) ORDER BY s.next_attempt, a.id LIMIT ?',
          args: [now, now, batchSize],
        })
      ).rows;
      const claims: SynchronizationClaim[] = [];
      for (const row of rows) {
        const token = randomUUID();
        await tx.execute({
          sql: 'UPDATE billing_account_sync SET lease_token = ?, lease_until = ?, attempts = attempts + 1 WHERE account_id = ?',
          args: [token, now + leaseMs, row.id],
        });
        claims.push({ account: accountFromRow(row), token, attempts: Number(row.attempts) + 1 });
      }
      return claims;
    });
  }
  completeSynchronization(claim: SynchronizationClaim, success: boolean) {
    return this.database.write(
      async tx =>
        (
          await tx.execute({
            sql: 'UPDATE billing_account_sync SET lease_token = NULL, lease_until = NULL, next_attempt = ?, last_error = ? WHERE account_id = ? AND lease_token = ? AND lease_until > ?',
            args: [
              success ? 0 : Date.now() + retryDelay(claim.attempts),
              success ? null : 'source_unavailable',
              claim.account.id,
              claim.token,
              Date.now(),
            ],
          })
        ).rowsAffected === 1,
    );
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
            sql: `SELECT e.id, e.runtime_id, r.pid, 0 AS orphan FROM billing_executions e LEFT JOIN billing_runtimes r ON r.id = e.runtime_id WHERE e.status IN ('running', 'uncertain') AND e.recovery_fenced = 0 AND NOT EXISTS (SELECT 1 FROM billing_workflow_runs w WHERE w.id = e.id AND (w.status = 'suspended' OR EXISTS (SELECT 1 FROM billing_expiry_recovery x WHERE x.run_id = w.id))) AND e.id > ?
              UNION ALL SELECT w.id, w.owner AS runtime_id, r.pid, 1 AS orphan FROM billing_workflow_runs w LEFT JOIN billing_runtimes r ON r.id = w.owner WHERE w.status IN ('running', 'canceling') AND NOT EXISTS (SELECT 1 FROM billing_executions e WHERE e.id = w.id) AND NOT EXISTS (SELECT 1 FROM billing_expiry_recovery x WHERE x.run_id = w.id) AND w.id > ? ORDER BY 1 LIMIT 100`,
            args: [this.recoveryCursor, this.recoveryCursor],
          })
        ).rows,
    );
    this.recoveryCursor = candidates.length === 100 ? String(candidates.at(-1)!.id) : '';
    let recovered = 0;
    for (const candidate of candidates) {
      // PID liveness is deliberately conservative. Expired time is never proof
      // of termination; a reused/live PID retains the hold for manual review.
      if (candidate.pid === null) continue;
      try {
        process.kill(Number(candidate.pid), 0);
        continue;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ESRCH') continue;
      }
      recovered += await this.database.write(async tx => {
        if (candidate.orphan === 1n)
          return (
            await tx.execute({
              sql: "UPDATE billing_workflow_runs SET status = 'uncertain', version = version + 1, owner = NULL, expires_at = NULL WHERE id = ? AND owner = ? AND status IN ('running', 'canceling') AND NOT EXISTS (SELECT 1 FROM billing_executions e WHERE e.id = billing_workflow_runs.id) AND NOT EXISTS (SELECT 1 FROM billing_expiry_recovery x WHERE x.run_id = billing_workflow_runs.id)",
              args: [candidate.id, candidate.runtime_id],
            })
          ).rowsAffected;
        const changed = await tx.execute({
          sql: "UPDATE billing_executions SET status = 'uncertain', settlement = CASE WHEN settlement = 'reserved' THEN 'uncertain' ELSE settlement END, recovery_fenced = 1 WHERE id = ? AND runtime_id = ? AND status IN ('running', 'uncertain') AND recovery_fenced = 0 AND NOT EXISTS (SELECT 1 FROM billing_workflow_runs w WHERE w.id = billing_executions.id AND (w.status = 'suspended' OR EXISTS (SELECT 1 FROM billing_expiry_recovery x WHERE x.run_id = w.id)))",
          args: [candidate.id, candidate.runtime_id],
        });
        if (changed.rowsAffected)
          await tx.execute({
            sql: "UPDATE billing_workflow_runs SET status = 'uncertain', version = version + 1, owner = NULL, expires_at = NULL WHERE id = ? AND status IN ('running', 'canceling')",
            args: [candidate.id],
          });
        return changed.rowsAffected;
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
      const inbox = (
        await tx.execute(
          'SELECT status, COUNT(*) AS count, MIN(received_at) AS oldest FROM billing_inbox GROUP BY status',
        )
      ).rows;
      return {
        deliveries: deliveries.map(row => ({
          status: String(row.status),
          count: Number(row.count),
          oldestAgeMs: Date.now() - Number(row.oldest),
        })),
        inbox: inbox.map(row => ({
          status: String(row.status),
          count: Number(row.count),
          oldestAgeMs: Date.now() - Number(row.oldest),
        })),
      };
    });
  }
}
