import { setTimeout } from 'node:timers/promises';
import { createClient } from '@libsql/client/node';
import type { Client, Transaction } from '@libsql/client/node';
import { z } from 'zod';
import { BillingError } from '../contracts.js';
import { migrateStorage } from './migrations.js';

const storageOptionsSchema = z.strictObject({
  url: z.string().refine(value => {
    try {
      const url = new URL(value);
      return (
        url.protocol === 'file:' &&
        !url.host &&
        url.pathname.startsWith('/') &&
        url.pathname !== '/' &&
        !url.search &&
        !url.hash &&
        !url.pathname.includes(':memory:')
      );
    } catch {
      return false;
    }
  }),
});

const isBusy = (error: unknown) =>
  error !== null &&
  typeof error === 'object' &&
  'code' in error &&
  ['SQLITE_BUSY', 'SQLITE_BUSY_SNAPSHOT', 'SQLITE_LOCKED', 'TRANSACTION_ACTIVE'].includes(String(error.code));

export class BillingDatabase {
  private closed = false;
  private constructor(private readonly url: string) {}

  static async open(options: { url: string }): Promise<BillingDatabase> {
    const parsed = storageOptionsSchema.safeParse(options);
    if (!parsed.success) throw new BillingError('invalid_configuration');
    const database = new BillingDatabase(parsed.data.url);
    await database.write(migrateStorage);
    return database;
  }

  close(): void {
    this.closed = true;
  }

  async write<T>(operation: (transaction: Transaction) => Promise<T>): Promise<T> {
    // Retry only complete aborted SQL transactions, never external work.
    for (let attempt = 0; attempt < 50; attempt++) {
      if (this.closed) throw new BillingError('storage_unavailable');
      let client: Client | undefined;
      let transaction: Transaction | undefined;
      try {
        // Dispose every attempt: libSQL can retain a failed BEGIN on its connection.
        client = createClient({ url: this.url, intMode: 'bigint', concurrency: 1, timeout: 0 });
        const journal = await client.execute('PRAGMA journal_mode');
        if (journal.rows[0].journal_mode !== 'wal') {
          const configured = await client.execute('PRAGMA journal_mode = WAL');
          if (configured.rows[0].journal_mode !== 'wal') throw new BillingError('storage_incompatible');
        }
        await client.execute('PRAGMA foreign_keys = ON');
        await client.execute('PRAGMA busy_timeout = 0');
        transaction = await client.transaction('write');
        const enforcement = await transaction.execute('PRAGMA foreign_keys');
        if (enforcement.rows[0].foreign_keys !== 1n) throw new BillingError('storage_incompatible');
        const result = await operation(transaction);
        await transaction.commit();
        return result;
      } catch (error) {
        if (transaction && !transaction.closed) {
          try {
            await transaction.rollback();
          } catch {
            /* Disposal aborts any remaining transaction. */
          }
        }
        if (!isBusy(error) || attempt === 49)
          throw error instanceof BillingError ? error : new BillingError('storage_unavailable');
      } finally {
        try {
          transaction?.close();
        } catch {
          /* Always dispose the owned client. */
        } finally {
          client?.close();
        }
      }
      await setTimeout(20);
    }
    throw new BillingError('storage_unavailable');
  }
}
