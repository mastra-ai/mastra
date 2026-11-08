import { createHash, randomUUID } from 'node:crypto';
import type { Transaction } from '@libsql/client/node';
import { z } from 'zod';
import { BillingError, accountSchema, grantSourceSchema } from '../contracts.js';
import type { CommercialSnapshot, ProviderAccount, GrantSource } from '../contracts.js';
import { BillingDatabase } from './database.js';
import { accountFromRow } from './accounts.js';
import type { ExternalAccount } from '../driver.js';

export const opaqueId = (value: string) => createHash('sha256').update(value).digest('hex');
const integer = (value: bigint) => {
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) throw new BillingError('state_unavailable');
  return Number(value);
};

export class GrantStorage {
  private constructor(private readonly database: BillingDatabase) {}
  static async open(options: { url: string }) {
    return new GrantStorage(await BillingDatabase.open(options));
  }
  close() {
    this.database.close();
  }

  async link(
    workspaceId: string,
    provider: string,
    external: ExternalAccount,
    legacySourceKeys = false,
    replacement?: { expectedProvider: string },
  ): Promise<ProviderAccount> {
    return this.database.write(async tx => {
      let row = (
        await tx.execute({ sql: 'SELECT * FROM billing_accounts WHERE workspace_id = ?', args: [workspaceId] })
      ).rows[0];
      if (!row) {
        if (replacement) throw new BillingError('conflict');
        const id = randomUUID();
        await tx.execute({
          sql: "INSERT INTO billing_accounts (id, workspace_id, provider, external_reference, effective_provider, active_provider) VALUES (?, ?, 'local', ?, 'local', ?)",
          args: [id, workspaceId, external.externalReference, provider],
        });
        await tx.execute({ sql: 'INSERT INTO commercial_state (account_id, version) VALUES (?, 0)', args: [id] });
        row = (await tx.execute({ sql: 'SELECT * FROM billing_accounts WHERE id = ?', args: [id] })).rows[0];
      }
      const current = accountFromRow(row);
      if (
        current.externalReference !== external.externalReference ||
        current.provider === 'local' ||
        (replacement ? current.provider !== replacement.expectedProvider : current.provider !== provider)
      )
        throw new BillingError('conflict');
      const existing = (
        await tx.execute({
          sql: 'SELECT * FROM billing_provider_links WHERE account_id = ? AND provider = ?',
          args: [current.id, provider],
        })
      ).rows[0];
      if (
        existing &&
        (existing.customer_id !== external.customerId ||
          existing.organization_id !== external.organizationId ||
          existing.external_reference !== external.externalReference ||
          existing.source_key_mode !== (legacySourceKeys ? 'legacy' : 'namespaced'))
      )
        throw new BillingError('conflict');
      if (!existing) {
        await tx.execute({
          sql: 'INSERT INTO billing_provider_links VALUES (?, ?, ?, ?, ?, ?)',
          args: [
            current.id,
            provider,
            external.customerId,
            external.organizationId,
            external.externalReference,
            legacySourceKeys ? 'legacy' : 'namespaced',
          ],
        });
      }
      if (replacement) {
        await tx.execute({
          sql: 'UPDATE billing_accounts SET active_provider = ? WHERE id = ?',
          args: [provider, current.id],
        });
        await tx.execute({
          sql: 'UPDATE commercial_state SET version = version + 1 WHERE account_id = ?',
          args: [current.id],
        });
        await tx.execute({
          sql: 'UPDATE billing_account_sync SET generation = generation + 1 WHERE account_id = ?',
          args: [current.id],
        });
      }
      return { ...current, provider };
    });
  }

