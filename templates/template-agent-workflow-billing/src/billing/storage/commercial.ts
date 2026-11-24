import { BillingError } from '../contracts/core.js';
import type { AdmissionIdentity } from '../runtime/accounting.js';
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
  financialSummary(identity: AdmissionIdentity) {
    return this.database.write(async tx => {
      if (identity.validUntil !== null && identity.validUntil <= Date.now()) throw new BillingError('unauthenticated');
      if (identity.credentialHash !== null) {
        const credential = (
          await tx.execute({
            sql: 'SELECT active FROM local_credentials WHERE hash = ? AND identity_id = ?',
            args: [identity.credentialHash, identity.actorId],
          })
        ).rows[0];
        if (credential?.active !== 1n) throw new BillingError('unauthenticated');
      }
      await this.organizations.authorizeInTransaction(tx, identity.actorId, identity.workspaceId, 'manage-billing');
      const rows = (
        await tx.execute({
          sql: "SELECT settlement, COUNT(*) AS count FROM billing_executions WHERE workspace_id = ? AND settlement IN ('pending', 'reserved', 'uncertain') GROUP BY settlement",
          args: [identity.workspaceId],
        })
      ).rows;
      return rows.map(row => ({ settlement: String(row.settlement), executions: Number(row.count) }));
    });
  }
  claim(identity: AdmissionIdentity, operation: 'checkout' | 'portal', key: string, fingerprint: string) {
    return this.transition(identity, operation, key, fingerprint, false);
  }
  dispatch(identity: AdmissionIdentity, operation: 'checkout' | 'portal', key: string, fingerprint: string) {
    return this.transition(identity, operation, key, fingerprint, true);
  }
  private transition(
    identity: AdmissionIdentity,
    operation: 'checkout' | 'portal',
    key: string,
    fingerprint: string,
    dispatch: boolean,
  ) {
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
        if (previous.url !== null) return { claimed: false, url: String(previous.url) };
        if (previous.dispatch_state !== 'not_dispatched') throw new BillingError('state_unavailable');
        if (dispatch)
          await tx.execute({
            sql: "UPDATE hosted_operations SET dispatch_state = 'dispatched' WHERE actor_id = ? AND workspace_id = ? AND operation = ? AND key = ?",
            args: [identity.actorId, identity.workspaceId, operation, key],
          });
        return { claimed: true, url: null };
      }
      if (dispatch) throw new BillingError('state_unavailable');
      await tx.execute({
        sql: "INSERT INTO hosted_operations (actor_id, workspace_id, operation, key, fingerprint, url, dispatch_state) VALUES (?, ?, ?, ?, ?, NULL, 'not_dispatched')",
        args: [identity.actorId, identity.workspaceId, operation, key, fingerprint],
      });
      return { claimed: true, url: null };
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
