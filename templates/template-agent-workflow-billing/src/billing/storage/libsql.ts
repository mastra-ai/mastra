import { randomUUID } from 'node:crypto';
import type { Row, Transaction } from '@libsql/client/node';
import { z } from 'zod';
import {
  BillingError,
  accountSchema,
  identifierSchema,
  organizationProfileSchema,
  parseInput,
  usageEventSchema,
} from '../contracts.js';
import type {
  CommercialGrant,
  CommercialSnapshot,
  OrganizationBillingProfile,
  ProviderAccount,
  ReconciliationRequest,
  ReconciliationResult,
  UsageDelivery,
  UsageEvent,
} from '../contracts.js';
import { localAccountSeedSchema } from '../configuration.js';
import type { LocalAccountSeed } from '../configuration.js';
import { BillingDatabase } from './database.js';
import { accountFromRow, requireProvider } from './accounts.js';

function publicInteger(value: unknown): number {
  if (typeof value !== 'bigint' || value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER))
    throw new BillingError('storage_incompatible');
  return Number(value);
}

export class LocalBillingStorage {
  private constructor(private readonly database: BillingDatabase) {}

  static async open(options: { url: string }): Promise<LocalBillingStorage> {
    return new LocalBillingStorage(await BillingDatabase.open(options));
  }

  close(): void {
    this.database.close();
  }

  private write<T>(operation: (transaction: Transaction) => Promise<T>): Promise<T> {
    return this.database.write(operation);
  }

  async ensureAccount(profile: OrganizationBillingProfile, initialState?: LocalAccountSeed): Promise<ProviderAccount> {
    const { workspaceId } = parseInput(organizationProfileSchema, profile);
    const seed = parseInput(localAccountSeedSchema, initialState ?? { workspaceId });
    if (seed.workspaceId !== workspaceId) throw new BillingError('conflict');
    return this.write(async transaction => {
      const existing = await transaction.execute({
        sql: 'SELECT * FROM billing_accounts WHERE workspace_id = ?',
        args: [workspaceId],
      });
      if (existing.rows.length > 0) return requireProvider(existing.rows[0], 'local');
      const account: ProviderAccount = {
        id: randomUUID(),
        workspaceId,
        provider: 'local',
        externalReference: `workspace:${workspaceId}`,
      };
      // The external reference has the same bounded identifier contract.
      parseInput(accountSchema, account);
      await transaction.execute({
        sql: 'INSERT INTO billing_accounts (id, workspace_id, provider, external_reference) VALUES (?, ?, ?, ?)',
        args: [account.id, workspaceId, account.provider, account.externalReference],
      });
      await transaction.execute({
        sql: 'INSERT INTO commercial_state (account_id, version) VALUES (?, 0)',
        args: [account.id],
      });
      for (const [kind, grants] of [
        ['entitlement', seed.entitlements],
        ['subscription', seed.subscriptions],
      ] as const) {
        for (const grant of grants)
          await transaction.execute({
            sql: 'INSERT INTO commercial_grants (account_id, kind, key, valid_from, valid_until) VALUES (?, ?, ?, ?, ?)',
            args: [account.id, kind, grant.key, grant.validFrom, grant.validUntil],
          });
      }
      for (const meter of seed.meters)
        await transaction.execute({
          sql: 'INSERT INTO commercial_meters (account_id, key, funding, balance, consumed, period_start, period_end) VALUES (?, ?, ?, ?, 0, ?, ?)',
          args: [account.id, meter.key, meter.funding, meter.balance, meter.periodStart, meter.periodEnd],
        });
      return account;
    });
  }

  private async requireAccount(transaction: Transaction, account: ProviderAccount): Promise<void> {
    const found = await transaction.execute({ sql: 'SELECT * FROM billing_accounts WHERE id = ?', args: [account.id] });
    if (!found.rows.length) throw new BillingError('account_not_found');
    const stored = requireProvider(found.rows[0], 'local');
    if (
      stored.workspaceId !== account.workspaceId ||
      stored.provider !== account.provider ||
      stored.externalReference !== account.externalReference
    )
      throw new BillingError('conflict');
  }