  links(account: ProviderAccount, activeProvider = account.provider) {
    return this.database.write(async tx => {
      const row = (await tx.execute({ sql: 'SELECT * FROM billing_accounts WHERE id = ?', args: [account.id] }))
        .rows[0];
      const parsed = accountSchema.parse(account);
      const linked = (
        await tx.execute({
          sql: 'SELECT external_reference FROM billing_provider_links WHERE account_id = ? AND provider = ?',
          args: [parsed.id, parsed.provider],
        })
      ).rows[0];
      if (
        !row ||
        !linked ||
        accountFromRow(row).provider !== activeProvider ||
        row.workspace_id !== parsed.workspaceId ||
        row.external_reference !== parsed.externalReference ||
        linked.external_reference !== parsed.externalReference
      )
        throw new BillingError('conflict');
      return (
        await tx.execute({
          sql: 'SELECT * FROM billing_provider_links WHERE account_id = ? ORDER BY provider',
          args: [account.id],
        })
      ).rows.map(link => ({
        provider: String(link.provider),
        sourceKeyMode: String(link.source_key_mode),
        customerId: String(link.customer_id),
        organizationId: String(link.organization_id),
        externalReference: String(link.external_reference),
      }));
    });
  }

  observation(account: ProviderAccount) {
    return this.database.write(async tx => {
      const row = (await tx.execute({ sql: 'SELECT * FROM billing_accounts WHERE id = ?', args: [account.id] }))
        .rows[0];
      const link = (
        await tx.execute({
          sql: 'SELECT * FROM billing_provider_links WHERE account_id = ? AND provider = ?',
          args: [account.id, account.provider],
        })
      ).rows[0];
      if (
        !row ||
        !link ||
        row.workspace_id !== account.workspaceId ||
        link.external_reference !== account.externalReference
      )
        throw new BillingError('conflict');
      const state = (
        await tx.execute({ sql: 'SELECT version FROM commercial_state WHERE account_id = ?', args: [account.id] })
      ).rows[0];
      return {
        customerId: String(link.customer_id),
        organizationId: String(link.organization_id),
        externalReference: String(link.external_reference),
        revision: String(state.version),
      };
    });
  }

  async beginRefresh(account: ProviderAccount, synchronization?: { token: string }) {
    const observation = await this.observation(account);
    return this.database.write(async tx => {
      await tx.execute({
        sql: 'INSERT INTO billing_account_sync (account_id) VALUES (?) ON CONFLICT DO NOTHING',
        args: [account.id],
      });
      const state = (
        await tx.execute({
          sql: 'SELECT s.*, c.version FROM billing_account_sync s JOIN commercial_state c ON c.account_id = s.account_id WHERE s.account_id = ?',
          args: [account.id],
        })
      ).rows[0];
      if (synchronization && (state.lease_token !== synchronization.token || Number(state.lease_until) <= Date.now()))
        throw new BillingError('state_unavailable');
      const token = randomUUID();
      await tx.execute({ sql: 'DELETE FROM billing_refresh_leases WHERE expires_at <= ?', args: [Date.now()] });
      await tx.execute({
        sql: 'INSERT INTO billing_refresh_leases VALUES (?, ?, ?, ?, ?)',
        args: [token, account.id, state.generation, String(state.version), Date.now() + 60000],
      });
      return {
        ...observation,
        revision: String(state.version),
        generation: String(state.generation),
        token,
        synchronization,
      };
    });
  }

