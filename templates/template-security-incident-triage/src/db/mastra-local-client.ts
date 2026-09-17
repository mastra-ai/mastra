import { createClient } from '@libsql/client';
import type { LibSQLConfig } from '@mastra/libsql';
import { acquireLocalWrite } from './local-write-coordinator.js';
import { toStorageError } from '../domain/errors.js';
import type { StorageConfig } from './config.js';

type MastraClient = Extract<LibSQLConfig, { client: unknown }>['client'];

/** Share local write ownership with operational transactions, including retries. */
export function createMastraLocalClient(config: StorageConfig): MastraClient {
  const client = createClient({ ...config, timeout: 0 });
  async function locked<T>(operation: () => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      const release = await acquireLocalWrite(config.url);
      try {
        // Mastra domains may set their own synchronous busy timeout at init.
        // Restore nonblocking contention handling before each operation.
        await client.execute('PRAGMA busy_timeout=0');
        return await operation();
      } catch (error) {
        if (!toStorageError(error).retryable || attempt >= 7) throw error;
        // The embedded driver can retain a stale statement/snapshot after a
        // failed batch. Retrying on that connection cannot make progress.
        await client.reconnect();
      } finally {
        release();
      }
      // Yield so another process or an existing transaction can finish.
      await new Promise(resolve => setTimeout(resolve, Math.min(25 * 2 ** attempt, 500)));
    }
  }
  return {
    get closed() {
      return client.closed;
    },
    get protocol() {
      return client.protocol;
    },
    close: () => client.close(),
    execute: statement => locked(() => client.execute(statement)),
    batch: (statements, mode) => locked(() => client.batch(statements, mode === 'read' ? 'read' : 'write')),
    transaction: async mode => {
      // Retain ownership until commit/rollback/close, not merely until BEGIN.
      const release = await acquireLocalWrite(config.url);
      let transaction;
      try {
        await client.execute('PRAGMA busy_timeout=0');
        transaction = await client.transaction(mode === 'read' ? 'read' : 'write');
      } catch (error) {
        try {
          if (toStorageError(error).retryable) await client.reconnect();
        } finally {
          release();
        }
        throw error;
      }
      let released = false;
      const close = () => {
        if (released) return;
        try {
          transaction.close();
        } finally {
          released = true;
          release();
        }
      };
      return {
        get closed() {
          return transaction.closed;
        },
        execute: statement => transaction.execute(statement),
        commit: async () => {
          try {
            await transaction.commit();
          } finally {
            close();
          }
        },
        rollback: async () => {
          try {
            await transaction.rollback();
          } finally {
            close();
          }
        },
        close,
      };
    },
  };
}
