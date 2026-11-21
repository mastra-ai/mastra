import { LibSQLStore } from '@mastra/libsql';
import { PostgresStore } from '@mastra/pg';
import type { StorageConfiguration } from './database.ts';

/** Knowledge, Memory and workflow checkpoints always use the same native store. */
export function createStore(id: string, configuration: StorageConfiguration) {
  if (configuration.backend === 'postgres')
    return new PostgresStore({ id, connectionString: configuration.connectionString });
  return new LibSQLStore({ id, url: configuration.url, authToken: configuration.authToken });
}