  async apply(
    account: ProviderAccount,
    revision: string,
    sources: readonly GrantSource[],
    commercial: Pick<CommercialSnapshot, 'entitlements' | 'subscriptions' | 'meters'>,
    observation?: { generation: string; token: string; synchronization?: { token: string } },
    owners: ReadonlyMap<string, string> = new Map(),
  ): Promise<CommercialSnapshot | null> {
    const parsed = z
      .array(grantSourceSchema)
      .max(10000)
      .refine(values => new Set(values.map(value => value.key)).size === values.length)
      .safeParse(sources);
    if (!parsed.success) throw new BillingError('state_unavailable');
    return this.database.write(async tx => {
      const state = (
        await tx.execute({ sql: 'SELECT version FROM commercial_state WHERE account_id = ?', args: [account.id] })
      ).rows[0];
      if (String(state.version) !== revision) return null;
      if (observation) {
        const lease = (
          await tx.execute({
            sql: 'SELECT l.*, s.generation AS current_generation, s.lease_token AS worker_token, s.lease_until AS worker_until FROM billing_refresh_leases l JOIN billing_account_sync s ON s.account_id = l.account_id WHERE l.token = ? AND l.account_id = ?',
            args: [observation.token, account.id],
          })
        ).rows[0];
        if (
          !lease ||
          String(lease.generation) !== observation.generation ||
          String(lease.current_generation) !== observation.generation ||
          lease.revision !== revision ||
          Number(lease.expires_at) <= Date.now() ||
          (observation.synchronization &&
            (lease.worker_token !== observation.synchronization.token || Number(lease.worker_until) <= Date.now()))
        )
          return null;
      }

      const now = Date.now();
      // Missing sources are unavailable. Complete reads must reverify every known
      // purchase/current period; absence never restores or invents capacity.
      await tx.execute({ sql: 'UPDATE credit_grants SET available = 0 WHERE account_id = ?', args: [account.id] });
      for (const source of parsed.data) {
        const previous = (
          await tx.execute({
            sql: 'SELECT * FROM credit_grants WHERE account_id = ? AND source_key = ?',
            args: [account.id, source.key],
          })
        ).rows[0];
        const owner = owners.get(source.key);
        if (!owner) throw new BillingError('conflict');
        const priorOwner = (
          await tx.execute({
            sql: 'SELECT provider FROM billing_source_owners WHERE account_id = ? AND source_key = ?',
            args: [account.id, source.key],
          })
        ).rows[0];
        if (
          previous &&
          (previous.fingerprint !== source.fingerprint ||
            priorOwner?.provider !== owner ||
            previous.provenance !== source.provenance ||
            previous.meter !== source.meter ||
            previous.kind !== source.kind ||
            Number(previous.original_units) !== source.units ||
            previous.valid_from !== source.validFrom ||
            (previous.kind === 'order' && previous.valid_until !== source.validUntil))
        )
          throw new BillingError('conflict');
        const active =
          source.active &&
          Date.parse(source.validFrom) <= now &&
          (source.validUntil === null || Date.parse(source.validUntil) > now);
        if (!previous && !active) continue;
        if (!previous)
          await tx.execute({
            sql: 'INSERT INTO credit_grants (id, account_id, source_key, meter, kind, fingerprint, provenance, original_units, valid_from, valid_until, available) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            args: [
              opaqueId(`${account.id}:${source.key}`),
              account.id,
              source.key,
              source.meter,
              source.kind,
              source.fingerprint,
              source.provenance,
              source.units,
              source.validFrom,
              source.validUntil,
              active ? 1 : 0,
            ],
          });
        if (!previous)
          await tx.execute({
            sql: 'INSERT INTO billing_source_owners VALUES (?, ?, ?)',
            args: [account.id, source.key, owner],
          });
        else
          await tx.execute({
            sql: 'UPDATE credit_grants SET valid_until = ?, available = ? WHERE id = ?',
            args: [source.validUntil, active ? 1 : 0, previous.id],
          });
      }
      await tx.execute({ sql: 'DELETE FROM commercial_grants WHERE account_id = ?', args: [account.id] });
      for (const [kind, values] of [
        ['entitlement', commercial.entitlements],
        ['subscription', commercial.subscriptions],
      ] as const)
        for (const value of values)
          await tx.execute({
            sql: 'INSERT INTO commercial_grants VALUES (?, ?, ?, ?, ?)',
            args: [account.id, kind, value.key, value.validFrom, value.validUntil],
          });
      for (const meter of commercial.meters)
        await tx.execute({
          sql: 'INSERT INTO commercial_meters (account_id, key, funding, balance, consumed, period_start, period_end) VALUES (?, ?, ?, ?, 0, ?, ?) ON CONFLICT(account_id, key) DO UPDATE SET funding = excluded.funding, balance = excluded.balance, period_start = excluded.period_start, period_end = excluded.period_end',
          args: [account.id, meter.key, meter.funding, meter.confirmedBalance, meter.periodStart, meter.periodEnd],
        });
      await tx.execute({
        sql: 'UPDATE commercial_state SET version = version + 1 WHERE account_id = ?',
        args: [account.id],
      });
      if (observation) {
        await tx.execute({
          sql: 'UPDATE billing_account_sync SET synchronized_generation = ? WHERE account_id = ? AND generation = ?',
          args: [BigInt(observation.generation), account.id, BigInt(observation.generation)],
        });
        await tx.execute({
          sql: "UPDATE billing_inbox SET status = 'done' WHERE account_id = ? AND generation <= ? AND status = 'pending'",
          args: [account.id, BigInt(observation.generation)],
        });
        await tx.execute({ sql: 'DELETE FROM billing_refresh_leases WHERE token = ?', args: [observation.token] });
      }
      const grants = (await tx.execute({ sql: 'SELECT * FROM credit_grants WHERE account_id = ?', args: [account.id] }))
        .rows;
      const meteredDebits = (
        await tx.execute({
          sql: 'SELECT meter, SUM(units) AS units FROM billing_ledger WHERE account_id = ? GROUP BY meter',
          args: [account.id],
        })
      ).rows;
      return {
        account,
        observedAt: new Date().toISOString(),
        validUntil: null,
        entitlements: commercial.entitlements,
        subscriptions: commercial.subscriptions,
        meters: commercial.meters.map(meter => {
          const rows = grants.filter(row => row.meter === meter.key);
          return {
            ...meter,
            confirmedBalance:
              meter.funding === 'prepaid'
                ? integer(
                    rows
                      .filter(row => row.available === 1n)
                      .reduce(
                        (sum, row) => sum + BigInt(String(row.original_units)) - BigInt(String(row.consumed_units)),
                        0n,
                      ),
                  )
                : null,
            consumedUnits:
              meter.funding === 'prepaid'
                ? integer(rows.reduce((sum, row) => sum + BigInt(String(row.consumed_units)), 0n))
                : integer(BigInt(String(meteredDebits.find(row => row.meter === meter.key)?.units ?? 0n))),
          };
        }),
        evidence: { version: String(BigInt(revision) + 1n) },
        prepaidAuthority: 'application-ledger',
      };
    });
  }
}

