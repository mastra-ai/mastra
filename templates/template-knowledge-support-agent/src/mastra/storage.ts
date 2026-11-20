import { LibSQLStore } from '@mastra/libsql';
import { PostgresStore } from '@mastra/pg';
import { storageConfiguration } from './database.ts';

/** Knowledge, Memory and workflow checkpoints always use the same native store. */
export function createStorage(id: string, databaseUrl?: string) {
  const configuration = storageConfiguration(databaseUrl);
  if (configuration.backend === 'postgres')
    return new PostgresStore({ id, connectionString: configuration.connectionString });
  return new LibSQLStore({ id, url: configuration.url, authToken: configuration.authToken });
}
