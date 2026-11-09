import { createHash, randomUUID } from 'node:crypto';
import type { Transaction } from '@libsql/client/node';
import { BillingError, usageEventSchema } from '../contracts.js';
import type { ProviderAccount } from '../contracts.js';
import type { DriverObservation } from '../driver.js';
import { BillingDatabase } from './database.js';
import { accountFromRow } from './accounts.js';
// Each process registers its own immutable identity before committing a dispatch.
const runtimeId = randomUUID();
const opaqueId = (value: string) => createHash('sha256').update(value).digest('hex');

export async function isRetired(tx: Transaction, accountId: string, provider: string) {
  return (
    (
      await tx.execute({
        sql: 'SELECT state FROM billing_provider_lifecycle WHERE account_id = ? AND provider = ? ORDER BY id DESC LIMIT 1',
        args: [accountId, provider],
      })
    ).rows[0]?.state === 'retired'
  );
}
export async function reactivateProvider(tx: Transaction, accountId: string, provider: string, evidence: string) {
  if (await isRetired(tx, accountId, provider))
    await tx.execute({
      sql: "INSERT INTO billing_provider_lifecycle (account_id, provider, state, evidence, created_at) VALUES (?, ?, 'reactivated', ?, ?)",
      args: [accountId, provider, evidence, Date.now()],
    });
}
export async function requireLiveProvider(tx: Transaction, account: ProviderAccount, active = false) {
  const row = (await tx.execute({ sql: 'SELECT * FROM billing_accounts WHERE id = ?', args: [account.id] })).rows[0];
  const link = (
    await tx.execute({
      sql: 'SELECT external_reference FROM billing_provider_links WHERE account_id = ? AND provider = ?',
      args: [account.id, account.provider],
    })
  ).rows[0];
  if (
    !row ||
    !link ||
    row.workspace_id !== account.workspaceId ||
    link.external_reference !== account.externalReference ||
    (active && accountFromRow(row).provider !== account.provider) ||
    (await isRetired(tx, account.id, account.provider))
  )
    throw new BillingError('conflict');
}

