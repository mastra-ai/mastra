import { BillingError } from '../contracts.js';
import { allowanceSchema, offerSchema, commercialCatalogSchema } from '../catalog.js';
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

export async function retainedCatalog(database: BillingDatabase) {
  return database.write(async tx => {
    const rows = (await tx.execute('SELECT kind, terms FROM billing_catalog ORDER BY kind, key, version')).rows;
    // Each saved revision was validated on insertion. Historical accumulation
    // may exceed the per-configuration size limit without discarding purchases.
    return {
      allowances: rows
        .filter(row => row.kind === 'allowance')
        .map(row => allowanceSchema.parse(JSON.parse(String(row.terms)))),
      offers: rows.filter(row => row.kind === 'offer').map(row => offerSchema.parse(JSON.parse(String(row.terms)))),
    };
  });
}