export async function allocateGrants(
  tx: Transaction,
  accountId: string,
  meter: string,
  units: number,
  executionId?: string,
) {
  const rows = (
    await tx.execute({
      sql: `SELECT g.*, COALESCE((SELECT SUM(a.reserved_units) FROM grant_allocations a WHERE a.grant_id = g.id AND a.committed_units IS NULL), 0) AS held FROM credit_grants g WHERE account_id = ? AND meter = ? AND available = 1 AND julianday(valid_from) <= julianday('now') AND (valid_until IS NULL OR julianday(valid_until) > julianday('now')) ORDER BY valid_until IS NULL, julianday(valid_until), id`,
      args: [accountId, meter],
    })
  ).rows;
  let remaining = BigInt(units);
  const allocations: { id: string; units: number }[] = [];
  for (const row of rows) {
    const available =
      BigInt(String(row.original_units)) - BigInt(String(row.consumed_units)) - BigInt(String(row.held));
    const take = available < remaining ? available : remaining;
    if (take > 0n) allocations.push({ id: String(row.id), units: Number(take) });
    remaining -= take;
    if (remaining === 0n) break;
  }
  if (remaining > 0n) throw new BillingError('insufficient_credits');
  if (executionId)
    for (const allocation of allocations)
      await tx.execute({
        sql: 'INSERT INTO grant_allocations (execution_id, grant_id, reserved_units) VALUES (?, ?, ?)',
        args: [executionId, allocation.id, allocation.units],
      });
}

export async function settleGrants(tx: Transaction, executionId: string, billed: number) {
  const rows = (
    await tx.execute({
      sql: 'SELECT a.* FROM grant_allocations a JOIN credit_grants g ON g.id = a.grant_id WHERE execution_id = ? AND committed_units IS NULL ORDER BY g.valid_until IS NULL, julianday(g.valid_until), g.id',
      args: [executionId],
    })
  ).rows;
  let remaining = billed;
  for (const row of rows) {
    const committed = Math.min(remaining, Number(row.reserved_units));
    await tx.execute({
      sql: 'UPDATE grant_allocations SET committed_units = ? WHERE execution_id = ? AND grant_id = ? AND committed_units IS NULL',
      args: [committed, executionId, row.grant_id],
    });
    await tx.execute({
      sql: 'UPDATE credit_grants SET consumed_units = consumed_units + ? WHERE id = ?',
      args: [committed, row.grant_id],
    });
    remaining -= committed;
  }
  if (rows.length && remaining !== 0) throw new BillingError('conflict');
}