export class ProviderLifecycleStorage {
  constructor(private readonly database: BillingDatabase) {}
  candidate(workspaceId: string, activeProvider: string, provider: string) {
    return this.database.write(async tx => {
      const row = (
        await tx.execute({
          sql: 'SELECT a.*, c.version, s.generation, s.synchronized_generation FROM billing_accounts a JOIN commercial_state c ON c.account_id = a.id LEFT JOIN billing_account_sync s ON s.account_id = a.id WHERE a.workspace_id = ?',
          args: [workspaceId],
        })
      ).rows[0];
      if (
        !row ||
        accountFromRow(row).provider !== activeProvider ||
        provider === activeProvider ||
        provider === 'local'
      )
        throw new BillingError('conflict');
      const link = (
        await tx.execute({
          sql: 'SELECT * FROM billing_provider_links WHERE account_id = ? AND provider = ?',
          args: [row.id, provider],
        })
      ).rows[0];
      if (!link || (await isRetired(tx, String(row.id), provider))) throw new BillingError('conflict');
      return {
        account: { ...accountFromRow(row), provider },
        activeProvider,
        revision: String(row.version),
        generation: String(row.generation ?? 0n),
        synchronizedGeneration: String(row.synchronized_generation ?? 0n),
        sourceKeyMode: String(link.source_key_mode),
        startedAt: Date.now(),
        link: {
          customerId: String(link.customer_id),
          organizationId: String(link.organization_id),
          externalReference: String(link.external_reference),
        },
      };
    });
  }
  retire(
    candidate: Awaited<ReturnType<ProviderLifecycleStorage['candidate']>>,
    observation: DriverObservation,
    evidence: string,
  ) {
    return this.database.write(async tx => {
      const { account } = candidate;
      await requireLiveProvider(tx, account);
      const state = (
        await tx.execute({
          sql: 'SELECT a.*, c.version, s.generation, s.synchronized_generation FROM billing_accounts a JOIN commercial_state c ON c.account_id = a.id LEFT JOIN billing_account_sync s ON s.account_id = a.id WHERE a.id = ?',
          args: [account.id],
        })
      ).rows[0];
      if (
        accountFromRow(state).provider !== candidate.activeProvider ||
        String(state.version) !== candidate.revision ||
        String(state.generation ?? 0n) !== candidate.generation ||
        String(state.synchronized_generation ?? 0n) !== candidate.synchronizedGeneration ||
        Date.now() - candidate.startedAt >= 60000
      )
        throw new BillingError('conflict');
      const now = Date.now();
      if (
        [...observation.commercial.entitlements, ...observation.commercial.subscriptions].some(
          grant => grant.validUntil === null || Date.parse(grant.validUntil) > now,
        ) ||
        observation.commercial.meters.some(
          meter => meter.funding === 'metered' && (meter.periodEnd === null || Date.parse(meter.periodEnd) > now),
        )
      )
        throw new BillingError('conflict');
      const retained = (
        await tx.execute({
          sql: 'SELECT g.* FROM credit_grants g JOIN billing_source_owners o ON o.account_id = g.account_id AND o.source_key = g.source_key WHERE g.account_id = ? AND o.provider = ?',
          args: [account.id, account.provider],
        })
      ).rows;
      const sources = new Map(
        observation.sources.map(({ source }) => [
          candidate.sourceKeyMode === 'legacy' ? source.key : opaqueId(JSON.stringify([account.provider, source.key])),
          source,
        ]),
      );
      for (const [key, source] of sources) {
        const prior = retained.find(row => row.source_key === key);
        if (
          prior &&
          (prior.fingerprint !== source.fingerprint ||
            prior.provenance !== source.provenance ||
            prior.meter !== source.meter ||
            prior.kind !== source.kind ||
            Number(prior.original_units) !== source.units ||
            prior.valid_from !== source.validFrom ||
            (prior.kind === 'order' && prior.valid_until !== source.validUntil))
        )
          throw new BillingError('conflict');
        if (
          source.active &&
          (source.validUntil === null || Date.parse(source.validUntil) > now) &&
          (!prior || Number(prior.consumed_units) < source.units)
        )
          throw new BillingError('conflict');
      }
      for (const row of retained)
        if (
          !sources.has(String(row.source_key)) &&
          Number(row.consumed_units) < Number(row.original_units) &&
          (row.valid_until === null || Date.parse(String(row.valid_until)) > now)
        )
          throw new BillingError('conflict');
      await this.recoverAcknowledgedUsage(tx, account.id, account.provider);
      // Account-wide uncertain activity is deliberately conservative: an active
      // provider execution can still hold a historical provider's grant.
      const blockers = await tx.execute({
        sql: `SELECT 1 FROM billing_executions WHERE account_id = ? AND (status IN ('running', 'uncertain') OR settlement IN ('reserved', 'pending', 'uncertain'))
        UNION ALL SELECT 1 FROM billing_workflow_runs WHERE workspace_id = ? AND status IN ('running', 'suspended', 'canceling', 'uncertain')
        UNION ALL SELECT 1 FROM billing_reservations WHERE account_id = ? AND active = 1
        UNION ALL SELECT 1 FROM grant_allocations a JOIN credit_grants g ON g.id = a.grant_id WHERE g.account_id = ? AND a.committed_units IS NULL
        UNION ALL SELECT 1 FROM billing_external_effects WHERE account_id = ? AND provider = ? AND state <> 'complete'
        UNION ALL SELECT 1 FROM billing_outbox o JOIN billing_executions e ON e.id = o.execution_id LEFT JOIN billing_delivery d ON d.event_id = o.id LEFT JOIN provider_usage u ON u.id = o.id WHERE e.account_id = ? AND json_extract(o.payload, '$.account.provider') = ? AND (d.status = 'failed' OR (d.lease_until IS NOT NULL AND d.lease_until > ?) OR (COALESCE(d.status, '') <> 'accepted' AND COALESCE(u.delivered, 0) <> 1))
        UNION ALL SELECT 1 FROM provider_usage u LEFT JOIN billing_usage_events v ON v.id = u.id LEFT JOIN billing_outbox o ON o.id = u.id WHERE u.account_id = ? AND u.delivered = 0 AND (COALESCE(json_extract(v.payload, '$.account.provider'), json_extract(o.payload, '$.account.provider')) = ? OR (v.id IS NULL AND o.id IS NULL))
        UNION ALL SELECT 1 FROM hosted_operations WHERE workspace_id = ? AND dispatch_state = 'dispatched' AND url IS NULL LIMIT 1`,
        args: [
          account.id,
          account.workspaceId,
          account.id,
          account.id,
          account.id,
          account.provider,
          account.id,
          account.provider,
          now,
          account.id,
          account.provider,
          account.workspaceId,
        ],
      });
      if (blockers.rows.length) throw new BillingError('conflict');
      await tx.execute({
        sql: "INSERT INTO billing_provider_lifecycle (account_id, provider, state, evidence, created_at) VALUES (?, ?, 'retired', ?, ?)",
        args: [
          account.id,
          account.provider,
          JSON.stringify({
            reference: evidence,
            externalSalesClosed: true,
            activeProvider: candidate.activeProvider,
            revision: candidate.revision,
            generation: candidate.generation,
            synchronizedGeneration: candidate.synchronizedGeneration,
          }),
          now,
        ],
      });
      await tx.execute({
        sql: 'UPDATE credit_grants SET available = 0 WHERE account_id = ? AND source_key IN (SELECT source_key FROM billing_source_owners WHERE account_id = ? AND provider = ?)',
        args: [account.id, account.id, account.provider],
      });
      await tx.execute({
        sql: 'UPDATE commercial_state SET version = version + 1 WHERE account_id = ?',
        args: [account.id],
      });
      await tx.execute({
        sql: 'INSERT INTO billing_account_sync (account_id, generation) VALUES (?, 1) ON CONFLICT(account_id) DO UPDATE SET generation = generation + 1',
        args: [account.id],
      });
    });
  }
  beginEffect(account: ProviderAccount, kind: 'usage' | 'checkout' | 'portal', externalKey: string, active = false) {
    return this.database.write(tx => this.beginEffectInTransaction(tx, account, kind, externalKey, active));
  }
  async beginEffectInTransaction(
    tx: Transaction,
    account: ProviderAccount,
    kind: 'usage' | 'checkout' | 'portal',
    externalKey: string,
    active = false,
  ) {
    await requireLiveProvider(tx, account, active);
    const id = randomUUID();
    await tx.execute({
      sql: "INSERT INTO billing_external_effects VALUES (?, ?, ?, ?, ?, 'pending')",
      args: [id, account.id, account.provider, kind, externalKey],
    });
    await tx.execute({
      sql: 'INSERT INTO billing_runtimes VALUES (?, ?) ON CONFLICT DO NOTHING',
      args: [runtimeId, process.pid],
    });
    await tx.execute({
      sql: 'INSERT INTO billing_external_effect_owners VALUES (?, ?)',
      args: [id, runtimeId],
    });
    return id;
  }
  // An ACK resolves the logical event, but a live sender can still POST after
  // retirement. Only proven-dead owners may release an unfinished dispatch.
  async recoverAcknowledgedUsage(tx: Transaction, accountId: string, provider: string, eventId?: string) {
    const candidates = (
      await tx.execute({
        sql: `SELECT e.id, e.external_key, r.pid, v.payload AS event, o.payload AS outbox
        FROM billing_external_effects e
        JOIN billing_external_effect_owners owner ON owner.effect_id = e.id
        JOIN billing_runtimes r ON r.id = owner.runtime_id
        JOIN provider_usage u ON u.id = e.external_key AND u.account_id = e.account_id AND u.delivered = 1
        LEFT JOIN billing_usage_events v ON v.id = u.id
        LEFT JOIN billing_outbox o ON o.id = u.id
        WHERE e.account_id = ? AND e.provider = ? AND e.kind = 'usage' AND e.state = 'pending'
        AND (? IS NULL OR e.external_key = ?)`,
        args: [accountId, provider, eventId ?? null, eventId ?? null],
      })
    ).rows;
    for (const candidate of candidates) {
      const payload = candidate.event ?? candidate.outbox;
      if (payload === null) continue;
      let original;
      try {
        original = usageEventSchema.safeParse(JSON.parse(String(payload)));
      } catch {
        continue;
      }
      if (
        !original.success ||
        original.data.id !== candidate.external_key ||
        original.data.account.id !== accountId ||
        original.data.account.provider !== provider
      )
        continue;
      if (candidate.event !== null && candidate.outbox !== null && candidate.event !== candidate.outbox) continue;
      // No TTL: EPERM, reused/live PIDs and unknown ownership stay fenced.
      try {
        process.kill(Number(candidate.pid), 0);
        continue;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ESRCH') continue;
      }
      await tx.execute({
        sql: "UPDATE billing_external_effects SET state = 'complete' WHERE id = ? AND state = 'pending'",
        args: [candidate.id],
      });
    }
  }
  finishEffect(id: string, complete: boolean) {
    return this.database.write(tx => this.finishEffectInTransaction(tx, id, complete));
  }
  async finishEffectInTransaction(tx: Transaction, id: string, complete: boolean) {
    await tx.execute({
      sql: `UPDATE billing_external_effects SET state = CASE WHEN ? = 1 OR (kind = 'usage' AND EXISTS (SELECT 1 FROM provider_usage u WHERE u.id = billing_external_effects.external_key AND u.account_id = billing_external_effects.account_id AND u.delivered = 1)) THEN 'complete' ELSE 'uncertain' END WHERE id = ? AND state <> 'complete'`,
      args: [complete ? 1 : 0, id],
    });
    if (complete)
      await tx.execute({
        sql: "UPDATE billing_external_effects SET state = 'complete' WHERE state = 'uncertain' AND kind = 'usage' AND (account_id, provider, external_key) IN (SELECT account_id, provider, external_key FROM billing_external_effects WHERE id = ?)",
        args: [id],
      });
  }
}
