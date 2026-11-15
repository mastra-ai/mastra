import type { Transaction } from '@libsql/client/node';
import { randomUUID } from 'node:crypto';
import type { ProviderAccount } from '../../contracts/core.js';
import { BillingError, accountSchema, organizationProfileSchema, parseInput } from '../../contracts/core.js';
import { accountFromRow } from '../../storage/accounts.js';
import type { BillingDatabase } from '../../storage/database.js';

/** Local account identity and immutable Autumn payer links, never remote balances. */
export class AutumnAccountStorage {
  private readonly id = 'autumn';
  constructor(
    private readonly database: BillingDatabase,
    private readonly customer: (account: ProviderAccount) => { customerId: string },
    private readonly findCustomer: (workspaceId: string) => { customerId: string } | undefined,
  ) {}
  private async bindCustomer(tx: Transaction, account: ProviderAccount, customerId: string) {
    const links = (
      await tx.execute({
        sql: 'SELECT * FROM billing_provider_links WHERE provider = ? AND (account_id = ? OR customer_id = ?)',
        args: [this.id, account.id, customerId],
      })
    ).rows;
    if (
      links.some(
        link =>
          link.account_id !== account.id ||
          link.customer_id !== customerId ||
          link.external_reference !== account.externalReference,
      )
    )
      throw new BillingError('conflict');
    if (links.length) return;

    // Existing reserve intents also prove a target if this database predates
    // persisted Autumn links. Never associate their customer with a new payer.
    const historical = (
      await tx.execute({
        sql: "SELECT e.account_id, json_extract(r.payload, '$.customerId') AS customer_id FROM billing_remote_operations r JOIN billing_executions e ON e.id = r.execution_id WHERE json_extract(r.request, '$.account.provider') = 'autumn' AND (e.account_id = ? OR json_extract(r.payload, '$.customerId') = ?)",
        args: [account.id, customerId],
      })
    ).rows;
    if (historical.some(intent => intent.account_id !== account.id || intent.customer_id !== customerId))
      throw new BillingError('conflict');
    await tx.execute({
      sql: 'INSERT INTO billing_provider_links (account_id, provider, customer_id, organization_id, external_reference) VALUES (?, ?, ?, ?, ?)',
      args: [account.id, this.id, customerId, this.id, account.externalReference],
    });
  }

  async verifiedCustomer(account: ProviderAccount) {
    const binding = this.customer(account);
    await this.database.write(async tx => {
      const stored = (await tx.execute({ sql: 'SELECT * FROM billing_accounts WHERE id = ?', args: [account.id] }))
        .rows[0];
      if (!stored) throw new BillingError('conflict');
      const expected = accountFromRow(stored);
      if (
        expected.id !== account.id ||
        expected.workspaceId !== account.workspaceId ||
        expected.provider !== account.provider ||
        expected.externalReference !== account.externalReference
      )
        throw new BillingError('conflict');
      await this.bindCustomer(tx, account, binding.customerId);
    });
    return binding;
  }

  async ensureAccount(input: { workspaceId: string }): Promise<ProviderAccount> {
    const profile = parseInput(organizationProfileSchema, input);
    const binding = this.findCustomer(profile.workspaceId);
    if (!binding) throw new BillingError('forbidden');
    // Establish exclusive local ownership before get-or-create. Concurrent
    // deployments with incompatible bindings cannot both reach the provider.
    const account = await this.database.write(async tx => {
      const row = (
        await tx.execute({ sql: 'SELECT * FROM billing_accounts WHERE workspace_id = ?', args: [profile.workspaceId] })
      ).rows[0];
      const account = row
        ? accountFromRow(row)
        : accountSchema.parse({
            id: randomUUID(),
            workspaceId: profile.workspaceId,
            provider: this.id,
            externalReference: `workspace:${profile.workspaceId}`,
          });
      this.customer(account);
      if (!row) {
        await tx.execute({
          sql: "INSERT INTO billing_accounts (id, workspace_id, provider, external_reference) VALUES (?, ?, 'autumn', ?)",
          args: [account.id, account.workspaceId, account.externalReference],
        });
        await tx.execute({ sql: 'INSERT INTO commercial_state VALUES (?, 0)', args: [account.id] });
      }
      await this.bindCustomer(tx, account, binding.customerId);
      return account;
    });
    return account;
  }
}