  private async snapshot(transaction: Transaction, account: ProviderAccount): Promise<CommercialSnapshot> {
    await this.requireAccount(transaction, account);
    const observedAt = new Date().toISOString();
    const state = await transaction.execute({
      sql: 'SELECT version FROM commercial_state WHERE account_id = ?',
      args: [account.id],
    });
    const grants = await transaction.execute({
      sql: 'SELECT kind, key, valid_from, valid_until FROM commercial_grants WHERE account_id = ? ORDER BY kind, key',
      args: [account.id],
    });
    const activeGrants = (kind: string): CommercialGrant[] =>
      grants.rows
        .filter(
          row =>
            row.kind === kind &&
            Date.parse(String(row.valid_from)) <= Date.parse(observedAt) &&
            (row.valid_until === null || Date.parse(String(row.valid_until)) > Date.parse(observedAt)),
        )
        .map(row => ({
          key: String(row.key),
          validFrom: String(row.valid_from),
          validUntil: row.valid_until === null ? null : String(row.valid_until),
        }));
    const meters = await transaction.execute({
      sql: 'SELECT * FROM commercial_meters WHERE account_id = ? ORDER BY key',
      args: [account.id],
    });
    return {
      account,
      observedAt,
      validUntil: null,
      entitlements: activeGrants('entitlement'),
      subscriptions: activeGrants('subscription'),
      meters: meters.rows.map(row => ({
        key: String(row.key),
        funding: row.funding as 'prepaid' | 'metered',
        confirmedBalance: row.balance === null ? null : publicInteger(row.balance),
        consumedUnits: publicInteger(row.consumed),
        periodStart: row.period_start === null ? null : String(row.period_start),
        periodEnd: row.period_end === null ? null : String(row.period_end),
      })),
      evidence: { version: String(publicInteger(state.rows[0].version)) },
    };
  }

  async getState(input: ProviderAccount): Promise<CommercialSnapshot> {
    const account = parseInput(accountSchema, input);
    return this.write(transaction => this.snapshot(transaction, account));
  }

  async reportUsage(input: UsageEvent): Promise<UsageDelivery> {
    const event = parseInput(usageEventSchema, input);
    // Schema output fixes field order, including allowlisted metadata, for replay.
    const payload = JSON.stringify(event);
    return this.write(async transaction => {
      const existing = await transaction.execute({
        sql: 'SELECT payload FROM immutable_usage WHERE id = ?',
        args: [event.id],
      });
      if (existing.rows.length > 0) {
        if (existing.rows[0].payload !== payload) throw new BillingError('conflict');
        return { status: 'duplicate', eventId: event.id };
      }
      await this.requireAccount(transaction, event.account);
      const meter = (
        await transaction.execute({
          sql: 'SELECT funding, balance FROM commercial_meters WHERE account_id = ? AND key = ?',
          args: [event.account.id, event.meter],
        })
      ).rows[0];
      if (!meter) throw new BillingError('conflict');
      if (meter.funding === 'prepaid' && publicInteger(meter.balance) < event.units)
        throw new BillingError('insufficient_credits');
      await transaction.execute({
        sql: 'INSERT INTO immutable_usage (id, account_id, meter, execution_id, policy_version, units, occurred_at, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        args: [
          event.id,
          event.account.id,
          event.meter,
          event.executionId,
          event.policyVersion,
          event.units,
          event.occurredAt,
          payload,
        ],
      });
      await transaction.execute({
        sql: "UPDATE commercial_meters SET balance = CASE WHEN funding = 'prepaid' THEN balance - ? ELSE NULL END, consumed = consumed + ? WHERE account_id = ? AND key = ?",
        args: [event.units, event.units, event.account.id, event.meter],
      });
      // A late constraint failure here must roll back both usage and the meter.
      await transaction.execute({
        sql: 'UPDATE commercial_state SET version = version + 1 WHERE account_id = ?',
        args: [event.account.id],
      });
      return { status: 'accepted', eventId: event.id };
    });
  }

  async reconcile(input: ReconciliationRequest): Promise<ReconciliationResult> {
    const request = parseInput(
      z.strictObject({
        account: accountSchema,
        eventIds: z
          .array(identifierSchema)
          .max(1000)
          .refine(ids => new Set(ids).size === ids.length),
      }),
      input,
    );
    return this.write(async transaction => {
      const snapshot = await this.snapshot(transaction, request.account);
      const reflectedEventIds: string[] = [];
      for (const id of request.eventIds) {
        const row = (
          await transaction.execute({ sql: 'SELECT account_id FROM immutable_usage WHERE id = ?', args: [id] })
        ).rows[0];
        if (row && row.account_id !== request.account.id) throw new BillingError('conflict');
        if (row) reflectedEventIds.push(id);
      }
      return { status: 'confirmed', reflectedEventIds, snapshot };
    });
  }
}
