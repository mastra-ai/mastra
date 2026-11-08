import { BillingError } from '../contracts.js';
import type { AdmissionIdentity } from '../accounting.js';
import { BillingDatabase } from './database.js';
import type { OrganizationStorage } from './organizations.js';

export class CommercialStorage {
  private constructor(
    private readonly database: BillingDatabase,
    private readonly organizations: OrganizationStorage,
  ) {}
  static async open(options: { url: string }, organizations: OrganizationStorage) {
    return new CommercialStorage(await BillingDatabase.open(options), organizations);
  }
  close() {
    this.database.close();
  }
  claim(identity: AdmissionIdentity, operation: 'checkout' | 'portal', key: string, fingerprint: string) {
    return this.database.write(async tx => {
      if (identity.validUntil !== null && identity.validUntil <= Date.now()) throw new BillingError('unauthenticated');
      if (identity.credentialHash !== null) {
        const row = (
          await tx.execute({
            sql: 'SELECT active FROM local_credentials WHERE hash = ? AND identity_id = ?',
            args: [identity.credentialHash, identity.actorId],
          })
        ).rows[0];
        if (row?.active !== 1n) throw new BillingError('unauthenticated');
      }
      await this.organizations.authorizeInTransaction(tx, identity.actorId, identity.workspaceId, 'manage-billing');
      const previous = (
        await tx.execute({
          sql: 'SELECT * FROM hosted_operations WHERE actor_id = ? AND workspace_id = ? AND operation = ? AND key = ?',
          args: [identity.actorId, identity.workspaceId, operation, key],
        })
      ).rows[0];
      if (previous) {
        if (previous.fingerprint !== fingerprint) throw new BillingError('conflict');
        if (previous.url === null) throw new BillingError('state_unavailable');
        return { claimed: false, url: String(previous.url) };
      }
      await tx.execute({
        sql: 'INSERT INTO hosted_operations VALUES (?, ?, ?, ?, ?, NULL)',
        args: [identity.actorId, identity.workspaceId, operation, key, fingerprint],
      });
      return { claimed: true, url: null };
    });
  }
  allowance(identity: AdmissionIdentity) {
    return this.database.write(async tx => {
      await this.organizations.authorizeInTransaction(tx, identity.actorId, identity.workspaceId, 'manage-billing');
      const rows = (
        await tx.execute({
          sql: `SELECT g.*, COALESCE((SELECT SUM(a.reserved_units) FROM grant_allocations a WHERE a.grant_id = g.id AND a.committed_units IS NULL), 0) AS reserved FROM credit_grants g JOIN billing_accounts b ON b.id = g.account_id WHERE b.workspace_id = ?`,
          args: [identity.workspaceId],
        })
      ).rows;
      const meters = new Map<
        string,
        { granted: bigint; consumed: bigint; reserved: bigint; unavailable: bigint; spendable: bigint }
      >();
      for (const row of rows) {
        const meter = String(row.meter);
        const totals = meters.get(meter) ?? { granted: 0n, consumed: 0n, reserved: 0n, unavailable: 0n, spendable: 0n };
        const original = BigInt(String(row.original_units)),
          consumed = BigInt(String(row.consumed_units)),
          reserved = BigInt(String(row.reserved));
        const unused = original - consumed - reserved;
        if (unused < 0n) throw new BillingError('storage_incompatible');
        const active =
          row.available === 1n &&
          Date.parse(String(row.valid_from)) <= Date.now() &&
          (row.valid_until === null || Date.parse(String(row.valid_until)) > Date.now());
        totals.granted += original;
        totals.consumed += consumed;
        totals.reserved += reserved;
        if (active) totals.spendable += unused;
        else totals.unavailable += unused;
        meters.set(meter, totals);
      }
      return [...meters].map(([meter, totals]) => {
        const values = Object.entries(totals).map(([key, value]) => {
          if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new BillingError('state_unavailable');
          return [key, Number(value)] as const;
        });
        return { meter, ...Object.fromEntries(values) };
      });
    });
  }
  complete(identity: AdmissionIdentity, operation: string, key: string, url: string) {
    return this.database.write(tx =>
      tx.execute({
        sql: 'UPDATE hosted_operations SET url = ? WHERE actor_id = ? AND workspace_id = ? AND operation = ? AND key = ? AND url IS NULL',
        args: [url, identity.actorId, identity.workspaceId, operation, key],
      }),
    );
  }
}
