import { BillingError } from '../contracts.js';
import { commercialCatalogSchema } from '../catalog.js';
import type { BillingDatabase } from './database.js';

export async function retainCatalog(database: BillingDatabase, input: unknown): Promise<void> {
  const catalog = commercialCatalogSchema.parse(input);
  await database.write(async tx => {
    for (const [kind, entries] of [
      ['allowance', catalog.allowances],
      ['offer', catalog.offers],
    ] as const) {
      for (const entry of entries) {
        const terms = JSON.stringify(entry);
        const existing = (
          await tx.execute({
            sql: 'SELECT terms FROM billing_catalog WHERE kind = ? AND key = ? AND version = ?',
            args: [kind, entry.key, entry.version],
          })
        ).rows[0];
        if (existing && existing.terms !== terms) throw new BillingError('conflict');
        if (!existing)
          await tx.execute({
            sql: 'INSERT INTO billing_catalog (kind, key, version, terms) VALUES (?, ?, ?, ?)',
            args: [kind, entry.key, entry.version, terms],
          });
      }
    }
  });
}
