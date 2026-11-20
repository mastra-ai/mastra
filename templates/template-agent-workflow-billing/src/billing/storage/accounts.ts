import type { Row } from '@libsql/client/node';
import { accountSchema, BillingError } from '../contracts/core.js';

export function accountFromRow(row: Row) {
  return accountSchema.parse({
    id: row.id,
    workspaceId: row.workspace_id,
    provider: row.provider,
    externalReference: row.external_reference,
  });
}
export function requireProvider(row: Row, provider: string) {
  const account = accountFromRow(row);
  if (account.provider !== provider) throw new BillingError('conflict');
  return account;
}
