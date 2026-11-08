import type { Row } from '@libsql/client/node';
import { accountSchema, BillingError } from '../contracts.js';

// The original provider column remains a storage discriminator so old foreign
// keys and migration checksums survive. All domain reads use effective_provider.
export function accountFromRow(row: Row) {
  return accountSchema.parse({
    id: row.id,
    workspaceId: row.workspace_id,
    provider: row.effective_provider,
    externalReference: row.external_reference,
  });
}
export function requireProvider(row: Row, provider: string) {
  const account = accountFromRow(row);
  if (account.provider !== provider) throw new BillingError('conflict');
  return account;
}
